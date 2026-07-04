import Phaser from "phaser";
import type { GameState } from "../sim/types.ts";
import { cityView } from "../sim/city.ts";
import { netWorthCents } from "../sim/engine.ts";
import type { Runtime } from "./runtime.ts";

// Escena Phaser que dibuja la ciudad. No guarda logica de juego: cada cambio
// de estado lee cityView(state) y repinta. El "juego" vive en la simulacion.
export class CityScene extends Phaser.Scene {
  private runtime!: Runtime;
  private playerId = "p1";

  private sky!: Phaser.GameObjects.Graphics;
  private sun!: Phaser.GameObjects.Arc;
  private clouds!: Phaser.GameObjects.Container;
  private city!: Phaser.GameObjects.Container;
  private ground!: Phaser.GameObjects.Graphics;
  private tierText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  private lastTierName = "";
  private lastShares = -1;

  constructor() {
    super("city");
  }

  init(data: { runtime: Runtime; playerId?: string }) {
    this.runtime = data.runtime;
    if (data.playerId) this.playerId = data.playerId;
  }

  create() {
    this.sky = this.add.graphics();
    this.sun = this.add.circle(0, 0, 34, 0xffe08a).setAlpha(0.95);
    this.clouds = this.add.container(0, 0);
    this.ground = this.add.graphics();
    this.city = this.add.container(0, 0);

    this.tierText = this.add
      .text(22, 18, "", { fontFamily: "system-ui", fontSize: "22px", fontStyle: "bold", color: "#ffffff" })
      .setShadow(0, 2, "#00000088", 6);

    this.hint = this.add
      .text(22, 50, "Compra acciones que suban -> sube tu patrimonio -> crece tu ciudad", {
        fontFamily: "system-ui",
        fontSize: "14px",
        color: "#dbe6ff",
      })
      .setShadow(0, 1, "#00000088", 4);

    // Nubes que se mueven suavemente.
    for (let i = 0; i < 4; i++) {
      const c = this.add.container(0, 0);
      const puff = this.add.ellipse(0, 0, 70, 26, 0xffffff, 0.16);
      const puff2 = this.add.ellipse(24, 6, 50, 20, 0xffffff, 0.16);
      const puff3 = this.add.ellipse(-22, 6, 46, 18, 0xffffff, 0.16);
      c.add([puff, puff2, puff3]);
      c.setData("speed", 6 + i * 4);
      c.setData("offset", i * 220);
      this.clouds.add(c);
    }

    this.runtime.subscribe((s) => this.render(s));
    this.scale.on("resize", () => this.render(this.runtime.getState()));
  }

  update(_time: number, delta: number) {
    const { width } = this.scale;
    // Deriva de nubes.
    this.clouds.each((c: Phaser.GameObjects.Container) => {
      let x = c.x + (c.getData("speed") as number) * (delta / 1000);
      if (x > width + 90) x = -90;
      c.x = x;
    });
  }

