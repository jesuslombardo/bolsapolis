// Tipos compartidos entre la simulacion (autoridad) y el render (cliente).
// Mantener este archivo libre de dependencias de Phaser: es codigo puro que
// tambien correra en el servidor (Cloudflare Durable Object).

// Tipo de activo: accion (volatil), bono (renta fija) o materia prima
// (dolar, soja, oro; se compran en el Almacen).
export type AssetKind = "stock" | "bond" | "commodity";

export interface StockDef {
  id: string;
  name: string;
  kind: AssetKind;
  /** Rubro/sector (Agro, Energia, Tecnologia...). */
  sector: string;
  /** Icono del activo. */
  emoji: string;
  /** Como gana plata la empresa (o como paga el bono). */
  blurb: string;
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
  /** Oro en la caja de ahorro del Banco (genera interes cada tick). */
  savingsCents: number;
  holdings: Record<string, Holding>;
}

// Noticia de mercado activa: sacude un sector durante un rato.
export interface MarketEvent {
  headline: string;
  sector: string;
  /** Sesgo de deriva aplicado a los activos del sector mientras dura. */
  drift: number;
  /** Tick hasta el cual sigue vigente. */
  untilTick: number;
}

export interface GameState {
  tick: number;
  seed: number;
  stocks: Record<string, Stock>;
  players: Record<string, PlayerState>;
  /** Noticia de mercado vigente (o null). */
  event: MarketEvent | null;
}

export type Command =
  | { type: "BUY"; playerId: string; stockId: string; shares: number }
  | { type: "SELL"; playerId: string; stockId: string; shares: number }
  | { type: "DEPOSIT"; playerId: string; amountCents: number }
  | { type: "WITHDRAW"; playerId: string; amountCents: number };

export const HISTORY_LEN = 60;

// Interes de la caja de ahorro por tick (compuesto). Pequenyo pero visible.
export const SAVINGS_RATE = 0.0006;

// Noticias de mercado: cada cuanto puede aparecer una, y cuanto dura.
export const EVENT_PERIOD = 40;
export const EVENT_DURATION = 20;
