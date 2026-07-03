import type { GameState } from "./types.ts";
import { netWorthCents } from "./engine.ts";

// El corazon de Bolsapolis: tu patrimonio SE CONVIERTE en tu ciudad.
// Esta es una funcion derivada pura -> el mismo patrimonio siempre produce
// la misma ciudad, asi que el render no necesita guardar estado propio.

export interface CityTier {
  level: number;
  name: string;
  /** Patrimonio (en unidades enteras de moneda) necesario para alcanzarlo. */
  netWorthThreshold: number;
  /** Numero de edificios visibles en este nivel. */
  buildings: number;
  /** Altura maxima (en pisos) que pueden alcanzar los edificios. */
  maxFloors: number;
}

export const CITY_TIERS: CityTier[] = [
  { level: 0, name: "Descampado", netWorthThreshold: 0, buildings: 3, maxFloors: 1 },
  { level: 1, name: "Aldea", netWorthThreshold: 11_000, buildings: 5, maxFloors: 2 },
  { level: 2, name: "Pueblo", netWorthThreshold: 13_000, buildings: 7, maxFloors: 3 },
  { level: 3, name: "Villa", netWorthThreshold: 16_000, buildings: 9, maxFloors: 5 },
  { level: 4, name: "Ciudad", netWorthThreshold: 20_000, buildings: 11, maxFloors: 8 },
  { level: 5, name: "Metropoli", netWorthThreshold: 28_000, buildings: 13, maxFloors: 12 },
  { level: 6, name: "Megalopolis", netWorthThreshold: 45_000, buildings: 15, maxFloors: 18 },
];

export interface CityView {
  tier: CityTier;
  /** Progreso [0..1] hacia el siguiente tier. */
  progress: number;
  /** Altura (en pisos) de cada edificio; su longitud es tier.buildings. */
  floors: number[];
}

export function tierForNetWorth(netWorthUnits: number): CityTier {
  let current = CITY_TIERS[0];
  for (const t of CITY_TIERS) {
    if (netWorthUnits >= t.netWorthThreshold) current = t;
    else break;
  }
  return current;
}

export function cityView(state: GameState, playerId: string): CityView {
  const netWorthUnits = netWorthCents(state, playerId) / 100;
  const tier = tierForNetWorth(netWorthUnits);
  const next = CITY_TIERS[tier.level + 1];

  const progress = next
    ? clamp01((netWorthUnits - tier.netWorthThreshold) / (next.netWorthThreshold - tier.netWorthThreshold))
    : 1;

  // Los edificios crecen dentro del tier segun el progreso: al principio del
  // tier son bajos y se van elevando hacia maxFloors conforme sube el patrimonio.
  const floors: number[] = [];
  for (let i = 0; i < tier.buildings; i++) {
    // Variacion determinista por edificio para que el skyline no sea plano.
    const variation = 0.55 + 0.45 * pseudo(i, tier.level);
    const height = 1 + Math.round((tier.maxFloors - 1) * progress * variation);
    floors.push(Math.max(1, Math.min(tier.maxFloors, height)));
  }
  return { tier, progress, floors };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// Hash determinista pequenyo -> [0,1). Da forma estable al skyline.
function pseudo(a: number, b: number): number {
  const n = Math.sin((a + 1) * 12.9898 + (b + 1) * 78.233) * 43758.5453;
  return n - Math.floor(n);
}
