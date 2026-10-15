import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const project = process.cwd();
const read = path => readFileSync(join(project, path), 'utf8');
const skills = JSON.parse(read('src/data/skills.json'));
const html = read('index.html');
const game = read('src/core/Game.ts');
const world = read('src/world/World.ts');

test('quatro poderes com entradas e custos exclusivos', () => {
  assert.equal(skills.length, 4);
  assert.deepEqual(skills.map(skill => skill.key), ['1', '2', '3', '4']);
  assert.equal(new Set(skills.map(skill => skill.id)).size, 4);
  for (const skill of skills) {
    assert.ok(skill.damage > 0 && skill.kiCost > 0 && skill.cooldown > 0);
    assert.ok(['beam','disc'].includes(skill.kind));
  }
});

test('interface da v0.1.2 tem painéis, hotbar, mira e controle da câmera', () => {
  for (const id of ['settings-screen','skills-screen','skill-hotbar','aim-reticle','camera-third','camera-first','fov-slider','mouse-slider','attribute-editor','flight-indicator']) {
    assert.ok(html.includes(`id="${id}"`), `Elemento ${id} ausente`);
  }
});

test('movimentação e ataque fazem leitura da câmera e toggle de voo', () => {
  assert.match(game, /lastSpaceAt/);
  assert.match(game, /this\.flying = !this\.flying/);
  assert.match(game, /this\.world\.trace\(this\.camera\.position/);
  assert.match(game, /this\.viewMode === 'first'/);
  assert.match(game, /this\.world\.damage\(/);
});

test('árvores, rochas e ruínas possuem ciclo de dano e regeneração', () => {
  assert.match(world, /respawnSeconds = 120/);
  assert.match(world, /damage\(id: number/);
  assert.match(world, /entry\.health = entry\.maxHealth/);
  assert.match(world, /part\.mesh\.setMatrixAt/);
});

test('inicializador e modelo offline incluido possuem documentação', () => {
  assert.ok(existsSync(join(project, 'JOGAR.bat')));
  assert.ok(existsSync(join(project, 'public/models/LEIA-MODELO.txt')));
  assert.ok(existsSync(join(project, 'public/models/origens-warrior.glb')));
  assert.match(read('JOGAR.bat'), /Superhero_Male_FullBody\.gltf/);
});
