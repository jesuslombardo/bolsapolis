import { createGame } from "./game/config.js";
import type { VillageScene } from "./game/scenes/VillageScene.js";
import {
  seedPortfolio,
  tick,
  portfolioValue,
  portfolioChangePct,
  type MarketState,
} from "./sim/market.js";
import {
  newEmpire,
  stepPopulation,
  targetPopulation,
  unlockedBuildings,
  type EmpireState,
} from "./sim/empire.js";

// --- Estado del juego ------------------------------------------------------
let market: MarketState = seedPortfolio();
const empire: EmpireState = newEmpire();
let running = true;
const TICK_MS = 1400;

// --- Phaser ----------------------------------------------------------------
const game = createGame("game");

function scene(): VillageScene | undefined {
  return game.scene.getScene("village") as VillageScene | undefined;
}

// --- Bucle -----------------------------------------------------------------
function advanceDay() {
  market = tick(market);
  const target = targetPopulation(market);
  stepPopulation(empire, target);
  render();
}

// Converge la población hacia el objetivo aunque el mercado no haya cambiado
// (para que el crecimiento animado alcance el target entre día y día).
function settle() {
  if (empire.population !== empire.targetPopulation) {
    stepPopulation(empire, empire.targetPopulation);
    render();
  }
}

setInterval(() => running && advanceDay(), TICK_MS);
setInterval(() => running && settle(), TICK_MS / 4);

// --- Render (HUD + escena) -------------------------------------------------
const panel = document.getElementById("panel")!;
const ticker = document.getElementById("ticker")!;

function fmt(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function render() {
  const value = portfolioValue(market);
  const chg = portfolioChangePct(market);
  const buildings = unlockedBuildings(empire.population);

  scene()?.updateFromState(empire.population, buildings, chg);

  const chgClass = chg >= 0 ? "up" : "down";
  const chgSign = chg >= 0 ? "▲" : "▼";

  panel.innerHTML = `
    <div class="stat">
      <div class="label">Población del imperio</div>
      <div class="value">🧑‍🌾 ${fmt(empire.population)}</div>
    </div>
    <div class="stat">
      <div class="label">Valor del portafolio</div>
      <div class="value">$${fmt(value)}</div>
    </div>
    <div class="stat">
      <div class="label">Día · variación</div>
      <div class="value">Día ${market.day} <span class="chg ${chgClass}">${chgSign} ${Math.abs(chg).toFixed(2)}%</span></div>
    </div>
    <div class="label" style="margin-top:8px">Tus acciones</div>
    ${market.holdings
      .map((h) => {
        const c = h.lastChangePct >= 0 ? "up" : "down";
        const s = h.lastChangePct >= 0 ? "+" : "";
        return `<div class="holding">
          <span><span class="sym">${h.symbol}</span> · ${h.shares}</span>
          <span>$${h.price.toFixed(2)} <span class="chg ${c}">${s}${h.lastChangePct.toFixed(1)}%</span></span>
        </div>`;
      })
      .join("")}
    <button id="pause">${running ? "⏸ Pausar mercado" : "▶ Reanudar mercado"}</button>
    <button class="ghost" id="boom">💰 Inyectar capital (+30%)</button>
    <button class="ghost" id="crash">📉 Simular crash (−30%)</button>
  `;

  document.getElementById("pause")!.onclick = () => {
    running = !running;
    render();
  };
  document.getElementById("boom")!.onclick = () => shock(1.3);
  document.getElementById("crash")!.onclick = () => shock(0.7);

  const buildingList = buildings.map((b) => `${b.emoji} ${b.name}`).join("  ·  ") || "—";
  ticker.textContent = `🏗️ ${buildingList}    |    ${
    chg >= 0 ? "El imperio prospera" : "Tiempos difíciles en Bolsápolis"
  }`;
}

/** Empujón manual a todos los precios (botones de demo). */
function shock(mult: number) {
  market = {
    ...market,
    holdings: market.holdings.map((h) => ({
      ...h,
      price: Math.max(1, Math.round(h.price * mult * 100) / 100),
      lastChangePct: (mult - 1) * 100,
    })),
  };
  stepPopulation(empire, targetPopulation(market));
  render();
}

// Primer render cuando la escena esté lista.
game.events.once("ready", render);
