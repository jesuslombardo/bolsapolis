import Phaser from "phaser";
import { createLocalRuntime } from "./game/runtime.ts";
import { WorldScene } from "./game/WorldScene.ts";
import { mountHud } from "./ui/hud.ts";
import { mountAuth } from "./ui/auth.ts";
import { loadSave, writeSave } from "./game/save.ts";
import { createInitialState } from "./sim/engine.ts";
import type { Profile } from "./game/account.ts";
import { money } from "./ui/format.ts";

// Garantiza el escalado correcto en movil (por si el host no inyecta viewport).
if (!document.querySelector("meta[name=viewport]")) {
  const meta = document.createElement("meta");
  meta.name = "viewport";
  meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
  document.head.appendChild(meta);
}

const SEED = 20260703;
const appEl = document.getElementById("app")!;
const gameEl = document.getElementById("game")!;

// Primero la pantalla de cuenta; cuando hay sesion lista, arranca el juego.
mountAuth(appEl, startGame);

function startGame(profile: Profile) {
  // Carga la partida del perfil (o crea una nueva con $100.000).
  const saved = loadSave(profile.email);
  let initialState = saved?.state ?? createInitialState(SEED, "p1", profile.name);
  // Migracion de partidas viejas: agrega el campo de experiencia si falta.
  if (initialState.players.p1 && typeof initialState.players.p1.xp !== "number") {
    initialState = {
      ...initialState,
      players: { ...initialState.players, p1: { ...initialState.players.p1, xp: 0 } },
    };
  }
  let offlineGain = 0;

  // Crecimiento offline del ahorro: rindio mientras no estabas (tope 7 dias).
  if (saved) {
    const days = Math.min((Date.now() - saved.ts) / 86_400_000, 7);
    const player = initialState.players.p1;
    if (player && player.savingsCents > 0 && days > 0.02) {
      offlineGain = Math.round(player.savingsCents * 0.05 * days);
      initialState = {
        ...initialState,
        players: { ...initialState.players, p1: { ...player, savingsCents: player.savingsCents + offlineGain } },
      };
    }
  }

  const runtime = createLocalRuntime({ seed: SEED, tickMs: 700, initialState });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameEl,
    backgroundColor: "#243b26",
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  });

  const hud = mountHud(appEl, runtime, "p1", profile.name, profile.email);

  const worldScene = new WorldScene();
  game.scene.add("world", worldScene, true, {
    runtime,
    hud,
    playerId: "p1",
    heroStart: saved?.hero ?? null,
    hairColor: profile.hairColor,
    mapId: saved?.mapId ?? "central",
  });
  runtime.start();

  if (offlineGain > 0) {
    hud.toast(`Mientras no estabas, tu ahorro rindió ${money(offlineGain)} 💰`, "good");
  }

  // Autoguardado por cuenta: cada 4 s y al cerrar/ocultar la pestanya.
  const save = () => writeSave(profile.email, runtime.getState(), worldScene.getHeroPos(), worldScene.getMapId());
  setInterval(save, 4000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __bolsapolis: unknown }).__bolsapolis = { runtime, game, hud, worldScene };
  }
}
