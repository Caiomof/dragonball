import * as THREE from 'three';
import { WORLD_HALF } from '../data/gameConfig';

type Obstacle = { x: number; z: number; radius: number };
type MovingCloud = { group: THREE.Group; speed: number };

function randomGenerator(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class World {
  readonly group = new THREE.Group();
  readonly obstacles: Obstacle[] = [];
  readonly spawn = new THREE.Vector3(0, 0, 9);
  readonly dummyPosition = new THREE.Vector3(0, 0, -15);
  private readonly clouds: MovingCloud[] = [];
  private readonly fireflies: THREE.Points;
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2(0xa9b8b7, 0.0058);
    this.addSky(scene);
    this.addLights(scene);
    this.addTerrain();
    this.addMountains();
    this.addTrees();
    this.addRocks();
    this.addGrass();
    this.addTrainingRing();
    this.addRuins();
    this.fireflies = this.addFireflies();
    scene.add(this.group);
    this.spawn.y = this.height(this.spawn.x, this.spawn.z);
    this.dummyPosition.y = this.height(this.dummyPosition.x, this.dummyPosition.z);
  }

  height(x: number, z: number): number {
    const d = Math.hypot(x, z);
    const flatten = THREE.MathUtils.smoothstep(d, 17, 38);
    const broad = Math.sin(x * 0.054) * Math.cos(z * 0.051) * 2.5;
    const ridges = Math.sin(x * 0.113 + z * 0.064) * 1.65 + Math.cos(z * 0.117 - x * 0.066) * 1.25;
    const detail = Math.sin(x * 0.31) * Math.sin(z * 0.26) * 0.32;
    const edge = Math.pow(Math.max(0, d - 60) / 60, 1.7) * 12;
    return (broad + ridges + detail + edge) * flatten;
  }

  isWalkable(x: number, z: number, radius = 0.48): boolean {
    if (Math.abs(x) > WORLD_HALF - 3 || Math.abs(z) > WORLD_HALF - 3) return false;
    return !this.obstacles.some((obj) => Math.hypot(x - obj.x, z - obj.z) < obj.radius + radius);
  }

  update(dt: number): void {
    this.elapsed += dt;
    for (const cloud of this.clouds) {
      cloud.group.position.x += dt * cloud.speed;
      if (cloud.group.position.x > 260) cloud.group.position.x = -260;
    }
    this.fireflies.rotation.y = this.elapsed * 0.003;
    const material = this.fireflies.material as THREE.PointsMaterial;
    material.opacity = 0.4 + Math.sin(this.elapsed * 1.2) * 0.14;
  }

  private addSky(scene: THREE.Scene): void {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(460, 36, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `varying vec3 vWorld; void main(){ vec4 world=modelMatrix*vec4(position,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`,
        fragmentShader: `varying vec3 vWorld; void main(){ float h=normalize(vWorld).y; vec3 sunset=vec3(0.99,0.72,0.49); vec3 horizon=vec3(0.93,0.70,0.68); vec3 top=vec3(0.30,0.51,0.77); vec3 low=mix(sunset,horizon,smoothstep(-0.07,0.13,h)); vec3 sky=mix(low,top,smoothstep(0.02,0.85,h)); gl_FragColor=vec4(sky,1.0); }`
      })
    );
    sky.frustumCulled = false;
    scene.add(sky);

    const sun = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 20), new THREE.MeshBasicMaterial({ color: 0xffe2a5, fog: false }));
    sun.position.set(-160, 50, -315);
    scene.add(sun);
    const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(29, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd09c, transparent: true, opacity: 0.17, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sunGlow.position.copy(sun.position);
    scene.add(sunGlow);

    const rnd = randomGenerator(81811);
    for (let i = 0; i < 21; i++) {
      const cloud = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffd6ca : 0xffece0, transparent: true, opacity: 0.83, fog: false, depthWrite: false });
      const parts = 3 + Math.floor(rnd() * 3);
      for (let p = 0; p < parts; p++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), mat);
        puff.scale.set(10 + rnd() * 15, 2.4 + rnd() * 2.1, 5 + rnd() * 5);
        puff.position.set((p - parts / 2) * 11, rnd() * 3, rnd() * 6);
        cloud.add(puff);
      }
      cloud.position.set((rnd() - 0.5) * 360, 47 + rnd() * 40, -90 - rnd() * 240);
      scene.add(cloud);
      this.clouds.push({ group: cloud, speed: 0.35 + rnd() * 0.7 });
    }
  }

  private addLights(scene: THREE.Scene): void {
    scene.add(new THREE.HemisphereLight(0xd5eaff, 0x697b52, 2.0));
    const sunLight = new THREE.DirectionalLight(0xffd4a0, 2.65);
    sunLight.position.set(-65, 100, -90);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -62;
    sunLight.shadow.camera.right = 62;
    sunLight.shadow.camera.top = 62;
    sunLight.shadow.camera.bottom = -62;
    sunLight.shadow.camera.far = 280;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.023;
    scene.add(sunLight);
    const fill = new THREE.DirectionalLight(0x8bc5f7, 0.42);
    fill.position.set(30, 18, 60);
    scene.add(fill);
  }

  private addTerrain(): void {
    const segments = 150;
    const geometry = new THREE.PlaneGeometry(WORLD_HALF * 2 + 20, WORLD_HALF * 2 + 20, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const grass = new THREE.Color('#598b48');
    const lightGrass = new THREE.Color('#83aa5d');
    const sandy = new THREE.Color('#a2a267');
    const v = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = this.height(x, z);
      position.setY(i, y);
      const wave = Math.sin(x * 0.22) * Math.sin(z * 0.19) * 0.5 + 0.5;
      v.copy(grass).lerp(lightGrass, wave * 0.68 + 0.08);
      v.lerp(sandy, THREE.MathUtils.smoothstep(y, 8, 18) * 0.42);
      colors[i * 3] = v.r;
      colors[i * 3 + 1] = v.g;
      colors[i * 3 + 2] = v.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, side: THREE.DoubleSide }));
    terrain.receiveShadow = true;
    terrain.name = 'Terreno da Planície Esmeralda';
    this.group.add(terrain);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(163, 165, 21, 12), new THREE.MeshStandardMaterial({ color: 0x51694c, roughness: 1 }));
    under.position.y = -12.5;
    this.group.add(under);
  }

  private addMountains(): void {
    const rnd = randomGenerator(3228);
    const rockMats = [0x819c80, 0x869d8d, 0x738e7d, 0x9b9b88].map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }));
    for (let i = 0; i < 38; i++) {
      const theta = (i / 38) * Math.PI * 2;
      const dist = 158 + rnd() * 55;
      const tall = 30 + rnd() * 64;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(18 + rnd() * 18, tall, 5 + (i % 3)), rockMats[i % rockMats.length]);
      peak.position.set(Math.cos(theta) * dist, tall * 0.38 - 9, Math.sin(theta) * dist);
      peak.rotation.y = rnd() * Math.PI;
      this.group.add(peak);
    }
  }

  private addTrees(): void {
    const rnd = randomGenerator(98491);
    const placements: { x: number; z: number; s: number; variant: number }[] = [];
    for (let i = 0; i < 130; i++) {
      const x = (rnd() - 0.5) * 206;
      const z = (rnd() - 0.5) * 206;
      const fromCenter = Math.hypot(x, z - 3);
      if (fromCenter < 22 || Math.abs(x) > 101 || Math.abs(z) > 101) continue;
      if (rnd() < 0.22 && fromCenter < 44) continue;
      const s = 0.72 + rnd() * 0.73;
      placements.push({ x, z, s, variant: i % 4 });
      this.obstacles.push({ x, z, radius: 0.75 * s });
    }
    const trunkGeo = new THREE.CylinderGeometry(0.38, 0.62, 4.5, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x766247, roughness: 1, flatShading: true });
    const trunkInstances = new THREE.InstancedMesh(trunkGeo, trunkMat, placements.length);
    const leafGeo = new THREE.IcosahedronGeometry(2.6, 1);
    const canopyMaterials = [0x4e8b57, 0x6b9c58, 0x3f8465].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
    const canopies = canopyMaterials.map((mat) => new THREE.InstancedMesh(leafGeo, mat, placements.length * 2));
    const dummy = new THREE.Object3D();
    const counts = [0, 0, 0];
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const ground = this.height(p.x, p.z);
      dummy.position.set(p.x, ground + 2.25 * p.s, p.z);
      dummy.rotation.set(0, rnd() * 5, 0);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      trunkInstances.setMatrixAt(i, dummy.matrix);
      const c = p.variant % 3;
      for (let j = 0; j < 2; j++) {
        dummy.position.set(p.x + (j ? 1.1 : -0.7) * p.s, ground + (5.6 + j * 1.25) * p.s, p.z + (j ? 0.3 : -0.7) * p.s);
        dummy.scale.setScalar(p.s * (j ? 0.76 : 1));
        dummy.rotation.set(0.1, rnd() * 5, 0);
        dummy.updateMatrix();
        canopies[c].setMatrixAt(counts[c]++, dummy.matrix);
      }
    }
    trunkInstances.castShadow = true;
    trunkInstances.receiveShadow = true;
    this.group.add(trunkInstances);
    canopies.forEach((mesh, i) => {
      mesh.count = counts[i];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    });
  }

  private addRocks(): void {
    const rnd = randomGenerator(2344);
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8d9f90, roughness: 1, flatShading: true });
    const count = 78;
    const rocks = new THREE.InstancedMesh(geo, mat, count);
    const obj = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      let x = (rnd() - 0.5) * 198;
      let z = (rnd() - 0.5) * 198;
      if (Math.hypot(x, z - 2) < 24) { x += x > 0 ? 24 : -24; z += 15; }
      const radius = 0.7 + rnd() * 2.5;
      obj.position.set(x, this.height(x, z) + radius * 0.37, z);
      obj.rotation.set(rnd() * 2, rnd() * 6, rnd() * 2);
      obj.scale.set(radius * 1.2, radius * (0.5 + rnd() * 0.7), radius * 0.9);
      obj.updateMatrix();
      rocks.setMatrixAt(i, obj.matrix);
      if (radius > 1.6) this.obstacles.push({ x, z, radius: radius * 0.75 });
    }
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.group.add(rocks);
  }

  private addGrass(): void {
    const rnd = randomGenerator(8912);
    const bladeGeo = new THREE.ConeGeometry(0.11, 0.8, 3);
    const mats = [0x9cbd65, 0x7fa950, 0x5f984c].map((c) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 1 }));
    const total = 5800;
    const grass = mats.map((mat) => new THREE.InstancedMesh(bladeGeo, mat, total));
    const counts = [0, 0, 0];
    const obj = new THREE.Object3D();
    for (let i = 0; i < total; i++) {
      const x = (rnd() - 0.5) * 203;
      const z = (rnd() - 0.5) * 203;
      const h = this.height(x, z);
      if (Math.abs(h) > 16 || Math.hypot(x, z - 5) < 5) continue;
      obj.position.set(x, h + 0.2, z);
      obj.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.22);
      obj.scale.set(0.6 + rnd() * 1.1, 0.5 + rnd() * 0.7, 0.6 + rnd() * 1.1);
      obj.updateMatrix();
      const slot = i % 3;
      grass[slot].setMatrixAt(counts[slot]++, obj.matrix);
    }
    grass.forEach((mesh, i) => { mesh.count = counts[i]; mesh.receiveShadow = true; this.group.add(mesh); });
    const bloomGeo = new THREE.IcosahedronGeometry(0.15, 0);
    const bloom = new THREE.InstancedMesh(bloomGeo, new THREE.MeshStandardMaterial({ color: 0xffe7a7, emissive: 0xffa64a, emissiveIntensity: 0.35 }), 280);
    for (let i = 0; i < 280; i++) {
      const x = (rnd() - 0.5) * 180;
      const z = (rnd() - 0.5) * 180;
      obj.position.set(x, this.height(x, z) + 0.35, z);
      obj.scale.setScalar(0.45 + rnd() * 0.85);
      obj.rotation.set(0, 0, 0);
      obj.updateMatrix();
      bloom.setMatrixAt(i, obj.matrix);
    }
    this.group.add(bloom);
  }

  private addTrainingRing(): void {
    const y = this.height(0, -15);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.085, 7, 72), new THREE.MeshStandardMaterial({ color: 0xf3d4a0, emissive: 0xc88d4e, emissiveIntensity: 0.6, roughness: 0.55 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, y + 0.1, -15);
    this.group.add(ring);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const small = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 1.2), new THREE.MeshStandardMaterial({ color: 0xd7c68f, emissive: 0xb4a05b, emissiveIntensity: 0.13 }));
      small.rotation.y = angle;
      small.position.set(Math.sin(angle) * 5.1, y + 0.08, -15 + Math.cos(angle) * 5.1);
      this.group.add(small);
    }
  }

  private addRuins(): void {
    const column = new THREE.CylinderGeometry(0.8, 1.15, 4.6, 7);
    const stone = new THREE.MeshStandardMaterial({ color: 0xc6bda1, roughness: 0.95, flatShading: true });
    for (const [x, z, h] of [[-23, -24, 3.8], [-18, -28, 3.1], [25, -36, 4], [29, -33, 2.7]] as const) {
      const pillar = new THREE.Mesh(column, stone);
      pillar.position.set(x, this.height(x, z) + h / 2, z);
      pillar.scale.y = h / 4.6;
      pillar.rotation.z = Math.sin(x) * 0.13;
      pillar.castShadow = true;
      this.group.add(pillar);
    }
  }

  private addFireflies(): THREE.Points {
    const rand = randomGenerator(33001);
    const pts = new Float32Array(340 * 3);
    for (let i = 0; i < 340; i++) {
      const x = (rand() - 0.5) * 160;
      const z = (rand() - 0.5) * 160;
      pts[i * 3] = x;
      pts[i * 3 + 1] = this.height(x, z) + 0.9 + rand() * 5;
      pts[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffebb0, size: 0.16, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.group.add(points);
    return points;
  }
}
