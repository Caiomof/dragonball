import {headingForVelocity,turnToward,biteCanReach} from '../systems/combatRules';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { World } from './World';

type Kind='wolf'|'deer'|'scorpion'|'hare'|'bandit';
const CREATURE_LABELS: Record<Kind, string> = { wolf: 'LOBO', deer: 'VEADO', scorpion: 'ESCORPIÃO', hare: 'LEBRE', bandit:'SAQUEADOR DA FRONTEIRA' };

function raySphere(origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, radius: number): number | null {
  const delta = center.clone().sub(origin);
  const projection = delta.dot(dir);
  const discriminant = radius * radius - (delta.lengthSq() - projection * projection);
  if (discriminant < 0) return null;
  const near = projection - Math.sqrt(discriminant);
  const far = projection + Math.sqrt(discriminant);
  return near >= 0 ? near : far >= 0 ? far : null;
}
type Animal={kind:Kind;hostile:boolean;health:number;maxHealth:number;group:THREE.Group;home:THREE.Vector3;respawn:number;biteAt:number;windup:number;hit:number;wander:number;mixer?:THREE.AnimationMixer;actions:Map<string,THREE.AnimationAction>;current?:THREE.AnimationAction;visual?:THREE.Group;speed:number};

const HIT_Y: Record<Kind, number> = { wolf: 1.12, deer: 1.38, scorpion: 0.42, hare: 0.48,bandit:1.4 };
const HIT_R: Record<Kind, number> = { wolf: 1.55, deer: 1.35, scorpion: 0.95, hare: 0.75,bandit:1.05 };
export class Wildlife {
 private readonly animals:Animal[]=[];
 private elapsed=0;
 readonly ready:Promise<void>;
 constructor(private readonly world:World){
  this.spawn('wolf',new THREE.Vector3(-31,0,-30),true,70);
  this.spawn('wolf',new THREE.Vector3(10,0,-44),true,70);
  this.spawn('deer',new THREE.Vector3(-20,0,20),false,40);
  this.spawn('deer',new THREE.Vector3(24,0,-36),false,40);
  this.spawn('deer',new THREE.Vector3(-45,0,37),false,40);
  this.spawn('wolf',new THREE.Vector3(57,0,-48),true,85);
  this.spawn('deer',new THREE.Vector3(50,0,58),false,40);
  this.spawn('scorpion',new THREE.Vector3(-96,0,-8),true,48);
  this.spawn('scorpion',new THREE.Vector3(-128,0,12),true,48);
  this.spawn('scorpion',new THREE.Vector3(-110,0,-36),true,42);
  this.spawn('hare',new THREE.Vector3(18,0,108),false,28);
  this.spawn('hare',new THREE.Vector3(48,0,126),false,28);
  this.spawn('hare',new THREE.Vector3(-6,0,118),false,26);
  this.spawn('bandit',new THREE.Vector3(75,0,-66),true,140);
  this.spawn('bandit',new THREE.Vector3(-64,0,-61),true,140);
  this.ready=this.loadAnimals();
 }
 private async loadAnimals():Promise<void>{
  const loader=new GLTFLoader();
  await Promise.all([this.loadBandits(),...(['wolf','deer'] as const).map(async kind=>{
   const uri=`/models/wildlife/${kind}.glb`;
   const asset=await loader.loadAsync(uri);
   for(const animal of this.animals.filter(a=>a.kind===kind)){
    const display=cloneSkeleton(asset.scene) as THREE.Group;
    display.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    const bounds=new THREE.Box3().setFromObject(display),dims=bounds.getSize(new THREE.Vector3());
    const scale=(kind==='wolf'?1.25:2.3)/dims.y;
    display.scale.setScalar(scale);
    display.position.set(-(bounds.min.x+dims.x*.5)*scale,-bounds.min.y*scale,-(bounds.min.z+dims.z*.5)*scale);
    // Both bundled models face +Z. The logical heading uses this same axis.
    animal.group.clear();animal.group.add(display);animal.visual=display;
    animal.mixer=new THREE.AnimationMixer(display);
    for(const clip of asset.animations){
     const action=animal.mixer.clipAction(clip);
     if(/attack|hit|death/.test(clip.name)){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}
     animal.actions.set(clip.name.toLowerCase(),action);
    }
    this.play(animal,'idle');
   }
  })]);
 }
 private async loadBandits():Promise<void>{
  try{
   const loader=new GLTFLoader();
   const [model,library,texture]=await Promise.all([
    loader.loadAsync('/models/hero/Superhero_Male_FullBody.gltf'),
    loader.loadAsync('/models/anims/ual1.glb'),
    new THREE.TextureLoader().loadAsync('/models/hero/T_Origens_Gi_terraqueo.png')
   ]);
   texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;
   for(const animal of this.animals.filter(a=>a.kind==='bandit')){
    const display=cloneSkeleton(model.scene) as THREE.Group;
    display.traverse(o=>{
     if(!(o instanceof THREE.Mesh))return;
     o.castShadow=true;o.receiveShadow=true;
     const mats=Array.isArray(o.material)?o.material:[o.material];
     const replacements=mats.map(m=>{const c=m.clone();if(c instanceof THREE.MeshStandardMaterial&&c.name==='MI_Superhero_Male'){c.map=texture;c.color.set('#aa8080');c.needsUpdate=true;}return c;});
     o.material=Array.isArray(o.material)?replacements:replacements[0];
    });
    display.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(display),size=bounds.getSize(new THREE.Vector3()),scale=2.05/Math.max(0.1,size.y);
    display.scale.setScalar(scale);display.rotation.y=Math.PI;
    display.position.set(-(bounds.min.x+size.x*.5)*scale,-bounds.min.y*scale,-(bounds.min.z+size.z*.5)*scale);
    animal.group.add(display);animal.visual=display;
    animal.mixer=new THREE.AnimationMixer(display);
    for(const clip of library.animations){
     const key=clip.name.toLowerCase().split('|').pop()!;
     const action=animal.mixer.clipAction(clip);
     if(/punch|hit_|death/.test(key)){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}
     animal.actions.set(key,action);
    }
    this.play(animal,'idle');
   }
  }catch(error){console.warn('Modelo dos saqueadores indisponível',error);}
 }
 private play(animal:Animal,name:string):void{
  const key=animal.kind==='bandit'?({idle:'idle_loop',walk:'walk_loop',run:'sprint_loop',attack:'punch_jab',hit:'hit_body',death:'death'} as Record<string,string>)[name]??name:name;
  const target=animal.actions.get(key)??animal.actions.get(name)??animal.actions.get(name==='run'?'move':'walk')??animal.actions.get('move')??animal.actions.get('idle_loop')??animal.actions.get('idle');
  if(target&&target!==animal.current){animal.current?.fadeOut(.18);target.reset().setEffectiveWeight(1).fadeIn(.18).play();animal.current=target;}
 }
 update(dt:number,player:THREE.Vector3,bite:(amount:number)=>void):void{
  this.elapsed+=dt;
  for(const a of this.animals){
   if(a.respawn>0){
    a.respawn-=dt;a.mixer?.update(dt);
    a.group.rotation.z=THREE.MathUtils.damp(a.group.rotation.z,1.45,5,dt);
    a.group.visible=a.respawn>23.5;
    if(a.respawn<=0){a.health=a.maxHealth;a.group.visible=true;a.group.rotation.z=0;a.group.position.copy(a.home);a.group.position.y=this.world.height(a.home.x,a.home.z);this.play(a,'idle');}
    continue;
   }
   a.hit=Math.max(0,a.hit-dt);
   const pos=a.group.position,delta=player.clone().sub(pos),vertical=Math.abs(delta.y);
   delta.y=0;const distance=delta.length();const direction=new THREE.Vector3();
   let desiredSpeed=0;
   const lineClear=distance<.01||this.world.trace(pos.clone().add(new THREE.Vector3(0,.8,0)),delta.clone().normalize(),distance).distance>=distance-.4;
   if(a.windup>0){
    const previous=a.windup;a.windup=Math.max(0,a.windup-dt);
    if(previous>.18&&a.windup<=.18&&biteCanReach(distance,vertical,lineClear))bite(8);
   }else if(a.hostile&&distance<17&&vertical<2.8&&pos.distanceTo(a.home)<30){
    direction.copy(delta).normalize();desiredSpeed=distance>2?4.3:0;
    if(biteCanReach(distance,vertical,lineClear)&&this.elapsed>a.biteAt){a.windup=.6;a.biteAt=this.elapsed+1.5;this.play(a,'attack');}
   }else if(!a.hostile&&distance<9){direction.copy(delta).normalize().negate();desiredSpeed=4.7;}
   else {
    a.wander+=dt;
    const period=a.wander%12;
    if(period<8){const angle=a.wander*.18+a.home.x;direction.set(Math.sin(angle),0,Math.cos(angle));desiredSpeed=.8;}
    if(pos.distanceTo(a.home)>11){direction.copy(a.home).sub(pos).setY(0).normalize();desiredSpeed=1.2;}
   }
   if(a.hit>0)desiredSpeed=0;
   a.speed=THREE.MathUtils.damp(a.speed,desiredSpeed,5,dt);
   const before=pos.clone();
   if(a.speed>.03){
    let moved=false;
    for(const angle of [0,.65,-.65,1.25,-1.25]){
     const step=direction.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle).multiplyScalar(a.speed*dt);
     const next=pos.clone().add(step);
     if(this.world.isWalkable(next.x,next.z,.6)&&this.world.depth(next.x,next.z)<.25){
      const h=this.world.height(next.x,next.z);
      if(Math.abs(h-pos.y)>Math.max(.15,step.length()*.8))continue;
      pos.copy(next);pos.y=h;moved=true;break;
     }
    }
    if(!moved)a.speed=0;
   }
   const actual=pos.clone().sub(before);const speed=actual.length()/Math.max(dt,.001);
   if(speed>.04){const target=headingForVelocity(actual.x,actual.z);a.group.rotation.y=turnToward(a.group.rotation.y,target,dt);}
   if(a.windup<=0&&a.hit<=0)this.play(a,speed>.05?(speed>2?'run':'walk'):'idle');
   if(speed>.05&&a.windup<=0)a.current?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed/(speed>2?4:1.1),.65,1.35));else a.current?.setEffectiveTimeScale(1);
   a.mixer?.update(dt);
   // Restrained additive lunge/recoil for the wolf's two-clip source asset.
   if(a.visual){const pitch=a.windup>0?Math.sin((.6-a.windup)/.6*Math.PI)*.18:a.hit>0?-.12:0;a.visual.rotation.x=THREE.MathUtils.damp(a.visual.rotation.x,pitch,12,dt);}
  }
 }
 private hurt(a:Animal,amount:number):{actual:number;dead:boolean}{
  const actual=Math.min(a.health,Math.max(0,amount));a.health-=actual;a.hit=.3;a.windup=0;this.play(a,'hit');
  if(a.health<=0){a.respawn=25;this.play(a,'death');}return{actual,dead:a.health<=0};
 }
 damageAlong(from:THREE.Vector3,to:THREE.Vector3,radius:number,amount:number) :{actual:number;dead:boolean;kind:Kind;point:THREE.Vector3}|null{
  const segment=to.clone().sub(from),length=segment.length();if(length<.001)return this.damageAt(to,amount,radius);
  segment.divideScalar(length);let best:Animal|undefined;let bestGap=radius;
  for(const a of this.animals){if(a.health<=0)continue;const center=this.hitCenter(a);const along=THREE.MathUtils.clamp(center.clone().sub(from).dot(segment),0,length);const closest=from.clone().addScaledVector(segment,along);const gap=center.distanceTo(closest);const limit=HIT_R[a.kind]+radius*.4;if(gap<limit&&gap<bestGap){bestGap=gap;best=a;}}
  if(!best)return null;const result=this.hurt(best,amount);return{...result,kind:best.kind,point:best.group.position.clone().add(new THREE.Vector3(0,1,0))};
 }
 strike(origin:THREE.Vector3,direction:THREE.Vector3,reach:number,amount:number) :{actual:number;dead:boolean;kind:Kind;point:THREE.Vector3}|null{
  let best:Animal|undefined;let nearest=reach;
  for(const a of this.animals){if(a.health<=0)continue;const center=this.hitCenter(a);const delta=center.clone().sub(origin),d=delta.length();if(d>nearest+HIT_R[a.kind]||delta.normalize().dot(direction)<.38)continue;if(this.world.trace(origin,delta.normalize(),d).distance<d-HIT_R[a.kind]*.45)continue;best=a;nearest=d;}
  if(!best)return null;const result=this.hurt(best,amount);return{...result,kind:best.kind,point:best.group.position.clone().add(new THREE.Vector3(0,1,0))};
 }
 private hitCenter(a: Animal): THREE.Vector3 {
  return a.group.position.clone().add(new THREE.Vector3(0, HIT_Y[a.kind], 0));
 }

 traceRay(origin: THREE.Vector3, direction: THREE.Vector3, maxDist: number): { distance: number; point: THREE.Vector3 } | null {
  const dir = direction.clone().normalize();
  let best: number | null = null;
  for (const a of this.animals) {
    if (a.health <= 0) continue;
    const center = this.hitCenter(a);
    const t = raySphere(origin, dir, center, HIT_R[a.kind]);
    if (t === null || t > maxDist) continue;
    const block = this.world.trace(origin, dir, t + 0.08);
    if ((block.objectId !== undefined || block.dummy) && block.distance < t - 0.14) continue;
    if (!block.objectId && !block.dummy && block.distance < t - 0.18) continue;
    if (best === null || t < best) best = t;
  }
  if (best === null) return null;
  return { distance: best, point: origin.clone().addScaledVector(dir, best) };
 }

 aimFocus(origin: THREE.Vector3, direction: THREE.Vector3, maxDist: number): { label: string; health: number; maxHealth: number; distance: number } | null {
  const dir = direction.clone().normalize();
  let best: { distance: number; animal: Animal } | null = null;
  for (const a of this.animals) {
    if (a.health <= 0) continue;
    const center = this.hitCenter(a);
    const t = raySphere(origin, dir, center, HIT_R[a.kind]);
    if (t === null || t > maxDist) continue;
    const block = this.world.trace(origin, dir, t + 0.08);
    const blocked = (block.objectId !== undefined || block.dummy) && block.distance < t - 0.12;
    const terrainBlock = !block.objectId && !block.dummy && block.distance < t - 0.12;
    if (blocked || terrainBlock) continue;
    if (!best || t < best.distance) best = { distance: t, animal: a };
  }
  if (!best) return null;
  const a = best.animal;
  return { label: CREATURE_LABELS[a.kind], health: a.health, maxHealth: a.maxHealth, distance: best.distance };
 }

 damageAt(point:THREE.Vector3,amount:number,radius=3.4) :{actual:number;dead:boolean;kind:Kind;point:THREE.Vector3}|null{
  let best:Animal|undefined;let nearest=radius;
  for(const a of this.animals){if(a.health<=0)continue;const center=this.hitCenter(a);const d=center.distanceTo(point);const limit=radius+HIT_R[a.kind]*.5;if(d<limit&&d<nearest){nearest=d;best=a;}}
  if(!best)return null;const result=this.hurt(best,amount);return{...result,kind:best.kind,point:best.group.position.clone().add(new THREE.Vector3(0,1,0))};
 }
 private spawn(kind:Kind,home:THREE.Vector3,hostile:boolean,health:number):void{
  const group=new THREE.Group();group.name=`Wildlife_${kind}`;home.y=this.world.height(home.x,home.z);group.position.copy(home);this.world.group.add(group);
  group.visible=true;
  if(kind==='scorpion')group.add(this.buildScorpion());
  if(kind==='hare')group.add(this.buildHare());
  this.animals.push({kind,hostile,health,maxHealth:health,group,home:home.clone(),respawn:0,biteAt:0,windup:0,hit:0,wander:home.x*.2,actions:new Map(),speed:0});
 }
 private buildScorpion():THREE.Group{
  const body=new THREE.Group();
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
  const g=canvas.getContext('2d')!;
  g.fillStyle='#b86a2e';g.fillRect(0,0,128,64);
  for(let i=0;i<8;i++){g.fillStyle=i%2?'#8d4c1c':'#d08945';g.fillRect(i*16,0,8,64);}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const shell=new THREE.MeshStandardMaterial({map,color:0xffffff,roughness:.62});
  const dark=new THREE.MeshStandardMaterial({color:0x4a2414,roughness:.75});
  const torso=new THREE.Mesh(new THREE.SphereGeometry(.34,16,12),shell);
  torso.scale.set(1.7,.72,1.05);body.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.16,12,10),shell);
  head.position.set(.55,.02,0);body.add(head);
  for(const side of [-1,1]){
   const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),new THREE.MeshStandardMaterial({color:0x1a120c,roughness:.3}));
   eye.position.set(.66,.08,side*.07);body.add(eye);
   const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.035,.28,4,6),dark);
   arm.position.set(.42,.02,side*.28);arm.rotation.z=side*.4;body.add(arm);
   const claw=new THREE.Mesh(new THREE.ConeGeometry(.07,.16,6),dark);
   claw.position.set(.5,.02,side*.42);claw.rotation.z=side*1.2;body.add(claw);
   for(let leg=0;leg<4;leg++){
    const limb=new THREE.Mesh(new THREE.CapsuleGeometry(.018,.22,3,5),dark);
    limb.position.set(-.28+leg*.16,-.12,side*.22);
    limb.rotation.z=side*(.7+leg*.05);body.add(limb);
   }
  }
  let prev=new THREE.Vector3(-.4,.05,0);
  for(let i=1;i<=6;i++){
   const tip=new THREE.Vector3(-.4-i*.11,.05+i*i*.025,0);
   const seg=new THREE.Mesh(new THREE.SphereGeometry(.07-.005*i,8,6),shell);
   seg.position.copy(prev).lerp(tip,.5);body.add(seg);
   prev=tip;
  }
  const stinger=new THREE.Mesh(new THREE.ConeGeometry(.035,.12,6),dark);
  stinger.position.copy(prev);stinger.rotation.z=1.2;body.add(stinger);
  body.position.y=.28;body.rotation.y=-Math.PI/2;body.scale.setScalar(1.45);
  return body;
 }
 private buildHare():THREE.Group{
  const body=new THREE.Group();
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
  const g=canvas.getContext('2d')!;
  g.fillStyle='#f4f7fb';g.fillRect(0,0,64,64);
  g.fillStyle='#d5dde6';
  for(let i=0;i<40;i++)g.fillRect((i*17)%60,(i*13)%60,3,2);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const fur=new THREE.MeshStandardMaterial({map,color:0xffffff,roughness:.72});
  const inner=new THREE.MeshStandardMaterial({color:0xf3b7c4,roughness:.6});
  const dark=new THREE.MeshStandardMaterial({color:0x2a2428,roughness:.4});
  const torso=new THREE.Mesh(new THREE.SphereGeometry(.32,16,12),fur);
  torso.scale.set(1.45,.8,.85);body.add(torso);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(.2,12,10),fur);
  chest.position.set(.28,.02,0);body.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.18,14,12),fur);
  head.position.set(.52,.1,0);body.add(head);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),inner);
  nose.position.set(.68,.08,0);body.add(nose);
  for(const side of [-1,1]){
   const eye=new THREE.Mesh(new THREE.SphereGeometry(.028,8,8),dark);
   eye.position.set(.62,.16,side*.07);body.add(eye);
   const ear=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.42,4,6),fur);
   ear.position.set(.48,.48,side*.08);ear.rotation.z=-side*.15;body.add(ear);
   const earIn=new THREE.Mesh(new THREE.CapsuleGeometry(.022,.28,3,5),inner);
   earIn.position.set(.5,.5,side*.08);body.add(earIn);
   for(const step of [0.15,-0.22]){
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.04,.2,3,5),fur);
    leg.position.set(step,-.22,side*.12);body.add(leg);
    const paw=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),fur);
    paw.position.set(step,-.36,side*.12);body.add(paw);
   }
  }
  const tail=new THREE.Mesh(new THREE.SphereGeometry(.1,10,8),fur);
  tail.position.set(-.42,.05,0);body.add(tail);
  body.position.y=.48;body.rotation.y=-Math.PI/2;body.scale.setScalar(1.55);
  return body;
 }
 debug(){return this.animals.map(a=>({kind:a.kind,position:a.group.position.toArray(),heading:a.group.rotation.y,health:a.health,speed:a.speed,animation:a.current?.getClip().name}));}
}
