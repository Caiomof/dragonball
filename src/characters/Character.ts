import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { Race, RaceId } from '../data/gameConfig';
import { DEFAULT_APPEARANCE, type Appearance } from '../data/profiles';

const toon = (color: THREE.ColorRepresentation, emissive: THREE.ColorRepresentation = 0x000000) => new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: 0.2 });

function shape(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function orb(group: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE.Mesh {
  const mesh = shape(group, new THREE.SphereGeometry(1, 16, 12), mat, x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

function tube(group: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, radiusTop: number, radiusBottom: number, length: number, sides = 10): THREE.Mesh {
  return shape(group, new THREE.CylinderGeometry(radiusTop, radiusBottom, length, sides), mat, x, y, z);
}

type Palette = { skin: string; hair: string; top: string; bottom: string; trim: string; boot: string; eye: string };

const palettes: Record<RaceId, Palette> = {
  saiyajin: { skin: '#e6b48f', hair: '#172439', top: '#ef8936', bottom: '#253a6e', trim: '#ffe6a3', boot: '#20344c', eye: '#152238' },
  terraqueo: { skin: '#bd8061', hair: '#4c2e28', top: '#3caaa0', bottom: '#f4e1b0', trim: '#f2d267', boot: '#5b4534', eye: '#26323a' },
  namekuseijin: { skin: '#74bb63', hair: '#73bd64', top: '#7a66ae', bottom: '#ebe5d7', trim: '#e4c58a', boot: '#8e5a57', eye: '#4d3941' },
  majin: { skin: '#ef9dc0', hair: '#ef9dc0', top: '#282a45', bottom: '#e0e6e9', trim: '#f4c96f', boot: '#e6c958', eye: '#40334f' }
};

export class Character {
  readonly root = new THREE.Group();
  readonly figure = new THREE.Group();
  readonly leftArm = new THREE.Group();
  readonly rightArm = new THREE.Group();
  readonly leftLeg = new THREE.Group();
  readonly rightLeg = new THREE.Group();
  readonly race: Race;
  private readonly face: THREE.Group;
  private readonly aura: THREE.Group;
  private elapsed = 0;
  private external: THREE.Group | null = null;
  private externalBaseY = 0;
  private mixer: THREE.AnimationMixer | null = null;
  private readonly clips = new Map<string, THREE.AnimationAction>();
  private currentClip = '';
  private attackingLastFrame = false;
  private attackAge = 0;
  private destroyed = false;
  private appearance: Appearance = {...DEFAULT_APPEARANCE};
  private headBone: THREE.Object3D | null = null;
  private readonly embellishments = new THREE.Group();
  private readonly visualStatusListeners: ((ok: boolean) => void)[] = [];
  private loaded = false;
  private animationMode: 'idle' | 'walk' | 'run' | 'jump' | 'flight' | 'charge' | 'punch' = 'idle';
  private hitPoseUntil = 0;
  private readonly auraRings: THREE.Mesh[] = [];
  private readonly auraSparks: { mesh: THREE.Mesh; angle: number; phase: number; distance: number }[] = [];
  private readonly auraLight = new THREE.PointLight(0x6bcaff, 0, 6);
  private static modelPromise: Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] } | null> | null = null;


  constructor(race: Race) {
    this.race = race;
    const p = palettes[race.id];
    const skin = toon(p.skin);
    const hair = toon(p.hair);
    const shirt = toon(p.top);
    const pants = toon(p.bottom);
    const accent = toon(p.trim);
    const boots = toon(p.boot);
    const eye = toon(p.eye);
    const white = toon('#f9f3dd');
    this.root.name = `Guerreiro - ${race.name}`;
    this.root.add(this.figure);

    const body = shape(this.figure, new THREE.CylinderGeometry(0.49, 0.4, 0.93, 10), shirt, 0, 1.75, 0);
    body.scale.z = 0.78;
    orb(this.figure, shirt, 0, 2.09, 0, 0.52, 0.16, 0.38);
    tube(this.figure, accent, 0, 1.32, 0, 0.43, 0.43, 0.13);
    tube(this.figure, pants, 0, 1.17, 0, 0.46, 0.43, 0.3);
    shape(this.figure, new THREE.BoxGeometry(0.23, 0.24, 0.07), accent, 0, 1.32, -0.45);
    if (race.id === 'saiyajin') {
      orb(this.figure, accent, 0, 1.88, -0.42, 0.23, 0.24, 0.055);
      orb(this.figure, white, -0.25, 2.12, 0, 0.24, 0.18, 0.35);
      orb(this.figure, white, 0.25, 2.12, 0, 0.24, 0.18, 0.35);
    }
    if (race.id === 'namekuseijin') {
      const scarf = tube(this.figure, white, 0, 2.18, 0, 0.37, 0.52, 0.32, 12);
      scarf.scale.z = 0.89;
      const cape = shape(this.figure, new THREE.ConeGeometry(0.6, 1.4, 4, 1, true), white, 0, 1.54, 0.27);
      cape.scale.z = 0.35;
      cape.rotation.x = -0.21;
    }
    if (race.id === 'majin') {
      const ornament = orb(this.figure, accent, 0, 1.87, -0.41, 0.13, 0.13, 0.05);
      ornament.rotation.z = Math.PI / 4;
    }

    this.buildArm(this.leftArm, -0.64, shirt, skin, accent);
    this.buildArm(this.rightArm, 0.64, shirt, skin, accent);
    this.figure.add(this.leftArm, this.rightArm);
    this.buildLeg(this.leftLeg, -0.27, pants, boots, accent);
    this.buildLeg(this.rightLeg, 0.27, pants, boots, accent);
    this.figure.add(this.leftLeg, this.rightLeg);

    const neck = tube(this.figure, skin, 0, 2.32, 0, 0.17, 0.21, 0.25);
    neck.scale.z = 0.88;
    this.face = new THREE.Group();
    this.face.position.y = 2.64;
    this.figure.add(this.face);
    orb(this.face, skin, 0, 0, 0, race.id === 'majin' ? 0.44 : 0.39, race.id === 'majin' ? 0.48 : 0.45, 0.4);
    orb(this.face, skin, 0, -0.23, -0.11, 0.29, 0.2, 0.28);
    for (const x of [-0.145, 0.145]) {
      orb(this.face, white, x, 0.025, -0.353, 0.091, 0.13, 0.038);
      orb(this.face, eye, x, 0.022, -0.395, 0.037, 0.095, 0.014);
      const brow = orb(this.face, hair, x, 0.172, -0.358, 0.104, 0.031, 0.027);
      brow.rotation.z = x < 0 ? -0.2 : 0.2;
    }
    orb(this.face, skin, 0, -0.13, -0.4, 0.064, 0.075, 0.06);
    const mouth = orb(this.face, eye, 0, -0.278, -0.37, 0.078, 0.018, 0.015);
    mouth.scale.y = 0.7;

    if (race.id === 'saiyajin') this.addHair(hair, 10, 0.65, true);
    if (race.id === 'terraqueo') this.addHair(hair, 9, 0.27, false);
    if (race.id === 'namekuseijin') {
      for (const x of [-0.25, 0.25]) {
        const ear = shape(this.face, new THREE.ConeGeometry(0.14, 0.33, 5), skin, x > 0 ? 0.43 : -0.43, -0.055, 0);
        ear.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        const antenna = tube(this.face, skin, x * 0.8, 0.52, -0.17, 0.07, 0.105, 0.38, 7);
        antenna.rotation.z = x > 0 ? -0.27 : 0.27;
        orb(this.face, skin, x * 0.8 + (x > 0 ? 0.06 : -0.06), 0.73, -0.17, 0.085, 0.1, 0.085);
      }
      for (const side of [-1, 1]) {
        orb(this.figure, accent, side * 0.79, 1.62, -0.01, 0.18, 0.13, 0.17);
      }
    }
    if (race.id === 'majin') {
      const horn = shape(this.face, new THREE.ConeGeometry(0.18, 0.87, 12), skin, 0.13, 0.73, 0.13);
      horn.rotation.z = -0.3;
      const tip = orb(this.face, skin, 0.38, 1.07, 0.15, 0.17, 0.19, 0.16);
      tip.rotation.z = 0.2;
      for (const side of [-1, 1]) orb(this.face, skin, side * 0.41, -0.04, -0.02, 0.15, 0.12, 0.15);
    }

    this.aura = new THREE.Group();
    const auraMat = new THREE.MeshBasicMaterial({ color: 0x7bd8ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
    const auraCone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.8, 18, 1, true), auraMat);
    auraCone.position.y = 1.75;
    this.aura.add(auraCone);
    this.aura.visible = false;
    this.root.add(this.aura);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x4dbdff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8 + i * 0.14, 0.023, 6, 38), ringMaterial.clone());
      ring.rotation.x = Math.PI / 2 - i * 0.14;
      ring.position.y = 0.45 + i * 0.7;
      this.aura.add(ring);
      this.auraRings.push(ring);
    }
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.035 + (i % 4) * 0.009), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffffff : 0x68caff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.aura.add(mesh);
      this.auraSparks.push({ mesh, angle: i * 2.39996, phase: i / 24, distance: 0.48 + i % 5 * 0.13 });
    }
    this.auraLight.position.y = 1.5;
    this.aura.add(this.auraLight);
    void this.tryLoadModel();
  }

  private async tryLoadModel(): Promise<void> {
    if (!Character.modelPromise) {
      Character.modelPromise = new GLTFLoader().loadAsync('/models/origens-warrior.glb')
        .then(result => ({ scene: result.scene, animations: result.animations }))
        .catch(() => null);
    }
    const source = await Character.modelPromise;
    if (!source || this.destroyed || source.animations.length === 0) { for (const callback of this.visualStatusListeners) callback(false); return; }
    const model = cloneSkeleton(source.scene) as THREE.Group;
    const palette = palettes[this.race.id];
    const eyeCol = new THREE.Color(this.appearance.eyeColor);
    const hairCol = new THREE.Color(this.appearance.hairColor);
    const raceSkin = new THREE.Color(palette.skin);
    const raceTop = new THREE.Color(palette.top);
    const raceBottom = new THREE.Color(palette.bottom);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const recolor = (original: THREE.Material): THREE.Material => {
        const material = original.clone();
        if ('color' in material && material.color instanceof THREE.Color) {
          const label = original.name.toUpperCase();
          if (label === 'SKIN') material.color.copy(raceSkin);
          else if (label === 'GI_TOP') material.color.copy(raceTop);
          else if (label === 'PANTS') material.color.copy(raceBottom);
          else if (label === 'HAIR') material.color.copy(hairCol);
          else if (label === 'EYE_IRIS') material.color.copy(eyeCol);
        }
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(recolor) : recolor(object.material);
      if (this.race.id === 'namekuseijin' || this.race.id === 'majin') {
        if (object.name.startsWith('HAIR_')) object.visible = false;
      }
    });
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y < 0.2 || size.y > 500) return;
    const scale = 2.16 / size.y;
    model.scale.setScalar(scale);
    model.rotation.y = 0; // A malha original olha para -Z, mesma direção do movimento.
    model.position.set(-(bounds.min.x + size.x / 2) * scale, -bounds.min.y * scale, -(bounds.min.z + size.z / 2) * scale);
    this.headBone = model.getObjectByName('Head') ?? null;
    if (this.headBone) {
      this.headBone.add(this.embellishments);
      this.applyFaceDetails(1 / scale);
    }
    this.externalBaseY = model.position.y;
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of source.animations) {
      const action = this.mixer.clipAction(clip);
      if (/punch/i.test(clip.name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.clips.set(clip.name.toLowerCase().split('|').pop() || clip.name.toLowerCase(), action);
    }
    this.external = model;
    this.figure.visible = false;
    this.root.add(model);
    this.applyAppearance();
    this.playClip('idle', 0.01);
    this.mixer.update(0.035);
    this.loaded = true;
    for (const callback of this.visualStatusListeners) callback(true);
  }

  onModelStatus(callback: (ok: boolean) => void): void {
    this.visualStatusListeners.push(callback);
    if (this.loaded) callback(true);
  }

  setAppearance(value: Appearance): void {
    this.appearance = {...value};
    this.applyAppearance();
  }

  private applyAppearance(): void {
    const a = this.appearance;
    const h = THREE.MathUtils.clamp(a.height, 0.78, 1.28);
    const w = THREE.MathUtils.clamp(a.build, 0.72, 1.5);
    // O pivô do pé é a origem do modelo; escalar preserva apoio no terreno.
    if (this.external) {
      const baseline = (this.external.userData.baseScale as number) || this.external.scale.y;
      this.external.userData.baseScale = baseline;
      this.external.scale.set(baseline * w, baseline * h, baseline * w);
      this.external.position.y = this.externalBaseY * h;
      this.external.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        for(const m of materials){
          if(!('color' in m) || !(m.color instanceof THREE.Color))continue;
          if(m.name==='HAIR')m.color.set(a.hairColor);
          if(m.name==='EYE_IRIS')m.color.set(a.eyeColor);
        }
        if(object.name.startsWith('HAIR_SPIKE')) object.visible = this.race.id!=='namekuseijin' && this.race.id!=='majin' && a.hair!==1;
        if(object.name==='HAIR_SCALP' || object.name==='HAIR_BANG')object.visible=this.race.id!=='namekuseijin'&&this.race.id!=='majin';
      });
    }
    this.figure.scale.set(w * h, h, w * h);
    this.face.scale.setScalar(THREE.MathUtils.clamp(a.hair === 2 ? 1.035 : 1,1,1.05));
    if (this.headBone) this.applyFaceDetails(1 / ((this.external?.userData.baseScale as number) ?? 1));
  }

  private applyFaceDetails(inverseModelScale: number): void {
    this.embellishments.clear();
    const a = this.appearance;
    const palette = palettes[this.race.id];
    const col = new THREE.MeshToonMaterial({ color: a.hairColor });
    const skin = new THREE.MeshToonMaterial({ color: palette.skin });
    this.embellishments.scale.setScalar(inverseModelScale);
    if (this.race.id === 'majin') {
      const tentacle = new THREE.Mesh(new THREE.ConeGeometry(.095,.38,10), skin);
      tentacle.position.set(.14,.40,.03); tentacle.rotation.z=-.3;this.embellishments.add(tentacle);
    }
    if (this.race.id === 'namekuseijin') for(const s of [-1,1]) {
      const antenna = new THREE.Mesh(new THREE.ConeGeometry(.065,.30,10),skin);
      antenna.position.set(s*.15,.36,-.06);antenna.rotation.z=s*-.28;this.embellishments.add(antenna);
    }
    if (a.hair === 1 && this.race.id !== 'namekuseijin' && this.race.id !== 'majin') {
      const strand = new THREE.Mesh(new THREE.SphereGeometry(1,16,10),col);
      strand.scale.set(.28,.07,.25);strand.position.set(0,.26,.04);this.embellishments.add(strand);
    }
    if(a.beard && (this.race.id==='saiyajin'||this.race.id==='terraqueo')) {
      const beard=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),col);
      beard.scale.set(.18,.09,.13);beard.position.set(0,-.185,-.17);this.embellishments.add(beard);
    }
  }

  gesture(kind: 'punch' | 'charge'): void {
    this.animationMode = kind;
    this.hitPoseUntil = this.elapsed + (kind === 'punch' ? 0.43 : 0.24);
    this.playClip(kind, .07);
  }

  private playClip(name: string, fade = 0.18): void {
    if (name === this.currentClip || !this.mixer) return;
    const action = this.clips.get(name) ?? this.clips.get('standing') ?? this.clips.get('idle');
    if (!action) return;
    const previous = this.clips.get(this.currentClip);
    if (previous && previous !== action) previous.fadeOut(fade);
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    this.currentClip = name;
  }

  private buildArm(group: THREE.Group, x: number, shirt: THREE.Material, skin: THREE.Material, trim: THREE.Material): void {
    group.position.set(x, 2.01, 0);
    orb(group, shirt, 0, -0.12, 0, 0.23, 0.25, 0.24);
    const upper = tube(group, skin, 0, -0.43, 0, 0.13, 0.15, 0.61);
    upper.rotation.z = x < 0 ? -0.05 : 0.05;
    tube(group, trim, 0, -0.82, 0, 0.16, 0.14, 0.18);
    orb(group, skin, 0, -1.00, -0.025, 0.145, 0.19, 0.14);
  }

  private buildLeg(group: THREE.Group, x: number, pants: THREE.Material, boots: THREE.Material, trim: THREE.Material): void {
    group.position.set(x, 1.14, 0);
    tube(group, pants, 0, -0.32, 0, 0.22, 0.16, 0.71);
    tube(group, boots, 0, -0.76, 0, 0.17, 0.23, 0.45);
    tube(group, trim, 0, -0.57, 0, 0.19, 0.19, 0.09);
    orb(group, boots, 0, -1.04, -0.13, 0.23, 0.15, 0.33);
  }

  private addHair(mat: THREE.Material, count: number, length: number, dramatic: boolean): void {
    orb(this.face, mat, 0, 0.27, 0.04, 0.41, 0.31, 0.41);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 0.29;
      const spike = shape(this.face, new THREE.ConeGeometry(dramatic ? 0.20 : 0.15, length * (0.9 + ((i * 7) % 4) * 0.22), 5), mat,
        Math.cos(angle) * radius, 0.43 + (i % 3) * 0.04, Math.sin(angle) * radius);
      spike.rotation.z = -Math.cos(angle) * (dramatic ? 0.45 : 0.25);
      spike.rotation.x = Math.sin(angle) * (dramatic ? 0.45 : 0.24);
    }
    for (let i = -2; i <= 2; i++) {
      const bang = shape(this.face, new THREE.ConeGeometry(0.11, 0.33, 5), mat, i * 0.13, 0.26, -0.31);
      bang.rotation.x = -Math.PI * 0.24;
      bang.rotation.z = i * 0.09;
    }
  }

  animate(dt: number, speed: number, airborne: boolean, attacking: boolean, flying = false, sprint = false): void {
    this.elapsed += Math.min(dt, 0.05);
    // Fixed rates: magnitude of configurable run speed NEVER changes animation frequency.
    const moving = speed > 0.35;
    const locomotion = moving ? (sprint ? 'run' : 'walk') : 'idle';
    const rate = sprint ? 9.5 : 6.2;
    const sway = Math.sin(this.elapsed * rate) * (moving ? 1 : 0);
    if (attacking && !this.attackingLastFrame) this.attackAge = 0;
    this.attackingLastFrame = attacking;
    if (attacking) this.attackAge += dt;
    const gestureActive = this.elapsed < this.hitPoseUntil;
    const pose = (attacking || gestureActive) ? 1 : 0;
    this.leftLeg.rotation.x = airborne ? -0.15 : sway * .39;
    this.rightLeg.rotation.x = airborne ? .22 : -sway * .39;
    this.leftArm.rotation.x = -sway*.32 + pose*.85;
    this.rightArm.rotation.x = sway*.32 + pose*.9;
    this.leftArm.rotation.z = -.10-pose*.12;
    this.rightArm.rotation.z = .10+pose*.12;
    this.figure.position.y = flying ? Math.sin(this.elapsed * 3.0)*.035 : 0;
    this.figure.rotation.x = flying ? -.12 : 0;
    if (this.mixer && this.external) {
      const wanted = this.animationMode === 'punch' && gestureActive ? 'punch'
        : attacking ? 'charge' : flying ? 'flight' : airborne ? 'jump' : locomotion;
      this.playClip(wanted, wanted === 'run' || wanted === 'walk' ? .23 : .13);
      // Animation playback is constant even if the player upgrades movement speed.
      this.mixer.update(Math.min(dt, .05));
      this.external.rotation.x = flying ? -.15 : 0;
      if (!gestureActive) this.animationMode = 'idle';
    }
    this.aura.visible = attacking;
    if (attacking) {
      const intensity = Math.min(1, this.attackAge * 4);
      this.aura.scale.setScalar(0.84 + intensity * 0.25 + Math.sin(this.elapsed * 17) * 0.035);
      this.auraLight.intensity = intensity * 5;
      for (let i = 0; i < this.auraRings.length; i++) {
        const ring = this.auraRings[i];
        ring.position.y = 0.32 + (i * 0.68 + this.elapsed * (1.15 + i * 0.1)) % 2.9;
        ring.rotation.z = this.elapsed * (0.35 + i * 0.14);
      }
      for (const spark of this.auraSparks) {
        const t = (this.elapsed * 0.95 + spark.phase) % 1;
        const angle = spark.angle + this.elapsed * 1.5;
        spark.mesh.position.set(Math.cos(angle) * spark.distance * (1 - t * 0.25), 0.15 + t * 3.05, Math.sin(angle) * spark.distance * (1 - t * 0.25));
        spark.mesh.scale.setScalar(0.7 + t * 1.1);
      }
    } else this.auraLight.intensity = 0;
  }

  setAuraColor(color: number, core: number): void {
    this.auraLight.color.setHex(color);
    for (const ring of this.auraRings) (ring.material as THREE.MeshBasicMaterial).color.setHex(color);
    for (let i = 0; i < this.auraSparks.length; i++) {
      (this.auraSparks[i].mesh.material as THREE.MeshBasicMaterial).color.setHex(i % 3 === 0 ? core : color);
    }
  }

  getMuzzleWorldPosition(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    const position = new THREE.Vector3(0, 1.38, -0.72);
    return this.root.localToWorld(position);
  }

  dispose(): void {
    this.destroyed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (!this.external || !this.external.getObjectById(obj.id)) geometries.add(obj.geometry);
        const entries = Array.isArray(obj.material) ? obj.material : [obj.material];
        entries.forEach((material) => materials.add(material));
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
