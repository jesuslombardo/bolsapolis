import type { StockDef } from "./types.ts";

// Catalogo de activos. Nombres ficticios para no simular empresas reales.
//
// Acciones: volatiles, potencial de subida alto (se compran en la Bolsa).
export const STOCK_DEFS: StockDef[] = [
  { id: "NUBE", name: "Nubex Cloud", kind: "stock", startPriceCents: 12000, drift: 0.0006, volatility: 0.028 },
  { id: "GRANO", name: "Granolith Agro", kind: "stock", startPriceCents: 4500, drift: 0.0002, volatility: 0.014 },
  { id: "VOLT", name: "Voltaia Energia", kind: "stock", startPriceCents: 8800, drift: 0.0004, volatility: 0.035 },
  { id: "LADRI", name: "Ladrillo & Co", kind: "stock", startPriceCents: 6200, drift: 0.0003, volatility: 0.02 },
  { id: "META", name: "Metalgama Ind", kind: "stock", startPriceCents: 15500, drift: 0.0005, volatility: 0.03 },
];

// Bonos: renta fija. Baja volatilidad y deriva pequenya y estable (cupon).
// Son el activo "seguro" (se compran en el Banco).
export const BOND_DEFS: StockDef[] = [
  { id: "BONOR", name: "Bono del Reino", kind: "bond", startPriceCents: 10000, drift: 0.0004, volatility: 0.003 },
  { id: "BONOC", name: "Bono Corporativo", kind: "bond", startPriceCents: 7000, drift: 0.0006, volatility: 0.008 },
  { id: "LETRA", name: "Letra a Corto", kind: "bond", startPriceCents: 5000, drift: 0.00035, volatility: 0.0018 },
];

// Todos los activos negociables.
export const ASSET_DEFS: StockDef[] = [...STOCK_DEFS, ...BOND_DEFS];

export function defsForKind(kind: "stock" | "bond"): StockDef[] {
  return ASSET_DEFS.filter((d) => d.kind === kind);
}
