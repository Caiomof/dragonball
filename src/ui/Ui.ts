import { SKILLS, type SkillId } from '../data/skills';
import { RACES } from '../data/gameConfig';
import { ATTRIBUTE_INFO, type AttributeKey, type Appearance, type PlayerProfile } from '../data/profiles';
import type { FighterStats, GameState, Race, RaceId } from '../data/gameConfig';

const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`UI não encontrada: ${id}`);
  return found as T;
};

export type UiCallbacks = { start(): void; preview(id: RaceId): void; confirm(): void; back(): void; pause(): void; resume(): void; exit(): void; sound(): void; settings(): void; settingsClose(): void; skills(): void; skillsClose(): void; upgrade(type: AttributeKey, direction: number): void; heroCreate(): void; heroSelect(id: string): void; heroDelete(id: string): void; heroBack(): void; customize(appearance: Appearance, name: string): void; selectSkill(id: SkillId): void; camera(mode: 'first' | 'third'): void; fov(value: number): void; sensitivity(value: number): void };

export class Ui {
  selected: RaceId = 'saiyajin';
  private readonly main = element('main-menu');
  private readonly races = element('race-screen');
  private readonly characters = element('character-screen');
  private readonly loading = element('loading-screen');
  private readonly hud = element('play-hud');
  private readonly pause = element('pause-screen');
  private readonly target = element('target-indicator');
  private readonly toastElement = element('toast');
  private toastDeadline = 0;
  private readonly settings = element('settings-screen');
  private readonly skills = element('skills-screen');
  private callbacks: UiCallbacks | null = null;

