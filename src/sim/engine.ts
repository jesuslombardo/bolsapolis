import type { Command, GameState, Holding, MarketEvent, PlayerState, Stock } from "./types.ts";
import { HISTORY_LEN, SAVINGS_RATE, EVENT_PERIOD, EVENT_DURATION } from "./types.ts";
import { ASSET_DEFS, MARKET_EVENTS } from "./market.ts";
import { makeRng, gaussian } from "./rng.ts";

// Motor de simulacion PURO y determinista.
//   - createInitialState(seed) -> estado inicial reproducible.
//   - tick(state) -> avanza el mercado un paso (movimiento browniano geometrico).
//   - applyCommand(state, cmd) -> aplica una orden de compra/venta.
// Todas las funciones devuelven estado nuevo sin mutar el de entrada, de modo
// que el mismo codigo sirve como reducer autoritativo en el servidor y como
// prediccion optimista en el cliente.

const STARTING_CASH_CENTS = 10_000_000; // $100.000 (representan 100 mil dolares)

export function createInitialState(seed: number, playerId = "p1", playerName = "Tu"): GameState {
  const stocks: Record<string, Stock> = {};
  for (const def of ASSET_DEFS) {
    stocks[def.id] = {
      id: def.id,
      name: def.name,
      kind: def.kind,
      priceCents: def.startPriceCents,
      history: [def.startPriceCents],
    };
  }
  // Cartera inicial diversificada: parte del capital ya viene invertido para
  // que la ciudad reaccione al mercado desde el primer segundo (si esperas sin
  // hacer nada, igual la ves subir y bajar). El resto queda en efectivo.
  const seededHoldings: Array<[string, number]> = [
    ["GRANO", 200],
    ["LADRI", 150],
    ["BONOR", 60],
  ];
  const holdings: Record<string, Holding> = {};
  let spent = 0;
  for (const [id, shares] of seededHoldings) {
    const price = stocks[id].priceCents;
    holdings[id] = { shares, avgCostCents: price };
    spent += shares * price;
  }
  const player: PlayerState = {
    id: playerId,
    name: playerName,
    cashCents: STARTING_CASH_CENTS - spent,
    savingsCents: 0,
    holdings,
  };
  return { tick: 0, seed, stocks, players: { [playerId]: player }, event: null };
}

// Genera (de forma determinista) una noticia de mercado para este tick.
function rollEvent(seed: number, tick: number): MarketEvent {
  const rng = makeRng((seed ^ (tick * 0x27d4eb2f)) >>> 0);
  const e = MARKET_EVENTS[Math.floor(rng() * MARKET_EVENTS.length)];
  return { headline: e.headline, sector: e.sector, drift: e.drift, untilTick: tick + EVENT_DURATION };
}

// RNG derivado de (seed, tick, indice-del-valor). Al mezclar el tick, cada paso
// es reproducible de forma independiente: el servidor puede recalcular el
// precio del tick N sin haber ejecutado los N-1 anteriores.
function priceFor(seed: number, tick: number, stockIndex: number, prevCents: number, drift: number, volatility: number): number {
  const rng = makeRng((seed ^ (tick * 0x9e3779b1) ^ (stockIndex * 0x85ebca77)) >>> 0);
  const shock = gaussian(rng);
  const factor = Math.exp(drift - 0.5 * volatility * volatility + volatility * shock);
  const next = Math.round(prevCents * factor);
  return Math.max(1, next); // el precio nunca cae a cero
}

