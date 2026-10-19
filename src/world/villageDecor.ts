import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareGltfScene } from '../rendering/gltfMaterials';
import type { World } from './World';

const PATHS = {
  crate: '/assets/environment/village/Prop_Crate.gltf',
  fenceSingle: '/assets/environment/village/Prop_WoodenFence_Single.gltf',
  fenceExt: '/assets/environment/village/Prop_WoodenFence_Extension1.gltf',
  wagon: '/assets/environment/village/Prop_Wagon.gltf',
  metalFence: '/assets/environment/village/Prop_MetalFence_Simple.gltf',
  vine: '/assets/environment/village/Prop_Vine2.gltf',
  floor: '/assets/environment/village/Floor_WoodDark.gltf',
  wall: '/assets/environment/village/Wall_Plaster_Straight.gltf',
  door: '/assets/environment/village/Wall_Plaster_Door_Flat.gltf',
  window: '/assets/environment/village/Wall_Plaster_Window_Wide_Flat.gltf',
  roof: '/assets/environment/village/Roof_2x4_RoundTile.gltf',
};

async function loadProp(loader: GLTFLoader, path: string): Promise<THREE.Group | null> {
  try {
    const scene = (await loader.loadAsync(path)).scene;
    prepareGltfScene(scene);
    return scene;
  } catch {
    return null;
  }
}

function place(group: THREE.Group, template: THREE.Group, x: number, y: number, z: number, rotY: number, scale = 1): void {
  const piece = template.clone(true);
  piece.position.set(x, y, z);
  piece.rotation.y = rotY;
  piece.scale.setScalar(scale);
  prepareGltfScene(piece);
  group.add(piece);
}

export async function decorateVillage(world: World): Promise<void> {
  const loader = new GLTFLoader();
  const [crate, fenceSingle, fenceExt, wagon, metalFence, vine, floor, wall, door, windowWall, roof] = await Promise.all([
    loadProp(loader, PATHS.crate),
    loadProp(loader, PATHS.fenceSingle),
    loadProp(loader, PATHS.fenceExt),
    loadProp(loader, PATHS.wagon),
    loadProp(loader, PATHS.metalFence),
    loadProp(loader, PATHS.vine),
    loadProp(loader, PATHS.floor),
    loadProp(loader, PATHS.wall),
    loadProp(loader, PATHS.door),
    loadProp(loader, PATHS.window),
    loadProp(loader, PATHS.roof),
  ]);
  if (!crate && !fenceSingle) return;

  const hub = new THREE.Group();
  hub.name = 'VillageHub_v050';
  const stallX = -12;
  const stallZ = 9;
  const h = (x: number, z: number) => world.height(x, z);

  if (fenceSingle && fenceExt) {
    const corners = [
      { x: stallX - 5.2, z: stallZ - 4.5, rot: 0 },
      { x: stallX + 5.2, z: stallZ - 4.5, rot: Math.PI },
      { x: stallX + 5.2, z: stallZ + 4.5, rot: Math.PI },
      { x: stallX - 5.2, z: stallZ + 4.5, rot: 0 },
    ];
    for (const c of corners) place(hub, fenceSingle, c.x, h(c.x, c.z), c.z, c.rot, 1);
    const sides: { x1: number; z1: number; x2: number; z2: number; rot: number }[] = [
      { x1: stallX - 4.2, z1: stallZ - 4.5, x2: stallX + 4.2, z2: stallZ - 4.5, rot: Math.PI / 2 },
      { x1: stallX + 5.2, z1: stallZ - 3.5, x2: stallX + 5.2, z2: stallZ + 3.5, rot: 0 },
      { x1: stallX - 4.2, z1: stallZ + 4.5, x2: stallX + 4.2, z2: stallZ + 4.5, rot: -Math.PI / 2 },
    ];
    for (const side of sides) {
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const x = THREE.MathUtils.lerp(side.x1, side.x2, t);
        const z = THREE.MathUtils.lerp(side.z1, side.z2, t);
        place(hub, fenceExt, x, h(x, z), z, side.rot, 1);
      }
    }
  }

  if (crate) {
    for (let i = 0; i < 4; i++) {
      place(hub, crate, stallX + 3.2 + i * 0.85, h(stallX + 3.2, stallZ + 2.1) + i * 0.42, stallZ + 2.1, 0.15 * i, 0.95);
    }
    place(hub, crate, stallX - 3.8, h(stallX - 3.8, stallZ + 1.4), stallZ + 1.4, -0.4, 1.05);
  }

  if (wagon) {
    place(hub, wagon, stallX - 6.5, h(stallX - 6.5, stallZ - 2), stallZ - 2, Math.PI * 0.55, 1);
  }

  if (vine) {
    place(hub, vine, stallX - 2.1, h(stallX - 2.1, stallZ - 3.8) + 1.2, stallZ - 3.8, 0.2, 1.1);
    place(hub, vine, stallX + 2.4, h(stallX + 2.4, stallZ - 3.6) + 1.1, stallZ - 3.6, -0.35, 1);
  }

  if (floor && wall && door && roof) {
    const hx = stallX - 16;
    const hz = stallZ + 10;
    const gy = h(hx, hz);
    place(hub, floor, hx, gy, hz, 0, 1);
    place(hub, wall, hx, gy, hz - 2.05, 0, 1);
    place(hub, wall, hx, gy, hz + 2.05, Math.PI, 1);
    place(hub, door, hx + 2.05, gy, hz, Math.PI / 2, 1);
    if (windowWall) place(hub, windowWall, hx - 2.05, gy, hz, -Math.PI / 2, 1);
    place(hub, roof, hx, gy + 2.55, hz, 0, 1);
  }

  if (metalFence) {
    const ring = world.dummyPosition;
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI * 0.35 + (i / 4) * Math.PI * 0.22;
      const x = ring.x + Math.cos(angle) * 7.5;
      const z = ring.z + Math.sin(angle) * 7.5;
      place(hub, metalFence, x, h(x, z), z, angle + Math.PI / 2, 1);
    }
  }

  world.group.add(hub);
}
