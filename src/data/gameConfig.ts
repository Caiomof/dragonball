import raceData from './races.json';
import abilityData from './abilities.json';

export type RaceId = 'saiyajin' | 'terraqueo' | 'namekuseijin' | 'majin';
export type GameState = 'MAIN_MENU' | 'RACE_SELECTION' | 'LOADING' | 'PLAYING' | 'PAUSED';
export type Race = {
  id: RaceId;
  name: string;
  title: string;
  description: string;
  power: number;
  health: number;
  ki: number;
  accent: string;
  detail: string;
  trait: string;
  symbol: string;
};

export const RACES: Race[] = raceData as Race[];
export const ABILITIES = abilityData;
export const WALK_SPEED = 5;
export const RUN_SPEED = 9;
export const JUMP_SPEED = 9;
export const GRAVITY = 24;
export const WORLD_HALF = 105;

export function getRace(id: RaceId): Race {
  return RACES.find((race) => race.id === id) ?? RACES[0];
}

export type FighterStats = {
  race: RaceId;
  health: number;
  maxHealth: number;
  ki: number;
  maxKi: number;
  power: number;
};

export function createStats(race: Race): FighterStats {
  return {
    race: race.id,
    health: race.health,
    maxHealth: race.health,
    ki: race.ki,
    maxKi: race.ki,
    power: race.power
  };
}

export function spendKi(stats: FighterStats, cost: number): boolean {
  if (stats.ki < cost) return false;
  stats.ki -= cost;
  return true;
}

export function applyDamage(health: number, damage: number): number {
  return Math.max(0, health - Math.max(0, damage));
}
