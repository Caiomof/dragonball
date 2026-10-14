import * as THREE from 'three';
import { Character } from '../characters/Character';
import { Sound } from '../audio/Sound';
import { CombatEffects, TrainingDummy } from '../combat/Combat';
import { ABILITIES, GRAVITY, JUMP_SPEED, RACES, RUN_SPEED, WALK_SPEED, createStats, getRace, spendKi } from '../data/gameConfig';
import type { FighterStats, GameState, RaceId } from '../data/gameConfig';
import { Ui } from '../ui/Ui';
import { World } from '../world/World';

function moveAngle(current: number, destination: number, factor: number): number {
  const diff = Math.atan2(Math.sin(destination - current), Math.cos(destination - current));
  return current + diff * factor;
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(63, window.innerWidth / window.innerHeight, 0.08, 800);
  private readonly world: World;
  private readonly dummy: TrainingDummy;
  private readonly combat: CombatEffects;
  private readonly ui = new Ui();
  private readonly sound = new Sound();
  private character: Character;
  private stats: FighterStats;
  private state: GameState = 'MAIN_MENU';
  private raceId: RaceId = 'saiyajin';
  private readonly keys = new Set<string>();
  private readonly horizontalVelocity = new THREE.Vector3();
  private verticalVelocity = 0;
  private yaw = 0;
  private pitch = 0.23;
  private cameraTime = 0;
  private grounded = true;
  private lastCastAt = -100;
  private elapsed = 0;
  private lastFrame = performance.now();
  private frameCounter = 0;
  private fps = 60;
  private debug = false;
  private debugOverlay: HTMLDivElement;
  private attackEnd = 0;
  private stopped = false;

  constructor() {
    const canvasRoot = document.querySelector<HTMLElement>('#game-root');
    if (!canvasRoot) throw new Error('Elemento #game-root não encontrado');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.27;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.id = 'game-canvas';
    canvasRoot.append(this.renderer.domElement);

    this.world = new World(this.scene);
    this.dummy = new TrainingDummy(this.world);
    this.combat = new CombatEffects(this.scene);
    this.character = new Character(RACES[0]);
    this.stats = createStats(RACES[0]);
    this.character.root.position.copy(this.world.spawn);
    this.scene.add(this.character.root);
    this.camera.position.set(15, 9, 21);
    this.camera.lookAt(0, 1.8, 2);

    this.debugOverlay = document.createElement('div');
    this.debugOverlay.className = 'debug-panel hidden';
    document.body.append(this.debugOverlay);
    this.ui.on({
      start: () => { this.sound.play('click'); this.changeState('RACE_SELECTION'); },
      preview: (id) => { this.sound.play('select'); this.selectRace(id); },
      confirm: () => this.startAdventure(),
      back: () => { this.sound.play('click'); this.changeState('MAIN_MENU'); },
      pause: () => this.pause(),
      resume: () => this.resume(),
      exit: () => this.returnToMenu(),
      sound: () => { this.sound.enabled = !this.sound.enabled; this.ui.setSound(this.sound.enabled); this.sound.play('click'); }
    });
    this.installInputs();
    this.changeState('MAIN_MENU');
    requestAnimationFrame(this.tick);
    (window as Window & { __DBRPG_DEBUG__?: () => object }).__DBRPG_DEBUG__ = () => this.debugState();
  }

  private changeState(state: GameState): void {
    this.state = state;
    this.ui.state(state);
    if (state !== 'PLAYING') this.keys.clear();
    if (state === 'RACE_SELECTION') this.selectRace(this.ui.selected);
  }

  private selectRace(race: RaceId): void {
    this.raceId = race;
    this.scene.remove(this.character.root);
    this.character.dispose();
    this.character = new Character(getRace(race));
    this.character.root.position.copy(this.world.spawn);
    this.character.root.rotation.y = Math.PI;
    this.scene.add(this.character.root);
  }

  private startAdventure(): void {
    this.sound.play('select');
    this.selectRace(this.ui.selected);
    this.stats = createStats(getRace(this.raceId));
    this.character.root.rotation.y = 0;
    this.horizontalVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.lastCastAt = -100;
    this.dummy.reset();
    this.camera.position.copy(this.world.spawn).add(new THREE.Vector3(0, 3.7, 7.0));
    this.camera.lookAt(this.world.spawn.clone().add(new THREE.Vector3(0, 1.6, 0)));
    this.yaw = 0;
    this.pitch = 0.2;
    this.changeState('LOADING');
    this.ui.setLoading(16);
    void this.renderer.domElement.requestPointerLock?.().catch(() => {});
    const loadingStart = performance.now();
    const animateLoading = () => {
      if (this.state !== 'LOADING') return;
      const t = (performance.now() - loadingStart) / 540;
      this.ui.setLoading(Math.round(Math.min(100, 16 + t * 84)));
      if (t < 1) requestAnimationFrame(animateLoading);
      else {
        this.changeState('PLAYING');
        this.ui.toast('BEM-VINDO À PLANÍCIE ESMERALDA', 'success', 2.9);
      }
    };
    requestAnimationFrame(animateLoading);
  }

  private pause(): void {
    if (this.state !== 'PLAYING') return;
    this.changeState('PAUSED');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private resume(): void {
    if (this.state !== 'PAUSED') return;
    this.changeState('PLAYING');
    void this.renderer.domElement.requestPointerLock?.().catch(() => this.ui.toast('Clique no cenário para controlar a câmera.'));
  }

  private returnToMenu(): void {
    if (document.pointerLockElement) document.exitPointerLock();
    this.selectRace('saiyajin');
    this.ui.select('saiyajin', false);
    this.changeState('MAIN_MENU');
  }

  private installInputs(): void {
    window.addEventListener('keydown', (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat && event.code !== 'KeyW') return;
      if (event.code === 'F3') {
        event.preventDefault();
        this.debug = !this.debug;
        this.debugOverlay.classList.toggle('hidden', !this.debug);
        return;
      }
      if (event.code === 'Escape') {
        if (this.state === 'PLAYING') this.pause();
        else if (this.state === 'PAUSED') this.resume();
        return;
      }
      this.keys.add(event.code);
      if (this.state === 'PLAYING' && event.code === 'Space' && this.grounded) {
        this.verticalVelocity = JUMP_SPEED;
        this.grounded = false;
        this.sound.play('jump');
      }
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => { this.keys.clear(); if (this.state === 'PLAYING') this.pause(); });
    window.addEventListener('mousemove', (event) => {
      if (this.state !== 'PLAYING') return;
      if (document.pointerLockElement === this.renderer.domElement || event.buttons === 2) {
        this.yaw -= event.movementX * 0.0025;
        this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.002, -0.18, 0.73);
      }
    });
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (this.state !== 'PLAYING') return;
      if (document.pointerLockElement !== this.renderer.domElement) void this.renderer.domElement.requestPointerLock?.().catch(() => {});
      if (event.button === 0) this.attack();
    });
    this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === null && this.state === 'PLAYING') this.pause();
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'PLAYING') this.pause(); });
  }

  private attack(): void {
    const now = this.elapsed;
    const cd = ABILITIES.kamehameha.cooldownSeconds - (now - this.lastCastAt);
    if (cd > 0) { this.ui.toast(`ENERGIA RECUPERANDO · ${cd.toFixed(1)}s`, 'info', 0.9); this.sound.play('deny'); return; }
    if (!spendKi(this.stats, ABILITIES.kamehameha.kiCost)) { this.ui.toast('KI INSUFICIENTE · AGUARDE A RECARGA', 'danger', 1.5); this.sound.play('deny'); return; }
    this.lastCastAt = now;
    this.attackEnd = now + ABILITIES.kamehameha.chargeSeconds + ABILITIES.kamehameha.beamSeconds;
    this.sound.play('charge');
    window.setTimeout(() => { if (this.state === 'PLAYING') this.sound.play('beam'); }, ABILITIES.kamehameha.chargeSeconds * 1000);
    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);
    const direction = new THREE.Vector3(-Math.sin(this.yaw), THREE.MathUtils.clamp(cameraDir.y, -0.01, 0.1), -Math.cos(this.yaw)).normalize();
    this.character.root.rotation.y = this.yaw;
    const muzzle = this.character.getMuzzleWorldPosition();
    this.combat.cast(muzzle, direction, this.dummy, (damage, dead, impactPoint) => {
      this.sound.play('impact');
      const screen = impactPoint.clone().project(this.camera);
      this.ui.floatingDamage(damage, (screen.x + 1) / 2 * window.innerWidth, (1 - screen.y) / 2 * window.innerHeight, dead);
      this.ui.toast(dead ? 'ALVO DESTRUÍDO! RENASCERÁ EM BREVE' : `ACERTOU! ${damage} DE DANO`, 'success', 1.3);
    });
  }

  private tick = (time: number): void => {
    if (this.stopped) return;
    const dt = Math.min(0.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    this.elapsed += dt;
    this.frameCounter++;
    if (this.frameCounter % 28 === 0 && dt > 0) this.fps = Math.round(1 / dt);
    this.cameraTime += dt;
    this.world.update(dt);
    this.combat.update(dt);
    this.dummy.update(dt, this.camera);
    if (this.state === 'PLAYING') {
      this.updatePlayer(dt);
      if (this.elapsed - this.lastCastAt > 2.8) this.stats.ki = Math.min(this.stats.maxKi, this.stats.ki + 5.5 * dt);
      const cd = Math.max(0, ABILITIES.kamehameha.cooldownSeconds - (this.elapsed - this.lastCastAt));
      const moving = this.horizontalVelocity.length();
      this.ui.updateHud(this.stats, cd, this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), moving, this.dummy.health, this.dummy.maxHealth, this.dummy.health > 0, getRace(this.raceId));
      this.updateCamera(dt);
    } else if (this.state === 'MAIN_MENU') {
      this.character.root.rotation.y = Math.PI - Math.sin(this.cameraTime * 0.26) * 0.18;
      this.character.animate(dt, 0, false, false);
      const p = this.world.spawn;
      const camPos = new THREE.Vector3(p.x + 17 + Math.sin(this.cameraTime * 0.2) * 2, p.y + 8.1, p.z + 18);
      this.camera.position.lerp(camPos, Math.min(1, dt * 1.1));
      this.camera.lookAt(p.x - 1.4, p.y + 1.9, p.z - 4);
    } else if (this.state === 'RACE_SELECTION') {
      this.character.root.rotation.y = Math.PI + Math.sin(this.cameraTime * 0.44) * 0.21;
      this.character.animate(dt, 0, false, false);
      const p = this.world.spawn;
      this.camera.position.lerp(new THREE.Vector3(p.x + 0.8, p.y + 2.85, p.z + 7.25), Math.min(1, dt * 3));
      this.camera.lookAt(p.x, p.y + 1.5, p.z);
    }
    this.ui.update();
    if (this.debug) this.debugOverlay.textContent = `DEBUG v0.1 · FPS ${this.fps}\nEstado: ${this.state}\nRaça: ${this.raceId}\nPosição: ${this.character.root.position.toArray().map((v: number) => v.toFixed(1)).join(', ')}\nVelocidade: ${this.horizontalVelocity.length().toFixed(1)} m/s\nChão: ${this.grounded}\nKi: ${Math.round(this.stats.ki)}\nRajadas ativas: ${this.combat.activeCount}\nVida do alvo: ${this.dummy.health}`;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.tick);
  };

  private updatePlayer(dt: number): void {
    const inputX = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const inputZ = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const desired = new THREE.Vector3(Math.cos(this.yaw) * inputX - Math.sin(this.yaw) * inputZ, 0, -Math.sin(this.yaw) * inputX - Math.cos(this.yaw) * inputZ);
    if (desired.lengthSq() > 0.001) desired.normalize().multiplyScalar(sprint ? RUN_SPEED : WALK_SPEED);
    this.horizontalVelocity.lerp(desired, 1 - Math.exp(-dt * (this.grounded ? 10 : 3.3)));
    const position = this.character.root.position;
    const nextX = position.x + this.horizontalVelocity.x * dt;
    const nextZ = position.z + this.horizontalVelocity.z * dt;
    if (this.world.isWalkable(nextX, position.z)) position.x = nextX;
    else this.horizontalVelocity.x = 0;
    if (this.world.isWalkable(position.x, nextZ)) position.z = nextZ;
    else this.horizontalVelocity.z = 0;
    if (!this.grounded) this.verticalVelocity -= GRAVITY * dt;
    position.y += this.verticalVelocity * dt;
    const ground = this.world.height(position.x, position.z);
    if (position.y <= ground) { position.y = ground; this.grounded = true; this.verticalVelocity = 0; }
    const move = this.horizontalVelocity.length();
    if (move > 0.25 && this.elapsed >= this.attackEnd) {
      const destination = Math.atan2(-this.horizontalVelocity.x, -this.horizontalVelocity.z);
      this.character.root.rotation.y = moveAngle(this.character.root.rotation.y, destination, Math.min(1, dt * 13));
    }
    this.character.animate(dt, move, !this.grounded, this.elapsed < this.attackEnd);
  }

  private updateCamera(dt: number): void {
    const origin = this.character.root.position;
    const horizontal = 7.8 * Math.cos(this.pitch);
    const desired = new THREE.Vector3(origin.x + Math.sin(this.yaw) * horizontal, origin.y + 2.9 + Math.sin(this.pitch) * 6.0, origin.z + Math.cos(this.yaw) * horizontal);
    desired.y = Math.max(desired.y, this.world.height(desired.x, desired.z) + 1.4);
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 10));
    this.camera.lookAt(origin.x, origin.y + 1.73, origin.z);
  }

  private debugState(): object {
    return { state: this.state, race: this.raceId, stats: { ...this.stats }, position: this.character.root.position.toArray(), speed: this.horizontalVelocity.length(), ground: this.grounded, dummyHealth: this.dummy.health, beams: this.combat.activeCount, worldReady: true };
  }
}
