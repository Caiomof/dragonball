import * as THREE from 'three';

export function skinAccessoryToHero(model: THREE.Group, piece: THREE.Object3D, boneName = 'Head'): THREE.Group | null {
  let heroMesh: THREE.SkinnedMesh | undefined;
  model.traverse(object => {
    if (object instanceof THREE.SkinnedMesh && !heroMesh) heroMesh = object;
  });
  if (!heroMesh) return null;
  const hero = heroMesh;
  const boneIndex = hero.skeleton.bones.findIndex(bone => bone.name === boneName);
  if (boneIndex < 0) return null;

  const root = new THREE.Group();
  root.name = 'SkinnedAccessory';

  piece.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh) return;
    const geometry = object.geometry.clone();
    const count = geometry.attributes.position.count;
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      skinIndex[i * 4] = boneIndex;
      skinWeight[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    const material = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone();
    const part = new THREE.SkinnedMesh(geometry, material);
    part.name = object.name;
    part.frustumCulled = false;
    part.castShadow = true;
    part.receiveShadow = true;
    part.bind(hero.skeleton, hero.bindMatrix);
    root.add(part);
  });

  if (!root.children.length) return null;
  return root;
}
