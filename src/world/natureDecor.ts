import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareGltfScene } from '../rendering/gltfMaterials';
import { waterFootprint } from './landscape';
import type { World } from './World';

const TREE_MODELS = [
  '/assets/environment/nature/BirchTree_1.gltf',
  '/assets/environment/nature/BirchTree_2.gltf',
  '/assets/environment/nature/BirchTree_3.gltf',
  '/assets/environment/nature/BirchTree_4.gltf',
  '/assets/environment/nature/BirchTree_5.gltf',
  '/assets/environment/nature/MapleTree_1.gltf',
  '/assets/environment/nature/MapleTree_2.gltf',
  '/assets/environment/nature/MapleTree_3.gltf',
  '/assets/environment/nature/MapleTree_4.gltf',
  '/assets/environment/nature/MapleTree_5.gltf',
];

const GROUND_PROPS = [
  '/assets/environment/nature/Bush.gltf',
  '/assets/environment/nature/Bush_Small.gltf',
  '/assets/environment/nature/Bush_Flowers.gltf',
  '/assets/environment/nature/Grass_Large.gltf',
  '/assets/environment/nature/Flower_1_Clump.gltf',
  '/assets/environment/nature/DeadTree_1.gltf',
];

function randomGenerator(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function loadTemplates(loader: GLTFLoader, paths: string[]): Promise<THREE.Group[]> {
  const templates: THREE.Group[] = [];
  for (const path of paths) {
    try {
      const scene = (await loader.loadAsync(path)).scene;
      prepareGltfScene(scene);
      templates.push(scene);
    } catch {
      /* skip missing */
    }
  }
  return templates;
}

export async function decorateNature(world: World): Promise<void> {
  const loader = new GLTFLoader();
  const trees = await loadTemplates(loader, TREE_MODELS);
  if (trees.length) {
    const rnd = randomGenerator(98491);
    for (const stand of world.treeStands) {
      const pick = trees[Math.floor(rnd() * trees.length)];
      const piece = pick.clone(true);
      const scale = (stand.userData.treeScale as number) ?? 1;
      piece.scale.setScalar(1.45 * scale);
      piece.position.set(0, 0, 0);
      prepareGltfScene(piece);
      piece.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      stand.add(piece);
    }
  }
  const props = await loadTemplates(loader, GROUND_PROPS);
  if (!props.length) return;
  const rnd = randomGenerator(44102);
  const group = new THREE.Group();
  group.name = 'NatureGround_v050';
  for (let i = 0; i < 70; i++) {
    const x = (rnd() - 0.5) * 160;
    const z = (rnd() - 0.5) * 160;
    if (Math.hypot(x, z - 3) < 12 || waterFootprint(x, z)) continue;
    const pick = props[Math.floor(rnd() * props.length)];
    const piece = pick.clone(true);
    const isGrass = piece.name.toLowerCase().includes('grass') || piece.name.toLowerCase().includes('flower');
    const scale = isGrass ? 0.55 + rnd() * 0.25 : 0.85 + rnd() * 0.35;
    piece.scale.setScalar(scale);
    piece.position.set(x, world.height(x, z), z);
    piece.rotation.y = rnd() * Math.PI * 2;
    prepareGltfScene(piece);
    group.add(piece);
  }
  world.group.add(group);
}
