import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareGltfScene } from '../rendering/gltfMaterials';
import { waterFootprint } from './landscape';
import type { World } from './World';

const BRICKS = [
  '/assets/environment/village/Prop_Brick1.gltf',
  '/assets/environment/village/Prop_Brick2.gltf',
  '/assets/environment/village/Prop_Brick3.gltf',
  '/assets/environment/village/Prop_Brick4.gltf',
];

function rnd(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export async function decorateRocks(world: World): Promise<void> {
  const loader = new GLTFLoader();
  const templates: THREE.Group[] = [];
  for (const path of BRICKS) {
    try {
      const scene = (await loader.loadAsync(path)).scene;
      prepareGltfScene(scene);
      templates.push(scene);
    } catch {
      /* skip */
    }
  }
  if (!templates.length) return;
  const group = new THREE.Group();
  group.name = 'RockPack_v050';
  const random = rnd(2344);
  for (let i = 0; i < 90; i++) {
    let x = (random() - 0.5) * 300;
    let z = (random() - 0.5) * 300;
    if (Math.hypot(x, z - 2) < 24) {
      x += x > 0 ? 24 : -24;
      z += 15;
    }
    if (waterFootprint(x, z)) continue;
    const pick = templates[Math.floor(random() * templates.length)];
    const piece = pick.clone(true);
    const scale = 1.2 + random() * 2.2;
    piece.scale.setScalar(scale);
    piece.position.set(x, world.height(x, z), z);
    piece.rotation.y = random() * Math.PI * 2;
    prepareGltfScene(piece);
    group.add(piece);
  }
  world.group.add(group);
}
