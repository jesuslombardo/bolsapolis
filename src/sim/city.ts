import type { GameState } from "./types.ts";
import { netWorthCents } from "./engine.ts";

// El corazon de Bolsapolis: tu patrimonio SE CONVIERTE en tu ciudad.
// Funcion derivada pura -> el mismo patrimonio siempre produce la misma
// ciudad, asi que el render no guarda estado propio.
//
// A diferencia de la version por escalones, aqui el crecimiento es CONTINUO:
// cualquier variacion de patrimonio mueve el skyline, para que se note al
// instante cuando el mercado sube o baja.

// Rango de patrimonio (en unidades de moneda) mapeado a la ciudad.
// Empiezas con 10.000 -> ya se ve un pueblo, no un descampado.
const WEALTH_MIN = 6_000;
const WEALTH_MAX = 90_000;

const TIER_NAMES = [
  "Paraje",
  "Pueblo",
  "Villa",
  "Ciudad",
  "Metropoli",
  "Capital",
];

export interface Building {
  /** Altura en pisos. */
  floors: number;
  /** Ancho relativo [0.7..1.1] para variar el skyline. */
  width: number;
  /** Tono [0..1] para dar variedad de color. */
  hue: number;
}

export interface CityView {
  /** Nombre del nivel actual (Aldea, Pueblo, ...). */
  tierName: string;
  /** Progreso global [0..1] de pobreza a megalopolis. */
  prosperity: number;
  /** Edificios a dibujar, de izquierda a derecha. */
  buildings: Building[];
  /** Numero de arboles/parques (decrecen al urbanizarse). */
  trees: number;
}

export function prosperityOf(state: GameState, playerId: string): number {
  const units = netWorthCents(state, playerId) / 100;
  return clamp01((units - WEALTH_MIN) / (WEALTH_MAX - WEALTH_MIN));
}

export function tierNameForProsperity(p: number): string {
  return TIER_NAMES[Math.min(TIER_NAMES.length - 1, Math.floor(p * TIER_NAMES.length))];
}

export function cityView(state: GameState, playerId: string): CityView {
  const p = prosperityOf(state, playerId);

  // Nombre del nivel segun el tramo de prosperidad.
  const tierIdx = Math.min(TIER_NAMES.length - 1, Math.floor(p * TIER_NAMES.length));
  const tierName = TIER_NAMES[tierIdx];

  // Numero de edificios: de 5 (aldea) a 18 (megalopolis).
  const count = Math.round(5 + p * 13);

  const buildings: Building[] = [];
  for (let i = 0; i < count; i++) {
    // Variacion determinista y estable por posicion.
    const v = pseudo(i, 7);
    const v2 = pseudo(i, 31);
    // Altura base crece con la prosperidad; cada edificio varia alrededor.
    const maxFloors = 1 + p * 22; // hasta ~23 pisos en megalopolis
    const floors = Math.max(1, Math.round(maxFloors * (0.45 + 0.55 * v)));
    buildings.push({
      floors,
      width: 0.7 + 0.4 * v2,
      hue: 0.55 + 0.12 * v, // azules/verdes frios
    });
  }

  // Los arboles abundan en la aldea y desaparecen al urbanizarse.
  const trees = Math.round((1 - p) * 6);

  return { tierName, prosperity: p, buildings, trees };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// Hash determinista pequenyo -> [0,1). Da forma estable al skyline.
function pseudo(a: number, b: number): number {
  const n = Math.sin((a + 1) * 12.9898 + (b + 1) * 78.233) * 43758.5453;
  return n - Math.floor(n);
}
