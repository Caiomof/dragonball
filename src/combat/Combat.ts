import * as THREE from 'three';
import { ABILITIES, applyDamage } from '../data/gameConfig';
import type { World } from '../world/World';

const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false });
const beamMat = new THREE.MeshBasicMaterial({ color: 0x34b5ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const auraMat = new THREE.MeshBasicMaterial({ color: 0x1c6cff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export class TrainingDummy {
  readonly group = new THREE.Group();
  readonly hitCenter = new THREE.Vector3();
  health = ABILITIES.trainingDummy.health;
  readonly maxHealth = ABILITIES.trainingDummy.health;
  private readonly healthFill = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.13), new THREE.MeshBasicMaterial({ color: 0x6ce9c8, side: THREE.DoubleSide, depthTest: false }));
  private readonly body: THREE.Group;
  private respawnRemaining = 0;
  private flashRemaining = 0;

  constructor(world: World) {
    this.group.name = 'TrainingDummy — Guardião da Clareira';
    this.group.position.copy(world.dummyPosition);
    this.body = new THREE.Group();
    this.group.add(this.body);
    const wood = new THREE.MeshStandardMaterial({ color: 0x8d6040, flatShading: true, roughness: 0.9 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe6be73, metalness: 0.2, roughness: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: 0xb95d4e, roughness: 0.85 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x747f77, roughness: 0.95 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number], rotationX = 0): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...position);
      mesh.rotation.x = rotationX;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.body.add(mesh);
      return mesh;
    };
    add(new THREE.CylinderGeometry(0.83, 1.05, 0.5, 8), stone, [0, 0.24, 0]);
    add(new THREE.CylinderGeometry(0.22, 0.27, 2.25, 9), wood, [0, 1.42, 0]);
    add(new THREE.CylinderGeometry(0.18, 0.18, 1.8, 8), wood, [0, 1.84, 0], Math.PI / 2);
    add(new THREE.SphereGeometry(0.66, 12, 10), red, [0, 2.0, 0]);
    add(new THREE.TorusGeometry(0.47, 0.07, 8, 24), gold, [0, 2.0, -0.52]);
    add(new THREE.TorusGeometry(0.26, 0.067, 8, 24), gold, [0, 2.0, -0.58]);
    add(new THREE.SphereGeometry(0.10, 9, 8), gold, [0, 2.0, -0.63]);
    add(new THREE.ConeGeometry(0.32, 0.55, 5), gold, [0, 2.85, 0]);
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.23), new THREE.MeshBasicMaterial({ color: 0x162a2e, side: THREE.DoubleSide, depthTest: false }));
    barBg.position.set(0, 3.58, 0);
    this.group.add(barBg);
    this.healthFill.position.set(0, 3.58, -0.01);
    this.group.add(this.healthFill);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 6, 44), new THREE.MeshBasicMaterial({ color: 0xffdb8e, transparent: true, opacity: 0.38 }));
    frame.scale.y = 0.28;
    frame.rotation.x = Math.PI / 2;
    frame.position.y = 0.04;
    this.group.add(frame);
    this.hitCenter.copy(this.group.position).add(new THREE.Vector3(0, 2.0, 0));
    world.group.add(this.group);
  }

  takeDamage(amount: number): { actual: number; dead: boolean } {
    if (this.health <= 0) return { actual: 0, dead: false };
    const prev = this.health;
    this.health = applyDamage(this.health, amount);
    this.flashRemaining = 0.3;
    const fraction = this.health / this.maxHealth;
    this.healthFill.scale.x = fraction;
    this.healthFill.position.x = -(1 - fraction) * 0.95;
    if (this.health === 0) {
      this.body.visible = false;
      this.respawnRemaining = ABILITIES.trainingDummy.respawnSeconds;
    }
    return { actual: prev - this.health, dead: this.health === 0 };
  }

  reset(): void {
    this.health = this.maxHealth;
    this.respawnRemaining = 0;
    this.flashRemaining = 0;
    this.body.visible = true;
    this.group.visible = true;
    this.healthFill.scale.x = 1;
    this.healthFill.position.x = 0;
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.flashRemaining > 0) {
      this.flashRemaining -= dt;
      this.body.scale.setScalar(1 + Math.sin(this.flashRemaining * 48) * 0.06);
    } else this.body.scale.setScalar(1);
    if (this.respawnRemaining > 0) {
      this.respawnRemaining -= dt;
      if (this.respawnRemaining <= 0) {
        this.health = this.maxHealth;
        this.body.visible = true;
        this.healthFill.scale.x = 1;
        this.healthFill.position.x = 0;
      }
    }
    this.healthFill.lookAt(camera.position);
    for (const child of this.group.children) {
      if (child instanceof THREE.Mesh && child !== this.healthFill && child.position.y > 3) child.lookAt(camera.position);
    }
  }
}

type Beam = {
  group: THREE.Group;
  origin: THREE.Vector3;
  end: THREE.Vector3;
  direction: THREE.Vector3;
  life: number;
  alreadyHit: boolean;
  targetInRange: boolean;
  body: THREE.Group;
  charge: THREE.Group;
  ring: THREE.Mesh[];
  particle: THREE.Mesh[];
  callback: (damage: number, dead: boolean, position: THREE.Vector3) => void;
  dummy: TrainingDummy;
};

