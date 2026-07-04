import Phaser from "phaser";
import type { AssetKind, GameState } from "../sim/types.ts";
import { prosperityOf } from "../sim/city.ts";
import type { Runtime } from "./runtime.ts";
import type { HudApi } from "../ui/hud.ts";
import { buildTextures } from "./textures.ts";
import { touchMove } from "./input.ts";
import { sfx } from "./audio.ts";

interface Shop {
  kind: AssetKind;
  name: string;
  tex: string;
  x: number;
  y: number;
}

// Mundo cenital estilo Argentum Online: caminas con un personaje por un mapa
// de tiles y tu pueblo crece con tu patrimonio (de aldea a metropoli).
// El render solo lee la simulacion; nada de logica de juego aqui.

const TILE = 16;
const COLS = 72;
const ROWS = 52;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;
const SPEED = 95;
const WALL_HALF = 9; // media anchura del pueblo amurallado, en tiles

const TIER_NAMES = ["Paraje", "Pueblo", "Villa", "Ciudad", "Metropoli", "Capital"];

export class WorldScene extends Phaser.Scene {
  private runtime!: Runtime;
  private playerId = "p1";

  private hero!: Phaser.GameObjects.Image;
  private buildings!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: "down" | "up" | "side" = "down";
  private flip = false;

  private plots: Array<{ x: number; y: number; r: number }> = [];
  private lastCount = -1;

  private hud!: HudApi;
  private shops: Shop[] = [];
  private interactKey!: Phaser.Input.Keyboard.Key;
  private nearShop: Shop | null = null;
  private staticSolids: Array<{ x: number; y: number; r: number }> = [];
  private treeSolids: Array<{ x: number; y: number; r: number }> = [];
  private waterSolids: Array<{ x: number; y: number; r: number }> = [];
  private wallSolids: Array<{ x: number; y: number; r: number }> = [];
  private solids: Array<{ x: number; y: number; r: number }> = [];
  private lastTier = "";
  private stepTimer = 0;
  private heroStart: { x: number; y: number } | null = null;
  private night!: Phaser.GameObjects.Rectangle;
  private townSignText!: Phaser.GameObjects.Text;
  private townLights!: Phaser.GameObjects.Container;
  private buildingLights!: Phaser.GameObjects.Container;
  private testHour: number | null = null;

  constructor() {
    super("world");
  }

  init(data: { runtime: Runtime; hud: HudApi; playerId?: string; heroStart?: { x: number; y: number } | null }) {
    this.runtime = data.runtime;
    this.hud = data.hud;
    if (data.playerId) this.playerId = data.playerId;
    this.heroStart = data.heroStart ?? null;
  }

  /** Posicion actual del heroe (para guardar la partida). */
  getHeroPos() {
    return this.hero ? { x: Math.round(this.hero.x), y: Math.round(this.hero.y) } : null;
  }

