import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
const game=read('src/core/Game.ts');const avatar=read('src/characters/Character.ts');const html=read('index.html');
const model=readFileSync(join(root,'public/models/origens-warrior.glb'));
function glbJson(){assert.equal(model.toString('ascii',0,4),'glTF');assert.equal(model.readUInt32LE(4),2);assert.equal(model.readUInt32LE(8),model.length);assert.equal(model.toString('ascii',16,20),'JSON');return JSON.parse(model.subarray(20,20+model.readUInt32LE(12)).toString());}

test('modelo tridimensional rigado e embarcado (sem fallback de rede)',()=>{
  assert.ok(statSync(join(root,'public/models/origens-warrior.glb')).size>100000);
  const asset=glbJson();
  assert.ok(asset.nodes.length>60);
  assert.ok(asset.meshes.length>50);
  assert.deepEqual(asset.animations.map(a=>a.name),['Idle','Walk','Run','Jump','Flight','Punch','Charge']);
  for(const clip of asset.animations){
    assert.ok(clip.channels.length>=8,`animacao curta: ${clip.name}`);
    const destinations=clip.channels.map(c=>`${c.target.node}/${c.target.path}`);
    assert.equal(new Set(destinations).size,destinations.length,`canais duplicados: ${clip.name}`);
    for(const c of clip.channels)assert.ok(c.target.node<asset.nodes.length);
  }
});

test('animacoes de locomocao isoladas da velocidade de gameplay',()=>{
  assert.match(avatar,/const rate = sprint \? 9\.5 : 6\.2/);
  assert.match(avatar,/this\.mixer\.update\(Math\.min\(dt, \.05\)\)/);
  assert.doesNotMatch(avatar,/strideFrequency = .*speed/);
  assert.match(avatar,/AnimationMixer/);
});

test('perfis distintos com persistencia no localStorage e aparencia configuravel',()=>{
  const profiles=read('src/data/profiles.ts');
  assert.match(profiles,/localStorage\.setItem/);
  assert.match(profiles,/localStorage\.getItem/);
  for(const id of ['character-screen','character-list','character-create','hero-name','hero-height','hero-build','hero-beard','hero-hair','hero-eye','hero-haircolor'])assert.ok(html.includes(`id="${id}"`),id);
  assert.match(game,/saveProfiles\(this\.profiles\)/);
  assert.match(avatar,/setAppearance\(value: Appearance\)/);
});

test('combate com M1 combo, M2 orb e 1-4 carregamento real',()=>{
  assert.match(game,/event\.button === 0\) this\.punch\(\)/);
  assert.match(game,/event\.button === 2\) this\.kiBlast\(\)/);
  assert.match(game,/beginCharge\(skill\.id\)/);
  assert.match(game,/this\.releaseCharge\(\)/);
  assert.match(game,/this\.comboStep=/);
  assert.match(game,/spec\.kiCost\+Math\.ceil\(held\*10\)/);
  assert.match(read('src/combat/Combat.ts'),/style\.style === 'orb'/);
});

test('laboratorio de atributos gratis, Ki regen e stamina funcionam por valores',()=>{
  const p=read('src/data/profiles.ts');
  for(const attr of ['health','ki','stamina','power','kiRegen','speed','flight'])assert.match(p,new RegExp(`id:'${attr}'`));
  assert.match(game,/this\.stats\.stamina-=7/);
  assert.match(game,/this\.stats\.stamina\+22\*dt/);
  assert.match(game,/this\.stats\.kiRegen/);
  assert.match(game,/\*this\.stats\.speed/);
  assert.match(game,/\*this\.stats\.flight/);
  for(const id of ['hud-stamina-fill','hud-stamina-label','attribute-editor','charge-ui'])assert.ok(html.includes(`id="${id}"`),id);
});
