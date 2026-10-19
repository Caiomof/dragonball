import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareGltfScene } from '../rendering/gltfMaterials';
import { BEARD_MESH, BEARD_STYLES, HAIR_STYLES } from '../data/appearanceCatalog';
import type { Appearance } from '../data/profiles';
import type { RaceId } from '../data/gameConfig';
import { skinAccessoryToHero } from './hairSkinner';

const hairCache = new Map<string, Promise<THREE.Group>>();

function loadHairMesh(path: string): Promise<THREE.Group> {
  if (!hairCache.has(path)) {
    const loader = new GLTFLoader();
    hairCache.set(
      path,
      loader.loadAsync(path).then(g => {
        prepareGltfScene(g.scene);
        return g.scene;
      })
    );
  }
  return hairCache.get(path)!;
}

export function disposeAccessories(group: THREE.Group): void {
  const materials = new Set<THREE.Material>();
  group.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m));
    if (o instanceof THREE.SkinnedMesh) o.geometry.dispose();
  });
  materials.forEach(m => m.dispose());
  group.removeFromParent();
  group.clear();
}

function tintHairMeshes(root: THREE.Object3D, color: THREE.Color): void {
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map(mat => {
      if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
      const m = mat.clone();
      m.color.copy(color);
      m.name = 'HAIR';
      m.needsUpdate = true;
      return m;
    });
    o.castShadow = true;
    o.receiveShadow = true;
    o.renderOrder = 2;
    o.frustumCulled = false;
  });
}

export async function buildAccessories(
  model: THREE.Group,
  _head: THREE.Object3D,
  a: Appearance,
  race: RaceId
): Promise<THREE.Group> {
  const stale = model.getObjectByName('AppearanceAccessories');
  if (stale) disposeAccessories(stale as THREE.Group);

  const root = new THREE.Group();
  root.name = 'AppearanceAccessories';
  root.visible = true;
  model.add(root);

  if (race === 'saiyajin' || race === 'terraqueo') {
    const hairIndex = Math.min(Math.max(0, Math.round(a.hair)), HAIR_STYLES.length - 1);
    const style = HAIR_STYLES[hairIndex];
    const hair = (await loadHairMesh(style.path)).clone(true);
    tintHairMeshes(hair, new THREE.Color(a.hairColor));
    const hairRig = skinAccessoryToHero(model, hair, 'Head');
    if (hairRig) root.add(hairRig);

    const beardStyle = a.beardStyle ?? (a.beard ? 1 : 0);
    if (beardStyle > 0) {
      const beard = (await loadHairMesh(BEARD_MESH)).clone(true);
      const beardColor = a.beardColor ?? a.hairColor;
      tintHairMeshes(beard, new THREE.Color(beardColor));
      const scale = beardStyle === 1 ? 0.92 : beardStyle === 2 ? 1 : 1.1;
      beard.scale.setScalar(scale);
      const beardRig = skinAccessoryToHero(model, beard, 'Head');
      if (beardRig) root.add(beardRig);
    }
  } else if (race === 'namekuseijin') {
    const skin = new THREE.MeshStandardMaterial({ color: 0x74bb63, roughness: 0.8 });
    const head = _head;
    const box = new THREE.Box3().setFromObject(head);
    const width = box.getSize(new THREE.Vector3()).x * 0.51;
    const top = box.max.y;
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * width * 0.4, top - 0.08, 0.02),
        new THREE.Vector3(side * width * 0.48, top + 0.02, 0.08),
        new THREE.Vector3(side * width * 0.62, top + 0.06, 0.14),
      ]);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, width * 0.065, 7, false), skin);
      mesh.castShadow = true;
      root.add(mesh);
    }
  } else {
    const skin = new THREE.MeshStandardMaterial({ color: 0xef9dc0, roughness: 0.8 });
    const tentacle = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 6, 10), skin);
    tentacle.position.set(0.04, 0.12, 0.02);
    tentacle.rotation.z = -0.45;
    tentacle.castShadow = true;
    root.add(tentacle);
  }

  return root;
}

export function beardStyleLabel(style: number): string {
  return BEARD_STYLES.find(b => b.id === style)?.label ?? 'Nenhuma';
}
