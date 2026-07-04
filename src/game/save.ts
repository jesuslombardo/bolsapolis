import type { GameState } from "../sim/types.ts";
import { lsGet, lsSet, lsRemove } from "./storage.ts";

// Guardado de partida por cuenta (en localStorage). Como la simulacion es
// serializable (objeto plano), guardamos el estado completo + la posicion del
// heroe + la marca de tiempo (para el crecimiento offline del ahorro).

const PREFIX = "bolsapolis.save.";

export interface SaveData {
  state: GameState;
  hero: { x: number; y: number } | null;
  mapId?: string;
  ts: number;
}

function keyFor(email: string): string {
  return PREFIX + email.trim().toLowerCase();
}

export function loadSave(email: string): SaveData | null {
  try {
    const raw = lsGet(keyFor(email));
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (!d || !d.state || !d.state.stocks || !d.state.players) return null;
    return d;
  } catch {
    return null;
  }
}

export function writeSave(
  email: string,
  state: GameState,
  hero: { x: number; y: number } | null,
  mapId = "central",
) {
  try {
    lsSet(keyFor(email), JSON.stringify({ state, hero, mapId, ts: Date.now() }));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function clearSave(email: string) {
  try {
    lsRemove(keyFor(email));
  } catch {
    /* ignore */
  }
}
