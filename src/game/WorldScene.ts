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
  private solids: Array<{ x: number; y: number; r: number }> = [];
  private lastTier = "";
  private stepTimer = 0;

  constructor() {
    super("world");
  }

  init(data: { runtime: Runtime; hud: HudApi; playerId?: string }) {
    this.runtime = data.runtime;
    this.hud = data.hud;
    if (data.playerId) this.playerId = data.playerId;
  }

  create() {
    buildTextures(this);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setZoom(2.6);
    this.cameras.main.roundPixels = true;

    this.paintGround();
    this.scatterNature();

    this.buildings = this.add.container(0, 0);

    const cx = (COLS / 2) * TILE;
    const cy = (ROWS / 2) * TILE;

    // Comercios: la Bolsa (acciones) y el Banco (bonos), flanqueando la plaza.
    this.shops = [
      { kind: "stock", name: "Bolsa", tex: "b_bolsa", x: cx - 3 * TILE, y: cy - TILE },
      { kind: "bond", name: "Banco", tex: "b_banco", x: cx + 3 * TILE, y: cy - TILE },
    ];

    // Fuente central del pueblo.
    this.add.image(cx, cy, "well").setDepth(cy);

    this.computePlots(cx, cy);

    // Dibuja los comercios con su cartel flotante y su vendedor (NPC).
    for (const shop of this.shops) {
      this.add.image(shop.x, shop.y, shop.tex).setOrigin(0.5, 1).setDepth(shop.y);
      const label = this.add
        .text(shop.x, shop.y - 30, `${shop.kind === "stock" ? "📈" : "🏦"} ${shop.name}`, {
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
      const npcTex = shop.kind === "stock" ? "npc_merchant" : "npc_banker";
      const npc = this.add.image(shop.x, shop.y + 8, npcTex).setOrigin(0.5, 1).setDepth(shop.y + 8);
      this.tweens.add({ targets: npc, y: npc.y - 1.5, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }

    // Solidos fijos (colisiones): comercios, fuente y arboles.
    this.staticSolids = [
      ...this.shops.map((s) => ({ x: s.x, y: s.y - 8, r: 13 })),
      { x: cx, y: cy - 4, r: 8 },
      ...this.treeSolids,
    ];

    // Heroe.
    this.hero = this.add.image(cx, cy + 44, "hero_down").setDepth(cy + 44);
    this.cameras.main.startFollow(this.hero, true, 0.15, 0.15);

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
    // Un estanque en una esquina.
    for (let r = 5; r < 12; r++) {
      for (let c = 6; c < 14; c++) {
        if (Math.hypot(c - 10, r - 8) < 4) {
          this.add.image(c * TILE, r * TILE, "water").setOrigin(0, 0).setDepth(-998);
        }
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
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE;
      this.add.image(x, y, "tree").setOrigin(0.5, 1).setDepth(y);
      // Colision solo en el tronco (parte baja del arbol).
      this.treeSolids.push({ x, y: y - 4, r: 5 });
    }
  }

  // Parcelas del pueblo en espiral desde el centro (se van llenando al crecer).
  private computePlots(cx: number, cy: number) {
    const step = 3 * TILE;
    const ring: Array<{ x: number; y: number; r: number }> = [];
    for (let radius = 1; radius <= 8; radius++) {
      const n = radius * 6;
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2 + radius * 0.5;
        const x = cx + Math.cos(ang) * radius * step * 0.55;
        const y = cy + Math.sin(ang) * radius * step * 0.45;
        if (x < TILE * 2 || x > WORLD_W - TILE * 2) continue;
        if (y < TILE * 2 || y > WORLD_H - TILE * 2) continue;
        // Evita el centro (fuente) y el estanque.
        if (Math.hypot(x - cx, y - cy) < step) continue;
        // Evita solaparse con los comercios.
        if (this.shops.some((s) => Math.hypot(x - s.x, y - s.y) < 2 * TILE)) continue;
        ring.push({ x: Math.round(x), y: Math.round(y), r: radius });
      }
    }
    this.plots = ring;
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
    for (let i = 0; i < count; i++) {
      const plot = this.plots[i];
      const key = buildingKey(p, i);
      const img = this.add.image(plot.x, plot.y, key).setOrigin(0.5, 1).setDepth(plot.y);
      this.buildings.add(img);
      buildingSolids.push({ x: plot.x, y: plot.y - 6, r: 9 });
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
    if (this.lastTier && tier !== this.lastTier) {
      this.cameras.main.flash(350, 120, 170, 255);
    }
    this.lastTier = tier;
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
  }
}

function buildingKey(prosperity: number, i: number): string {
  // Variedad determinista + mejora de tier con la prosperidad.
  const v = frac(Math.sin((i + 1) * 45.23) * 1000);
  const level = prosperity * 3 + v; // 0..~4
  if (i === 0 && prosperity > 0.7) return "b_castle";
  if (level > 2.6) return "b_tower";
  if (level > 1.3) return "b_house";
  return "b_hut";
}

function frac(x: number): number {
  return x - Math.floor(x);
}

export function tierName(p: number): string {
  return TIER_NAMES[Math.min(TIER_NAMES.length - 1, Math.floor(p * TIER_NAMES.length))];
}
