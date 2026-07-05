import * as THREE from 'three';

// ============================================================================
//  Mundo: la Isla del Tesoro.
//  Genera terreno, mar, cielo, naufragio, cueva (Pista 1), volcán y vegetación.
//  Expone helpers de altura de terreno, colisionadores, trampas e interactuables.
// ============================================================================

export const WATER_LEVEL = 0;
export const DROWN_LEVEL = -1.6; // por debajo de esto el jugador se ahoga

// Puntos clave de la isla (x, z en el plano; la altura se calcula del terreno)
export const SPAWN = new THREE.Vector3(14, 0, 60); // en el naufragio
export const CAVE = new THREE.Vector3(-34, 0, -14);
export const VOLCANO = new THREE.Vector3(48, 0, -46);

// --- Altura del terreno: isla como montículo radial con colinas suaves --------
export function terrainHeightAt(x, z) {
  const r = Math.hypot(x, z);
  const R = 96;
  const t = Math.min(r / R, 1);
  const base = Math.cos(t * Math.PI * 0.5); // 1 en el centro -> 0 en el borde
  let h = base * 14 - 4; // centro ~10, borde ~-4 (bajo el agua)
  h += Math.sin(x * 0.06) * Math.cos(z * 0.05) * 3;
  h += Math.sin(x * 0.13 + 2.1) * Math.sin(z * 0.11) * 1.2;
  return h;
}

