import { buildAccessories, disposeAccessories } from './Appearance';
import { createHeroClips } from '../animation/HeroClips';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { Race, RaceId } from '../data/gameConfig';
import { DEFAULT_APPEARANCE, type Appearance } from '../data/profiles';
import type { SkillId } from '../data/skills';

type GestureKind = 'punch' | 'punchcross' | 'charge' | 'beam' | 'disc' | 'kiopen';

const CLIP_ALIASES: Record<string, string[]> = {
  idle: ['idle_loop', 'idle'],
  walk: ['walk_loop', 'walk'],
  run: ['sprint_loop', 'jog_fwd_loop', 'run'],
  jump: ['jump_loop', 'jump_start', 'jump'],
  flight: ['flight_hover'],
  flighttakeoff: ['flight_takeoff'],
  flightcruise: ['flight_cruise'],
  crouch: ['crouch_idle_loop', 'idle_loop'],
  push: ['push_loop', 'spell_simple_idle_loop'],
  kiopen: ['spell_simple_shoot', 'spell_simple_idle_loop', 'beam'],
  punch: ['punch_jab', 'punch'],
  punchcross: ['punch_cross', 'punch_jab', 'punch'],
  charge: ['spell_simple_idle_loop', 'charge'],
  beam: ['spell_simple_shoot', 'spell_simple_idle_loop', 'beam'],
  disc: ['sword_attack', 'spell_simple_shoot', 'disc'],
  swim: ['swim_fwd_loop', 'swim_idle_loop', 'walk_loop'],
  swimidle: ['swim_idle_loop', 'idle_loop']
};
type FlightPhase = 'ground' | 'takeoff' | 'hover' | 'cruise' | 'brake';

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

let sharedFlameTexture: THREE.CanvasTexture | undefined;
function flameTexture(): THREE.CanvasTexture {
  if(sharedFlameTexture)return sharedFlameTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const glow = ctx.createRadialGradient(64, 78, 4, 64, 70, 62);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.28, 'rgba(255,255,255,0.55)');
  glow.addColorStop(0.62, 'rgba(255,255,255,0.16)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  sharedFlameTexture=texture;
  return texture;
}

