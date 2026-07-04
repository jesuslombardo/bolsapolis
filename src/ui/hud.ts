import type { AssetKind, GameState } from "../sim/types.ts";
import type { Runtime } from "../game/runtime.ts";
import { netWorthCents, holdingsValueCents } from "../sim/engine.ts";
import { prosperityOf, tierNameForProsperity } from "../sim/city.ts";
import { levelOf } from "../sim/progress.ts";
import { ASSET_DEFS, defsForKind } from "../sim/market.ts";
import { touchMove, touchAttack, isTouchDevice } from "../game/input.ts";
import { sfx } from "../game/audio.ts";
import { clearSave } from "../game/save.ts";
import { logout } from "../game/account.ts";
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

function kindLabel(kind: AssetKind): string {
  return kind === "stock" ? "Accion" : kind === "bond" ? "Bono" : "Materia prima";
}

export interface HudApi {
  openShop(kind: AssetKind): void;
  setNearShop(shop: { kind: AssetKind; name: string } | null): void;
  toast(msg: string, kind?: "info" | "good" | "bad"): void;
  /** Barra de animo (HP mental) del heroe: fraccion [0..1]. */
  setAnimo(frac: number): void;
}

export function mountHud(
  root: HTMLElement,
  runtime: Runtime,
  playerId = "p1",
  profileName = "Tu",
  accountEmail = "",
): HudApi {
  const narrow = window.matchMedia("(max-width: 640px)").matches;
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

  // --- Botones (arriba derecha): Misiones + Inventario ---
  // En pantallas chicas van compactos (solo icono) para no pisar la barra.
  const bagBtn = btn(root, narrow ? "🎒" : "🎒 Inventario", {
    position: "fixed",
    top: "12px",
    right: "12px",
    zIndex: "30",
  });
  const missionsBtn = btn(root, narrow ? "🎯" : "🎯 Misiones", {
    position: "fixed",
    top: "12px",
    right: narrow ? "62px" : "160px",
    background: "#26325c",
    zIndex: "30",
  });

  // --- Barra de noticias de mercado (bajo la barra de estado) ---
  const newsBar = el(root, "div", {
    position: "fixed",
    top: "76px",
    left: "12px",
    maxWidth: "70vw",
    display: "none",
    padding: "6px 12px",
    background: "rgba(40,20,52,.8)",
    border: "1px solid #6a3a63",
    borderRadius: "8px",
    color: "#ffd9f0",
    font: "600 12px system-ui, sans-serif",
    zIndex: "20",
    pointerEvents: "none",
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

  // --- Ventanas (inventario, comercio, misiones) ---
  const invWin = makeWindow(root, "🎒 Inventario");
  const shopWin = makeWindow(root, "");
  const missionsWin = makeWindow(root, "🎯 Misiones");

  // --- Barra de animo (HP): debajo de la barra de estado ---
  const animoWrap = el(root, "div", {
    position: "fixed",
    top: "58px",
    left: "12px",
    width: "150px",
    height: "10px",
    background: "rgba(10,16,32,.72)",
    border: "1px solid #2a3a63",
    borderRadius: "999px",
    overflow: "hidden",
    zIndex: "20",
    pointerEvents: "none",
  });
  const animoBar = el(animoWrap, "div", {
    width: "100%",
    height: "100%",
    background: "linear-gradient(90deg,#ff8a5a,#ffd23a)",
    borderRadius: "999px",
    transition: "width .18s",
  });
  function setAnimo(frac: number) {
    animoBar.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + "%";
    animoBar.style.background = frac > 0.4 ? "linear-gradient(90deg,#ff8a5a,#ffd23a)" : "linear-gradient(90deg,#d23b3b,#ff6b6b)";
  }

  // --- Boton de ataque tactil (movil): abajo a la derecha ---
  if (isTouchDevice()) {
    const atk = el(root, "button", {
      position: "fixed",
      right: "26px",
      bottom: "34px",
      width: "84px",
      height: "84px",
      borderRadius: "50%",
      border: "2px solid rgba(255,150,150,.6)",
      background: "rgba(180,40,50,.75)",
      color: "#fff",
      fontSize: "34px",
      zIndex: "34",
      touchAction: "none",
      userSelect: "none",
    }) as HTMLButtonElement;
    atk.textContent = "⚔️";
    atk.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      touchAttack.pressed = true;
    });
  }

  // Contenedor de avisos (toasts).
  const toastHost = el(root, "div", {
    position: "fixed",
    top: "62px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    alignItems: "center",
    zIndex: "50",
    pointerEvents: "none",
  });
  function toast(msg: string, kind: "info" | "good" | "bad" = "info") {
    const bg = kind === "good" ? "#2f8f4e" : kind === "bad" ? "#a23b4a" : "#26325c";
    const t = el(toastHost, "div", {
      padding: "8px 16px",
      background: bg,
      color: "#fff",
      borderRadius: "999px",
      font: "600 13px system-ui, sans-serif",
      boxShadow: "0 4px 14px rgba(0,0,0,.4)",
      opacity: "0",
      transition: "opacity .18s, transform .18s",
      transform: "translateY(-6px)",
    });
    t.textContent = msg;
    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 220);
    }, 1700);
  }

  let invOpen = false;
  let missionsOpen = false;
  let shopKind: AssetKind | null = null;
  let nearShop: { kind: AssetKind; name: string } | null = null;
  let qty: number | "max" = TRADE_SIZE; // cantidad por operacion en el comercio
  let detailId: string | null = null; // activo cuya ficha se esta viendo

  // --- Misiones ---
  const ownsKind = (state: GameState, kind: AssetKind) => {
    const p = state.players[playerId];
    return Object.keys(p.holdings).some(
      (id) => p.holdings[id].shares > 0 && ASSET_DEFS.find((d) => d.id === id)?.kind === kind,
    );
  };
  const tierIndex = (state: GameState) => Math.min(5, Math.floor(prosperityOf(state, playerId) * 6));
  const MISSIONS: Array<{ id: string; label: string; done: (s: GameState) => boolean }> = [
    { id: "stock", label: "Compra tu primera accion (Bolsa)", done: (s) => ownsKind(s, "stock") },
    { id: "bond", label: "Proba un bono (Banco)", done: (s) => ownsKind(s, "bond") },
    { id: "commodity", label: "Compra dolar, soja u oro (Almacen)", done: (s) => ownsKind(s, "commodity") },
    { id: "savings", label: "Guarda plata en la Caja de Ahorro", done: (s) => s.players[playerId].savingsCents > 0 },
    { id: "pueblo", label: "Haces crecer tu pueblo a Pueblo", done: (s) => tierIndex(s) >= 1 },
    { id: "w150", label: "Junta $150.000 (Nivel 2)", done: (s) => netWorthCents(s, playerId) >= 15_000_000 },
    { id: "ciudad", label: "Llega a Ciudad", done: (s) => tierIndex(s) >= 3 },
    { id: "w500", label: "Junta $500.000 de patrimonio", done: (s) => netWorthCents(s, playerId) >= 50_000_000 },
    { id: "millon", label: "Llega a $1.000.000 (¡millonario!)", done: (s) => netWorthCents(s, playerId) >= 100_000_000 },
    { id: "capital", label: "Converti tu pueblo en Capital", done: (s) => tierIndex(s) >= 5 },
  ];
  const missionsDone = new Set<string>();
  let missionsSeeded = false;

  // --- Noticias de mercado ---
  let lastEventHeadline = "";
  let eventSeeded = false;

  function closeAll() {
    invOpen = false;
    missionsOpen = false;
    shopKind = null;
    detailId = null;
    invWin.root.style.transform = "translateX(110%)";
    missionsWin.root.style.transform = "translateX(110%)";
    shopWin.root.style.transform = "translateX(110%)";
  }
  function refreshInv(open: boolean) {
    closeAll();
    invOpen = open;
    invWin.root.style.transform = open ? "translateX(0)" : "translateX(110%)";
    render(runtime.getState());
  }
  function refreshMissions(open: boolean) {
    closeAll();
    missionsOpen = open;
    missionsWin.root.style.transform = open ? "translateX(0)" : "translateX(110%)";
    render(runtime.getState());
  }
  const shopTitle: Record<AssetKind, string> = {
    stock: "📈 Bolsa de Valores",
    bond: "🏦 Banco de Bonos",
    commodity: "🏬 Almacen de Ramos",
  };
  const shopGreet: Record<AssetKind, string> = {
    stock: "Mercader: —¿Qué hacés, campeón? Pasá a invertir.",
    bond: "Banquero: —Bienvenido. Su plata, segura acá.",
    commodity: "Almacenero: —Pasá, pasá. Dólar, soja u oro, lo que precises.",
  };
  function openShopWin(kind: AssetKind | null) {
    const greet = kind && kind !== shopKind;
    closeAll();
    shopKind = kind;
    shopWin.title.textContent = kind ? shopTitle[kind] : "";
    shopWin.root.style.transform = kind ? "translateX(0)" : "translateX(110%)";
    if (kind && greet) {
      sfx.talk();
      toast(shopGreet[kind], "info");
    }
    render(runtime.getState());
  }

  bagBtn.onclick = () => refreshInv(!invOpen);
  missionsBtn.onclick = () => refreshMissions(!missionsOpen);
  invWin.close.onclick = () => refreshInv(false);
  missionsWin.close.onclick = () => refreshMissions(false);
  shopWin.close.onclick = () => openShopWin(null);
  enterBtn.onclick = () => nearShop && openShopWin(nearShop.kind);

  window.addEventListener("keydown", (e) => {
    if (e.key === "i" || e.key === "I") refreshInv(!invOpen);
    if (e.key === "m" || e.key === "M") refreshMissions(!missionsOpen);
    if (e.key === "Escape") {
      if (detailId) {
        detailId = null;
        render(runtime.getState());
      } else if (shopKind) openShopWin(null);
      else if (invOpen) refreshInv(false);
      else if (missionsOpen) refreshMissions(false);
    }
  });

  function order(id: string, type: "BUY" | "SELL") {
    const state = runtime.getState();
    const price = state.stocks[id].priceCents;
    const owned = state.players[playerId].holdings[id]?.shares ?? 0;
    let shares: number;
    if (type === "BUY") {
      shares = qty === "max" ? Math.floor(state.players[playerId].cashCents / price) : qty;
    } else {
      shares = qty === "max" ? owned : Math.min(qty, owned);
    }
    if (shares <= 0) {
      sfx.deny();
      toast(type === "BUY" ? "Sin oro suficiente" : "No tienes para vender", "bad");
      return;
    }
    const before = state.players[playerId].cashCents;
    runtime.send({ type, playerId, stockId: id, shares });
    const after = runtime.getState().players[playerId].cashCents;
    if (after === before) {
      sfx.deny();
      toast("Sin oro suficiente", "bad");
      return;
    }
    if (type === "BUY") {
      sfx.buy();
      toast(`Compraste ${shares} ${id}`, "good");
    } else {
      sfx.sell();
      toast(`Vendiste ${shares} ${id}`, "good");
    }
  }

  // Deposito / retiro en la caja de ahorro del Banco.
  function bank(type: "DEPOSIT" | "WITHDRAW", amountCents: number | "max") {
    const state = runtime.getState();
    const p = state.players[playerId];
    const amount = amountCents === "max" ? (type === "DEPOSIT" ? p.cashCents : p.savingsCents) : amountCents;
    if (amount <= 0) {
      sfx.deny();
      return;
    }
    runtime.send({ type, playerId, amountCents: amount });
    sfx.coin();
    toast(type === "DEPOSIT" ? `Depositaste ${money(amount)}` : `Retiraste ${money(amount)}`, "good");
  }

  // Tarjeta de un activo dentro de un comercio (con comprar/vender).
  function shopCard(state: GameState, id: string): string {
    const def = ASSET_DEFS.find((d) => d.id === id)!;
    const stock = state.stocks[id];
    const player = state.players[playerId];
    const h = player.holdings[id];
    const shares = h?.shares ?? 0;
    const change = stock.history.length > 1 ? stock.priceCents / stock.history[stock.history.length - 2] - 1 : 0;
    const canBuy = player.cashCents >= stock.priceCents;
    const qtyLabel = qty === "max" ? "" : ` ${qty}`;
    return `
      <div style="border:1px solid #26325c;border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#101a38">
        <div data-info="${id}" style="cursor:pointer;display:flex;justify-content:space-between;align-items:baseline">
          <div style="display:flex;gap:8px;align-items:baseline"><span style="font-size:17px">${def.emoji}</span><span><b>${def.name}</b> <span style="color:#8092c0;font-size:11px">${def.id} · ${def.sector} ℹ️</span></span></div>
          <div style="text-align:right">
            <div>${money(stock.priceCents)}</div>
            <div style="font-size:12px;color:${change >= 0 ? "#5ee08a" : "#ff6b81"}">${pct(change)}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="font-size:12px;color:#9fb0dd">Tienes ${shares}</span>
          <div style="display:flex;gap:6px">
            <button data-buy="${id}" ${canBuy ? "" : "disabled"} style="cursor:pointer;border:0;border-radius:6px;padding:7px 14px;background:${canBuy ? "#2f6bff" : "#33406b"};color:#fff;font-weight:700">Comprar${qtyLabel}</button>
            <button data-sell="${id}" ${shares > 0 ? "" : "disabled"} style="cursor:pointer;border:0;border-radius:6px;padding:7px 14px;background:${shares > 0 ? "#26325c" : "#1b2440"};color:#dfe6ff;font-weight:700">Vender${qtyLabel}</button>
          </div>
        </div>
      </div>`;
  }

  // Selector de cantidad (x1 / x5 / x25 / Máx).
  function qtySelector(): string {
    const opts: Array<[string, number | "max"]> = [["x1", 1], ["x5", 5], ["x25", 25], ["Máx", "max"]];
    return `
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <span style="font-size:12px;color:#9fb0dd;align-self:center;margin-right:2px">Cantidad:</span>
        ${opts
          .map(
            ([lbl, v]) =>
              `<button data-qty="${v}" style="cursor:pointer;border:0;border-radius:6px;padding:6px 12px;font-weight:700;background:${qty === v ? "#2f6bff" : "#26325c"};color:#fff">${lbl}</button>`,
          )
          .join("")}
      </div>`;
  }

  // Panel de la caja de ahorro (solo en el Banco).
  function savingsPanel(state: GameState): string {
    const p = state.players[playerId];
    return `
      <div style="border:1px solid #3a5a3f;border-radius:10px;padding:12px;margin-bottom:14px;background:#0f2417">
        <div style="font-weight:700;margin-bottom:4px">🏦 Caja de Ahorro</div>
        <div style="font-size:12px;color:#9fb0dd;margin-bottom:2px">Guardado: <b style="color:#7ee0a1">${money(p.savingsCents)}</b></div>
        <div style="font-size:11px;color:#6b8f76;margin-bottom:10px">Gana interes solo, cada segundo.</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button data-dep="100000" style="cursor:pointer;border:0;border-radius:6px;padding:7px 12px;font-weight:700;background:#2f8f4e;color:#fff">Depositar 1000</button>
          <button data-dep="max" style="cursor:pointer;border:0;border-radius:6px;padding:7px 12px;font-weight:700;background:#2f8f4e;color:#fff">Depositar todo</button>
          <button data-wit="max" style="cursor:pointer;border:0;border-radius:6px;padding:7px 12px;font-weight:700;background:#26325c;color:#fff">Retirar todo</button>
        </div>
      </div>`;
  }

  // Item del inventario (un activo que posees). Clic en la ficha -> detalle.
  function invItem(state: GameState, id: string): string {
    const def = ASSET_DEFS.find((d) => d.id === id)!;
    const stock = state.stocks[id];
    const h = state.players[playerId].holdings[id]!;
    const value = h.shares * stock.priceCents;
    const pl = (stock.priceCents - h.avgCostCents) * h.shares;
    return `
      <div style="display:flex;gap:10px;align-items:center;border:1px solid #26325c;border-radius:10px;padding:10px;margin-bottom:8px;background:#101a38">
        <div data-info="${id}" style="cursor:pointer;display:flex;gap:10px;align-items:center;flex:1;min-width:0">
          <div style="width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;background:#1a2445;border-radius:8px;font-size:20px">${def.emoji}</div>
          <div style="flex:1;min-width:0">
            <div><b>${def.name}</b> <span style="color:#8092c0;font-size:11px">${def.id} · ${def.sector} ℹ️</span></div>
            <div style="font-size:12px;color:#9fb0dd">${h.shares} u · ${money(value)} · <span style="color:${pl >= 0 ? "#5ee08a" : "#ff6b81"}">${pl >= 0 ? "+" : ""}${money(pl)}</span></div>
          </div>
        </div>
        <button data-sell="${id}" style="cursor:pointer;border:0;border-radius:6px;padding:7px 12px;background:#26325c;color:#dfe6ff;font-weight:700">Vender${qty === "max" ? "" : ` ${qty}`}</button>
      </div>`;
  }

  // Mini grafico de la evolucion reciente del precio (SVG).
  function sparkline(history: number[]): string {
    const h = history.slice(-40);
    if (h.length < 2) return "";
    const min = Math.min(...h);
    const max = Math.max(...h);
    const w = 300;
    const ht = 46;
    const span = max - min || 1;
    const pts = h
      .map((v, i) => `${((i / (h.length - 1)) * w).toFixed(1)},${(ht - ((v - min) / span) * (ht - 4) - 2).toFixed(1)}`)
      .join(" ");
    const up = h[h.length - 1] >= h[0];
    const color = up ? "#5ee08a" : "#ff6b81";
    return `<svg viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none" style="width:100%;height:46px;display:block;margin:8px 0">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>
    </svg>`;
  }

  // Ficha de detalle de un activo: descripcion + como gana plata + operar.
  function detailView(state: GameState, id: string): string {
    const def = ASSET_DEFS.find((d) => d.id === id)!;
    const stock = state.stocks[id];
    const player = state.players[playerId];
    const h = player.holdings[id];
    const shares = h?.shares ?? 0;
    const value = shares * stock.priceCents;
    const pl = h ? (stock.priceCents - h.avgCostCents) * h.shares : 0;
    const change = stock.history.length > 1 ? stock.priceCents / stock.history[stock.history.length - 2] - 1 : 0;
    const canBuy = player.cashCents >= stock.priceCents;
    const qtyLabel = qty === "max" ? "" : ` ${qty}`;
    return `
      <button data-back="1" style="cursor:pointer;border:0;background:none;color:#8fb2ff;font:700 14px system-ui;padding:0 0 10px">‹ Volver</button>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px">
        <div style="width:52px;height:52px;flex:0 0 52px;display:grid;place-items:center;background:#1a2445;border-radius:12px;font-size:30px">${def.emoji}</div>
        <div>
          <div style="font:700 18px system-ui">${def.name}</div>
          <div style="font-size:12px;color:#8fb2ff">${def.id} · ${def.sector} · ${kindLabel(def.kind)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px">
        <div style="font:700 22px system-ui">${money(stock.priceCents)}</div>
        <div style="color:${change >= 0 ? "#5ee08a" : "#ff6b81"};font-weight:700">${pct(change)}</div>
      </div>
      ${sparkline(stock.history)}
      <div style="background:#101a38;border:1px solid #26325c;border-radius:10px;padding:12px;margin:6px 0 12px">
        <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#8fb2ff;margin-bottom:6px">Como gana plata</div>
        <div style="font-size:13px;color:#cdd8f5;line-height:1.5">${def.blurb}</div>
      </div>
      <div style="font-size:13px;color:#9fb0dd;margin-bottom:10px">Tienes <b style="color:#eaf0ff">${shares}</b>${
        shares > 0
          ? ` · vale <b style="color:#eaf0ff">${money(value)}</b> · <span style="color:${pl >= 0 ? "#5ee08a" : "#ff6b81"}">${pl >= 0 ? "+" : ""}${money(pl)}</span>`
          : ""
      }</div>
      ${qtySelector()}
      <div style="display:flex;gap:8px">
        <button data-buy="${id}" ${canBuy ? "" : "disabled"} style="flex:1;cursor:pointer;border:0;border-radius:8px;padding:11px;background:${canBuy ? "#2f6bff" : "#33406b"};color:#fff;font-weight:700">Comprar${qtyLabel}</button>
        <button data-sell="${id}" ${shares > 0 ? "" : "disabled"} style="flex:1;cursor:pointer;border:0;border-radius:8px;padding:11px;background:${shares > 0 ? "#26325c" : "#1b2440"};color:#dfe6ff;font-weight:700">Vender${qtyLabel}</button>
      </div>`;
  }

  function wire(container: HTMLElement) {
    container.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => {
      b.onclick = () => order(b.dataset.buy!, "BUY");
    });
    container.querySelectorAll<HTMLButtonElement>("[data-sell]").forEach((b) => {
      b.onclick = () => order(b.dataset.sell!, "SELL");
    });
    container.querySelectorAll<HTMLButtonElement>("[data-qty]").forEach((b) => {
      b.onclick = () => {
        const v = b.dataset.qty!;
        qty = v === "max" ? "max" : Number(v);
        render(runtime.getState());
      };
    });
    container.querySelectorAll<HTMLButtonElement>("[data-dep]").forEach((b) => {
      b.onclick = () => bank("DEPOSIT", b.dataset.dep === "max" ? "max" : Number(b.dataset.dep));
    });
    container.querySelectorAll<HTMLButtonElement>("[data-wit]").forEach((b) => {
      b.onclick = () => bank("WITHDRAW", b.dataset.wit === "max" ? "max" : Number(b.dataset.wit));
    });
    container.querySelectorAll<HTMLElement>("[data-info]").forEach((n) => {
      n.onclick = () => {
        detailId = n.dataset.info!;
        render(runtime.getState());
      };
    });
    container.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((b) => {
      b.onclick = () => {
        detailId = null;
        render(runtime.getState());
      };
    });
    container.querySelectorAll<HTMLButtonElement>("[data-reset]").forEach((b) => {
      b.onclick = () => {
        if (confirm("¿Reiniciar la partida? Se perdera el progreso guardado de este personaje.")) {
          if (accountEmail) clearSave(accountEmail);
          location.reload();
        }
      };
    });
    container.querySelectorAll<HTMLButtonElement>("[data-logout]").forEach((b) => {
      b.onclick = () => {
        logout();
        location.reload();
      };
    });
  }

  let lastTier = "";
  let lastLevel = 0;
  function render(state: GameState) {
    const player = state.players[playerId];
    const prosperity = prosperityOf(state, playerId);
    const tier = tierNameForProsperity(prosperity);
    const level = levelOf(state, playerId);

    // Subida de nivel de la ciudad: aviso + sonido.
    if (lastTier && tier !== lastTier) {
      sfx.levelup();
      toast(`¡Tu ciudad crecio a ${tier}!`, "good");
    }
    lastTier = tier;

    // Subida de NIVEL del jugador.
    if (lastLevel && level > lastLevel) {
      sfx.levelup();
      toast(`⭐ ¡Subiste a Nivel ${level}!`, "good");
    }
    lastLevel = level;

    // Noticias de mercado: barra + aviso cuando aparece una nueva.
    const headline = state.event?.headline ?? "";
    if (headline) {
      newsBar.style.display = "block";
      newsBar.textContent = "📰 " + headline;
    } else {
      newsBar.style.display = "none";
    }
    if (eventSeeded && headline && headline !== lastEventHeadline) {
      const good = (state.event?.drift ?? 0) >= 0;
      sfx.talk();
      toast("📰 " + headline, good ? "good" : "bad");
    }
    lastEventHeadline = headline;
    eventSeeded = true;

    // Misiones: detecta las recien completadas (aviso + sonido).
    for (const m of MISSIONS) {
      const done = m.done(state);
      if (done && !missionsDone.has(m.id)) {
        missionsDone.add(m.id);
        if (missionsSeeded) {
          sfx.coin();
          toast(`🎯 Mision cumplida: ${m.label}`, "good");
        }
      }
    }
    missionsSeeded = true;

    if (missionsOpen) {
      const doneN = MISSIONS.filter((m) => missionsDone.has(m.id)).length;
      missionsWin.body.innerHTML =
        `<div style="font-size:13px;color:#9fb0dd;margin-bottom:12px">Progreso: <b style="color:#eaf0ff">${doneN}/${MISSIONS.length}</b></div>` +
        MISSIONS.map((m) => {
          const done = missionsDone.has(m.id);
          return `<div style="display:flex;gap:10px;align-items:center;border:1px solid ${done ? "#2f6b3f" : "#26325c"};border-radius:10px;padding:10px;margin-bottom:8px;background:${done ? "#0f2417" : "#101a38"}">
            <span style="font-size:18px">${done ? "✅" : "⬜"}</span>
            <span style="flex:1;color:${done ? "#a7e6bd" : "#dfe6ff"}">${m.label}</span>
          </div>`;
        }).join("") +
        `<div style="display:flex;gap:8px;margin-top:14px">
          <button data-logout="1" style="flex:1;cursor:pointer;border:1px solid #33406b;border-radius:8px;padding:10px;background:#1b2440;color:#dfe6ff;font-weight:700">🚪 Cerrar sesión</button>
          <button data-reset="1" style="flex:1;cursor:pointer;border:1px solid #6a3140;border-radius:8px;padding:10px;background:#2a1620;color:#ffb3c0;font-weight:700">🔄 Reiniciar</button>
        </div>`;
      wire(missionsWin.body);
    }

    statusBar.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:1px">
        <div style="display:flex;gap:6px;align-items:center"><span style="font-size:17px">💰</span><b style="color:#ffe08a;font-size:17px">${money(player.cashCents)}</b></div>
        <div style="font-size:11px;color:#9fb0dd">👤 ${profileName} · <span style="color:#8fb2ff">Nivel ${level}</span> · <span style="color:#62d0ff">✨ ${player.xp ?? 0} XP</span></div>
      </div>`;

    if (invOpen) {
      if (detailId) {
        invWin.body.innerHTML = detailView(state, detailId);
      } else {
        const ids = Object.keys(player.holdings).filter((id) => player.holdings[id].shares > 0);
        const invested = holdingsValueCents(state, playerId);
        invWin.body.innerHTML =
          `<div style="font-size:12px;color:#9fb0dd;margin-bottom:10px">Invertido: <b style="color:#eaf0ff">${money(invested)}</b> · Ahorro: <b style="color:#7ee0a1">${money(player.savingsCents)}</b> · Efectivo: <b style="color:#ffe08a">${money(player.cashCents)}</b></div>` +
          `<div style="font-size:11px;color:#6b7bab;margin-bottom:10px">Toca un activo para ver su ficha ℹ️</div>` +
          (ids.length ? qtySelector() : "") +
          (ids.length
            ? ids.map((id) => invItem(state, id)).join("")
            : `<div style="color:#8092c0;padding:20px 4px">No tienes activos. Ve a la <b>Bolsa</b> o al <b>Banco</b> y compra algo.</div>`);
      }
      wire(invWin.body);
    }

    if (shopKind) {
      if (detailId) {
        shopWin.body.innerHTML = detailView(state, detailId);
      } else {
        const ids = defsForKind(shopKind).map((d) => d.id);
        shopWin.body.innerHTML =
          `<div style="font-size:13px;color:#ffe08a;margin-bottom:12px">💰 Tu plata: <b>${money(player.cashCents)}</b></div>` +
          (shopKind === "bond" ? savingsPanel(state) : "") +
          `<div style="font-size:11px;color:#6b7bab;margin-bottom:10px">Toca un activo para ver su ficha ℹ️</div>` +
          qtySelector() +
          ids.map((id) => shopCard(state, id)).join("");
      }
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
    toast: (msg, kind) => toast(msg, kind),
    setAnimo,
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
