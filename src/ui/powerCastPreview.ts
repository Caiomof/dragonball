import * as THREE from 'three';
import { CombatEffects, type AttackStyle } from '../combat/Combat';
import { Character } from '../characters/Character';
import { getRace } from '../data/gameConfig';
import {
  gestureForType,
  hexToNumber,
  powerStats,
  SIZE_LABELS,
  type CustomPower,
} from '../data/powers';
import type { SkillId } from '../data/skills';

type Phase = 'idle' | 'windup' | 'active' | 'recover';

const PREVIEW_SPEED = 0.62;
const TARGET_Z = -8.2;
const HERO_Z = 0;

function skillForStyle(style: AttackStyle): SkillId {
  if (style === 'galick') return 'galick';
  if (style === 'masenko') return 'masenko';
  if (style === 'kienzan') return 'kienzan';
  return 'kamehameha';
}

function draftPower(draft: Partial<CustomPower>): CustomPower {
  return {
    id: 'preview',
    name: draft.name ?? 'Preview',
    symbol: draft.symbol ?? '✦',
    type: draft.type ?? 'ball',
    color: draft.color ?? '#5ec8ff',
    core: draft.core ?? '#dff6ff',
    size: draft.size ?? 2,
  };
}

function addPreviewTarget(scene: THREE.Scene): { group: THREE.Group; hit: THREE.Vector3 } {
  const group = new THREE.Group();
  group.position.set(0, 0, TARGET_Z);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d6040, flatShading: true, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe6be73, metalness: 0.2, roughness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb95d4e, roughness: 0.85 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x747f77, roughness: 0.95 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], rotX = 0): void => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.x = rotX;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(new THREE.CylinderGeometry(0.83, 1.05, 0.5, 8), stone, [0, 0.24, 0]);
  add(new THREE.CylinderGeometry(0.22, 0.27, 2.25, 9), wood, [0, 1.42, 0]);
  add(new THREE.SphereGeometry(0.66, 12, 10), red, [0, 2.0, 0]);
  add(new THREE.TorusGeometry(0.47, 0.07, 8, 24), gold, [0, 2.0, -0.52]);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.04, 6, 44),
    new THREE.MeshBasicMaterial({ color: 0xffdb8e, transparent: true, opacity: 0.32 }),
  );
  ring.scale.y = 0.28;
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);
  scene.add(group);
  const hit = new THREE.Vector3(0, 2.0, TARGET_Z);
  return { group, hit };
}

let instance: PowerCastPreview | null = null;

