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
  // Real custom tapered meshes, fitted to the actual skinned head; no spheres/cones pretending to be hair.
  // A root clump has six-sided sections and bends along an authored Bézier-like strand path.
  const shade=new THREE.MeshStandardMaterial({color:a.hairColor,roughness:.82,flatShading:false,metalness:.02});
  const cap=mesh(new THREE.SphereGeometry(1,28,14,0,Math.PI*2,0,Math.PI*.51),shade,center.x,top-size.y*.16,center.z,width*1.08,size.y*.47,depth*1.13);
  cap.name='HairScalp';
  const many=a.hair===1?14:a.hair===2?26:20;
  const createClump=(points:THREE.Vector3[],thick:number,shapeId:number)=>{
    const positions:number[]=[],normals:number[]=[],colors:number[]=[],indices:number[]=[];
    const segments=9,sides=7;
    const spline=new THREE.CatmullRomCurve3(points);
    const col=new THREE.Color(a.hairColor);
    for(let i=0;i<=segments;i++){
      const t=i/segments,at=spline.getPoint(t),tangent=spline.getTangent(t).normalize();
      const axis=new THREE.Vector3(0,0,1);
      if(Math.abs(tangent.dot(axis))>.94)axis.set(0,1,0);
      const side1=new THREE.Vector3().crossVectors(tangent,axis).normalize();
      const side2=new THREE.Vector3().crossVectors(tangent,side1).normalize();
      const radius=thick*(.16+.84*Math.pow(1-t, .8));
      for(let j=0;j<sides;j++){
        const a0=j/sides*Math.PI*2,rad1=Math.cos(a0)*radius,rad2=Math.sin(a0)*radius*.55;
        const point=at.clone().addScaledVector(side1,rad1).addScaledVector(side2,rad2);
        positions.push(point.x,point.y,point.z);
        const tint=col.clone().multiplyScalar(.78+.22*Math.cos(a0)+.07*(shapeId%3));
        colors.push(tint.r,tint.g,tint.b);normals.push(0,1,0);
        if(i<segments){const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;indices.push(a,c,b,b,c,d);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
    const m=shade.clone();m.vertexColors=true;m.side=THREE.DoubleSide;
    const part=mesh(g,m,0,0,0);part.name=`HairStrand_${shapeId}`;
  };
  for(let i=0;i<many;i++){
    const ring=i%3,theta=i/many*Math.PI*2+ring*.12;
    const spread=a.hair===1?.68:a.hair===2?1.0:1.18;
    const length=size.y*(a.hair===1?.24:a.hair===2?.48:.42)*(0.75+0.32*Math.sin(i*11.7)**2);
    const x=Math.cos(theta),z=Math.sin(theta);
    const base=new THREE.Vector3(center.x+x*width*(.48+ring*.16),top-size.y*.21,center.z+z*depth*(.58+ring*.10));
    const swoop=a.hair===1?.08:a.hair===2?.18:.24;
    const points=[base,base.clone().add(new THREE.Vector3(x*width*.23,length*.35,z*depth*.22)),base.clone().add(new THREE.Vector3(x*width*spread*.72+swoop*size.y*.15,length*.82,z*depth*.61)),base.clone().add(new THREE.Vector3(x*width*spread+swoop*size.y*.28,length,z*depth*.78))];
    if(a.hair===1){points[2].y-=length*.35;points[3].y-=length*.66;}
    if(a.hair===2){points[2].x+=Math.sin(i*2.27)*width*.28;points[3].x+=Math.sin(i*2.27)*width*.33;}
    createClump(points,size.x*(a.hair===1?.14:.115),i);
  }
  const style=a.beardStyle ?? (a.beard ? 1 : 0);
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
