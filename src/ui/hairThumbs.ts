import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareGltfScene } from '../rendering/gltfMaterials';
import { HAIR_STYLES } from '../data/appearanceCatalog';

const loader = new GLTFLoader();
let renderer: THREE.WebGLRenderer | null = null;

function sharedRenderer(): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(160, 160);
  }
  return renderer;
}

export async function paintMeshThumb(path: string, canvas: HTMLCanvasElement | null | undefined, tint = '#3a2418'): Promise<void> {
  if (!canvas) return;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xfff2dd, 1.4);
  key.position.set(1, 2, 2);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 20);
  const mesh = (await loader.loadAsync(path)).scene;
  prepareGltfScene(mesh);
  mesh.traverse(o => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
      const m = o.material.clone();
      m.color.set(tint);
      o.material = m;
    }
  });
  scene.add(mesh);
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  mesh.position.sub(box.getCenter(new THREE.Vector3()));
  camera.position.set(0, size.y * 0.1, Math.max(size.x, size.y, size.z) * 1.85);
  camera.lookAt(0, 0, 0);
  const r = sharedRenderer();
  r.render(scene, camera);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(r.domElement, 0, 0, canvas.width, canvas.height);
  }
}

export function paintHairGallery(): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('#hair-gallery [data-hair-style]')];
  HAIR_STYLES.forEach((style, index) => {
    const canvas = buttons[index]?.querySelector('canvas');
    void paintMeshThumb(style.path, canvas);
  });
}
