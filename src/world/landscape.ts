/** Shared, deterministic terrain and water field. Rendering and physics sample this field. */
export const WORLD_HALF = 170;
export const TERRAIN_SEGMENTS = 280;
export const TERRAIN_WIDTH = WORLD_HALF * 2 + 20;
export type Biome = 'plains' | 'desert' | 'snow';
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export function smooth(a: number, b: number, n: number): number { const t = clamp((n-a)/(b-a),0,1); return t*t*(3-2*t); }
export function biomeWeights(x: number,z: number) { const snow=smooth(58,100,z); const desert=smooth(42,85,-x)*(1-snow); return {snow,desert,plains:1-snow-desert}; }
export function biomeAt(x: number,z: number): Biome { const w=biomeWeights(x,z); return w.snow>.5?'snow':w.desert>.5?'desert':'plains'; }
export const BIOME_NAMES: Record<Biome,string> = {plains:'PLANÍCIE ESMERALDA',desert:'DUNAS DO SOL',snow:'SERRA DA AURORA'};
export const LANDMARKS = [
 {id:'training',name:'Clareira do despertar',x:0,z:-15,color:0xffd68c},
 {id:'lake',name:'Lago da serenidade',x:31,z:30,color:0x7ee4ec},
 {id:'desert',name:'Santuário das dunas',x:-119,z:-24,color:0xffc279},
 {id:'snow',name:'Farol da aurora',x:43,z:124,color:0xb9d9ff},
] as const;
export const riverCenter = (z: number) => 22+Math.sin(z*.028)*7;
export const LAKES = [
  {x: -6, z: 8, rx: 18, rz: 13, level: 0.28},
  {x: 62, z: -36, rx: 14, rz: 16, level: 0.16},
  {x: -42, z: -55, rx: 12, rz: 11, level: 0.34}
] as const;
export function riverWidth(z: number): number {
  const enter = smooth(-108, -92, z);
  const bulge = Math.max(smooth(-18, 6, z) * (1 - smooth(22, 40, z)), smooth(48, 70, z) * (1 - smooth(78, 96, z)));
  const leave = 1 - smooth(96, 118, z);
  return (7.2 + bulge * 16) * enter * Math.max(0, leave);
}
function lakeHit(x: number, z: number): { level: number; shore: number } | null {
  let best: { level: number; shore: number } | null = null;
  for (const lake of LAKES) {
    const n = ((x - lake.x) / lake.rx) ** 2 + ((z - lake.z) / lake.rz) ** 2;
    if (n < 1 && (!best || n < best.shore)) best = { level: lake.level, shore: n };
  }
  return best;
}
export function waterLevel(z: number, x = 0): number {
  const lake = lakeHit(x, z);
  if (lake) return lake.level;
  return .35 + (1 - smooth(-96, 12, z)) * .75;
}
export function waterFootprint(x: number, z: number): boolean {
  if (lakeHit(x, z)) return true;
  const w = riverWidth(z);
  return w > .12 && Math.abs(x - riverCenter(z)) < w;
}
export function rawHeight(x: number,z: number): number {
 const w=biomeWeights(x,z);
 const flat=smooth(18,38,Math.hypot(x,z));
 const rolling=(Math.sin(x*.054)*Math.cos(z*.051)*2.5+Math.sin(x*.113+z*.064)*1.1+Math.cos(z*.117-x*.066)*.8)*flat;
 const dunes=2.7+Math.sin(x*.065+z*.026)*3+Math.sin(z*.08)*1.5;
 const mountains=5+Math.sin(x*.047)*Math.cos(z*.039)*5+Math.pow(Math.sin(z*.046+x*.016),2)*7;
 let h=rolling*w.plains+dunes*w.desert+mountains*w.snow;
 // Keep landmarks approachable, with deterministic safe ground under their pads.
 for(const p of LANDMARKS) if(p.id!=='lake') { const d=Math.hypot(x-p.x,z-p.z); const base=p.id==='snow'?9:p.id==='desert'?3:0; h=base+(h-base)*smooth(9,20,d); }
 const width=riverWidth(z); const dx=Math.abs(x-riverCenter(z));
 if(width>.12 && dx<width+8) {
   const level=waterLevel(z, x); const shore=dx/width;
   const bed=level-1.85+1.5*smooth(.5,1,shore);
   if(shore<=1) h=bed;
   else {
     const bank=level+.72+.55*smooth(1,1.35,shore);
     h=Math.max(h,bank);
   }
 }
 for (const lake of LAKES) {
   const nx=(x-lake.x)/lake.rx, nz=(z-lake.z)/lake.rz;
   const n=nx*nx+nz*nz;
   if(n>=2.1) continue;
   const shore=Math.sqrt(n);
   const water=lake.level;
   if(n<1) {
     const bed=water-1.9+1.58*smooth(.4,1,shore);
     h=bed;
   } else {
     const bank=water+.62+.75*smooth(1,1.5,shore);
     h=Math.max(h,bank);
   }
 }
 const edge=smooth(151,179,Math.max(Math.abs(x),Math.abs(z)))*15;
 return h+edge;
}
export function terrainHeight(x: number,z: number): number {
 const step=TERRAIN_WIDTH/TERRAIN_SEGMENTS;
 const ix=clamp(Math.floor((x+TERRAIN_WIDTH/2)/step),0,TERRAIN_SEGMENTS-1);
 const iz=clamp(Math.floor((TERRAIN_WIDTH/2-z)/step),0,TERRAIN_SEGMENTS-1);
 const x0=-TERRAIN_WIDTH/2+ix*step,z0=TERRAIN_WIDTH/2-iz*step;
 const u=clamp((x-x0)/step,0,1),v=clamp((z0-z)/step,0,1);
 const a=rawHeight(x0,z0),b=rawHeight(x0+step,z0),c=rawHeight(x0,z0-step),d=rawHeight(x0+step,z0-step);
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function waterDepth(x:number,z:number):number { return waterFootprint(x,z)?Math.max(0,waterLevel(z,x)-terrainHeight(x,z)):0; }
export const isSwimming = (x:number,z:number) => waterDepth(x,z)>.75;
