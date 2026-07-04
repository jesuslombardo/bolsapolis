import Phaser from "phaser";

// Sprites pixel-art generados por codigo (nada de assets externos: el juego
// sigue siendo un unico archivo). Estilo cenital tipo Argentum Online.
//
// Cada sprite se define como una rejilla de caracteres + una paleta. El
// caracter "." es transparente. Se renderiza pixel a pixel a una textura.

type Grid = string[];
type Palette = Record<string, number | null>;

function drawGrid(g: Phaser.GameObjects.Graphics, grid: Grid, palette: Palette) {
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = palette[row[x]];
      if (c == null) continue;
      g.fillStyle(c, 1);
      g.fillRect(x, y, 1, 1);
    }
  });
}

function makePixel(scene: Phaser.Scene, key: string, grid: Grid, palette: Palette) {
  if (scene.textures.exists(key)) return;
  const w = Math.max(...grid.map((r) => r.length));
  const h = grid.length;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  drawGrid(g, grid, palette);
  g.generateTexture(key, w, h);
  g.destroy();
}

// Textura de brillo radial para las lucecitas de la noche.
function makeGlow(scene: Phaser.Scene) {
  if (scene.textures.exists("glow")) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let r = 11; r >= 1; r--) {
    g.fillStyle(0xffffff, 0.09);
    g.fillCircle(11, 11, r);
  }
  g.generateTexture("glow", 22, 22);
  g.destroy();
}

// Tono verde con ruido determinista para el cesped.
function makeGrass(scene: Phaser.Scene, key: string, base: number, spec: number, seed: number) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(base, 1);
  g.fillRect(0, 0, 16, 16);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 14; i++) {
    g.fillStyle(spec, 1);
    g.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1);
  }
  g.generateTexture(key, 16, 16);
  g.destroy();
}

