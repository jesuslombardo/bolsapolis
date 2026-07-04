// Acceso a localStorage a prueba de fallos. En algunos entornos (iframes con
// sandbox estricto) localStorage puede lanzar excepciones o estar bloqueado;
// en ese caso usamos una copia en memoria para que el juego siga funcionando
// (aunque no persista entre recargas).

const mem: Record<string, string> = {};

export function lsGet(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : (mem[key] ?? null);
  } catch {
    return mem[key] ?? null;
  }
}

export function lsSet(key: string, value: string): void {
  mem[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* solo en memoria */
  }
}

export function lsRemove(key: string): void {
  delete mem[key];
  try {
    localStorage.removeItem(key);
  } catch {
    /* solo en memoria */
  }
}
