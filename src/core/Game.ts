import {GuardianCycle,guardianCanHit} from '../systems/Guardian';
import {SimulationClock} from '../systems/SimulationClock';
import { resolveCamera } from '../systems/CameraRig';
import { QUALITY, finiteSetting, type Quality } from '../systems/Settings';
import { advanceJourney, journeyStage } from '../systems/Journey';
import { biomeAt, LANDMARKS, WORLD_HALF } from '../world/landscape';
import * as THREE from 'three';
import { Character } from '../characters/Character';
import { Sound } from '../audio/Sound';
import { CombatEffects, TrainingDummy, type AttackStyle } from '../combat/Combat';
import { GRAVITY, JUMP_SPEED, RACES, RUN_SPEED, WALK_SPEED, createStats, getRace, isRacePlayable, RACE_UNAVAILABLE_MSG, spendKi } from '../data/gameConfig';
import { PowerController } from './PowerController';
import { ATTRIBUTE_INFO, RACE_APPEARANCE, makeProfile, loadProfiles, saveProfiles, type Appearance, type PlayerProfile, type AttributeKey } from '../data/profiles';
import type { FighterStats, GameState, RaceId } from '../data/gameConfig';
import { Ui } from '../ui/Ui';
import { World, type WorldHit } from '../world/World';
import { Wildlife } from '../world/Wildlife';
import { FootstepDust } from '../effects/FootstepDust';
import { RpgLoop,type GameMode,type ItemId } from '../systems/RpgLoop';
import { RpgPanels } from '../ui/RpgPanels';
import { ShopStall } from '../world/ShopStall';

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
  private readonly wildlife: Wildlife;
  private readonly rpg = new RpgLoop();
  private pendingMode:GameMode|null=null;
  private readonly shop:ShopStall;
  private readonly rpgPanels:RpgPanels;
  private readonly dummy: TrainingDummy;
  private readonly finalDummy: TrainingDummy;
  private readonly guardianCycle=new GuardianCycle();
  private readonly guardianWarning=new THREE.Mesh(new THREE.RingGeometry(8.6,9,64),new THREE.MeshBasicMaterial({color:0xff6b40,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
  private quality:Quality='high';
  private motion=.65;
  private saveClock=0;
  private splashClock=0;
  private readonly frameTimes:number[]=[];
  private wasSwimming=false;
  private brakingUntil=0;
  private lastMove=0;
  private readonly simulationClock=new SimulationClock();
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
  private readonly powers: PowerController;
  private profiles: PlayerProfile[] = loadProfiles();
  private editingProfile: PlayerProfile | null = null;
  private activeProfile: PlayerProfile | null = null;
  private readonly maxCharge = 2.4;
  private lastMelee = -10;
  private lastMeleeCombo = -10;
  private comboStep = 0;
  private lastKiBall = -10;
  private kiBlastHeld = false;
  private kiBlastSince = 0;
  private powerPotency = 0;
  private powerFullToast = false;
  private dayTime = 0.38;
  private dayAuto = false;
  private readonly footsteps = new FootstepDust(this.scene);
  private rootedUntil = 0;
  private pendingShot: { at: number; run: () => void } | null = null;
  private staminaRegenDelay = 0;
  private viewMode: ViewMode = 'third';
  private fov = 70;
  private sensitivity = 1;
  private readonly fpEnergy = new THREE.Group();
  private readonly fpEnergyLight = new THREE.PointLight(0x61d0ff, 0, 3);
  private readonly fpEnergyMaterial = new THREE.MeshBasicMaterial({ color: 0x9bedff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private heroReady = false;
  private techniqueBoostUntil = 0;
  private techniqueBoostMult = 1;
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
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.id = 'game-canvas';
    this.scene.add(this.camera);
    canvasRoot.append(this.renderer.domElement);
    this.world = new World(this.scene);
    void import('../world/natureDecor').then(m => m.decorateNature(this.world)).catch(() => {});
    void import('../world/villageDecor').then(m => m.decorateVillage(this.world)).catch(() => {});
    void import('../world/rockDecor').then(m => m.decorateRocks(this.world)).catch(() => {});
    this.shop = new ShopStall(this.world);
    this.rpgPanels = new RpgPanels(this.rpg,{
      onClose:()=>this.resumeGameplayPointer(),
      onMode:mode=>this.setRpgMode(mode),
      onBuy:id=>this.purchaseItem(id),
      onSell:id=>this.sellItem(id),
      onUse:id=>this.useItem(id),
      onClaim:()=>this.claimContract(),
    });
    this.wildlife = new Wildlife(this.world);
    this.dummy = new TrainingDummy(this.world);
    this.finalDummy=new TrainingDummy(this.world,new THREE.Vector3(43,this.world.height(43,119),119),180);
    this.finalDummy.group.name='Guardião da Aurora';this.finalDummy.group.visible=false;
    this.guardianWarning.rotation.x=-Math.PI/2;this.guardianWarning.position.copy(this.finalDummy.group.position).add(new THREE.Vector3(0,.12,0));this.scene.add(this.guardianWarning);
    void this.wildlife.ready.catch(()=>{});
    this.combat = new CombatEffects(this.scene);
    this.powers = new PowerController({
      onLibraryOpen: () => this.suspendGameplayPointer(),
      onLibraryClose: () => this.resumeGameplayPointer(),
      ui: this.ui,
      world: this.world,
      combat: this.combat,
      getElapsed: () => this.elapsed,
      getStats: () => this.stats,
      getCharacter: () => this.character,
      getCamera: () => this.camera,
      spendKi: n => this.rpg.creative ? true : spendKi(this.stats, n),
      isCreative: () => this.rpg.creative,
      powerMult: () => this.powerMultiplier(),
      forward: () => this.forward(),
      playerPos: () => this.character.root.position,
      castAttack: (style, color, core, range, charge, duration, damage, size, blastRadius) => this.castAttack(style, color, core, range, charge, duration, damage, size, blastRadius),
      damagePlayer: (n, m) => this.damagePlayer(n, m),
      toast: (m, k, s) => this.ui.toast(m, k ?? 'info', s),
      onAttackEnd: s => { this.attackEnd = this.elapsed + s; },
      onRoot: s => { this.rootedUntil = this.elapsed + s; },
      playCharge: () => this.sound.play('charge'),
      playBeam: () => this.sound.play('beam'),
      playDeny: () => this.sound.play('deny'),
      toggleFlying: () => {
        if (!this.rpg.creative && !this.flying && this.stats.ki < 8) { this.ui.toast('RECUPERE KI ANTES DE VOAR', 'info'); return; }
        this.flying = !this.flying;
        if (this.flying) this.flyingSince = this.elapsed;
        this.grounded = false;
        this.verticalVelocity = this.flying ? 3.6 : Math.min(this.verticalVelocity, 0);
        this.ui.toast(this.flying ? '✦ VOO DESPERTADO' : 'RETORNANDO AO SOLO', 'success');
        this.sound.play('jump');
      },
      teleportForward: range => {
        const pos = this.character.root.position;
        pos.addScaledVector(this.forward(), range);
        pos.y = this.world.height(pos.x, pos.z);
        this.ui.toast('TELEPORTE', 'success', 0.5);
      },
      applyTechniqueBoost: (type, charge) => {
        const held = THREE.MathUtils.clamp(charge, 0, 2.4);
        if (type === 'super_saiyan') {
          this.techniqueBoostMult = 1.55 + held * 0.12;
          this.techniqueBoostUntil = this.elapsed + 22 + held * 5;
          this.character.setAuraColor(0xffd54a, 0xfff8d4);
        } else {
          this.techniqueBoostMult = 1.32 + held * 0.1;
          this.techniqueBoostUntil = this.elapsed + 14 + held * 4;
          this.character.setAuraColor(0xff5252, 0xffd0d0);
        }
        this.character.setAuraActive(true, 'surge');
      },
    });
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
      this.quality=['low','medium','high'].includes(stored.quality)?stored.quality:'high';
      this.motion=finiteSetting(stored.motion,matchMedia('(prefers-reduced-motion: reduce)').matches?0:.65,0,1);
      this.sound.volume=finiteSetting(stored.volume,.65,0,1);this.sound.enabled=stored.sound!==false;
    } catch { /* configuração inválida: usar padrões */ }
    this.applyQuality();this.ui.settingsValues(this.quality,this.sound.volume,this.motion);this.ui.setSound(this.sound.enabled);
    window.addEventListener('origens:storage-error',()=>this.ui.toast('NÃO FOI POSSÍVEL SALVAR NESTE NAVEGADOR. LIBERE ESPAÇO OU PERMITA ARMAZENAMENTO.','danger',6));
    document.body.append(document.getElementById('toast')!);
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
      heroSelect: id => this.playHero(id),
      heroDelete: id => this.deleteHero(id),
      respawn:()=>this.respawn(),
      quality:value=>{this.quality=value;this.applyQuality();this.persistSettings();},
      volume:value=>{this.sound.volume=value;this.persistSettings();},
      motion:value=>{this.motion=value;this.persistSettings();},
      day:value=>{this.dayTime=value;this.world.setDay(value);},
      dayAuto:enabled=>{this.dayAuto=enabled;},
      heroBack: () => this.changeState('MAIN_MENU'),
      customize: appearance => this.previewCustomization(appearance),
      preview: id => { this.sound.play('select'); this.selectRace(id, true); },
      confirm: () => void this.confirmStartAdventure(),
      back: () => { this.sound.play('click'); this.ui.renderProfiles(this.profiles); this.changeState('CHARACTER_SELECT'); },
      pause: () => this.pause(),
      resume: () => this.resume(),
      exit: () => this.returnToMenu(),
      sound: () => { this.sound.enabled = !this.sound.enabled; this.ui.setSound(this.sound.enabled); this.sound.play('click'); this.persistSettings(); },
      settings: () => this.openPanel('SETTINGS'),
      settingsClose: () => this.closePanel(),
      skills: () => this.openPanel('SKILLS'),
      skillsClose: () => this.closePanel(),
      powers: () => {
        if (this.state === 'PAUSED') this.resume();
        if (this.powers.isLibraryOpen()) this.powers.closePanel();
        else if (this.state === 'PLAYING') this.powers.openPanel();
      },
      upgrade: (kind, direction) => this.upgrade(kind, direction),
      camera: mode => { this.viewMode = mode; this.persistSettings(); this.ui.setView(this.viewMode, this.fov, this.sensitivity); },
      fov: value => { this.fov = value; this.camera.fov = value; this.camera.updateProjectionMatrix(); this.persistSettings(); this.ui.setView(this.viewMode, this.fov, this.sensitivity); },
      sensitivity: value => { this.sensitivity = value / 100; this.persistSettings(); this.ui.setView(this.viewMode, this.fov, this.sensitivity); }
    });
    document.getElementById('game-mode-select')?.addEventListener('change',event=>this.setRpgMode((event.target as HTMLSelectElement).value as GameMode));
    document.getElementById('day-speed-select')?.addEventListener('change',event=>this.rpg.setDaySpeed(Number((event.target as HTMLSelectElement).value)));
    this.installInputs();
    this.changeState('MAIN_MENU');
    requestAnimationFrame(this.tick);
    (window as Window & { __DBRPG_DEBUG__?: () => object }).__DBRPG_DEBUG__ = () => this.debugState();
    if(import.meta.env.DEV)Object.assign(window,{__DBRPG_TEST__:{
      teleport:(x:number,z:number,y?:number)=>{this.character.root.position.set(x,y??this.world.height(x,z),z);this.horizontalVelocity.set(0,0,0);this.verticalVelocity=0;},
      look:(yaw:number,pitch=0)=>{this.yaw=yaw;this.pitch=pitch;},
      camera:()=>this.camera.position.toArray(),
      heroBounds:()=>new THREE.Box3().setFromObject(this.character.root).getSize(new THREE.Vector3()).toArray(),
      frame:()=>this.renderer.domElement.toDataURL(),
      scene:()=>this.scene,
    }});
  }

  private persistSettings(): void {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ mode: this.viewMode, fov: this.fov, sensitivity: this.sensitivity, quality:this.quality, motion:this.motion, volume:this.sound.volume, sound:this.sound.enabled })); } catch { /* storage opcional */ }
  }

  private changeState(state: GameState): void {
    this.state = state;
    this.ui.state(state);
    if(state!=='PLAYING'){this.keys.clear();this.cancelActions();}
    this.simulationClock.reset();
    if(state==='RACE_SELECTION')this.camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.18,0,innerWidth,innerHeight);else this.camera.clearViewOffset();
    if (state === 'RACE_SELECTION') this.selectRace(this.ui.selected);
    const inPlay = state === 'PLAYING';
    const first = inPlay && this.viewMode === 'first';
    const fpOk = this.character.hasFirstPersonView();
    this.character.root.visible = inPlay && (this.viewMode === 'third' || (this.viewMode === 'first' && !fpOk && this.heroReady));
    this.character.setFirstPerson(first && fpOk);
    if (state === 'DEFEATED') this.character.root.visible = false;
  }

  private overlayBlocksPause(): boolean {
    return this.blocksGameplayPointer();
  }

  private blocksGameplayPointer(): boolean {
    return this.rpgPanels.open || this.powers.isLibraryOpen() || this.powers.isCreatorOpen() || this.state === 'SKILLS' || this.state === 'SETTINGS' || this.state === 'PAUSED';
  }

  private suspendGameplayPointer(): void {
    if (document.pointerLockElement) void document.exitPointerLock();
    this.keys.clear();
    this.cancelActions();
    this.renderer.domElement.classList.add('pointer-suspended');
    document.body.classList.add('game-ui-active');
  }

  private resumeGameplayPointer(): void {
    this.renderer.domElement.classList.remove('pointer-suspended');
    document.body.classList.remove('game-ui-active');
    if (this.state === 'PLAYING' && !this.powers.isLibraryOpen() && !this.powers.isCreatorOpen()) this.requestCapture();
  }

  private selectRace(race: RaceId, applyLook = false): void {
    this.raceId = race;
    this.scene.remove(this.character.root);
    this.character.dispose();
    this.heroReady=false;
    this.character = new Character(getRace(race));
    this.character.onModelStatus(ok => {
      this.heroReady = ok;
      if (ok) this.character.mountFirstPersonView(this.scene, this.camera);
      if (!ok) this.ui.toast('NÃO FOI POSSÍVEL CARREGAR O GUERREIRO. VOLTE E TENTE NOVAMENTE.', 'danger', 8);
    });
    this.character.root.position.copy(this.world.spawn);
    if (applyLook && this.editingProfile && this.state === 'RACE_SELECTION' && this.ui.creatorStep === 1) {
      this.editingProfile.race = race;
      this.editingProfile.appearance = { ...RACE_APPEARANCE[race] };
      this.ui.editAppearance(this.editingProfile.appearance, this.editingProfile.name);
    } else if (applyLook && this.editingProfile) {
      this.editingProfile.race = race;
    }
    if (this.editingProfile) this.character.setAppearance(this.editingProfile.appearance);
    this.character.root.rotation.y = Math.PI;
    this.scene.add(this.character.root);
  }

  private async confirmStartAdventure(): Promise<void> {
    const { askOrigensHeroLaunch } = await import('../ui/origensModal');
    const result = await askOrigensHeroLaunch({
      title: 'Como se chama seu guerreiro?',
      message: 'Escolha o nome que aparecerá na jornada. Você pode mudar depois criando outro personagem.',
      defaultName: '',
      confirm: 'Jogar',
      cancel: 'Voltar',
    });
    if (!result.ok || !this.editingProfile) return;
    this.editingProfile.name = result.name;
    await this.startAdventure();
  }

  private async startAdventure(): Promise<void> {
    this.sound.play('select');
    if (!isRacePlayable(this.ui.selected)) {
      this.ui.toast(RACE_UNAVAILABLE_MSG[this.ui.selected] ?? 'Raça indisponível', 'danger', 4);
      return;
    }
    this.selectRace(this.ui.selected);
    if (!this.editingProfile) this.editingProfile = makeProfile(this.raceId);
    this.editingProfile.race = this.raceId;
    this.editingProfile.name = (this.editingProfile.name.trim() || 'Guerreiro').slice(0,28);
    this.activeProfile = structuredClone(this.editingProfile);
    const index = this.profiles.findIndex(p => p.id === this.activeProfile!.id);
    if (index >= 0) this.profiles[index] = this.activeProfile;
    else this.profiles.push(this.activeProfile);
    saveProfiles(this.profiles);
    this.rpg.load(this.activeProfile.id);
    if(this.pendingMode){this.rpg.setMode(this.pendingMode);this.pendingMode=null;}
    this.stats = createStats(getRace(this.raceId));
    this.applyProfileAttributes();
    this.stats.health=this.stats.maxHealth;
    this.stats.ki=this.stats.maxKi;
    this.stats.stamina=this.stats.maxStamina;
    this.character.root.position.copy(this.checkpointPosition());
    this.finalDummy.reset();this.guardianCycle.update(0,false);this.finalDummy.group.visible=journeyStage(this.activeProfile.progress)===5;
    this.character.root.rotation.y = 0;
    this.horizontalVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.flying = false;
    this.flyingSince = 0;
    this.powers.bind(this.activeProfile, this.profiles);
    this.powers.clearCooldowns();
    this.powers.refreshHotbar();
    this.comboStep = 0;
    this.ui.setCharge(null,0,1);
    this.dummy.reset();
    this.camera.position.copy(this.world.spawn).add(new THREE.Vector3(0, 3, 7));
    this.yaw = 0;
    this.pitch = -0.035;
    this.changeState('LOADING');
    this.ui.setLoading(16);
    const character=this.character;
    try{
      const [loaded]=await Promise.all([character.ready,this.wildlife.ready]);
      if(this.state!=='LOADING'||this.character!==character)return;
      if(!loaded)throw new Error('Hero unavailable');
      this.ui.setLoading(100);this.changeState('PLAYING');this.updateJourney(0);
      this.ui.toast('JORNADA INICIADA · SIGA SEU OBJETIVO', 'success',2.7);
    }catch(error){
      console.error('Falha ao carregar recursos do jogo',error);
      this.ui.renderProfiles(this.profiles);this.changeState('CHARACTER_SELECT');
      this.ui.toast('FALHA AO CARREGAR O JOGO. RECARREGUE A PÁGINA PARA TENTAR NOVAMENTE.','danger',8);
    }
  }

  private applyQuality():void {
    const preset=QUALITY[this.quality];this.renderer.setPixelRatio(Math.min(devicePixelRatio,preset.pixelRatio));
    this.renderer.shadowMap.enabled=preset.shadows;this.world.setQuality(this.quality==='low');
    this.camera.far=this.quality==='low'?180:this.quality==='medium'?300:650;this.camera.updateProjectionMatrix();
  }
  private checkpointPosition():THREE.Vector3 {
    const p=LANDMARKS.find(p=>p.id===this.activeProfile?.checkpoint)??LANDMARKS[0];
    const z=p.z+9;return new THREE.Vector3(p.x,this.world.height(p.x,z),z);
  }
  private cancelActions():void {
    this.cancelCharge();this.kiBlastHeld=false;this.powerPotency=0;this.powerFullToast=false;this.pendingShot=null;this.attackEnd=this.elapsed;this.rootedUntil=this.elapsed;
    this.character?.setAuraActive(false);this.fpEnergy.visible=false;
  }
  private respawn():void {
    if(this.state!=='DEFEATED')return;
    this.cancelActions();this.character.root.position.copy(this.checkpointPosition());
    this.stats.health=this.stats.maxHealth;this.stats.ki=this.stats.maxKi;this.stats.stamina=this.stats.maxStamina;
    this.horizontalVelocity.set(0,0,0);this.verticalVelocity=0;this.grounded=true;this.flying=false;
    this.changeState('PLAYING');this.requestCapture();
  }
  private updateJourney(dt:number):void {
    if(!this.activeProfile)return;
    const pos=this.character.root.position,p=this.activeProfile.progress;
    if(advanceJourney(p,dt,pos.x,pos.z,this.flying,this.world.inRiver(pos.x,pos.z)&&!this.flying)){
      if(p.snow)this.activeProfile.checkpoint='snow';else if(p.desert)this.activeProfile.checkpoint='desert';
      saveProfiles(this.profiles);this.sound.play('select');this.ui.toast('ETAPA CONCLUÍDA · NOVO OBJETIVO','success',2);
    }
    this.finalDummy.group.visible=journeyStage(p)===5;
    if(!this.finalDummy.group.visible)this.guardianWarning.visible=false;
    this.ui.journey(p,pos.x,pos.z,this.yaw,this.world.inRiver(pos.x,pos.z)&&!this.flying);
    this.saveClock+=dt;if(this.saveClock>5){this.saveClock=0;saveProfiles(this.profiles);}
  }
  private requestCapture(): void {
    if (this.blocksGameplayPointer()) return;
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
    if (panel === 'SETTINGS' && !['PLAYING','PAUSED','MAIN_MENU'].includes(this.state)) return;
    if (panel === 'SKILLS' && this.state !== 'PLAYING' && this.state !== 'PAUSED') return;
    this.beforePanel = this.state;
    this.suspendGameplayPointer();
    this.changeState(panel);
    if (panel === 'SETTINGS') {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
      this.ui.setView(this.viewMode, this.fov, this.sensitivity);
      this.ui.setDay(this.dayTime, this.dayAuto);
    }
    if (panel === 'SETTINGS') {
      const mode=document.getElementById('game-mode-select') as HTMLSelectElement|null;
      const day=document.getElementById('day-speed-select') as HTMLSelectElement|null;
      if(mode)mode.value=this.rpg.mode;
      if(day)day.value=String(this.rpg.daySpeed);
    }
    if (panel === 'SKILLS') {
      this.renderAttributes();
      this.powers.syncZeniHud();
    }
  }
  private openVenture(panel:'inventory'|'shop'):void {
    if(!this.activeProfile)return;
    this.rpgPanels.show(panel,this.activeProfile.economy.zeni);
    this.suspendGameplayPointer();
  }
  private setRpgMode(mode:GameMode):void {
    if(!['creative','survival'].includes(mode))return;
    this.rpg.setMode(mode);
    this.powers.syncZeniHud();
    this.ui.toast(mode==='creative'?'MODO CRIATIVO · TUDO LIVRE':'MODO SOBREVIVÊNCIA · RECURSOS LIMITADOS','success',2);
  }
  private onCreatureDefeated(kind:string):void {
    this.powers.onBeastKill();
    const item=this.rpg.loot(kind);
    this.ui.toast(this.rpg.creative?`✦ ${item.name.toUpperCase()} · ITEM DESCOBERTO`:`✦ +1 ${item.name.toUpperCase()} · ABRA A MOCHILA [I]`,'success',2);
  }
  private purchaseItem(id:ItemId):void {
    if(!this.activeProfile)return;
    const result=this.rpg.purchase(id,this.activeProfile.economy.zeni);
    if(result.ok){this.powers.setZeni(result.zeni);this.rpgPanels.refresh(result.zeni);}
    this.ui.toast(result.message,result.ok?'success':'info',1.8);
  }
  private sellItem(id:ItemId):void {
    if(!this.activeProfile)return;
    const result=this.rpg.sell(id,this.activeProfile.economy.zeni);
    if(result.ok){this.powers.setZeni(result.zeni);this.rpgPanels.refresh(result.zeni);}
    this.ui.toast(result.message,result.ok?'success':'info',1.8);
  }
  private claimContract():void {
    if(!this.activeProfile)return;
    const result=this.rpg.claimContract(this.activeProfile.economy.zeni);
    if(result.ok){this.powers.setZeni(result.zeni);this.rpgPanels.refresh(result.zeni);}
    this.ui.toast(result.message,result.ok?'success':'info',2);
  }
  private useItem(id:ItemId):void {
    const result=this.rpg.consume(id);
    if(result.ok){this.stats.health=Math.min(this.stats.maxHealth,this.stats.health+result.heal);this.stats.ki=Math.min(this.stats.maxKi,this.stats.ki+result.ki);this.rpgPanels.refresh(this.activeProfile?.economy.zeni??0);}
    this.ui.toast(result.message,result.ok?'success':'info',1.8);
  }

  private closePanel(): void {
    if (this.state !== 'SETTINGS' && this.state !== 'SKILLS') return;
    const backToPlay = this.beforePanel === 'PLAYING' || this.beforePanel === 'PAUSED';
    this.changeState(backToPlay ? 'PLAYING' : this.beforePanel);
    this.resumeGameplayPointer();
  }

  private spawnDamageNumber(world: THREE.Vector3, amount: number, kind: 'object' | 'creature', destroyed = false): void {
    const screen = world.clone().project(this.camera);
    if (screen.z > 1) return;
    this.ui.floatingDamage(amount, (screen.x + 1) / 2 * innerWidth, (1 - screen.y) / 2 * innerHeight, destroyed ? 'critical' : kind);
  }
  private returnToMenu(): void {
    if(this.activeProfile)saveProfiles(this.profiles);
    this.cancelCharge();
    this.kiBlastHeld = false;
    this.powerPotency = 0;
    this.powerFullToast = false;
    this.character.setAuraActive(false);
    this.ui.renderProfiles(this.profiles);
    this.activeProfile = null;
    this.editingProfile = null;
    this.selectRace('saiyajin');
    this.ui.select('saiyajin', false);
    this.changeState('MAIN_MENU');
    if (document.pointerLockElement) void document.exitPointerLock();
  }

  private createHero(): void {
    this.pendingMode=(document.getElementById('new-character-mode') as HTMLSelectElement).value==='creative'?'creative':'survival';
    if(this.profiles.length>=32){this.ui.toast('LIMITE DE 32 GUERREIROS. EXCLUA UM PERFIL PARA CRIAR OUTRO.','info',3);return;}
    this.editingProfile = makeProfile();
    this.ui.editAppearance(this.editingProfile.appearance, this.editingProfile.name);
    this.ui.select(this.editingProfile.race, false);
    this.ui.setCreatorStep(1);
    this.changeState('RACE_SELECTION');
  }

  private playHero(id: string): void {
    this.pendingMode=null;
    const profile = this.profiles.find(p => p.id === id);
    if (!profile) return;
    this.editingProfile = structuredClone(profile);
    this.ui.select(profile.race, false);
    this.startAdventure();
  }

  private async deleteHero(id: string): Promise<void> {
    const { askOrigensModal } = await import('../ui/origensModal');
    const ok = await askOrigensModal({
      title: 'Excluir guerreiro?',
      message: 'Este personagem e o progresso dele serão removidos deste navegador.',
      confirm: 'Excluir',
      cancel: 'Manter',
    });
    if (!ok) return;
    this.profiles = this.profiles.filter(p=>p.id!==id);
    saveProfiles(this.profiles);
    this.ui.renderProfiles(this.profiles);
  }

  private previewCustomization(appearance: Appearance): void {
    if (!this.editingProfile || this.state !== 'RACE_SELECTION')return;
    this.editingProfile.appearance = {...appearance};
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
    this.stats.speed=THREE.MathUtils.clamp(a.speed,.4,2.5);
    this.stats.flight=THREE.MathUtils.clamp(a.flight,.4,2.5);
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
    if(!this.rpg.creative){
      if(direction<0){this.ui.toast('NO SOBREVIVÊNCIA, A EVOLUÇÃO É PERMANENTE. USE O CRIATIVO PARA TESTAR.','info',2);return;}
      const currentMoney=this.activeProfile.economy.zeni;
      const stepIndex=Math.max(0,Math.round((old-info.min)/Math.max(.01,info.step)));
      const cost=35+Math.min(550,stepIndex*8);
      if(direction>0){if(currentMoney<cost){this.ui.toast(`PRECISA DE ${cost} ZENI PARA EVOLUIR`,'info',1.5);return;}this.activeProfile.economy.zeni-=cost;}
      this.powers.syncZeniHud();
    }
    attrs[kind]=Number((next-base).toFixed(3));
    this.applyProfileAttributes();
    if(kind==='health')this.stats.health=Math.min(this.stats.maxHealth, Math.max(1,this.stats.health+(next-old)));
    if(kind==='ki')this.stats.ki=Math.min(this.stats.maxKi,Math.max(0,this.stats.ki+(next-old)));
    if(kind==='stamina')this.stats.stamina=Math.min(this.stats.maxStamina,Math.max(0,this.stats.stamina+(next-old)));
    saveProfiles(this.profiles);
    this.renderAttributes();
    this.sound.play('select');
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
        if(this.rpgPanels.open){this.rpgPanels.close();return;}
        const about = document.getElementById('about-dialog');
        if (about && !about.classList.contains('hidden')) { about.classList.add('hidden'); return; }
        if (this.powers.isLibraryOpen()) { this.powers.closePanel(); return; }
        if (this.state === 'SETTINGS' || this.state === 'SKILLS') { this.closePanel(); return; }
        if (this.state === 'PLAYING') this.pause();
        else if (this.state === 'PAUSED') this.resume();
        else if (this.state === 'RACE_SELECTION') this.changeState('CHARACTER_SELECT');
        else if (this.state === 'CHARACTER_SELECT') this.changeState('MAIN_MENU');
        return;
      }
      if((event.code==='KeyK'&&this.powers.isLibraryOpen())||(event.code==='KeyU'&&this.state==='SKILLS')||(event.code==='KeyO'&&this.state==='SETTINGS')){if(this.powers.isLibraryOpen())this.powers.closePanel();else this.closePanel();return;}
      if (this.state !== 'PLAYING') return;
      if (event.repeat) return;
      if (this.powers.isLibraryOpen() || this.rpgPanels.open) return;
      if(event.code==='KeyI'){this.openVenture('inventory');return;}
      if(event.code==='KeyB'){
        if(this.rpg.creative||this.shop.near(this.character.root.position))this.openVenture('shop');
        else this.ui.toast('APROXIME-SE DO MERCADOR NA CLAREIRA','info',2);
        return;
      }
      if (event.code === 'KeyV') { this.viewMode = this.viewMode === 'third' ? 'first' : 'third'; this.persistSettings(); this.ui.setView(this.viewMode, this.fov, this.sensitivity); this.ui.toast(this.viewMode === 'first' ? 'VISÃO EM PRIMEIRA PESSOA' : 'VISÃO EM TERCEIRA PESSOA'); return; }
      if (event.code === 'KeyK') { if (this.state === 'PLAYING') this.powers.openPanel(); return; }
      if (event.code === 'KeyU') { this.openPanel('SKILLS'); return; }
      if (event.code === 'KeyO') { this.openPanel('SETTINGS'); return; }
      if (event.code === 'BracketLeft' || event.code === 'BracketRight') {
        this.dayTime = (this.dayTime + (event.code === 'BracketRight' ? 0.04 : -0.04) + 1) % 1;
        this.world.setDay(this.dayTime);
        this.ui.setDay(this.dayTime, this.dayAuto);
        return;
      }
      if (event.code === 'KeyX' && !event.repeat) {
        if (this.powers.heldPowerId || this.kiBlastHeld || this.pendingShot || this.flying) return;
        const aura = this.raceAuraColors();
        this.character.setAuraColor(aura.color, aura.core);
        this.character.gesture('charge');
        this.sound.play('charge');
      }
      if (/^Digit[1-6]$/.test(event.code)) {
        const slot = Number(event.code.slice(-1)) - 1;
        this.powers.selectSlot(slot);
        if (!this.powers.heldPowerId) this.powers.beginCharge(slot);
        return;
      }
      this.keys.add(event.code);
      if (event.code === 'Space') {
        const now = performance.now();
        if (now - this.lastSpaceAt <= 320) {
          if(!this.rpg.creative&&!this.flying&&this.stats.ki<8){this.ui.toast('RECUPERE KI COM X ANTES DE VOAR','info');return;}
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
      if (event.code === 'KeyX' && !this.powers.heldPowerId && !this.kiBlastHeld) this.character.setAuraActive(false);
      if (this.state === 'PLAYING' && /^Digit[1-6]$/.test(event.code) && this.powers.heldPowerId) {
        const slot = Number(event.code.slice(-1)) - 1;
        const id = this.activeProfile?.economy.loadout[slot];
        if (id && id === this.powers.heldPowerId) this.powers.releaseCharge();
      }
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.cancelActions();if(this.state==='PLAYING')this.pause(); });
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='PLAYING')this.pause();});
    document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&this.state==='PLAYING'&&!this.overlayBlocksPause())this.pause();});
    window.addEventListener('pagehide',()=>{saveProfiles(this.profiles);this.rpg.save();});
    window.addEventListener('mousemove', event => {
      if (this.state !== 'PLAYING' || this.blocksGameplayPointer()) return;
      if (document.pointerLockElement === this.renderer.domElement || event.buttons === 2) {
        this.yaw -= event.movementX * 0.0024 * this.sensitivity;
        this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0022 * this.sensitivity, -1.12, 1.22);
      }
    });
    this.renderer.domElement.addEventListener('mousedown', event => {
      if (this.state !== 'PLAYING' || this.blocksGameplayPointer()) return;
      if (document.pointerLockElement !== this.renderer.domElement) { this.requestCapture(); return; }
      if (event.button === 0) this.punch();
      if (event.button === 2) this.beginKiBlast();
    });
    window.addEventListener('mouseup', event => {
      if (event.button === 2&&this.state==='PLAYING') this.releaseKiBlast();
    });
    this.renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  private traceTargets(origin:THREE.Vector3,direction:THREE.Vector3,range:number):WorldHit {
    let hit=this.world.trace(origin,direction,range,this.dummy);
    if(this.powers.boss.active){const boss=this.world.trace(origin,direction,range,{hitCenter:this.powers.boss.hitCenter,health:this.powers.boss.health});if(boss.dummy&&boss.distance<hit.distance)hit={...boss,boss:true};}
    if(this.finalDummy.group.visible){const other=this.world.trace(origin,direction,range,this.finalDummy);if(other.dummy&&other.distance<hit.distance)return {...other,final:true};}
    return hit;
  }
  private aim():WorldHit {return this.traceTargets(this.camera.position,this.forward(),140);}

  private pickAimFocus(): { name: string; health: number; maxHealth: number; regenerating?: boolean } | null {
    const origin = this.camera.position;
    const dir = this.forward();
    const range = 95;
    const hit = this.traceTargets(origin, dir, range);
    let bestDist = range + 1;
    let focus: { name: string; health: number; maxHealth: number; regenerating?: boolean } | null = null;
    if (hit.boss && this.powers.boss.health > 0) {
      bestDist = hit.distance;
      focus = { name: 'GUARDIÃO DO TOTEM', health: this.powers.boss.health, maxHealth: this.powers.boss.maxHealth };
    } else if (hit.final && this.finalDummy.health > 0) {
      bestDist = hit.distance;
      focus = { name: 'GUARDIÃO DA AURORA', health: this.finalDummy.health, maxHealth: this.finalDummy.maxHealth };
    } else if (hit.dummy) {
      const dummy = this.dummy;
      if (dummy.health > 0) {
        bestDist = hit.distance;
        focus = { name: 'TOTEM DE TREINAMENTO', health: dummy.health, maxHealth: dummy.maxHealth };
      } else {
        bestDist = hit.distance;
        focus = { name: 'TOTEM DE TREINAMENTO', health: 0, maxHealth: dummy.maxHealth, regenerating: true };
      }
    } else if (hit.objectId !== undefined) {
      const object = this.world.getBreakable(hit.objectId);
      if (object) {
        bestDist = hit.distance;
        focus = { name: object.label, health: object.health, maxHealth: object.maxHealth };
      }
    }
    const beast = this.wildlife.aimFocus(origin, dir, range);
    if (beast && beast.distance < bestDist) {
      focus = { name: beast.label, health: beast.health, maxHealth: beast.maxHealth };
    }
    return focus;
  }

  private cancelCharge(): void {
    this.powers.cancelCharge();
    this.ui.setCharge(null,0,1);
    if (this.powerPotency < 0.02 && !this.kiBlastHeld) this.character.setAuraActive(false);
  }

  private powerMultiplier(): number {
    const race=getRace(this.raceId);
    let mult = THREE.MathUtils.clamp(.7+this.stats.power/Math.max(1,race.power)*.3,.6,12);
    if (this.powerPotency > 0.02) mult *= 1 + this.powerPotency * 0.9;
    if (this.elapsed < this.techniqueBoostUntil) mult *= this.techniqueBoostMult;
    return mult;
  }

  private raceAuraColors(): { color: number; core: number } {
    const accent = getRace(this.raceId).accent.replace('#', '');
    const color = Number.parseInt(accent, 16);
    const core = color ^ 0x303030;
    return { color, core };
  }

  private castAttack(style: AttackStyle, color: number, core: number, range: number, chargeSeconds: number, effectSeconds: number, damage: number, size=1, blastRadius=3.2): void {
    this.camera.updateMatrixWorld();
    let hit=this.aim();
    const muzzle=this.viewMode==='first'
      ?this.camera.position.clone().addScaledVector(this.forward(),1.12).add(new THREE.Vector3(0,-.18,0))
      :this.character.getMuzzleWorldPosition();
    const travel=hit.point.clone().sub(muzzle);
    let destination=travel.length()>range ? muzzle.clone().addScaledVector(travel.normalize(),range):hit.point.clone();
    const path=destination.clone().sub(muzzle);
    const pathLen=path.length();
    const pathDir=pathLen>.001?path.clone().divideScalar(pathLen):this.forward();
    const wild=this.wildlife.traceRay(muzzle,pathDir,pathLen);
    if(wild){destination=wild.point.clone();hit={...hit,point:wild.point,distance:wild.distance};}
    const obstruction=this.traceTargets(muzzle,pathDir,pathLen);
    if(obstruction.distance<pathLen-.05){hit=obstruction;destination=obstruction.point;}
    this.character.root.rotation.y=this.yaw;
    this.combat.cast(muzzle,destination,{style,color,core,chargeSeconds,effectSeconds,size,blastRadius},point=>{
      const splash = Math.round(damage * 0.5);
      const along=this.wildlife.damageAlong(muzzle,point,blastRadius,splash);
      const beast = along ?? this.wildlife.damageAt(point, splash, blastRadius);
      if (beast && beast.actual > 0) {
        this.spawnDamageNumber(beast.point, beast.actual, 'creature', beast.dead);
        if (beast.dead) this.onCreatureDefeated(beast.kind);
      }
      const objects = this.world.damageInRadius(point, blastRadius, splash);
      if (objects > 0) this.spawnDamageNumber(point, objects, 'object');
      if (this.dummy.health > 0 && this.dummy.hitCenter.distanceTo(point) < blastRadius + 1.2) {
        const r = this.dummy.takeDamage(splash);
        if (r.actual > 0) this.spawnDamageNumber(point, r.actual, 'object', r.dead);
      }
      if (this.powers.boss.active && this.powers.boss.hitCenter.distanceTo(point) < blastRadius + 2) {
        const r = this.powers.boss.takeDamage(splash);
        if (r.actual > 0) this.spawnDamageNumber(point, r.actual, 'object', r.dead);
      }
      this.applyHit(hit, destination, damage, point);
    });
  }

  private applyHit(hit: WorldHit, destination: THREE.Vector3, amount:number, point:THREE.Vector3):void {
    this.sound.play('impact');
    if(hit.point.distanceTo(destination)>.3)return;
    let result={actual:0,dead:false};
    if(hit.boss) {
      result=this.powers.boss.takeDamage(amount);
    } else if(hit.dummy) {
      result=(hit.final?this.finalDummy:this.dummy).takeDamage(amount);
      if(this.activeProfile&&result.actual>0){
        if(hit.final&&result.dead&&journeyStage(this.activeProfile.progress)===5){this.activeProfile.progress.final=true;this.ui.toast('JORNADA CONCLUÍDA · GUERREIRO DA AURORA','success',5);}
        else if(!hit.final&&journeyStage(this.activeProfile.progress)===0)this.activeProfile.progress.training=Math.min(3,this.activeProfile.progress.training+1);
        saveProfiles(this.profiles);this.updateJourney(0);
      }
    }
    else if(hit.objectId!==undefined)result=this.world.damage(hit.objectId,amount);
    if(result.actual===0)return;
    this.spawnDamageNumber(point, result.actual, 'object', result.dead);
    if(result.dead) {
      if(hit.boss) this.powers.onBossDefeated();
      else if(hit.objectId!==undefined){this.powers.onBreakableDestroyed();if(!this.rpg.creative)this.rpg.add('herbs',1);}
      if(!hit.boss) this.ui.toast('ALVO DESTRUÍDO · REAPARECERÁ EM BREVE','success');
    }
  }

  private punch():void {
    if(this.state!=='PLAYING'||this.pendingShot||this.powers.heldPowerId||this.kiBlastHeld||this.keys.has('KeyX')||this.elapsed-this.lastMelee<.38||(!this.rpg.creative&&this.stats.stamina<7))return;
    if(!this.rpg.creative)this.stats.stamina-=7;
    this.staminaRegenDelay=this.elapsed+.7;
    this.comboStep=(this.elapsed-this.lastMeleeCombo<.85?this.comboStep%3+1:1);
    this.lastMelee=this.elapsed;
    this.lastMeleeCombo=this.elapsed;
    this.character.root.rotation.y=this.yaw;
    this.attackEnd = this.elapsed + (this.comboStep === 2 ? 0.72 : 0.5);
    this.character.gesture(this.comboStep===2?'punchcross':'punch');
    this.pendingShot={at:this.elapsed+.16,run:()=>this.resolvePunch()};
  }

  private resolvePunch():void {
    const origin = this.character.getMuzzleWorldPosition().add(new THREE.Vector3(0, -0.35, 0));
    const dir = this.forward();
    const beast = this.wildlife.strike(origin, dir, 2.8, Math.round((7 + this.comboStep * 3) * this.powerMultiplier()));
    if (beast && beast.actual > 0) {
      this.spawnDamageNumber(beast.point, beast.actual, 'creature', beast.dead);
      if (beast.dead) this.onCreatureDefeated(beast.kind);
      return;
    }
    let hit = this.world.meleeTarget(origin, dir, 3.45, this.dummy);
    if (this.powers.boss.active) {
      const boss = this.world.trace(origin, dir, 3.45, { hitCenter: this.powers.boss.hitCenter, health: this.powers.boss.health });
      if (boss.dummy && boss.distance < hit.distance) hit = { ...boss, boss: true };
    }
    if (this.finalDummy.group.visible) {
      const fin = this.world.meleeTarget(origin, dir, 3.45, this.finalDummy);
      if (fin.dummy && fin.distance < hit.distance) hit = { ...fin, final: true };
    }
    if (!hit.objectId && !hit.dummy) return;
    const amount=Math.round((7+this.comboStep*3)*this.powerMultiplier());
    this.applyHit(hit,hit.point,amount,hit.point);
    this.ui.toast(`COMBO ${this.comboStep} · SOCO`, 'info',.35);
  }

  private beginKiBlast(): void {
    if(this.powers.heldPowerId||this.pendingShot||this.elapsed<this.rootedUntil)return;
    if (this.kiBlastHeld || this.elapsed - this.lastKiBall < 0.22) return;
    if (!this.rpg.creative && this.stats.ki < 4) { this.ui.toast('KI INSUFICIENTE', 'danger', .7); return; }
    this.kiBlastHeld = true;
    this.kiBlastSince = this.elapsed;
    this.character.root.rotation.y = this.yaw;
    this.attackEnd = this.elapsed + 1.2;
    this.character.gesture('charge');
    const aura = this.raceAuraColors();
    this.character.setAuraColor(aura.color, aura.core);
    this.character.setAuraActive(true, 'charge');
    this.fpEnergyMaterial.color.setHex(aura.core);
    this.fpEnergyLight.color.setHex(aura.color);
    this.sound.play('charge');
  }

  private releaseKiBlast(): void {
    if (!this.kiBlastHeld) return;
    this.kiBlastHeld = false;
    this.character.setAuraActive(false);
    const held = THREE.MathUtils.clamp(this.elapsed - this.kiBlastSince, 0, 0.85);
    const size = 0.62 + held * 0.38;
    const kiCost = 4 + Math.round(held * 8);
    if (!this.rpg.creative && !spendKi(this.stats, kiCost)) { this.ui.toast('KI INSUFICIENTE', 'danger', .7); this.attackEnd = this.elapsed; return; }
    this.lastKiBall = this.elapsed;
    this.attackEnd = this.elapsed + 0.48;
    this.rootedUntil = this.elapsed + 0.5;
    const aura = this.raceAuraColors();
    this.character.setAuraColor(aura.color, aura.core);
    this.character.gesture('kiopen');
    this.pendingShot = {
      at: this.elapsed + 0.22,
      run: () => {
        this.castAttack('orb', aura.color, aura.core, 52, 0.08, 0.42 + held * 0.12, Math.round((10 + held * 14) * this.powerMultiplier()), size);
        this.sound.play('beam');
      }
    };
  }

  private damagePlayer(amount:number,message:string):void {
    if(this.rpg.creative)return;
    const next=Math.max(0,this.stats.health-amount);
    if(next<=0){
      this.stats.health=0;
      saveProfiles(this.profiles);
      this.changeState('DEFEATED');
      if(document.pointerLockElement)void document.exitPointerLock();
      return;
    }
    this.stats.health=next;
    this.ui.toast(message,'danger',1.2);
  }

  private simulate(dt:number):void {
    this.world.update(dt);this.combat.update(dt);this.dummy.update(dt);this.finalDummy.update(dt);

      this.elapsed += dt;
      if (this.pendingShot && this.elapsed >= this.pendingShot.at) {
        const shot = this.pendingShot;
        this.pendingShot = null;
        shot.run();
      }
      this.wildlife.update(dt, this.character.root.position, amount => {
        if(this.state!=='PLAYING')return;
        this.sound.play('animal');
        this.damagePlayer(amount,'UM LOBO TE ALCANÇOU');
      });
      if(this.state!=='PLAYING')return;
      this.powers.update(dt, this.character.root.position);
      if(this.state!=='PLAYING')return;
      const guardian=this.finalDummy.group.position,player=this.character.root.position;
      const distance=Math.hypot(player.x-guardian.x,player.z-guardian.z);
      const pulse=this.guardianCycle.update(dt,this.finalDummy.group.visible&&distance<24);
      this.guardianWarning.visible=pulse.warning>0;this.guardianWarning.material.opacity=.25+pulse.warning*.65;
      if(pulse.impact){
        const origin=guardian.clone().add(new THREE.Vector3(0,1,0)),direction=player.clone().add(new THREE.Vector3(0,1,0)).sub(origin);const range=direction.length();
        const clear=range<.01||this.world.trace(origin,direction.normalize(),range).distance>=range-.3;
        this.sound.play('impact');
        if(guardianCanHit(distance,player.y-guardian.y,clear))this.damagePlayer(12,'ONDA DO GUARDIÃO · SAIA DO CÍRCULO OU VOE');
      }
      if(this.state!=='PLAYING')return;
      this.updatePlayer(dt);
      if(this.rpg.creative){this.stats.health=this.stats.maxHealth;this.stats.ki=this.stats.maxKi;this.stats.stamina=this.stats.maxStamina;}
      this.updateJourney(dt);
      this.updateCamera(dt);
      this.updateFirstPersonHands(dt);
      const chargingPower = this.keys.has('KeyX') && !this.flying && !this.powers.heldPowerId && !this.kiBlastHeld && !this.pendingShot;
      const dischargingPower = this.keys.has('KeyC');
      if (chargingPower && !dischargingPower) {
        this.powerPotency = Math.min(1, this.powerPotency + dt / 2.8);
        const aura = this.raceAuraColors();
        this.character.setAuraColor(aura.color, aura.core);
        this.character.setAuraActive(true, 'surge');
        if (this.powerPotency >= 0.99 && !this.powerFullToast) {
          this.powerFullToast = true;
          this.ui.toast('PODER MÁXIMO CARREGADO', 'success', 0.85);
        }
      } else if (dischargingPower && this.powerPotency > 0) {
        this.powerPotency = Math.max(0, this.powerPotency - dt / 1.6);
        this.powerFullToast = false;
      }
      if (this.powerPotency > 0.02 && !chargingPower) {
        this.stats.ki = Math.max(0, this.stats.ki - (2.5 + this.powerPotency * 20) * dt);
        if (this.stats.ki <= 0.5) {
          this.powerPotency = 0;
          this.powerFullToast = false;
          this.ui.toast('KI ESGOTADO · PODER DESCARREGADO', 'info', 1);
        }
      }
      if (!chargingPower && !this.powers.heldPowerId && !this.kiBlastHeld) this.character.setAuraActive(false);
      const kiRegenOk = this.elapsed > this.attackEnd + .8 && !this.powers.heldPowerId && !this.flying && !chargingPower && this.powerPotency <= 0.02;
      this.stats.ki = Math.min(this.stats.maxKi, this.stats.ki + (kiRegenOk ? this.stats.kiRegen : 0) * dt);
      if(this.elapsed>this.staminaRegenDelay)this.stats.stamina=Math.min(this.stats.maxStamina,this.stats.stamina+22*dt);
      if (this.kiBlastHeld) {
        const held = THREE.MathUtils.clamp(this.elapsed - this.kiBlastSince, 0, 0.85);
        this.ui.setCharge('BOLA DE KI', held / 0.85, 1 + held * 0.45);
      } else if (this.powers.heldPowerId) {
        const power = this.powers.powerById(this.powers.heldPowerId)!;
        const seconds = Math.min(this.maxCharge, this.elapsed - this.powers.heldSince);
        this.attackEnd = this.elapsed + 0.18;
        this.character.setAuraActive(true, 'charge');
        this.ui.setCharge(power.name.slice(0, 12).toUpperCase(), seconds / this.maxCharge, 1 + seconds / this.maxCharge * 2.2);
      } else if (!this.pendingShot) this.ui.setCharge(null, 0, 1);
      if (this.kiBlastHeld) {
        const held = THREE.MathUtils.clamp(this.elapsed - this.kiBlastSince, 0, 0.85);
        this.attackEnd = this.elapsed + 0.2;
        const pulse = 0.72 + held * 0.35 + Math.sin(this.elapsed * 18) * 0.08;
        this.fpEnergy.visible = this.viewMode === 'first';
        this.fpEnergy.scale.setScalar(pulse);
      }
      const activePower = this.powers.activePower();
      const cooldown = this.powers.activeCooldown();
      this.ui.updateHud(this.stats, cooldown, this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), this.horizontalVelocity.length(), getRace(this.raceId), activePower, this.powers.activeSlot, this.flying, this.powerPotency);
      if (this.frameCounter % 12 === 0) this.powers.refreshHotbar();
      const aimFocus = this.pickAimFocus();
      this.ui.setAimFocus(aimFocus);
      this.ui.setAimHit(Boolean(aimFocus));
      const hint=document.getElementById('venture-hint');
      if(hint&&this.frameCounter%18===0)hint.textContent=this.shop.near(this.character.root.position)?'B · FALAR COM MERCADOR  ·  I · MOCHILA':'I · MOCHILA  ·  B · LOJA PERTO DO MERCADOR';
  }

  private tick = (time:number):void => {
    const realDt=Math.max(0,(time-this.lastFrame)/1000);this.lastFrame=time;
    const dt=Math.min(.05,realDt);this.cameraTime+=dt;
    this.frameTimes.push(realDt*1000);if(this.frameTimes.length>120)this.frameTimes.shift();
    if (this.dayAuto) this.dayTime = (this.dayTime + Math.min(realDt, 0.05) * this.rpg.daySpeed / 80) % 1;
    this.shop.update(dt);
    this.world.setDay(this.dayTime);
    for(const step of this.simulationClock.advance(realDt))if(this.state==='PLAYING'&&!this.blocksGameplayPointer())this.simulate(step);
    if (this.state === 'PLAYING') this.syncCharacterVisibility();
    const pos=this.character.root.position;
    this.sound.update(Math.min(realDt,.25),this.state==='PLAYING',this.horizontalVelocity.length(),this.world.inRiver(pos.x,pos.z)&&!this.flying,this.flying,biomeAt(pos.x,pos.z),Boolean(this.powers.heldPowerId||this.keys.has('KeyX')));
    if (this.state === 'MAIN_MENU') {
      this.character.setFirstPerson(false);
      this.character.root.visible = true;
      this.character.root.rotation.y = Math.PI - Math.sin(this.cameraTime * 0.26) * 0.18;
      this.character.animate(dt, 0, false, false);
      const menuFocus = this.world.spawn.clone().add(new THREE.Vector3(6, 0, 4));
      this.wildlife.update(dt, menuFocus, () => {});
      const p = this.world.spawn;
      this.camera.position.lerp(new THREE.Vector3(p.x + 17 + Math.sin(this.cameraTime * 0.2) * 2, p.y + 8.1, p.z + 18), Math.min(1, dt * 1.1));
      this.camera.lookAt(p.x - 1.4, p.y + 1.9, p.z - 4);
    } else if (this.state === 'DEFEATED') {
      this.character.setFirstPerson(false);
      this.character.root.visible = false;
      this.fpEnergy.visible = false;
    } else if (this.state === 'RACE_SELECTION') {
      this.character.setFirstPerson(false);
      this.character.root.visible = true;
      const step = this.ui.creatorStep;
      this.character.root.rotation.y = Math.PI;
      this.character.animate(dt, 0, false, false);
      const p = this.world.spawn;
      const zoom = 1.45;
      const view = step === 3
        ? new THREE.Vector3(p.x, p.y + 1.95, p.z + 1.1 / zoom)
        : new THREE.Vector3(p.x, p.y + 1.45, p.z + 4.1 / zoom);
      this.camera.position.copy(view);
      this.camera.lookAt(p.x, p.y + (step === 3 ? 1.94 : 1.2), p.z);
    }
    this.frameCounter++;
    if (this.frameCounter % 30 === 0 && dt > 0) this.fps = Math.round(1000/(this.frameTimes.reduce((a,b)=>a+b,0)/this.frameTimes.length));
    this.ui.update();
    if (this.debug) this.debugOverlay.textContent = `DEBUG v0.4.0 · FPS ${this.fps}\nEstado: ${this.state}\nRaça: ${this.raceId}\nPosição: ${this.character.root.position.toArray().map(v => v.toFixed(1)).join(', ')}\nVisão: ${this.viewMode} FOV ${this.fov}\nVoando: ${this.flying}\nNo chão: ${this.grounded}\nKi: ${Math.round(this.stats.ki)}\nPoder: ${this.stats.power}\nSlot: ${this.powers.activeSlot + 1}\nZeni: ${this.activeProfile?.economy.zeni ?? 0} · ${this.rpg.mode} · contrato ${this.rpg.data.bounty}/3\nStamina: ${this.stats.stamina.toFixed(0)}\nObjetos destrutíveis: ${this.world.breakableCount}`;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.tick);
  };

  private updatePlayer(dt: number): void {
    const rooted = Boolean(this.powers.heldPowerId || this.kiBlastHeld || this.pendingShot || this.elapsed < this.rootedUntil);
    let inputX = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    let inputZ = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    if (rooted) { inputX = 0; inputZ = 0; }
    const tryingSprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const sprint = tryingSprint && this.stats.stamina > 10 && !this.flying;
    const inRiver = !this.flying && this.world.inRiver(this.character.root.position.x, this.character.root.position.z);
    let speed=this.flying?(tryingSprint?20:12)*this.stats.flight:(sprint?RUN_SPEED:WALK_SPEED)*this.stats.speed;
    if (inRiver) speed *= 0.78;
    const desired = new THREE.Vector3(Math.cos(this.yaw) * inputX - Math.sin(this.yaw) * inputZ, 0, -Math.sin(this.yaw) * inputX - Math.cos(this.yaw) * inputZ);
    if (desired.lengthSq() > 0.001) desired.normalize().multiplyScalar(speed);
    if (!this.rpg.creative && sprint && desired.lengthSq() > 0.25) {
      this.stats.stamina = Math.max(0, this.stats.stamina - 14 * dt);
      this.staminaRegenDelay = this.elapsed + .75;
    }
    if (this.flying && !this.rpg.creative) {
      const drain = (7 + (desired.lengthSq() > 0.25 ? 6 : 0)) * dt;
      this.stats.ki = Math.max(0, this.stats.ki - drain);
      if (this.stats.ki <= 0.4) {
        this.flying = false;
        this.ui.toast('KI ESGOTADO · VOO ENCERRADO', 'danger', 1.1);
      }
    }
    this.horizontalVelocity.lerp(desired, 1 - Math.exp(-dt * (this.grounded || this.flying ? 9 : 3.4)));
    const pos = this.character.root.position;
    const nextX = pos.x + this.horizontalVelocity.x * dt;
    const nextZ = pos.z + this.horizontalVelocity.z * dt;
    if (this.flying ? this.world.canFly(nextX,pos.y,pos.z) : this.world.isWalkable(nextX, pos.z)) pos.x = nextX;
    else this.horizontalVelocity.x = 0;
    if (this.flying ? this.world.canFly(pos.x,pos.y,nextZ) : this.world.isWalkable(pos.x, nextZ)) pos.z = nextZ;
    else this.horizontalVelocity.z = 0;
    if (!this.flying) {
      const pushed = this.world.pushOut(pos.x, pos.z);
      pos.x = pushed.x;
      pos.z = pushed.z;
    }
    const ground = this.world.height(pos.x, pos.z);
    pos.x=THREE.MathUtils.clamp(pos.x,-WORLD_HALF+4,WORLD_HALF-4);pos.z=THREE.MathUtils.clamp(pos.z,-WORLD_HALF+4,WORLD_HALF-4);
    const inWater = !this.flying && this.world.inRiver(pos.x, pos.z);
    const swimSurface = this.world.waterLevel(pos.x, pos.z) + 0.12 - this.character.getHeadHeight();
    const swimming = inWater && pos.y <= swimSurface + 0.22;
    if (swimming !== this.wasSwimming) {
      this.world.splash(pos.x, pos.z);
      this.sound.play('water');
      this.wasSwimming = swimming;
    }
    this.splashClock += dt;
    if (swimming && this.splashClock > 0.45 && this.horizontalVelocity.length() > 0.1) {
      this.splashClock = 0;
      this.world.splash(pos.x, pos.z);
    }
    if (swimming) {
      pos.y = THREE.MathUtils.damp(pos.y, swimSurface, 14, dt);
      this.verticalVelocity = 0;
      this.grounded = false;
    } else if (this.flying) {
      const up = rooted ? 0 : Number(this.keys.has('Space')) - Number(this.keys.has('ControlLeft') || this.keys.has('ControlRight'));
      const desiredY = up * (tryingSprint ? 11 : 7.5)*this.stats.flight;
      this.verticalVelocity = THREE.MathUtils.damp(this.verticalVelocity, desiredY, 6, dt);
      pos.y = THREE.MathUtils.clamp(pos.y + this.verticalVelocity * dt,ground+.18,90);
      if(up<0&&pos.y<=ground+.3){this.flying=false;this.grounded=true;pos.y=ground;this.verticalVelocity=0;this.sound.play('land');}
      this.grounded = !this.flying;
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
    if (!this.flying && !this.grounded && !swimming) {
      this.verticalVelocity -= GRAVITY * dt;
      pos.y += this.verticalVelocity * dt;
      if (inWater && pos.y > swimSurface + 0.22) {
        this.grounded = false;
      } else if (pos.y <= ground) {
        if (this.verticalVelocity < -3) this.sound.play('land');
        pos.y = ground;
        this.grounded = true;
        this.verticalVelocity = 0;
      }
    }
    const move = this.horizontalVelocity.length();
    const oldYaw=this.character.root.rotation.y;
    if(this.lastMove>2&&move<2&&this.flying)this.brakingUntil=this.elapsed+.45;
    this.lastMove=move;
    if (rooted || (this.viewMode === 'first' && this.heroReady)) this.character.root.rotation.y = this.yaw;
    else if (move > 0.25 && this.elapsed >= this.attackEnd) {
      const angle = Math.atan2(-this.horizontalVelocity.x, -this.horizontalVelocity.z);
      this.character.root.rotation.y = smoothAngle(this.character.root.rotation.y, angle, Math.min(1, dt * 13));
    }
    const flightPhase = !this.flying ? 'ground' : this.elapsed - this.flyingSince < 0.9 ? 'takeoff' : this.elapsed<this.brakingUntil?'brake':move>2?'cruise':'hover';
    if (this.grounded && !swimming && !this.flying && move > 0.35) {
      const groundY = this.world.height(pos.x, pos.z);
      this.footsteps.step(biomeAt(pos.x, pos.z), pos.x, groundY, pos.z, move, sprint);
    }
    this.footsteps.update(dt);
    const flightPush = this.flying && tryingSprint;
    this.character.animate(dt, move, !this.grounded && !swimming, this.elapsed < this.attackEnd, this.flying, sprint || flightPush, flightPhase, 'kamehameha', swimming, Boolean(this.powers.heldPowerId || this.kiBlastHeld || this.keys.has('KeyX')),Math.atan2(Math.sin(this.character.root.rotation.y-oldYaw),Math.cos(this.character.root.rotation.y-oldYaw))*3,this.verticalVelocity);
  }

  private syncCharacterVisibility(): void {
    const inPlay = this.state === 'PLAYING';
    const wantFirst = inPlay && this.viewMode === 'first' && this.heroReady;
    const fpOk = this.character.hasFirstPersonView();
    this.character.setFirstPerson(wantFirst && fpOk);
    this.character.root.visible = inPlay && (this.viewMode === 'third' || (this.viewMode === 'first' && !fpOk && this.heroReady));
  }

  private updateCamera(dt: number): void {
    const origin = this.character.root.position;
    const forward = this.forward();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const head = origin.clone().add(new THREE.Vector3(0, this.flying ? 1.9 : 1.75, 0));
    const eye = new THREE.Vector3();
    const eyesReady = this.viewMode === 'first' && this.heroReady && this.character.copyEye(eye);
    if (this.viewMode === 'first' && this.heroReady) {
      const chest = origin.clone().add(new THREE.Vector3(0, 1.28, 0)).addScaledVector(forward, 0.2);
      this.character.clipPlane.setFromNormalAndCoplanarPoint(forward, chest);
    }
    const desired = eyesReady
      ? head.clone().lerp(eye,this.motion*.35).addScaledVector(forward, .19)
      : this.viewMode === 'first'
      ? head.clone().addScaledVector(forward, 0.19)
      : head.clone().addScaledVector(forward, -5.8).addScaledVector(right, 0.85).add(new THREE.Vector3(0, 0.55, 0));
    if(this.viewMode==='third'){const safe=resolveCamera(this.world,head,desired);desired.copy(safe);if(this.camera.position.distanceTo(head)>safe.distanceTo(head))this.camera.position.copy(safe);}
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * (eyesReady ? 22 : 16)));
    this.camera.lookAt(this.camera.position.clone().addScaledVector(forward, 25));
    this.syncCharacterVisibility();
  }

  private buildFirstPersonHands(): void {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), this.fpEnergyMaterial);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 14), new THREE.MeshBasicMaterial({ color: 0x43bfff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.014, 7, 30), this.fpEnergyMaterial.clone());
    ring.position.z = -0.07;
    const orbitA=new THREE.Mesh(new THREE.TorusGeometry(.34,.012,10,48),this.fpEnergyMaterial.clone());
    orbitA.rotation.x=Math.PI/3;orbitA.rotation.y=Math.PI/5;
    const orbitB=new THREE.Mesh(new THREE.TorusGeometry(.41,.008,10,48),this.fpEnergyMaterial.clone());
    orbitB.rotation.y=Math.PI/2.8;
    this.fpEnergy.add(core,halo,ring,orbitA,orbitB,this.fpEnergyLight);
    for(let i=0;i<14;i++){
      const spark=new THREE.Mesh(new THREE.TetrahedronGeometry(.018+(i%3)*.008),this.fpEnergyMaterial.clone());
      const angle=i*2.39996;
      spark.position.set(Math.cos(angle)*(.28+i%3*.05),Math.sin(angle)*(.23+i%4*.04),(i%5-2)*.05);
      this.fpEnergy.add(spark);
    }
    this.fpEnergy.position.set(0.16, -0.18, -0.72);
    this.fpEnergy.visible = false;
    this.camera.add(this.fpEnergy);
  }

  private updateFirstPersonHands(dt: number): void {
    const first = this.viewMode === 'first' && this.state === 'PLAYING' && this.heroReady;
    const melee=this.elapsed-this.lastMelee<.27;
    const blast=this.kiBlastHeld || this.elapsed-this.lastKiBall<.35 || Boolean(this.powers.heldPowerId);
    const attacking=this.elapsed < this.attackEnd;
    this.fpEnergy.visible = first && blast && !melee;
    if (!first) return;
    if (attacking) {
      const blink = 0.75 + Math.sin(this.elapsed * 24) * 0.15;
      this.fpEnergy.scale.setScalar(blink);
      this.fpEnergy.rotation.z += dt * 2.0;
      this.fpEnergy.rotation.y += dt * .6;
      this.fpEnergyLight.intensity = 3.4;
    } else this.fpEnergyLight.intensity = 0;
  }

  private debugState(): object {
    return { state: this.state, heroReady: this.heroReady, hero: this.activeProfile?.name, charging: this.powers.heldPowerId, race: this.raceId, stats: { ...this.stats }, position: this.character.root.position.toArray(), speed: this.horizontalVelocity.length(), ground: this.grounded, flying: this.flying, mode: this.viewMode, activePower: this.powers.activePower()?.id, zeni: this.activeProfile?.economy.zeni, dummyHealth: this.dummy.health, beams: this.combat.activeCount, breakables: this.world.breakableCount, progress:this.activeProfile?.progress, biome:biomeAt(this.character.root.position.x,this.character.root.position.z), wildlife:this.wildlife.debug(), render:this.renderer.info.render, quality:this.quality, animation:this.character.debugAnimation() };
  }
}
