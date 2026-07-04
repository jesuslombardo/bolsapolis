import type { GameState } from "./types.ts";
import { netWorthCents } from "./engine.ts";

// Nivel del jugador segun el patrimonio ACUMULADO (en dolares).
// El nivel habilitara mas adelante el acceso a otras islas.
// Umbrales en dolares para pasar a los niveles 2, 3, 4, ...
export const LEVEL_THRESHOLDS = [
  150_000, 250_000, 400_000, 650_000, 1_000_000, 1_500_000, 2_500_000, 4_000_000, 6_000_000,
];

export function levelForNetWorth(netWorthCents: number): number {
  const dollars = netWorthCents / 100;
  let lvl = 1;
  for (const t of LEVEL_THRESHOLDS) {
    if (dollars >= t) lvl++;
    else break;
  }
  return lvl;
}

export function levelOf(state: GameState, playerId: string): number {
  return levelForNetWorth(netWorthCents(state, playerId));
}

// Progreso [0..1] hacia el siguiente nivel (1 si ya es el maximo).
export function levelProgress(state: GameState, playerId: string): number {
  const dollars = netWorthCents(state, playerId) / 100;
  const lvl = levelForNetWorth(netWorthCents(state, playerId));
  if (lvl > LEVEL_THRESHOLDS.length) return 1;
  const prev = lvl >= 2 ? LEVEL_THRESHOLDS[lvl - 2] : 0;
  const next = LEVEL_THRESHOLDS[lvl - 1];
  return Math.max(0, Math.min(1, (dollars - prev) / (next - prev)));
}