class PowerCastPreview {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private combat: CombatEffects | null = null;
  private character: Character | null = null;
  private target: THREE.Group | null = null;
  private targetHit = new THREE.Vector3(0, 2, TARGET_Z);
  private resizeObs: ResizeObserver | null = null;
  private raf = 0;
  private clock = new THREE.Clock();
  private draft: Partial<CustomPower> = { type: 'ball', color: '#5ec8ff', core: '#dff6ff', size: 2 };
  private phase: Phase = 'idle';
  private phaseTime = 0.8;
  private castStarted = false;
  private burstShots = 0;
  private burstNext = 0;
  private heroBase = new THREE.Vector3(0, 0, HERO_Z);
  private teleportFrom = 0;
  private flightLift = 0;
  private draftSignature = '';

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b4d62);
    this.scene.fog = new THREE.Fog(0x1b4d62, 24, 52);

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 60);
    this.camera.position.set(3.1, 2.65, 4.2);
    this.camera.lookAt(0, 1.45, -4.5);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.48;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const hemi = new THREE.HemisphereLight(0xd8f4ff, 0x2a5060, 1.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff6e8, 1.9);
    sun.position.set(-4, 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xa8e8ff, 0.75);
    fill.position.set(5, 4, 8);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0x8fe8ff, 1.1, 22);
    rim.position.set(-2, 3.5, 2);
    this.scene.add(rim);
    const key = new THREE.PointLight(0xffe9c8, 0.55, 16);
    key.position.set(2.5, 2.2, 3);
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({ color: 0x2a7088, roughness: 0.88, metalness: 0.08 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const pad = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.55, 32),
      new THREE.MeshBasicMaterial({ color: 0x5ec8ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.02, HERO_Z - 0.2);
    this.scene.add(pad);

    this.combat = new CombatEffects(this.scene);
    this.character = new Character(getRace('terraqueo'));
    this.character.root.position.copy(this.heroBase);
    this.character.root.rotation.y = 0;
    this.scene.add(this.character.root);
    const t = addPreviewTarget(this.scene);
    this.target = t.group;
    this.targetHit.copy(t.hit);

    const parent = canvas.parentElement ?? canvas;
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(parent);
    this.resize();

    this.phase = 'windup';
    this.phaseTime = 0;
    this.castStarted = false;
    this.draftSignature = this.signature(this.draft);
    this.clock.start();
    this.applyDraftColors();
    this.raf = requestAnimationFrame(this.tick);
  }

  update(next: Partial<CustomPower>): void {
    const prevSig = this.draftSignature;
    this.draft = { ...this.draft, ...next };
    this.draftSignature = this.signature(this.draft);
    this.applyDraftColors();
    if (!this.combat || !this.character) return;
    if (this.draftSignature !== prevSig || prevSig === '') this.restartCycle();
  }

  private signature(d: Partial<CustomPower>): string {
    const p = draftPower(d);
    return `${p.type}|${p.size}|${p.color}|${p.core}`;
  }

  private restartCycle(): void {
    if (!this.character || !this.combat) return;
    this.combat.clearAll();
    this.resetHero();
    this.burstShots = 0;
    this.burstNext = 0;
    this.beginCast();
    this.phase = 'active';
    this.phaseTime = 0;
    this.castStarted = true;
  }

  private applyDraftColors(): void {
    const p = draftPower(this.draft);
    this.character?.setAuraColor(hexToNumber(p.color), hexToNumber(p.core));
  }

  private resize(): void {
    if (!this.renderer || !this.camera || !this.canvas) return;
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(dpr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private resetHero(): void {
    if (!this.character) return;
    this.character.root.position.copy(this.heroBase);
    this.character.root.position.y = 0;
    this.teleportFrom = 0;
    this.flightLift = 0;
    this.character.setAuraActive(false);
  }

  private windupSeconds(power: CustomPower): number {
    const stats = powerStats(power);
    if (power.type === 'teleport') return 0.22;
    if (power.type === 'flight') return 0.35;
    if (power.type === 'melee_wave') return 0.14;
    return Math.max(0.18, stats.charge * PREVIEW_SPEED * 0.85);
  }

  private effectSeconds(power: CustomPower): number {
    const stats = powerStats(power);
    if (power.type === 'flight') return 2.1;
    if (power.type === 'teleport') return 0.45;
    return Math.max(0.35, stats.duration * PREVIEW_SPEED);
  }

  private castSize(power: CustomPower): number {
    const t = power.size / (SIZE_LABELS.length - 1);
    return 0.62 + t * 0.55;
  }

  private beginCast(): void {
    const power = draftPower(this.draft);
    const stats = powerStats(power);
    const color = hexToNumber(power.color);
    const core = hexToNumber(power.core);
    const skill = skillForStyle(stats.style);
    this.character?.setTechnique(skill);
    this.castStarted = true;
    this.burstShots = 0;

    if (power.type === 'flight') {
      this.character?.gesture('charge');
      this.character?.setAuraActive(true, 'surge');
      return;
    }
    if (power.type === 'teleport') {
      this.teleportFrom = this.character?.root.position.z ?? HERO_Z;
      this.character?.gesture('kiopen');
      this.character?.setAuraActive(true, 'charge');
      const dest = this.character!.root.position.clone();
      dest.z = this.teleportFrom - Math.min(5.5, stats.range * 0.22);
      this.combat?.cast(
        this.character!.getMuzzleWorldPosition(),
        dest,
        { style: 'orb', color, core, chargeSeconds: 0.08, effectSeconds: 0.28, size: this.castSize(power) * 0.7, blastRadius: stats.blastRadius },
        () => {},
      );
      return;
    }

    const g = gestureForType(power.type);
    this.character?.gesture(g === 'charge' ? 'charge' : g);
    this.character?.setAuraActive(true, 'charge');

    if (power.type === 'burst') {
      this.burstShots = 0;
      this.burstNext = 0;
      this.fireBurstShot(power, stats, color, core);
      return;
    }

    const style = power.type === 'melee_wave' ? 'orb' : stats.style;
    const range = power.type === 'melee_wave' ? stats.range * 0.35 : stats.range * 0.16;
    const origin = this.character!.getMuzzleWorldPosition();
    const dest = origin.clone().add(new THREE.Vector3(0, 0, -range));
    if (power.type !== 'melee_wave') dest.copy(this.targetHit);
    const charge = power.type === 'melee_wave' ? 0.1 : stats.charge * PREVIEW_SPEED;
    const duration = power.type === 'melee_wave' ? 0.32 : stats.duration * PREVIEW_SPEED;
    this.combat!.cast(
      origin,
      dest,
      { style, color, core, chargeSeconds: charge, effectSeconds: duration, size: this.castSize(power), blastRadius: stats.blastRadius },
      () => {},
    );
  }

  private fireBurstShot(power: CustomPower, stats: ReturnType<typeof powerStats>, color: number, core: number): void {
    if (!this.character || this.burstShots >= 4) return;
    const spread = (this.burstShots - 1.5) * 0.35;
    const origin = this.character.getMuzzleWorldPosition();
    const dest = this.targetHit.clone();
    dest.x += spread;
    dest.y += 0.15 * this.burstShots;
    this.combat!.cast(
      origin,
      dest,
      { style: stats.style, color, core, chargeSeconds: 0.06, effectSeconds: 0.22, size: this.castSize(power) * 0.82, blastRadius: stats.blastRadius * 0.65 },
      () => {},
    );
    this.burstShots += 1;
    this.burstNext = 0.1;
  }

  private tick = (): void => {
    if (!this.scene || !this.camera || !this.renderer || !this.character || !this.combat) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const power = draftPower(this.draft);
    const stats = powerStats(power);
    const skill = skillForStyle(stats.style);
    const flying = power.type === 'flight' && (this.phase === 'active' || this.phase === 'windup');
    const charging = this.phase === 'windup' || (this.phase === 'active' && this.combat.activeCount > 0);
    this.character.animate(dt, 0, false, charging || this.phase === 'active', flying, false, flying ? 'hover' : 'ground', skill, false, this.phase === 'windup');
    this.combat.update(dt);

    if (power.type === 'teleport' && this.phase === 'active' && this.castStarted) {
      const t = Math.min(1, this.phaseTime / 0.28);
      this.character.root.position.z = THREE.MathUtils.lerp(this.teleportFrom, this.teleportFrom - Math.min(5.5, stats.range * 0.22), t);
    }
    if (power.type === 'flight' && this.phase === 'active') {
      this.flightLift = Math.min(2.2, this.flightLift + dt * 1.35);
      this.character.root.position.y = this.flightLift;
    }

    if (this.phase === 'idle') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        this.phase = 'windup';
        this.phaseTime = 0;
        this.castStarted = false;
        this.resetHero();
      }
    } else if (this.phase === 'windup') {
      this.phaseTime += dt;
      if (!this.castStarted && this.phaseTime >= this.windupSeconds(power)) {
        this.beginCast();
        this.phase = 'active';
        this.phaseTime = 0;
      }
    } else if (this.phase === 'active') {
      this.phaseTime += dt;
      if (power.type === 'burst' && this.burstShots > 0 && this.burstShots < 4) {
        this.burstNext -= dt;
        if (this.burstNext <= 0) this.fireBurstShot(power, stats, hexToNumber(power.color), hexToNumber(power.core));
      }
      const doneCombat = this.combat.activeCount === 0;
      const minTime = this.effectSeconds(power);
      const burstDone = power.type !== 'burst' || this.burstShots >= 4;
      if (this.castStarted && doneCombat && burstDone && this.phaseTime >= minTime) {
        this.phase = 'recover';
        this.phaseTime = 1.1;
        this.character.setAuraActive(false);
      }
    } else if (this.phase === 'recover') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        this.resetHero();
        this.phase = 'idle';
        this.phaseTime = 0.55;
        this.castStarted = false;
      }
    }

    if (this.target) this.target.rotation.y += dt * 0.12;
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    this.character?.dispose();
    this.character = null;
    this.combat = null;
    this.target = null;
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
    this.canvas = null;
    if (instance === this) instance = null;
  }
}

export function mountPowerCastPreview(canvas: HTMLCanvasElement): void {
  instance?.stop();
  instance = new PowerCastPreview();
  instance.mount(canvas);
}

export function updatePowerCastPreview(draft: Partial<CustomPower>): void {
  instance?.update(draft);
}

export function stopPowerCastPreview(): void {
  instance?.stop();
  instance = null;
}
