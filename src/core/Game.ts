import * as THREE from 'three';
import { Character } from '../characters/Character';
import { Sound } from '../audio/Sound';
import { CombatEffects, TrainingDummy, type AttackStyle } from '../combat/Combat';
import { GRAVITY, JUMP_SPEED, RACES, RUN_SPEED, WALK_SPEED, createStats, getRace, spendKi } from '../data/gameConfig';
import { SKILLS, type SkillId } from '../data/skills';
import { ATTRIBUTE_INFO, makeProfile, loadProfiles, saveProfiles, type Appearance, type PlayerProfile, type AttributeKey } from '../data/profiles';
import type { FighterStats, GameState, RaceId } from '../data/gameConfig';
import { Ui } from '../ui/Ui';
import { World, type WorldHit } from '../world/World';

function smoothAngle(current: number, destination: number, factor: number): number {
  return current + Math.atan2(Math.sin(destination - current), Math.cos(destination - current)) * factor;
}

type ViewMode = 'first' | 'third';
const STORE_KEY = 'dbrpg-origens-settings-v012';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.07, 850);
  private readonly world: World;
  private readonly dummy: TrainingDummy;
  private readonly combat: CombatEffects;
  private readonly ui = new Ui();
  private readonly sound = new Sound();
  private character: Character;
  private stats: FighterStats;
  private state: GameState = 'MAIN_MENU';
  private beforePanel: GameState = 'MAIN_MENU';
  private raceId: RaceId = 'saiyajin';
  private readonly keys = new Set<string>();
  private readonly horizontalVelocity = new THREE.Vector3();
  private verticalVelocity = 0;
  private yaw = 0;
  private pitch = -0.035;
  private grounded = true;
  private flying = false;
  private flyingSince = 0;
  private lastSpaceAt = -1000;
  private elapsed = 0;
  private lastFrame = performance.now();
  private cameraTime = 0;
  private frameCounter = 0;
  private fps = 60;
  private debug = false;
  private readonly debugOverlay: HTMLDivElement;
  private attackEnd = 0;
  private activeSkill: SkillId = 'kamehameha';
  private readonly cooldownUntil = new Map<SkillId, number>();
  private profiles: PlayerProfile[] = loadProfiles();
  private editingProfile: PlayerProfile | null = null;
  private activeProfile: PlayerProfile | null = null;
  private heldSkill: SkillId | null = null;
  private heldSince = 0;
  private readonly maxCharge = 2.4;
  private lastMelee = -10;
  private lastMeleeCombo = -10;
  private comboStep = 0;
  private lastKiBall = -10;
  private staminaRegenDelay = 0;
  private viewMode: ViewMode = 'third';
  private fov = 70;
  private sensitivity = 1;
  private wheelAccum = 0;
  private lastWheelAt = 0;
  private readonly firstPersonArms = new THREE.Group();
  private readonly leftHandRig = new THREE.Group();
  private readonly rightHandRig = new THREE.Group();
  private readonly fpEnergy = new THREE.Group();
  private readonly fpEnergyLight = new THREE.PointLight(0x61d0ff, 0, 3);
  private readonly fpEnergyMaterial = new THREE.MeshBasicMaterial({ color: 0x9bedff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private heroReady = false;
  private readonly fpSkinMaterial = new THREE.MeshToonMaterial({ color: 0xe6b18a });
  private readonly fpSleeveMaterial = new THREE.MeshToonMaterial({ color: 0x235caa });

  constructor() {
    const canvasRoot = document.querySelector<HTMLElement>('#game-root');
    if (!canvasRoot) throw new Error('Elemento #game-root não encontrado');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.27;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.id = 'game-canvas';
    this.scene.add(this.camera);
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
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      this.viewMode = stored.mode === 'first' ? 'first' : 'third';
      this.fov = THREE.MathUtils.clamp(Number(stored.fov) || 70, 55, 105);
      this.sensitivity = THREE.MathUtils.clamp(Number(stored.sensitivity) || 1, 0.45, 1.9);
    } catch { /* configuração inválida: usar padrões */ }
    this.buildFirstPersonHands();
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.ui.setView(this.viewMode, this.fov, this.sensitivity);
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.className = 'debug-panel hidden';
    document.body.append(this.debugOverlay);
    this.ui.on({
      start: () => { this.sound.play('click'); this.ui.renderProfiles(this.profiles); this.changeState('CHARACTER_SELECT'); },
      heroCreate: () => this.createHero(),
      heroSelect: id => this.editHero(id),
      heroDelete: id => this.deleteHero(id),
      heroBack: () => this.changeState('MAIN_MENU'),
      customize: (appearance, name) => this.previewCustomization(appearance, name),
      preview: id => { this.sound.play('select'); this.selectRace(id); },
      confirm: () => this.startAdventure(),
      back: () => { this.sound.play('click'); this.ui.renderProfiles(this.profiles); this.changeState('CHARACTER_SELECT'); },
      pause: () => this.pause(),
      resume: () => this.resume(),
      exit: () => this.returnToMenu(),
      sound: () => { this.sound.enabled = !this.sound.enabled; this.ui.setSound(this.sound.enabled); this.sound.play('click'); },
      settings: () => this.openPanel('SETTINGS'),
      settingsClose: () => this.closePanel(),
      skills: () => this.openPanel('SKILLS'),
      skillsClose: () => this.closePanel(),
      upgrade: (kind, direction) => this.upgrade(kind, direction),
      selectSkill: id => this.selectSkill(id),
      camera: mode => { this.viewMode = mode; this.persistSettings(); this.ui.setView(this.viewMode, this.fov, this.sensitivity); },
      fov: value => { this.fov = value; this.camera.fov = value; this.camera.updateProjectionMatrix(); this.persistSettings(); this.ui.setView(this.viewMode, this.fov, this.sensitivity); },
      sensitivity: value => { this.sensitivity = value / 100; this.persistSettings(); this.ui.setView(this.viewMode, this.fov, this.sensitivity); }
    });
    this.installInputs();
    this.changeState('MAIN_MENU');
    requestAnimationFrame(this.tick);
    (window as Window & { __DBRPG_DEBUG__?: () => object }).__DBRPG_DEBUG__ = () => this.debugState();
  }

  private persistSettings(): void {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ mode: this.viewMode, fov: this.fov, sensitivity: this.sensitivity })); } catch { /* storage opcional */ }
  }

  private changeState(state: GameState): void {
    this.state = state;
    this.ui.state(state);
    if (state !== 'PLAYING' && state !== 'PAUSED') this.keys.clear();
    if (state === 'RACE_SELECTION') this.selectRace(this.ui.selected);
    this.character.root.visible = state !== 'PLAYING' || this.viewMode === 'third' || this.heroReady;
    this.character.setFirstPerson(state === 'PLAYING' && this.viewMode === 'first' && this.heroReady);
    this.firstPersonArms.visible = state === 'PLAYING' && this.viewMode === 'first' && !this.heroReady;
  }

  private selectRace(race: RaceId): void {
    this.raceId = race;
    this.scene.remove(this.character.root);
    this.character.dispose();
    this.character = new Character(getRace(race));
    this.character.onModelStatus(ok => {
      this.heroReady = ok;
      if (!ok) this.ui.toast('ERRO AO CARREGAR O MODELO 3D. VERIFIQUE A PASTA public/models.', 'danger', 8);
    });
    const skins: Record<RaceId, number> = { saiyajin: 0xe6b18a, terraqueo: 0xbd8061, namekuseijin: 0x74bb63, majin: 0xef9dc0 };
    const sleeves: Record<RaceId, number> = { saiyajin: 0x235caa, terraqueo: 0x269d92, namekuseijin: 0x8c6bb2, majin: 0x42445c };
    this.fpSkinMaterial.color.setHex(skins[race]);
    this.fpSleeveMaterial.color.setHex(sleeves[race]);
    this.character.root.position.copy(this.world.spawn);
    if (this.editingProfile) this.character.setAppearance(this.editingProfile.appearance);
    this.character.root.rotation.y = Math.PI;
    this.scene.add(this.character.root);
  }

  private startAdventure(): void {
    this.sound.play('select');
    this.selectRace(this.ui.selected);
    if (!this.editingProfile) this.editingProfile = makeProfile(this.raceId);
    this.editingProfile.race = this.raceId;
    this.editingProfile.name = (this.editingProfile.name.trim() || 'Guerreiro').slice(0,28);
    this.activeProfile = structuredClone(this.editingProfile);
    const index = this.profiles.findIndex(p => p.id === this.activeProfile!.id);
    if (index >= 0) this.profiles[index] = this.activeProfile;
    else this.profiles.push(this.activeProfile);
    saveProfiles(this.profiles);
    this.stats = createStats(getRace(this.raceId));
    this.applyProfileAttributes();
    this.stats.health=this.stats.maxHealth;
    this.stats.ki=this.stats.maxKi;
    this.stats.stamina=this.stats.maxStamina;
    this.character.root.rotation.y = 0;
    this.horizontalVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.flying = false;
    this.flyingSince = 0;
    this.cooldownUntil.clear();
    this.activeSkill = 'kamehameha';
    this.heldSkill = null;
    this.comboStep = 0;
    this.ui.setCharge(null,0,1);
    this.dummy.reset();
    this.camera.position.copy(this.world.spawn).add(new THREE.Vector3(0, 3, 7));
    this.yaw = 0;
    this.pitch = -0.035;
    this.changeState('LOADING');
    this.ui.setLoading(16);
    const loadingStart = performance.now();
    const loading = () => {
      if (this.state !== 'LOADING') return;
      const t = (performance.now() - loadingStart) / 550;
      this.ui.setLoading(Math.round(Math.min(100, 16 + t * 84)));
      if (t < 1) requestAnimationFrame(loading);
      else {
        this.changeState('PLAYING');
        this.ui.toast('BEM-VINDO À PLANÍCIE ESMERALDA', 'success', 2.7);
      }
    };
    requestAnimationFrame(loading);
  }

  private requestCapture(): void {
    if (document.pointerLockElement !== this.renderer.domElement) void this.renderer.domElement.requestPointerLock?.().catch(() => {});
  }
  private pause(): void {
    if (this.state !== 'PLAYING') return;
    this.changeState('PAUSED');
    if (document.pointerLockElement) void document.exitPointerLock();
  }
  private resume(): void {
    if (this.state !== 'PAUSED') return;
    this.changeState('PLAYING');
    this.requestCapture();
  }
  private openPanel(panel: 'SETTINGS' | 'SKILLS'): void {
    if (!['PLAYING', 'PAUSED', 'MAIN_MENU'].includes(this.state)) return;
    if (panel === 'SKILLS' && this.state === 'MAIN_MENU') return;
    this.beforePanel = this.state;
    this.changeState(panel);
    if (document.pointerLockElement) void document.exitPointerLock();
    if (panel === 'SKILLS') this.renderAttributes();
  }
  private closePanel(): void {
    if (this.state !== 'SETTINGS' && this.state !== 'SKILLS') return;
    this.changeState(this.beforePanel);
    if (this.beforePanel === 'PLAYING') this.requestCapture();
  }
  private returnToMenu(): void {
    if (document.pointerLockElement) void document.exitPointerLock();
    this.ui.renderProfiles(this.profiles);
    this.activeProfile = null;
    this.editingProfile = null;
    this.selectRace('saiyajin');
    this.ui.select('saiyajin', false);
    this.changeState('MAIN_MENU');
  }

  private createHero(): void {
    this.editingProfile = makeProfile();
    this.ui.editAppearance(this.editingProfile.appearance, this.editingProfile.name);
    this.ui.select(this.editingProfile.race, false);
    this.changeState('RACE_SELECTION');
  }

  private editHero(id: string): void {
    const profile = this.profiles.find(p => p.id === id);
    if (!profile)return;
    this.editingProfile = structuredClone(profile);
    this.ui.editAppearance(this.editingProfile.appearance, this.editingProfile.name);
    this.ui.select(profile.race, false);
    this.changeState('RACE_SELECTION');
  }

  private deleteHero(id: string): void {
    if (!window.confirm('Excluir este personagem e seus atributos?')) return;
    this.profiles = this.profiles.filter(p=>p.id!==id);
    saveProfiles(this.profiles);
    this.ui.renderProfiles(this.profiles);
  }

  private previewCustomization(appearance: Appearance, name: string): void {
    if (!this.editingProfile || this.state !== 'RACE_SELECTION')return;
    this.editingProfile.appearance = {...appearance};
    this.editingProfile.name = name.slice(0,28);
    this.character.setAppearance(appearance);
  }

  private applyProfileAttributes(): void {
    if (!this.activeProfile)return;
    const a=this.activeProfile.attributes;
    const race=getRace(this.activeProfile.race);
    this.stats.maxHealth=Math.max(50,race.health+a.health);
    this.stats.health=Math.min(this.stats.health, this.stats.maxHealth);
    this.stats.maxKi=Math.max(40,race.ki+a.ki);
    this.stats.ki=Math.min(this.stats.ki,this.stats.maxKi);
    this.stats.maxStamina=Math.max(40,a.stamina);
    this.stats.stamina=Math.min(this.stats.stamina,this.stats.maxStamina);
    this.stats.power=Math.max(1,race.power+a.power);
    this.stats.kiRegen=Math.max(1,a.kiRegen);
    this.stats.speed=Math.max(0.4,a.speed);
    this.stats.flight=Math.max(0.4,a.flight);
  }

  private renderAttributes(): void {
    if (!this.activeProfile) return;
    const a=this.activeProfile.attributes;
    const race=getRace(this.activeProfile.race);
    this.ui.renderAttributes({health:race.health+a.health,ki:race.ki+a.ki,stamina:a.stamina,power:race.power+a.power,kiRegen:a.kiRegen,speed:a.speed,flight:a.flight});
  }

  private upgrade(kind: AttributeKey, direction: number): void {
    if (!this.activeProfile)return;
    const info=ATTRIBUTE_INFO.find(a=>a.id===kind)!;
    const attrs=this.activeProfile.attributes;
    const race=getRace(this.raceId);
    const base=kind==='health'?race.health:kind==='ki'?race.ki:kind==='power'?race.power:0;
    const old=base+attrs[kind];
    const next=THREE.MathUtils.clamp(old+info.step*Math.sign(direction),info.min,info.max);
    if (Math.abs(next-old)<.0001)return;
    attrs[kind]=Number((next-base).toFixed(3));
    this.applyProfileAttributes();
    if(kind==='health')this.stats.health=Math.min(this.stats.maxHealth, Math.max(1,this.stats.health+(next-old)));
    if(kind==='ki')this.stats.ki=Math.min(this.stats.maxKi,Math.max(0,this.stats.ki+(next-old)));
    if(kind==='stamina')this.stats.stamina=Math.min(this.stats.maxStamina,Math.max(0,this.stats.stamina+(next-old)));
    saveProfiles(this.profiles);
    this.renderAttributes();
    this.sound.play('select');
  }

  private selectSkill(id: SkillId): void {
    this.activeSkill = id;
    this.ui.highlightSkill(id);
    this.ui.toast(`${SKILLS.find(s => s.id === id)!.label.toUpperCase()} SELECIONADO`, 'info', 0.75);
  }

  private forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();
  }

  private installInputs(): void {
    window.addEventListener('keydown', event => {
      if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'].includes(event.code)) this.keys.add(event.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code) && this.state === 'PLAYING') event.preventDefault();
      if (event.code === 'F3') {
        event.preventDefault();
        this.debug = !this.debug;
        this.debugOverlay.classList.toggle('hidden', !this.debug);
        return;
      }
      if (event.code === 'Escape') {
        if (this.state === 'PLAYING') this.pause();
        else if (this.state === 'PAUSED') this.resume();
        else if (this.state === 'SETTINGS' || this.state === 'SKILLS') this.closePanel();
        else if (this.state === 'RACE_SELECTION') this.changeState('CHARACTER_SELECT');
        else if (this.state === 'CHARACTER_SELECT') this.changeState('MAIN_MENU');
        return;
      }
      if (this.state !== 'PLAYING') return;
      if (event.repeat) return;
      if (event.code === 'KeyV') { this.viewMode = this.viewMode === 'third' ? 'first' : 'third'; this.persistSettings(); this.ui.setView(this.viewMode, this.fov, this.sensitivity); this.ui.toast(this.viewMode === 'first' ? 'VISÃO EM PRIMEIRA PESSOA' : 'VISÃO EM TERCEIRA PESSOA'); return; }
      if (event.code === 'KeyK') { this.openPanel('SKILLS'); return; }
      if (event.code === 'KeyO') { this.openPanel('SETTINGS'); return; }
      if (/^Digit[1-4]$/.test(event.code)) {
        const skill=SKILLS[Number(event.code.slice(-1))-1];
        this.selectSkill(skill.id);
        if(this.heldSkill===null) this.beginCharge(skill.id);
        return;
      }
      this.keys.add(event.code);
      if (event.code === 'Space') {
        const now = performance.now();
        if (now - this.lastSpaceAt <= 320) {
          this.flying = !this.flying;
          if (this.flying) this.flyingSince = this.elapsed;
          this.grounded = false;
          this.verticalVelocity = this.flying ? 3.6 : Math.min(this.verticalVelocity, 0);
          this.ui.toast(this.flying ? '✦ VOO DESPERTADO' : 'RETORNANDO AO SOLO', 'success');
          this.sound.play('jump');
          this.lastSpaceAt = -1000;
        } else {
          this.lastSpaceAt = now;
          if (this.grounded && !this.flying) {
            this.verticalVelocity = JUMP_SPEED;
            this.grounded = false;
            this.sound.play('jump');
          }
        }
      }
    });
    window.addEventListener('keyup', event => {
      this.keys.delete(event.code);
      if (/^Digit[1-4]$/.test(event.code) && this.heldSkill === SKILLS[Number(event.code.slice(-1))-1].id) this.releaseCharge();
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.cancelCharge(); if (this.state === 'PLAYING') this.pause(); });
    window.addEventListener('mousemove', event => {
      if (this.state !== 'PLAYING') return;
      if (document.pointerLockElement === this.renderer.domElement || event.buttons === 2) {
        this.yaw -= event.movementX * 0.0024 * this.sensitivity;
        this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0022 * this.sensitivity, -1.12, 1.22);
      }
    });
    this.renderer.domElement.addEventListener('mousedown', event => {
      if (this.state !== 'PLAYING') return;
      if (document.pointerLockElement !== this.renderer.domElement) { this.requestCapture(); return; }
      if (event.button === 0) this.punch();
      if (event.button === 2) this.kiBlast();
    });
    window.addEventListener('wheel', event => {
      if (this.state !== 'PLAYING') return;
      event.preventDefault();
      const now = performance.now();
      if (now - this.lastWheelAt > 300) this.wheelAccum = 0;
      this.wheelAccum += event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? 180 : 1);
      if (Math.abs(this.wheelAccum) >= 45 && now - this.lastWheelAt >= 105) {
        const direction = Math.sign(this.wheelAccum);
        const index = SKILLS.findIndex(skill => skill.id === this.activeSkill);
        this.selectSkill(SKILLS[(index + direction + SKILLS.length) % SKILLS.length].id);
        this.lastWheelAt = now;
        this.wheelAccum = 0;
        this.sound.play('select');
      }
    }, { passive: false });
    this.renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'PLAYING') this.pause();
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'PLAYING') this.pause(); });
  }

  private aim(): WorldHit {
    const dir = this.forward();
    return this.world.trace(this.camera.position, dir, 115, this.dummy);
  }

  private beginCharge(id: SkillId): void {
    if (this.heldSkill)return;
    const spec=SKILLS.find(s=>s.id===id)!;
    const remaining=(this.cooldownUntil.get(id)??0)-this.elapsed;
    if(remaining>0) {this.ui.toast(`${spec.short}: RECARGA ${remaining.toFixed(1)}s`,'info',.8);return;}
    if(this.stats.ki<spec.kiCost){this.ui.toast('KI INSUFICIENTE','danger',1);return;}
    this.heldSkill=id;
    this.heldSince=this.elapsed;
    this.character.gesture(Character.castAnimationForSkill(id));
    this.character.setAuraColor(spec.colorHex,spec.coreHex);
    this.fpEnergyMaterial.color.setHex(spec.coreHex);
    this.fpEnergyLight.color.setHex(spec.colorHex);
    this.sound.play('charge');
  }

  private cancelCharge(): void {
    this.heldSkill=null;
    this.ui.setCharge(null,0,1);
  }

  private releaseCharge(): void {
    const id=this.heldSkill;
    this.cancelCharge();
    if(!id||this.state!=='PLAYING')return;
    const held=THREE.MathUtils.clamp(this.elapsed-this.heldSince,0,this.maxCharge);
    const spec=SKILLS.find(s=>s.id===id)!;
    const level=held/this.maxCharge;
    const kiCost=spec.kiCost+Math.ceil(held*10);
    if(!spendKi(this.stats,kiCost)) {this.ui.toast(`PRECISA DE ${kiCost} KI PARA ESTE CARREGAMENTO`,'danger');this.sound.play('deny');return;}
    this.cooldownUntil.set(id,this.elapsed+spec.cooldown);
    this.character.gesture(Character.castAnimationForSkill(id));
    this.attackEnd=this.elapsed+.36+spec.duration;
    const damage=Math.round(spec.damage*(1+level*2.2)*this.powerMultiplier());
    this.castAttack(spec.id, spec.colorHex, spec.coreHex, spec.range, .07, spec.duration, damage, 1+level*1.8);
    this.sound.play('beam');
  }

  private powerMultiplier(): number {
    const race=getRace(this.raceId);
    return THREE.MathUtils.clamp(.7+this.stats.power/Math.max(1,race.power)*.3,.6,12);
  }

  private castAttack(style: AttackStyle, color: number, core: number, range: number, chargeSeconds: number, effectSeconds: number, damage: number, size=1): void {
    this.camera.updateMatrixWorld();
    const hit=this.aim();
    const muzzle=this.viewMode==='first'
      ?this.camera.position.clone().addScaledVector(this.forward(),1.12).add(new THREE.Vector3(0,-.18,0))
      :this.character.getMuzzleWorldPosition();
    const travel=hit.point.clone().sub(muzzle);
    const destination=travel.length()>range ? muzzle.clone().addScaledVector(travel.normalize(),range):hit.point.clone();
    this.character.root.rotation.y=this.yaw;
    this.combat.cast(muzzle,destination,{style,color,core,chargeSeconds,effectSeconds,size},point=>this.applyHit(hit,destination,damage,point));
  }

  private applyHit(hit: WorldHit, destination: THREE.Vector3, amount:number, point:THREE.Vector3):void {
    this.sound.play('impact');
    if(hit.point.distanceTo(destination)>.3)return;
    let result={actual:0,dead:false};
    if(hit.dummy) result=this.dummy.takeDamage(amount);
    else if(hit.objectId!==undefined)result=this.world.damage(hit.objectId,amount);
    if(result.actual===0)return;
    const screen=point.clone().project(this.camera);
    this.ui.floatingDamage(result.actual,(screen.x+1)/2*innerWidth,(1-screen.y)/2*innerHeight,result.dead);
    if(result.dead)this.ui.toast('ALVO DESTRUÍDO · REAPARECERÁ EM BREVE','success');
  }

  private punch():void {
    if(this.elapsed-this.lastMelee<.31||this.stats.stamina<7)return;
    this.stats.stamina-=7;
    this.staminaRegenDelay=this.elapsed+.7;
    this.comboStep=(this.elapsed-this.lastMeleeCombo<.85?this.comboStep%3+1:1);
    this.lastMelee=this.elapsed;
    this.lastMeleeCombo=this.elapsed;
    this.character.root.rotation.y=this.yaw;
    this.attackEnd = this.elapsed + (this.comboStep === 2 ? 0.72 : 0.5);
    this.character.gesture(this.comboStep===2?'punchcross':'punch');
    this.character.setAuraColor(0xff4a3a, 0xffd0c4);
    this.sound.play('impact');
    const origin=this.character.root.position.clone().add(new THREE.Vector3(0,1.3,0));
    const dir=this.forward();
    // Detect a melee target from the fighter (not from the distant third-person camera).
    const hit=this.world.trace(origin,dir,3.05,this.dummy);
    const fist = origin.clone().addScaledVector(dir, 1.15);
    this.combat.burst(fist, 0xff5a45);
    if(hit.point.distanceTo(origin)>3.06)return;
    const amount=Math.round((7+this.comboStep*3)*this.powerMultiplier());
    this.applyHit(hit,hit.point,amount,hit.point);
    this.ui.toast(`COMBO ${this.comboStep} · SOCO`, 'info',.35);
  }

  private kiBlast():void {
    if(this.elapsed-this.lastKiBall<.31)return;
    if(!spendKi(this.stats,6)){this.ui.toast('KI INSUFICIENTE','danger',.7);return;}
    this.lastKiBall=this.elapsed;
    this.character.root.rotation.y=this.yaw;
    this.attackEnd=this.elapsed+.29;
    this.character.gesture('punch');
    this.character.setAuraColor(0x45b8ff,0xf2ffff);
    this.castAttack('orb',0x45b8ff,0xffffff,58,.07,.48,Math.round(12*this.powerMultiplier()),.7);
    this.sound.play('beam');
  }

  private tick = (time: number): void => {
    const dt = Math.min(0.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    this.cameraTime += dt;
    this.world.update(dt);
    this.combat.update(dt);
    this.dummy.update(dt, this.camera);
    if (this.state === 'PLAYING') {
      this.elapsed += dt;
      this.updatePlayer(dt);
      this.updateCamera(dt);
      this.updateFirstPersonHands(dt);
      this.stats.ki = Math.min(this.stats.maxKi, this.stats.ki + (this.elapsed > this.attackEnd + .8 && !this.heldSkill ? this.stats.kiRegen : 0) * dt);
      if(this.elapsed>this.staminaRegenDelay)this.stats.stamina=Math.min(this.stats.maxStamina,this.stats.stamina+22*dt);
      if(this.heldSkill) {
        const spec=SKILLS.find(s=>s.id===this.heldSkill)!;
        const seconds=Math.min(this.maxCharge,this.elapsed-this.heldSince);
        this.attackEnd=this.elapsed+.18;
        this.ui.setCharge(spec.short,seconds/this.maxCharge,1+seconds/this.maxCharge*2.2);
      }
      const cds = Object.fromEntries(SKILLS.map(skill => [skill.id, Math.max(0, (this.cooldownUntil.get(skill.id) ?? 0) - this.elapsed)])) as Partial<Record<SkillId, number>>;
      const cooldown = cds[this.activeSkill] ?? 0;
      this.ui.updateHud(this.stats, cooldown, this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), this.horizontalVelocity.length(), this.dummy.health, this.dummy.maxHealth, this.dummy.health > 0, getRace(this.raceId), this.activeSkill, cds, this.flying);
      if (this.frameCounter % 4 === 0) {
        const aim = this.aim();
        this.ui.setAimHit(Boolean(aim.dummy || aim.objectId !== undefined));
      }
    } else if (this.state === 'MAIN_MENU') {
      this.character.root.visible = true;
      this.character.root.rotation.y = Math.PI - Math.sin(this.cameraTime * 0.26) * 0.18;
      this.character.animate(dt, 0, false, false);
      const p = this.world.spawn;
      this.camera.position.lerp(new THREE.Vector3(p.x + 17 + Math.sin(this.cameraTime * 0.2) * 2, p.y + 8.1, p.z + 18), Math.min(1, dt * 1.1));
      this.camera.lookAt(p.x - 1.4, p.y + 1.9, p.z - 4);
    } else if (this.state === 'RACE_SELECTION') {
      this.character.root.visible = true;
      this.character.root.rotation.y = Math.PI + Math.sin(this.cameraTime * 0.44) * 0.21;
      this.character.animate(dt, 0, false, false);
      const p = this.world.spawn;
      this.camera.position.lerp(new THREE.Vector3(p.x + 0.8, p.y + 2.85, p.z + 7.25), Math.min(1, dt * 3));
      this.camera.lookAt(p.x, p.y + 1.5, p.z);
    }
    this.frameCounter++;
    if (this.frameCounter % 30 === 0 && dt > 0) this.fps = Math.round(1 / dt);
    this.ui.update();
    if (this.debug) this.debugOverlay.textContent = `DEBUG v0.1.7 · FPS ${this.fps}\nEstado: ${this.state}\nRaça: ${this.raceId}\nPosição: ${this.character.root.position.toArray().map(v => v.toFixed(1)).join(', ')}\nVisão: ${this.viewMode} FOV ${this.fov}\nVoando: ${this.flying}\nNo chão: ${this.grounded}\nKi: ${Math.round(this.stats.ki)}\nPoder: ${this.stats.power}\nHabilidade: ${this.activeSkill}\nStamina: ${this.stats.stamina.toFixed(0)}\nObjetos destrutíveis: ${this.world.breakableCount}`;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.tick);
  };

  private updatePlayer(dt: number): void {
    const inputX = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const inputZ = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const tryingSprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const sprint = tryingSprint && this.stats.stamina > 0.05;
    const speed=this.flying?(sprint?20:12)*this.stats.flight:(sprint?RUN_SPEED:WALK_SPEED)*this.stats.speed;
    const desired = new THREE.Vector3(Math.cos(this.yaw) * inputX - Math.sin(this.yaw) * inputZ, 0, -Math.sin(this.yaw) * inputX - Math.cos(this.yaw) * inputZ);
    if (desired.lengthSq() > 0.001) desired.normalize().multiplyScalar(speed);
    if(sprint&&desired.lengthSq()>0.25){
      this.stats.stamina=Math.max(0,this.stats.stamina-(this.flying?12:14)*dt);
      this.staminaRegenDelay=this.elapsed+.75;
    } else if(this.flying && desired.lengthSq()>0.25) {
      this.stats.stamina=Math.max(0,this.stats.stamina-3.5*dt);
      this.staminaRegenDelay=this.elapsed+.4;
    }
    this.horizontalVelocity.lerp(desired, 1 - Math.exp(-dt * (this.grounded || this.flying ? 9 : 3.4)));
    const pos = this.character.root.position;
    const nextX = pos.x + this.horizontalVelocity.x * dt;
    const nextZ = pos.z + this.horizontalVelocity.z * dt;
    if (this.flying || this.world.isWalkable(nextX, pos.z)) pos.x = nextX;
    else this.horizontalVelocity.x = 0;
    if (this.flying || this.world.isWalkable(pos.x, nextZ)) pos.z = nextZ;
    else this.horizontalVelocity.z = 0;
    const ground = this.world.height(pos.x, pos.z);
    if (this.flying) {
      const up = Number(this.keys.has('Space')) - Number(this.keys.has('ControlLeft') || this.keys.has('ControlRight'));
      const desiredY = up * (sprint ? 11 : 7.5)*this.stats.flight;
      this.verticalVelocity = THREE.MathUtils.damp(this.verticalVelocity, desiredY, 6, dt);
      pos.y = Math.max(ground + 1.2, pos.y + this.verticalVelocity * dt);
      this.grounded = false;
    } else if (this.grounded) {
      const downwardGap = pos.y - ground;
      if (downwardGap > 0.7) {
        this.grounded = false;
        this.verticalVelocity = Math.min(this.verticalVelocity, -0.4);
      } else {
        pos.y = ground;
        this.verticalVelocity = 0;
      }
    }
    if (!this.flying && !this.grounded) {
      this.verticalVelocity -= GRAVITY * dt;
      pos.y += this.verticalVelocity * dt;
      if (pos.y <= ground) {
        pos.y = ground;
        this.grounded = true;
        this.verticalVelocity = 0;
      }
    }
    const move = this.horizontalVelocity.length();
    if (this.viewMode === 'first' && this.heroReady) this.character.root.rotation.y = this.yaw;
    else if (move > 0.25 && this.elapsed >= this.attackEnd) {
      const angle = Math.atan2(-this.horizontalVelocity.x, -this.horizontalVelocity.z);
      this.character.root.rotation.y = smoothAngle(this.character.root.rotation.y, angle, Math.min(1, dt * 13));
    }
    const flightPhase = !this.flying ? 'ground' : this.elapsed - this.flyingSince < 0.65 ? 'takeoff' : this.elapsed - this.flyingSince > 2.4 ? 'cruise' : 'hover';
    this.character.animate(dt, move, !this.grounded, this.elapsed < this.attackEnd, this.flying, sprint, flightPhase, this.heldSkill ?? this.activeSkill);
  }

  private updateCamera(dt: number): void {
    const origin = this.character.root.position;
    const forward = this.forward();
    const head = origin.clone().add(new THREE.Vector3(0, this.flying ? 1.9 : 1.75, 0));
    const eye = new THREE.Vector3();
    const eyesReady = this.viewMode === 'first' && this.heroReady && this.character.copyEye(eye);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = eyesReady
      ? eye.addScaledVector(forward, 0.12)
      : this.viewMode === 'first'
      ? head.clone().addScaledVector(forward, 0.19)
      : head.clone().addScaledVector(forward, -5.8).addScaledVector(right, 0.85).add(new THREE.Vector3(0, 0.55, 0));
    if (this.viewMode === 'third') desired.y = Math.max(this.world.height(desired.x, desired.z) + 1.25, desired.y);
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * (eyesReady ? 22 : 16)));
    this.camera.lookAt(this.camera.position.clone().addScaledVector(forward, 25));
    this.character.setFirstPerson(this.viewMode === 'first' && this.heroReady);
    this.character.root.visible = this.viewMode === 'third' || this.heroReady;
    this.firstPersonArms.visible = this.viewMode === 'first' && this.state === 'PLAYING' && !this.heroReady;
  }

  private buildFirstPersonHands(): void {
    const material = this.fpSkinMaterial;
    const sleeve = this.fpSleeveMaterial;
    const cuff = new THREE.MeshToonMaterial({ color: 0xf2be70 });
    for (const [side, rig] of [[-1, this.leftHandRig], [1, this.rightHandRig]] as const) {
      const x = side * 0.31;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.56, 12), sleeve);
      arm.rotation.x = -1.05;
      arm.position.set(x, -0.42, -0.65);
      const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.12, 12), cuff);
      wrist.rotation.x = -1.05;
      wrist.position.set(x + side * 0.055, -0.31, -0.89);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), material);
      hand.scale.set(0.85, 0.75, 1.4);
      hand.position.set(x + side * 0.085, -0.27, -1.0);
      rig.add(arm, wrist, hand);
      for (let finger = 0; finger < 4; finger++) {
        const digit = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.095 - finger * 0.007, 4, 7), material);
        digit.rotation.x = Math.PI / 2;
        digit.position.set(x + side * 0.075 + (finger - 1.5) * 0.045, -0.27, -1.14);
        rig.add(digit);
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.037, 0.09, 4, 7), material);
      thumb.rotation.z = side * 0.75;
      thumb.position.set(x - side * 0.05, -0.30, -1.03);
      rig.add(thumb);
      this.firstPersonArms.add(rig);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), this.fpEnergyMaterial);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 14), new THREE.MeshBasicMaterial({ color: 0x43bfff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.014, 7, 30), this.fpEnergyMaterial.clone());
    ring.position.z = -0.07;
    this.fpEnergy.add(core, halo, ring, this.fpEnergyLight);
    this.fpEnergy.position.set(0, -0.22, -1.22);
    this.firstPersonArms.add(this.fpEnergy);
    this.firstPersonArms.visible = false;
    this.camera.add(this.firstPersonArms);
  }

  private updateFirstPersonHands(dt: number): void {
    if (!this.firstPersonArms.visible) return;
    const melee=this.elapsed-this.lastMelee<.27;
    const blast=this.elapsed-this.lastKiBall<.3;
    const attacking=this.elapsed < this.attackEnd;
    this.fpEnergy.visible = attacking && !melee;
    if (attacking) {
      const blink = 0.75 + Math.sin(this.elapsed * 24) * 0.15;
      this.fpEnergy.scale.setScalar(blink);
      this.fpEnergy.rotation.z += dt * 2.8;
      this.fpEnergyLight.intensity = 3.4;
    } else this.fpEnergyLight.intensity = 0;
    const sway = Math.sin(this.elapsed * 6) * Math.min(1, this.horizontalVelocity.length() / 9);
    const intensity = attacking ? 1 : 0;
    const interpolation = 1 - Math.exp(-dt * 13);
    const x = (attacking && !melee) ? 0.12 : -0.11;
    this.leftHandRig.position.x = THREE.MathUtils.lerp(this.leftHandRig.position.x, x, interpolation);
    this.rightHandRig.position.x = THREE.MathUtils.lerp(this.rightHandRig.position.x, -x, interpolation);
    this.leftHandRig.position.y = THREE.MathUtils.lerp(this.leftHandRig.position.y, intensity * 0.14 + sway * 0.012, interpolation);
    this.rightHandRig.position.y = THREE.MathUtils.lerp(this.rightHandRig.position.y, intensity * 0.14 - sway * 0.012, interpolation);
    this.rightHandRig.position.z = THREE.MathUtils.lerp(this.rightHandRig.position.z,melee ? -.75 : blast ? -.32 : 0, interpolation);
    this.leftHandRig.position.z = THREE.MathUtils.lerp(this.leftHandRig.position.z,melee && this.comboStep===2 ? -.60 : 0,interpolation);
    this.leftHandRig.rotation.x = THREE.MathUtils.lerp(this.leftHandRig.rotation.x, attacking ? -0.35 : 0.05, interpolation);
    this.rightHandRig.rotation.x = THREE.MathUtils.lerp(this.rightHandRig.rotation.x, attacking ? -0.35 : -0.05, interpolation);
  }

  private debugState(): object {
    return { state: this.state, heroReady: this.heroReady, hero: this.activeProfile?.name, charging: this.heldSkill, race: this.raceId, stats: { ...this.stats }, position: this.character.root.position.toArray(), speed: this.horizontalVelocity.length(), ground: this.grounded, flying: this.flying, mode: this.viewMode, activeSkill: this.activeSkill, dummyHealth: this.dummy.health, beams: this.combat.activeCount, breakables: this.world.breakableCount };
  }
}
