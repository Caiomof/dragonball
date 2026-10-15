import * as THREE from 'three';
import { WORLD_HALF, TERRAIN_SEGMENTS, TERRAIN_WIDTH, rawHeight, terrainHeight, riverCenter, riverWidth, waterLevel, waterDepth, waterFootprint, isSwimming, biomeWeights, biomeAt, LANDMARKS } from './landscape';

type Obstacle = { x: number; z: number; radius: number; active?: boolean; height?: number };
type Part = { mesh: THREE.InstancedMesh; index: number; transform: THREE.Matrix4 };
type Breakable = { id: number; center: THREE.Vector3; radius: number; health: number; maxHealth: number; respawn: number; parts: Part[]; standalone?: THREE.Object3D; obstacle?: Obstacle };
export type WorldHit = { point: THREE.Vector3; distance: number; objectId?: number; dummy?: boolean; final?: boolean };
export type DummyTarget = { hitCenter: THREE.Vector3; health: number };

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
  private readonly waterShader: THREE.ShaderMaterial;
  private readonly fireflies: THREE.Points;
  private elapsed = 0;
  private readonly detailObjects: THREE.Object3D[] = [];
  private readonly ripples: {mesh:THREE.Mesh; age:number}[] = [];
  private readonly breakables: Breakable[] = [];
  private nextBreakableId = 1;
  readonly respawnSeconds = 120;

  constructor(scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2(0xa9b8b7, 0.0031);
    this.waterShader = this.makeRiverMaterial();
    this.addSky(scene);
    this.addLights(scene);
    this.addTerrain();
    this.addRiver();
    this.addMountains();
    this.addTrees();
    this.addRocks();
    this.addGrass();
    this.addTrainingRing();
    this.addRuins();
    this.addBiomes();
    this.fireflies = this.addFireflies();
    scene.add(this.group);
    this.spawn.y = this.height(this.spawn.x, this.spawn.z);
    this.dummyPosition.y = this.height(this.dummyPosition.x, this.dummyPosition.z);
  }

  private rawHeight(x:number,z:number):number { return rawHeight(x,z); }
  private riverCenter(z:number):number { return riverCenter(z); }
  private riverWidth(z:number):number { return riverWidth(z); }
  private riverSurface(z:number):number { return waterLevel(z); }
  inRiver(x:number,z:number):boolean { return isSwimming(x,z); }
  waterLevel(_x:number,z:number):number { return waterLevel(z); }
  depth(x:number,z:number):number { return waterDepth(x,z); }
  height(x:number,z:number):number { return terrainHeight(x,z); }
  canFly(x:number,y:number,z:number):boolean {
    return Math.abs(x)<WORLD_HALF-3&&Math.abs(z)<WORLD_HALF-3&&y<95&&!this.obstacles.some(o=>o.active!==false&&Math.hypot(x-o.x,z-o.z)<o.radius+.45&&y<this.height(o.x,o.z)+(o.height??6));
  }
  setQuality(low:boolean):void { for(const item of this.detailObjects)item.visible=!low; }
  isWalkable(x: number, z: number, radius = 0.48): boolean {
    if (Math.abs(x) > WORLD_HALF - 3 || Math.abs(z) > WORLD_HALF - 3) return false;
    return !this.obstacles.some((obj) => obj.active !== false && Math.hypot(x - obj.x, z - obj.z) < obj.radius + radius);
  }

  update(dt: number): void {
    this.elapsed += dt;
    for (const cloud of this.clouds) {
      cloud.group.position.x += dt * cloud.speed;
      if (cloud.group.position.x > 260) cloud.group.position.x = -260;
    }
    for (const entry of this.breakables) {
      if (entry.respawn <= 0) continue;
      entry.respawn -= dt;
      if (entry.respawn > 0) continue;
      entry.health = entry.maxHealth;
      if (entry.standalone) entry.standalone.visible = true;
      if (entry.obstacle) entry.obstacle.active = true;
      for (const part of entry.parts) { part.mesh.setMatrixAt(part.index, part.transform); part.mesh.instanceMatrix.needsUpdate = true; part.mesh.computeBoundingSphere(); }
    }
    for(let i=this.ripples.length-1;i>=0;i--){const r=this.ripples[i];r.age+=dt;r.mesh.scale.setScalar(1+r.age*2.5);(r.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.4-r.age*.35);if(r.age>1.2){this.group.remove(r.mesh);r.mesh.geometry.dispose();(r.mesh.material as THREE.Material).dispose();this.ripples.splice(i,1);}}
    this.waterShader.uniforms.uTime.value = this.elapsed;
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
        vertexShader: `varying vec3 vWorld; void main(){ vec4 world=modelMatrix*vec4(position,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; gl_Position.z=gl_Position.w; }`,
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

  private makeRiverMaterial(): THREE.ShaderMaterial {
    // One continuous translucent ribbon, subtle travelling ripples and soft foam.
    return new THREE.ShaderMaterial({
      transparent: false, depthWrite: true, side: THREE.FrontSide,
      uniforms: { uTime: {value:0} },
      vertexShader: `varying vec2 vUV; varying vec3 vPos; void main(){
        vUV=uv; vPos=position;
        vec3 p=position;
        p.y+=sin(uv.y*66.0+uv.x*12.0)*0.008;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
      fragmentShader: `uniform float uTime; varying vec2 vUV; varying vec3 vPos;
        void main(){
          float lake=smoothstep(.52,.74,vUV.y);
          float flow=vUV.y*59.0-uTime*mix(1.7,.35,lake);
          float ripples=sin(flow+sin(vUV.x*27.0+uTime*.5)*1.6)*.5+.5;
          float small=sin(vUV.x*92.0+vUV.y*141.0-uTime*3.8)*.5+.5;
          float shore=pow(abs(vUV.x-.5)*2.0, 3.0);
          vec3 deep=vec3(.035,.32,.40);
          vec3 shallow=vec3(.14,.59,.68);
          vec3 color=mix(deep,shallow,.48+.25*ripples+.09*small);
          color=mix(color,vec3(.64,.86,.85),shore*.25 + pow(ripples,12.0)*.13);
          gl_FragColor=vec4(color,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
  }

  private addRiver(): void {
    const lengthSegments = 240;
    const widthSegments = 12;
    const vertices: number[] = [];
    const tex: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= lengthSegments; i++) {
      const z = -62 + i * (121 / lengthSegments);
      const center = this.riverCenter(z);
      const width = this.riverWidth(z);
      const height = this.riverSurface(z) + 0.045;
      for (let j = 0; j <= widthSegments; j++) {
        const across = j / widthSegments;
        vertices.push(center + (across * 2 - 1) * width, height, z);
        tex.push(across, i / lengthSegments);
        if (i < lengthSegments && j < widthSegments) {
          const a = i*(widthSegments+1)+j, b=a+widthSegments+1;
          indices.push(a,b,a+1, a+1,b,b+1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const water = new THREE.Mesh(geometry,this.waterShader);
    water.name='River — continuous flowing surface';
    water.frustumCulled = true;
    water.renderOrder = 1;
    this.group.add(water);
    // Foamy banks follow the same spline and are intentionally subtle.
    const foamMaterial = new THREE.MeshBasicMaterial({color:0xb4d8d4,transparent:true,opacity:.35,depthWrite:false});
    for(const side of [-1,1]) {
      const points: THREE.Vector3[]=[];
      for(let i=2;i<lengthSegments-1;i++) {
        const z=-62+i*(121/lengthSegments);
        const width=this.riverWidth(z);
        points.push(new THREE.Vector3(this.riverCenter(z)+side*width*.94,this.riverSurface(z)+.055,z));
      }
      const foam=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),lengthSegments,.035,3,false),foamMaterial);
      foam.name='River — soft bank foam';
      this.group.add(foam);
    }
  }

  private addTerrain():void {
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:0});
    const grass=new THREE.Color('#598b48'),light=new THREE.Color('#83aa5d'),sand=new THREE.Color('#d6ab72'),snow=new THREE.Color('#dfebee');
    // Chunks share exactly the same global vertex grid as collision. Frustum culling skips unseen terrain.
    for(let cx=0;cx<4;cx++)for(let cz=0;cz<4;cz++){
      const geo=new THREE.PlaneGeometry(TERRAIN_WIDTH/4,TERRAIN_WIDTH/4,TERRAIN_SEGMENTS/4,TERRAIN_SEGMENTS/4);geo.rotateX(-Math.PI/2);
      geo.translate(-TERRAIN_WIDTH/2+(cx+.5)*TERRAIN_WIDTH/4,0,-TERRAIN_WIDTH/2+(cz+.5)*TERRAIN_WIDTH/4);
      const position=geo.attributes.position,colors=new Float32Array(position.count*3),color=new THREE.Color();
      for(let i=0;i<position.count;i++){
        const x=position.getX(i),z=position.getZ(i),h=this.rawHeight(x,z),weights=biomeWeights(x,z);position.setY(i,h);
        color.copy(grass).lerp(light,(Math.sin(x*.22)*Math.sin(z*.19)*.5+.5)*.68+.08).lerp(sand,weights.desert).lerp(snow,weights.snow);
        if(waterFootprint(x,z))color.set('#73958b');color.toArray(colors,i*3);
      }
      geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();geo.computeBoundingSphere();
      const mesh=new THREE.Mesh(geo,material);mesh.name=`Terrain_${cx}_${cz}`;mesh.receiveShadow=true;this.group.add(mesh);
    }
  }

  private addMountains(): void {
    const rnd = randomGenerator(3228);
    const rockMats = [0x819c80, 0x869d8d, 0x738e7d, 0x9b9b88].map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }));
    for (let i = 0; i < 38; i++) {
      const theta = (i / 38) * Math.PI * 2;
      const dist = 238 + rnd() * 35;
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
    for (let i = 0; i < 260; i++) {
      const x = (rnd() - 0.5) * 320;
      const z = (rnd() - 0.5) * 320;
      const fromCenter = Math.hypot(x, z - 3);
      if (fromCenter < 22 || biomeAt(x,z)!=='plains' || waterFootprint(x,z)) continue;
      if (rnd() < 0.22 && fromCenter < 44) continue;
      const s = 0.72 + rnd() * 0.73;
      placements.push({ x, z, s, variant: i % 4 });
      this.obstacles.push({ x, z, radius: 0.75 * s, active: true, height: 7*s });
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
      const parts: Part[] = [{ mesh: trunkInstances, index: i, transform: dummy.matrix.clone() }];
      const c = p.variant % 3;
      for (let j = 0; j < 2; j++) {
        dummy.position.set(p.x + (j ? 1.1 : -0.7) * p.s, ground + (5.6 + j * 1.25) * p.s, p.z + (j ? 0.3 : -0.7) * p.s);
        dummy.scale.setScalar(p.s * (j ? 0.76 : 1));
        dummy.rotation.set(0.1, rnd() * 5, 0);
        dummy.updateMatrix();
        const slot = counts[c]++;
        canopies[c].setMatrixAt(slot, dummy.matrix);
        parts.push({ mesh: canopies[c], index: slot, transform: dummy.matrix.clone() });
      }
      this.breakables.push({ id: this.nextBreakableId++, center: new THREE.Vector3(p.x, ground + 4.1 * p.s, p.z), radius: 3.25 * p.s, health: 65, maxHealth: 65, respawn: 0, parts, obstacle: this.obstacles[this.obstacles.length - placements.length + i] });
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
    const count = 120;
    const rocks = new THREE.InstancedMesh(geo, mat, count);
    const obj = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      let x = (rnd() - 0.5) * 320;
      let z = (rnd() - 0.5) * 320;
      if (Math.hypot(x, z - 2) < 24) { x += x > 0 ? 24 : -24; z += 15; }
      if(waterFootprint(x,z)){x=-Math.abs(x)-25;}
      for(let attempt=0;attempt<100&&(waterFootprint(x,z)||LANDMARKS.some(p=>Math.hypot(x-p.x,z-p.z)<18));attempt++) {x=(rnd()-.5)*320;z=(rnd()-.5)*320;}
      const radius = 0.7 + rnd() * 2.5;
      obj.position.set(x, this.height(x, z) + radius * 0.37, z);
      obj.rotation.set(rnd() * 2, rnd() * 6, rnd() * 2);
      obj.scale.set(radius * 1.2, radius * (0.5 + rnd() * 0.7), radius * 0.9);
      obj.updateMatrix();
      rocks.setMatrixAt(i, obj.matrix);
      const obstacle = radius > 1.6 ? { x, z, radius: radius * 0.75, active: true, height: radius*1.5 } : undefined;
      if (obstacle) this.obstacles.push(obstacle);
      this.breakables.push({ id: this.nextBreakableId++, center: obj.position.clone(), radius: radius * 1.1, health: 85, maxHealth: 85, respawn: 0, parts: [{ mesh: rocks, index: i, transform: obj.matrix.clone() }], obstacle });
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
      if(waterFootprint(x,z)||biomeAt(x,z)!=='plains')continue;
      if (Math.abs(h) > 16 || Math.hypot(x, z - 5) < 5) continue;
      obj.position.set(x, h + 0.2, z);
      obj.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.22);
      obj.scale.set(0.6 + rnd() * 1.1, 0.5 + rnd() * 0.7, 0.6 + rnd() * 1.1);
      obj.updateMatrix();
      const slot = i % 3;
      grass[slot].setMatrixAt(counts[slot]++, obj.matrix);
    }
    grass.forEach((mesh, i) => { mesh.count = counts[i]; mesh.receiveShadow = true; this.group.add(mesh); this.detailObjects.push(mesh); });
    const bloomGeo = new THREE.IcosahedronGeometry(0.15, 0);
    const bloom = new THREE.InstancedMesh(bloomGeo, new THREE.MeshStandardMaterial({ color: 0xffe7a7, emissive: 0xffa64a, emissiveIntensity: 0.35 }), 280);
    for (let i = 0; i < 280; i++) {
      const x = (rnd() - 0.5) * 180;
      const z = (rnd() - 0.5) * 180;
      obj.position.set(x, this.height(x, z) + 0.35, z);
      if(waterFootprint(x,z)||biomeAt(x,z)!=='plains') {obj.scale.setScalar(0);obj.updateMatrix();bloom.setMatrixAt(i,obj.matrix);continue;}
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
      this.breakables.push({ id: this.nextBreakableId++, center: pillar.position.clone(), radius: 1.6, health: 75, maxHealth: 75, respawn: 0, parts: [], standalone: pillar });
    }
  }

  private raySphere(origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, radius: number): number | null {
    const delta = center.clone().sub(origin);
    const projection = delta.dot(dir);
    const discriminant = radius * radius - (delta.lengthSq() - projection * projection);
    if (discriminant < 0) return null;
    const near = projection - Math.sqrt(discriminant);
    const far = projection + Math.sqrt(discriminant);
    return near >= 0 ? near : far >= 0 ? far : null;
  }

  trace(origin: THREE.Vector3, direction: THREE.Vector3, distance: number, dummy?: DummyTarget): WorldHit {
    const dir = direction.clone().normalize();
    let nearest = distance;
    let result: WorldHit = { point: origin.clone().addScaledVector(dir, distance), distance };
    for (const entry of this.breakables) {
      if (entry.health <= 0) continue;
      const t = this.raySphere(origin, dir, entry.center, entry.radius);
      if (t !== null && t < nearest) {
        nearest = t;
        result = { point: origin.clone().addScaledVector(dir, t), distance: t, objectId: entry.id };
      }
    }
    if (dummy && dummy.health > 0) {
      const t = this.raySphere(origin, dir, dummy.hitCenter, 1.3);
      if (t !== null && t < nearest) {
        nearest = t;
        result = { point: origin.clone().addScaledVector(dir, t), distance: t, dummy: true };
      }
    }
    {
      let previous = 0;
      for (let t = 1.8; t <= nearest; t += 1.8) {
        const x = origin.x + dir.x * t;
        const z = origin.z + dir.z * t;
        if (origin.y + dir.y * t <= this.height(x, z)) {
          let low = previous;
          let high = t;
          for (let j = 0; j < 7; j++) {
            const mid = (low + high) / 2;
            const mx = origin.x + dir.x * mid;
            const mz = origin.z + dir.z * mid;
            if (origin.y + dir.y * mid <= this.height(mx, mz)) high = mid;
            else low = mid;
          }
          if (high < nearest) result = { point: origin.clone().addScaledVector(dir, high), distance: high };
          break;
        }
        previous = t;
      }
    }
    return result;
  }

  damage(id: number, amount: number): { actual: number; dead: boolean } {
    const entry = this.breakables.find((item) => item.id === id);
    if (!entry || entry.health <= 0) return { actual: 0, dead: false };
    const actual = Math.min(entry.health, Math.max(0, amount));
    entry.health -= actual;
    if (entry.health > 0) return { actual, dead: false };
    entry.respawn = this.respawnSeconds;
    if (entry.standalone) entry.standalone.visible = false;
    if (entry.obstacle) entry.obstacle.active = false;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const part of entry.parts) { part.mesh.setMatrixAt(part.index, hidden); part.mesh.instanceMatrix.needsUpdate = true; part.mesh.computeBoundingSphere(); }
    return { actual, dead: true };
  }

  get breakableCount(): number { return this.breakables.length; }


  splash(x:number,z:number):void {
    if(!waterFootprint(x,z)||this.ripples.length>18)return;
    const mesh=new THREE.Mesh(new THREE.RingGeometry(.25,.29,28),new THREE.MeshBasicMaterial({color:0xb9f3f2,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,this.waterLevel(x,z)+.065,z);this.group.add(mesh);this.ripples.push({mesh,age:0});
  }
  private addBiomes():void {
    const random=randomGenerator(7311);
    const pineMaterial=new THREE.MeshStandardMaterial({color:0x315e57,roughness:1});
    const snowMaterial=new THREE.MeshStandardMaterial({color:0xe4f2f7,roughness:.9});
    const cactusMaterial=new THREE.MeshStandardMaterial({color:0x68855a,roughness:1});
    const pineGeo=new THREE.ConeGeometry(2.6,6,7),snowGeo=new THREE.ConeGeometry(2.35,5.6,7),cactusGeo=new THREE.CapsuleGeometry(.38,3.2,4,7);
    const pines=new THREE.InstancedMesh(pineGeo,pineMaterial,65),caps=new THREE.InstancedMesh(snowGeo,snowMaterial,65),cacti=new THREE.InstancedMesh(cactusGeo,cactusMaterial,65);
    let pi=0,ci=0;const obj=new THREE.Object3D();
    for(let i=0;i<350;i++){
      const x=(random()-.5)*310,z=(random()-.5)*310;
      if(LANDMARKS.some(p=>Math.hypot(x-p.x,z-p.z)<17)||waterFootprint(x,z))continue;
      const biome=biomeAt(x,z),scale=.7+random()*.7,y=this.height(x,z);
      obj.rotation.set(0,random()*6.28,0);obj.scale.setScalar(scale);
      if(biome==='snow'&&pi<65){obj.position.set(x,y+3*scale,z);obj.updateMatrix();pines.setMatrixAt(pi,obj.matrix);obj.position.y+=.45*scale;obj.updateMatrix();caps.setMatrixAt(pi++,obj.matrix);this.obstacles.push({x,z,radius:.7*scale,height:6*scale});}
      if(biome==='desert'&&ci<65){obj.position.set(x,y+1.9*scale,z);obj.updateMatrix();cacti.setMatrixAt(ci++,obj.matrix);this.obstacles.push({x,z,radius:.5*scale,height:4*scale});}
    }
    pines.count=caps.count=pi;cacti.count=ci;
    for(const mesh of [pines,caps,cacti]){mesh.castShadow=true;this.group.add(mesh);}
    for(const p of LANDMARKS){
      if(p.id==='lake'||p.id==='training')continue;
      const y=this.height(p.x,p.z);
      const stone=new THREE.MeshStandardMaterial({color:p.id==='snow'?0x7796aa:0xb58b64,roughness:.8});
      const ring=new THREE.Mesh(new THREE.TorusGeometry(4.3,.16,8,48),stone);ring.rotation.x=-Math.PI/2;ring.position.set(p.x,y+.15,p.z);this.group.add(ring);
      for(let i=0;i<5;i++) {const angle=i*Math.PI*2/5;const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.55,.8,4+i%2,6),stone);pillar.position.set(p.x+Math.cos(angle)*7,y+2,p.z+Math.sin(angle)*7);pillar.castShadow=true;this.group.add(pillar);this.obstacles.push({x:pillar.position.x,z:pillar.position.z,radius:.8,height:5});}
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.12,.5,20,12,1,true),new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide}));beam.position.set(p.x,y+10,p.z);this.group.add(beam);
      const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.8),new THREE.MeshStandardMaterial({color:p.color,emissive:p.color,emissiveIntensity:.5}));crystal.position.set(p.x,y+5.5,p.z);this.group.add(crystal);
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
