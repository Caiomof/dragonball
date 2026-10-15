import * as THREE from 'three';
import type { World } from '../world/World';
import { applyDamage } from '../data/gameConfig';
import type { CombatEffects, AttackVisual } from './Combat';

export class BiomeBoss {
  readonly group = new THREE.Group();
  readonly hitCenter = new THREE.Vector3();
  health: number;
  readonly maxHealth: number;
  private readonly body: THREE.Group;
  private readonly core: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private attackCooldown = 1.2;
  private strafe = 0;
  private alive = false;
  private flash = 0;

  constructor(private readonly world: World, private readonly combat: CombatEffects) {
    this.maxHealth = 280;
    this.health = this.maxHealth;
    this.group.name = 'Guardião do Totem';
    this.body = new THREE.Group();
    this.group.add(this.body);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x4ec9e8, emissive: 0x1a6a88, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.35, flatShading: true })
    );
    shell.position.y = 2.4;
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.core.position.y = 2.55;
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.08, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 2.35;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0xffe08a, metalness: 0.5, roughness: 0.4 }));
    crown.position.y = 3.35;
    this.body.add(shell, this.core, this.ring, crown);
    const light = new THREE.PointLight(0x6ed4ff, 0, 14);
    light.position.y = 2.5;
    this.body.add(light);
    this.group.visible = false;
    world.group.add(this.group);
  }

  summon(x: number, z: number): void {
    const y = this.world.height(x, z);
    this.group.position.set(x, y, z);
    this.health = this.maxHealth;
    this.alive = true;
    this.body.visible = true;
    this.group.visible = true;
    this.attackCooldown = 1.4;
    this.strafe = Math.random() * Math.PI * 2;
    this.hitCenter.copy(this.group.position).add(new THREE.Vector3(0, 2.5, 0));
  }

  dismiss(): void {
    this.alive = false;
    this.group.visible = false;
  }

  get active(): boolean {
    return this.alive && this.health > 0;
  }

  takeDamage(amount: number): { actual: number; dead: boolean } {
    if (!this.active) return { actual: 0, dead: false };
    const prev = this.health;
    this.health = applyDamage(this.health, amount);
    this.flash = 0.25;
    if (this.health === 0) {
      this.alive = false;
      this.body.visible = false;
    }
    return { actual: prev - this.health, dead: this.health === 0 };
  }

  update(dt: number, player: THREE.Vector3, camera: THREE.Camera, onHitPlayer: (damage: number) => void): void {
    if (!this.group.visible) return;
    if (this.flash > 0) {
      this.flash -= dt;
      this.body.scale.setScalar(1 + Math.sin(this.flash * 40) * 0.06);
    } else this.body.scale.setScalar(1);
    if (!this.active) return;
    this.hitCenter.copy(this.group.position).add(new THREE.Vector3(0, 2.5, 0));
    const toPlayer = player.clone().sub(this.group.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (dist > 0.4) toPlayer.normalize();
    this.strafe += dt * 0.85;
    const orbit = new THREE.Vector3(Math.cos(this.strafe) * 6, 0, Math.sin(this.strafe) * 6).add(new THREE.Vector3(player.x, 0, player.z));
    const gy = this.world.height(orbit.x, orbit.z);
    this.group.position.lerp(new THREE.Vector3(orbit.x, gy, orbit.z), Math.min(1, dt * 1.8));
    this.body.lookAt(player.x, this.group.position.y + 2.2, player.z);
    this.core.rotation.y += dt * 2.2;
    this.ring.rotation.z += dt * 1.4;
    const light = this.body.children.find(c => c instanceof THREE.PointLight) as THREE.PointLight | undefined;
    if (light) light.intensity = 4 + Math.sin(this.strafe * 3) * 1.5;
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0 && dist < 42) {
      this.attackCooldown = 2.1 + Math.random() * 1.2;
      const origin = this.hitCenter.clone();
      const target = player.clone().add(new THREE.Vector3(0, 1.2, 0));
      const style: AttackVisual = {
        style: Math.random() > 0.45 ? 'orb' : 'galick',
        color: 0xff7a4a,
        core: 0xffe0b0,
        chargeSeconds: 0.35,
        effectSeconds: 0.55,
        size: 0.85,
      };
      this.combat.cast(origin, target, style, point => {
        if (point.distanceTo(player) < 2.8) onHitPlayer(14);
      });
    }
    this.core.lookAt(camera.position);
  }

}
