// Formato de moneda a partir de centimos enteros.
const fmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(cents: number): string {
  return fmt.format(cents / 100) + " §";
}

export function pct(x: number): string {
  const s = (x * 100).toFixed(1);
  return (x >= 0 ? "+" : "") + s + "%";
}
