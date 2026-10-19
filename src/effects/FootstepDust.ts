import * as THREE from 'three';
import type { Biome } from '../world/landscape';

type Speck = { sprite: THREE.Sprite; life: number; max: number; vy: number; vx: number; vz: number };

function softMote(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  glow.addColorStop(0.65, 'rgba(255,255,255,0.12)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const mote = softMote();

const BIOME_DUST: Record<Biome, number> = {
  crimson: 0x8a4030,
  plains: 0x9ec86a,
  desert: 0xe4b56a,
  snow: 0xf0f6ff,
};

export class FootstepDust {
  private readonly group = new THREE.Group();
  private readonly specks: Speck[] = [];
  private stepClock = 0;

  constructor(parent: THREE.Object3D) {
    parent.add(this.group);
  }

  step(biome: Biome, x: number, y: number, z: number, speed: number, sprint = false): void {
    if (speed < 0.4) return;
    const pace = 0.14 / Math.min(3.2, 0.2 + speed * 0.28);
    this.stepClock -= pace;
    if (this.stepClock > 0) return;
    this.stepClock = sprint ? 0.28 : speed > 5 ? 0.38 : 0.52;
    const color = BIOME_DUST[biome] ?? BIOME_DUST.plains;
    const count = sprint ? 12 : speed > 5 ? 9 : 6;
    const spread = sprint ? 0.55 : 0.42;
    const baseSize = sprint ? 0.22 : 0.16;
    for (let i = 0; i < count; i++) {
      const material = new THREE.SpriteMaterial({
        map: mote,
        color,
        transparent: true,
        opacity: sprint ? 0.72 : 0.58,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(material);
      const size = baseSize + Math.random() * (sprint ? 0.2 : 0.14);
      sprite.scale.set(size, size * (0.75 + Math.random() * 0.25), 1);
      sprite.position.set(
        x + (Math.random() - 0.5) * spread,
        y + 0.06 + Math.random() * 0.04,
        z + (Math.random() - 0.5) * spread
      );
      this.group.add(sprite);
      const burst = sprint ? 1.35 : 1;
      this.specks.push({
        sprite,
        life: 0,
        max: 0.42 + Math.random() * 0.28,
        vy: (0.35 + Math.random() * 0.55) * burst,
        vx: (Math.random() - 0.5) * 0.65 * burst,
        vz: (Math.random() - 0.5) * 0.65 * burst,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.specks.length - 1; i >= 0; i--) {
      const speck = this.specks[i];
      speck.life += dt;
      const t = speck.life / speck.max;
      speck.sprite.position.x += speck.vx * dt;
      speck.sprite.position.y += speck.vy * dt;
      speck.sprite.position.z += speck.vz * dt;
      speck.vy -= dt * 0.9;
      speck.sprite.scale.multiplyScalar(1 + dt * 1.35);
      const mat = speck.sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, (1 - t * t) * 0.7);
      if (speck.life >= speck.max) {
        this.group.remove(speck.sprite);
        mat.dispose();
        this.specks.splice(i, 1);
      }
    }
  }
}
