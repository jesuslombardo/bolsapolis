import type { Command, GameState } from "../sim/types.ts";
import { applyCommand, createInitialState, tick } from "../sim/engine.ts";

// Runtime del cliente. Envuelve la simulacion pura y expone una interfaz
// estable (subscribe / send / getState). Hoy avanza el mercado localmente;
// manyana esta misma interfaz se implementa sobre un WebSocket contra el
// Durable Object, sin tocar el render ni la UI.
export interface Runtime {
  getState(): GameState;
  send(cmd: Command): void;
  subscribe(fn: (s: GameState) => void): () => void;
  start(): void;
  stop(): void;
}

export interface LocalRuntimeOpts {
  seed: number;
  /** Milisegundos entre ticks de mercado. */
  tickMs?: number;
  playerId?: string;
}

// El runtime local anyade un gancho de depuracion que no forma parte de la
// interfaz de red (Runtime), por eso se tipa aparte.
export interface LocalRuntime extends Runtime {
  /** Solo desarrollo: inyecta efectivo para probar los niveles de ciudad. */
  __debugGrantCash(cents: number): void;
}

export function createLocalRuntime(opts: LocalRuntimeOpts): LocalRuntime {
  const playerId = opts.playerId ?? "p1";
  const tickMs = opts.tickMs ?? 1000;
  let state = createInitialState(opts.seed, playerId);
  const listeners = new Set<(s: GameState) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  function emit() {
    for (const fn of listeners) fn(state);
  }

  return {
    getState: () => state,
    send(cmd) {
      state = applyCommand(state, cmd);
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },
    start() {
      if (timer) return;
      timer = setInterval(() => {
        state = tick(state);
        emit();
      }, tickMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    // Solo desarrollo: inyecta efectivo para probar los niveles de ciudad
    // sin operar durante minutos. No forma parte de la interfaz Runtime.
    __debugGrantCash(cents: number) {
      const p = state.players[playerId];
      if (!p) return;
      state = { ...state, players: { ...state.players, [playerId]: { ...p, cashCents: p.cashCents + cents } } };
      emit();
    },
  };
}
