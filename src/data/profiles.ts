import type { RaceId } from './gameConfig';

export type AttributeKey = 'health' | 'ki' | 'stamina' | 'power' | 'kiRegen' | 'speed' | 'flight';
export type AttributeLevels = Record<AttributeKey, number>;
export type Appearance = { height: number; build: number; hair: number; beard: boolean; eyeColor: string; hairColor: string };
export type PlayerProfile = { id: string; name: string; race: RaceId; appearance: Appearance; attributes: AttributeLevels; createdAt: number };

export const ATTRIBUTE_INFO: { id: AttributeKey; label: string; desc: string; step: number; min: number; max: number }[] = [
  {id:'health', label:'Vida máxima', desc:'Mais resistência em combate',step:25,min:50,max:1500},
  {id:'ki',label:'Reserva de Ki',desc:'Mais energia disponível para técnicas',step:20,min:40,max:1600},
  {id:'stamina',label:'Stamina',desc:'Fôlego para golpes, corridas e voo',step:20,min:40,max:1200},
  {id:'power',label:'Poder de luta',desc:'Amplifica dano corpo a corpo e poderes',step:3,min:1,max:250},
  {id:'kiRegen',label:'Recuperação de Ki',desc:'Ki recuperado por segundo',step:2,min:1,max:100},
  {id:'speed',label:'Velocidade terrestre',desc:'Multiplica caminhada e corrida',step:0.15,min:0.4,max:5},
  {id:'flight',label:'Domínio de voo',desc:'Velocidade e controle no ar',step:0.15,min:0.4,max:5}
];
export const BASE_ATTR = {health:0,ki:0,stamina:100,power:0,kiRegen:6.2,speed:1,flight:1} as const;
const STORAGE_KEY = 'dbrpg-origens-characters-v016';
export const DEFAULT_APPEARANCE: Appearance = {height:1,build:1,hair:0,beard:false,eyeColor:'#45b4e9',hairColor:'#202436'};
export function makeProfile(race: RaceId = 'saiyajin'): PlayerProfile {
  return {id:(typeof crypto!=='undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ch_${Date.now()}_${Math.floor(Math.random()*1e6)}`),name:'Novo guerreiro',race,appearance:{...DEFAULT_APPEARANCE},attributes:{health:0,ki:0,stamina:100,power:0,kiRegen:6.2,speed:1,flight:1},createdAt:Date.now()};
}
export function loadProfiles(): PlayerProfile[] {
  try {const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if(!Array.isArray(saved)) return [];
    return saved.slice(0,32).filter(x=>x&&typeof x.id==='string'&&/^[a-zA-Z0-9_-]{1,90}$/.test(x.id)&&typeof x.name==='string'&&['saiyajin','terraqueo','namekuseijin','majin'].includes(x.race))
      .map(x=>({...makeProfile(x.race), ...x, name:String(x.name).slice(0,28),appearance:{...DEFAULT_APPEARANCE,...x.appearance}, attributes:{...makeProfile(x.race).attributes,...x.attributes}})) as PlayerProfile[];
  } catch {return []}
}
export function saveProfiles(profiles: PlayerProfile[]): void {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(profiles.slice(0,32)))} catch { /* storage unavailable */ }
}
