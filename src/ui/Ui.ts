import { RACES } from '../data/gameConfig';
import type { FighterStats, GameState, Race, RaceId } from '../data/gameConfig';

const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`UI não encontrada: ${id}`);
  return found as T;
};

export type UiCallbacks = { start(): void; preview(id: RaceId): void; confirm(): void; back(): void; pause(): void; resume(): void; exit(): void; sound(): void };

export class Ui {
  selected: RaceId = 'saiyajin';
  private readonly main = element('main-menu');
  private readonly races = element('race-screen');
  private readonly loading = element('loading-screen');
  private readonly hud = element('play-hud');
  private readonly pause = element('pause-screen');
  private readonly target = element('target-indicator');
  private readonly toastElement = element('toast');
  private toastDeadline = 0;
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
    element('race-back').addEventListener('click', () => this.callbacks?.back());
    element('race-confirm').addEventListener('click', () => this.callbacks?.confirm());
    element('resume-button').addEventListener('click', () => this.callbacks?.resume());
    element('exit-to-menu').addEventListener('click', () => this.callbacks?.exit());
    element('sound-toggle').addEventListener('click', () => this.callbacks?.sound());
    element('about-button').addEventListener('click', () => element('about-dialog').classList.remove('hidden'));
    element('about-close').addEventListener('click', () => element('about-dialog').classList.add('hidden'));
    element('about-ok').addEventListener('click', () => element('about-dialog').classList.add('hidden'));
  }

  on(callbacks: UiCallbacks): void { this.callbacks = callbacks; }

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
    const views: [HTMLElement, GameState][] = [[this.main, 'MAIN_MENU'], [this.races, 'RACE_SELECTION'], [this.loading, 'LOADING'], [this.hud, 'PLAYING'], [this.pause, 'PAUSED']];
    for (const [screen, name] of views) screen.classList.toggle('hidden', state !== name);
    element('topline').classList.toggle('hidden', state === 'PLAYING' || state === 'PAUSED' || state === 'LOADING');
    element('ui-root').dataset.state = state;
    if (state === 'PAUSED') this.hud.classList.remove('hidden');
  }

  setLoading(percent: number): void { element('loading-progress').style.width = `${percent}%`; }

  updateHud(stats: FighterStats, abilityReadyIn: number, sprinting: boolean, movingSpeed: number, dummyHealth: number, maxDummyHealth: number, dummyVisible: boolean, race: Race): void {
    element('hud-race').textContent = race.name.toUpperCase();
    element('hud-power').textContent = String(stats.power);
    element('hud-health-label').textContent = `${Math.ceil(stats.health)} / ${stats.maxHealth}`;
    element('hud-health-fill').style.width = `${Math.max(0, stats.health / stats.maxHealth * 100)}%`;
    element('hud-ki-label').textContent = `${Math.ceil(stats.ki)} / ${stats.maxKi}`;
    element('hud-ki-fill').style.width = `${Math.max(0, stats.ki / stats.maxKi * 100)}%`;
    const ability = element('ability-orb');
    ability.style.setProperty('--cooldown', `${Math.round(Math.max(0, 1 - abilityReadyIn / 2) * 100)}%`);
    const abilityText = element('ability-status');
    abilityText.textContent = abilityReadyIn > 0 ? `RECARGA · ${abilityReadyIn.toFixed(1)}s` : stats.ki < 25 ? 'KI INSUFICIENTE' : 'CLIQUE ESQUERDO · 25 KI';
    ability.classList.toggle('not-ready', abilityReadyIn > 0 || stats.ki < 25);
    const filled = element('target-health-fill');
    filled.style.width = `${dummyHealth / maxDummyHealth * 100}%`;
    element('target-health-label').textContent = dummyVisible ? `${dummyHealth} / ${maxDummyHealth}` : 'REGENERANDO...';
    this.target.classList.toggle('destroyed', !dummyVisible);
    this.target.classList.remove('hidden');
    element('hud-bottom-center').textContent = sprinting && movingSpeed > 0.1 ? '✦ CORRENDO · SHIFT ✦' : 'DRAGON BALL RPG ✦ PROTÓTIPO 0.1';
  }

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