  create() {
    buildTextures(this);
    const hourParam = new URLSearchParams(location.search).get("hour");
    if (hourParam != null && !Number.isNaN(parseFloat(hourParam))) this.testHour = parseFloat(hourParam);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setZoom(2.6);
    this.cameras.main.roundPixels = true;

    const cx = (COLS / 2) * TILE;
    const cy = (ROWS / 2) * TILE;

    this.paintGround();
    this.paintRoads(cx, cy);
    this.paintWalls(cx, cy);
    this.scatterNature();

    this.buildings = this.add.container(0, 0);
    this.buildingLights = this.add.container(0, 0).setDepth(55000);
    this.townLights = this.add.container(0, 0).setDepth(55000);

    // Comercios: Bolsa (acciones), Banco (bonos) y Almacen (materias primas).
    this.shops = [
      { kind: "stock", name: "Bolsa", tex: "b_bolsa", x: cx - 4 * TILE, y: cy - TILE },
      { kind: "bond", name: "Banco", tex: "b_banco", x: cx + 4 * TILE, y: cy - TILE },
      { kind: "commodity", name: "Almacen", tex: "b_almacen", x: cx, y: cy - 4 * TILE },
    ];

    // Fuente central del pueblo.
    this.add.image(cx, cy, "well").setDepth(cy);

    // Cartel del pueblo (con su nombre segun el nivel), a la entrada sur.
    this.add.image(cx - 8, cy + 5 * TILE, "sign").setOrigin(0.5, 1).setDepth(cy + 5 * TILE);
    this.townSignText = this.add
      .text(cx, cy + 5 * TILE - 22, "Paraje", {
        fontFamily: "system-ui",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffe9a6",
      })
      .setOrigin(0.5, 1)
      .setDepth(9999)
      .setResolution(3);
    this.townSignText.setScale(1 / this.cameras.main.zoom);

    this.computePlots(cx, cy);

    // Dibuja los comercios con su cartel flotante y su vendedor (NPC).
    const shopIcon: Record<string, string> = { stock: "📈", bond: "🏦", commodity: "🏬" };
    const shopNpc: Record<string, string> = { stock: "npc_merchant", bond: "npc_banker", commodity: "npc_grocer" };
    for (const shop of this.shops) {
      this.add.image(shop.x, shop.y, shop.tex).setOrigin(0.5, 1).setDepth(shop.y);
      const label = this.add
        .text(shop.x, shop.y - 30, `${shopIcon[shop.kind]} ${shop.name}`, {
          fontFamily: "system-ui",
          fontSize: "20px",
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5, 1)
        .setDepth(9999)
        .setResolution(3);
      label.setScale(1 / this.cameras.main.zoom);
      // Vendedor parado frente al comercio.
      const npc = this.add.image(shop.x, shop.y + 8, shopNpc[shop.kind]).setOrigin(0.5, 1).setDepth(shop.y + 8);
      this.tweens.add({ targets: npc, y: npc.y - 1.5, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      // Farol del comercio (se prende de noche).
      this.addLight(this.townLights, shop.x, shop.y - 12, 1.6);
    }

    // Luces fijas: la fuente y faroles en los cuatro portones de la muralla.
    this.addLight(this.townLights, cx, cy - 6, 1.4);
    for (const [dc, dr] of [[0, -WALL_HALF], [0, WALL_HALF], [-WALL_HALF, 0], [WALL_HALF, 0]] as const) {
      this.addLight(this.townLights, cx + dc * TILE, cy + dr * TILE, 1.3);
    }

    // Solidos fijos (colisiones): comercios, fuente, arboles, muralla y agua.
    this.staticSolids = [
      ...this.shops.map((s) => ({ x: s.x, y: s.y - 8, r: 13 })),
      { x: cx, y: cy - 4, r: 8 },
      ...this.treeSolids,
      ...this.wallSolids,
      ...this.waterSolids,
    ];

    // Heroe (en la posicion guardada, o en la plaza).
    const hx = this.heroStart?.x ?? cx;
    const hy = this.heroStart?.y ?? cy + 44;
    this.hero = this.add.image(hx, hy, "hero_down").setDepth(hy);
    this.cameras.main.startFollow(this.hero, true, 0.15, 0.15);

    // Capa de dia/noche: rectangulo azul que se aclara/oscurece con el tiempo.
    this.night = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0a1230)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(50000)
      .setAlpha(0);
    this.scale.on("resize", () => this.night.setSize(this.scale.width, this.scale.height));

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.runtime.subscribe((s) => this.syncTown(s));
  }

  // Suelo: cesped en mosaico con variaciones y una plaza de tierra en el centro.
  private paintGround() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = ["grass0", "grass1", "grass2"][(c * 7 + r * 13) % 3];
        this.add.image(c * TILE, r * TILE, key).setOrigin(0, 0).setDepth(-1000);
      }
    }
    // Plaza de tierra alrededor del centro.
    const midC = Math.floor(COLS / 2);
    const midR = Math.floor(ROWS / 2);
    for (let r = midR - 5; r <= midR + 5; r++) {
      for (let c = midC - 6; c <= midC + 6; c++) {
        if (Math.hypot(c - midC, r - midR) < 6.5) {
          this.add.image(c * TILE, r * TILE, "path").setOrigin(0, 0).setDepth(-999);
        }
      }
    }
    // Un estanque (agua) que no se puede atravesar.
    this.waterSolids = [];
    for (let r = 5; r < 12; r++) {
      for (let c = 6; c < 14; c++) {
        if (Math.hypot(c - 10, r - 8) < 4) {
          this.add.image(c * TILE, r * TILE, "water").setOrigin(0, 0).setDepth(-998);
          this.waterSolids.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, r: 9 });
        }
      }
    }
  }

  // Muralla de piedra alrededor del pueblo, con portones donde pasan los caminos.
  private paintWalls(cx: number, cy: number) {
    const midC = Math.round(cx / TILE);
    const midR = Math.round(cy / TILE);
    this.wallSolids = [];
    const place = (c: number, r: number) => {
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE / 2;
      this.add.image(c * TILE, r * TILE, "wall").setOrigin(0, 0).setDepth(y);
      this.wallSolids.push({ x, y, r: 8 });
    };
    for (let c = midC - WALL_HALF; c <= midC + WALL_HALF; c++) {
      const gate = Math.abs(c - midC) <= 1; // porton norte/sur (por el camino)
      if (!gate) {
        place(c, midR - WALL_HALF);
        place(c, midR + WALL_HALF);
      }
    }
    for (let r = midR - WALL_HALF + 1; r <= midR + WALL_HALF - 1; r++) {
      const gate = Math.abs(r - midR) <= 1; // porton este/oeste
      if (!gate) {
        place(midC - WALL_HALF, r);
        place(midC + WALL_HALF, r);
      }
    }
  }

  // Caminos de tierra: una cruz que atraviesa el pueblo y sale al campo.
  private paintRoads(cx: number, cy: number) {
    const midC = Math.round(cx / TILE);
    const midR = Math.round(cy / TILE);
    for (let c = 2; c < COLS - 2; c++) {
      for (let d = -1; d <= 1; d++) {
        this.add.image(c * TILE, (midR + d) * TILE, "path").setOrigin(0, 0).setDepth(-997);
      }
    }
    for (let r = 2; r < ROWS - 2; r++) {
      for (let d = -1; d <= 1; d++) {
        this.add.image((midC + d) * TILE, r * TILE, "path").setOrigin(0, 0).setDepth(-997);
      }
    }
  }

  // Arboles decorativos por los bordes y claros del mapa (patron determinista).
  // Cada arbol es un solido: su tronco bloquea el paso.
  private scatterNature() {
    let s = 12345;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const midC = COLS / 2;
    const midR = ROWS / 2;
    this.treeSolids = [];
    for (let i = 0; i < 140; i++) {
      const c = Math.floor(rnd() * COLS);
      const r = Math.floor(rnd() * ROWS);
      if (Math.hypot(c - midC, r - midR) < 12) continue; // deja libre el pueblo
      if (c > 5 && c < 15 && r > 4 && r < 13) continue; // deja libre el estanque
      if (Math.abs(c - midC) <= 1 || Math.abs(r - midR) <= 1) continue; // deja libres los caminos
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE;
      this.add.image(x, y, "tree").setOrigin(0.5, 1).setDepth(y);
      // Colision solo en el tronco (parte baja del arbol).
      this.treeSolids.push({ x, y: y - 4, r: 5 });
    }
  }

  // Parcelas del pueblo: grilla DENTRO de la muralla, a los lados de los
  // caminos. Se ordenan de adentro hacia afuera (el pueblo crece desde el centro).
  private computePlots(cx: number, cy: number) {
    const plots: Array<{ x: number; y: number; r: number }> = [];
    for (let dr = -(WALL_HALF - 2); dr <= WALL_HALF - 2; dr += 2) {
      for (let dc = -(WALL_HALF - 2); dc <= WALL_HALF - 2; dc += 2) {
        if (Math.abs(dc) <= 1 || Math.abs(dr) <= 1) continue; // deja libres los caminos
        const x = cx + dc * TILE;
        const y = cy + dr * TILE;
        if (Math.hypot(x - cx, y - cy) < 2.5 * TILE) continue; // fuente/plaza
        if (this.shops.some((s) => Math.hypot(x - s.x, y - s.y) < 2 * TILE)) continue;
        plots.push({ x, y, r: Math.max(Math.abs(dc), Math.abs(dr)) });
      }
    }
    plots.sort((a, b) => a.r - b.r);
    this.plots = plots;
  }

  // Reconstruye el pueblo cuando cambia el numero de edificios (patrimonio).
  private syncTown(state: GameState) {
    const p = prosperityOf(state, this.playerId);
    const count = Math.min(this.plots.length, Math.round(3 + p * 30));
    if (count === this.lastCount) return;

    const grew = count > this.lastCount && this.lastCount >= 0;
    const from = Math.max(0, this.lastCount);
    this.buildings.removeAll(true);

    const buildingSolids: Array<{ x: number; y: number; r: number }> = [];
    this.buildingLights.removeAll(true);
    for (let i = 0; i < count; i++) {
      const plot = this.plots[i];
      const key = buildingKey(p, i);
      const img = this.add.image(plot.x, plot.y, key).setOrigin(0.5, 1).setDepth(plot.y);
      this.buildings.add(img);
      buildingSolids.push({ x: plot.x, y: plot.y - 6, r: 9 });
      // Ventana iluminada de cada casa (se prende de noche).
      this.addLight(this.buildingLights, plot.x, plot.y - 10, 1);
      // Animacion de "construccion" para los que aparecen nuevos.
      if (grew && i >= from) {
        img.setScale(0.2).setAlpha(0.4);
        this.tweens.add({ targets: img, scale: 1, alpha: 1, duration: 260, ease: "Back.easeOut" });
      }
    }
    this.solids = [...this.staticSolids, ...buildingSolids];
    this.lastCount = count;

    // Subida de nivel de la ciudad: destello de camara (el aviso + sonido los
    // maneja el HUD, que ve cada cambio de estado).
    const tier = tierName(p);
    if (this.townSignText) this.townSignText.setText(tier);
    if (this.lastTier && tier !== this.lastTier) {
      this.cameras.main.flash(350, 120, 170, 255);
    }
    this.lastTier = tier;
  }

  // Agrega una lucecita (brillo aditivo calido) a un contenedor de luces.
  private addLight(container: Phaser.GameObjects.Container, x: number, y: number, scale = 1.5) {
    const img = this.add
      .image(x, y, "glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffd98a)
      .setScale(scale);
    container.add(img);
  }

  // Cuanto solapa la posicion (x,y) con los edificios/comercios (0 = libre).
  // El radio del heroe es ~4.
  private penetration(x: number, y: number): number {
    let total = 0;
    for (const s of this.solids) {
      const overlap = s.r + 4 - Math.hypot(x - s.x, y - s.y);
      if (overlap > 0) total += overlap;
    }
    return total;
  }

  update(_t: number, delta: number) {
    if (!this.hero) return;
    const dt = delta / 1000;
    let vx = 0;
    let vy = 0;
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    // Suma el joystick tactil (movil).
    vx += touchMove.x;
    vy += touchMove.y;

    if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001) {
      const len = Math.hypot(vx, vy);
      const stepX = (vx / len) * SPEED * dt;
      const stepY = (vy / len) * SPEED * dt;
      const fromX = this.hero.x;
      const fromY = this.hero.y;
      // Colision por eje basada en penetracion: se permite el movimiento
      // mientras no aumente el solape con los edificios (asi bloquea la entrada
      // pero siempre deja salir si un edificio apareciera encima).
      const tryX = Phaser.Math.Clamp(this.hero.x + stepX, TILE, WORLD_W - TILE);
      if (this.penetration(tryX, this.hero.y) <= this.penetration(this.hero.x, this.hero.y)) this.hero.x = tryX;
      const tryY = Phaser.Math.Clamp(this.hero.y + stepY, TILE, WORLD_H - TILE);
      if (this.penetration(this.hero.x, tryY) <= this.penetration(this.hero.x, this.hero.y)) this.hero.y = tryY;
      this.hero.setDepth(this.hero.y);

      // Orientacion: el eje dominante manda.
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = "side";
        this.flip = vx < 0;
      } else {
        this.facing = vy < 0 ? "up" : "down";
      }
      const key = this.facing === "side" ? "hero_side" : this.facing === "up" ? "hero_up" : "hero_down";
      this.hero.setTexture(key);
      this.hero.setFlipX(this.facing === "side" && this.flip);
      // Bamboleo al andar.
      this.hero.y += Math.sin(_t / 90) * 0.15;

      // Pasitos (tiki-tiki): solo si de verdad se desplazo (no contra una pared).
      const moved = Math.hypot(this.hero.x - fromX, this.hero.y - fromY);
      if (moved > 0.2) {
        this.stepTimer += delta;
        if (this.stepTimer >= 260) {
          this.stepTimer = 0;
          sfx.step();
        }
      } else {
        this.stepTimer = 260; // proximo movimiento suena enseguida
      }
    } else {
      this.stepTimer = 260;
    }

    // Comercio mas cercano dentro de rango.
    let near: Shop | null = null;
    let best = 34;
    for (const s of this.shops) {
      const d = Math.hypot(this.hero.x - s.x, this.hero.y - s.y + 8);
      if (d < best) {
        best = d;
        near = s;
      }
    }
    if (near !== this.nearShop) {
      this.nearShop = near;
      this.hud.setNearShop(near ? { kind: near.kind, name: near.name } : null);
    }
    // Entrar al comercio con E (o con el boton tactil, que llama a hud.openShop).
    if (this.nearShop && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.hud.openShop(this.nearShop.kind);
    }

    // Dia/noche segun la hora REAL de Argentina (ciclo de 24 h).
    const nightness = this.nightnessNow();
    this.night.setAlpha(nightness * 0.55);
    // Las lucecitas se prenden a medida que baja la luz.
    const lightOn = Math.max(0, (nightness - 0.2) / 0.8);
    this.townLights.setAlpha(lightOn);
    this.buildingLights.setAlpha(lightOn);
  }

  // Oscuridad [0..1] segun la hora de Argentina (UTC-3): 0 = mediodia,
  // 1 = madrugada. Se puede forzar con ?hour=NN para pruebas.
  private nightnessNow(): number {
    let h: number;
    if (this.testHour != null) {
      h = this.testHour;
    } else {
      const now = new Date();
      h = ((now.getUTCHours() + now.getUTCMinutes() / 60 - 3) % 24 + 24) % 24;
    }
    // Mas claro al mediodia (~14 h), mas oscuro de madrugada (~2 h).
    return (1 - Math.cos(((h - 14) / 24) * Math.PI * 2)) / 2;
  }
}

function buildingKey(prosperity: number, i: number): string {
  // Variedad determinista + mejora de tier con la prosperidad.
  const v = frac(Math.sin((i + 1) * 45.23) * 1000);
  const v2 = frac(Math.sin((i + 1) * 91.7) * 1000);
  const level = prosperity * 3 + v; // 0..~4
  if (i === 0 && prosperity > 0.7) return "b_castle";
  if (level > 2.6) return "b_tower";
  if (level > 1.3) return v2 < 0.4 ? "b_house" : "b_rancho";
  return v2 < 0.5 ? "b_hut" : "b_rancho";
}

function frac(x: number): number {
  return x - Math.floor(x);
}

export function tierName(p: number): string {
  return TIER_NAMES[Math.min(TIER_NAMES.length - 1, Math.floor(p * TIER_NAMES.length))];
}
