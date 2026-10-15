import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { World } from './World';

type Kind = 'wolf' | 'deer';

type Animal = {
  kind: Kind;
  hostile: boolean;
  health: number;
  maxHealth: number;
  group: THREE.Group;
  home: THREE.Vector3;
  respawn: number;
  biteAt: number;
  wander: number;
  mixer?: THREE.AnimationMixer;
  idle?: THREE.AnimationAction;
  walk?: THREE.AnimationAction;
  current?: THREE.AnimationAction;
};

export class Wildlife {
  private readonly animals: Animal[] = [];
  private elapsed = 0;

  constructor(private readonly world: World) {
    this.spawn('wolf', new THREE.Vector3(-14, 0, -10), true, 70);
    this.spawn('wolf', new THREE.Vector3(8, 0, -24), true, 70);
    this.spawn('deer', new THREE.Vector3(-20, 0, 14), false, 40);
    for (const animal of this.animals) this.place(animal, animal.home);
    void this.loadAnimals();
  }

  update(dt: number, player: THREE.Vector3, bite: (amount: number) => void): void {
    this.elapsed += dt;
    for (const animal of this.animals) {
      if (animal.respawn > 0) {
        animal.respawn -= dt;
        animal.group.visible = false;
        if (animal.respawn <= 0) {
          animal.health = animal.maxHealth;
          this.place(animal, animal.home);
          animal.group.visible = true;
        }
        continue;
      }
      const pos = animal.group.position;
      const toPlayer = player.clone().sub(pos);
      toPlayer.y = 0;
      const distance = toPlayer.length();
      let step = new THREE.Vector3();
      let running = false;
      if (animal.hostile && distance < 18 && distance > 0.2) {
        running = distance > 2.1;
        const speed = distance < 2.4 ? 9.5 : 6.8;
        step = toPlayer.normalize().multiplyScalar(speed * dt);
        if (distance < 2.35 && this.elapsed > animal.biteAt) {
          animal.biteAt = this.elapsed + 0.85;
          bite(8);
        }
      } else if (!animal.hostile && distance < 6) {
        step = toPlayer.normalize().multiplyScalar(-2.4 * dt);
      } else {
        animal.wander += dt;
        const angle = animal.wander * 0.35 + animal.home.x;
        step.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(0.7 * dt);
        if (pos.distanceTo(animal.home) > 8) step.copy(animal.home).sub(pos).setY(0).normalize().multiplyScalar(1.2 * dt);
      }
      const next = pos.clone().add(step);
      if (this.world.isWalkable(next.x, next.z, 0.4) && !this.world.inRiver(next.x, next.z)) {
        pos.x = next.x;
        pos.z = next.z;
      }
      pos.y = this.world.height(pos.x, pos.z);
      if (step.lengthSq() > 0.0001) animal.group.rotation.y = Math.atan2(-step.x, -step.z);
      this.updateAnimation(animal, dt, step.lengthSq() > 0.000001, running);
    }
  }

  // Real animal models can replace placeholders without changing AI, hitboxes,
  // damage, respawn or the current gameplay data. They must be bundled locally.
  private async loadAnimals(): Promise<void> {
    const loader=new GLTFLoader();
    for(const kind of ['wolf','deer'] as const) {
      const uri=`/models/wildlife/${kind}.glb`;
      try {
        const head=await fetch(uri,{method:'HEAD'});
        if (!head.ok || /html/i.test(head.headers.get('content-type') ?? '')) continue;
        const asset=await loader.loadAsync(uri);
        for(const animal of this.animals.filter(a=>a.kind===kind)) {
          const display=cloneSkeleton(asset.scene);
          display.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
          display.updateMatrixWorld(true);
          const bounds=new THREE.Box3().setFromObject(display);
          const dims=bounds.getSize(new THREE.Vector3());
          if(dims.y<.01)continue;
          const scale=(kind==='wolf'?1.15:1.8)/dims.y;
          display.scale.setScalar(scale);
          display.position.set(-(bounds.min.x+dims.x*.5)*scale,-bounds.min.y*scale,-(bounds.min.z+dims.z*.5)*scale);
          // Leave one logical animal root for movement/damage. Only rendering swaps.
          for(const child of animal.group.children)child.visible=false;
          animal.group.add(display);
          if(asset.animations.length) {
            const mixer=new THREE.AnimationMixer(display);
            const clips=asset.animations;
            const idle=clips.find(c=>/idle|stand|rest/i.test(c.name))??clips[0];
            const walk=clips.find(c=>/walk|move|run|gallop/i.test(c.name))??idle;
            animal.mixer=mixer;
            animal.idle=mixer.clipAction(idle);
            animal.walk=mixer.clipAction(walk);
            animal.current=animal.idle;
            animal.idle.play();
          }
        }
      } catch(error) {
        console.info(`[Wildlife] ${kind}.glb não foi encontrado ou não pôde ser carregado.`,error);
      }
    }
  }

