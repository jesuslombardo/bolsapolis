import type { StockDef } from "./types.ts";

// Catalogo de activos. Empresas y bonos FICTICIOS con sabor argento
// (no representan companias reales). Cada uno cuenta como gana plata.
//
// Acciones: volatiles, potencial de subida alto (se compran en la Bolsa).
export const STOCK_DEFS: StockDef[] = [
  {
    id: "NUBE",
    name: "Nubosur",
    kind: "stock",
    sector: "Tecnologia",
    emoji: "💻",
    blurb:
      "Empresa de software y servicios en la nube. Le alquila a otras companias sus sistemas y cobra una suscripcion todos los meses. Cuantos mas clientes suma, mas gana.",
    startPriceCents: 12000,
    drift: 0.0006,
    volatility: 0.028,
  },
  {
    id: "GRANO",
    name: "Molinos del Plata",
    kind: "stock",
    sector: "Agro",
    emoji: "🌾",
    blurb:
      "Le compra trigo y maiz al campo, lo muele y vende harina y aceite al pais y al exterior. Gana con la diferencia entre lo que paga por el grano y lo que cobra por el producto.",
    startPriceCents: 4500,
    drift: 0.0002,
    volatility: 0.014,
  },
  {
    id: "VOLT",
    name: "Energia Comahue",
    kind: "stock",
    sector: "Energia",
    emoji: "⚡",
    blurb:
      "Saca gas y petroleo del sur y genera electricidad. Gana vendiendole energia a las fabricas y a los hogares, y exportando lo que sobra.",
    startPriceCents: 8800,
    drift: 0.0004,
    volatility: 0.035,
  },
  {
    id: "LADRI",
    name: "Ladrillos Pampa",
    kind: "stock",
    sector: "Construccion",
    emoji: "🧱",
    blurb:
      "Fabrica ladrillos, cemento y materiales. Gana plata cuando se construye: casas, edificios, rutas y obra publica. Si hay obra, vuela.",
    startPriceCents: 6200,
    drift: 0.0003,
    volatility: 0.02,
  },
  {
    id: "META",
    name: "Aceros Riachuelo",
    kind: "stock",
    sector: "Industria",
    emoji: "🏭",
    blurb:
      "Funde metal y fabrica acero y chapa para autos, maquinas y electrodomesticos. Gana vendiendole a la industria; le va bien cuando la economia produce.",
    startPriceCents: 15500,
    drift: 0.0005,
    volatility: 0.03,
  },
];

// Bonos: renta fija. Baja volatilidad y deriva pequenya y estable (cupon).
// Son el activo "seguro" (se compran en el Banco).
export const BOND_DEFS: StockDef[] = [
  {
    id: "BONOR",
    name: "Bono del Tesoro",
    kind: "bond",
    sector: "Deuda del Estado",
    emoji: "🏛️",
    blurb:
      "Le prestas plata al Estado y este te devuelve con un interes fijo. Es de los mas seguros: casi no se mueve, pero rinde poquito.",
    startPriceCents: 10000,
    drift: 0.0004,
    volatility: 0.003,
  },
  {
    id: "BONOC",
    name: "Obligacion Negociable",
    kind: "bond",
    sector: "Deuda de empresa",
    emoji: "🏢",
    blurb:
      "Le prestas plata a una empresa grande y te paga un interes. Rinde mas que el bono del Estado, pero tiene un poquito mas de riesgo.",
    startPriceCents: 7000,
    drift: 0.0006,
    volatility: 0.008,
  },
  {
    id: "LETRA",
    name: "Letra a Corto",
    kind: "bond",
    sector: "Deuda corta",
    emoji: "🧾",
    blurb:
      "Un prestamo cortito al Estado, a pocos meses. Muy estable, ideal para guardar el valor de tu plata sin sobresaltos.",
    startPriceCents: 5000,
    drift: 0.00035,
    volatility: 0.0018,
  },
];

// Materias primas: se compran en el Almacen de Ramos Generales.
export const COMMODITY_DEFS: StockDef[] = [
  {
    id: "DOLAR",
    name: "Dolar",
    kind: "commodity",
    sector: "Dolar",
    emoji: "💵",
    blurb:
      "La divisa. Refugio clasico del argentino: cuando el peso se devalua, el dolar sube. Sirve para no perder valor.",
    startPriceCents: 100000,
    drift: 0.0007,
    volatility: 0.01,
  },
  {
    id: "SOJA",
    name: "Soja",
    kind: "commodity",
    sector: "Agro",
    emoji: "🌱",
    blurb:
      "El yuyito que mueve al pais. Su precio depende del clima y de la demanda mundial. Le pega el mismo clima que al agro.",
    startPriceCents: 42000,
    drift: 0.0004,
    volatility: 0.02,
  },
  {
    id: "ORO",
    name: "Oro",
    kind: "commodity",
    sector: "Metales",
    emoji: "🥇",
    blurb:
      "Refugio universal. Cuando hay incertidumbre, todos corren al oro y sube. Estable y brillante.",
    startPriceCents: 250000,
    drift: 0.0005,
    volatility: 0.012,
  },
];

// Todos los activos negociables.
export const ASSET_DEFS: StockDef[] = [...STOCK_DEFS, ...BOND_DEFS, ...COMMODITY_DEFS];

export function defsForKind(kind: "stock" | "bond" | "commodity"): StockDef[] {
  return ASSET_DEFS.filter((d) => d.kind === kind);
}

export function defById(id: string): StockDef | undefined {
  return ASSET_DEFS.find((d) => d.id === id);
}

// Pool de noticias de mercado. Cada una sacude un sector (positivo o negativo)
// durante un rato. Los tickers y sectores coinciden con los de arriba.
export const MARKET_EVENTS: Array<{ headline: string; sector: string; drift: number }> = [
  { sector: "Agro", drift: 0.006, headline: "🌾 Gran cosecha: vuela el agro" },
  { sector: "Agro", drift: -0.006, headline: "☀️ Sequia: cae el agro" },
  { sector: "Energia", drift: 0.007, headline: "🛢️ Sube el petroleo: energia en alza" },
  { sector: "Energia", drift: -0.006, headline: "🔌 Menos demanda: energia floja" },
  { sector: "Tecnologia", drift: 0.008, headline: "💻 Boom tecnologico" },
  { sector: "Tecnologia", drift: -0.006, headline: "📉 Se pincha la tecno" },
  { sector: "Construccion", drift: 0.006, headline: "🏗️ Obra publica: repunta la construccion" },
  { sector: "Construccion", drift: -0.006, headline: "🧱 Freno a la obra: cae construccion" },
  { sector: "Industria", drift: 0.006, headline: "🏭 Repunta la industria" },
  { sector: "Dolar", drift: 0.01, headline: "💵 Salta el dolar" },
  { sector: "Dolar", drift: -0.006, headline: "💵 Se calma el dolar" },
  { sector: "Metales", drift: 0.007, headline: "🥇 Vuelo del oro" },
];
