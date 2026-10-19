import {headingForVelocity,turnToward,biteCanReach} from '../systems/combatRules';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { prepareGltfScene } from '../rendering/gltfMaterials';
import { attachOutfit, outfitForRole } from '../characters/outfitLoader';
import { biomeAt, waterFootprint } from './landscape';
import type { World } from './World';

type Kind='wolf'|'deer'|'scorpion'|'hare'|'bandit'|'cow'|'bull'|'horse'|'orc'|'blob';
const CREATURE_LABELS: Record<Kind, string> = {
  wolf: 'LOBO', deer: 'VEADO', scorpion: 'ESPECTRO', hare: 'LEBRE', bandit: 'SAQUEADOR DA FRONTEIRA',
  cow: 'VACA', bull: 'BOI', horse: 'CAVALO', orc: 'ORC', blob: 'BOLHA',
};
const BODY_H: Record<Kind, number> = {
  wolf: 1.55, deer: 1.85, scorpion: 2.35, hare: 0.78, bandit: 2.05,
  cow: 1.55, bull: 1.75, horse: 1.85, orc: 3.1, blob: 2.65,
};
const SCALE_BOOST: Partial<Record<Kind, number>> = {
  orc: 1.12, blob: 1.08, scorpion: 1.1, wolf: 1.04,
};

function raySphere(origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, radius: number): number | null {
  const delta = center.clone().sub(origin);
  const projection = delta.dot(dir);
  const discriminant = radius * radius - (delta.lengthSq() - projection * projection);
  if (discriminant < 0) return null;
  const near = projection - Math.sqrt(discriminant);
  const far = projection + Math.sqrt(discriminant);
  return near >= 0 ? near : far >= 0 ? far : null;
}
type Animal={kind:Kind;hostile:boolean;health:number;maxHealth:number;group:THREE.Group;home:THREE.Vector3;respawn:number;biteAt:number;windup:number;hit:number;wander:number;mixer?:THREE.AnimationMixer;actions:Map<string,THREE.AnimationAction>;current?:THREE.AnimationAction;visual?:THREE.Group;speed:number;stuck:number;hud:THREE.Group;fill:THREE.Mesh;ring:THREE.Mesh};

