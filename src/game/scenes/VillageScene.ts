import Phaser from "phaser";
import { BUILDINGS, type Building } from "../../sim/empire.js";

const VILLAGER_EMOJI = "🧑‍🌾";
const MAX_VISIBLE_VILLAGERS = 240;

/**
 * Escena que dibuja el imperio: césped, edificios desbloqueados y una multitud
 * de aldeanos cuyo número refleja tu portafolio. No sabe nada de finanzas: solo
 * recibe `population` y la lista de edificios y lo pinta con feedback animado.
 */
export class VillageScene extends Phaser.Scene {
  private villagers: Phaser.GameObjects.Text[] = [];
  private buildingSprites = new Map<string, Phaser.GameObjects.Text>();
  private ground!: Phaser.GameObjects.Rectangle;
  private flash!: Phaser.GameObjects.Rectangle;
  private lastPopulation = 0;

  constructor() {
    super("village");
  }

  create() {
    this.ground = this.add.rectangle(0, 0, 10, 10, 0x1d7a3f).setOrigin(0, 0);
    this.flash = this.add
      .rectangle(0, 0, 10, 10, 0xffffff, 0)
      .setOrigin(0, 0)
      .setDepth(1000);
    this.layout();
    this.scale.on("resize", () => this.layout());
  }

  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.ground.setSize(w, h);
    this.flash.setSize(w, h);
    this.repositionBuildings();
    this.repositionVillagers();
  }

  /** Zona superior reservada a edificios; el resto es "el pueblo". */
  private buildingRowY() {
    return Math.min(90, this.scale.height * 0.18);
  }

  private repositionBuildings() {
    const w = this.scale.width;
    const y = this.buildingRowY();
    let i = 0;
    for (const b of BUILDINGS) {
      const sprite = this.buildingSprites.get(b.name);
      if (!sprite) continue;
      const x = 60 + i * Math.min(90, (w - 120) / Math.max(1, BUILDINGS.length - 1));
      sprite.setPosition(x, y);
      i++;
    }
  }

  private repositionVillagers() {
    const topPad = this.buildingRowY() + 60;
    const cols = Math.max(6, Math.floor((this.scale.width - 40) / 34));
    this.villagers.forEach((v, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      v.setPosition(24 + col * 34, topPad + row * 34);
    });
  }

  /** API pública: sincroniza la vista con el estado del juego. */
  updateFromState(population: number, buildings: Building[], changePct: number) {
    this.syncBuildings(buildings);
    this.syncVillagers(population);

    if (population !== this.lastPopulation) {
      const grew = population > this.lastPopulation;
      this.flashScreen(grew ? 0x37d67a : 0xff5d6c);
      this.lastPopulation = population;
    }
    // Guiño: color del suelo levemente más vivo cuando el día fue verde.
    const tint = changePct >= 0 ? 0x1d7a3f : 0x235f36;
    this.ground.fillColor = tint;
  }

  private syncBuildings(buildings: Building[]) {
    for (const b of buildings) {
      if (this.buildingSprites.has(b.name)) continue;
      const sprite = this.add
        .text(0, 0, b.emoji, { fontSize: "40px" })
        .setOrigin(0.5)
        .setScale(0);
      this.buildingSprites.set(b.name, sprite);
      this.tweens.add({ targets: sprite, scale: 1, duration: 400, ease: "Back.Out" });
    }
    this.repositionBuildings();
  }

  private syncVillagers(population: number) {
    const target = Math.min(population, MAX_VISIBLE_VILLAGERS);

    while (this.villagers.length < target) {
      const v = this.add
        .text(0, 0, VILLAGER_EMOJI, { fontSize: "22px" })
        .setOrigin(0.5)
        .setScale(0);
      this.villagers.push(v);
      this.tweens.add({
        targets: v,
        scale: 1,
        duration: 300,
        ease: "Back.Out",
        delay: Math.min(200, (this.villagers.length % 20) * 10),
      });
    }

    while (this.villagers.length > target) {
      const v = this.villagers.pop();
      if (!v) break;
      this.tweens.add({
        targets: v,
        scale: 0,
        alpha: 0,
        duration: 250,
        ease: "Back.In",
        onComplete: () => v.destroy(),
      });
    }

    this.repositionVillagers();
  }

  private flashScreen(color: number) {
    this.flash.fillColor = color;
    this.flash.setAlpha(0.22);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 500, ease: "Quad.Out" });
  }
}
