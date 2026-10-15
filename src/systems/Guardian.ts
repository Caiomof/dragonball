/** Four-second attack cycle with a visible 1.2-second warning and one damage event. */
export class GuardianCycle {
 private time=0;
 update(dt:number,active:boolean):{warning:number;impact:boolean} {
  if(!active){this.time=0;return{warning:0,impact:false};}
  this.time+=Math.max(0,Math.min(.25,dt));
  if(this.time>=4){this.time-=4;return{warning:0,impact:true};}
  return{warning:Math.max(0,(this.time-2.8)/1.2),impact:false};
 }
}
export function guardianCanHit(distance:number,vertical:number,lineClear:boolean):boolean {
 return distance<9&&Math.abs(vertical)<2.2&&lineClear;
}
