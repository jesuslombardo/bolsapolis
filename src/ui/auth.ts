import { register, login, currentProfile, HAIR_COLORS, type Profile } from "../game/account.ts";

// Pantalla de entrada: ingresar o crear cuenta (con nombre y color de pelo).
// Llama a onReady(profile) cuando hay sesion lista.

export function mountAuth(root: HTMLElement, onReady: (p: Profile) => void) {
  // Si ya hay sesion abierta, entra directo.
  const existing = currentProfile();
  if (existing) {
    onReady(existing);
    return;
  }

  const overlay = el(root, "div", {
    position: "fixed",
    inset: "0",
    display: "grid",
    placeItems: "center",
    background: "radial-gradient(circle at 50% 30%, #1a2b1e, #0c140d 70%)",
    zIndex: "9999",
    padding: "16px",
    overflowY: "auto",
    fontFamily: "system-ui, sans-serif",
  });

  const card = el(overlay, "div", {
    width: "360px",
    maxWidth: "94vw",
    background: "rgba(14,20,40,.96)",
    border: "1px solid #2a3a63",
    borderRadius: "16px",
    padding: "22px",
    color: "#dfe6ff",
    boxShadow: "0 12px 40px rgba(0,0,0,.5)",
  });

  el(card, "div", {
    font: "800 26px system-ui",
    textAlign: "center",
    marginBottom: "2px",
  }).textContent = "🏛️ Bolsápolis";
  el(card, "div", {
    fontSize: "12px",
    textAlign: "center",
    color: "#8fb2ff",
    marginBottom: "16px",
  }).textContent = "Tu portafolio es tu imperio";

  // Pestanyas
  const tabs = el(card, "div", { display: "flex", gap: "8px", marginBottom: "16px" });
  const tabLogin = tabBtn(tabs, "Ingresar");
  const tabReg = tabBtn(tabs, "Crear cuenta");

  const body = el(card, "div", {});
  const errBox = el(card, "div", {
    color: "#ff9db0",
    fontSize: "13px",
    minHeight: "18px",
    marginTop: "10px",
    textAlign: "center",
  });

  let hair = HAIR_COLORS[1].value; // rubio por defecto para que se note

  function showErr(msg: string) {
    errBox.textContent = msg;
  }

  function setMode(m: "login" | "register") {
    showErr("");
    tabLogin.style.background = m === "login" ? "#2f6bff" : "#1b2440";
    tabReg.style.background = m === "register" ? "#2f6bff" : "#1b2440";
    body.innerHTML = "";
    if (m === "login") renderLogin();
    else renderRegister();
  }

  function field(label: string, type = "text", value = ""): HTMLInputElement {
    el(body, "label", { display: "block", fontSize: "12px", color: "#9fb0dd", margin: "10px 0 4px" }).textContent = label;
    const inp = el(body, "input", {
      width: "100%",
      padding: "11px 12px",
      borderRadius: "9px",
      border: "1px solid #2a3a63",
      background: "#0c142c",
      color: "#eaf0ff",
      font: "15px system-ui",
    }) as HTMLInputElement;
    inp.type = type;
    inp.value = value;
    inp.autocomplete = "off";
    return inp;
  }

  function primary(label: string): HTMLButtonElement {
    const b = el(body, "button", {
      width: "100%",
      marginTop: "16px",
      padding: "12px",
      borderRadius: "10px",
      border: "0",
      background: "#3fae57",
      color: "#fff",
      font: "800 16px system-ui",
      cursor: "pointer",
    }) as HTMLButtonElement;
    b.textContent = label;
    return b;
  }

  function finish(p: Profile) {
    overlay.remove();
    onReady(p);
  }

  function renderLogin() {
    const email = field("Email", "email");
    const pass = field("Contraseña", "password");
    const go = primary("Ingresar");
    const submit = () => {
      const r = login(email.value, pass.value);
      if (r.ok) finish(r.profile);
      else showErr(r.error);
    };
    go.onclick = submit;
    pass.onkeydown = (e) => e.key === "Enter" && submit();
  }

  function renderRegister() {
    const email = field("Email", "email");
    const pass = field("Contraseña (4+ caracteres)", "password");
    const name = field("Nombre de tu personaje");

    el(body, "label", { display: "block", fontSize: "12px", color: "#9fb0dd", margin: "14px 0 6px" }).textContent =
      "Color de pelo";
    const preview = makeAvatar(body, hair);
    const swatches = el(body, "div", { display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" });
    const chips: HTMLButtonElement[] = [];
    HAIR_COLORS.forEach((h) => {
      const chip = el(swatches, "button", {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 10px",
        borderRadius: "999px",
        border: hair === h.value ? "2px solid #8fb2ff" : "2px solid #2a3a63",
        background: "#0c142c",
        color: "#dfe6ff",
        cursor: "pointer",
        font: "600 12px system-ui",
      }) as HTMLButtonElement;
      const dot = el(chip, "span", {
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        background: "#" + h.value.toString(16).padStart(6, "0"),
        display: "inline-block",
      });
      dot.textContent = "";
      chip.append(document.createTextNode(h.name));
      chip.onclick = () => {
        hair = h.value;
        chips.forEach((c, i) => (c.style.border = HAIR_COLORS[i].value === hair ? "2px solid #8fb2ff" : "2px solid #2a3a63"));
        paintAvatar(preview, hair);
      };
      chips.push(chip);
    });

    const go = primary("Crear cuenta y jugar");
    go.onclick = () => {
      const r = register(email.value, pass.value, name.value, hair);
      if (r.ok) finish(r.profile);
      else showErr(r.error);
    };
  }

  setMode("register");
  tabLogin.onclick = () => setMode("login");
  tabReg.onclick = () => setMode("register");
}

// Avatar pixel simple (cara + pelo) para la vista previa.
function makeAvatar(parent: HTMLElement, hair: number): HTMLElement {
  const wrap = el(parent, "div", {
    width: "56px",
    height: "56px",
    borderRadius: "12px",
    background: "#0c142c",
    border: "1px solid #2a3a63",
    display: "grid",
    placeItems: "center",
  });
  const face = el(wrap, "div", {
    position: "relative",
    width: "30px",
    height: "34px",
  });
  const skin = el(face, "div", {
    position: "absolute",
    left: "3px",
    top: "8px",
    width: "24px",
    height: "24px",
    borderRadius: "6px",
    background: "#f0c39b",
  });
  skin.dataset.role = "skin";
  const top = el(face, "div", {
    position: "absolute",
    left: "0",
    top: "0",
    width: "30px",
    height: "14px",
    borderRadius: "8px 8px 4px 4px",
    background: "#" + hair.toString(16).padStart(6, "0"),
  });
  top.dataset.role = "hair";
  return wrap;
}
function paintAvatar(wrap: HTMLElement, hair: number) {
  const hairEl = wrap.querySelector<HTMLElement>('[data-role="hair"]');
  if (hairEl) hairEl.style.background = "#" + hair.toString(16).padStart(6, "0");
}

function tabBtn(parent: HTMLElement, label: string): HTMLButtonElement {
  const b = el(parent, "button", {
    flex: "1",
    padding: "9px",
    borderRadius: "9px",
    border: "0",
    background: "#1b2440",
    color: "#fff",
    font: "700 14px system-ui",
    cursor: "pointer",
  }) as HTMLButtonElement;
  b.textContent = label;
  return b;
}

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
