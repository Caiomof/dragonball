import * as THREE from 'three';
import { ABILITIES, applyDamage } from '../data/gameConfig';
import type { World } from '../world/World';

export class TrainingDummy {
  readonly group = new THREE.Group();
  readonly hitCenter = new THREE.Vector3();
  health = ABILITIES.trainingDummy.health;
  readonly maxHealth = ABILITIES.trainingDummy.health;
  private readonly healthFill = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.13), new THREE.MeshBasicMaterial({ color: 0x6ce9c8, side: THREE.DoubleSide, depthTest: false }));
  private readonly body: THREE.Group;
  private respawnRemaining = 0;
  private flashRemaining = 0;

  constructor(world: World) {
    this.group.name = 'TrainingDummy — Guardião da Clareira';
    this.group.position.copy(world.dummyPosition);
    this.body = new THREE.Group();
    this.group.add(this.body);
    const wood = new THREE.MeshStandardMaterial({ color: 0x8d6040, flatShading: true, roughness: 0.9 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe6be73, metalness: 0.2, roughness: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: 0xb95d4e, roughness: 0.85 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x747f77, roughness: 0.95 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number], rotationX = 0): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...position);
      mesh.rotation.x = rotationX;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.body.add(mesh);
      return mesh;
    };
    add(new THREE.CylinderGeometry(0.83, 1.05, 0.5, 8), stone, [0, 0.24, 0]);
    add(new THREE.CylinderGeometry(0.22, 0.27, 2.25, 9), wood, [0, 1.42, 0]);
    add(new THREE.CylinderGeometry(0.18, 0.18, 1.8, 8), wood, [0, 1.84, 0], Math.PI / 2);
    add(new THREE.SphereGeometry(0.66, 12, 10), red, [0, 2.0, 0]);
    add(new THREE.TorusGeometry(0.47, 0.07, 8, 24), gold, [0, 2.0, -0.52]);
    add(new THREE.TorusGeometry(0.26, 0.067, 8, 24), gold, [0, 2.0, -0.58]);
    add(new THREE.SphereGeometry(0.10, 9, 8), gold, [0, 2.0, -0.63]);
    add(new THREE.ConeGeometry(0.32, 0.55, 5), gold, [0, 2.85, 0]);
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.23), new THREE.MeshBasicMaterial({ color: 0x162a2e, side: THREE.DoubleSide, depthTest: false }));
    barBg.position.set(0, 3.58, 0);
    this.group.add(barBg);
    this.healthFill.position.set(0, 3.58, -0.01);
    this.group.add(this.healthFill);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 6, 44), new THREE.MeshBasicMaterial({ color: 0xffdb8e, transparent: true, opacity: 0.38 }));
    frame.scale.y = 0.28;
    frame.rotation.x = Math.PI / 2;
    frame.position.y = 0.04;
    this.group.add(frame);
    this.hitCenter.copy(this.group.position).add(new THREE.Vector3(0, 2.0, 0));
    world.group.add(this.group);
  }

  takeDamage(amount: number): { actual: number; dead: boolean } {
    if (this.health <= 0) return { actual: 0, dead: false };
    const prev = this.health;
    this.health = applyDamage(this.health, amount);
    this.flashRemaining = 0.3;
    const fraction = this.health / this.maxHealth;
    this.healthFill.scale.x = fraction;
    this.healthFill.position.x = -(1 - fraction) * 0.95;
    if (this.health === 0) {
      this.body.visible = false;
      this.respawnRemaining = ABILITIES.trainingDummy.respawnSeconds;
    }
    return { actual: prev - this.health, dead: this.health === 0 };
  }

  reset(): void {
    this.health = this.maxHealth;
    this.respawnRemaining = 0;
    this.flashRemaining = 0;
    this.body.visible = true;
    this.group.visible = true;
    this.healthFill.scale.x = 1;
    this.healthFill.position.x = 0;
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.flashRemaining > 0) {
      this.flashRemaining -= dt;
      this.body.scale.setScalar(1 + Math.sin(this.flashRemaining * 48) * 0.06);
    } else this.body.scale.setScalar(1);
    if (this.respawnRemaining > 0) {
      this.respawnRemaining -= dt;
      if (this.respawnRemaining <= 0) {
        this.health = this.maxHealth;
        this.body.visible = true;
        this.healthFill.scale.x = 1;
        this.healthFill.position.x = 0;
      }
    }
    this.healthFill.lookAt(camera.position);
    for (const child of this.group.children) {
      if (child instanceof THREE.Mesh && child !== this.healthFill && child.position.y > 3) child.lookAt(camera.position);
    }
  }
}

export type AttackStyle = 'kamehameha' | 'galick' | 'masenko' | 'kienzan' | 'orb';
export type AttackVisual = { style: AttackStyle; color: number; core: number; chargeSeconds: number; effectSeconds: number; size?: number };

type ActiveEffect = {
  root: THREE.Group;
  charge: THREE.Group;
  body: THREE.Group;
  core: THREE.Mesh;
  aura: THREE.Mesh;
  rings: THREE.Mesh[];
  particles: THREE.Mesh[];
  origin: THREE.Vector3;
  destination: THREE.Vector3;
  direction: THREE.Vector3;
  life: number;
  hit: boolean;
  style: AttackVisual;
  onImpact: (position: THREE.Vector3) => void;
};

