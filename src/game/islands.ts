// Definicion de islas (mapas). El mundo es un archipielago: la Isla Central
// (tu pueblo, que crece con tu patrimonio) rodeada de agua, con puentes a
// cuatro islas segun el punto cardinal. Cada isla pide cierto NIVEL para entrar.

export type Dir = "n" | "s" | "e" | "w";
export const OPP: Record<Dir, Dir> = { n: "s", s: "n", e: "w", w: "e" };

export interface IslandDef {
  id: string;
  name: string;
  klass: "central" | "baja" | "media" | "alta" | "puerto";
  requiredLevel: number;
  /** Tinte del cesped (multiplica la textura) para dar clima a cada isla. */
  grassTint: number;
  /** Set de edificios (para las islas satelite, que son fijas). */
  buildings: string[];
  /** Cantidad fija de edificios (islas satelite). */
  fixed: number;
  /** Salidas: direccion -> id de la isla destino. */
  exits: Partial<Record<Dir, string>>;
}

export const ISLANDS: Record<string, IslandDef> = {
  central: {
    id: "central",
    name: "Isla Central",
    klass: "central",
    requiredLevel: 1,
    grassTint: 0xffffff,
    buildings: [],
    fixed: 0,
    exits: { w: "baja", n: "media", e: "alta", s: "puerto" },
  },
  baja: {
    id: "baja",
    name: "Villa Obrera",
    klass: "baja",
    requiredLevel: 2,
    grassTint: 0xcabf86, // pasto seco
    buildings: ["b_rancho", "b_hut"],
    fixed: 11,
    exits: { e: "central" },
  },
  puerto: {
    id: "puerto",
    name: "El Puerto",
    klass: "puerto",
    requiredLevel: 3,
    grassTint: 0xdccf92, // arenoso
    buildings: ["b_house", "b_almacen", "b_rancho"],
    fixed: 10,
    exits: { n: "central" },
  },
  media: {
    id: "media",
    name: "Barrio Medio",
    klass: "media",
    requiredLevel: 4,
    grassTint: 0xbfe0a0, // verde parejo
    buildings: ["b_house", "b_rancho"],
    fixed: 14,
    exits: { s: "central" },
  },
  alta: {
    id: "alta",
    name: "Barrio Norte",
    klass: "alta",
    requiredLevel: 6,
    grassTint: 0xd6ffdc, // verde cuidado
    buildings: ["b_tower", "b_house", "b_castle"],
    fixed: 12,
    exits: { w: "central" },
  },
};

export function islandById(id: string): IslandDef {
  return ISLANDS[id] ?? ISLANDS.central;
}
