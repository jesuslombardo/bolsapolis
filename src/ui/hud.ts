import type { GameState } from "../sim/types.ts";
import type { Runtime } from "../game/runtime.ts";
import { netWorthCents, holdingsValueCents } from "../sim/engine.ts";
import { STOCK_DEFS } from "../sim/market.ts";
import { money, pct } from "./format.ts";

// Panel de trading. DOM plano (sin framework) sobre un aside a la derecha.
// Lee el estado del runtime y envia ordenes BUY/SELL.

const TRADE_SIZE = 5; // acciones por click

export function mountHud(root: HTMLElement, runtime: Runtime, playerId = "p1") {
  const aside = document.createElement("aside");
  aside.id = "hud";
  aside.style.cssText = [
    "width:340px",
    "flex:0 0 340px",
    "height:100%",
    "overflow-y:auto",
    "padding:16px",
    "background:#0e1530",
    "border-left:1px solid #1c2547",
    "color:#dfe6ff",
    "font-family:system-ui,sans-serif",
  ].join(";");
  root.appendChild(aside);

  const summary = document.createElement("div");
  const list = document.createElement("div");
  aside.appendChild(summary);
  aside.appendChild(list);

  function order(stockId: string, type: "BUY" | "SELL") {
    runtime.send({ type, playerId, stockId, shares: TRADE_SIZE });
  }

  function render(state: GameState) {
    const player = state.players[playerId];
    const net = netWorthCents(state, playerId);
    const invested = holdingsValueCents(state, playerId);

    summary.innerHTML = `
      <div style="font-size:13px;letter-spacing:.08em;color:#8fb2ff;text-transform:uppercase">Patrimonio</div>
      <div style="font-size:30px;font-weight:700;margin:2px 0 10px">${money(net)}</div>
      <div style="display:flex;gap:16px;font-size:13px;color:#9fb0dd;margin-bottom:6px">
        <span>Efectivo<br><b style="color:#dfe6ff">${money(player.cashCents)}</b></span>
        <span>Invertido<br><b style="color:#dfe6ff">${money(invested)}</b></span>
        <span>Tick<br><b style="color:#dfe6ff">${state.tick}</b></span>
      </div>
      <div style="font-size:11px;color:#6b7bab;margin-bottom:14px">Cada operacion = ${TRADE_SIZE} acciones</div>
    `;

    list.innerHTML = STOCK_DEFS.map((def) => {
      const stock = state.stocks[def.id];
      const h = player.holdings[def.id];
      const shares = h?.shares ?? 0;
      const change =
        stock.history.length > 1
          ? stock.priceCents / stock.history[stock.history.length - 2] - 1
          : 0;
      const changeColor = change >= 0 ? "#5ee08a" : "#ff6b81";
      const pl = h ? (stock.priceCents - h.avgCostCents) * h.shares : 0;
      const plColor = pl >= 0 ? "#5ee08a" : "#ff6b81";
      return `
        <div style="border:1px solid #1c2547;border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#111a38">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div>
              <b>${def.id}</b>
              <span style="color:#8092c0;font-size:12px"> ${def.name}</span>
            </div>
            <div style="text-align:right">
              <div>${money(stock.priceCents)}</div>
              <div style="font-size:12px;color:${changeColor}">${pct(change)}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <div style="font-size:12px;color:#9fb0dd">
              ${shares} acc.${h ? ` · P&L <span style="color:${plColor}">${money(pl)}</span>` : ""}
            </div>
            <div style="display:flex;gap:6px">
              <button data-buy="${def.id}" style="cursor:pointer;border:0;border-radius:6px;padding:6px 12px;background:#2f6bff;color:#fff;font-weight:600">Comprar</button>
              <button data-sell="${def.id}" style="cursor:pointer;border:0;border-radius:6px;padding:6px 12px;background:#26325c;color:#dfe6ff;font-weight:600">Vender</button>
            </div>
          </div>
        </div>`;
    }).join("");

    list.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => {
      b.onclick = () => order(b.dataset.buy!, "BUY");
    });
    list.querySelectorAll<HTMLButtonElement>("[data-sell]").forEach((b) => {
      b.onclick = () => order(b.dataset.sell!, "SELL");
    });
  }

  runtime.subscribe(render);
}
