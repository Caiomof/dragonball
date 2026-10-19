import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

const KENNEY_CANDIDATES = [
  '/assets/vfx/textures/kenney/flame_02.png',
  '/assets/vfx/textures/kenney/circle_05.png',
  '/assets/vfx/textures/kenney/spark_05.png',
  '/assets/vfx/textures/kenney/light_01.png',
  '/assets/vfx/textures/kenney/magic_05.png',
  '/assets/vfx/textures/kenney/star_05.png',
];

const BRACKEYS_CANDIDATES = [
  '/assets/vfx/textures/brackeys/particle_circle.png',
  '/assets/vfx/textures/brackeys/particle_star.png',
  '/assets/vfx/textures/brackeys/particle_sparkle.png',
  '/assets/vfx/textures/brackeys/particle_smoke.png',
];

async function loadCached(path: string): Promise<THREE.Texture | null> {
  if (cache.has(path)) return cache.get(path)!;
  try {
    const tex = await new THREE.TextureLoader().loadAsync(path);
    tex.colorSpace = THREE.SRGBColorSpace;
    cache.set(path, tex);
    return tex;
  } catch {
    return null;
  }
}

export async function loadVfxTexture(path: string): Promise<THREE.Texture | null> {
  return loadCached(path);
}

export async function loadVfxGlowTexture(): Promise<THREE.Texture> {
  for (const path of KENNEY_CANDIDATES) {
    const tex = await loadCached(path);
    if (tex) return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const fallback = new THREE.CanvasTexture(canvas);
  fallback.colorSpace = THREE.SRGBColorSpace;
  return fallback;
}

export async function loadBeamTextures(): Promise<THREE.Texture[]> {
  const paths = [
    '/assets/vfx/textures/kenney/flame_02.png',
    '/assets/vfx/textures/kenney/circle_05.png',
    '/assets/vfx/textures/kenney/star_05.png',
    '/assets/vfx/textures/kenney/magic_05.png',
  ];
  const loaded: THREE.Texture[] = [];
  for (const path of paths) {
    const tex = await loadCached(path);
    if (tex) loaded.push(tex);
  }
  return loaded;
}

export async function loadVfxSparkTexture(): Promise<THREE.Texture> {
  for (const path of [...KENNEY_CANDIDATES.slice(2), ...BRACKEYS_CANDIDATES]) {
    const tex = await loadCached(path);
    if (tex) return tex;
  }
  return loadVfxGlowTexture();
}

export async function loadImpactTextures(): Promise<THREE.Texture[]> {
  const paths = [...KENNEY_CANDIDATES, ...BRACKEYS_CANDIDATES];
  const loaded: THREE.Texture[] = [];
  for (const path of paths) {
    const tex = await loadCached(path);
    if (tex) loaded.push(tex);
  }
  return loaded;
}
