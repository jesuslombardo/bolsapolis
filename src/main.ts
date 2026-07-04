import Phaser from "phaser";
import { createLocalRuntime } from "./game/runtime.ts";
import { WorldScene } from "./game/WorldScene.ts";
import { mountHud } from "./ui/hud.ts";
import { loadSave, writeSave } from "./game/save.ts";

// Garantiza el escalado correcto en movil (por si el host no inyecta viewport).
if (!document.querySelector("meta[name=viewport]")) {
  const meta = document.createElement("meta");
  meta.name = "viewport";
  meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
  document.head.appendChild(meta);
}

// Seed fija por ahora para partidas reproducibles durante el desarrollo.
// En multiplayer la asignara el servidor al crear la sala.
const SEED = 20260703;

// Carga la partida guardada, si existe.
const saved = loadSave();
const runtime = createLocalRuntime({ seed: SEED, tickMs: 700, initialState: saved?.state });

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
});

const hud = mountHud(appEl, runtime, "p1");
const worldScene = new WorldScene();
game.scene.add("world", worldScene, true, {
  runtime,
  hud,
  playerId: "p1",
  heroStart: saved?.hero ?? null,
});
runtime.start();

// Autoguardado: cada 4 s y al cerrar/ocultar la pestanya.
function save() {
  writeSave(runtime.getState(), worldScene.getHeroPos());
}
setInterval(save, 4000);
window.addEventListener("beforeunload", save);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") save();
});

// Gancho de depuracion solo en desarrollo (util para probar niveles de ciudad
// sin tener que operar durante minutos). No se incluye en el build de produccion.
if (import.meta.env.DEV) {
  (window as unknown as { __bolsapolis: unknown }).__bolsapolis = { runtime, game, hud, worldScene };
}
