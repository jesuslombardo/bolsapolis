import Phaser from "phaser";
import type { AssetKind, GameState } from "../sim/types.ts";
import { prosperityOf } from "../sim/city.ts";
import { levelOf } from "../sim/progress.ts";
import type { Runtime } from "./runtime.ts";
import type { HudApi } from "../ui/hud.ts";
import { buildTextures } from "./textures.ts";
import { touchMove } from "./input.ts";
import { sfx } from "./audio.ts";
import { islandById, ISLANDS, OPP, type Dir, type IslandDef } from "./islands.ts";

interface Shop {
  kind: AssetKind;
  name: string;
  tex: string;
  x: number;
  y: number;
}

interface Exit {
  dir: Dir;
  target: string;
  requiredLevel: number;
  targetName: string;
  x: number;
  y: number;
}

// Mundo cenital estilo Argentum Online: caminas por un archipielago. La Isla
// Central crece con tu patrimonio; las otras se desbloquean por nivel.

const TILE = 16;
const COLS = 72;
const ROWS = 52;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;
const SPEED = 95;
const WALL_HALF = 9;

// Rectangulo de tierra (el resto es agua): deja un borde de mar.
const LMINC = 5;
const LMAXC = COLS - 6;
const LMINR = 5;
const LMAXR = ROWS - 6;

const TIER_NAMES = ["Paraje", "Pueblo", "Villa", "Ciudad", "Metropoli", "Capital"];

export class WorldScene extends Phaser.Scene {
  private runtime!: Runtime;
  private playerId = "p1";
  private hairColor = 0x4a2f1c;

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
  private wallSolids: Array<{ x: number; y: number; r: number }> = [];
  private solids: Array<{ x: number; y: number; r: number }> = [];
  private land: boolean[][] = [];
  private lastTier = "";
  private stepTimer = 0;
  private heroStart: { x: number; y: number } | null = null;
  private night!: Phaser.GameObjects.Rectangle;
  private townSignText!: Phaser.GameObjects.Text;
  private townLights!: Phaser.GameObjects.Container;
  private buildingLights!: Phaser.GameObjects.Container;
  private testHour: number | null = null;

  private island!: IslandDef;
  private entryDir: Dir | null = null;
  private exits: Exit[] = [];
  private traveling = false;
  private lastGateToast = 0;

  constructor() {
    super("world");
  }

  init(data: {
    runtime: Runtime;
    hud: HudApi;
    playerId?: string;
    heroStart?: { x: number; y: number } | null;
    hairColor?: number;
    mapId?: string;
    entryDir?: Dir | null;
  }) {
    this.runtime = data.runtime;
    this.hud = data.hud;
    if (data.playerId) this.playerId = data.playerId;
    this.heroStart = data.heroStart ?? null;
    if (typeof data.hairColor === "number") this.hairColor = data.hairColor;
    this.island = islandById(data.mapId ?? "central");
    this.entryDir = data.entryDir ?? null;
    // reset por-mapa
    this.lastCount = -1;
    this.lastTier = "";
    this.traveling = false;
  }

  getHeroPos() {
    return this.hero ? { x: Math.round(this.hero.x), y: Math.round(this.hero.y) } : null;
  }
  getMapId() {
    return this.island?.id ?? "central";
  }

