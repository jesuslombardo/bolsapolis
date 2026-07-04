import Phaser from "phaser";
import type { GameState } from "../sim/types.ts";
import { prosperityOf } from "../sim/city.ts";
import type { Runtime } from "./runtime.ts";
import { buildTextures } from "./textures.ts";
import { touchMove } from "./input.ts";

// Mundo cenital estilo Argentum Online: caminas con un personaje por un mapa
// de tiles y tu pueblo crece con tu patrimonio (de aldea a metropoli).
// El render solo lee la simulacion; nada de logica de juego aqui.

const TILE = 16;
const COLS = 72;
const ROWS = 52;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;
const SPEED = 95;

const TIER_NAMES = ["Aldea", "Pueblo", "Villa", "Ciudad", "Metropoli", "Megalopolis"];

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

  constructor() {
    super("world");
  }

  init(data: { runtime: Runtime; playerId?: string }) {
    this.runtime = data.runtime;
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

    // Fuente central del pueblo.
    this.add.image(cx, cy, "well").setDepth(cy);

    this.computePlots(cx, cy);

    // Heroe.
    this.hero = this.add.image(cx, cy + 40, "hero_down").setDepth(cy + 40);
    this.cameras.main.startFollow(this.hero, true, 0.15, 0.15);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;

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
  private scatterNature() {
    let s = 12345;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const midC = COLS / 2;
    const midR = ROWS / 2;
    for (let i = 0; i < 140; i++) {
      const c = Math.floor(rnd() * COLS);
      const r = Math.floor(rnd() * ROWS);
      if (Math.hypot(c - midC, r - midR) < 12) continue; // deja libre el pueblo
      if (c > 5 && c < 15 && r > 4 && r < 13) continue; // deja libre el estanque
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE;
      this.add.image(x, y, "tree").setOrigin(0.5, 1).setDepth(y);
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

    for (let i = 0; i < count; i++) {
      const plot = this.plots[i];
      const key = buildingKey(p, i);
      const img = this.add.image(plot.x, plot.y, key).setOrigin(0.5, 1).setDepth(plot.y);
      this.buildings.add(img);
      // Animacion de "construccion" para los que aparecen nuevos.
      if (grew && i >= from) {
        img.setScale(0.2).setAlpha(0.4);
        this.tweens.add({ targets: img, scale: 1, alpha: 1, duration: 260, ease: "Back.easeOut" });
      }
    }
    this.lastCount = count;
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
      this.hero.x = Phaser.Math.Clamp(this.hero.x + (vx / len) * SPEED * dt, TILE, WORLD_W - TILE);
      this.hero.y = Phaser.Math.Clamp(this.hero.y + (vy / len) * SPEED * dt, TILE, WORLD_H - TILE);
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
