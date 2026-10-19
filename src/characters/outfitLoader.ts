import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareGltfScene } from '../rendering/gltfMaterials';

export type OutfitId = 'male_ranger' | 'male_peasant' | 'female_ranger' | 'female_peasant';

const OUTFIT_FILES: Record<OutfitId, string> = {
  male_ranger: '/assets/characters/outfits/Male_Ranger.gltf',
  male_peasant: '/assets/characters/outfits/Male_Peasant.gltf',
  female_ranger: '/assets/characters/outfits/Female_Ranger.gltf',
  female_peasant: '/assets/characters/outfits/Female_Peasant.gltf',
};

const cache = new Map<OutfitId, Promise<THREE.Group>>();

function loadOutfit(id: OutfitId): Promise<THREE.Group> {
  if (!cache.has(id)) {
    const loader = new GLTFLoader();
    cache.set(
      id,
      loader.loadAsync(OUTFIT_FILES[id]).then(g => {
        prepareGltfScene(g.scene);
        return g.scene;
      })
    );
  }
  return cache.get(id)!;
}

export function outfitForRole(role: 'player' | 'merchant' | 'bandit', female: boolean): OutfitId {
  if (role === 'merchant') return female ? 'female_peasant' : 'male_peasant';
  if (role === 'bandit') return female ? 'female_ranger' : 'male_ranger';
  return female ? 'female_ranger' : 'male_ranger';
}

export function bindOutfitSkinnedMeshes(character: THREE.Object3D, outfit: THREE.Object3D): void {
  let heroMesh: THREE.SkinnedMesh | undefined;
  character.traverse(o => {
    if (o instanceof THREE.SkinnedMesh && !heroMesh) heroMesh = o;
  });
  if (!heroMesh) return;
  const skinned = heroMesh;
  outfit.traverse(o => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    o.skeleton = skinned.skeleton;
    o.bind(skinned.skeleton, skinned.bindMatrix);
  });
}

export async function attachOutfit(root: THREE.Group, outfitId: OutfitId): Promise<THREE.Group> {
  const template = await loadOutfit(outfitId);
  const outfitRoot = new THREE.Group();
  outfitRoot.name = `Outfit_${outfitId}`;
  const clone = template.clone(true);
  clone.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  outfitRoot.add(clone);
  root.add(outfitRoot);
  bindOutfitSkinnedMeshes(root, outfitRoot);
  root.traverse(o => {
    if (o instanceof THREE.Mesh && o.name === 'Pants') o.visible = false;
  });
  return outfitRoot;
}

export function disposeOutfit(group: THREE.Group): void {
  const mats = new Set<THREE.Material>();
  group.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m));
    }
  });
  mats.forEach(m => m.dispose());
  group.removeFromParent();
}
