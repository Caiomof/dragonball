import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const read = path => readFileSync(join(process.cwd(),path),'utf8');
const character=read('src/characters/Character.ts');
const game=read('src/core/Game.ts');
const world=read('src/world/World.ts');
const wildlife=read('src/world/Wildlife.ts');

test('clip library preserves approved walking, running, idle and jump',()=>{
 const b=readFileSync('public/models/anims/ual1.glb');
 assert.equal(b.toString('ascii',0,4),'glTF');
 const length=b.readUInt32LE(12);
 const j=JSON.parse(b.subarray(20,20+length).toString());
 for(const name of ['Idle_Loop','Walk_Loop','Sprint_Loop','Jump_Loop','Swim_Fwd_Loop','Swim_Idle_Loop','Spell_Simple_Idle_Loop','Spell_Simple_Shoot']) assert.ok(j.animations.some(x=>x.name===name),name);
 assert.match(character,/walk:\s*\['walk_loop'/);
 assert.match(character,/run:\s*\['sprint_loop'/);
});
test('casting animates real clips without manual postmixer bone override',()=>{
 assert.match(character,/else if \(casting\) this\.playClip\(upper!/);
 assert.match(character,/charging \? 'charge'/);
 assert.doesNotMatch(character,/poseBone\(/);
 assert.doesNotMatch(character,/poseCharge\(/);
 assert.match(game,/this\.character\.gesture\('charge'\)/);
 assert.match(game,/id === 'kienzan' \? 'disc' : 'beam'/);
});
test('river is one continuous ribbon with current shader and matching swim surface',()=>{
 assert.match(world,/name='River — continuous flowing surface'/);
 assert.match(world,/const lengthSegments = 175/);
 assert.match(world,/this\.waterShader\.uniforms\.uTime\.value/);
 assert.doesNotMatch(world,/new THREE\.PlaneGeometry\(8\.2, 3\.3\)/);
 assert.match(world,/waterLevel\(_x: number, z: number\)/);
 assert.match(game,/const swimmingY = Math\.max\(ground/);
 assert.match(character,/swim: \['swim_fwd_loop'/);
});
test('all four clothes textures are present without modifying rig clips',()=>{
 for(const race of ['saiyajin','terraqueo','namekuseijin','majin']){
  const path=`public/models/hero/T_Origens_Gi_${race}.png`;
  assert.ok(statSync(path).size>100000,path);
  assert.equal(readFileSync(path).toString('hex',0,4),'89504e47');
 }
 assert.match(character,/T_Origens_Gi_\$\{this\.race\.id\}\.png/);
 assert.ok(statSync('public/models/hero/Superhero_Male_FullBody.bin').size>100000);
});
test('wildlife accepts rigged GLB and preserves the existing AI',()=>{
 assert.match(wildlife,/loadAsync\(uri\)/);
 assert.match(wildlife,/new THREE\.AnimationMixer\(display\)/);
 assert.match(wildlife,/const target=moving\?animal\.walk:animal\.idle/);
 assert.match(wildlife,/private hurt\(animal: Animal/);
});
