import * as THREE from 'three';
import type {Appearance} from '../data/profiles';
import type {RaceId} from '../data/gameConfig';
export function disposeAccessories(group:THREE.Group):void {
 const materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});materials.forEach(m=>m.dispose());group.clear();group.removeFromParent();
}
/** Fit accessories to actual head-weighted vertices, in model coordinates, then attach to the head bone. */
export function buildAccessories(model:THREE.Group,head:THREE.Object3D,a:Appearance,race:RaceId):THREE.Group {
 model.updateMatrixWorld(true);
 let box=head.userData.accessoryBounds as THREE.Box3|undefined;
 if(!box){
  box=new THREE.Box3();const point=new THREE.Vector3();
  model.traverse(o=>{
   if(!(o instanceof THREE.SkinnedMesh))return;
   o.skeleton.update();const index=o.skeleton.bones.indexOf(head as THREE.Bone);if(index<0)return;
   const positions=o.geometry.attributes.position,indices=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight;
   if(!indices||!weights)return;
   for(let i=0;i<positions.count;i++){
    let weight=0;for(let k=0;k<4;k++)if(indices.getComponent(i,k)===index)weight+=weights.getComponent(i,k);
    if(weight<.65)continue;
    point.fromBufferAttribute(positions,i);o.applyBoneTransform(i,point);o.localToWorld(point);model.worldToLocal(point);box!.expandByPoint(point);
   }
  });
  if(box.isEmpty()){const p=model.worldToLocal(head.getWorldPosition(new THREE.Vector3()));box.set(p.clone().add(new THREE.Vector3(-.09,-.08,-.09)),p.clone().add(new THREE.Vector3(.09,.18,.12)));}
  head.userData.accessoryBounds=box.clone();
 }
 const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const width=size.x*.51,depth=size.z*.50,top=box.max.y;
 const root=new THREE.Group();root.name='AppearanceAccessories';model.add(root);
 const hair=new THREE.MeshStandardMaterial({color:a.hairColor,roughness:.85});
 const skin=new THREE.MeshStandardMaterial({color:race==='namekuseijin'?0x74bb63:0xef9dc0,roughness:.8});
 const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{
  const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;root.add(o);return o;
 };
 if(race==='saiyajin'||race==='terraqueo'){
  const cap=mesh(new THREE.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI*.53),hair,center.x,top-size.y*.25,center.z,width*1.06,size.y*(a.hair===1?.27:.34),depth*1.04);
  cap.name='HairCap';
  const locks=a.hair===1?9:a.hair===2?13:10;
  for(let i=0;i<locks;i++){
   const theta=i/locks*Math.PI*2;
   const length=size.y*(a.hair===0?.55:a.hair===2?.34:.13)*(1+(i%3)*.12);
   const lock=mesh(new THREE.ConeGeometry(width*.36,length,5),hair,center.x+Math.cos(theta)*width*.65,top+length*.20,center.z+Math.sin(theta)*depth*.6);
   lock.rotation.z=-Math.cos(theta)*(a.hair===0?.55:.85);lock.rotation.x=Math.sin(theta)*.5;
   lock.name=`HairLock${i}`;
  }
  const style=a.beardStyle;
  if(style>0){
   // A tapered jaw surface follows the cheeks instead of adding round facial blobs.
   const vertices:number[]=[],indices:number[]=[],segments=24,rings=5;
   const span=style===2?.48:1.38;
   for(let row=0;row<=rings;row++)for(let col=0;col<=segments;col++){
    const theta=(col/segments*2-1)*span,t=row/rings;
    const edge=Math.abs(Math.sin(theta));
    const high=box.min.y+size.y*(.26+edge*.18);
    const low=box.min.y+size.y*(style===3?-.04:style===2?-.06:.08)+edge*size.y*.17;
    const radius=1.03-t*(style===1?.12:.35);
    vertices.push(center.x+Math.sin(theta)*width*radius,THREE.MathUtils.lerp(high,low,t),center.z+Math.cos(theta)*depth*(1.02-t*.12));
    if(row<rings&&col<segments){const n=row*(segments+1)+col;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}
   }
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const beardMaterial=hair.clone();beardMaterial.side=THREE.DoubleSide;
   const beard=mesh(geometry,beardMaterial,0,0,0);beard.name='Beard';
   for(const side of [-1,1]){
    const moustache=mesh(new THREE.SphereGeometry(1,12,8),hair,center.x+side*width*.19,box.min.y+size.y*.36,box.max.z+depth*.035,width*.24,size.y*.036,depth*.11);
    moustache.rotation.z=-side*.15;moustache.name='Moustache';
   }
  }
 }else if(race==='namekuseijin'){
  for(const side of [-1,1]){
   const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(center.x+side*width*.40,top-size.y*.17,box.max.z-depth*.14),new THREE.Vector3(center.x+side*width*.48,top+size.y*.03,box.max.z+depth*.12),new THREE.Vector3(center.x+side*width*.65,top+size.y*.10,box.max.z+depth*.35)]);
   const antenna=mesh(new THREE.TubeGeometry(curve,12,width*.065,7,false),skin,0,0,0);antenna.name='Antenna';
   const ear=mesh(new THREE.ConeGeometry(width*.40,width*.95,5),skin,center.x+side*width*1.2,center.y,center.z);ear.rotation.z=-side*Math.PI/2;
  }
 }else{
  const tentacle=mesh(new THREE.CapsuleGeometry(width*.30,size.y*.65,6,10),skin,center.x+width*.2,top+size.y*.2,center.z);tentacle.rotation.z=-.45;tentacle.name='MajinCrest';
 }
 // Transform each accessory from model coordinates into the animated bone's local frame.
 model.updateMatrixWorld(true);head.attach(root);return root;
}
