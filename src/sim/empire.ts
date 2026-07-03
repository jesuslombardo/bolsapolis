// Traducción portafolio -> imperio.
// El valor de tu portafolio define cuánta gente vive en Bolsápolis, y los
// hitos de población desbloquean edificios. Esta es la capa que hace que
// "la acción subió 4%" se sienta como "llegaron aldeanos nuevos".

import { portfolioValue, type MarketState } from "./market.js";

/** Cuánto valor de portafolio "sostiene" a un aldeano. */
export const VALUE_PER_VILLAGER = 250;

export interface Building {
  emoji: string;
  name: string;
  /** Población necesaria para que aparezca. */
  atPopulation: number;
}

/** Edificios que se levantan a medida que crece el imperio. */
export const BUILDINGS: Building[] = [
  { emoji: "🏠", name: "Casa", atPopulation: 1 },
  { emoji: "🌾", name: "Granja", atPopulation: 8 },
  { emoji: "🪵", name: "Aserradero", atPopulation: 16 },
  { emoji: "🏪", name: "Mercado", atPopulation: 28 },
  { emoji: "⛪", name: "Templo", atPopulation: 45 },
  { emoji: "🏰", name: "Castillo", atPopulation: 70 },
  { emoji: "🗼", name: "Gran Torre", atPopulation: 110 },
];

export interface EmpireState {
  /** Población que se muestra (se anima hacia `targetPopulation`). */
  population: number;
  targetPopulation: number;
}

export function newEmpire(): EmpireState {
  return { population: 0, targetPopulation: 0 };
}

/** Población objetivo según el valor actual del portafolio. */
export function targetPopulation(market: MarketState): number {
  return Math.floor(portfolioValue(market) / VALUE_PER_VILLAGER);
}

/**
 * Acerca la población mostrada a su objetivo de forma gradual, para que el
 * crecimiento (o el éxodo) se sienta animado en vez de instantáneo.
 * Devuelve el delta aplicado (positivo = nacieron aldeanos, negativo = se fueron).
 */
export function stepPopulation(empire: EmpireState, target: number): number {
  empire.targetPopulation = target;
  const gap = target - empire.population;
  if (gap === 0) return 0;
  // Se mueve ~25% del gap por paso, mínimo 1, para que converja pero anime.
  const step = Math.sign(gap) * Math.max(1, Math.floor(Math.abs(gap) * 0.25));
  const applied = Math.abs(step) > Math.abs(gap) ? gap : step;
  empire.population += applied;
  return applied;
}

/** Edificios actualmente desbloqueados por la población. */
export function unlockedBuildings(population: number): Building[] {
  return BUILDINGS.filter((b) => population >= b.atPopulation);
}
