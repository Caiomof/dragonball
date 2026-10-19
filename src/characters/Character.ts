import { buildAccessories, disposeAccessories } from './Appearance';
import { attachOutfit } from './outfitLoader';
import { OUTFIT_OPTIONS } from '../data/appearanceCatalog';
import { prepareGltfScene } from '../rendering/gltfMaterials';
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
  flightboost: ['flight_boost', 'flight_cruise'],
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
function fpViewMaterial(source: THREE.Material): THREE.Material {
  const copy = source.clone();
  copy.clippingPlanes = null;
  copy.clipShadows = false;
  const surface = copy as THREE.MeshStandardMaterial;
  surface.depthTest = false;
  surface.depthWrite = false;
  surface.side = THREE.DoubleSide;
  return copy;
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
  readonly fpAnchor = new THREE.Group();
  private readonly visualStatusListeners: ((ok: boolean) => void)[] = [];
  private loaded = false;
  private animationMode: GestureKind | 'idle' = 'idle';
  private hitPoseUntil = 0;
  private readonly auraFlames: { sprite: THREE.Sprite; angle: number; phase: number; radius: number; height: number }[] = [];
  private auraCore: THREE.Sprite | null = null;
  private legsAction: THREE.AnimationAction | null = null;
  private armsAction: THREE.AnimationAction | null = null;
  private readonly auraLight = new THREE.PointLight(0x6bcaff, 0, 6);
  private static heroCache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] } | null>>();
  private firstPerson = false;
  private texturedHero = false;
  private readonly handGlows: THREE.Sprite[] = [];
  private skinnedMesh: THREE.SkinnedMesh | null = null;
  readonly fpViewRig = new THREE.Group();
  private fpModel: THREE.Object3D | null = null;
  private fpSkinned: THREE.SkinnedMesh | null = null;
  private fpCamera: THREE.Object3D | null = null;
  private fpScene: THREE.Object3D | null = null;
  private readonly fpHandsTarget = new THREE.Vector3(0, -0.26, -0.58);
  private readonly fpHandL = new THREE.Vector3();
  private readonly fpHandR = new THREE.Vector3();
  private readonly fpHandMid = new THREE.Vector3();
  private readonly flightFlames: { sprite: THREE.Sprite; phase: number; lane: number; port: 'left' | 'right' }[] = [];
  private readonly flightVfx = new THREE.Group();
  private readonly flightPortL = new THREE.Group();
  private readonly flightPortR = new THREE.Group();
  private flightCore: THREE.Sprite | null = null;
  private readonly flightLight = new THREE.PointLight(0x8fdcff, 0, 7);
  private footLeft: THREE.Object3D | null = null;
  private footRight: THREE.Object3D | null = null;
  private readonly flightAxis = new THREE.Vector3();
  private readonly flightParentQ = new THREE.Quaternion();
  private readonly trailL = new THREE.Vector3();
  private readonly trailR = new THREE.Vector3();
  private readonly flameAt = new THREE.Vector3();
  private flightLeg = 0;
  private takeoffAge = 0;
  private flightBoost = 0;
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
    this.flightVfx.visible = false;
    this.flightPortL.visible = false;
    this.flightPortR.visible = false;
    this.flightCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff6d2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.flightCore.center.set(0.5, 0.5);
    this.flightVfx.add(this.flightCore);
    this.flightLight.position.set(0, 0.15, 0.12);
    this.flightVfx.add(this.flightLight);
    for (let i = 0; i < 20; i++) {
      const mat = new THREE.SpriteMaterial({ map: glow, color: 0xb7ecff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const sprite = new THREE.Sprite(mat);
      sprite.center.set(0.5, 0.12 + (i % 3) * 0.04);
      const port = i % 2 === 0 ? this.flightPortL : this.flightPortR;
      port.add(sprite);
      this.flightFlames.push({ sprite, phase: i / 20, lane: i % 5, port: i % 2 === 0 ? 'left' : 'right' });
    }
    this.fpAnchor.frustumCulled = false;
    this.fpAnchor.visible = false;
    this.fpAnchor.add(this.fpViewRig);
    this.fpViewRig.frustumCulled = false;
    this.ready = this.tryLoadModel();
  }

  static castAnimationForSkill(skill: SkillId): GestureKind {
    if (skill === 'kienzan') return 'disc';
    if (skill === 'galick' || skill === 'masenko') return 'beam';
    return 'charge';
  }

  private async tryLoadModel(): Promise<boolean> {
    const cacheKey = 'superhero_male';
    if (!Character.heroCache.has(cacheKey)) {
      const loader = new GLTFLoader();
      const heroUri = '/models/hero/Superhero_Male_FullBody.gltf';
      Character.heroCache.set(
        cacheKey,
        Promise.all([loader.loadAsync(heroUri), loader.loadAsync('/models/anims/ual1.glb')])
          .then(([hero, motion]) => ({
            scene: hero.scene,
            animations: [...(motion?.animations ?? []), ...hero.animations, ...createHeroClips(hero.scene, motion?.animations ?? hero.animations)],
          }))
          .catch(() => null)
      );
    }
    const source = await Character.heroCache.get(cacheKey)!;
    if (!source || this.destroyed || source.animations.length === 0) {
      this.figure.visible = true;
      for (const callback of this.visualStatusListeners) callback(false);
      return false;
    }
    const model = cloneSkeleton(source.scene) as THREE.Group;
    prepareGltfScene(model);
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
      outfit.anisotropy = 8;
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
    this.texturedHero = Boolean(this.headBone);
    this.figure.visible = false;
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
    model.traverse(object => {
      if (object instanceof THREE.SkinnedMesh && !this.skinnedMesh) this.skinnedMesh = object;
    });
    this.root.add(model);
    this.mountFlightVfx();
    this.syncBodyVisibility();
    this.playClip('idle', 0.01);
    this.mixer.update(0.035);
    this.applyAppearance();
    this.loaded = true;
    for (const callback of this.visualStatusListeners) callback(true);
    if (this.fpCamera) this.rebuildFirstPersonView();
    return true;
  }

  private mountFlightVfx(): void {
    this.footLeft = this.external?.getObjectByName('foot_l') ?? null;
    this.footRight = this.external?.getObjectByName('foot_r') ?? null;
    const pelvis = this.external?.getObjectByName('pelvis');
    this.flightPortL.position.set(0, 0.03, 0.05);
    this.flightPortR.position.set(0, 0.03, 0.05);
    if (this.footLeft) this.footLeft.add(this.flightPortL);
    else this.leftLeg.add(this.flightPortL);
    if (this.footRight) this.footRight.add(this.flightPortR);
    else this.rightLeg.add(this.flightPortR);
    if (pelvis) {
      pelvis.add(this.flightVfx);
      this.flightVfx.position.set(0, 0.08, 0.04);
    } else this.external?.add(this.flightVfx);
  }

  private footBack(foot: THREE.Object3D, out: THREE.Vector3): void {
    out.set(0, -0.42, 1).applyQuaternion(this.root.quaternion).normalize();
    foot.getWorldQuaternion(this.flightParentQ).invert();
    out.applyQuaternion(this.flightParentQ);
  }

  private applyFlightLife(boost: number, _speed: number, dt: number): void {
    if (!this.external) return;
    if (boost > 0.06) this.flightLeg = THREE.MathUtils.damp(this.flightLeg, 0, 10, dt);
    const ease = 1 - boost * 0.9;
    const inhale = Math.sin(this.elapsed * 1.05) * 0.0026 * ease;
    const chest = this.external.getObjectByName('spine_02');
    if (chest instanceof THREE.Bone && boost < 0.5) chest.rotateX(inhale);
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
        let ancestor: THREE.Object3D | null = object;
        while (ancestor) {
          if (ancestor.name === 'AppearanceAccessories' || ancestor.name.startsWith('Outfit_')) return;
          ancestor = ancestor.parent;
        }
        const materials=Array.isArray(object.material)?object.material:[object.material];
        const skinTint = new THREE.Color(palettes[this.race.id].skin);
        for(const m of materials){
          if(!('color' in m) || !(m.color instanceof THREE.Color))continue;
          const label = m.name.toUpperCase();
          if (this.texturedHero) {
            if (object.name === 'Eyebrows' || label.includes('HAIR')) m.color.set(a.hairColor);
            else if (object.name === 'Eyes' || object.name === 'MI_Eyes' || label.includes('EYE')) {
              if (m instanceof THREE.MeshStandardMaterial) {
                m.color.set(a.eyeColor);
                m.emissive.set(a.pupilColor ?? '#1a2838');
                m.emissiveIntensity = 0.24;
                m.metalness = 0;
                m.roughness = 0.42;
                m.needsUpdate = true;
              }
            } else if (object.name === 'Face') object.visible = false;
            else if (label.includes('SUPERHERO')) m.color.set('#ffffff');
            if (object.name === 'Eyebrows') object.visible = true;
            continue;
          }
          if(label==='HAIR' || label.includes('HAIR'))m.color.set(a.hairColor);
          if(label==='EYE_IRIS' || label.includes('EYE'))m.color.set(a.eyeColor);
          if(label.includes('SUPERHERO') || label==='SKIN')m.color.copy(skinTint);
        }
        const humanHair = this.race.id === 'saiyajin' || this.race.id === 'terraqueo';
        if (humanHair && (object.name.startsWith('HAIR_') || object.name === 'Eyebrows')) object.visible = false;
        else if (object.name.startsWith('HAIR_SPIKE')) object.visible = this.race.id !== 'namekuseijin' && this.race.id !== 'majin' && a.hair !== 1;
        else if (object.name === 'HAIR_SCALP' || object.name === 'HAIR_BANG') object.visible = this.race.id !== 'namekuseijin' && this.race.id !== 'majin';
      });
    }
    this.figure.scale.set(w * h, h, w * h);
    this.face.scale.setScalar(THREE.MathUtils.clamp(a.hair === 2 ? 1.035 : 1,1,1.05));
    if (this.headBone && this.texturedHero) this.syncHeroHair();
    else if (this.headBone) this.applyFaceDetails(1 / ((this.external?.userData.baseScale as number) ?? 1));
    this.syncOutfit();
  }

  private syncOutfit(): void {
    if (!this.external) return;
    const gen = ++this.outfitSyncGen;
    const choice = this.appearance.outfit ?? 0;
    const pants = this.external.getObjectByName('Pants');
    if (pants) pants.visible = choice === 0;
    if (this.outfitRoot) {
      this.outfitRoot.removeFromParent();
      this.outfitRoot = null;
    }
    const option = OUTFIT_OPTIONS.find(o => o.id === choice) ?? OUTFIT_OPTIONS[0];
    if (!option.outfit) return;
    void attachOutfit(this.external, option.outfit).then(group => {
      if (gen !== this.outfitSyncGen || this.destroyed) {
        group.removeFromParent();
        return;
      }
      this.outfitRoot = group;
    });
  }

  private hairSyncGen = 0;
  private outfitSyncGen = 0;
  private outfitRoot: THREE.Group | null = null;

  private syncHeroHair(): void {
    if (!this.headBone || !this.external) return;
    const gen = ++this.hairSyncGen;
    void buildAccessories(this.external, this.headBone, this.appearance, this.race.id).then(group => {
      if (gen !== this.hairSyncGen || this.destroyed) {
        disposeAccessories(group);
        return;
      }
      if (this.heroHair && this.heroHair !== group) disposeAccessories(this.heroHair);
      this.heroHair = group;
      this.heroHair.visible = !this.firstPerson;
    });
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

  mountFirstPersonView(scene: THREE.Object3D, camera: THREE.Object3D): void {
    this.fpCamera = camera;
    if (this.fpScene !== scene) {
      this.fpScene?.remove(this.fpAnchor);
      this.fpScene = scene;
      scene.add(this.fpAnchor);
    }
    this.rebuildFirstPersonView();
  }

  private rebuildFirstPersonView(): void {
    this.disposeFirstPersonView();
    this.external?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.clippingPlanes = null;
    });
    if (!this.external || !this.skinnedMesh || !this.fpCamera || !this.texturedHero) return;
    const clone = cloneSkeleton(this.external);
    clone.traverse(object => {
      if (object instanceof THREE.Sprite) object.visible = false;
      if (!(object instanceof THREE.Mesh)) return;
      object.frustumCulled = false;
      if (/^(Face|Eyebrows|Eyes)$/i.test(object.name)) {
        object.visible = false;
        return;
      }
      const sourceMats = Array.isArray(object.material) ? object.material : [object.material];
      const clonedMats = sourceMats.map(material => fpViewMaterial(material));
      object.material = Array.isArray(object.material) ? clonedMats : clonedMats[0];
      object.visible = object instanceof THREE.SkinnedMesh;
      if (object instanceof THREE.SkinnedMesh) {
        // First-person view uses only the upper limbs of the SAME skinned model.
        // Never place the entire torso/head in front of the camera.
        const armGeometry = Character.firstPersonArmGeometry(object);
        if (!armGeometry) { object.visible = false; return; }
        object.geometry = armGeometry;
        this.fpSkinned = object;
      }
    });
    this.fpModel = clone;
    this.fpViewRig.position.set(0, 0, 0);
    this.fpViewRig.rotation.set(0, 0, 0);
    this.fpViewRig.scale.setScalar(1);
    this.fpViewRig.frustumCulled = false;
    this.fpViewRig.add(clone);
    this.fpViewRig.visible = false;
    this.fpViewRig.renderOrder = 10;
    if (this.fpSkinned) {
      this.fpSkinned.renderOrder = 10;
      this.fpSkinned.visible = true;
    }
    this.calibrateFirstPersonRig();
  }

  /** Filter triangles by weighted limb bone influence while keeping skeleton, UVs and outfit texture. */
  private static firstPersonArmGeometry(mesh: THREE.SkinnedMesh): THREE.BufferGeometry | null {
    const geo = mesh.geometry;
    const joints = geo.getAttribute('skinIndex');
    const weights = geo.getAttribute('skinWeight');
    const positions = geo.getAttribute('position');
    if (!joints || !weights || !positions) return null;
    const allowed = new Set<number>();
    mesh.skeleton.bones.forEach((bone, index) => {
      if (/(upperarm|lowerarm|forearm|hand|thumb|index|middle|ring|pinky|wrist|clavicle)/i.test(bone.name)) allowed.add(index);
    });
    if (allowed.size < 4) return null;
    const armScore = (i: number): number => {
      let sum = 0;
      for (let k = 0; k < 4; k++) if (allowed.has(joints.getComponent(i,k))) sum += weights.getComponent(i,k);
      return sum;
    };
    const source = geo.index?.array;
    const count = source ? source.length : positions.count;
    const filtered: number[] = [];
    for (let i = 0; i + 2 < count; i += 3) {
      const a = source ? Number(source[i]) : i;
      const b = source ? Number(source[i+1]) : i+1;
      const c = source ? Number(source[i+2]) : i+2;
      // Three full limb vertices: prevents any polygon from torso or face appearing.
      if (Math.min(armScore(a),armScore(b),armScore(c)) >= 0.42) filtered.push(a,b,c);
    }
    if (filtered.length < 30) return null;
    const clone = geo.clone();
    clone.setIndex(filtered);
    clone.clearGroups();
    clone.addGroup(0,filtered.length,0);
    clone.computeBoundingSphere();
    return clone;
  }

  private measureHandsInCameraSpace(handL: THREE.Bone, handR: THREE.Bone): THREE.Vector3 {
    this.fpModel?.updateMatrixWorld(true);
    handL.getWorldPosition(this.fpHandL);
    handR.getWorldPosition(this.fpHandR);
    this.fpHandMid.copy(this.fpHandL).add(this.fpHandR).multiplyScalar(0.5);
    this.fpCamera?.updateMatrixWorld(true);
    if (this.fpCamera) this.fpCamera.worldToLocal(this.fpHandMid);
    return this.fpHandMid;
  }

  private alignFirstPersonHands(handL: THREE.Bone, handR: THREE.Bone): void {
    const local = this.measureHandsInCameraSpace(handL, handR);
    this.fpViewRig.position.x += this.fpHandsTarget.x - local.x;
    this.fpViewRig.position.y += this.fpHandsTarget.y - local.y;
    this.fpViewRig.position.z += this.fpHandsTarget.z - local.z;
  }

  private updateFirstPersonAnchor(): void {
    if (!this.fpCamera) return;
    this.fpCamera.updateMatrixWorld(true);
    this.fpAnchor.position.copy(this.fpCamera.position);
    this.fpAnchor.quaternion.copy(this.fpCamera.quaternion);
    this.fpAnchor.updateMatrixWorld(true);
  }

  private calibrateFirstPersonRig(): void {
    if (!this.fpCamera || !this.fpSkinned) return;
    this.updateFirstPersonAnchor();
    this.copyFirstPersonSkeletonFromHero();
    const handL = this.fpSkinned.skeleton.bones.find(bone => bone.name === 'hand_l');
    const handR = this.fpSkinned.skeleton.bones.find(bone => bone.name === 'hand_r');
    if (!handL || !handR) return;
    this.fpViewRig.position.set(0, 0, 0);
    this.fpViewRig.rotation.set(0, 0, 0);
    let local = this.measureHandsInCameraSpace(handL, handR);
    if (local.z > -0.08) this.fpViewRig.rotation.y = Math.PI;
    this.alignFirstPersonHands(handL, handR);
    this.fpViewRig.rotation.x = -0.14;
    this.alignFirstPersonHands(handL, handR);
  }

  private disposeFirstPersonView(): void {
    if (this.fpModel) {
      this.fpModel.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.clippingPlanes = null;
      });
      if (this.fpSkinned) this.fpSkinned.geometry.dispose();
      this.fpViewRig.clear();
      this.fpModel = null;
      this.fpSkinned = null;
    }
  }

  private copyFirstPersonSkeletonFromHero(): void {
    if (!this.skinnedMesh || !this.fpSkinned) return;
    const source = this.skinnedMesh.skeleton.bones;
    const target = this.fpSkinned.skeleton.bones;
    for (let i = 0; i < source.length; i++) {
      target[i].position.copy(source[i].position);
      target[i].quaternion.copy(source[i].quaternion);
      target[i].scale.copy(source[i].scale);
    }
    this.fpSkinned.skeleton.update();
  }

  private syncFirstPersonSkeleton(): void {
    if (!this.firstPerson) return;
    this.updateFirstPersonAnchor();
    this.copyFirstPersonSkeletonFromHero();
  }

  hasFirstPersonView(): boolean {
    return Boolean(this.fpSkinned);
  }

  setFirstPerson(enabled: boolean): void {
    const active = enabled && Boolean(this.fpSkinned);
    const changed = this.firstPerson !== active;
    this.firstPerson = active;
    this.fpViewRig.visible = active;
    this.fpAnchor.visible = active;
    if (!changed) return;
    if (active) this.calibrateFirstPersonRig();
    this.syncBodyVisibility();
    this.heroHair.visible = !active;
    this.external?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const hideHead = active && /^(Face|Eyebrows|Eyes)/.test(object.name);
      object.visible = !hideHead;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.clippingPlanes = null;
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
    this.figure.position.y = flying ? Math.sin(this.elapsed * 1.15) * 0.008 : 0;
    this.figure.rotation.x = 0;
    if (this.mixer && this.external) {
      const skillGesture = activeSkill ? Character.castAnimationForSkill(activeSkill) : 'charge';
      const upper = charging ? 'charge' : gestureActive ? (this.animationMode === 'idle' ? skillGesture : this.animationMode) : null;
      const punching = upper === 'punch' || upper === 'punchcross';
      const casting = Boolean(upper && !punching);
      const base = swimming ? (moving ? 'swim' : 'swimidle')
        : flying ? (flightPhase === 'takeoff' ? 'flighttakeoff' : flightPhase === 'brake' ? 'flight_brake' : moving ? (sprint ? 'flightboost' : 'flightcruise') : 'flight')
        : airborne ? 'jump' : this.elapsed<this.landUntil ? 'jump_land' : locomotion;
      const technique = this.auraMode==='surge' ? 'power_charge' : `charge_${this.activeTechnique}`;
      if(charging&&flying)this.playSplit(base,technique);
      else if(charging)this.playClip(technique,.22);
      else if(punching&&moving&&!airborne&&!swimming)this.playSplit(base,upper!);
      else if(casting)this.playClip(upper==='beam'||upper==='disc'?`release_${this.activeTechnique}`:upper!,.12);
      else this.playClip(upper ?? base, flying ? 0.55 : .23);
      if (flying && flightPhase === 'takeoff') this.currentAction?.setEffectiveTimeScale(0.8);
      else if (flying && flightPhase === 'cruise') this.currentAction?.setEffectiveTimeScale(sprint ? 1.22 : 1.06);
      else if (flying) this.currentAction?.setEffectiveTimeScale(1.04);
      else if (swimming && moving) this.currentAction?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 4.2, 0.95, 1.35));
      else if(!upper&&!airborne&&!swimming&&moving)this.currentAction?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed/(sprint?7.5:2.25),.7,1.45));
      this.mixer.update(Math.min(dt, .05));
      const targetBoost = flying && sprint && moving ? 1 : 0;
      this.flightBoost = THREE.MathUtils.damp(this.flightBoost, targetBoost, sprint ? 3.2 : 2.6, dt);
      if (flying) this.applyFlightLife(this.flightBoost, speed, dt);
      else this.flightLeg = 0;
      const missile = this.flightBoost;
      const flightLean = !flying ? 0 : flightPhase==='takeoff' ? -0.24 : flightPhase==='brake' ? -0.1 : moving ? -0.28 - missile * 0.14 + THREE.MathUtils.clamp(climb * 0.006, -0.06, 0.06) : -0.12;
      const sprintLean = !flying && sprint && moving && !swimming ? -0.2 : 0;
      const targetLean = swimming ? -.08 : flying ? flightLean : sprintLean;
      this.external.rotation.x = THREE.MathUtils.damp(this.external.rotation.x, targetLean, missile > 0.25 ? 7 : 2.4, dt);
      this.external.rotation.z = THREE.MathUtils.damp(this.external.rotation.z, flying?THREE.MathUtils.clamp(turn,-.12,.12):0,3.5,dt);
      const h = THREE.MathUtils.clamp(this.appearance.height, 0.78, 1.28);
      const bob = flying ? (Math.sin(this.elapsed * 1.9) * 0.018 + Math.sin(this.elapsed * 0.7) * 0.014) * (1 - missile * 0.72) : swimming ? Math.sin(this.elapsed * 3.3) * 0.04 : 0;
      this.external.position.y = this.externalBaseY * h + bob;
      for (const glow of this.handGlows) {
        glow.visible = casting || charging;
        if (glow.visible) {
          const energy = 0.22 + (Math.sin(this.elapsed * 18) + 1) * 0.06;
          glow.scale.setScalar(energy);
        }
      }
      if (!gestureActive && this.animationMode !== 'idle') this.animationMode = 'idle';
      this.syncFirstPersonSkeleton();
    }
    if (flying && flightPhase === 'takeoff') this.takeoffAge += dt;
    else this.takeoffAge = 0;
    const accent = Number.parseInt(this.race.accent.replace('#', ''), 16);
    const coreColor = accent ^ 0x303030;
    const boost = this.flightBoost;
    const cruise = flying ? 0.22 + boost * 0.55 : 0;
    const showFlightFx = flying && !this.firstPerson;
    this.flightVfx.visible = showFlightFx;
    this.flightPortL.visible = showFlightFx;
    this.flightPortR.visible = showFlightFx;
    if (showFlightFx) {
      const lift = flightPhase === 'takeoff' ? 1 - Math.min(1, this.takeoffAge / 0.7) : 0;
      this.flightLight.intensity = (1.2 + boost * 5.5) * (0.7 + lift * 0.5);
      this.flightLight.color.setHex(accent);
      if (this.flightCore) {
        const pulse = 1 + Math.sin(this.elapsed * (8 + boost * 4)) * 0.04;
        const wide = THREE.MathUtils.lerp(0.42, 0.7, boost) * pulse;
        const tall = THREE.MathUtils.lerp(0.75, 0.42, boost) * pulse;
        this.flightCore.scale.set(wide, tall, 1);
        this.flightCore.position.set(0, -boost * 0.04, -boost * 0.16);
        const coreMat = this.flightCore.material as THREE.SpriteMaterial;
        coreMat.color.setHex(coreColor);
        coreMat.opacity = cruise + lift * 0.35;
      }
      const footL = this.footLeft ?? this.flightPortL;
      const footR = this.footRight ?? this.flightPortR;
      if (boost > 0.02) {
        this.footBack(footL, this.trailL);
        this.footBack(footR, this.trailR);
      }
      for (const flame of this.flightFlames) {
        const flow = 0.55 + boost * 0.85;
        const rise = (this.elapsed * flow + flame.phase) % 1;
        const spread = (flame.lane - 2) * 0.03;
        this.flameAt.set(spread, rise * 0.08, 0.02 + rise * 0.35);
        if (boost > 0.02) {
          const trail = flame.port === 'left' ? this.trailL : this.trailR;
          const along = 0.05 + rise * 1.45;
          const wobble = Math.sin(this.elapsed * 2.4 + flame.phase * 8) * 0.035 * rise;
          this.flightAxis.copy(trail).multiplyScalar(along);
          this.flightAxis.x += wobble;
          this.flameAt.lerp(this.flightAxis, boost);
        }
        flame.sprite.position.copy(this.flameAt);
        flame.sprite.center.set(0.5, THREE.MathUtils.lerp(0.14, 0.5, boost));
        const soft = 0.16 + rise * 0.2;
        const stretch = (0.32 + rise * 0.45) * (1 + lift * 0.2);
        const wide = THREE.MathUtils.lerp(0.11 + rise * 0.08, soft, boost);
        const tall = THREE.MathUtils.lerp(stretch, soft * 1.15, boost);
        flame.sprite.scale.set(wide, tall, 1);
        const material = flame.sprite.material as THREE.SpriteMaterial;
        material.color.setHex(flame.lane % 2 === 0 ? coreColor : accent);
        material.opacity = Math.pow(1 - rise, 1.15) * (cruise + lift * 0.4) * (0.9 + boost * 0.25);
      }
    } else this.flightLight.intensity = 0;
    const punchingNow = this.animationMode === 'punch' || this.animationMode === 'punchcross';
    const auraOn = this.auraMode !== 'off' || (attacking && !punchingNow);
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
    this.disposeFirstPersonView();
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