export class CombatEffects {
  private readonly scene: THREE.Scene;
  private readonly effects: ActiveEffect[] = [];
  private readonly sparks: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];

  constructor(scene: THREE.Scene) { this.scene = scene; }

  cast(origin: THREE.Vector3, destination: THREE.Vector3, style: AttackVisual, onImpact: (position: THREE.Vector3) => void): void {
    const direction = destination.clone().sub(origin).normalize();
    const root = new THREE.Group();
    const charge = new THREE.Group();
    const coreMaterial = new THREE.MeshBasicMaterial({ color: style.core, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.98, toneMapped: false });
    const auraMaterial = new THREE.MeshBasicMaterial({ color: style.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.48, toneMapped: false, side: THREE.DoubleSide });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), coreMaterial);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.84, 16, 12), auraMaterial);
    charge.add(sphere, halo);
    charge.add(new THREE.PointLight(style.color, 7, 9));
    root.add(charge);
    const body = new THREE.Group();
    const disc = style.style === 'kienzan';
    const orb = style.style === 'orb';
    const core = new THREE.Mesh(orb ? new THREE.SphereGeometry(.3,20,14):disc ? new THREE.CylinderGeometry(1.05, 1.05, 0.11, 40) : new THREE.CylinderGeometry(0.19, 0.19, 1, 20, 1, true), coreMaterial);
    const aura = new THREE.Mesh(orb ? new THREE.SphereGeometry(.56,20,14): disc ? new THREE.TorusGeometry(1.04, 0.19, 12, 40) : new THREE.CylinderGeometry(0.48, 0.48, 1, 20, 1, true), auraMaterial);
    body.add(core, aura);
    const rings: THREE.Mesh[] = [];
    if (!disc && !orb) for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.04, 8, 24), coreMaterial);
      ring.rotation.x = Math.PI / 2;
      body.add(ring); rings.push(ring);
    }
    const particles: THREE.Mesh[] = [];
    const particleGeo = new THREE.TetrahedronGeometry(0.075);
    for (let i = 0; i < 30; i++) {
      const p = new THREE.Mesh(particleGeo, i % 4 === 0 ? coreMaterial : auraMaterial);
      root.add(p);
      particles.push(p);
    }
    body.visible = false;
    root.add(body);
    this.scene.add(root);
    this.effects.push({ root, charge, body, core, aura, rings, particles, origin: origin.clone(), destination: destination.clone(), direction, life: 0, hit: false, style, onImpact });
  }

  update(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life += dt;
      const active = e.life >= e.style.chargeSeconds;
      const progress = Math.max(0, Math.min(1, (e.life - e.style.chargeSeconds) / e.style.effectSeconds));
      const distance = e.origin.distanceTo(e.destination);
      e.charge.position.copy(e.origin);
      e.charge.visible = !active;
      e.charge.scale.setScalar(0.7 + Math.min(1, e.life / Math.max(0.01, e.style.chargeSeconds)) * 0.8 + Math.sin(e.life * 65) * 0.08);
      e.body.visible = active;
      const disc = e.style.style === 'kienzan';
      const orb = e.style.style === 'orb';
      if (disc || orb) {
        const travel = Math.min(1, progress / 0.7);
        e.body.position.copy(e.origin).lerp(e.destination, travel);
        e.body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), e.direction);
        e.body.rotateY(e.life * 34);
        e.body.scale.setScalar((e.style.size ?? 1) * (disc ? 1.1 : .78) * (1 + Math.sin(e.life * 25) * 0.09));
      } else {
        const beamLength = distance * THREE.MathUtils.smoothstep(progress, 0, 0.26);
        e.body.position.copy(e.origin).addScaledVector(e.direction, beamLength / 2);
        e.body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), e.direction);
        const size = e.style.size ?? 1;
        e.body.scale.set(size * (1 + Math.sin(e.life * 50) * 0.1), Math.max(0.001, beamLength), size * (1 + Math.sin(e.life * 37) * 0.08));
        e.rings.forEach((ring, n) => {
          ring.position.y = ((n / e.rings.length + progress * 2.4) % 1) - 0.5;
          ring.scale.setScalar(0.8 + Math.sin(e.life * 29 + n) * 0.13);
        });
      }
      e.particles.forEach((p, n) => {
        const a = n * 2.39996;
        const t = active ? ((n / e.particles.length + progress * 3) % 1) : 0;
        const spread = active ? 0.34 : 0.72;
        p.position.copy(e.origin).addScaledVector(e.direction, distance * t);
        p.position.x += Math.cos(a + e.life * 17) * spread;
        p.position.y += Math.sin(a + e.life * 22) * spread;
        p.position.z += Math.sin(a * 2 + e.life * 14) * spread;
        p.scale.setScalar(Math.max(0.15, 1 - progress));
      });
      if (active && progress >= (disc ? 0.68 : 0.23) && !e.hit) {
        e.hit = true;
        this.impact(e.destination, e.style.color);
        e.onImpact(e.destination);
      }
      if (e.life >= e.style.chargeSeconds + e.style.effectSeconds) {
        this.scene.remove(e.root);
        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        e.root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          geometries.add(object.geometry);
          if (Array.isArray(object.material)) object.material.forEach((m) => materials.add(m));
          else materials.add(object.material);
        });
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        this.effects.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.life -= dt;
      spark.mesh.position.addScaledVector(spark.velocity, dt);
      spark.velocity.y -= 7 * dt;
      spark.mesh.scale.setScalar(Math.max(0.01, spark.life * 1.4));
      if (spark.life <= 0) { this.scene.remove(spark.mesh); spark.mesh.geometry.dispose(); this.sparks.splice(i, 1); }
    }
  }

  private impact(point: THREE.Vector3, color: number): void {
    const material = new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 36; i++) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 + Math.random() * 0.1, 0), material);
      mesh.position.copy(point);
      this.scene.add(mesh);
      this.sparks.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.3) * 17, (Math.random() - 0.5) * 18), life: 0.5 + Math.random() * 0.35 });
    }
  }

  get activeCount(): number { return this.effects.length; }
}