  private updateAnimation(animal: Animal, dt: number, moving: boolean, running = false): void {
    if(!animal.mixer)return;
    const target=moving?animal.walk:animal.idle;
    if(target && target!==animal.current) {
      animal.current?.fadeOut(.22);
      target.reset().setEffectiveWeight(1).fadeIn(.22).play();
      animal.current=target;
    }
    animal.current?.setEffectiveTimeScale(running ? 1.65 : 1);
    animal.mixer.update(Math.min(dt,.05));
  }

  damageAlong(from: THREE.Vector3, to: THREE.Vector3, radius: number, amount: number): { actual: number; dead: boolean } | null {
    const segment = to.clone().sub(from);
    const length = segment.length();
    if (length < 0.001) return this.damageAt(to, amount, radius);
    segment.multiplyScalar(1 / length);
    let best: Animal | null = null;
    let bestDistance = radius;
    for (const animal of this.animals) {
      if (animal.health <= 0) continue;
      const center = animal.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      const along = THREE.MathUtils.clamp(center.clone().sub(from).dot(segment), 0, length);
      const closest = from.clone().addScaledVector(segment, along);
      const distance = closest.distanceTo(center);
      if (distance < bestDistance) {
        best = animal;
        bestDistance = distance;
      }
    }
    return best ? this.hurt(best, amount) : null;
  }

  strike(origin: THREE.Vector3, direction: THREE.Vector3, reach: number, amount: number): { actual: number; dead: boolean } | null {
    let best: Animal | null = null;
    let bestDistance = reach;
    for (const animal of this.animals) {
      if (animal.health <= 0) continue;
      const center = animal.group.position.clone().add(new THREE.Vector3(0, 0.7, 0));
      const along = center.clone().sub(origin);
      const distance = along.length();
      if (distance > bestDistance) continue;
      if (along.normalize().dot(direction) < 0.35) continue;
      best = animal;
      bestDistance = distance;
    }
    return best ? this.hurt(best, amount) : null;
  }

  damageAt(point: THREE.Vector3, amount: number, radius = 4.2): { actual: number; dead: boolean } | null {
    let best: Animal | null = null;
    let bestDistance = radius;
    for (const animal of this.animals) {
      if (animal.health <= 0) continue;
      const distance = animal.group.position.distanceTo(point);
      if (distance < bestDistance) {
        best = animal;
        bestDistance = distance;
      }
    }
    return best ? this.hurt(best, amount) : null;
  }

  private hurt(animal: Animal, amount: number): { actual: number; dead: boolean } {
    const actual = Math.min(animal.health, amount);
    animal.health -= actual;
    if (animal.health <= 0) {
      animal.health = 0;
      animal.respawn = 25;
      animal.group.visible = false;
    }
    return { actual, dead: animal.health <= 0 };
  }

  private place(animal: Animal, spot: THREE.Vector3): void {
    animal.group.position.set(spot.x, this.world.height(spot.x, spot.z), spot.z);
  }

  private spawn(kind: Kind, home: THREE.Vector3, hostile: boolean, health: number): void {
    const group = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: kind === 'wolf' ? 0x6d7278 : 0xc4a36a, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: kind === 'wolf' ? 0x2c3136 : 0x8b5a32, roughness: 0.75 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), fur);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.62;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), fur);
    head.position.set(0, 0.78, 0.55);
    head.castShadow = true;
    group.add(body, head);
    if (kind === 'deer') {
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.28, 5), dark);
      hornL.position.set(-0.08, 1.02, 0.52);
      const hornR = hornL.clone();
      hornR.position.x = 0.08;
      group.add(hornL, hornR);
    } else {
      const earL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), dark);
      earL.position.set(-0.1, 0.98, 0.5);
      const earR = earL.clone();
      earR.position.x = 0.1;
      group.add(earL, earR);
    }
    for (const [x, z] of [[-0.16, 0.28], [0.16, 0.28], [-0.16, -0.28], [0.16, -0.28]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6), dark);
      leg.position.set(x, 0.22, z);
      leg.castShadow = true;
      group.add(leg);
    }
    this.world.group.add(group);
    this.animals.push({ kind, hostile, health, maxHealth: health, group, home: home.clone(), respawn: 0, biteAt: 0, wander: Math.random() * 6 });
  }
}
