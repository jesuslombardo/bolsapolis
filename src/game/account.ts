// Sistema de cuentas LOCAL (en el navegador). No es seguridad real: sirve para
// tener perfil, personaje y partida por usuario. La autenticacion de verdad
// llegara con el servidor (multiplayer).

import { lsGet, lsSet, lsRemove } from "./storage.ts";

export interface Profile {
  email: string;
  name: string;
  hairColor: number;
}

interface Account extends Profile {
  passHash: string;
  createdAt: number;
}

const ACCTS_KEY = "bolsapolis.accounts";
const SESSION_KEY = "bolsapolis.session";

// Hash simple (djb2). NO es criptografico: solo evita guardar la clave en claro.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function readAccts(): Record<string, Account> {
  try {
    return JSON.parse(lsGet(ACCTS_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeAccts(a: Record<string, Account>) {
  try {
    lsSet(ACCTS_KEY, JSON.stringify(a));
  } catch {
    /* almacenamiento no disponible */
  }
}

function toProfile(a: Account): Profile {
  return { email: a.email, name: a.name, hairColor: a.hairColor };
}

type Result = { ok: true; profile: Profile } | { ok: false; error: string };

export function register(email: string, password: string, name: string, hairColor: number): Result {
  email = email.trim().toLowerCase();
  if (!email.includes("@") || email.length < 5) return { ok: false, error: "Poné un email válido" };
  if (password.length < 4) return { ok: false, error: "La contraseña necesita 4 o más caracteres" };
  if (!name.trim()) return { ok: false, error: "Poné un nombre para tu personaje" };
  const accts = readAccts();
  if (accts[email]) return { ok: false, error: "Ya existe una cuenta con ese email" };
  const acc: Account = { email, name: name.trim().slice(0, 20), hairColor, passHash: hash(password), createdAt: Date.now() };
  accts[email] = acc;
  writeAccts(accts);
  lsSet(SESSION_KEY, email);
  return { ok: true, profile: toProfile(acc) };
}

export function login(email: string, password: string): Result {
  email = email.trim().toLowerCase();
  const acc = readAccts()[email];
  if (!acc) return { ok: false, error: "No existe una cuenta con ese email" };
  if (acc.passHash !== hash(password)) return { ok: false, error: "Contraseña incorrecta" };
  lsSet(SESSION_KEY, email);
  return { ok: true, profile: toProfile(acc) };
}

export function logout() {
  try {
    lsRemove(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function currentProfile(): Profile | null {
  const email = lsGet(SESSION_KEY);
  if (!email) return null;
  const acc = readAccts()[email];
  return acc ? toProfile(acc) : null;
}

// Colores de pelo disponibles en la creacion de personaje.
export const HAIR_COLORS: Array<{ name: string; value: number }> = [
  { name: "Castaño", value: 0x6a3d1e },
  { name: "Rubio", value: 0xe8c34a },
  { name: "Negro", value: 0x1a1a22 },
  { name: "Colorado", value: 0xa8431c },
  { name: "Canoso", value: 0xb8bcc4 },
];
