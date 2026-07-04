import type { GameState } from "../sim/types.ts";

// Guardado de partida en localStorage. Como la simulacion es serializable
// (objeto plano), guardamos el estado completo + la posicion del heroe.

const KEY = "bolsapolis.save.v2";

export interface SaveData {
  state: GameState;
  hero: { x: number; y: number } | null;
  ts: number;
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (!d || !d.state || !d.state.stocks || !d.state.players) return null;
    return d;
  } catch {
    return null;
  }
}

export function writeSave(state: GameState, hero: { x: number; y: number } | null) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ state, hero, ts: Date.now() }));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
