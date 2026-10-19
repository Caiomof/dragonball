import {JOURNEY_STEPS, journeyStage, journeyTarget, type JourneyProgress} from '../systems/Journey';
import {regionLabel} from '../world/landscape';
import type {Quality} from '../systems/Settings';
import type { CustomPower } from '../data/powers';
import { powerStats } from '../data/powers';
import { RACES, RACE_UNAVAILABLE_MSG, isRacePlayable } from '../data/gameConfig';
import { ATTRIBUTE_INFO, RACE_APPEARANCE, type AttributeKey, type Appearance, type PlayerProfile } from '../data/profiles';
import { mountCreatorFaceGalleries } from './creatorFaceUi';
import type { FighterStats, GameState, Race, RaceId } from '../data/gameConfig';

const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`UI não encontrada: ${id}`);
  return found as T;
};

export type UiCallbacks = { start(): void; preview(id: RaceId): void; confirm(): void; back(): void; pause(): void; resume(): void; exit(): void; sound(): void; settings(): void; settingsClose(): void; skills(): void; skillsClose(): void; powers(): void; upgrade(type: AttributeKey, direction: number): void; heroCreate(): void; heroSelect(id: string): void; heroDelete(id: string): void; respawn():void; quality(value:Quality):void; volume(value:number):void; motion(value:number):void; heroBack(): void; customize(appearance: Appearance): void; camera(mode: 'first' | 'third'): void; fov(value: number): void; sensitivity(value: number): void; day(value: number): void; dayAuto(enabled: boolean): void };