export function buildTextures(scene: Phaser.Scene, hairColor = 0x4a2f1c) {
  makeGlow(scene);
  // --- Suelos ---
  makeGrass(scene, "grass0", 0x3f7a34, 0x4c8c3d, 11);
  makeGrass(scene, "grass1", 0x3a7130, 0x356a2b, 23);
  makeGrass(scene, "grass2", 0x437f38, 0x53964a, 47);
  makeGrass(scene, "sand", 0xcbb277, 0xbda766, 5);

  const water: Palette = { W: 0x2f6dae, w: 0x3f80c4, ".": null };
  makePixel(scene, "water", [
    "WWWWWWWWWWWWWWWW",
    "WWwWWWWWWwWWWWWW",
    "WWWWWWwWWWWWWWWW",
    "WWWWWWWWWWWWWwWW",
    "WwWWWWWWWWwWWWWW",
    "WWWWWwWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
    "WWWWWWWWwWWWWWWW",
    "WWwWWWWWWWWWWwWW",
    "WWWWWWWWWWWWWWWW",
    "WWWWWWwWWWWwWWWW",
    "WWWWWWWWWWWWWWWW",
    "WwWWWWWWWWWWWWWW",
    "WWWWWWWWWwWWWWWW",
    "WWWWWwWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
  ], water);

  const path: Palette = { x: 0x9c8557, X: 0x8a744a, ".": null };
  makePixel(scene, "path", [
    "xxxxxxxxxxxxxxxx",
    "xxXxxxxxxxxXxxxx",
    "xxxxxxXxxxxxxxxx",
    "xxxxxxxxxxxxxXxx",
    "xXxxxxxxxxxxxxxx",
    "xxxxxXxxxxxxxxxx",
    "xxxxxxxxxxxxxxxx",
    "xxxxxxxxXxxxxxxx",
    "xxXxxxxxxxxxxXxx",
    "xxxxxxxxxxxxxxxx",
    "xxxxxxXxxxxXxxxx",
    "xxxxxxxxxxxxxxxx",
    "xXxxxxxxxxxxxxxx",
    "xxxxxxxxxXxxxxxx",
    "xxxxxXxxxxxxxxxx",
    "xxxxxxxxxxxxxxxx",
  ], path);

  // --- Arbol ---
  const tree: Palette = { t: 0x5a3b22, d: 0x2f5e2a, D: 0x24491f, l: 0x3f7d38, ".": null };
  makePixel(scene, "tree", [
    "....dddd....",
    "..dDdlldDd..",
    ".dDllllllDd.",
    ".dlllllllld.",
    "dDllllllllDd",
    "dlllldllllld",
    "dDllllllllDd",
    ".dllllllld..",
    ".dDdllldDd..",
    "...ddttdd...",
    ".....tt.....",
    ".....tt.....",
  ], tree);

  // --- Construcciones (medievales, de choza a castillo) ---
  const hut: Palette = { t: 0xc79a4c, T: 0xad8038, b: 0x7a4e2b, B: 0x5f3c20, k: 0x2a1a0e, ".": null };
  makePixel(scene, "b_hut", [
    "......TT......",
    ".....TttT.....",
    "....TttttT....",
    "...TttttttT...",
    "..TttttttttT..",
    ".TttttttttttT.",
    "TTTTTTTTTTTTTT",
    "..bBbbbbbbBb..",
    "..bbbkkkbbb b.",
    "..bBbk kbBb...",
    "..bbbk kbbb...",
    "..bBbkkkbBb...",
    "..bbbbbbbbb...",
  ], hut);

  const house: Palette = { r: 0xA23B2B, R: 0x832f22, s: 0x9aa0a8, S: 0x7c828c, w: 0x6fb7d6, k: 0x3a2a18, ".": null };
  makePixel(scene, "b_house", [
    "....rrrrrr....",
    "...rrrrrrrr...",
    "..rrrrrrrrrr..",
    ".rrrrrrrrrrrr.",
    "RRRRRRRRRRRRRR",
    ".sSsssssssSs..",
    ".swwSsssSwws..",
    ".swwSsssSwws..",
    ".sSsssssssSs..",
    ".sssskksssss..",
    ".sSsskksssSs..",
    ".sssskksssss..",
    ".ssssssssss...",
  ], house);

  const tower: Palette = { s: 0x9aa0a8, S: 0x7c828c, w: 0x37507a, f: 0xd23b3b, p: 0x6a4a2a, ".": null };
  makePixel(scene, "b_tower", [
    "....p.......",
    "....pff.....",
    "....pf......",
    "..SsSsSs....",
    "..s.ss.s....",
    "..ssssss....",
    "..sSwwSs....",
    "..ssssss....",
    "..sSssSs....",
    "..sswwss....",
    "..ssssss....",
    "..sSssSs....",
    "..sswwss....",
    "..ssssss....",
    "..ssSkss....",
    "..ssSkss....",
    "..ssskss....",
  ], tower);

  const castle: Palette = { s: 0x9aa0a8, S: 0x7c828c, w: 0x37507a, f: 0xd23b3b, k: 0x2a1a0e, p: 0x6a4a2a, ".": null };
  makePixel(scene, "b_castle", [
    "..p......p......p...",
    "..pf.....pf....pf...",
    "SsSs...SsSsSs..SsSs.",
    "s..s...s.ss.s..s..s.",
    "ssss...ssssss..ssss.",
    "sSws...sSwwSs..sSws.",
    "ssssSSSssssssSSSssss",
    "ssssssssssssssssssss",
    "sSwsssSwsssSwsssSwss",
    "ssssssssssssssssssss",
    "sssssssswwssssssssss",
    "sSwssssswwsssssSwsss",
    "sssssssskkssssssssss",
    "sssssssskkssssssssss",
    "sssssssskkssssssssss",
  ], castle);

  // --- Comercios (mas grandes y distintivos) ---
  // Bolsa: puesto de mercado con toldo a rayas y cartel.
  const bolsa: Palette = {
    a: 0xd23b3b, // toldo rojo
    A: 0xf0f0f0, // toldo blanco
    w: 0x6a4a2a, // madera
    W: 0x4e3620,
    s: 0xbfc6cf, // piedra clara
    g: 0xe8c34a, // cartel dorado
    k: 0x2a1a0e,
    ".": null,
  };
  makePixel(scene, "b_bolsa", [
    "....gggggggg....",
    "...gkgkgkgkgg...",
    "..aAaAaAaAaAaA..",
    ".aAaAaAaAaAaAaA.",
    "aAaAaAaAaAaAaAaA",
    "wWwwwwwwwwwwwwWw",
    "w.ssssssssss..Ww",
    "w.s.wwwwww.s..Ww",
    "w.s.w....w.s..Ww",
    "w.s.w....w.s..Ww",
    "wWssssssssssssWw",
    "wwwwwwwwwwwwwwww",
  ], bolsa);

  // Banco: edificio con columnas y moneda.
  const banco: Palette = {
    s: 0xcfd4da, // marmol
    S: 0xa9afb8,
    r: 0x3f5e8f, // techo azul
    R: 0x2f4870,
    g: 0xe8c34a, // moneda/oro
    k: 0x2a2a2a,
    ".": null,
  };
  makePixel(scene, "b_banco", [
    ".rrrrrrrrrrrr.",
    "rrrrrrrrrrrrrr",
    "RRRRRRRRRRRRRR",
    "s.g.ssssss.g.s",
    "s.g.ssssss.g.s",
    "sSsSsSsSsSsSsS",
    "s.s.s.gg.s.s.s",
    "s.s.s.gg.s.s.s",
    "s.s.s.gg.s.s.s",
    "sSsSsSsSsSsSsS",
    "ssssssssssssss",
  ], banco);

  // Almacen de Ramos Generales: casa con toldo verde y cartel.
  const almacen: Palette = {
    a: 0x2f8f4e, // toldo verde
    A: 0xe8f0e0, // franja clara
    w: 0x8a6a3a, // madera clara
    W: 0x6a4a2a,
    s: 0xd8c8a8, // pared clara
    g: 0xe8c34a, // cartel
    k: 0x2a1a0e,
    ".": null,
  };
  makePixel(scene, "b_almacen", [
    "...gggggggg...",
    "..gkgkgkgkgg..",
    ".aAaAaAaAaAaA.",
    "aAaAaAaAaAaAaA",
    "wWwwwwwwwwwwWw",
    "wssssssssssssw",
    "wsswwssswwsssw",
    "wssww sswwsssw",
    "wsswwssswwsssw",
    "wsssssssssss w",
    "wsssskksssss w",
    "wsssskkssssssw",
    "wwwwwwwwwwwwww",
  ], almacen);

  // Rancho (casa rural de adobe): mas variedad en el pueblo.
  const rancho: Palette = { t: 0xb98a4a, T: 0x9c7238, s: 0xc7a878, S: 0xa98a5c, k: 0x2a1a0e, ".": null };
  makePixel(scene, "b_rancho", [
    "..TTTTTTTT..",
    ".TttttttttT.",
    "TttttttttttT",
    "TTTTTTTTTTTT",
    ".ssssssssss.",
    ".sSssssssSs.",
    ".ssssssssss.",
    ".sssskkssss.",
    ".sSsskkssSs.",
    ".sssskkssss.",
    ".ssssssssss.",
  ], rancho);

  // --- Criaturas y loot ---
  // Deudita: rata de la deuda (bicho nivel 1).
  const rat: Palette = { f: 0x8a7462, F: 0x6e5a4a, e: 0xd23b3b, t: 0xc9a0a0, k: 0x2a1a0e, ".": null };
  makePixel(scene, "mob_deudita", [
    "..ff....",
    ".ffff.f.",
    "ffffffff",
    "fFeffFff",
    "ffffffft",
    ".fkfkf.t",
    "........",
  ], rat);

  // La Inflacion: llama que quema el efectivo.
  const flame: Palette = { r: 0xff5a2a, R: 0xd23b1c, y: 0xffd23a, Y: 0xffb020, k: 0x7a1a08, ".": null };
  makePixel(scene, "mob_inflacion", [
    "....r.....",
    "...rRr..r.",
    "..rRRRr.R.",
    ".rRyYyRrR.",
    ".RyYYYyRR.",
    ".RyYkYyRr.",
    ".RyYYYyR..",
    "..RyYyR...",
    "...RRR....",
  ], flame);

  // Moneda (loot fisico) y orbe de experiencia.
  const coin: Palette = { g: 0xe8c34a, G: 0xb8952e, w: 0xfff3c4, ".": null };
  makePixel(scene, "coin", [
    ".ggg.",
    "gwGgg",
    "gGgGg",
    "ggGgg",
    ".ggg.",
  ], coin);
  const orb: Palette = { b: 0x62d0ff, B: 0x2f8fd0, w: 0xeaffff, ".": null };
  makePixel(scene, "orb", [
    ".bbb.",
    "bwbBb",
    "bbbBb",
    "bBBBb",
    ".bbb.",
  ], orb);

  // Tajo del ataque del heroe.
  const slash: Palette = { w: 0xffffff, W: 0xcfe0ff, ".": null };
  makePixel(scene, "slash", [
    "...ww",
    "..wW.",
    ".wW..",
    "wW...",
    "w....",
  ], slash);

  // Muralla de piedra (ladrillos con mortero).
  const wall: Palette = { s: 0x8a8f99, S: 0xa2a7b0, m: 0x4e535c, ".": null };
  makePixel(scene, "wall", [
    "SSSSSSSSSSSSSSSS",
    "ssssssssssssssss",
    "ssssssssssssssss",
    "mmmmmmmmmmmmmmmm",
    "sssssssmssssssss",
    "sssssssmssssssss",
    "sssssssmssssssss",
    "mmmmmmmmmmmmmmmm",
    "sssmssssssssmsss",
    "sssmssssssssmsss",
    "sssmssssssssmsss",
    "mmmmmmmmmmmmmmmm",
    "sssssssmssssssss",
    "sssssssmssssssss",
    "sssssssmssssssss",
    "mmmmmmmmmmmmmmmm",
  ], wall);

  // Cartel indicador.
  const sign: Palette = { w: 0x6a4a2a, W: 0x4e3620, g: 0xe8c34a, ".": null };
  makePixel(scene, "sign", [
    "gggggg",
    "gggggg",
    "gggggg",
    "..WW..",
    "..WW..",
    "..WW..",
  ], sign);

  // --- Fuente central del pueblo ---
  const well: Palette = { s: 0x8a909a, S: 0x6c727c, w: 0x3f80c4, p: 0x6a4a2a, ".": null };
  makePixel(scene, "well", [
    "..p......p..",
    "..pssssssp..",
    "..ssssssss..",
    ".sSwwwwwwSs.",
    ".sSwwwwwwSs.",
    ".sSwwwwwwSs.",
    ".sssssssss..",
    "..SsssssS...",
  ], well);

  // --- Personaje (4 direcciones, base pixel) ---
  // El color de pelo viene de la creacion de personaje: forzamos el rebuild
  // de las texturas del heroe para que se aplique.
  for (const k of ["hero_down", "hero_up", "hero_side"]) {
    if (scene.textures.exists(k)) scene.textures.remove(k);
  }
  const P: Palette = {
    e: 0xf0c39b, // piel
    h: hairColor, // pelo (elegido por el jugador)
    u: 0x2f6bbf, // tunica
    U: 0x24528f, // tunica sombra
    p: 0x3a2a18, // botas
    k: 0x1a1206, // contorno
    ".": null,
  };
  // Frente (mirando abajo)
  makePixel(scene, "hero_down", [
    "..hhhh..",
    ".hhhhhh.",
    ".heeeeh.",
    ".eeeeee.",
    ".ekeeke.",
    "..eeee..",
    ".uUuuUu.",
    "uUuuuuUu",
    "uUuuuuUu",
    ".uuuuuu.",
    ".pp..pp.",
    ".pp..pp.",
  ], P);
  // Espalda (mirando arriba)
  makePixel(scene, "hero_up", [
    "..hhhh..",
    ".hhhhhh.",
    ".hhhhhh.",
    ".hhhhhh.",
    "..hhhh..",
    "..UUUU..",
    ".uUuuUu.",
    "uUuuuuUu",
    "uUuuuuUu",
    ".uuuuuu.",
    ".pp..pp.",
    ".pp..pp.",
  ], P);
  // Perfil (mirando a la derecha; se voltea para la izquierda)
  makePixel(scene, "hero_side", [
    "..hhhh..",
    ".hhhhhh.",
    ".hheeee.",
    ".heeeek.",
    ".heeee..",
    "..eeee..",
    "..uUuu..",
    ".uUuuUu.",
    ".uUuuUu.",
    "..uuuu..",
    "..pp.p..",
    "..pp.p..",
  ], P);

  // --- NPCs de los comercios ---
  // Mercader (Bolsa): gorro y delantal verde.
  const NPC1: Palette = {
    e: 0xf0c39b,
    h: 0x7a3b12, // gorro/pelo
    u: 0x3f9d54, // delantal verde
    U: 0x2f7a41,
    p: 0x3a2a18,
    k: 0x1a1206,
    ".": null,
  };
  makePixel(scene, "npc_merchant", [
    ".hhhhhh.",
    "hhhhhhhh",
    ".heeeeh.",
    ".eeeeee.",
    ".ekeeke.",
    "..eeee..",
    ".uUuuUu.",
    "uUuuuuUu",
    "uUuuuuUu",
    ".uuuuuu.",
    ".pp..pp.",
    ".pp..pp.",
  ], NPC1);

  // Banquero (Banco): traje azul oscuro y sombrero.
  const NPC2: Palette = {
    e: 0xf0c39b,
    h: 0x1a1a22, // sombrero
    u: 0x2a3550, // traje
    U: 0x1e2740,
    g: 0xe8c34a, // corbata dorada
    p: 0x14161f,
    k: 0x0e0e14,
    ".": null,
  };
  makePixel(scene, "npc_banker", [
    "hhhhhhhh",
    "hhhhhhhh",
    ".heeeeh.",
    ".eeeeee.",
    ".ekeeke.",
    "..eeee..",
    ".uUguUu.",
    "uUugguUu",
    "uUugguUu",
    ".uuguuu.",
    ".pp..pp.",
    ".pp..pp.",
  ], NPC2);

  // Almacenero (Almacen): boina y delantal marron.
  const NPC3: Palette = {
    e: 0xf0c39b,
    h: 0x3a2a18, // boina
    u: 0x8a5a2a, // delantal marron
    U: 0x6a4420,
    p: 0x2a2018,
    k: 0x1a1206,
    ".": null,
  };
  makePixel(scene, "npc_grocer", [
    ".hhhhhh.",
    "hhhhhhhh",
    ".heeeeh.",
    ".eeeeee.",
    ".ekeeke.",
    "..eeee..",
    ".uUuuUu.",
    "uUuuuuUu",
    "uUuuuuUu",
    ".uuuuuu.",
    ".pp..pp.",
    ".pp..pp.",
  ], NPC3);
}
