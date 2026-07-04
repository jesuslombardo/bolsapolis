import type { GameState } from "../sim/types.ts";
import type { Runtime } from "../game/runtime.ts";
import { netWorthCents, holdingsValueCents } from "../sim/engine.ts";
import { prosperityOf, tierNameForProsperity } from "../sim/city.ts";
import { STOCK_DEFS } from "../sim/market.ts";
import { touchMove, isTouchDevice } from "../game/input.ts";
import { money, pct } from "./format.ts";

// Interfaz de juego (estilo RPG): superpuesta sobre el mundo, no en un panel
// fijo. Incluye:
//  - Barra de estado siempre visible (patrimonio + nivel de ciudad).
//  - Ventana de Bolsa OCULTABLE (boton, tecla B, o Esc).

const TRADE_SIZE = 5;

export function mountHud(root: HTMLElement, runtime: Runtime, playerId = "p1") {
  // --- Barra de estado (arriba izquierda, siempre visible) ---
  const statusBar = el(root, "div", {
    position: "fixed",
    top: "12px",
    left: "12px",
    display: "flex",
    gap: "10px",
    alignItems: "center",
    padding: "8px 14px",
    background: "rgba(10,16,32,.72)",
    border: "1px solid #2a3a63",
    borderRadius: "10px",
    color: "#eaf0ff",
    font: "600 14px system-ui, sans-serif",
    backdropFilter: "blur(4px)",
    pointerEvents: "none",
    zIndex: "20",
  });

  // --- Boton para abrir/cerrar la Bolsa (arriba derecha) ---
  const toggle = el(root, "button", {
    position: "fixed",
    top: "12px",
    right: "12px",
    padding: "9px 16px",
    background: "#2f6bff",
    color: "#fff",
    border: "0",
    borderRadius: "10px",
    font: "700 14px system-ui, sans-serif",
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(0,0,0,.35)",
    zIndex: "30",
  }) as HTMLButtonElement;

  // --- Panel de Bolsa (deslizante desde la derecha) ---
  const panel = el(root, "aside", {
    position: "fixed",
    top: "0",
    right: "0",
    width: "340px",
    maxWidth: "88vw",
    height: "100%",
    overflowY: "auto",
    padding: "58px 16px 16px",
    background: "rgba(12,18,40,.94)",
    borderLeft: "1px solid #22315a",
    color: "#dfe6ff",
    font: "14px system-ui, sans-serif",
    transition: "transform .22s ease",
    zIndex: "25",
    backdropFilter: "blur(3px)",
  });

  const summary = el(panel, "div", {});
  const list = el(panel, "div", {});

  const narrow = window.matchMedia("(max-width: 720px)").matches;
  let open = !narrow; // en el movil arranca cerrado para ver el mundo
  function setOpen(v: boolean) {
    open = v;
    panel.style.transform = open ? "translateX(0)" : "translateX(100%)";
    toggle.textContent = open ? "Cerrar Bolsa  ✕" : "Bolsa  📈";
  }
  setOpen(open);
  toggle.onclick = () => setOpen(!open);
  window.addEventListener("keydown", (e) => {
    if (e.key === "b" || e.key === "B") setOpen(!open);
    if (e.key === "Escape") setOpen(false);
  });

  // --- Joystick tactil (movil): mueve al personaje con el dedo ---
  if (isTouchDevice()) mountJoystick(root);

  function order(stockId: string, type: "BUY" | "SELL") {
    runtime.send({ type, playerId, stockId, shares: TRADE_SIZE });
  }

  function render(state: GameState) {
    const player = state.players[playerId];
    const net = netWorthCents(state, playerId);
    const invested = holdingsValueCents(state, playerId);
    const prosperity = prosperityOf(state, playerId);
    const tier = tierNameForProsperity(prosperity);

    statusBar.innerHTML = `
      <span style="font-size:16px">🏛️</span>
      <span style="color:#8fb2ff">${tier}</span>
      <span style="opacity:.5">·</span>
      <span>${money(net)}</span>`;

    summary.innerHTML = `
      <div style="font-size:12px;letter-spacing:.08em;color:#8fb2ff;text-transform:uppercase">Patrimonio</div>
      <div style="font-size:28px;font-weight:700;margin:2px 0 10px">${money(net)}</div>
      <div style="display:flex;gap:16px;font-size:13px;color:#9fb0dd;margin-bottom:6px">
        <span>Efectivo<br><b style="color:#dfe6ff">${money(player.cashCents)}</b></span>
        <span>Invertido<br><b style="color:#dfe6ff">${money(invested)}</b></span>
        <span>Tick<br><b style="color:#dfe6ff">${state.tick}</b></span>
      </div>
      <div style="font-size:11px;color:#6b7bab;margin-bottom:14px">Cada operacion = ${TRADE_SIZE} acciones · tecla B para abrir/cerrar</div>`;

    list.innerHTML = STOCK_DEFS.map((def) => {
      const stock = state.stocks[def.id];
      const h = player.holdings[def.id];
      const shares = h?.shares ?? 0;
      const change =
        stock.history.length > 1 ? stock.priceCents / stock.history[stock.history.length - 2] - 1 : 0;
      const changeColor = change >= 0 ? "#5ee08a" : "#ff6b81";
      const pl = h ? (stock.priceCents - h.avgCostCents) * h.shares : 0;
      const plColor = pl >= 0 ? "#5ee08a" : "#ff6b81";
      return `
        <div style="border:1px solid #1c2547;border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#111a38">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div><b>${def.id}</b><span style="color:#8092c0;font-size:12px"> ${def.name}</span></div>
            <div style="text-align:right">
              <div>${money(stock.priceCents)}</div>
              <div style="font-size:12px;color:${changeColor}">${pct(change)}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <div style="font-size:12px;color:#9fb0dd">${shares} acc.${h ? ` · P&L <span style="color:${plColor}">${money(pl)}</span>` : ""}</div>
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

// Joystick virtual: base fija abajo-izquierda con un knob arrastrable.
// Escribe el vector normalizado en touchMove, que WorldScene lee cada frame.
function mountJoystick(root: HTMLElement) {
  const R = 56; // radio de la base
  const base = el(root, "div", {
    position: "fixed",
    left: "22px",
    bottom: "26px",
    width: R * 2 + "px",
    height: R * 2 + "px",
    borderRadius: "50%",
    background: "rgba(10,16,32,.35)",
    border: "2px solid rgba(150,180,255,.5)",
    touchAction: "none",
    zIndex: "40",
    userSelect: "none",
  });
  const knob = el(base, "div", {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "52px",
    height: "52px",
    marginLeft: "-26px",
    marginTop: "-26px",
    borderRadius: "50%",
    background: "rgba(80,130,255,.85)",
    boxShadow: "0 2px 8px rgba(0,0,0,.4)",
    transition: "transform .05s",
  });

  let active = false;
  const rect = () => base.getBoundingClientRect();

  function move(clientX: number, clientY: number) {
    const r = rect();
    let dx = clientX - (r.left + R);
    let dy = clientY - (r.top + R);
    const d = Math.hypot(dx, dy);
    const max = R;
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchMove.x = dx / max;
    touchMove.y = dy / max;
  }
  function reset() {
    active = false;
    knob.style.transform = "translate(0px, 0px)";
    touchMove.x = 0;
    touchMove.y = 0;
  }

  base.addEventListener("pointerdown", (e) => {
    active = true;
    base.setPointerCapture(e.pointerId);
    move(e.clientX, e.clientY);
  });
  base.addEventListener("pointermove", (e) => {
    if (active) move(e.clientX, e.clientY);
  });
  base.addEventListener("pointerup", reset);
  base.addEventListener("pointercancel", reset);
  base.addEventListener("lostpointercapture", reset);
}

// Crea un elemento con estilos inline y lo agrega al padre.
function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  styles: Partial<CSSStyleDeclaration> | Record<string, string>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  parent.appendChild(node);
  return node;
}
