import Phaser from "phaser";
import type { GameState } from "../sim/types.ts";
import { cityView } from "../sim/city.ts";
import type { Runtime } from "./runtime.ts";

// Escena Phaser que dibuja el skyline. No guarda logica de juego: cada frame
// lee cityView(state) y pinta. El "juego" vive en la simulacion.
export class CityScene extends Phaser.Scene {
  private runtime!: Runtime;
  private playerId = "p1";
  private buildings!: Phaser.GameObjects.Container;
  private ground!: Phaser.GameObjects.Rectangle;
  private tierText!: Phaser.GameObjects.Text;
  private lastLevel = -1;

  constructor() {
    super("city");
  }

  init(data: { runtime: Runtime; playerId?: string }) {
    this.runtime = data.runtime;
    if (data.playerId) this.playerId = data.playerId;
  }

  create() {
    const { width, height } = this.scale;
    // Cielo degradado (dos bandas simples).
    this.add.rectangle(0, 0, width, height, 0x0b1020).setOrigin(0, 0);
    this.add.rectangle(0, height * 0.55, width, height * 0.45, 0x121a35).setOrigin(0, 0);
    this.ground = this.add.rectangle(0, height - 40, width, 40, 0x1c2547).setOrigin(0, 0);

    this.tierText = this.add
      .text(20, 18, "", { fontFamily: "system-ui", fontSize: "20px", color: "#8fb2ff" })
      .setShadow(0, 2, "#000", 4);

    this.buildings = this.add.container(0, 0);

    this.runtime.subscribe((s) => this.render(s));
    this.scale.on("resize", () => this.render(this.runtime.getState()));
  }

  private render(state: GameState) {
    const view = cityView(state, this.playerId);
    const { width, height } = this.scale;
    const baseY = height - 40;

    this.ground.width = width;
    this.ground.y = baseY;

    // Celebracion al subir de tier.
    if (view.tier.level > this.lastLevel && this.lastLevel >= 0) {
      this.cameras.main.flash(400, 80, 140, 255);
    }
    this.lastLevel = view.tier.level;

    this.tierText.setText(
      `${view.tier.name}  ·  nivel ${view.tier.level}  ·  ${Math.round(view.progress * 100)}% al siguiente`,
    );

    this.buildings.removeAll(true);

    const n = view.floors.length;
    const margin = 40;
    const usable = Math.max(120, width - margin * 2);
    const slot = usable / n;
    const bw = Math.min(slot * 0.7, 64);
    const floorH = 14;

    view.floors.forEach((floors, i) => {
      const cx = margin + slot * i + slot / 2;
      const bh = floors * floorH;
      const hue = 0.55 + (i / n) * 0.1;
      const color = Phaser.Display.Color.HSVToRGB(hue, 0.35, 0.85).color;
      const rect = this.add
        .rectangle(cx - bw / 2, baseY, bw, -bh, color)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x0b1020, 0.6);
      this.buildings.add(rect);

      // Ventanas: filas de puntitos que dan sensacion de escala.
      for (let f = 0; f < floors; f++) {
        const wy = baseY - f * floorH - floorH / 2;
        const on = (i + f) % 3 !== 0;
        const win = this.add
          .rectangle(cx, wy, 4, 4, on ? 0xffe08a : 0x2a335c)
          .setOrigin(0.5, 0.5);
        this.buildings.add(win);
      }
    });
  }
}
