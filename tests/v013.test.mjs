import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = file => readFileSync(join(root, file), 'utf8');

 test('animacoes reais carregam pelo AnimationMixer com transicoes e sem alterar bones manualmente', () => {
  const text = source('src/characters/Character.ts');
  assert.match(text, /new THREE\.AnimationMixer\(model\)/);
  assert.match(text, /fadeOut\(fade\)/);
  assert.match(text, /fadeIn\(fade\)/);
  assert.match(text, /this\.mixer\.update\(Math\.min\(dt, \.05\)\)/);
  assert.doesNotMatch(text, /externalBones/);
  assert.match(text, /split\('\|'\)\.pop\(\)/);
});

 test('modelo humanoide rigado esta local no ZIP e dispensa download', () => {
  assert.match(source('JOGAR.bat'), /origens-warrior\.glb/);
  assert.match(source('src/characters/Character.ts'), /loadAsync\('\/models\/origens-warrior\.glb'\)/);
  assert.ok(existsSync(join(root, 'public/models/origens-warrior.glb')));
});

 test('caminhada usa altura da mesma malha triangulada, com gravidade na descida', () => {
  const world = source('src/world/World.ts');
  const game = source('src/core/Game.ts');
  assert.match(world, /private rawHeight\(/);
  assert.match(world, /const step = width \/ 150/);
  assert.match(world, /u \+ v <= 1/);
  assert.match(world, /const y = this\.rawHeight\(x, z\)/);
  assert.match(game, /const ground = this\.world\.height\(pos\.x, pos\.z\);/);
  assert.match(game, /if \(downwardGap > 0\.7\)/);
  assert.match(game, /this\.verticalVelocity -= GRAVITY \* dt/);
});

 test('scroll alterna habilidades sem remover os atalhos 1 a 4', () => {
  const game = source('src/core/Game.ts');
  assert.match(game, /addEventListener\('wheel'/);
  assert.match(game, /passive: false/);
  assert.match(game, /this\.selectSkill\(SKILLS\[\(index \+ direction/);
  assert.match(game, /\^Digit\[1-4\]\$/);
});

 test('primeira pessoa apresenta maos e energia animada e ataque usa origem da camera', () => {
  const game = source('src/core/Game.ts');
  assert.match(game, /this\.scene\.add\(this\.camera\)/);
  assert.match(game, /this\.camera\.add\(this\.firstPersonArms\)/);
  assert.match(game, /this\.fpEnergy\.visible = attacking/);
  assert.match(game, /this\.viewMode === 'first'\s*\?/);
});

 test('HUD e interface apresentam selecao pelo scroll e marca de versao atual', () => {
  const html = source('index.html');
  assert.match(html, /SCROLL/);
  assert.match(html, /0\.1\.6/);
  assert.match(source('src/ui/Ui.ts'), /highlightSkill/);
  assert.ok(existsSync(join(root, 'JOGAR.bat')));
});