  create() {
    buildTextures(this, this.hairColor);
    const hourParam = new URLSearchParams(location.search).get("hour");
    if (hourParam != null && !Number.isNaN(parseFloat(hourParam))) this.testHour = parseFloat(hourParam);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setZoom(2.6);
    this.cameras.main.roundPixels = true;

    const cx = (COLS / 2) * TILE;
    const cy = (ROWS / 2) * TILE;
    const central = this.island.klass === "central";

    this.paintIsland();
    this.paintRoads(cx, cy);
    if (central) this.paintWalls(cx, cy);
    else this.wallSolids = [];
    this.scatterNature();

    this.buildings = this.add.container(0, 0);
    this.buildingLights = this.add.container(0, 0).setDepth(55000);
    this.townLights = this.add.container(0, 0).setDepth(55000);

    // Comercios (en todas las islas, para poder operar donde estes).
    this.shops = [
      { kind: "stock", name: "Bolsa", tex: "b_bolsa", x: cx - 4 * TILE, y: cy - TILE },
      { kind: "bond", name: "Banco", tex: "b_banco", x: cx + 4 * TILE, y: cy - TILE },
      { kind: "commodity", name: "Almacen", tex: "b_almacen", x: cx, y: cy - 4 * TILE },
    ];

    this.add.image(cx, cy, "well").setDepth(cy);

    // Cartel del pueblo.
    this.add.image(cx - 8, cy + 5 * TILE, "sign").setOrigin(0.5, 1).setDepth(cy + 5 * TILE);
    this.townSignText = this.add
      .text(cx, cy + 5 * TILE - 22, central ? "Paraje" : this.island.name, {
        fontFamily: "system-ui",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffe9a6",
      })
      .setOrigin(0.5, 1)
      .setDepth(9999)
      .setResolution(3);
    this.townSignText.setScale(1 / this.cameras.main.zoom);

    // Comercios: sprite + cartel + vendedor + farol.
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
      const npc = this.add.image(shop.x, shop.y + 8, shopNpc[shop.kind]).setOrigin(0.5, 1).setDepth(shop.y + 8);
      this.tweens.add({ targets: npc, y: npc.y - 1.5, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.addLight(this.townLights, shop.x, shop.y - 12, 1.6);
    }

    this.addLight(this.townLights, cx, cy - 6, 1.4);

    // Solidos fijos: comercios, fuente, arboles y (si hay) muralla.
    this.staticSolids = [
      ...this.shops.map((s) => ({ x: s.x, y: s.y - 8, r: 13 })),
      { x: cx, y: cy - 4, r: 8 },
      ...this.treeSolids,
      ...this.wallSolids,
    ];
    this.solids = [...this.staticSolids];

    // Salidas (puentes con nivel requerido) + carteles.
    this.buildExits();

    // Contenido del pueblo.
    if (central) {
      this.computePlots(cx, cy);
      this.runtime.subscribe((s) => this.syncTown(s));
    } else {
      this.placeFixedTown(cx, cy);
    }

    // Heroe: en la posicion guardada, en la entrada del puente, o en la plaza.
    let hx = cx;
    let hy = cy + 44;
    if (this.entryDir) [hx, hy] = this.entryPos(this.entryDir);
    else if (this.heroStart) {
      hx = this.heroStart.x;
      hy = this.heroStart.y;
    }
    this.hero = this.add.image(hx, hy, "hero_down").setDepth(hy);
    this.cameras.main.startFollow(this.hero, true, 0.15, 0.15);

    // Dia/noche.
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

    // Aviso de donde estas.
    this.time.delayedCall(200, () => this.hud.toast(`📍 ${this.island.name}`, "info"));
  }

  // --- Terreno: agua alrededor, tierra en el medio, puentes en las salidas ---
  private paintIsland() {
    // grilla de tierra
    this.land = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const isLand = c >= LMINC && c <= LMAXC && r >= LMINR && r <= LMAXR;
        if (isLand) this.land[r][c] = true;
        const key = isLand ? ["grass0", "grass1", "grass2"][(c * 7 + r * 13) % 3] : "water";
        const img = this.add.image(c * TILE, r * TILE, key).setOrigin(0, 0).setDepth(isLand ? -1000 : -998);
        if (isLand && this.island.grassTint !== 0xffffff) img.setTint(this.island.grassTint);
      }
    }
    // Playa: arena en el borde de tierra que toca el agua.
    for (let r = LMINR; r <= LMAXR; r++) {
      for (let c = LMINC; c <= LMAXC; c++) {
        if (c === LMINC || c === LMAXC || r === LMINR || r === LMAXR) {
          this.add.image(c * TILE, r * TILE, "sand").setOrigin(0, 0).setDepth(-999.5);
        }
      }
    }
    // Puentes de tierra sobre el agua, en cada salida.
    const midC = Math.round(COLS / 2);
    const midR = Math.round(ROWS / 2);
    for (const dir of Object.keys(this.island.exits) as Dir[]) {
      if (dir === "w") for (let c = 0; c < LMINC; c++) this.bridgeCol(c, midR);
      if (dir === "e") for (let c = LMAXC + 1; c < COLS; c++) this.bridgeCol(c, midR);
      if (dir === "n") for (let r = 0; r < LMINR; r++) this.bridgeRow(midC, r);
      if (dir === "s") for (let r = LMAXR + 1; r < ROWS; r++) this.bridgeRow(midC, r);
    }
    // Plaza de tierra en el centro.
    for (let r = midR - 5; r <= midR + 5; r++) {
      for (let c = midC - 6; c <= midC + 6; c++) {
        if (Math.hypot(c - midC, r - midR) < 6.5) {
          this.add.image(c * TILE, r * TILE, "path").setOrigin(0, 0).setDepth(-997);
        }
      }
    }
  }
  private bridgeCol(c: number, midR: number) {
    for (let d = -1; d <= 1; d++) {
      this.add.image(c * TILE, (midR + d) * TILE, "path").setOrigin(0, 0).setDepth(-997);
      this.land[midR + d][c] = true;
    }
  }
  private bridgeRow(midC: number, r: number) {
    for (let d = -1; d <= 1; d++) {
      this.add.image((midC + d) * TILE, r * TILE, "path").setOrigin(0, 0).setDepth(-997);
      this.land[r][midC + d] = true;
    }
  }

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
      if (Math.abs(c - midC) > 1) {
        place(c, midR - WALL_HALF);
        place(c, midR + WALL_HALF);
      }
    }
    for (let r = midR - WALL_HALF + 1; r <= midR + WALL_HALF - 1; r++) {
      if (Math.abs(r - midR) > 1) {
        place(midC - WALL_HALF, r);
        place(midC + WALL_HALF, r);
      }
    }
  }

  // Caminos desde el centro hacia cada salida (y hacia el sur para el cartel).
  private paintRoads(cx: number, cy: number) {
    const midC = Math.round(cx / TILE);
    const midR = Math.round(cy / TILE);
    const dirs = new Set<Dir>([...(Object.keys(this.island.exits) as Dir[]), "s"]);
    for (const dir of dirs) {
      if (dir === "w") for (let c = LMINC; c <= midC; c++) this.roadCol(c, midR);
      if (dir === "e") for (let c = midC; c <= LMAXC; c++) this.roadCol(c, midR);
      if (dir === "n") for (let r = LMINR; r <= midR; r++) this.roadRow(midC, r);
      if (dir === "s") for (let r = midR; r <= LMAXR; r++) this.roadRow(midC, r);
    }
  }
  private roadCol(c: number, midR: number) {
    for (let d = -1; d <= 1; d++) this.add.image(c * TILE, (midR + d) * TILE, "path").setOrigin(0, 0).setDepth(-996);
  }
  private roadRow(midC: number, r: number) {
    for (let d = -1; d <= 1; d++) this.add.image((midC + d) * TILE, r * TILE, "path").setOrigin(0, 0).setDepth(-996);
  }

  private scatterNature() {
    let s = 12345 + this.island.id.length * 777;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const midC = COLS / 2;
    const midR = ROWS / 2;
    this.treeSolids = [];
    for (let i = 0; i < 120; i++) {
      const c = Math.floor(rnd() * COLS);
      const r = Math.floor(rnd() * ROWS);
      if (!this.land[r]?.[c]) continue; // solo en tierra
      if (Math.hypot(c - midC, r - midR) < 12) continue; // deja libre el pueblo
      if (Math.abs(c - midC) <= 1 || Math.abs(r - midR) <= 1) continue; // caminos
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE;
      this.add.image(x, y, "tree").setOrigin(0.5, 1).setDepth(y);
      this.treeSolids.push({ x, y: y - 4, r: 5 });
    }
  }

  // Salidas: al final de cada puente, con su nivel requerido y un cartel.
  private buildExits() {
    const midC = Math.round(COLS / 2);
    const midR = Math.round(ROWS / 2);
    this.exits = [];
    for (const [dir, target] of Object.entries(this.island.exits) as [Dir, string][]) {
      const def = ISLANDS[target];
      let c = midC;
      let r = midR;
      if (dir === "w") c = 1;
      if (dir === "e") c = COLS - 2;
      if (dir === "n") r = 1;
      if (dir === "s") r = ROWS - 2;
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE / 2;
      this.exits.push({ dir, target, requiredLevel: def.requiredLevel, targetName: def.name, x, y });
      const lbl = this.add
        .text(x, y - 16, `⛴️ ${def.name}\nNv ${def.requiredLevel}`, {
          fontFamily: "system-ui",
          fontSize: "13px",
          fontStyle: "bold",
          color: "#eaf6ff",
          align: "center",
        })
        .setOrigin(0.5, 1)
        .setDepth(9999)
        .setResolution(3);
      lbl.setScale(1 / this.cameras.main.zoom);
    }
  }

  private entryPos(dir: Dir): [number, number] {
    const midC = Math.round(COLS / 2);
    const midR = Math.round(ROWS / 2);
    if (dir === "w") return [(LMINC + 1) * TILE, midR * TILE];
    if (dir === "e") return [(LMAXC - 1) * TILE, midR * TILE];
    if (dir === "n") return [midC * TILE, (LMINR + 1) * TILE];
    return [midC * TILE, (LMAXR - 1) * TILE];
  }

  // Pueblo fijo de las islas satelite (no crece con el patrimonio).
  private placeFixedTown(cx: number, cy: number) {
    const set = this.island.buildings;
    const plots: Array<{ x: number; y: number; r: number }> = [];
    for (let dr = -8; dr <= 8; dr += 2) {
      for (let dc = -8; dc <= 8; dc += 2) {
        if (Math.abs(dc) <= 1 || Math.abs(dr) <= 1) continue;
        const x = cx + dc * TILE;
        const y = cy + dr * TILE;
        const c = Math.round(x / TILE);
        const r = Math.round(y / TILE);
        if (!this.land[r]?.[c]) continue;
        if (Math.hypot(x - cx, y - cy) < 2.5 * TILE) continue;
        if (this.shops.some((sp) => Math.hypot(x - sp.x, y - sp.y) < 2 * TILE)) continue;
        plots.push({ x, y, r: Math.max(Math.abs(dc), Math.abs(dr)) });
      }
    }
    plots.sort((a, b) => a.r - b.r);
    const buildingSolids: Array<{ x: number; y: number; r: number }> = [];
    plots.slice(0, this.island.fixed).forEach((plot, i) => {
      const key = set[i % set.length];
      this.add.image(plot.x, plot.y, key).setOrigin(0.5, 1).setDepth(plot.y);
      buildingSolids.push({ x: plot.x, y: plot.y - 6, r: 9 });
      this.addLight(this.buildingLights, plot.x, plot.y - 10, 1);
    });
    this.solids = [...this.staticSolids, ...buildingSolids];
  }

  private computePlots(cx: number, cy: number) {
    const plots: Array<{ x: number; y: number; r: number }> = [];
    for (let dr = -(WALL_HALF - 2); dr <= WALL_HALF - 2; dr += 2) {
      for (let dc = -(WALL_HALF - 2); dc <= WALL_HALF - 2; dc += 2) {
        if (Math.abs(dc) <= 1 || Math.abs(dr) <= 1) continue;
        const x = cx + dc * TILE;
        const y = cy + dr * TILE;
        if (Math.hypot(x - cx, y - cy) < 2.5 * TILE) continue;
        if (this.shops.some((s) => Math.hypot(x - s.x, y - s.y) < 2 * TILE)) continue;
        plots.push({ x, y, r: Math.max(Math.abs(dc), Math.abs(dr)) });
      }
    }
    plots.sort((a, b) => a.r - b.r);
    this.plots = plots;
  }

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
      const img = this.add.image(plot.x, plot.y, buildingKey(p, i)).setOrigin(0.5, 1).setDepth(plot.y);
      this.buildings.add(img);
      buildingSolids.push({ x: plot.x, y: plot.y - 6, r: 9 });
      this.addLight(this.buildingLights, plot.x, plot.y - 10, 1);
      if (grew && i >= from) {
        img.setScale(0.2).setAlpha(0.4);
        this.tweens.add({ targets: img, scale: 1, alpha: 1, duration: 260, ease: "Back.easeOut" });
      }
    }
    this.solids = [...this.staticSolids, ...buildingSolids];
    this.lastCount = count;
    const tier = tierName(p);
    if (this.townSignText) this.townSignText.setText(tier);
    if (this.lastTier && tier !== this.lastTier) this.cameras.main.flash(350, 120, 170, 255);
    this.lastTier = tier;
  }

  private addLight(container: Phaser.GameObjects.Container, x: number, y: number, scale = 1.5) {
    const img = this.add.image(x, y, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd98a).setScale(scale);
    container.add(img);
  }

  private penetration(x: number, y: number): number {
    let total = 0;
    for (const s of this.solids) {
      const overlap = s.r + 4 - Math.hypot(x - s.x, y - s.y);
      if (overlap > 0) total += overlap;
    }
    return total;
  }

  // ¿(x,y) cae en agua? (para que no se pueda caminar sobre el mar)
  private isWater(x: number, y: number): boolean {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    return !this.land[r]?.[c];
  }

  update(_t: number, delta: number) {
    if (!this.hero) return;
    const dt = delta / 1000;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
    vx += touchMove.x;
    vy += touchMove.y;

    if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001) {
      const len = Math.hypot(vx, vy);
      const stepX = (vx / len) * SPEED * dt;
      const stepY = (vy / len) * SPEED * dt;
      const fromX = this.hero.x;
      const fromY = this.hero.y;
      const basePen = this.penetration(this.hero.x, this.hero.y);
      const tryX = Phaser.Math.Clamp(this.hero.x + stepX, TILE, WORLD_W - TILE);
      if (!this.isWater(tryX, this.hero.y) && this.penetration(tryX, this.hero.y) <= basePen) this.hero.x = tryX;
      const tryY = Phaser.Math.Clamp(this.hero.y + stepY, TILE, WORLD_H - TILE);
      if (!this.isWater(this.hero.x, tryY) && this.penetration(this.hero.x, tryY) <= basePen) this.hero.y = tryY;
      this.hero.setDepth(this.hero.y);

      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = "side";
        this.flip = vx < 0;
      } else {
        this.facing = vy < 0 ? "up" : "down";
      }
      const key = this.facing === "side" ? "hero_side" : this.facing === "up" ? "hero_up" : "hero_down";
      this.hero.setTexture(key);
      this.hero.setFlipX(this.facing === "side" && this.flip);
      this.hero.y += Math.sin(_t / 90) * 0.15;

      const moved = Math.hypot(this.hero.x - fromX, this.hero.y - fromY);
      if (moved > 0.2) {
        this.stepTimer += delta;
        if (this.stepTimer >= 260) {
          this.stepTimer = 0;
          sfx.step();
        }
      } else {
        this.stepTimer = 260;
      }
    } else {
      this.stepTimer = 260;
    }

    // Comercio cercano.
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
    if (this.nearShop && Phaser.Input.Keyboard.JustDown(this.interactKey)) this.hud.openShop(this.nearShop.kind);

    // Salidas: viajar a otra isla si el nivel alcanza.
    if (!this.traveling) {
      for (const ex of this.exits) {
        if (Math.hypot(this.hero.x - ex.x, this.hero.y - ex.y) < 16) {
          this.tryTravel(ex);
          break;
        }
      }
    }

    // Dia/noche.
    const nightness = this.nightnessNow();
    this.night.setAlpha(nightness * 0.55);
    const lightOn = Math.max(0, (nightness - 0.2) / 0.8);
    this.townLights.setAlpha(lightOn);
    this.buildingLights.setAlpha(lightOn);
  }

  private tryTravel(ex: Exit) {
    const lvl = levelOf(this.runtime.getState(), this.playerId);
    if (lvl < ex.requiredLevel) {
      if (_now() - this.lastGateToast > 1500) {
        this.lastGateToast = _now();
        this.hud.toast(`🔒 Necesitás Nivel ${ex.requiredLevel} para entrar a ${ex.targetName}`, "bad");
        sfx.deny();
      }
      return;
    }
    this.traveling = true;
    this.cameras.main.fadeOut(220, 6, 12, 20);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.restart({
        runtime: this.runtime,
        hud: this.hud,
        playerId: this.playerId,
        hairColor: this.hairColor,
        mapId: ex.target,
        entryDir: OPP[ex.dir],
      });
    });
  }

  private nightnessNow(): number {
    let h: number;
    if (this.testHour != null) {
      h = this.testHour;
    } else {
      const now = new Date();
      h = ((now.getUTCHours() + now.getUTCMinutes() / 60 - 3) % 24 + 24) % 24;
    }
    return (1 - Math.cos(((h - 14) / 24) * Math.PI * 2)) / 2;
  }
}

// Reloj (envuelto para que sea facil de mockear en pruebas).
function _now(): number {
  return new Date().getTime();
}

function buildingKey(prosperity: number, i: number): string {
  const v = frac(Math.sin((i + 1) * 45.23) * 1000);
  const v2 = frac(Math.sin((i + 1) * 91.7) * 1000);
  const level = prosperity * 3 + v;
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
