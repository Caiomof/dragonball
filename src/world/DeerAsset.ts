import * as THREE from 'three';
/** Original articulated deer, authored for Origens. +Z is forward. No external assets. */
export function createDeer(): {scene:THREE.Group; animations:THREE.AnimationClip[]} {
 const scene=new THREE.Group();scene.name='Origens_Deer';
 const coat=new THREE.MeshStandardMaterial({color:0xa97549,roughness:.95});
 const cream=new THREE.MeshStandardMaterial({color:0xe5d3af,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x302b29,roughness:.8});
 const antler=new THREE.MeshStandardMaterial({color:0x91795a,roughness:1});
 const ellipsoid=(parent:THREE.Object3D,material:THREE.Material,position:number[],scale:number[])=>{
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),material);mesh.position.fromArray(position);mesh.scale.fromArray(scale);mesh.castShadow=true;parent.add(mesh);return mesh;
 };
 const limb=(parent:THREE.Object3D,name:string,x:number,y:number,z:number)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
 const body=limb(scene,'DeerBody',0,1.12,0);
 ellipsoid(body,coat,[0,0,0],[.28,.36,.64]);ellipsoid(body,cream,[0,-.17,.1],[.23,.19,.48]);
 const neck=limb(body,'DeerNeck',0,.14,.43);
 const neckMesh=ellipsoid(neck,coat,[0,.28,.08],[.17,.43,.19]);neckMesh.rotation.x=.25;
 ellipsoid(neck,cream,[0,.20,.21],[.10,.28,.06]);
 const head=limb(neck,'DeerHead',0,.59,.18);
 ellipsoid(head,coat,[0,0,0],[.16,.19,.27]);ellipsoid(head,coat,[0,-.08,.22],[.105,.10,.20]);
 ellipsoid(head,dark,[0,-.07,.395],[.075,.055,.035]);
 for(const side of [-1,1]){
  ellipsoid(head,dark,[side*.14,.035,.12],[.025,.035,.035]);
  const ear=limb(head,`DeerEar${side}`,side*.12,.12,-.07);ear.rotation.z=-side*.8;
  ellipsoid(ear,coat,[0,.16,0],[.075,.22,.045]);ellipsoid(ear,cream,[0,.16,.025],[.047,.16,.025]);
  const horn=limb(head,`DeerAntler${side}`,side*.085,.15,-.07);
  for(let i=0;i<4;i++){
   const piece=new THREE.Mesh(new THREE.CylinderGeometry(.011,.025,.21,6),antler);piece.position.set(side*i*.055,.09+i*.13,-i*.04);piece.rotation.z=-side*.38;horn.add(piece);
   if(i>0){const tine=piece.clone();tine.scale.set(.6,.7,.6);tine.position.add(new THREE.Vector3(-side*.05,.03,.04));tine.rotation.z=side*.7;horn.add(tine);}
  }
 }
 const tail=limb(body,'DeerTail',0,.12,-.58);tail.rotation.x=-.7;ellipsoid(tail,cream,[0,-.1,-.025],[.08,.19,.075]);
 for(const side of [-1,1])for(const front of [true,false]){
  const name=`${front?'Front':'Back'}${side<0?'R':'L'}`;
  const upper=limb(body,`Deer${name}`,side*.19,-.13,front?.39:-.42);
  ellipsoid(upper,coat,[0,-.19,0],[front?.09:.13,.27,.10]);
  const knee=limb(upper,`Deer${name}Knee`,0,-.43,0);
  ellipsoid(knee,coat,[0,-.19,.015],[.043,.23,.045]);
  ellipsoid(knee,dark,[0,-.40,.04],[.055,.07,.09]);
 }
 const clips:THREE.AnimationClip[]=[];
 for(const [name,duration,amplitude] of [['idle',3,0],['walk',1.2,.38],['run',.65,.65],['attack',.7,.2],['hit',.4,.12],['death',.8,0]] as const){
  const tracks:THREE.KeyframeTrack[]=[];const times=Array.from({length:17},(_,i)=>i/16*duration);
  const rotation=(target:string,axis:'x'|'z',values:number[])=>{const q:number[]=[];for(const a of values)new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(axis==='x'?1:0,0,axis==='z'?1:0),a).toArray(q,q.length);tracks.push(new THREE.QuaternionKeyframeTrack(`${target}.quaternion`,times,q));};
  for(const side of ['L','R'])for(const front of [true,false]){
   const target=`Deer${front?'Front':'Back'}${side}`;const phase=(side==='L'?0:Math.PI)+(front?0:Math.PI);
   rotation(target,'x',times.map(t=>Math.sin(t/duration*Math.PI*2+phase)*amplitude));
   rotation(target+'Knee','x',times.map(t=>Math.max(0,Math.sin(t/duration*Math.PI*2+phase+1))*amplitude*.8));
  }
  rotation('DeerNeck','x',times.map(t=>name==='idle'?Math.sin(t/duration*Math.PI*2)*.035:name==='attack'?-.35*Math.sin(t/duration*Math.PI):.06*Math.sin(t/duration*Math.PI*2)));
  rotation('DeerBody','z',times.map(t=>name==='death'?Math.min(1,t/duration)*1.5:name==='hit'?Math.sin(t/duration*Math.PI)*.15:0));
  const pos:number[]=[];for(const t of times)pos.push(0,1.12+(name==='death'?-.65*t/duration:Math.sin(t/duration*Math.PI*4)*amplitude*.055),0);
  tracks.push(new THREE.VectorKeyframeTrack('DeerBody.position',times,pos));
  clips.push(new THREE.AnimationClip(name,duration,tracks));
 }
 return {scene,animations:clips};
}