function mixHex(picked: string, base: string, towardBase = 0.7): string {
  const channel = (hex: string, index: number) => Number.parseInt(hex.slice(index, index + 2), 16);
  const mixed = [1, 3, 5].map(index => Math.round(channel(picked, index) * (1 - towardBase) + channel(base, index) * towardBase));
  return `#${mixed.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export class Ui {
  selected: RaceId = 'saiyajin';
  creatorStep: 1 | 2 | 3 = 1;
  private readonly main = element('main-menu');
  private readonly races = element('race-screen');
  private readonly characters = element('character-screen');
  private readonly loading = element('loading-screen');
  private readonly hud = element('play-hud');
  private readonly pause = element('pause-screen');
  setAimFocus(target: { name: string; health: number; maxHealth: number; regenerating?: boolean } | null): void {
    if (!target) {
      this.target.classList.add('hidden');
      return;
    }
    this.target.classList.remove('hidden', 'destroyed');
    this.target.querySelector('.target-name')!.textContent = target.name;
    const pct = target.maxHealth > 0 ? Math.max(0, target.health / target.maxHealth * 100) : 0;
    element('target-health-fill').style.width = `${pct}%`;
    element('target-health-label').textContent = target.regenerating ? 'REGENERANDO…' : `${Math.ceil(target.health)} / ${target.maxHealth}`;
    this.target.classList.toggle('destroyed', Boolean(target.regenerating));
  }
  private readonly target = element('target-indicator');
  private readonly toastElement = element('toast');
  private toastDeadline = 0;
  private readonly settings = element('settings-screen');
  private readonly skills = element('skills-screen');
  private callbacks: UiCallbacks | null = null;

  constructor() {
    const options = element('race-options');
    options.innerHTML = RACES.map((race, index) => {
      const blocked = !isRacePlayable(race.id);
      const selected = index === 0 && isRacePlayable('saiyajin');
      return `<button type="button" class="race-option ${selected ? 'selected' : ''} ${blocked ? 'race-option--disabled' : ''}" data-race="${race.id}" ${blocked ? 'disabled aria-disabled="true"' : 'role="radio"'} aria-checked="${selected}">
        <span class="race-option-symbol" style="--item-color:${race.accent}">${race.symbol}</span>
        <span class="race-option-text"><strong>${race.name.toUpperCase()}</strong><small>${blocked ? RACE_UNAVAILABLE_MSG[race.id] : race.title}</small></span>
        <span class="race-option-arrow">${blocked ? '—' : '↗'}</span>
      </button>`;
    }).join('');
    options.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-race]');
      if (!target || target.classList.contains('race-option--disabled')) return;
      this.select(target.dataset.race as RaceId);
    });
    this.select('saiyajin', false);
    element('start-button').addEventListener('click', () => this.callbacks?.start());
    element('character-create').addEventListener('click', () => this.callbacks?.heroCreate());
    element('character-back').addEventListener('click', () => this.callbacks?.heroBack());
    element('character-list').addEventListener('click',(event) => {
      const target=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-character]');
      if (!target) return;
      if(target.dataset.delete) this.callbacks?.heroDelete(target.dataset.character!);
      else this.callbacks?.heroSelect(target.dataset.character!);
    });
    for (const id of ['hero-height','hero-build','hero-hair','hero-beard','hero-beard-style','hero-eye','hero-pupil','hero-haircolor','hero-beardcolor','hero-outfit']) {
      element(id).addEventListener('input', () => this.emitAppearance());
    }
    const pickGallery = (event: Event, attr: string, selectId: string) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(`[${attr}]`);
      if (!button) return;
      const value = button.getAttribute(attr) ?? '0';
      element<HTMLSelectElement>(selectId).value = value;
      this.emitAppearance();
    };
    element('hair-gallery').addEventListener('click', event => pickGallery(event, 'data-hair-style', 'hero-hair'));
    element('beard-gallery').addEventListener('click', event => pickGallery(event, 'data-beard-style', 'hero-beard-style'));
    element('outfit-gallery').addEventListener('click', event => pickGallery(event, 'data-outfit-style', 'hero-outfit'));
    element('attribute-editor').addEventListener('click', (event)=>{
      const target=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-attr]');
      if(target) this.callbacks?.upgrade(target.dataset.attr as AttributeKey, Number(target.dataset.direction));
    });
    element('race-back').addEventListener('click', () => {
      if (this.creatorStep > 1) this.setCreatorStep((this.creatorStep - 1) as 1 | 2 | 3);
      else this.callbacks?.back();
    });
    element('creator-next').addEventListener('click', () => {
      if (this.creatorStep < 3) this.setCreatorStep((this.creatorStep + 1) as 1 | 2 | 3);
    });
    element('race-confirm').addEventListener('click', () => this.callbacks?.confirm());
    element('respawn-button').addEventListener('click',()=>this.callbacks?.respawn());
    element('quality-select').addEventListener('change',e=>this.callbacks?.quality((e.target as HTMLSelectElement).value as Quality));
    element('volume-slider').addEventListener('input',e=>this.callbacks?.volume(Number((e.target as HTMLInputElement).value)/100));
    element('motion-slider').addEventListener('input',e=>this.callbacks?.motion(Number((e.target as HTMLInputElement).value)/100));
    element('resume-button').addEventListener('click', () => this.callbacks?.resume());
    element('exit-to-menu').addEventListener('click', () => this.callbacks?.exit());
    element('sound-toggle').addEventListener('click', () => this.callbacks?.sound());
    document.getElementById('settings-main')?.addEventListener('click', () => this.callbacks?.settings());
    element('open-settings').addEventListener('click', () => this.callbacks?.settings());
    element('settings-close').addEventListener('click', () => this.callbacks?.settingsClose());
    document.getElementById('open-skills')?.addEventListener('click', () => this.callbacks?.skills());
    document.getElementById('sound-settings')?.addEventListener('click', () => this.callbacks?.sound());
    document.querySelectorAll<HTMLButtonElement>('[data-settings-tab]').forEach(button => {
      button.addEventListener('click', () => this.showSettingsTab(button.dataset.settingsTab || 'camera'));
    });
    element('skills-close').addEventListener('click', () => this.callbacks?.skillsClose());
    element('camera-first').addEventListener('click', () => this.callbacks?.camera('first'));
    element('camera-third').addEventListener('click', () => this.callbacks?.camera('third'));
    element<HTMLInputElement>('fov-slider').addEventListener('input', (event) => this.callbacks?.fov(Number((event.target as HTMLInputElement).value)));
    element<HTMLInputElement>('mouse-slider').addEventListener('input', (event) => this.callbacks?.sensitivity(Number((event.target as HTMLInputElement).value)));
    element<HTMLInputElement>('day-slider').addEventListener('input', (event) => {
      const value = Number((event.target as HTMLInputElement).value) / 100;
      this.paintDay(value);
      this.callbacks?.day(value);
    });
    element<HTMLInputElement>('day-auto').addEventListener('change', (event) => this.callbacks?.dayAuto((event.target as HTMLInputElement).checked));

    element('about-button').addEventListener('click', () => element('about-dialog').classList.remove('hidden'));
    element('about-close').addEventListener('click', () => element('about-dialog').classList.add('hidden'));
    element('about-ok').addEventListener('click', () => element('about-dialog').classList.add('hidden'));
  }

  on(callbacks: UiCallbacks): void { this.callbacks = callbacks; }

  private emitAppearance(): void {
    const hair = element<HTMLSelectElement>('hero-hair').value;
    const beard = element<HTMLSelectElement>('hero-beard-style').value;
    const outfit = element<HTMLSelectElement>('hero-outfit').value;
    document.querySelectorAll<HTMLButtonElement>('[data-hair-style]').forEach(button => button.classList.toggle('selected', button.dataset.hairStyle === hair));
    document.querySelectorAll<HTMLButtonElement>('[data-beard-style]').forEach(button => button.classList.toggle('selected', button.dataset.beardStyle === beard));
    document.querySelectorAll<HTMLButtonElement>('[data-outfit-style]').forEach(button => button.classList.toggle('selected', button.dataset.outfitStyle === outfit));
    const appearance: Appearance = {
      height: Number(element<HTMLInputElement>('hero-height').value)/100,
      build: Number(element<HTMLInputElement>('hero-build').value)/100,
      hair: Number(hair),
      beardStyle: Number(beard),
      beard: Number(beard) > 0,
      eyeColor: element<HTMLInputElement>('hero-eye').value,
      pupilColor: element<HTMLInputElement>('hero-pupil').value,
      hairColor: element<HTMLInputElement>('hero-haircolor').value,
      beardColor: element<HTMLInputElement>('hero-beardcolor').value,
      outfit: Number(outfit)
    };
    element('height-number').textContent=`${Math.round(appearance.height*100)}%`;
    element('build-number').textContent=`${Math.round(appearance.build*100)}%`;
    element('beard-color-block').classList.toggle('hidden', appearance.beardStyle <= 0);
    this.paintEyePreview(appearance.eyeColor, appearance.pupilColor);
    this.callbacks?.customize(appearance);
  }

  editAppearance(appearance: Appearance, _name: string): void {
    element<HTMLInputElement>('hero-height').value=String(Math.round(appearance.height*100));
    element<HTMLInputElement>('hero-build').value=String(Math.round(appearance.build*100));
    element<HTMLSelectElement>('hero-hair').value=String(appearance.hair);
    element<HTMLSelectElement>('hero-beard-style').value=String(appearance.beardStyle ?? (appearance.beard ? 1 : 0));
    element<HTMLInputElement>('hero-beard').checked=appearance.beard;
    element<HTMLInputElement>('hero-eye').value=appearance.eyeColor;
    element<HTMLInputElement>('hero-pupil').value=appearance.pupilColor ?? appearance.eyeColor;
    element<HTMLInputElement>('hero-haircolor').value=appearance.hairColor;
    element<HTMLInputElement>('hero-beardcolor').value=appearance.beardColor ?? appearance.hairColor;
    element<HTMLSelectElement>('hero-outfit').value=String(appearance.outfit ?? 0);
    mountCreatorFaceGalleries(appearance.hair, appearance.beardStyle ?? (appearance.beard ? 1 : 0), appearance.outfit ?? 0);
    element('height-number').textContent=`${Math.round(appearance.height*100)}%`;
    element('build-number').textContent=`${Math.round(appearance.build*100)}%`;
    element('beard-color-block').classList.toggle('hidden', (appearance.beardStyle ?? 0) <= 0);
    this.paintEyePreview(appearance.eyeColor, appearance.pupilColor ?? appearance.eyeColor);
  }

  renderProfiles(profiles: PlayerProfile[]): void {
    const escape=(text:string)=>text.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    element('character-list').innerHTML=profiles.length ? profiles.map(p=>{
      const race=RACES.find(r=>r.id===p.race)??RACES[0];
      return `<article class="character-slot" style="--item-color:${race.accent}"><span class="profile-glyph">${race.symbol}</span><div><strong>${escape(p.name)}</strong><small>${race.name} · Poder ${race.power+p.attributes.power}</small></div><button class="profile-play" data-character="${p.id}" type="button">JOGAR →</button><button class="profile-delete" data-character="${p.id}" data-delete="1" type="button" title="Excluir personagem">✕</button></article>`;
    }).join(''):'<p class="empty-profiles">Nenhum guerreiro criado ainda. O mundo espera por você.</p>';
  }

  renderAttributes(values: Record<AttributeKey, number>): void {
    element('attribute-editor').innerHTML=ATTRIBUTE_INFO.map(attr=>`<div class="attribute-row"><div><strong>${attr.label}</strong><small>${attr.desc}</small></div><button type="button" data-attr="${attr.id}" data-direction="-1">−</button><b>${Number(values[attr.id].toFixed(2))}${['speed','flight'].includes(attr.id)?'×':''}</b><button type="button" data-attr="${attr.id}" data-direction="1">+</button></div>`).join('');
  }

  setCharge(skill: string | null, progress: number, multiplier: number): void {
    element('charge-ui').classList.toggle('hidden', !skill);
    if (!skill)return;
    element('charge-label').textContent=`CARREGANDO · ${skill.toUpperCase()}`;
    element('charge-fill').style.width=`${Math.min(100,progress*100)}%`;
    element('charge-power').textContent=`${multiplier.toFixed(1)}× PODER`;
  }

  setDay(value: number, auto: boolean): void {
    element<HTMLInputElement>('day-slider').value = String(Math.round(value * 100));
    element<HTMLInputElement>('day-auto').checked = auto;
    this.paintDay(value);
  }

  private paintDay(value: number): void {
    const label = value < 0.18 ? 'NOITE' : value < 0.32 ? 'AMANHECER' : value < 0.68 ? 'DIA' : value < 0.82 ? 'ENTARDECER' : 'NOITE';
    element('day-value').textContent = label;
  }

  showModelNotice(): void {
    element('preview-trait').textContent='MODELO INTERNO · CARREGAMENTO 3D';
  }

  select(id: RaceId, notify = true): void {
    if (!isRacePlayable(id)) return;
    this.selected = id;
    const race = RACES.find((r) => r.id === id) ?? RACES[0];
    document.documentElement.style.setProperty('--race-accent', race.accent);
    for (const button of document.querySelectorAll<HTMLElement>('[data-race]')) {
      const active = button.dataset.race === id;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-checked', String(active));
    }
    element('preview-name').textContent = race.name.toUpperCase();
    element('preview-trait').textContent = race.trait.toUpperCase();
    element('race-stat-rows').innerHTML = [
      ['PODER DE LUTA', race.power, 15, 'power'],
      ['VIDA MÁXIMA', race.health, 150, 'health'],
      ['ENERGIA KI', race.ki, 150, 'ki']
    ].map(([label, value, max, color]) => `<div class="stat-row"><span>${label}</span><b>${value}</b><div class="stat-track"><i class="${color}" style="width:${Math.round(Number(value) / Number(max) * 100)}%"></i></div></div>`).join('');
    const human=id==='saiyajin'||id==='terraqueo';
    document.querySelectorAll<HTMLElement>('[data-human-only]').forEach(node => node.classList.toggle('hidden', !human));
    element('hair-swatches').classList.toggle('hidden', !human);
    this.paintSwatches();
    if (notify) this.callbacks?.preview(id);
  }

  setCreatorStep(step: 1 | 2 | 3): void {
    this.creatorStep = step;
    this.races.dataset.step=String(step);
    element('step-race').classList.toggle('hidden', step !== 1);
    element('step-body').classList.toggle('hidden', step !== 2);
    element('step-face').classList.toggle('hidden', step !== 3);
    element('creator-next').classList.toggle('hidden', step === 3);
    element('race-confirm').classList.toggle('hidden', step !== 3);
    if (step === 3) {
      const hair = Number(element<HTMLSelectElement>('hero-hair').value);
      const beard = Number(element<HTMLSelectElement>('hero-beard-style').value);
      const outfit = Number(element<HTMLSelectElement>('hero-outfit').value);
      mountCreatorFaceGalleries(hair, beard, outfit);
      this.emitAppearance();
    }
    const stages = ['ETAPA 01 / RAÇA', 'ETAPA 02 / CORPO', 'ETAPA 03 / ROSTO'];
    const titles = ['ESCOLHA<br /><em>SUA RAÇA.</em>', 'AJUSTE<br /><em>O CORPO.</em>', 'AJUSTE<br /><em>O ROSTO.</em>'];
    element('creator-stage').textContent = stages[step - 1];
    element('creator-title').innerHTML = titles[step - 1];
  }

  private showSettingsTab(name: string): void {
    document.querySelectorAll<HTMLButtonElement>('[data-settings-tab]').forEach(button => {
      const on = button.dataset.settingsTab === name;
      button.classList.toggle('selected', on);
      button.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll<HTMLElement>('[data-settings-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.settingsPanel !== name));
  }

  private paintSwatches(): void {
    const base = RACE_APPEARANCE[this.selected];
    const eyes = [base.eyeColor, mixHex('#88c8ff', base.eyeColor, 0.55), mixHex('#c4552a', base.eyeColor, 0.62)];
    const pupils = [base.pupilColor, mixHex('#1a2838', base.pupilColor, 0.45), mixHex('#5a3040', base.pupilColor, 0.5)];
    const hairs = [base.hairColor, mixHex('#f2e2a0', base.hairColor, 0.62), mixHex('#1a1a1a', base.hairColor, 0.55)];
    const beards = [base.beardColor ?? base.hairColor, mixHex('#c8a882', base.beardColor ?? base.hairColor, 0.55), mixHex('#2a1810', base.beardColor ?? base.hairColor, 0.45)];
    const fill = (id: string, colors: string[], inputId: string) => {
      element(id).innerHTML = colors.map(color => `<button type="button" class="swatch" aria-label="Cor ${color}" data-input="${inputId}" data-color="${color}" style="background:${color}"></button>`).join('');
    };
    fill('eye-swatches', eyes, 'hero-eye');
    fill('pupil-swatches', pupils, 'hero-pupil');
    fill('hair-swatches', hairs, 'hero-haircolor');
    fill('beard-swatches', beards, 'hero-beardcolor');
    element('eye-swatches').querySelectorAll<HTMLButtonElement>('.swatch').forEach(button => button.addEventListener('click', () => this.pickSwatch(button)));
    element('pupil-swatches').querySelectorAll<HTMLButtonElement>('.swatch').forEach(button => button.addEventListener('click', () => this.pickSwatch(button)));
    element('hair-swatches').querySelectorAll<HTMLButtonElement>('.swatch').forEach(button => button.addEventListener('click', () => this.pickSwatch(button)));
    element('beard-swatches').querySelectorAll<HTMLButtonElement>('.swatch').forEach(button => button.addEventListener('click', () => this.pickSwatch(button)));
  }

  private pickSwatch(button: HTMLButtonElement): void {
    const input = element<HTMLInputElement>(button.dataset.input || 'hero-eye');
    input.value = button.dataset.color || input.value;
    this.emitAppearance();
  }

  private paintEyePreview(iris: string, pupil: string): void {
    const preview = document.getElementById('eye-preview');
    if (!preview) return;
    preview.style.setProperty('--eye-iris', iris);
    preview.style.setProperty('--eye-pupil', pupil);
  }

  state(state: GameState): void {
    const views: [HTMLElement, GameState][] = [[this.main, 'MAIN_MENU'], [this.characters, 'CHARACTER_SELECT'], [this.races, 'RACE_SELECTION'], [this.loading, 'LOADING'], [this.hud, 'PLAYING'], [this.pause, 'PAUSED'], [element('defeat-screen'),'DEFEATED']];
    for (const [screen, name] of views) screen.classList.toggle('hidden', state !== name);
    element('topline').classList.toggle('hidden', state === 'PLAYING' || state === 'PAUSED' || state === 'LOADING' || state === 'DEFEATED');
    element('defeat-screen').classList.toggle('defeat-screen--solo', state === 'DEFEATED');
    element('ui-root').dataset.state = state;
    if (['PAUSED', 'SKILLS'].includes(state)) this.hud.classList.remove('hidden');
    this.settings.classList.toggle('hidden', state !== 'SETTINGS');
    this.skills.classList.toggle('hidden', state !== 'SKILLS');
  }

  settingsValues(quality:Quality,volume:number,motion:number):void {element<HTMLSelectElement>('quality-select').value=quality;element<HTMLInputElement>('volume-slider').value=String(volume*100);element<HTMLInputElement>('motion-slider').value=String(motion*100);}
  journey(p:JourneyProgress,x:number,z:number,yaw:number,swimming:boolean):void {
    const stage=journeyStage(p),step=JOURNEY_STEPS[stage],target=journeyTarget(p);
    element('journey-title').textContent=step[0];element('journey-hint').textContent=step[1];
    element('journey-count').textContent=stage===6?'EXPLORAÇÃO LIVRE':`JORNADA · ${stage+1} / 6`;
    element<HTMLProgressElement>('journey-progress').value=stage;
    const d=Math.hypot(target.x-x,target.z-z),angle=Math.atan2(-(target.x-x),-(target.z-z))-yaw;
    element('journey-direction').textContent=stage===6?'✦ Todos os santuários descobertos':stage===1?`${Math.floor(p.flight)} / 6 s no ar`:stage===2?`Lago · ${Math.round(d)} m · ${Math.floor(p.swim)} / 4 s na água`:stage===0?`${p.training} / 3 golpes · ${Math.round(d)} m até o totem`:`${Math.sin(angle)>.35?'←':Math.sin(angle)<-.35?'→':Math.cos(angle)<0?'↓':'↑'} ${target.name} · ${Math.round(d)} m`;
    element('region-name').textContent=regionLabel(x,z);element('region-surface').textContent=swimming?'ÁGUA · NATAÇÃO':'EXPLORAÇÃO · '+(stage===6?'JORNADA CONCLUÍDA':'SIGA OS SANTUÁRIOS');
  }

  setLoading(percent: number): void { element('loading-progress').style.width = `${percent}%`; }

  updateHud(stats: FighterStats, abilityReadyIn: number, sprinting: boolean, movingSpeed: number, race: Race, activePower: CustomPower | null, activeSlot: number, flying = false, powerPotency = 0): void {
    element('hud-race').textContent = race.name.toUpperCase();
    element('hud-power').textContent = String(stats.power);
    element('hud-health-label').textContent = `${Math.ceil(stats.health)} / ${stats.maxHealth}`;
    element('hud-health-fill').style.width = `${Math.max(0, stats.health / stats.maxHealth * 100)}%`;
    element('hud-ki-label').textContent = `${Math.ceil(stats.ki)} / ${stats.maxKi}`;
    element('hud-ki-fill').style.width = `${Math.max(0, stats.ki / stats.maxKi * 100)}%`;
    element('hud-stamina-label').textContent = `${Math.ceil(stats.stamina)} / ${stats.maxStamina}`;
    element('hud-stamina-fill').style.width = `${Math.max(0, stats.stamina / stats.maxStamina * 100)}%`;
    const potency = Math.min(1, Math.max(0, powerPotency));
    const mult = 1 + potency * 0.9;
    element('hud-potency-label').textContent = `${Math.round(potency * 100)}% · ${mult.toFixed(1)}×`;
    element('hud-potency-fill').style.width = `${potency * 100}%`;
    const statsDef = activePower ? powerStats(activePower) : null;
    element('flight-indicator').classList.toggle('hidden', !flying);
    const color = activePower?.color ?? '#5ec8ff';
    element('ability-orb').style.setProperty('--ability-color', color);
    element('ability-symbol').textContent = activePower?.symbol ?? '✦';
    element('ability-name').textContent = activePower?.name?.toUpperCase() ?? 'VAZIO';
    element('ability-slot-key').textContent = String(activeSlot + 1);
    const ability = element('ability-orb');
    const cdMax = statsDef?.cooldown ?? 1;
    ability.style.setProperty('--cooldown', `${Math.round(Math.max(0, 1 - abilityReadyIn / cdMax) * 100)}%`);
    const abilityText = element('ability-status');
    const kiNeed = statsDef?.kiCost ?? 0;
    abilityText.textContent = !activePower ? 'K BIBLIOTECA · U HABILIDADES' : abilityReadyIn > 0 ? `RECARGA · ${abilityReadyIn.toFixed(1)}s` : stats.ki < kiNeed ? 'KI INSUFICIENTE' : `SEGURE ${activeSlot + 1} · SOLTE PARA USAR`;
    ability.classList.toggle('not-ready', Boolean(activePower && (abilityReadyIn > 0 || stats.ki < kiNeed)));
    const sprintLabel = sprinting && movingSpeed > 0.1 ? '✦ CORRENDO · GASTA STAMINA ✦' : flying ? '✦ VOANDO · GASTA KI ✦' : 'DRAGON BALL RPG ✦ PROTÓTIPO 0.5.0';
    element('hud-bottom-center').textContent = sprintLabel;
  }

  updateSkills(_points: number): void { /* atributos gratuitos renderizados via renderAttributes */ }

  setView(mode: 'first' | 'third', fov: number, sensitivity: number): void {
    element('camera-first').classList.toggle('selected', mode === 'first');
    element('camera-third').classList.toggle('selected', mode === 'third');
    element<HTMLInputElement>('fov-slider').value = String(fov);
    element('fov-value').textContent = `${fov}°`;
    element<HTMLInputElement>('mouse-slider').value = String(Math.round(sensitivity * 100));
    element('mouse-value').textContent = `${Math.round(sensitivity * 100)}%`;
  }

  setAimHit(on: boolean): void { element('aim-reticle').classList.toggle('aim-hit', on); }

  toast(message: string, kind: 'info' | 'danger' | 'success' = 'info', seconds = 2): void {
    this.toastElement.textContent = message;
    this.toastElement.dataset.kind = kind;
    this.toastElement.classList.remove('hidden');
    this.toastDeadline = performance.now() + seconds * 1000;
  }

  update(): void {
    if (this.toastDeadline && performance.now() > this.toastDeadline) {
      this.toastElement.classList.add('hidden');
      this.toastDeadline = 0;
    }
  }

  floatingDamage(amount: number, x: number, y: number, kind: 'object' | 'creature' | 'critical'): void {
    const el = document.createElement('div');
    el.className = `damage-number ${kind}`;
    el.textContent = kind === 'critical' ? 'ALVO DESTRUÍDO!' : `−${amount}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    element('combat-number-layer').append(el);
    setTimeout(() => el.remove(), 1100);
  }

  setSound(on: boolean): void { element('sound-toggle').innerHTML = `♫ <span>${on ? 'SOM ON' : 'SOM OFF'}</span>`; }
}
