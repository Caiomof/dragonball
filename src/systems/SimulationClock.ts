/** Fixed simulation steps keep physics, timers and animation in agreement on slower frames. */
export class SimulationClock {
 private remainder=0;
 readonly step=1/60;
 advance(seconds:number):number[] {
  if(!Number.isFinite(seconds)||seconds<0)return [];
  this.remainder+=Math.min(.25,seconds);
  const count=Math.min(15,Math.floor((this.remainder+1e-9)/this.step));
  this.remainder-=count*this.step;
  return Array.from({length:count},()=>this.step);
 }
 reset():void{this.remainder=0;}
}