const LEG_TRACK = /thigh_|calf_|foot_|ball_|pelvis|(^|\/)root\./i;
const ARM_TRACK = /upperarm_|lowerarm_|hand_|clavicle_|spine_|neck_|Head|index_|middle_|ring_|pinky_|thumb_/i;

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
  private currentAction: THREE.AnimationAction | null = null;
  private auraMode: 'off' | 'charge' | 'surge' = 'off';
  private attackingLastFrame = false;
  private attackAge = 0;
  private destroyed = false;
  private appearance: Appearance = {...DEFAULT_APPEARANCE};
  private headBone: THREE.Object3D | null = null;
  private readonly embellishments = new THREE.Group();
  private heroHair = new THREE.Group();
  readonly ready: Promise<boolean>;
  private lastAirborne = false;
  private landUntil = 0;
  private activeTechnique: SkillId = 'kamehameha';
  readonly clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly visualStatusListeners: ((ok: boolean) => void)[] = [];
  private loaded = false;
  private animationMode: GestureKind | 'idle' = 'idle';
  private hitPoseUntil = 0;
  private readonly auraFlames: { sprite: THREE.Sprite; angle: number; phase: number; radius: number; height: number }[] = [];
  private auraCore: THREE.Sprite | null = null;
  private legsAction: THREE.AnimationAction | null = null;
  private armsAction: THREE.AnimationAction | null = null;
  private readonly auraLight = new THREE.PointLight(0x6bcaff, 0, 6);
  private static modelPromise: Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] } | null> | null = null;
  private firstPerson = false;
  private texturedHero = false;
  private readonly handGlows: THREE.Sprite[] = [];
  private static outfitTextures = new Map<RaceId, THREE.Texture>();


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
    this.aura.visible = false;
    this.root.add(this.aura);
    const glow = flameTexture();
    const coreMat = new THREE.SpriteMaterial({ map: glow, color: 0xfff6d2, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.auraCore = new THREE.Sprite(coreMat);
    this.auraCore.position.y = 1.35;
    this.auraCore.scale.set(1.15, 2.35, 1);
    this.aura.add(this.auraCore);
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.SpriteMaterial({ map: glow, color: 0x7ad7ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const sprite = new THREE.Sprite(mat);
      sprite.center.set(0.5, 0.15);
      this.aura.add(sprite);
      this.auraFlames.push({ sprite, angle: i * 2.39996, phase: i / 22, radius: 0.28 + (i % 5) * 0.06, height: 0.35 + (i % 4) * 0.18 });
    }
    this.auraLight.position.y = 1.5;
    this.aura.add(this.auraLight);
    this.ready = this.tryLoadModel();
  }

  static castAnimationForSkill(skill: SkillId): GestureKind {
    if (skill === 'kienzan') return 'disc';
    if (skill === 'galick' || skill === 'masenko') return 'beam';
    return 'charge';
  }

  private async tryLoadModel(): Promise<boolean> {
    if (!Character.modelPromise) {
      const loader = new GLTFLoader();
      Character.modelPromise = Promise.all([
        loader.loadAsync('/models/hero/Superhero_Male_FullBody.gltf'),
        loader.loadAsync('/models/anims/ual1.glb')
      ]).then(([hero, motion]) => ({
        scene: hero.scene,
        animations: [...(motion?.animations ?? []), ...hero.animations, ...createHeroClips(hero.scene, motion?.animations ?? hero.animations)]
      })).catch(() => null);
    }
    const source = await Character.modelPromise;
    if (!source || this.destroyed || source.animations.length === 0) {
      this.figure.visible = true;
      for (const callback of this.visualStatusListeners) callback(false);
      return false;
    }
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
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox;
      if (!box) return;
      bounds.union(box.clone().applyMatrix4(object.matrixWorld));
    });
    const size = bounds.getSize(new THREE.Vector3());
    const height = !bounds.isEmpty() && Number.isFinite(size.y) && size.y > 0.2 && size.y < 30 ? size.y : 1.8;
    const scale = 2.16 / height;
    model.scale.setScalar(scale);
    model.rotation.y = Math.PI;
    model.position.set(-(bounds.min.x + size.x / 2) * scale, -bounds.min.y * scale, -(bounds.min.z + size.z / 2) * scale);
    // Material UVs and skeleton stay untouched: each race gets a custom
    // gi/uniform texture painted using the actual GLTF bone weights and UVs.
    let outfit = Character.outfitTextures.get(this.race.id);
    if (!outfit) {
      try {outfit = await new THREE.TextureLoader().loadAsync(`/models/hero/T_Origens_Gi_${this.race.id}.png`);} catch {for(const callback of this.visualStatusListeners)callback(false);return false;}
      if(this.destroyed)return false;
      outfit.flipY = false; // glTF UV origin is top-left for this exported model.
      outfit.colorSpace = THREE.SRGBColorSpace;
      outfit.anisotropy = 4;
      Character.outfitTextures.set(this.race.id, outfit);
    }
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial && material.name === 'MI_Superhero_Male') {
          material.map = outfit;
          material.needsUpdate = true;
        }
      }
    });
    // Glow follows real hand bones, never arbitrary world offsets or primitive arms.
    const glowMap = flameTexture();
    for (const name of ['hand_l', 'hand_r']) {
      const bone = model.getObjectByName(name);
      if (!bone) continue;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap, color:0x79d7ff, transparent:true, opacity:0.86, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false}));
      sprite.position.set(0,0,0);
      sprite.scale.set(0.24,0.24,0.24);
      sprite.visible=false;
      bone.add(sprite);
      this.handGlows.push(sprite);
    }
    this.headBone = model.getObjectByName('Head') ?? null;
    this.texturedHero = Boolean(model.getObjectByName('SuperHero_Male'));
    if (this.headBone && !this.texturedHero) {
      this.headBone.add(this.embellishments);
      this.applyFaceDetails(1 / scale);
    }
    this.externalBaseY = model.position.y;
    model.traverse(object => { object.userData.restQuat = object.quaternion.clone(); });
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of source.animations) {
      const key = clip.name.toLowerCase().split('|').pop() || clip.name.toLowerCase();
      const once = /punch|sword|shoot|jump_start|jump_land|hit_|death|spell_simple_enter|spell_simple_exit|release_|flight_takeoff/i.test(clip.name);
      const action = this.mixer.clipAction(clip);
      if (once) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.clips.set(key, action);
      const legs = clip.tracks.filter(track => LEG_TRACK.test(track.name));
      const arms = clip.tracks.filter(track => ARM_TRACK.test(track.name));
      if (legs.length > 3) this.clips.set(`${key}__legs`, this.mixer.clipAction(new THREE.AnimationClip(`${key}__legs`, clip.duration, legs)));
      if (arms.length > 3) {
        const armAction = this.mixer.clipAction(new THREE.AnimationClip(`${key}__arms`, clip.duration, arms));
        if (once) {
          armAction.setLoop(THREE.LoopOnce, 1);
          armAction.clampWhenFinished = true;
        }
        this.clips.set(`${key}__arms`, armAction);
      }
    }
    this.external = model;
    this.root.add(model);
    this.syncBodyVisibility();
    this.playClip('idle', 0.01);
    this.mixer.update(0.035);
    this.applyAppearance();
    this.loaded = true;
    for (const callback of this.visualStatusListeners) callback(true);
    return true;
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
        const skinTint = new THREE.Color(palettes[this.race.id].skin);
        for(const m of materials){
          if(!('color' in m) || !(m.color instanceof THREE.Color))continue;
          const label = m.name.toUpperCase();
          if (this.texturedHero) {
            const hairPiece = object.name === 'Eyebrows' || label.includes('HAIR');
            const eyePiece = object.name === 'Eyes' || (label.includes('EYE') && !label.includes('EYEBROW'));
            if (hairPiece) m.color.set(a.hairColor);
            else if (eyePiece) m.color.set(a.eyeColor);
            else m.color.set('#ffffff');
            if (object.name === 'Eyebrows') object.visible = true;
            continue;
          }
          if(label==='HAIR' || label.includes('HAIR'))m.color.set(a.hairColor);
          if(label==='EYE_IRIS' || label.includes('EYE'))m.color.set(a.eyeColor);
          if(label.includes('SUPERHERO') || label==='SKIN')m.color.copy(skinTint);
        }
        if(object.name.startsWith('HAIR_SPIKE')) object.visible = this.race.id!=='namekuseijin' && this.race.id!=='majin' && a.hair!==1;
        if(object.name==='HAIR_SCALP' || object.name==='HAIR_BANG')object.visible=this.race.id!=='namekuseijin'&&this.race.id!=='majin';
      });
    }
    this.figure.scale.set(w * h, h, w * h);
    this.face.scale.setScalar(THREE.MathUtils.clamp(a.hair === 2 ? 1.035 : 1,1,1.05));
    if (this.headBone && this.texturedHero) this.syncHeroHair();
    else if (this.headBone) this.applyFaceDetails(1 / ((this.external?.userData.baseScale as number) ?? 1));
  }

  private syncHeroHair(): void {
    if(!this.headBone||!this.external)return;
    disposeAccessories(this.heroHair);
    this.heroHair=buildAccessories(this.external,this.headBone,this.appearance,this.race.id);
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

  setTechnique(id:SkillId):void {this.activeTechnique=id;}

  gesture(kind: GestureKind): void {
    this.animationMode = kind;
    const duration = kind === 'punchcross' ? 0.78 : kind === 'punch' ? 0.62 : kind === 'disc' ? 0.48 : 0.36;
    this.hitPoseUntil = this.elapsed + duration;
    this.currentClip = '';
    this.playClip(kind === 'beam' || kind === 'disc' ? `release_${this.activeTechnique}` : kind === 'charge' ? `charge_${this.activeTechnique}` : kind, .12);
  }

  copyEye(target: THREE.Vector3): boolean {
    if (!this.headBone) return false;
    this.headBone.getWorldPosition(target);
    return true;
  }

  setFirstPerson(enabled: boolean): void {
    if(this.firstPerson===enabled)return;
    this.firstPerson = enabled;
    this.syncBodyVisibility();
    this.heroHair.visible = !enabled;
    this.external?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const hideHead = enabled && /^(Face|Eyebrows|Eyes)/.test(object.name);
      object.visible = !hideHead;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.clippingPlanes = enabled ? [this.clipPlane] : null;
        material.clipShadows = true;
      }
    });
  }

  private syncBodyVisibility(): void {
    const hero = this.external;
    if (this.firstPerson) {
      this.figure.visible = false;
      if (hero) hero.visible = false;
      return;
    }
    if (hero) {
      this.figure.visible = false;
      hero.visible = true;
      return;
    }
    this.figure.visible = true;
  }

  setAuraActive(active: boolean, mode: 'charge' | 'surge' = 'charge'): void {
    this.auraMode = active ? mode : 'off';
  }

  private resolveClip(name: string): THREE.AnimationAction | undefined {
    for (const key of CLIP_ALIASES[name] ?? [name]) {
      const action = this.clips.get(key);
      if (action) return action;
    }
    return this.clips.get('idle_loop') ?? this.clips.get('idle');
  }

  private resolveLayer(name: string, part: 'legs' | 'arms'): THREE.AnimationAction | undefined {
    for (const key of CLIP_ALIASES[name] ?? [name]) {
      const action = this.clips.get(`${key}__${part}`);
      if (action) return action;
    }
    return undefined;
  }

  private stopLayers(fade = 0.12): void {
    this.legsAction?.fadeOut(fade);
    this.armsAction?.fadeOut(fade);
    this.legsAction = null;
    this.armsAction = null;
  }

  private playClip(name: string, fade = 0.18): void {
    if (name === this.currentClip || !this.mixer) return;
    const action = this.resolveClip(name);
    if (!action) return;
    this.stopLayers(fade);
    if (this.currentAction && this.currentAction !== action) this.currentAction.fadeOut(fade);
    // Clip playback rate is independent from configurable player speed.
    const timeScale = name === 'walk' ? 0.82 : name === 'swim' ? 0.90 : 1;
    action.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(fade).play();
    this.currentAction = action;
    this.currentClip = name;
  }

  private playSplit(legsName: string, armsName: string): void {
    const token = `split:${legsName}+${armsName}`;
    if (token === this.currentClip) return;
    const legs = this.resolveLayer(legsName, 'legs');
    const arms = this.resolveLayer(armsName, 'arms');
    if (!legs || !arms) {
      this.playClip(armsName, 0.1);
      return;
    }
    this.currentAction?.fadeOut(0.12);
    this.currentAction = null;
    if (this.legsAction !== legs) {
      this.legsAction?.fadeOut(0.1);
      legs.reset().setEffectiveWeight(1).fadeIn(0.12).play();
      this.legsAction = legs;
    }
    if (this.armsAction !== arms) {
      this.armsAction?.fadeOut(0.08);
      arms.reset().setEffectiveWeight(1).fadeIn(0.08).play();
      this.armsAction = arms;
    }
    this.currentClip = token;
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

  animate(dt: number, speed: number, airborne: boolean, attacking: boolean, flying = false, sprint = false, flightPhase: FlightPhase = 'ground', activeSkill?: SkillId, swimming = false, charging = false, turn = 0, climb = 0): void {
    this.elapsed += Math.min(dt, 0.05);
    if(this.lastAirborne&&!airborne&&!swimming)this.landUntil=this.elapsed+.26;
    this.lastAirborne=airborne;
    // Blend locomotion and keep cadence within a natural range.
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
      const skillGesture = activeSkill ? Character.castAnimationForSkill(activeSkill) : 'charge';
      const upper = charging ? 'charge' : gestureActive ? (this.animationMode === 'idle' ? skillGesture : this.animationMode) : null;
      const punching = upper === 'punch' || upper === 'punchcross';
      const casting = Boolean(upper && !punching);
      const base = swimming ? (moving ? 'swim' : 'swimidle')
        : flying ? (flightPhase === 'takeoff' ? 'flighttakeoff' : flightPhase === 'brake' ? 'flight_brake' : moving ? 'flightcruise' : 'flight')
        : airborne ? 'jump' : this.elapsed<this.landUntil ? 'jump_land' : locomotion;
      const technique = this.auraMode==='surge' ? 'power_charge' : `charge_${this.activeTechnique}`;
      if(charging&&flying)this.playSplit(base,technique);
      else if(charging)this.playClip(technique,.22);
      else if(punching&&moving&&!airborne&&!swimming)this.playSplit(base,upper!);
      else if(casting)this.playClip(upper==='beam'||upper==='disc'?`release_${this.activeTechnique}`:upper!,.12);
      else this.playClip(upper ?? base, .23);
      if(!upper&&!airborne&&!swimming&&moving)this.currentAction?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed/(sprint?7.5:2.25),.7,1.45));
      this.mixer.update(Math.min(dt, .05));
      const flightLean = !flying ? 0 : flightPhase==='takeoff' ? -.20 : flightPhase==='brake' ? .10 : moving ? -.98+THREE.MathUtils.clamp(climb*.025,-.15,.15) : -.06;
      const targetLean = swimming ? -.08 : flightLean;
      this.external.rotation.x = THREE.MathUtils.damp(this.external.rotation.x, targetLean, 5.0, dt);
      this.external.rotation.z = THREE.MathUtils.damp(this.external.rotation.z, flying?THREE.MathUtils.clamp(turn,-.35,.35):0,5,dt);
      const h = THREE.MathUtils.clamp(this.appearance.height, 0.78, 1.28);
      const bob = flying ? Math.sin(this.elapsed * 2.0) * 0.023 : swimming ? Math.sin(this.elapsed * 3.3) * 0.04 : 0;
      this.external.position.y = this.externalBaseY * h + bob;
      for (const glow of this.handGlows) {
        glow.visible = casting || charging;
        if (glow.visible) {
          const energy = 0.22 + (Math.sin(this.elapsed * 18) + 1) * 0.06;
          glow.scale.setScalar(energy);
        }
      }
      if (!gestureActive && this.animationMode !== 'idle') this.animationMode = 'idle';
    }
    const auraOn = this.auraMode !== 'off' || attacking;
    this.aura.visible = auraOn;
    if (auraOn) {
      const surge = this.auraMode === 'surge';
      const intensity = surge ? 0.85 + Math.sin(this.elapsed * 9) * 0.12 : Math.min(1, 0.45 + this.attackAge * 2.4);
      this.auraLight.intensity = intensity * (surge ? 7 : 4.5);
      if (this.auraCore) {
        const pulse = 1 + Math.sin(this.elapsed * 16) * 0.06;
        this.auraCore.scale.set(1.05 * pulse, 2.5 * pulse, 1);
        (this.auraCore.material as THREE.SpriteMaterial).opacity = 0.28 + intensity * 0.35;
      }
      for (const flame of this.auraFlames) {
        const rise = (this.elapsed * (surge ? 1.15 : 0.72) + flame.phase) % 1;
        const angle = flame.angle + this.elapsed * (surge ? 1.4 : 0.65);
        const radius = flame.radius * (0.75 + intensity * 0.35) * (1 - rise * 0.35);
        flame.sprite.position.set(Math.cos(angle) * radius, 0.15 + rise * (2.15 + flame.height), Math.sin(angle) * radius);
        const stretch = (0.42 + rise * 0.7) * (surge ? 1.25 : 1);
        flame.sprite.scale.set(0.28 + intensity * 0.22, stretch, 1);
        (flame.sprite.material as THREE.SpriteMaterial).opacity = (1 - rise) * (0.35 + intensity * 0.55);
      }
    } else this.auraLight.intensity = 0;
  }

  setAuraColor(color: number, core: number): void {
    this.auraLight.color.setHex(color);
    if (this.auraCore) (this.auraCore.material as THREE.SpriteMaterial).color.setHex(core);
    for (const glow of this.handGlows) (glow.material as THREE.SpriteMaterial).color.setHex(color);
    for (let i = 0; i < this.auraFlames.length; i++) {
      (this.auraFlames[i].sprite.material as THREE.SpriteMaterial).color.setHex(i % 4 === 0 ? core : color);
    }
  }

  getMuzzleWorldPosition(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    const left=this.external?.getObjectByName('hand_l'),right=this.external?.getObjectByName('hand_r');
    if(left&&right){const a=left.getWorldPosition(new THREE.Vector3()),b=right.getWorldPosition(new THREE.Vector3());return a.add(b).multiplyScalar(.5);}
    return this.root.localToWorld(new THREE.Vector3(0,1.38,-.72));
  }

  getHeadHeight():number {
    this.root.updateMatrixWorld(true);
    const head=this.external?.getObjectByName('Head');
    return head?THREE.MathUtils.clamp(head.getWorldPosition(new THREE.Vector3()).y-this.root.position.y,.15,2.7):1.8;
  }

  debugAnimation(){return {clip:this.currentClip,accessories:this.heroHair.children.length,model:this.loaded};}

  dispose(): void {
    this.destroyed = true;
    disposeAccessories(this.heroHair);
    this.mixer?.stopAllAction();
    if(this.external)this.mixer?.uncacheRoot(this.external);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        if (obj instanceof THREE.Mesh && (!this.external || !this.external.getObjectById(obj.id))) geometries.add(obj.geometry);
        const entries = Array.isArray(obj.material) ? obj.material : [obj.material];
        entries.forEach((material) => materials.add(material));
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