  constructor() {
    const options = element('race-options');
    options.innerHTML = RACES.map((race, index) => `
      <button type="button" class="race-option ${index === 0 ? 'selected' : ''}" data-race="${race.id}" role="radio" aria-checked="${index === 0}">
        <span class="race-option-symbol" style="--item-color:${race.accent}">${race.symbol}</span>
        <span class="race-option-text"><strong>${race.name.toUpperCase()}</strong><small>${race.title}</small></span>
        <span class="race-option-arrow">↗</span>
      </button>`).join('');
    options.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-race]');
      if (target) this.select(target.dataset.race as RaceId);
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
    for (const id of ['hero-name','hero-height','hero-build','hero-hair','hero-beard','hero-eye','hero-haircolor']) {
      element(id).addEventListener('input', () => this.emitAppearance());
    }
    element('attribute-editor').addEventListener('click', (event)=>{
      const target=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-attr]');
      if(target) this.callbacks?.upgrade(target.dataset.attr as AttributeKey, Number(target.dataset.direction));
    });
    element('race-back').addEventListener('click', () => this.callbacks?.back());
    element('race-confirm').addEventListener('click', () => this.callbacks?.confirm());
    element('resume-button').addEventListener('click', () => this.callbacks?.resume());
    element('exit-to-menu').addEventListener('click', () => this.callbacks?.exit());
    element('sound-toggle').addEventListener('click', () => this.callbacks?.sound());
    element('settings-main').addEventListener('click', () => this.callbacks?.settings());
    element('open-settings').addEventListener('click', () => this.callbacks?.settings());
    element('settings-close').addEventListener('click', () => this.callbacks?.settingsClose());
    element('open-skills').addEventListener('click', () => this.callbacks?.skills());
    element('skills-close').addEventListener('click', () => this.callbacks?.skillsClose());
    element('camera-first').addEventListener('click', () => this.callbacks?.camera('first'));
    element('camera-third').addEventListener('click', () => this.callbacks?.camera('third'));
    element<HTMLInputElement>('fov-slider').addEventListener('input', (event) => this.callbacks?.fov(Number((event.target as HTMLInputElement).value)));
    element<HTMLInputElement>('mouse-slider').addEventListener('input', (event) => this.callbacks?.sensitivity(Number((event.target as HTMLInputElement).value)));

    const hotbar = element('skill-hotbar');
    hotbar.innerHTML = SKILLS.map(skill => `<button class="skill-slot ${skill.id === 'kamehameha' ? 'active' : ''}" type="button" data-skill="${skill.id}" style="--skill-color:${skill.color}"><span class="skill-key">${skill.key}</span><span class="skill-icon">${skill.kind === 'disc' ? '◉' : '✦'}</span><span class="skill-name">${skill.short}</span><i class="cooldown-shade"></i></button>`).join('');
    hotbar.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach(button => button.addEventListener('click', () => this.callbacks?.selectSkill(button.dataset.skill as SkillId)));
    element('about-button').addEventListener('click', () => element('about-dialog').classList.remove('hidden'));
    element('about-close').addEventListener('click', () => element('about-dialog').classList.add('hidden'));
    element('about-ok').addEventListener('click', () => element('about-dialog').classList.add('hidden'));
  }

  on(callbacks: UiCallbacks): void { this.callbacks = callbacks; }

  private emitAppearance(): void {
    const appearance: Appearance = {
      height: Number(element<HTMLInputElement>('hero-height').value)/100,
      build: Number(element<HTMLInputElement>('hero-build').value)/100,
      hair: Number(element<HTMLSelectElement>('hero-hair').value),
      beard: element<HTMLInputElement>('hero-beard').checked,
      eyeColor: element<HTMLInputElement>('hero-eye').value,
      hairColor: element<HTMLInputElement>('hero-haircolor').value
    };
    element('height-number').textContent=`${Math.round(appearance.height*100)}%`;
    element('build-number').textContent=`${Math.round(appearance.build*100)}%`;
    this.callbacks?.customize(appearance,element<HTMLInputElement>('hero-name').value);
  }

  editAppearance(appearance: Appearance, name: string): void {
    element<HTMLInputElement>('hero-name').value=name;
    element<HTMLInputElement>('hero-height').value=String(Math.round(appearance.height*100));
    element<HTMLInputElement>('hero-build').value=String(Math.round(appearance.build*100));
    element<HTMLSelectElement>('hero-hair').value=String(appearance.hair);
    element<HTMLInputElement>('hero-beard').checked=appearance.beard;
    element<HTMLInputElement>('hero-eye').value=appearance.eyeColor;
    element<HTMLInputElement>('hero-haircolor').value=appearance.hairColor;
    element('height-number').textContent=`${Math.round(appearance.height*100)}%`;
    element('build-number').textContent=`${Math.round(appearance.build*100)}%`;
  }

  renderProfiles(profiles: PlayerProfile[]): void {
    const escape=(text:string)=>text.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    element('character-list').innerHTML=profiles.length ? profiles.map(p=>{
      const race=RACES.find(r=>r.id===p.race)??RACES[0];
      return `<article class="character-slot" style="--item-color:${race.accent}"><span class="profile-glyph">${race.symbol}</span><div><strong>${escape(p.name)}</strong><small>${race.name} · Poder ${race.power+p.attributes.power}</small></div><button class="profile-play" data-character="${p.id}" type="button">JOGAR / EDITAR →</button><button class="profile-delete" data-character="${p.id}" data-delete="1" type="button" title="Excluir personagem">✕</button></article>`;
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

  showModelNotice(): void {
    element('preview-trait').textContent='MODELO INTERNO · CARREGAMENTO 3D';
  }

  select(id: RaceId, notify = true): void {
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
    if (notify) this.callbacks?.preview(id);
  }

  state(state: GameState): void {
    const views: [HTMLElement, GameState][] = [[this.main, 'MAIN_MENU'], [this.characters, 'CHARACTER_SELECT'], [this.races, 'RACE_SELECTION'], [this.loading, 'LOADING'], [this.hud, 'PLAYING'], [this.pause, 'PAUSED']];
    for (const [screen, name] of views) screen.classList.toggle('hidden', state !== name);
    element('topline').classList.toggle('hidden', state === 'PLAYING' || state === 'PAUSED' || state === 'LOADING');
    element('ui-root').dataset.state = state;
    if (['PAUSED', 'SKILLS', 'SETTINGS'].includes(state)) this.hud.classList.remove('hidden');
    this.settings.classList.toggle('hidden', state !== 'SETTINGS');
    this.skills.classList.toggle('hidden', state !== 'SKILLS');
  }

  setLoading(percent: number): void { element('loading-progress').style.width = `${percent}%`; }

  updateHud(stats: FighterStats, abilityReadyIn: number, sprinting: boolean, movingSpeed: number, dummyHealth: number, maxDummyHealth: number, dummyVisible: boolean, race: Race, activeSkill: SkillId = 'kamehameha', cooldowns: Partial<Record<SkillId, number>> = {}, flying = false): void {
    element('hud-race').textContent = race.name.toUpperCase();
    element('hud-power').textContent = String(stats.power);
    element('hud-health-label').textContent = `${Math.ceil(stats.health)} / ${stats.maxHealth}`;
    element('hud-health-fill').style.width = `${Math.max(0, stats.health / stats.maxHealth * 100)}%`;
    element('hud-ki-label').textContent = `${Math.ceil(stats.ki)} / ${stats.maxKi}`;
    element('hud-ki-fill').style.width = `${Math.max(0, stats.ki / stats.maxKi * 100)}%`;
    element('hud-stamina-label').textContent = `${Math.ceil(stats.stamina)} / ${stats.maxStamina}`;
    element('hud-stamina-fill').style.width = `${Math.max(0, stats.stamina / stats.maxStamina * 100)}%`;
    const definition = SKILLS.find(skill => skill.id === activeSkill) ?? SKILLS[0];
    for (const slot of document.querySelectorAll<HTMLElement>('[data-skill]')) {
      const data = SKILLS.find(skill => skill.id === slot.dataset.skill)!;
      const cd = Math.max(0, cooldowns[data.id] ?? 0);
      slot.classList.toggle('active', data.id === activeSkill);
      const shade = slot.querySelector<HTMLElement>('.cooldown-shade');
      if (shade) shade.style.height = `${Math.min(100, cd / data.cooldown * 100)}%`;
      slot.title = `${data.label} · ${data.kiCost} Ki`;
    }
    element('flight-indicator').classList.toggle('hidden', !flying);
    element('ability-orb').style.setProperty('--ability-color', definition.color);
    document.querySelector('.ability-copy strong')!.textContent = definition.short;
    const ability = element('ability-orb');
    ability.style.setProperty('--cooldown', `${Math.round(Math.max(0, 1 - abilityReadyIn / definition.cooldown) * 100)}%`);
    const abilityText = element('ability-status');
    abilityText.textContent = abilityReadyIn > 0 ? `RECARGA · ${abilityReadyIn.toFixed(1)}s` : stats.ki < definition.kiCost ? 'KI INSUFICIENTE' : `SEGURE ${definition.key} · ${definition.kiCost}+ KI`;
    ability.classList.toggle('not-ready', abilityReadyIn > 0 || stats.ki < definition.kiCost);
    const filled = element('target-health-fill');
    filled.style.width = `${dummyHealth / maxDummyHealth * 100}%`;
    element('target-health-label').textContent = dummyVisible ? `${dummyHealth} / ${maxDummyHealth}` : 'REGENERANDO...';
    this.target.classList.toggle('destroyed', !dummyVisible);
    this.target.classList.remove('hidden');
    element('hud-bottom-center').textContent = sprinting && movingSpeed > 0.1 ? '✦ CORRENDO · SHIFT ✦' : 'DRAGON BALL RPG ✦ PROTÓTIPO 0.1.6';
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

  highlightSkill(id: SkillId): void {
    for (const slot of document.querySelectorAll<HTMLElement>('[data-skill]')) slot.classList.toggle('active', slot.dataset.skill === id);
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

  floatingDamage(amount: number, x: number, y: number, critical: boolean): void {
    const el = document.createElement('div');
    el.className = `damage-number ${critical ? 'critical' : ''}`;
    el.textContent = critical ? 'ALVO DESTRUÍDO!' : `−${amount}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    element('combat-number-layer').append(el);
    setTimeout(() => el.remove(), 1100);
  }

  setSound(on: boolean): void { element('sound-toggle').innerHTML = `♫ <span>${on ? 'SOM ON' : 'SOM OFF'}</span>`; }
}
