import type { AssetKind, GameState } from "../sim/types.ts";
import type { Runtime } from "../game/runtime.ts";
import { netWorthCents, holdingsValueCents } from "../sim/engine.ts";
import { prosperityOf, tierNameForProsperity } from "../sim/city.ts";
import { ASSET_DEFS, defsForKind } from "../sim/market.ts";
import { touchMove, isTouchDevice } from "../game/input.ts";
import { money, pct } from "./format.ts";

// Interfaz RPG superpuesta sobre el mundo:
//  - Barra de estado: ORO (efectivo) + patrimonio + nivel de ciudad.
//  - INVENTARIO: tus activos como items (acciones y bonos).
//  - COMERCIO: al acercarte a la Bolsa o al Banco, aparece "Entrar"; dentro
//    compras/vendes los activos de ese comercio.
//
// WorldScene avisa la cercania a un comercio (setNearShop) y abre el comercio
// (openShop) desde la tecla E o el boton tactil.

const TRADE_SIZE = 5;

export interface HudApi {
  openShop(kind: AssetKind): void;
  setNearShop(shop: { kind: AssetKind; name: string } | null): void;
}

export function mountHud(root: HTMLElement, runtime: Runtime, playerId = "p1"): HudApi {
  // --- Barra de estado (arriba izquierda) ---
  const statusBar = el(root, "div", {
    position: "fixed",
    top: "12px",
    left: "12px",
    display: "flex",
    gap: "12px",
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

  // --- Boton Inventario (arriba derecha) ---
  const bagBtn = btn(root, "🎒 Inventario", {
    position: "fixed",
    top: "12px",
    right: "12px",
    zIndex: "30",
  });

  // --- Boton Entrar (aparece cerca de un comercio) ---
  const enterBtn = btn(root, "", {
    position: "fixed",
    bottom: "104px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "none",
    background: "#3fae57",
    fontSize: "16px",
    padding: "12px 22px",
    zIndex: "35",
  });

  // --- Ventanas (inventario y comercio) ---
  const invWin = makeWindow(root, "🎒 Inventario");
  const shopWin = makeWindow(root, "");

  let invOpen = false;
  let shopKind: AssetKind | null = null;
  let nearShop: { kind: AssetKind; name: string } | null = null;

  function refreshInv(open: boolean) {
    invOpen = open;
    invWin.root.style.transform = open ? "translateX(0)" : "translateX(110%)";
    if (open) {
      shopKind = null;
      shopWin.root.style.transform = "translateX(110%)";
    }
    render(runtime.getState());
  }
  function openShopWin(kind: AssetKind | null) {
    shopKind = kind;
    shopWin.title.textContent = kind === "stock" ? "📈 Bolsa de Valores" : kind === "bond" ? "🏦 Banco de Bonos" : "";
    shopWin.root.style.transform = kind ? "translateX(0)" : "translateX(110%)";
    if (kind) {
      invOpen = false;
      invWin.root.style.transform = "translateX(110%)";
    }
    render(runtime.getState());
  }

  bagBtn.onclick = () => refreshInv(!invOpen);
  invWin.close.onclick = () => refreshInv(false);
  shopWin.close.onclick = () => openShopWin(null);
  enterBtn.onclick = () => nearShop && openShopWin(nearShop.kind);

  window.addEventListener("keydown", (e) => {
    if (e.key === "i" || e.key === "I") refreshInv(!invOpen);
    if (e.key === "Escape") {
      if (shopKind) openShopWin(null);
      else if (invOpen) refreshInv(false);
    }
  });

  function order(id: string, type: "BUY" | "SELL", shares = TRADE_SIZE) {
    runtime.send({ type, playerId, stockId: id, shares });
  }

  // Tarjeta de un activo dentro de un comercio (con comprar/vender).
  function shopCard(state: GameState, id: string): string {
    const def = ASSET_DEFS.find((d) => d.id === id)!;
    const stock = state.stocks[id];
    const player = state.players[playerId];
    const h = player.holdings[id];
    const shares = h?.shares ?? 0;
    const change = stock.history.length > 1 ? stock.priceCents / stock.history[stock.history.length - 2] - 1 : 0;
    const canBuy = player.cashCents >= stock.priceCents * TRADE_SIZE;
    return `
      <div style="border:1px solid #26325c;border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#101a38">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div><b>${def.id}</b> <span style="color:#8092c0;font-size:12px">${def.name}</span></div>
          <div style="text-align:right">
            <div>${money(stock.priceCents)}</div>
            <div style="font-size:12px;color:${change >= 0 ? "#5ee08a" : "#ff6b81"}">${pct(change)}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="font-size:12px;color:#9fb0dd">Tienes ${shares}</span>
          <div style="display:flex;gap:6px">
            <button data-buy="${id}" ${canBuy ? "" : "disabled"} style="cursor:pointer;border:0;border-radius:6px;padding:7px 14px;background:${canBuy ? "#2f6bff" : "#33406b"};color:#fff;font-weight:700">Comprar ${TRADE_SIZE}</button>
            <button data-sell="${id}" ${shares > 0 ? "" : "disabled"} style="cursor:pointer;border:0;border-radius:6px;padding:7px 14px;background:${shares > 0 ? "#26325c" : "#1b2440"};color:#dfe6ff;font-weight:700">Vender ${TRADE_SIZE}</button>
          </div>
        </div>
      </div>`;
  }

  // Item del inventario (un activo que posees).
  function invItem(state: GameState, id: string): string {
    const def = ASSET_DEFS.find((d) => d.id === id)!;
    const stock = state.stocks[id];
    const h = state.players[playerId].holdings[id]!;
    const value = h.shares * stock.priceCents;
    const pl = (stock.priceCents - h.avgCostCents) * h.shares;
    const icon = def.kind === "stock" ? "📈" : "🏦";
    return `
      <div style="display:flex;gap:10px;align-items:center;border:1px solid #26325c;border-radius:10px;padding:10px;margin-bottom:8px;background:#101a38">
        <div style="width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;background:#1a2445;border-radius:8px;font-size:20px">${icon}</div>
        <div style="flex:1;min-width:0">
          <div><b>${def.id}</b> <span style="color:#8092c0;font-size:12px">${def.kind === "stock" ? "Accion" : "Bono"}</span></div>
          <div style="font-size:12px;color:#9fb0dd">${h.shares} u · vale ${money(value)} · <span style="color:${pl >= 0 ? "#5ee08a" : "#ff6b81"}">${pl >= 0 ? "+" : ""}${money(pl)}</span></div>
        </div>
        <button data-sell="${id}" style="cursor:pointer;border:0;border-radius:6px;padding:7px 12px;background:#26325c;color:#dfe6ff;font-weight:700">Vender ${TRADE_SIZE}</button>
      </div>`;
  }

  function wire(container: HTMLElement) {
    container.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => {
      b.onclick = () => order(b.dataset.buy!, "BUY");
    });
    container.querySelectorAll<HTMLButtonElement>("[data-sell]").forEach((b) => {
      b.onclick = () => order(b.dataset.sell!, "SELL");
    });
  }

  function render(state: GameState) {
    const player = state.players[playerId];
    const net = netWorthCents(state, playerId);
    const prosperity = prosperityOf(state, playerId);
    const tier = tierNameForProsperity(prosperity);

    statusBar.innerHTML = `
      <span style="display:flex;gap:6px;align-items:center"><span style="font-size:17px">💰</span><b style="color:#ffe08a;font-size:16px">${money(player.cashCents)}</b></span>
      <span style="opacity:.35">|</span>
      <span style="color:#9fb0dd;font-size:12px">Patrimonio <b style="color:#eaf0ff;font-size:14px">${money(net)}</b></span>
      <span style="opacity:.35">|</span>
      <span style="color:#8fb2ff">🏛️ ${tier}</span>`;

    if (invOpen) {
      const ids = Object.keys(player.holdings).filter((id) => player.holdings[id].shares > 0);
      const invested = holdingsValueCents(state, playerId);
      invWin.body.innerHTML =
        `<div style="font-size:12px;color:#9fb0dd;margin-bottom:12px">Valor invertido: <b style="color:#eaf0ff">${money(invested)}</b> · Efectivo: <b style="color:#ffe08a">${money(player.cashCents)}</b></div>` +
        (ids.length
          ? ids.map((id) => invItem(state, id)).join("")
          : `<div style="color:#8092c0;padding:20px 4px">No tienes activos. Ve a la <b>Bolsa</b> o al <b>Banco</b> y compra algo.</div>`);
      wire(invWin.body);
    }

    if (shopKind) {
      const ids = defsForKind(shopKind).map((d) => d.id);
      shopWin.body.innerHTML =
        `<div style="font-size:13px;color:#ffe08a;margin-bottom:12px">💰 Tu oro: <b>${money(player.cashCents)}</b></div>` +
        ids.map((id) => shopCard(state, id)).join("");
      wire(shopWin.body);
    }
  }

  // --- Cercania a comercios y joystick ---
  const api: HudApi = {
    openShop: (kind) => openShopWin(kind),
    setNearShop: (shop) => {
      nearShop = shop;
      if (shop && !shopKind) {
        enterBtn.style.display = "block";
        enterBtn.textContent = `Entrar a ${shop.name}  ▸`;
      } else {
        enterBtn.style.display = "none";
      }
    },
  };

  if (isTouchDevice()) mountJoystick(root);
  runtime.subscribe(render);
  return api;
}

// Ventana deslizante con cabecera + boton cerrar.
function makeWindow(root: HTMLElement, titleText: string) {
  const win = el(root, "div", {
    position: "fixed",
    top: "0",
    right: "0",
    width: "360px",
    maxWidth: "92vw",
    height: "100%",
    overflowY: "auto",
    padding: "16px",
    background: "rgba(12,18,40,.96)",
    borderLeft: "1px solid #22315a",
    color: "#dfe6ff",
    font: "14px system-ui, sans-serif",
    transform: "translateX(110%)",
    transition: "transform .22s ease",
    zIndex: "40",
    backdropFilter: "blur(3px)",
  });
  const header = el(win, "div", {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  });
  const title = el(header, "div", { font: "700 18px system-ui, sans-serif" });
  title.textContent = titleText;
  const close = btn(header, "✕", { padding: "6px 12px", background: "#26325c" });
  const body = el(win, "div", {});
  return { root: win, title, close, body };
}

// Joystick virtual para movil.
function mountJoystick(root: HTMLElement) {
  const R = 56;
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
    zIndex: "34",
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
  });
  let active = false;
  const rect = () => base.getBoundingClientRect();
  function move(cx: number, cy: number) {
    const r = rect();
    let dx = cx - (r.left + R);
    let dy = cy - (r.top + R);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchMove.x = dx / R;
    touchMove.y = dy / R;
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

// --- helpers de DOM ---
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

function btn(parent: HTMLElement, text: string, styles: Partial<CSSStyleDeclaration> | Record<string, string>) {
  const b = el(parent, "button", {
    border: "0",
    borderRadius: "10px",
    background: "#2f6bff",
    color: "#fff",
    font: "700 14px system-ui, sans-serif",
    padding: "9px 16px",
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(0,0,0,.35)",
    ...styles,
  });
  b.textContent = text;
  return b;
}