const HIT_Y: Record<Kind, number> = { wolf: 1.2, deer: 1.45, scorpion: 1.2, hare: 0.55, bandit: 1.4, cow: 1.3, bull: 1.4, horse: 1.5, orc: 1.7, blob: 1.15 };
const HIT_R: Record<Kind, number> = { wolf: 1.55, deer: 1.45, scorpion: 1.15, hare: 0.75, bandit: 1.05, cow: 1.45, bull: 1.55, horse: 1.5, orc: 1.35, blob: 1.2 };
export class Wildlife {
 private readonly animals:Animal[]=[];
 private readonly dust: {sprite:THREE.Sprite; life:number}[]=[];
 private dustMap?: THREE.Texture;
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
  this.spawn('cow',new THREE.Vector3(-22,0,14),false,40);
  this.spawn('cow',new THREE.Vector3(-8,0,22),false,40);
  this.spawn('bull',new THREE.Vector3(-28,0,6),false,55);
  this.spawn('horse',new THREE.Vector3(-4,0,18),false,48);
  this.spawn('horse',new THREE.Vector3(6,0,24),false,48);
  const crimsonSpawns: [Kind, number, number, number, number][] = [
    ['orc', 118, -72, 220, 1], ['orc', 142, -88, 240, 1], ['orc', 156, -104, 260, 1],
    ['orc', 108, -98, 200, 1], ['orc', 168, -76, 250, 1], ['orc', 124, -118, 230, 1],
    ['blob', 132, -82, 120, 1], ['blob', 148, -96, 130, 1], ['blob', 112, -108, 110, 1],
    ['blob', 172, -92, 140, 1], ['scorpion', 98, -62, 80, 1], ['scorpion', 178, -110, 90, 1],
    ['scorpion', 138, -128, 85, 1], ['wolf', 88, -54, 95, 1],
  ];
  for (const [kind, x, z, hp, hostile] of crimsonSpawns) {
    this.spawn(kind, new THREE.Vector3(x, 0, z), hostile === 1, hp);
  }
  const roamKinds: Kind[] = ['orc', 'orc', 'blob', 'scorpion', 'wolf', 'orc'];
  let roam = 0;
  for (let i = 0; i < 320 && roam < 34; i++) {
    const x = 52 + (i * 19.7) % 118;
    const z = -138 + (i * 13.1) % 276;
    if (biomeAt(x, z) !== 'crimson' || waterFootprint(x, z)) continue;
    const kind = roamKinds[i % roamKinds.length];
    const hp = kind === 'orc' ? 210 + (i % 5) * 18 : kind === 'blob' ? 115 : kind === 'scorpion' ? 78 : 88;
    this.spawn(kind, new THREE.Vector3(x, 0, z), true, hp);
    roam++;
  }
  this.ready=this.loadAnimals();
 }
 private async loadAnimals():Promise<void>{
  const loader=new GLTFLoader();
  const creatureUri: Partial<Record<Kind, string>> = {
    wolf: '/assets/creatures/animals/wolf/Wolf.gltf',
    deer: '/assets/creatures/animals/deer/Deer.gltf',
    hare: '/assets/creatures/animals/hare/Fox.gltf',
    scorpion: '/assets/creatures/monsters/ghost/Ghost.gltf',
    cow: '/assets/creatures/animals/cow/Cow.gltf',
    bull: '/assets/creatures/animals/bull/Bull.gltf',
    horse: '/assets/creatures/animals/horse/Horse.gltf',
    orc: '/assets/creatures/monsters/orc/Orc.gltf',
    blob: '/assets/creatures/monsters/blob/GreenBlob.gltf',
  };
  await Promise.all([this.loadBandits(),...(['wolf','deer','hare','scorpion','cow','bull','horse','orc','blob'] as const).map(async kind=>{
   const uri=creatureUri[kind] ?? `/models/wildlife/${kind}.glb`;
   const asset=await loader.loadAsync(uri);
   for(const animal of this.animals.filter(a=>a.kind===kind)){
    const display=cloneSkeleton(asset.scene) as THREE.Group;
    display.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    const bounds=new THREE.Box3().setFromObject(display),dims=bounds.getSize(new THREE.Vector3());
    const scale=(BODY_H[kind]??1.6)/Math.max(0.2,dims.y)*(SCALE_BOOST[kind]??1);
    display.scale.setScalar(scale);
    prepareGltfScene(display);
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
    display.scale.setScalar(scale);
    display.position.set(-(bounds.min.x+size.x*.5)*scale,-bounds.min.y*scale,-(bounds.min.z+size.z*.5)*scale);
    animal.group.add(display);animal.visual=display;
    await attachOutfit(display, outfitForRole('bandit', false));
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
  const maps: Partial<Record<Kind, Record<string, string>>> = {
    wolf: { idle: 'idle', walk: 'walk', run: 'gallop', attack: 'attack', hit: 'death', death: 'death' },
    deer: { idle: 'idle', walk: 'walk', run: 'gallop', attack: 'attack_headbutt', hit: 'death', death: 'death' },
    hare: { idle: 'idle', walk: 'walk', run: 'gallop', attack: 'attack_headbutt', hit: 'death', death: 'death' },
    scorpion: { idle: 'flying_idle', walk: 'flying_idle', run: 'fast_flying', attack: 'punch', hit: 'hitreact', death: 'death' },
    cow: { idle: 'idle', walk: 'walk', run: 'gallop', attack: 'attack_headbutt', hit: 'death', death: 'death' },
    bull: { idle: 'idle', walk: 'walk', run: 'gallop', attack: 'attack_headbutt', hit: 'death', death: 'death' },
    horse: { idle: 'idle', walk: 'walk', run: 'gallop', attack: 'attack_headbutt', hit: 'death', death: 'death' },
    orc: { idle: 'idle', walk: 'walk', run: 'run', attack: 'punch', hit: 'hitreact', death: 'death' },
    blob: { idle: 'idle', walk: 'walk', run: 'run', attack: 'attack', hit: 'hit', death: 'death' },
  };
  const creatureMap = maps[animal.kind] ?? { idle: 'idle', walk: 'idle', run: 'gallop', attack: 'attack', hit: 'death', death: 'death' };
  const key=animal.kind==='bandit'?({idle:'idle_loop',walk:'walk_loop',run:'sprint_loop',attack:'punch_jab',hit:'hit_body',death:'death'} as Record<string,string>)[name]??name:creatureMap[name]??name;
  const target=animal.actions.get(key)??animal.actions.get(name)??animal.actions.get(name==='run'?'move':'walk')??animal.actions.get('move')??animal.actions.get('idle_loop')??animal.actions.get('idle');
  if(target&&target!==animal.current){animal.current?.fadeOut(.18);target.reset().setEffectiveWeight(1).fadeIn(.18).play();animal.current=target;}
 }
 update(dt:number,player:THREE.Vector3,bite:(amount:number)=>void):void{
  this.elapsed+=dt;
  this.fadeDust(dt);
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
     if(this.world.isWalkable(next.x,next.z,.45)&&this.world.depth(next.x,next.z)<.35){
      const h=this.world.height(next.x,next.z);
      if(Math.abs(h-pos.y)>Math.max(.55,step.length()*2.4))continue;
      pos.copy(next);pos.y=h;moved=true;break;
     }
    }
    if(!moved){
     a.stuck+=1;
     if(a.stuck>10){
      const hop=a.home.clone().add(new THREE.Vector3((Math.random()-.5)*6,0,(Math.random()-.5)*6));
      if(this.world.isWalkable(hop.x,hop.z,.4)){pos.set(hop.x,this.world.height(hop.x,hop.z),hop.z);}
      a.stuck=0;
     }
     a.speed=0;
    }else a.stuck=0;
   }
   const actual=pos.clone().sub(before);const speed=actual.length()/Math.max(dt,.001);
   if(speed>.04){const target=headingForVelocity(actual.x,actual.z);a.group.rotation.y=turnToward(a.group.rotation.y,target,dt);}
   const gait=speed>.05?(speed>2.15?'run':'walk'):'idle';
   if(a.windup<=0&&a.hit<=0)this.play(a,gait);
   if(speed>.05&&a.windup<=0){
    const pace=gait==='run'?4.2:1.35;
    const rate=gait==='walk'&&a.kind==='scorpion'?0.55:THREE.MathUtils.clamp(speed/pace,.55,1.4);
    a.current?.setEffectiveTimeScale(rate);
   }else a.current?.setEffectiveTimeScale(1);
   a.mixer?.update(dt);
   const frac=a.maxHealth>0?a.health/a.maxHealth:0;
   a.fill.scale.x=Math.max(0.02,frac);
   a.fill.position.x=-(1-frac)*0.62;
   a.hud.rotation.y=Math.atan2(player.x-pos.x,player.z-pos.z)-a.group.rotation.y;
   a.hud.visible=a.health>0&&a.health<a.maxHealth;
   a.ring.visible=a.windup>0;
   a.ring.scale.setScalar(0.55+(1-Math.min(1,a.windup/0.6))*1.7);
   if(speed>.4)this.puff(pos,dt,speed);
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
 private puff(pos:THREE.Vector3,dt:number,speed:number):void{
  if(!this.dustMap){
   const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
   const ctx=canvas.getContext('2d');
   if(ctx){const g=ctx.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'rgba(210,190,150,.7)');g.addColorStop(1,'rgba(210,190,150,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);}
   this.dustMap=new THREE.CanvasTexture(canvas);
  }
  if(this.dust.length<48&&Math.random()<dt*speed*1.4){
   const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.dustMap,transparent:true,opacity:.45,depthWrite:false}));
   sprite.position.set(pos.x+(Math.random()-.5)*.4,pos.y+.15,pos.z+(Math.random()-.5)*.4);
   sprite.scale.setScalar(.35+Math.random()*.25);
   this.world.group.add(sprite);
   this.dust.push({sprite,life:.45});
  }
 }
 private fadeDust(dt:number):void{
  for(let i=this.dust.length-1;i>=0;i--){
   const d=this.dust[i];d.life-=dt;d.sprite.position.y+=dt*.35;d.sprite.scale.multiplyScalar(1+dt*1.4);
   (d.sprite.material as THREE.SpriteMaterial).opacity=Math.max(0,d.life);
   if(d.life<=0){this.world.group.remove(d.sprite);d.sprite.material.dispose();this.dust.splice(i,1);}
  }
 }
 private spawn(kind:Kind,home:THREE.Vector3,hostile:boolean,health:number):void{
  const group=new THREE.Group();group.name=`Wildlife_${kind}`;home.y=this.world.height(home.x,home.z);group.position.copy(home);this.world.group.add(group);
  group.visible=true;
  const hud=new THREE.Group();
  hud.position.y=(BODY_H[kind]??1.6)+0.45;
  const back=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.14),new THREE.MeshBasicMaterial({color:0x141414,depthTest:false}));
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.14),new THREE.MeshBasicMaterial({color:hostile?0xd24a4a:0x6ce9c8,depthTest:false}));
  fill.position.z=.02;hud.add(back,fill);group.add(hud);hud.visible=false;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.8,28),new THREE.MeshBasicMaterial({color:0xff5533,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.08;ring.visible=false;group.add(ring);
  this.animals.push({kind,hostile,health,maxHealth:health,group,home:home.clone(),respawn:0,biteAt:0,windup:0,hit:0,wander:home.x*.2,actions:new Map(),speed:0,stuck:0,hud,fill,ring});
 }
 debug(){return this.animals.map(a=>({kind:a.kind,position:a.group.position.toArray(),heading:a.group.rotation.y,health:a.health,speed:a.speed,animation:a.current?.getClip().name}));}
}