export class CombatEffects {
  private readonly scene: THREE.Scene;
  private readonly beams: Beam[] = [];
  private readonly sparks: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];

  constructor(scene: THREE.Scene) { this.scene = scene; }

  cast(origin: THREE.Vector3, direction: THREE.Vector3, dummy: TrainingDummy, onHit: (damage: number, dead: boolean, position: THREE.Vector3) => void): void {
    const dir = direction.clone().normalize();
    dir.y = THREE.MathUtils.clamp(dir.y, -0.09, 0.17);
    dir.normalize();
    const max = ABILITIES.kamehameha.rangeMeters;
    const end = origin.clone().addScaledVector(dir, max);
    const toTarget = dummy.hitCenter.clone().sub(origin);
    const projected = toTarget.dot(dir);
    const closest = origin.clone().addScaledVector(dir, projected);
    const collision = dummy.health > 0 && projected > 1 && projected < max && closest.distanceTo(dummy.hitCenter) < 1.45;
    if (collision) end.copy(origin).addScaledVector(dir, projected);

    const group = new THREE.Group();
    const charge = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.48, 22, 14), new THREE.MeshBasicMaterial({ color: 0xdffaff, blending: THREE.AdditiveBlending, depthWrite: false }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.98, 18, 12), auraMat);
    charge.add(ball, glow);
    group.add(charge);
    const body = new THREE.Group();
    const makeBeam = (radius: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.95, 1, 18, 1, true), material);
      body.add(mesh);
      return mesh;
    };
    makeBeam(0.48, auraMat);
    makeBeam(0.29, beamMat);
    makeBeam(0.16, coreMat);
    body.visible = false;
    group.add(body);
    const ring: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 6, 28), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xd3f5ff : 0x68d9ff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false }));
      body.add(mesh);
      ring.push(mesh);
    }
    const particle: THREE.Mesh[] = [];
    const sparkleGeo = new THREE.IcosahedronGeometry(0.07, 0);
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(sparkleGeo, i % 2 ? beamMat : coreMat);
      group.add(mesh);
      particle.push(mesh);
    }
    const light = new THREE.PointLight(0x59b8ff, 17, 12);
    charge.add(light);
    this.scene.add(group);
    const beam: Beam = { group, origin: origin.clone(), end, direction: dir, life: 0, alreadyHit: false, targetInRange: collision, body, charge, ring, particle, callback: onHit, dummy };
    this.beams.push(beam);
  }

  update(dt: number): void {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const beam = this.beams[i];
      beam.life += dt;
      const chargeSec = ABILITIES.kamehameha.chargeSeconds;
      const beamSec = ABILITIES.kamehameha.beamSeconds;
      const active = beam.life > chargeSec;
      const t = Math.max(0, (beam.life - chargeSec) / beamSec);
      beam.charge.position.copy(beam.origin);
      beam.charge.visible = !active;
      beam.charge.scale.setScalar(0.36 + Math.min(1, beam.life / chargeSec) * 0.92 + Math.sin(beam.life * 70) * 0.045);
      beam.body.visible = active;
      const length = beam.origin.distanceTo(beam.end);
      const visibleLength = length * THREE.MathUtils.smoothstep(t, 0, 0.27);
      beam.body.position.copy(beam.origin).addScaledVector(beam.direction, visibleLength * 0.5);
      beam.body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beam.direction);
      beam.body.scale.set(1 + Math.sin(t * 56) * 0.10, Math.max(0.01, visibleLength), 1 + Math.sin(t * 54) * 0.10);
      beam.ring.forEach((ring, index) => {
        ring.position.y = -0.5 + ((index / beam.ring.length + t * 1.8) % 1);
        ring.rotation.x = Math.PI / 2;
        ring.scale.setScalar(0.8 + Math.sin(index + t * 48) * 0.15);
      });
      beam.particle.forEach((p, index) => {
        const drift = (index * 17.41) % 6.28;
        const progress = active ? ((index / beam.particle.length + t * 4) % 1) * visibleLength : 0;
        p.position.copy(beam.origin).addScaledVector(beam.direction, progress);
        p.position.x += Math.cos(drift + t * 31) * (active ? 0.35 : 0.58);
        p.position.y += Math.sin(drift + t * 21) * 0.47;
        p.position.z += Math.sin(drift * 2 + t * 22) * 0.28;
        p.visible = beam.life < chargeSec + beamSec;
      });
      if (active && t >= 0.21 && beam.targetInRange && !beam.alreadyHit) {
        beam.alreadyHit = true;
        const result = beam.dummy.takeDamage(ABILITIES.kamehameha.damage);
        if (result && result.actual > 0) {
          this.impact(beam.end);
          beam.callback(result.actual, result.dead, beam.end);
        }
      }
      if (beam.life > chargeSec + beamSec) {
        this.scene.remove(beam.group);
        const geometries = new Set<THREE.BufferGeometry>();
        beam.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) geometries.add(obj.geometry);
        });
        geometries.forEach((geometry) => geometry.dispose());
        this.beams.splice(i, 1);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.life -= dt;
      spark.mesh.position.addScaledVector(spark.velocity, dt);
      spark.velocity.y -= 8 * dt;
      spark.mesh.scale.setScalar(Math.max(0.01, spark.life * 1.8));
      if (spark.life <= 0) { this.scene.remove(spark.mesh); spark.mesh.geometry.dispose(); this.sparks.splice(i, 1); }
    }
  }

  private impact(point: THREE.Vector3): void {
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.08 + Math.random() * 0.1), i % 3 ? beamMat : coreMat);
      mesh.position.copy(point);
      this.scene.add(mesh);
      this.sparks.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.25) * 14, (Math.random() - 0.5) * 16), life: 0.4 + Math.random() * 0.4 });
    }
  }

  get activeCount(): number { return this.beams.length; }
}
