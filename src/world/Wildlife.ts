import {headingForVelocity,turnToward,biteCanReach} from '../systems/combatRules';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { World } from './World';

type Kind='wolf'|'deer';
type Animal={kind:Kind;hostile:boolean;health:number;maxHealth:number;group:THREE.Group;home:THREE.Vector3;respawn:number;biteAt:number;windup:number;hit:number;wander:number;mixer?:THREE.AnimationMixer;actions:Map<string,THREE.AnimationAction>;current?:THREE.AnimationAction;visual?:THREE.Group;speed:number};
export class Wildlife {
 private readonly animals:Animal[]=[];
 private elapsed=0;
 readonly ready:Promise<void>;
 constructor(private readonly world:World){
  this.spawn('wolf',new THREE.Vector3(-31,0,-30),true,70);
  this.spawn('wolf',new THREE.Vector3(10,0,-44),true,70);
  this.spawn('deer',new THREE.Vector3(-20,0,20),false,40);
  this.spawn('deer',new THREE.Vector3(60,0,113),false,40);
  this.spawn('wolf',new THREE.Vector3(-108,0,5),true,90);
  this.ready=this.loadAnimals();
 }
 private async loadAnimals():Promise<void>{
  const loader=new GLTFLoader();
  await Promise.all((['wolf','deer'] as const).map(async kind=>{
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
  }));
 }
 private play(animal:Animal,name:string):void{
  const target=animal.actions.get(name)??animal.actions.get(name==='run'?'move':'walk')??animal.actions.get('move')??animal.actions.get('idle');
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
 damageAlong(from:THREE.Vector3,to:THREE.Vector3,radius:number,amount:number):{actual:number;dead:boolean}|null{
  const segment=to.clone().sub(from),length=segment.length();if(length<.001)return this.damageAt(to,amount,radius);
  segment.divideScalar(length);let best:Animal|undefined;let nearest=Infinity;
  for(const a of this.animals){if(a.health<=0)continue;const center=a.group.position.clone().add(new THREE.Vector3(0,.8,0));const along=center.clone().sub(from).dot(segment);if(along<0||along>length)continue;const d=center.distanceTo(from.clone().addScaledVector(segment,along));if(d<radius+.5&&along<nearest){nearest=along;best=a;}}
  return best?this.hurt(best,amount):null;
 }
 strike(origin:THREE.Vector3,direction:THREE.Vector3,reach:number,amount:number):{actual:number;dead:boolean}|null{
  let best:Animal|undefined;let nearest=reach;
  for(const a of this.animals){if(a.health<=0)continue;const delta=a.group.position.clone().add(new THREE.Vector3(0,.8,0)).sub(origin),d=delta.length();if(d>nearest||delta.normalize().dot(direction)<.55)continue;if(this.world.trace(origin,delta,d).distance<d-.3)continue;best=a;nearest=d;}
  return best?this.hurt(best,amount):null;
 }
 damageAt(point:THREE.Vector3,amount:number,radius=2):{actual:number;dead:boolean}|null{const a=this.animals.filter(a=>a.health>0&&a.group.position.distanceTo(point)<radius).sort((a,b)=>a.group.position.distanceToSquared(point)-b.group.position.distanceToSquared(point))[0];return a?this.hurt(a,amount):null;}
 private spawn(kind:Kind,home:THREE.Vector3,hostile:boolean,health:number):void{
  const group=new THREE.Group();group.name=`Wildlife_${kind}`;home.y=this.world.height(home.x,home.z);group.position.copy(home);this.world.group.add(group);
  group.visible=true;
  this.animals.push({kind,hostile,health,maxHealth:health,group,home:home.clone(),respawn:0,biteAt:0,windup:0,hit:0,wander:home.x*.2,actions:new Map(),speed:0});
 }
 debug(){return this.animals.map(a=>({kind:a.kind,position:a.group.position.toArray(),heading:a.group.rotation.y,health:a.health,speed:a.speed,animation:a.current?.getClip().name}));}
}
