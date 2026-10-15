import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {World} from './World';
/** Small in-world vendor. Uses the player's existing animated GLTF, not geometric humanoids. */
export class ShopStall {
 readonly position:THREE.Vector3;
 private readonly root=new THREE.Group();
 private mixer:THREE.AnimationMixer|null=null;
 constructor(world:World){
  this.position=new THREE.Vector3(-12,world.height(-12,9),9);
  this.root.position.copy(this.position);
  this.root.name='Mercador do Campo';world.group.add(this.root);
  const wood=new THREE.MeshStandardMaterial({color:0x76462f,roughness:.94});
  const warm=new THREE.MeshStandardMaterial({color:0x9b5a3c,roughness:.8});
  const cloth=new THREE.MeshStandardMaterial({color:0xc75e44,roughness:.88,side:THREE.DoubleSide});
  const gold=new THREE.MeshStandardMaterial({color:0xf6c472,roughness:.5,emissive:0xc78e3c,emissiveIntensity:.12});
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
   mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=true;this.root.add(mesh);return mesh;
  };
  // Front faces spawn, counter, canopy and colorful crates.
  box(0,.68,0,3.9,.72,1.12,wood);
  box(0,1.04,-.05,4.05,.11,1.3,warm);
  for(const x of [-2.05,2.05]){
   box(x,1.65,-.78,.18,3.3,.18,wood);
   box(x,1.65,.70,.18,3.3,.18,wood);
  }
  const canopy=box(0,3.34,0,4.9,.16,2.7,cloth);canopy.rotation.z=-.06;
  box(0,2.46,.79,2.55,.42,.13,wood);
  for(let i=0;i<6;i++){
   const x=-1.6+i*.6;
   const jug=new THREE.Mesh(new THREE.SphereGeometry(.16,12,10),new THREE.MeshStandardMaterial({color:i%2?0x49bbd6:0xb73e4b,roughness:.22,metalness:.15}));
   jug.position.set(x,1.28,.05);this.root.add(jug);
  }
  for(const x of [-1.98,1.98]){
   const lamp=new THREE.PointLight(0xffc778,.75,5,1.8);lamp.position.set(x,2.45,.45);this.root.add(lamp);
   const glow=new THREE.Mesh(new THREE.IcosahedronGeometry(.13,1),gold);glow.position.copy(lamp.position);this.root.add(glow);
  }
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=142;
  const ctx=canvas.getContext('2d');if(ctx){
   ctx.fillStyle='#503423';ctx.fillRect(0,0,640,142);ctx.strokeStyle='#f4ce79';ctx.lineWidth=9;ctx.strokeRect(9,9,622,124);
   ctx.fillStyle='#ffdda1';ctx.textAlign='center';ctx.font='bold 64px Arial';ctx.fillText('MERCADOR',320,95);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.42,.54),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  sign.position.set(0,2.46,.87);this.root.add(sign);
  void this.loadMerchant();
 }
 private async loadMerchant():Promise<void>{
  try{
   const loader=new GLTFLoader();
   const [model,motion,texture]=await Promise.all([
    loader.loadAsync('/models/hero/Superhero_Male_FullBody.gltf'),
    loader.loadAsync('/models/anims/ual1.glb'),
    new THREE.TextureLoader().loadAsync('/models/hero/T_Origens_Gi_terraqueo.png')
   ]);
   const person=model.scene;
   person.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    node.castShadow=true;
    const mats=Array.isArray(node.material)?node.material:[node.material];
    for(const m of mats)if(m instanceof THREE.MeshStandardMaterial&&m.name==='MI_Superhero_Male'){
     const cloned=m.clone();texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;
     cloned.map=texture;cloned.needsUpdate=true;
     node.material=cloned;
    }
   });
   person.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(person);const size=bounds.getSize(new THREE.Vector3());
   const scale=1.65/Math.max(1,size.y);
   person.scale.setScalar(scale);person.rotation.y=Math.PI;
   person.position.set(-(bounds.min.x+size.x*.5)*scale,-bounds.min.y*scale,-.42);
   this.root.add(person);
   const idle=motion.animations.find(c=>c.name.toLowerCase().includes('idle_loop'));
   if(idle){this.mixer=new THREE.AnimationMixer(person);this.mixer.clipAction(idle).play();}
  }catch(e){console.warn('Mercador: modelo indisponível; a loja permanece acessível.',e);}
 }
 update(dt:number){this.mixer?.update(dt);}
 near(pos:THREE.Vector3){return Math.hypot(pos.x-this.position.x,pos.z-this.position.z)<8.3&&Math.abs(pos.y-this.position.y)<4.3;}
}
