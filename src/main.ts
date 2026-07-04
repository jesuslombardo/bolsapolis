import Phaser from "phaser";
import { createLocalRuntime } from "./game/runtime.ts";
import { WorldScene } from "./game/WorldScene.ts";
import { mountHud } from "./ui/hud.ts";

// Seed fija por ahora para partidas reproducibles durante el desarrollo.
// En multiplayer la asignara el servidor al crear la sala.
const SEED = 20260703;

const runtime = createLocalRuntime({ seed: SEED, tickMs: 700 });

const gameEl = document.getElementById("game")!;
const appEl = document.getElementById("app")!;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameEl,
  backgroundColor: "#243b26",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
  },
  scene: [WorldScene],
});

game.scene.start("world", { runtime, playerId: "p1" });

mountHud(appEl, runtime, "p1");
runtime.start();

// Gancho de depuracion solo en desarrollo (util para probar niveles de ciudad
// sin tener que operar durante minutos). No se incluye en el build de produccion.
if (import.meta.env.DEV) {
  (window as unknown as { __bolsapolis: unknown }).__bolsapolis = { runtime, game };
}
