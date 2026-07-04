// Tipos compartidos entre la simulacion (autoridad) y el render (cliente).
// Mantener este archivo libre de dependencias de Phaser: es codigo puro que
// tambien correra en el servidor (Cloudflare Durable Object).

// Tipo de activo: accion (volatil) o bono (estable, tipo renta fija).
export type AssetKind = "stock" | "bond";

export interface StockDef {
  id: string;
  name: string;
  kind: AssetKind;
  /** Precio inicial en centimos para evitar errores de coma flotante. */
  startPriceCents: number;
  /** Deriva diaria (drift). Positiva = tiende a subir. */
  drift: number;
  /** Volatilidad: cuanto oscila por tick. */
  volatility: number;
}

export interface Stock {
  id: string;
  name: string;
  kind: AssetKind;
  priceCents: number;
  /** Historial reciente de precios (centimos) para dibujar el sparkline. */
  history: number[];
}

export interface Holding {
  shares: number;
  /** Coste medio de adquisicion en centimos, para calcular P&L. */
  avgCostCents: number;
}

export interface PlayerState {
  id: string;
  name: string;
  cashCents: number;
  holdings: Record<string, Holding>;
}

export interface GameState {
  tick: number;
  seed: number;
  stocks: Record<string, Stock>;
  players: Record<string, PlayerState>;
}

export type Command =
  | { type: "BUY"; playerId: string; stockId: string; shares: number }
  | { type: "SELL"; playerId: string; stockId: string; shares: number };

export const HISTORY_LEN = 60;
