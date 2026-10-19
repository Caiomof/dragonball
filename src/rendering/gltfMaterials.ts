import * as THREE from 'three';

export function prepareGltfScene(root: THREE.Object3D): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
        material.map.needsUpdate = true;
      }
      if (material.emissiveMap) material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    }
  });
}