export function tick(state: GameState): GameState {
  const nextTick = state.tick + 1;

  // Noticia de mercado: mantiene la vigente o dispara una nueva cada tanto.
  let event = state.event && nextTick <= state.event.untilTick ? state.event : null;
  if (!event && nextTick % EVENT_PERIOD === 0) event = rollEvent(state.seed, nextTick);

  const stocks: Record<string, Stock> = {};
  ASSET_DEFS.forEach((def, i) => {
    const prev = state.stocks[def.id];
    // La noticia sesga la deriva (y sube un poco la volatilidad) del sector.
    const affected = event && event.sector === def.sector;
    const drift = def.drift + (affected ? event!.drift : 0);
    const vol = def.volatility * (affected ? 1.5 : 1);
    const priceCents = priceFor(state.seed, nextTick, i, prev.priceCents, drift, vol);
    const history = [...prev.history, priceCents];
    if (history.length > HISTORY_LEN) history.shift();
    stocks[def.id] = { ...prev, priceCents, history };
  });

  // Interes compuesto sobre la caja de ahorro de cada jugador.
  const players: Record<string, PlayerState> = {};
  for (const [id, p] of Object.entries(state.players)) {
    const interest = Math.floor(p.savingsCents * SAVINGS_RATE);
    players[id] = interest > 0 ? { ...p, savingsCents: p.savingsCents + interest } : p;
  }

  return { ...state, tick: nextTick, stocks, players, event };
}

export function applyCommand(state: GameState, cmd: Command): GameState {
  const player = state.players[cmd.playerId];
  if (!player) return state;

  // Caja de ahorro: mover oro entre efectivo y ahorro.
  if (cmd.type === "DEPOSIT" || cmd.type === "WITHDRAW") {
    const amount = Math.floor(cmd.amountCents);
    if (amount <= 0) return state;
    if (cmd.type === "DEPOSIT") {
      const moved = Math.min(amount, player.cashCents);
      if (moved <= 0) return state;
      const nextPlayer: PlayerState = {
        ...player,
        cashCents: player.cashCents - moved,
        savingsCents: player.savingsCents + moved,
      };
      return { ...state, players: { ...state.players, [cmd.playerId]: nextPlayer } };
    }
    const moved = Math.min(amount, player.savingsCents);
    if (moved <= 0) return state;
    const nextPlayer: PlayerState = {
      ...player,
      cashCents: player.cashCents + moved,
      savingsCents: player.savingsCents - moved,
    };
    return { ...state, players: { ...state.players, [cmd.playerId]: nextPlayer } };
  }

  const stock = state.stocks[cmd.stockId];
  if (!stock || cmd.shares <= 0) return state;
  const shares = Math.floor(cmd.shares);
  if (shares <= 0) return state;

  if (cmd.type === "BUY") {
    const costCents = shares * stock.priceCents;
    if (costCents > player.cashCents) return state; // fondos insuficientes
    const prev = player.holdings[cmd.stockId] ?? { shares: 0, avgCostCents: 0 };
    const totalShares = prev.shares + shares;
    const avgCostCents = Math.round((prev.avgCostCents * prev.shares + costCents) / totalShares);
    const nextPlayer: PlayerState = {
      ...player,
      cashCents: player.cashCents - costCents,
      holdings: { ...player.holdings, [cmd.stockId]: { shares: totalShares, avgCostCents } },
    };
    return { ...state, players: { ...state.players, [cmd.playerId]: nextPlayer } };
  }

  // SELL
  const prev = player.holdings[cmd.stockId];
  if (!prev || prev.shares < shares) return state; // no hay tantas acciones
  const proceedsCents = shares * stock.priceCents;
  const remaining = prev.shares - shares;
  const holdings = { ...player.holdings };
  if (remaining === 0) delete holdings[cmd.stockId];
  else holdings[cmd.stockId] = { shares: remaining, avgCostCents: prev.avgCostCents };
  const nextPlayer: PlayerState = {
    ...player,
    cashCents: player.cashCents + proceedsCents,
    holdings,
  };
  return { ...state, players: { ...state.players, [cmd.playerId]: nextPlayer } };
}

// --- Derivados (no mutan estado) -------------------------------------------

export function holdingsValueCents(state: GameState, playerId: string): number {
  const player = state.players[playerId];
  if (!player) return 0;
  let total = 0;
  for (const [stockId, h] of Object.entries(player.holdings)) {
    total += h.shares * state.stocks[stockId].priceCents;
  }
  return total;
}

export function netWorthCents(state: GameState, playerId: string): number {
  const player = state.players[playerId];
  if (!player) return 0;
  return player.cashCents + player.savingsCents + holdingsValueCents(state, playerId);
}
