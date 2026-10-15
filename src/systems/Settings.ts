export type Quality='low'|'medium'|'high';
export const QUALITY={low:{pixelRatio:1,shadows:false},medium:{pixelRatio:1.25,shadows:true},high:{pixelRatio:1.65,shadows:true}} as const;
export function finiteSetting(value:unknown,fallback:number,min:number,max:number):number{const n=Number(value);return Number.isFinite(n)&&value!==null?Math.max(min,Math.min(max,n)):fallback;}
