// Mercado simulado (mock). Más adelante lo reemplazamos por precios reales
// vía un Cloudflare Worker que consulte una API bursátil (ver docs/roadmap.md).
//
// La mecánica central de Bolsápolis vive acá: el mercado se mueve, tu portafolio
// cambia de valor, y ese valor se traduce en población para tu imperio (empire.ts).

export interface Holding {
  symbol: string;
  name: string;
  shares: number;
  price: number;
  /** Variación % del último tick (para HUD y feedback visual). */
  lastChangePct: number;
}

export interface MarketState {
  day: number;
  holdings: Holding[];
}

/** Portafolio inicial de ejemplo. Símbolos ficticios, temáticos. */
export function seedPortfolio(): MarketState {
  return {
    day: 1,
    holdings: [
      { symbol: "ARZ", name: "Arzano Metals", shares: 40, price: 100, lastChangePct: 0 },
      { symbol: "GRN", name: "Granéra Foods", shares: 60, price: 55, lastChangePct: 0 },
      { symbol: "VLT", name: "Voltia Energy", shares: 25, price: 180, lastChangePct: 0 },
    ],
  };
}

/**
 * Movimiento diario tipo "random walk" con leve deriva alcista.
 * Cada acción tiene su propia volatilidad implícita.
 */
export function tick(state: MarketState): MarketState {
  const drift = 0.004; // sesgo alcista suave: los imperios tienden a crecer
  const holdings = state.holdings.map((h) => {
    const vol = 0.06; // volatilidad diaria ~6%
    const shock = (Math.random() - 0.5) * 2 * vol;
    const changePct = drift + shock;
    const nextPrice = Math.max(1, h.price * (1 + changePct));
    return {
      ...h,
      price: Math.round(nextPrice * 100) / 100,
      lastChangePct: (nextPrice / h.price - 1) * 100,
    };
  });
  return { day: state.day + 1, holdings };
}

/** Valor total del portafolio. */
export function portfolioValue(state: MarketState): number {
  return state.holdings.reduce((sum, h) => sum + h.shares * h.price, 0);
}

/** Variación % ponderada por valor del último tick. */
export function portfolioChangePct(state: MarketState): number {
  const total = portfolioValue(state);
  if (total === 0) return 0;
  const weighted = state.holdings.reduce(
    (sum, h) => sum + h.shares * h.price * h.lastChangePct,
    0,
  );
  return weighted / total;
}