function heightColor(h, color) {
  // Colorea el terreno por altura: agua-arena-pasto-roca
  if (h < 0.4) color.setHex(0xe6d3a0); // arena mojada / playa
  else if (h < 2.2) color.setHex(0xe8dcab); // arena seca
  else if (h < 8) color.setHex(0x6da34d); // pasto
  else color.setHex(0x8a8071); // roca de las colinas
  return color;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // { x, z, r }
    this.traps = []; // { x, z, r }
    this.interactables = []; // { id, position, radius, prompt, handler }
    this._animated = []; // objetos con update(t)
    this._time = 0;

    this._buildSky();
    this._buildLights();
    this._buildTerrain();
    this._buildWater();
    this._buildShipwreck();
    this._buildCave();
    this._buildVolcano();
    this._scatterVegetation();
    this._buildCaveBeacon();
  }

  // --------------------------------------------------------------- cielo / luz
  _buildSky() {
    this.scene.background = new THREE.Color(0x9fd3e8);
    this.scene.fog = new THREE.Fog(0xbfe0ee, 90, 330);

    // Gran cúpula de cielo con degradé
    const geo = new THREE.SphereGeometry(400, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(0x2f7fb5) },
        bottom: { value: new THREE.Color(0xd8f0f7) },
      },
      vertexShader: `
        varying vec3 vP;
        void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        varying vec3 vP; uniform vec3 top; uniform vec3 bottom;
        void main(){
          float h = clamp((normalize(vP).y + 0.15) / 1.0, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottom, top, h), 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  _buildLights() {
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.35);
    sun.position.set(60, 90, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = 140;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.far = 400;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfe0ee, 0x5a6a3a, 0.7));
  }

  // ------------------------------------------------------------------ terreno
  _buildTerrain() {
    const size = 320;
    const seg = 220;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeightAt(x, z);
      pos.setY(i, h);
      heightColor(h, c);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // -------------------------------------------------------------------- agua
  _buildWater() {
    const geo = new THREE.PlaneGeometry(1200, 1200, 80, 80);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1c6f97,
      transparent: true,
      opacity: 0.82,
      roughness: 0.25,
      metalness: 0.15,
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = WATER_LEVEL;
    this.scene.add(water);
    this._water = geo;
    this._waterBase = geo.attributes.position.array.slice();
    this._animated.push((t) => {
      const p = geo.attributes.position;
      const base = this._waterBase;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        p.setY(i, Math.sin(x * 0.08 + t * 1.3) * 0.25 + Math.cos(z * 0.06 + t) * 0.25);
      }
      p.needsUpdate = true;
    });
  }

  // ---------------------------------------------------------------- naufragio
  _buildShipwreck() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4e3620, roughness: 0.9 });

    // Casco (media cápsula inclinada, encallado)
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(3.2, 12, 6, 12), wood);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = 0.5;
    hull.scale.set(1, 1, 0.6);
    hull.position.y = 1.4;
    g.add(hull);

    // Cubierta
    const deck = new THREE.Mesh(new THREE.BoxGeometry(15, 0.6, 5), woodDark);
    deck.position.y = 2.4;
    deck.rotation.y = 0.5;
    g.add(deck);

    // Mástil roto e inclinado
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 12, 8), woodDark);
    mast.position.set(1, 6.5, 0);
    mast.rotation.z = 0.45;
    g.add(mast);

    // Vela hecha jirones
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 5),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 1, side: THREE.DoubleSide })
    );
    sail.position.set(-1.4, 8, 0.1);
    sail.rotation.z = 0.45;
    g.add(sail);

    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });

    // Encallado en la orilla, detrás del punto de aparición y medio hundido
    const wz = SPAWN.z + 8;
    const y = terrainHeightAt(SPAWN.x, wz);
    g.position.set(SPAWN.x, y - 0.5, wz);
    g.rotation.y = -0.6;
    this.scene.add(g);
    this.colliders.push({ x: SPAWN.x, z: wz, r: 5.5 });
  }

  // ------------------------------------------------------------------- cueva
  _buildCave() {
    const cx = CAVE.x;
    const cz = CAVE.z;
    const ground = terrainHeightAt(cx, cz);
    const rock = new THREE.MeshStandardMaterial({ color: 0x7c7264, roughness: 1 });
    const darkRock = new THREE.MeshStandardMaterial({ color: 0x4b453c, roughness: 1 });

    // Anillo de rocas en "C" formando el recinto, con una abertura hacia +Z (entrada)
    const ringR = 8;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      // deja un hueco de entrada mirando al +Z (ángulo cercano a PI/2)
      if (a > Math.PI * 0.30 && a < Math.PI * 0.70) continue;
      const bx = cx + Math.cos(a) * ringR;
      const bz = cz + Math.sin(a) * ringR;
      const s = 2.6 + Math.sin(a * 3) * 0.6;
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock);
      const by = terrainHeightAt(bx, bz);
      boulder.position.set(bx, by + s * 0.4, bz);
      boulder.rotation.set(a, a * 1.7, a * 0.3);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.scene.add(boulder);
      this.colliders.push({ x: bx, z: bz, r: s * 0.9 });
    }

    // Techo de roca sobre la cueva (media esfera oscura) para que se sienta interior
    const roof = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), darkRock);
    roof.position.set(cx, ground + 7, cz);
    roof.castShadow = true;
    this.scene.add(roof);

    // Losa/pared del fondo con la inscripción
    const slab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4, 0.6), darkRock);
    slab.position.set(cx - 5.2, ground + 2, cz - 4);
    slab.rotation.y = 0.6;
    slab.castShadow = true;
    this.scene.add(slab);
    this._inscriptionMark = this._glowMark(cx - 4.6, ground + 3.4, cz - 3.4, 0xffd27a);

    // Antorcha (luz + llama) para iluminar el interior
    const torchPos = new THREE.Vector3(cx + 3, ground + 3, cz - 3);
    const torchLight = new THREE.PointLight(0xffa64d, 3.2, 26, 2);
    torchLight.position.copy(torchPos);
    this.scene.add(torchLight);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 1.1, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb347 })
    );
    flame.position.copy(torchPos);
    this.scene.add(flame);
    this._animated.push((t) => {
      const f = 0.75 + Math.sin(t * 18) * 0.15 + Math.sin(t * 7) * 0.1;
      torchLight.intensity = 3.2 * f;
      flame.scale.y = 0.85 + f * 0.3;
    });

    // Cofre (interactuable con el acertijo)
    this.chest = this._buildChest(cx, ground, cz + 2.5);

    // Trampa: un pozo oscuro cerca de la entrada de la cueva
    this._buildPit(cx + 6, cz + 8);

    // Interactuables
    this.interactables.push({
      id: 'inscripcion',
      position: new THREE.Vector3(cx - 5.2, ground + 2, cz - 4),
      radius: 4.5,
      prompt: 'Presioná [E] para leer la inscripción',
      handler: null, // asignado por el juego
    });
    this.interactables.push({
      id: 'cofre',
      position: this.chest.position.clone(),
      radius: 4,
      prompt: 'Presioná [E] para abrir el cofre',
      handler: null,
    });

    // Colisionador del cofre (para no atravesarlo)
    this.colliders.push({ x: cx, z: cz + 2.5, r: 1.6 });
  }

  _buildChest(x, ground, z) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.8 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf4c95d, metalness: 0.6, roughness: 0.3 });

    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.6), wood);
    box.position.y = 0.7;
    g.add(box);

    const lid = new THREE.Group();
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.6), wood);
    lidMesh.position.set(0, 0.35, 0);
    lid.add(lidMesh);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.25, 0.2), gold);
    band.position.set(0, 0.35, 0);
    lid.add(band);
    lid.position.set(0, 1.4, -0.8); // bisagra atrás
    g.add(lid);
    this._chestLid = lid;

    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), gold);
    lock.position.set(0, 0.8, 0.85);
    g.add(lock);

    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    g.position.set(x, ground, z);
    this.scene.add(g);
    return g;
  }

  openChest() {
    // Anima la apertura de la tapa
    const lid = this._chestLid;
    const start = performance.now();
    const glow = this._glowMark(this.chest.position.x, this.chest.position.y + 1.2, this.chest.position.z, 0xfff1a8);
    const tick = () => {
      const k = Math.min((performance.now() - start) / 700, 1);
      lid.rotation.x = -k * (Math.PI * 0.6);
      glow.scale.setScalar(1 + k * 2.5);
      glow.material.opacity = 0.9 * (1 - k * 0.3);
      if (k < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  _buildPit(x, z) {
    const y = terrainHeightAt(x, z);
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0a })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.05, z);
    this.scene.add(ring);
    // Borde de piedras agrietadas
    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.35, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x5b5348, roughness: 1 })
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, y + 0.1, z);
    edge.castShadow = true;
    this.scene.add(edge);
    this.traps.push({ x, z, r: 2.2 });
  }

  // ------------------------------------------------------------------ volcán
  _buildVolcano() {
    const x = VOLCANO.x;
    const z = VOLCANO.z;
    const base = terrainHeightAt(x, z);
    const height = 34;
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 20, height, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x4a3b33, roughness: 1, side: THREE.DoubleSide })
    );
    cone.position.set(x, base + height / 2, z);
    cone.castShadow = true;
    cone.receiveShadow = true;
    this.scene.add(cone);

    // Cráter con lava brillante
    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(4, 20),
      new THREE.MeshBasicMaterial({ color: 0xff5522 })
    );
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(x, base + height - 0.5, z);
    this.scene.add(crater);
    const lavaLight = new THREE.PointLight(0xff5522, 2.5, 60, 2);
    lavaLight.position.set(x, base + height + 2, z);
    this.scene.add(lavaLight);

    // Bloquea caminar a través del volcán
    this.colliders.push({ x, z, r: 18 });

    // Humo: puffs que suben y se desvanecen
    const puffs = [];
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 10; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), smokeMat.clone());
      puff.position.set(x, base + height, z);
      puff.userData.o = Math.random() * 6;
      this.scene.add(puff);
      puffs.push(puff);
    }
    const topY = base + height;
    this._animated.push((t) => {
      for (const p of puffs) {
        const life = (t * 0.5 + p.userData.o) % 6;
        const k = life / 6;
        p.position.y = topY + k * 22;
        p.position.x = x + Math.sin(p.userData.o + t * 0.3) * (2 + k * 6);
        p.scale.setScalar(1 + k * 2.5);
        p.material.opacity = 0.5 * (1 - k);
      }
    });
  }

  // ------------------------------------------------------------- vegetación
  _scatterVegetation() {
    // Distribución pseudoaleatoria pero determinista
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 90; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = 8 + rnd() * 82;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const h = terrainHeightAt(x, z);
      if (h < 1 || h > 9) continue; // solo en tierra firme sobre la playa
      // no encima de puntos clave
      if (Math.hypot(x - CAVE.x, z - CAVE.z) < 12) continue;
      if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 22) continue;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 10) continue;
      if (rnd() < 0.6) this._palm(x, h, z, rnd);
      else this._rock(x, h, z, rnd);
    }
  }

  _palm(x, y, z, rnd) {
    const g = new THREE.Group();
    const trunkH = 4 + rnd() * 2.5;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.42, trunkH, 7),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1 })
    );
    trunk.position.y = trunkH / 2;
    trunk.rotation.z = (rnd() - 0.5) * 0.3;
    g.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9b47, roughness: 1, side: THREE.DoubleSide });
    for (let k = 0; k < 6; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
      const a = (k / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, trunkH + 0.2, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.PI / 2.4;
      leaf.rotation.y = -a;
      g.add(leaf);
    }
    g.traverse((o) => { o.castShadow = true; });
    g.position.set(x, y, z);
    this.scene.add(g);
    this.colliders.push({ x, z, r: 0.8 });
  }

  _rock(x, y, z, rnd) {
    const s = 0.8 + rnd() * 1.8;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(s, 0),
      new THREE.MeshStandardMaterial({ color: 0x8a8071, roughness: 1 })
    );
    rock.position.set(x, y + s * 0.4, z);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.scene.add(rock);
    this.colliders.push({ x, z, r: s * 0.8 });
  }

  // --------------------------------------------------------- marcadores UI 3D
  _glowMark(x, y, z, color) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    m.position.set(x, y, z);
    this.scene.add(m);
    this._animated.push((t) => {
      m.position.y = y + Math.sin(t * 2) * 0.15;
    });
    return m;
  }

  // Haz de luz sobre la cueva para guiar al jugador desde lejos
  _buildCaveBeacon() {
    const y = terrainHeightAt(CAVE.x, CAVE.z);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 2, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    beam.position.set(CAVE.x, y + 20, CAVE.z);
    this.scene.add(beam);
    this._caveBeacon = beam;
    this._animated.push((t) => {
      beam.material.opacity = 0.18 + Math.sin(t * 2) * 0.08;
    });
  }

  hideCaveBeacon() {
    if (this._caveBeacon) this._caveBeacon.visible = false;
  }

  update(dt) {
    this._time += dt;
    for (const fn of this._animated) fn(this._time);
  }
}
