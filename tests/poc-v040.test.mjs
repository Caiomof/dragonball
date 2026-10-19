import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {load} from './load-ts.mjs';

const file=(p)=>fileURLToPath(new URL(`../${p}`,import.meta.url));
const storage=new Map();
globalThis.localStorage={
  getItem(key){return storage.get(key)??null;},
  setItem(key,val){storage.set(key,String(val));},
  removeItem(key){storage.delete(key);},
};

const economyModule=()=>load(file('src/systems/RpgLoop.ts'));

test('Criativo concede ataques, consumíveis e compras sem gastos', async()=>{
 const {RpgLoop}=await economyModule();
 const e=new RpgLoop();e.load('creative-poc');e.setMode('creative');
 assert.equal(e.creative,true);
 assert.equal(e.purchase('potion',0).zeni,0);
 assert.equal(e.consume('senzu').ok,true);
 assert.equal(e.loot('wolf').id,'fang');
 assert.equal(e.amount('fang'),0);
});

test('Sobrevivência exige Zeni e mantém itens por personagem',async()=>{
 const {RpgLoop}=await economyModule();
 const e=new RpgLoop();e.load('survival-poc');
 assert.equal(e.purchase('potion',5).ok,false);
 assert.equal(e.purchase('potion',300).zeni,195);
 assert.equal(e.amount('potion'),1);
 assert.equal(e.consume('potion').heal,60);
 e.loot('wolf');e.loot('wolf');e.loot('bandit');
 assert.equal(e.data.bounty,3);
 assert.equal(e.claimContract(200).zeni,360);
 const again=new RpgLoop();again.load('survival-poc');
 assert.equal(again.data.contracts,1);
 assert.equal(again.amount('fang'),2);
 assert.equal(again.amount('insignia'),1);
 const second=new RpgLoop();second.load('second-character');
 assert.equal(second.amount('fang'),0);
});

test('POC inclui arquivos locais do guerreiro, fauna, loja e referências',()=>{
 for(const p of [
  'public/models/hero/Superhero_Male_FullBody.gltf',
  'public/models/hero/Superhero_Male_FullBody.bin',
  'public/models/anims/ual1.glb',
  'public/models/wildlife/wolf.glb',
  'public/models/wildlife/deer.glb',
  'src/world/ShopStall.ts','src/ui/RpgPanels.ts',
  'src/systems/RpgLoop.ts',
  'docs/POC_V040.md',
  'public/assets/environment/nature/BirchTree_1.gltf',
  'public/assets/environment/nature/BirchTree_1.bin',
  'public/assets/environment/nature/BirchTree_Bark.jpg',
  'public/assets/environment/nature/Bush.gltf',
  'public/assets/environment/nature/Grass_Large.gltf',
  'public/assets/environment/village/Prop_Crate.gltf',
  'public/assets/environment/village/Prop_Crate.bin',
 ]) assert.ok(existsSync(file(p)),p);
});

test('Controle visual inclui primeira pessoa, cabelo e velocidade dia/noite',()=>{
 const html=readFileSync(file('index.html'),'utf8');
 for(const id of ['hair-gallery','day-speed-select','new-character-mode','rpg-venture-panel']) assert.match(html,new RegExp(`id="${id}"`));
 const character=readFileSync(file('src/characters/Character.ts'),'utf8');
 assert.match(character,/firstPersonArmGeometry/);
 const clips=readFileSync(file('src/animation/HeroClips.ts'),'utf8');
 assert.match(clips,/hover|cruise|boost/);
});
