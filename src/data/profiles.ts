import {newJourney, type JourneyProgress} from '../systems/Journey';
import type { RaceId } from './gameConfig';

export type AttributeKey = 'health' | 'ki' | 'stamina' | 'power' | 'kiRegen' | 'speed' | 'flight';
export type AttributeLevels = Record<AttributeKey, number>;
export type Appearance = { height: number; build: number; hair: number; beard: boolean; beardStyle: number; eyeColor: string; hairColor: string };
export type PlayerProfile = { id: string; name: string; race: RaceId; appearance: Appearance; attributes: AttributeLevels; createdAt: number; schemaVersion: 2; progress: JourneyProgress; checkpoint: 'training' | 'desert' | 'snow' };

export const ATTRIBUTE_INFO: { id: AttributeKey; label: string; desc: string; step: number; min: number; max: number }[] = [
  {id:'health', label:'Vida máxima', desc:'Mais resistência em combate',step:25,min:50,max:1500},
  {id:'ki',label:'Reserva de Ki',desc:'Mais energia disponível para técnicas',step:20,min:40,max:1600},
  {id:'stamina',label:'Stamina',desc:'Fôlego para golpes, corridas e voo',step:20,min:40,max:1200},
  {id:'power',label:'Poder de luta',desc:'Amplifica dano corpo a corpo e poderes',step:3,min:1,max:250},
  {id:'kiRegen',label:'Recuperação de Ki',desc:'Ki recuperado por segundo',step:2,min:1,max:100},
  {id:'speed',label:'Velocidade terrestre',desc:'Multiplica caminhada e corrida',step:0.15,min:0.4,max:2.5},
  {id:'flight',label:'Domínio de voo',desc:'Velocidade e controle no ar',step:0.15,min:0.4,max:2.5}
];
export const BASE_ATTR = {health:0,ki:0,stamina:100,power:0,kiRegen:6.2,speed:1,flight:1} as const;
const STORAGE_KEY = 'dbrpg-origens-characters-v016';
export const DEFAULT_APPEARANCE: Appearance = {height:1,build:1,hair:0,beard:false,beardStyle:0,eyeColor:'#45b4e9',hairColor:'#202436'};
export const RACE_APPEARANCE: Record<RaceId, Appearance> = {
  saiyajin: { height: 1.06, build: 1.12, hair: 0, beard: false, beardStyle: 0, eyeColor: '#1c2438', hairColor: '#141820' },
  terraqueo: { height: 1, build: 1, hair: 1, beard: false, beardStyle: 0, eyeColor: '#3d2914', hairColor: '#4a2e22' },
  namekuseijin: { height: 1.1, build: 0.9, hair: 1, beard: false, beardStyle: 0, eyeColor: '#5a3040', hairColor: '#7dbe62' },
  majin: { height: 0.96, build: 1.18, hair: 2, beard: false, beardStyle: 0, eyeColor: '#4a2848', hairColor: '#f0a0c4' }
};
export function makeProfile(race: RaceId = 'saiyajin'): PlayerProfile {
  return {id:(typeof crypto!=='undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ch_${Date.now()}_${Math.floor(Math.random()*1e6)}`),name:'Novo guerreiro',race,appearance:{...RACE_APPEARANCE[race]},attributes:{health:0,ki:0,stamina:100,power:0,kiRegen:6.2,speed:1,flight:1},createdAt:Date.now(),schemaVersion:2,progress:newJourney(),checkpoint:'training'};
}
const finite=(v:unknown, fallback:number,min:number,max:number):number=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
const color=(v:unknown,fallback:string):string=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:fallback;
export function normalizeProfile(value:unknown):PlayerProfile|null {
 if(!value||typeof value!=='object')return null;
 const x=value as Record<string, any>;
 if(typeof x.id!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(x.id)||!['saiyajin','terraqueo','namekuseijin','majin'].includes(x.race))return null;
 const base=makeProfile(x.race),a=x.appearance??{},attrs=x.attributes??{},progress=x.progress??{};
 const beardStyle=Math.round(finite(a.beardStyle,a.beard?1:0,0,3));
 const appearance:Appearance={height:finite(a.height,base.appearance.height,.94,1.12),build:finite(a.build,base.appearance.build,.9,1.18),hair:Math.round(finite(a.hair,0,0,2)),beard:beardStyle>0,beardStyle,eyeColor:color(a.eyeColor,base.appearance.eyeColor),hairColor:color(a.hairColor,base.appearance.hairColor)};
 for(const key of Object.keys(base.attributes) as AttributeKey[]){const spec=ATTRIBUTE_INFO.find(s=>s.id===key)!;const isBonus=['health','ki','power'].includes(key);base.attributes[key]=finite(attrs[key],base.attributes[key],isBonus?0:spec.min,isBonus?spec.max-1:spec.max);}
 return {...base,id:x.id,name:typeof x.name==='string'?x.name.trim().slice(0,28)||'Guerreiro':'Guerreiro',appearance,createdAt:finite(x.createdAt,Date.now(),0,Date.now()),checkpoint:['desert','snow'].includes(x.checkpoint)?x.checkpoint:'training',progress:{training:Math.floor(finite(progress.training,0,0,3)),flight:finite(progress.flight,0,0,6),swim:finite(progress.swim,0,0,4),desert:progress.desert===true,snow:progress.snow===true,final:progress.final===true}};
}
export function loadProfiles():PlayerProfile[]{
 try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');if(!Array.isArray(saved))return [];const ids=new Set<string>();return saved.slice(0,32).map(normalizeProfile).filter((p):p is PlayerProfile=>Boolean(p&&!ids.has(p.id)&&ids.add(p.id)));}
 catch{globalThis.dispatchEvent?.(new Event('origens:storage-error'));return [];}
}
export function saveProfiles(profiles:PlayerProfile[]):boolean{
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(profiles.slice(0,32)));return true;}
 catch{globalThis.dispatchEvent?.(new Event('origens:storage-error'));return false;}
}
