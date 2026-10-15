import type { AttackStyle } from '../combat/Combat';
import type { RaceId } from './gameConfig';

export type PowerTypeId =
  | 'ball'
  | 'beam_wide'
  | 'beam_narrow'
  | 'disc'
  | 'burst'
  | 'melee_wave'
  | 'flight'
  | 'teleport'
  | 'super_saiyan'
  | 'kaioken';

export type PowerCategory = 'attack' | 'movement' | 'defense' | 'technique';

export type CustomPower = {
  id: string;
  name: string;
  symbol: string;
  type: PowerTypeId;
  color: string;
  core: string;
  size: number;
};

export type PowerStats = {
  damage: number;
  range: number;
  kiCost: number;
  cooldown: number;
  charge: number;
  duration: number;
  hit: number;
  blastRadius: number;
  style: AttackStyle;
};

const BLAST_BASE: Record<PowerTypeId, number> = {
  ball: 3.4,
  beam_wide: 5.2,
  beam_narrow: 2.4,
  disc: 3.1,
  burst: 2.8,
  melee_wave: 6.2,
  flight: 0,
  teleport: 1.8,
  super_saiyan: 0,
  kaioken: 0,
};

export const POWER_SYMBOLS = ['★', '◉', '✦', '◇', '▲', '●', '⚡', '◎', '✸', '◆', '⬡', '☄'] as const;

export const SIZE_LABELS = ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme'] as const;

export const COST_UNLOCK: Partial<Record<PowerTypeId, number>> = {
  ball: 0,
  beam_wide: 900,
  disc: 800,
  beam_narrow: 2200,
  burst: 1100,
  melee_wave: 950,
  flight: 3000,
  teleport: 5000,
  super_saiyan: 4500,
  kaioken: 3200,
};

export const POWER_RACE_LOCK: Partial<Record<PowerTypeId, RaceId>> = {
  super_saiyan: 'saiyajin',
};

export const COST_CREATE = 400;
export const COST_EDIT = 150;
export const ZENI_START = 1200;
export const MAX_POWERS = 12;
export const LOADOUT_SLOTS = 6;
export const BOSS_COOLDOWN_SEC = 300;

export const POWER_TYPES: {
  id: PowerTypeId;
  label: string;
  short: string;
  category: PowerCategory;
  blurb: string;
}[] = [
  { id: 'ball', label: 'Bola de Ki', short: 'BOLA', category: 'attack', blurb: 'Projétil médio, fácil de acertar.' },
  { id: 'beam_wide', label: 'Feixe largo', short: 'FEIXE', category: 'attack', blurb: 'Um feixe contínuo e largo — fácil de acertar, carrega antes.' },
  { id: 'beam_narrow', label: 'Feixe fino', short: 'RAIO', category: 'attack', blurb: 'Raio fino e longo — muito dano, precisa mirar bem.' },
  { id: 'disc', label: 'Disco', short: 'DISCO', category: 'attack', blurb: 'Disco que corta em linha reta — um projétil que gira.' },
  { id: 'burst', label: 'Rajada', short: 'RAJADA', category: 'attack', blurb: 'Vários projéteis seguidos — alcance curto, ritmo rápido.' },
  { id: 'melee_wave', label: 'Onda perto', short: 'ONDA', category: 'attack', blurb: 'Explosão de curto alcance.' },
  { id: 'flight', label: 'Voo', short: 'VOO', category: 'movement', blurb: 'Domínio do ar (gasta ki).' },
  { id: 'teleport', label: 'Teleporte', short: 'BLINK', category: 'movement', blurb: 'Salto curto à frente.' },
  { id: 'super_saiyan', label: 'Super Saiyajin', short: 'SSJ', category: 'technique', blurb: 'Transformação — muito mais dano por um tempo. Só Saiyajin.' },
  { id: 'kaioken', label: 'Kaioken', short: 'KAI', category: 'technique', blurb: 'Explosão de ki — aumenta o poder de luta por um tempo.' },
];

const STYLE: Record<PowerTypeId, AttackStyle> = {
  ball: 'orb',
  beam_wide: 'kamehameha',
  beam_narrow: 'galick',
  disc: 'kienzan',
  burst: 'masenko',
  melee_wave: 'orb',
  flight: 'orb',
  teleport: 'orb',
  super_saiyan: 'orb',
  kaioken: 'orb',
};

