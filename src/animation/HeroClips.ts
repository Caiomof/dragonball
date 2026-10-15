import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
/** Author dedicated clips on a scratch skeleton. Runtime playback uses AnimationMixer only. */
export function createHeroClips(source:THREE.Group,library:THREE.AnimationClip[]):THREE.AnimationClip[]{
 const rig=cloneSkeleton(source) as THREE.Group;rig.updateMatrixWorld(true);
 const mixer=new THREE.AnimationMixer(rig);
 const idle=library.find(c=>c.name.toLowerCase().split('|').pop()==='idle_loop');
 if(!idle)return [];
 const action=mixer.clipAction(idle).play();
 const bones:THREE.Bone[]=[];rig.traverse(o=>{if(o instanceof THREE.Bone)bones.push(o);});
 const aim=(name:string,childName:string,direction:THREE.Vector3)=>{
  const bone=rig.getObjectByName(name),child=rig.getObjectByName(childName);if(!bone||!child)return;
  rig.updateMatrixWorld(true);
  const current=child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
  const correction=new THREE.Quaternion().setFromUnitVectors(current,direction.normalize());
  const world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(correction);
  const parent=bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(world));bone.updateMatrixWorld(true);
 };
 const clips:THREE.AnimationClip[]=[];
 const names=['flight_hover','flight_cruise','flight_takeoff','flight_brake','power_charge','charge_kamehameha','charge_galick','charge_masenko','charge_kienzan','release_kamehameha','release_galick','release_masenko','release_kienzan'];
 for(const name of names){
  const release=name.startsWith('release');const duration=release?.55:name==='flight_takeoff'?.55:2.4;
  const times=Array.from({length:17},(_,i)=>i/16*duration);
  const rotations=new Map<string,number[]>(),positions=new Map<string,number[]>();
  for(const t of times){
   action.reset();mixer.setTime(0.4);rig.updateMatrixWorld(true);
   const breath=Math.sin(t/duration*Math.PI*2)*.025;
   const flight=name.startsWith('flight');
   for(const side of ['l','r']){
    const sign=side==='l'?1:-1;
    let upper=new THREE.Vector3(sign*.25,-.95,.15),lower=new THREE.Vector3(sign*.1,-.9,.3);
    if(name==='flight_cruise'){upper.set(sign*.13,-.9,-.42);lower.set(sign*.07,-.98,.04);}
    else if(name==='flight_takeoff'){upper.set(sign*.25,-.78,-.2);lower.set(sign*.2,-.75,.45);}
    else if(name==='flight_brake'){upper.set(sign*.45,-.5,.65);lower.set(sign*.05,-.25,.97);}
    else if(name==='power_charge'){upper.set(sign*.52,-.8,.15);lower.set(-sign*.12,-.55,.8);}
    else if(!flight){
     if(name.includes('masenko')){upper.set(sign*.55,.6,.5);lower.set(-sign*.4,.65,.65);}
     else if(name.includes('kienzan')){upper.set(sign*.35,side==='r'?.9:-.85,.2);lower.set(0,side==='r'?1:-.6,.3);}
     else if(name.includes('galick')){upper.set(sign*.6,-.3,.6);lower.set(-sign*.5,.45,.65);}
     else {upper.set(sign*.65,-.65,.4);lower.set(-sign*.5,.25,.8);}
     if(release){const pulse=Math.sin(Math.min(1,t/duration*1.7)*Math.PI/2);upper.lerp(new THREE.Vector3(sign*.18,-.12,1),pulse);lower.lerp(new THREE.Vector3(-sign*.05,.05,1),pulse);}
    }
    upper.y+=breath;aim(`upperarm_${side}`,`lowerarm_${side}`,upper);aim(`lowerarm_${side}`,`hand_${side}`,lower);
    // Slightly flexed knees and spread stance for balance; never overwrite mixer bones at runtime.
    if(flight||name==='power_charge'){
     aim(`thigh_${side}`,`calf_${side}`,new THREE.Vector3(sign*.13,-1,flight?-.12:.18));
     aim(`calf_${side}`,`foot_${side}`,new THREE.Vector3(0,-1,flight?-.18:-.22));
    }
   }
   for(const bone of bones){
    const q=rotations.get(bone.name)??[];bone.quaternion.toArray(q,q.length);rotations.set(bone.name,q);
    const p=positions.get(bone.name)??[];bone.position.toArray(p,p.length);positions.set(bone.name,p);
   }
  }
  const tracks:THREE.KeyframeTrack[]=[];
  for(const bone of bones){tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`,times,rotations.get(bone.name)!));tracks.push(new THREE.VectorKeyframeTrack(`${bone.name}.position`,times,positions.get(bone.name)!));}
  clips.push(new THREE.AnimationClip(name,duration,tracks));
 }
 mixer.stopAllAction();mixer.uncacheRoot(rig);return clips;
}
