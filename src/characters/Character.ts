import * as THREE from 'three';
import type { Race, RaceId } from '../data/gameConfig';

const toon = (color: THREE.ColorRepresentation, emissive: THREE.ColorRepresentation = 0x000000) => new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: 0.2 });

function shape(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function orb(group: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE.Mesh {
  const mesh = shape(group, new THREE.SphereGeometry(1, 16, 12), mat, x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

function tube(group: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, radiusTop: number, radiusBottom: number, length: number, sides = 10): THREE.Mesh {
  return shape(group, new THREE.CylinderGeometry(radiusTop, radiusBottom, length, sides), mat, x, y, z);
}

type Palette = { skin: string; hair: string; top: string; bottom: string; trim: string; boot: string; eye: string };

const palettes: Record<RaceId, Palette> = {
  saiyajin: { skin: '#e6b48f', hair: '#172439', top: '#ef8936', bottom: '#253a6e', trim: '#ffe6a3', boot: '#20344c', eye: '#152238' },
  terraqueo: { skin: '#bd8061', hair: '#4c2e28', top: '#3caaa0', bottom: '#f4e1b0', trim: '#f2d267', boot: '#5b4534', eye: '#26323a' },
  namekuseijin: { skin: '#74bb63', hair: '#73bd64', top: '#7a66ae', bottom: '#ebe5d7', trim: '#e4c58a', boot: '#8e5a57', eye: '#4d3941' },
  majin: { skin: '#ef9dc0', hair: '#ef9dc0', top: '#282a45', bottom: '#e0e6e9', trim: '#f4c96f', boot: '#e6c958', eye: '#40334f' }
};

export class Character {
  readonly root = new THREE.Group();
  readonly figure = new THREE.Group();
  readonly leftArm = new THREE.Group();
  readonly rightArm = new THREE.Group();
  readonly leftLeg = new THREE.Group();
  readonly rightLeg = new THREE.Group();
  readonly race: Race;
  private readonly face: THREE.Group;
  private readonly aura: THREE.Group;
  private elapsed = 0;

  constructor(race: Race) {
    this.race = race;
    const p = palettes[race.id];
    const skin = toon(p.skin);
    const hair = toon(p.hair);
    const shirt = toon(p.top);
    const pants = toon(p.bottom);
    const accent = toon(p.trim);
    const boots = toon(p.boot);
    const eye = toon(p.eye);
    const white = toon('#f9f3dd');
    this.root.name = `Guerreiro - ${race.name}`;
    this.root.add(this.figure);

    const body = shape(this.figure, new THREE.CylinderGeometry(0.49, 0.4, 0.93, 10), shirt, 0, 1.75, 0);
    body.scale.z = 0.78;
    orb(this.figure, shirt, 0, 2.09, 0, 0.52, 0.16, 0.38);
    tube(this.figure, accent, 0, 1.32, 0, 0.43, 0.43, 0.13);
    tube(this.figure, pants, 0, 1.17, 0, 0.46, 0.43, 0.3);
    shape(this.figure, new THREE.BoxGeometry(0.23, 0.24, 0.07), accent, 0, 1.32, -0.45);
    if (race.id === 'saiyajin') {
      orb(this.figure, accent, 0, 1.88, -0.42, 0.23, 0.24, 0.055);
      orb(this.figure, white, -0.25, 2.12, 0, 0.24, 0.18, 0.35);
      orb(this.figure, white, 0.25, 2.12, 0, 0.24, 0.18, 0.35);
    }
    if (race.id === 'namekuseijin') {
      const scarf = tube(this.figure, white, 0, 2.18, 0, 0.37, 0.52, 0.32, 12);
      scarf.scale.z = 0.89;
      const cape = shape(this.figure, new THREE.ConeGeometry(0.6, 1.4, 4, 1, true), white, 0, 1.54, 0.27);
      cape.scale.z = 0.35;
      cape.rotation.x = -0.21;
    }
    if (race.id === 'majin') {
      const ornament = orb(this.figure, accent, 0, 1.87, -0.41, 0.13, 0.13, 0.05);
      ornament.rotation.z = Math.PI / 4;
    }

    this.buildArm(this.leftArm, -0.64, shirt, skin, accent);
    this.buildArm(this.rightArm, 0.64, shirt, skin, accent);
    this.figure.add(this.leftArm, this.rightArm);
    this.buildLeg(this.leftLeg, -0.27, pants, boots, accent);
    this.buildLeg(this.rightLeg, 0.27, pants, boots, accent);
    this.figure.add(this.leftLeg, this.rightLeg);

    const neck = tube(this.figure, skin, 0, 2.32, 0, 0.17, 0.21, 0.25);
    neck.scale.z = 0.88;
    this.face = new THREE.Group();
    this.face.position.y = 2.64;
    this.figure.add(this.face);
    orb(this.face, skin, 0, 0, 0, race.id === 'majin' ? 0.44 : 0.39, race.id === 'majin' ? 0.48 : 0.45, 0.4);
    orb(this.face, skin, 0, -0.23, -0.11, 0.29, 0.2, 0.28);
    for (const x of [-0.145, 0.145]) {
      orb(this.face, white, x, 0.025, -0.353, 0.091, 0.13, 0.038);
      orb(this.face, eye, x, 0.022, -0.395, 0.037, 0.095, 0.014);
      const brow = orb(this.face, hair, x, 0.172, -0.358, 0.104, 0.031, 0.027);
      brow.rotation.z = x < 0 ? -0.2 : 0.2;
    }
    orb(this.face, skin, 0, -0.13, -0.4, 0.064, 0.075, 0.06);
    const mouth = orb(this.face, eye, 0, -0.278, -0.37, 0.078, 0.018, 0.015);
    mouth.scale.y = 0.7;

    if (race.id === 'saiyajin') this.addHair(hair, 10, 0.65, true);
    if (race.id === 'terraqueo') this.addHair(hair, 9, 0.27, false);
    if (race.id === 'namekuseijin') {
      for (const x of [-0.25, 0.25]) {
        const ear = shape(this.face, new THREE.ConeGeometry(0.14, 0.33, 5), skin, x > 0 ? 0.43 : -0.43, -0.055, 0);
        ear.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        const antenna = tube(this.face, skin, x * 0.8, 0.52, -0.17, 0.07, 0.105, 0.38, 7);
        antenna.rotation.z = x > 0 ? -0.27 : 0.27;
        orb(this.face, skin, x * 0.8 + (x > 0 ? 0.06 : -0.06), 0.73, -0.17, 0.085, 0.1, 0.085);
      }
      for (const side of [-1, 1]) {
        orb(this.figure, accent, side * 0.79, 1.62, -0.01, 0.18, 0.13, 0.17);
      }
    }
    if (race.id === 'majin') {
      const horn = shape(this.face, new THREE.ConeGeometry(0.18, 0.87, 12), skin, 0.13, 0.73, 0.13);
      horn.rotation.z = -0.3;
      const tip = orb(this.face, skin, 0.38, 1.07, 0.15, 0.17, 0.19, 0.16);
      tip.rotation.z = 0.2;
      for (const side of [-1, 1]) orb(this.face, skin, side * 0.41, -0.04, -0.02, 0.15, 0.12, 0.15);
    }

    this.aura = new THREE.Group();
    const auraMat = new THREE.MeshBasicMaterial({ color: 0x7bd8ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
    const auraCone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.8, 18, 1, true), auraMat);
    auraCone.position.y = 1.75;
    this.aura.add(auraCone);
    this.aura.visible = false;
    this.root.add(this.aura);
  }

  private buildArm(group: THREE.Group, x: number, shirt: THREE.Material, skin: THREE.Material, trim: THREE.Material): void {
    group.position.set(x, 2.01, 0);
    orb(group, shirt, 0, -0.12, 0, 0.23, 0.25, 0.24);
    const upper = tube(group, skin, 0, -0.43, 0, 0.13, 0.15, 0.61);
    upper.rotation.z = x < 0 ? -0.05 : 0.05;
    tube(group, trim, 0, -0.82, 0, 0.16, 0.14, 0.18);
    orb(group, skin, 0, -1.00, -0.025, 0.145, 0.19, 0.14);
  }

  private buildLeg(group: THREE.Group, x: number, pants: THREE.Material, boots: THREE.Material, trim: THREE.Material): void {
    group.position.set(x, 1.14, 0);
    tube(group, pants, 0, -0.32, 0, 0.22, 0.16, 0.71);
    tube(group, boots, 0, -0.76, 0, 0.17, 0.23, 0.45);
    tube(group, trim, 0, -0.57, 0, 0.19, 0.19, 0.09);
    orb(group, boots, 0, -1.04, -0.13, 0.23, 0.15, 0.33);
  }

  private addHair(mat: THREE.Material, count: number, length: number, dramatic: boolean): void {
    orb(this.face, mat, 0, 0.27, 0.04, 0.41, 0.31, 0.41);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 0.29;
      const spike = shape(this.face, new THREE.ConeGeometry(dramatic ? 0.20 : 0.15, length * (0.9 + ((i * 7) % 4) * 0.22), 5), mat,
        Math.cos(angle) * radius, 0.43 + (i % 3) * 0.04, Math.sin(angle) * radius);
      spike.rotation.z = -Math.cos(angle) * (dramatic ? 0.45 : 0.25);
      spike.rotation.x = Math.sin(angle) * (dramatic ? 0.45 : 0.24);
    }
    for (let i = -2; i <= 2; i++) {
      const bang = shape(this.face, new THREE.ConeGeometry(0.11, 0.33, 5), mat, i * 0.13, 0.26, -0.31);
      bang.rotation.x = -Math.PI * 0.24;
      bang.rotation.z = i * 0.09;
    }
  }

  animate(dt: number, speed: number, airborne: boolean, attacking: boolean): void {
    this.elapsed += dt;
    const moving = Math.min(1, speed / 7);
    const step = this.elapsed * (speed > 6 ? 12 : 8.5);
    const sway = Math.sin(step) * moving;
    this.leftLeg.rotation.x = airborne ? -0.14 : sway * 0.52;
    this.rightLeg.rotation.x = airborne ? 0.25 : -sway * 0.52;
    this.leftArm.rotation.x = attacking ? 1.35 : -sway * 0.48;
    this.rightArm.rotation.x = attacking ? 1.35 : sway * 0.48;
    this.leftArm.rotation.z = attacking ? -0.30 : 0.035;
    this.rightArm.rotation.z = attacking ? 0.30 : -0.035;
    this.figure.position.y = airborne ? 0 : Math.abs(Math.sin(step)) * 0.08 * moving + Math.sin(this.elapsed * 2) * 0.023;
    this.figure.rotation.z = Math.sin(step * 0.5) * 0.025 * moving;
    this.aura.visible = attacking;
    this.aura.scale.setScalar(1 + Math.sin(this.elapsed * 23) * 0.06);
  }

  getMuzzleWorldPosition(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    const position = new THREE.Vector3(0, 1.62, -0.85);
    return this.root.localToWorld(position);
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        geometries.add(obj.geometry);
        const entries = Array.isArray(obj.material) ? obj.material : [obj.material];
        entries.forEach((material) => materials.add(material));
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