const BASE: Record<PowerTypeId, Omit<PowerStats, 'style' | 'blastRadius'>> = {
  ball: { damage: 42, range: 52, kiCost: 8, cooldown: 0.35, charge: 0.15, duration: 0.42, hit: 0.82 },
  beam_wide: { damage: 78, range: 95, kiCost: 22, cooldown: 2.8, charge: 0.55, duration: 0.85, hit: 0.7 },
  beam_narrow: { damage: 105, range: 110, kiCost: 28, cooldown: 3.2, charge: 0.7, duration: 0.75, hit: 0.38 },
  disc: { damage: 88, range: 72, kiCost: 18, cooldown: 2.2, charge: 0.35, duration: 0.65, hit: 0.55 },
  burst: { damage: 18, range: 38, kiCost: 5, cooldown: 0.12, charge: 0.08, duration: 0.28, hit: 0.75 },
  melee_wave: { damage: 62, range: 12, kiCost: 14, cooldown: 1.1, charge: 0.2, duration: 0.35, hit: 0.9 },
  flight: { damage: 0, range: 0, kiCost: 0, cooldown: 0, charge: 0, duration: 0, hit: 1 },
  teleport: { damage: 0, range: 14, kiCost: 24, cooldown: 4.5, charge: 0.1, duration: 0.2, hit: 1 },
  super_saiyan: { damage: 0, range: 0, kiCost: 38, cooldown: 28, charge: 0.45, duration: 0, hit: 1 },
  kaioken: { damage: 0, range: 0, kiCost: 26, cooldown: 20, charge: 0.3, duration: 0, hit: 1 },
};

export function powerStats(power: CustomPower): PowerStats {
  const base = BASE[power.type];
  const t = power.size / (SIZE_LABELS.length - 1);
  const narrow = power.type === 'beam_narrow';
  const sizeDamage = narrow ? 1 - t * 0.12 : 0.78 + t * 0.42;
  const sizeKi = 0.85 + t * 0.35;
  const sizeHit = narrow ? 0.42 - t * 0.08 : 0.62 + t * 0.28;
  const sizeRange = 0.88 + t * 0.18;
  const blastScale = 0.72 + t * 0.58;
  return {
    style: STYLE[power.type],
    damage: Math.round(base.damage * sizeDamage),
    range: Math.round(base.range * sizeRange),
    kiCost: Math.max(1, Math.round(base.kiCost * sizeKi)),
    cooldown: base.cooldown,
    charge: base.charge,
    duration: base.duration,
    hit: THREE_CLAMP(sizeHit, 0.15, 0.95),
    blastRadius: Math.round(BLAST_BASE[power.type] * blastScale * 10) / 10,
  };
}

function THREE_CLAMP(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

export function legacySeedPowers(): CustomPower[] {
  return [
    { id: 'legacy_kame', name: 'Kamehameha', symbol: '✦', type: 'beam_wide', color: '#5ec8ff', core: '#dff6ff', size: 2 },
    { id: 'legacy_galick', name: 'Galick Gun', symbol: '★', type: 'beam_narrow', color: '#a86bff', core: '#efd9ff', size: 2 },
    { id: 'legacy_masenko', name: 'Masenko', symbol: '◉', type: 'burst', color: '#ffe566', core: '#fff8c4', size: 2 },
    { id: 'legacy_kienzan', name: 'Kienzan', symbol: '◎', type: 'disc', color: '#ffe08a', core: '#fff4c8', size: 2 },
  ];
}

export function defaultLoadout(): (string | null)[] {
  return ['legacy_kame', 'legacy_galick', 'legacy_masenko', 'legacy_kienzan', null, null];
}

export function defaultUnlocked(): PowerTypeId[] {
  return ['ball', 'beam_wide', 'disc', 'burst'];
}

export function gestureForType(type: PowerTypeId): 'charge' | 'beam' | 'disc' {
  if (type === 'disc') return 'disc';
  if (type === 'ball' || type === 'burst' || type === 'melee_wave' || type === 'super_saiyan' || type === 'kaioken') return 'charge';
  return 'beam';
}

export function isTechniqueType(type: PowerTypeId): boolean {
  return type === 'super_saiyan' || type === 'kaioken' || type === 'flight' || type === 'teleport';
}