  private render(state: GameState) {
    const view = cityView(state, this.playerId);
    const { width, height } = this.scale;
    const horizon = height - 70;
    const p = view.prosperity;

    // --- Cielo: de amanecer palido (pobre) a azul dorado (prospero) ---
    const top = mix(0x0b1020, 0x1b3a6b, p);
    const bottom = mix(0x243b66, 0xf2b06a, p * 0.7);
    this.sky.clear();
    this.sky.fillGradientStyle(top, top, bottom, bottom, 1);
    this.sky.fillRect(0, 0, width, horizon + 20);

    // Sol: sube y se aclara con la prosperidad.
    this.sun.setPosition(width - 90, 70 + (1 - p) * 40).setRadius(28 + p * 10);

    // Reposiciona nubes de forma estable la primera vez.
    if (this.lastShares < 0) {
      this.clouds.each((c: Phaser.GameObjects.Container, i: number) => {
        c.setPosition((c.getData("offset") as number) % Math.max(1, width), 60 + i * 34);
      });
    }

    // --- Suelo ---
    this.ground.clear();
    this.ground.fillStyle(mix(0x1e2a1c, 0x2f5030, p), 1); // tierra/cesped
    this.ground.fillRect(0, horizon, width, height - horizon);
    this.ground.fillStyle(0x2b2f45, 1); // acera
    this.ground.fillRect(0, horizon, width, 10);

    // --- Ciudad ---
    this.city.removeAll(true);
    const n = view.buildings.length;
    const margin = 36;
    const usable = Math.max(140, width - margin * 2);
    const slot = usable / n;
    const floorH = 15;

    view.buildings.forEach((b, i) => {
      const cx = margin + slot * i + slot / 2;
      const bw = Math.min(slot * 0.78, 58) * b.width;
      const bh = b.floors * floorH;
      const color = Phaser.Display.Color.HSVToRGB(b.hue, 0.32, 0.55 + 0.3 * p).color;

      const rect = this.add
        .rectangle(cx, horizon, bw, bh, color)
        .setOrigin(0.5, 1)
        .setStrokeStyle(1, 0x0b1020, 0.5);
      this.city.add(rect);

      // Tejadito.
      const roof = this.add
        .rectangle(cx, horizon - bh, bw + 4, 4, mix(color, 0xffffff, 0.25))
        .setOrigin(0.5, 1);
      this.city.add(roof);

      // Ventanas iluminadas (mas encendidas cuanto mas prospera la ciudad).
      const cols = Math.max(1, Math.floor(bw / 12));
      for (let f = 0; f < b.floors; f++) {
        for (let cIdx = 0; cIdx < cols; cIdx++) {
          const wx = cx - bw / 2 + 8 + cIdx * 12;
          const wy = horizon - 10 - f * floorH;
          const on = pseudoOn(i, f * cols + cIdx, p);
          const win = this.add.rectangle(wx, wy, 5, 6, on ? 0xffe9a6 : 0x1a2340).setOrigin(0, 1);
          this.city.add(win);
        }
      }
    });

    // Arboles al pie (parques que se urbanizan al crecer).
    for (let t = 0; t < view.trees; t++) {
      const tx = margin + (usable * (t + 0.5)) / Math.max(1, view.trees);
      const trunk = this.add.rectangle(tx, horizon, 4, 12, 0x5a3b22).setOrigin(0.5, 1);
      const leaf = this.add.circle(tx, horizon - 14, 9, 0x3f7d3a);
      this.city.add(trunk);
      this.city.add(leaf);
    }

    // --- Etiqueta y patrimonio ---
    const net = (netWorthCents(state, this.playerId) / 100).toLocaleString("es-ES", {
      maximumFractionDigits: 0,
    });
    this.tierText.setText(`${view.tierName}  ·  ${net} §`);

    // --- Feedback al comprar: pequenya sacudida de construccion ---
    const totalShares = totalSharesOf(state, this.playerId);
    if (this.lastShares >= 0 && totalShares > this.lastShares) {
      this.cameras.main.shake(140, 0.004);
      this.tweens.add({ targets: this.city, y: 6, duration: 80, yoyo: true, ease: "Quad.easeOut" });
    }
    this.lastShares = totalShares;

    // Celebracion al cambiar de nivel de ciudad.
    if (this.lastTierName && view.tierName !== this.lastTierName) {
      this.cameras.main.flash(350, 120, 170, 255);
    }
    this.lastTierName = view.tierName;

    // La pista desaparece cuando ya has operado.
    this.hint.setAlpha(totalShares > startingShares(state, this.playerId) ? 0 : 1);
  }
}

// --- helpers ---------------------------------------------------------------

function totalSharesOf(state: GameState, playerId: string): number {
  const p = state.players[playerId];
  if (!p) return 0;
  let n = 0;
  for (const h of Object.values(p.holdings)) n += h.shares;
  return n;
}

// Acciones iniciales (para saber cuando el jugador ya ha operado).
let cachedStart: Record<string, number> = {};
function startingShares(state: GameState, playerId: string): number {
  if (cachedStart[playerId] === undefined) cachedStart[playerId] = totalSharesOf(state, playerId);
  return cachedStart[playerId];
}

function mix(a: number, b: number, t: number): number {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.IntegerToColor(a),
    Phaser.Display.Color.IntegerToColor(b),
    100,
    Math.round(Phaser.Math.Clamp(t, 0, 1) * 100),
  );
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

// Ventana encendida: patron estable por edificio/piso, mas encendidas si hay prosperidad.
function pseudoOn(building: number, cell: number, prosperity: number): boolean {
  const n = Math.sin((building + 1) * 9.71 + (cell + 1) * 4.13) * 4375.53;
  const r = n - Math.floor(n);
  return r < 0.35 + prosperity * 0.4;
}
