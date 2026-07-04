import { describe, it, expect } from "vitest";
import { createInitialState, tick, applyCommand, netWorthCents } from "./engine.ts";
import { prosperityOf, cityView } from "./city.ts";
import { levelOf } from "./progress.ts";

describe("motor de simulacion", () => {
  it("es determinista: misma seed -> mismos precios", () => {
    let a = createInitialState(42);
    let b = createInitialState(42);
    for (let i = 0; i < 100; i++) {
      a = tick(a);
      b = tick(b);
    }
    expect(a.stocks).toEqual(b.stocks);
  });

  it("seeds distintas producen mercados distintos", () => {
    let a = createInitialState(1);
    let b = createInitialState(2);
    for (let i = 0; i < 50; i++) {
      a = tick(a);
      b = tick(b);
    }
    expect(a.stocks.NUBE.priceCents).not.toEqual(b.stocks.NUBE.priceCents);
  });

  it("comprar descuenta efectivo y suma acciones", () => {
    const s0 = createInitialState(7);
    const price = s0.stocks.NUBE.priceCents;
    const s1 = applyCommand(s0, { type: "BUY", playerId: "p1", stockId: "NUBE", shares: 10 });
    expect(s1.players.p1.holdings.NUBE.shares).toBe(10);
    expect(s1.players.p1.cashCents).toBe(s0.players.p1.cashCents - price * 10);
  });

  it("no permite comprar sin fondos suficientes", () => {
    const s0 = createInitialState(7);
    const s1 = applyCommand(s0, { type: "BUY", playerId: "p1", stockId: "META", shares: 1_000_000 });
    expect(s1).toBe(s0); // estado sin cambios
  });

  it("no permite vender mas acciones de las que se tienen", () => {
    const s0 = applyCommand(createInitialState(7), {
      type: "BUY",
      playerId: "p1",
      stockId: "NUBE",
      shares: 5,
    });
    const s1 = applyCommand(s0, { type: "SELL", playerId: "p1", stockId: "NUBE", shares: 10 });
    expect(s1).toBe(s0);
  });

  it("el patrimonio no cambia al comprar (solo cambia su composicion)", () => {
    const s0 = createInitialState(7);
    const before = netWorthCents(s0, "p1");
    const s1 = applyCommand(s0, { type: "BUY", playerId: "p1", stockId: "VOLT", shares: 3 });
    expect(netWorthCents(s1, "p1")).toBe(before);
  });
});

describe("caja de ahorro", () => {
  it("depositar mueve efectivo a ahorro y no cambia el patrimonio", () => {
    const s0 = createInitialState(7);
    const net = netWorthCents(s0, "p1");
    const s1 = applyCommand(s0, { type: "DEPOSIT", playerId: "p1", amountCents: 100_000 });
    expect(s1.players.p1.savingsCents).toBe(100_000);
    expect(s1.players.p1.cashCents).toBe(s0.players.p1.cashCents - 100_000);
    expect(netWorthCents(s1, "p1")).toBe(net);
  });

  it("no permite depositar mas de lo que tienes en efectivo", () => {
    const s0 = createInitialState(7);
    const s1 = applyCommand(s0, { type: "DEPOSIT", playerId: "p1", amountCents: 99_999_999 });
    expect(s1.players.p1.savingsCents).toBe(s0.players.p1.cashCents);
    expect(s1.players.p1.cashCents).toBe(0);
  });

  it("el ahorro genera interes con el tiempo", () => {
    let s = applyCommand(createInitialState(7), { type: "DEPOSIT", playerId: "p1", amountCents: 1_000_000 });
    const start = s.players.p1.savingsCents;
    for (let i = 0; i < 50; i++) s = tick(s);
    expect(s.players.p1.savingsCents).toBeGreaterThan(start);
  });

  it("retirar devuelve el ahorro al efectivo", () => {
    let s = applyCommand(createInitialState(7), { type: "DEPOSIT", playerId: "p1", amountCents: 200_000 });
    s = applyCommand(s, { type: "WITHDRAW", playerId: "p1", amountCents: 50_000 });
    expect(s.players.p1.savingsCents).toBe(150_000);
  });
});

describe("ciudad", () => {
  it("la prosperidad crece con el patrimonio", () => {
    const s0 = createInitialState(7);
    const base = prosperityOf(s0, "p1");
    // Inyectamos efectivo comprando nada: subimos patrimonio via un estado ficticio.
    const rich = {
      ...s0,
      players: { p1: { ...s0.players.p1, cashCents: 200_000_000 } },
    };
    expect(prosperityOf(rich, "p1")).toBeGreaterThan(base);
  });

  it("mas patrimonio produce mas edificios", () => {
    const poor = createInitialState(7);
    const rich = { ...poor, players: { p1: { ...poor.players.p1, cashCents: 200_000_000 } } };
    expect(cityView(rich, "p1").buildings.length).toBeGreaterThan(
      cityView(poor, "p1").buildings.length,
    );
  });

  it("la prosperidad queda acotada en [0,1]", () => {
    const broke = createInitialState(7);
    const zero = { ...broke, players: { p1: { ...broke.players.p1, cashCents: 0, holdings: {} } } };
    expect(prosperityOf(zero, "p1")).toBeGreaterThanOrEqual(0);
    const loaded = { ...broke, players: { p1: { ...broke.players.p1, cashCents: 999_000_000 } } };
    expect(prosperityOf(loaded, "p1")).toBeLessThanOrEqual(1);
  });
});

describe("caza (loot, xp, quemadura)", () => {
  it("LOOT suma efectivo", () => {
    const s0 = createInitialState(7);
    const s1 = applyCommand(s0, { type: "LOOT", playerId: "p1", amountCents: 50_000 });
    expect(s1.players.p1.cashCents).toBe(s0.players.p1.cashCents + 50_000);
  });

  it("XP acumula experiencia", () => {
    let s = createInitialState(7);
    s = applyCommand(s, { type: "XP", playerId: "p1", amount: 10 });
    s = applyCommand(s, { type: "XP", playerId: "p1", amount: 45 });
    expect(s.players.p1.xp).toBe(55);
  });

  it("BURN quema efectivo pero nunca deja saldo negativo", () => {
    const s0 = createInitialState(7);
    const s1 = applyCommand(s0, { type: "BURN", playerId: "p1", amountCents: 100_000 });
    expect(s1.players.p1.cashCents).toBe(s0.players.p1.cashCents - 100_000);
    const s2 = applyCommand(s1, { type: "BURN", playerId: "p1", amountCents: 99_999_999_999 });
    expect(s2.players.p1.cashCents).toBe(0);
  });
});

describe("nivel", () => {
  it("empieza en nivel 1 y sube con el patrimonio", () => {
    const s0 = createInitialState(7);
    expect(levelOf(s0, "p1")).toBe(1);
    const rich = { ...s0, players: { p1: { ...s0.players.p1, cashCents: 100_000_000 } } };
    expect(levelOf(rich, "p1")).toBeGreaterThan(1);
  });
});
