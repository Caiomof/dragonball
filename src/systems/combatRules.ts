/** World-space conventions shared by wildlife navigation and combat. Animals face +Z. */
export const headingForVelocity=(x:number,z:number)=>Math.atan2(x,z);
export const turnToward=(current:number,target:number,dt:number)=>current+Math.atan2(Math.sin(target-current),Math.cos(target-current))*(1-Math.exp(-Math.max(0,dt)*5));
export const biteCanReach=(distance:number,vertical:number,lineClear:boolean)=>distance<2.3&&Math.abs(vertical)<1.7&&lineClear;
