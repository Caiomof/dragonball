import * as THREE from 'three';
import type {World} from '../world/World';
/** Sample the camera boom with a radius; terrain and obstacle checks share world geometry rules. */
export function resolveCamera(world:World,focus:THREE.Vector3,desired:THREE.Vector3):THREE.Vector3 {
 const delta=desired.clone().sub(focus),length=delta.length();
 if(length<.001)return desired;
 const steps=Math.ceil(length/.18);
 let safe=focus.clone();
 for(let i=1;i<=steps;i++) {
  const p=focus.clone().addScaledVector(delta,i/steps);
  if(p.y<world.height(p.x,p.z)+.3 || world.obstacles.some(o=>o.active!==false&&Math.hypot(p.x-o.x,p.z-o.z)<o.radius+.28&&p.y<world.height(o.x,o.z)+(o.height??6)))break;
  safe=p;
 }
 return safe;
}
