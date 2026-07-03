import type { StockDef } from "./types.ts";

// Catalogo inicial de valores. Nombres ficticios para no simular empresas
// reales (eso vendria mas adelante con un feed de datos externo).
export const STOCK_DEFS: StockDef[] = [
  { id: "NUBE", name: "Nubex Cloud", startPriceCents: 12000, drift: 0.0006, volatility: 0.028 },
  { id: "GRANO", name: "Granolith Agro", startPriceCents: 4500, drift: 0.0002, volatility: 0.014 },
  { id: "VOLT", name: "Voltaia Energia", startPriceCents: 8800, drift: 0.0004, volatility: 0.035 },
  { id: "LADRI", name: "Ladrillo & Co", startPriceCents: 6200, drift: 0.0003, volatility: 0.02 },
  { id: "META", name: "Metalgama Ind", startPriceCents: 15500, drift: 0.0005, volatility: 0.03 },
];
