import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const races = JSON.parse(source('src/data/races.json'));
const abilities = JSON.parse(source('src/data/abilities.json'));

const ids = ['saiyajin', 'terraqueo', 'namekuseijin', 'majin'];

test('as quatro raças têm identificadores únicos', () => {
  assert.deepEqual(races.map((race) => race.id), ids);
  assert.equal(new Set(races.map((race) => race.id)).size, 4);
});

test('cada raça tem atributos válidos e visual próprio', () => {
  for (const race of races) {
    assert.ok(race.health >= 1 && race.ki >= 1 && race.power >= 1);
    assert.match(race.accent, /^#[0-9a-f]{6}$/i);
    assert.ok(race.name.length > 2 && race.description.length > 10);
  }
  assert.equal(new Set(races.map((race) => race.accent)).size, 4);
});

test('kamehameha e training dummy respeitam as regras da vertical slice', () => {
  assert.equal(abilities.kamehameha.kiCost, 25);
  assert.equal(abilities.kamehameha.damage, 30);
  assert.equal(abilities.kamehameha.cooldownSeconds, 2);
  assert.equal(abilities.trainingDummy.health, 100);
  assert.equal(Math.ceil(abilities.trainingDummy.health / abilities.kamehameha.damage), 4);
});

test('arquivos essenciais da entrega existem', () => {
  for (const file of ['JOGAR.bat', 'index.html', 'src/main.ts', 'src/core/Game.ts', 'src/world/World.ts', 'src/characters/Character.ts', 'src/combat/Combat.ts', 'src/ui/Ui.ts', 'docs/MIGRACAO_UNREAL.md']) {
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file);
  }
});


test('referências de elementos da UI existem no HTML', () => {
  const html = source('index.html');
  const ui = source('src/ui/Ui.ts');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const referenced = [...ui.matchAll(/element\('([^']+)'\)/g)].map((match) => match[1]);
  for (const id of referenced) assert.ok(ids.has(id), `Elemento de UI ausente: ${id}`);
});
