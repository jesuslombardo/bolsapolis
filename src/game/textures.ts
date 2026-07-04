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

export function buildTextures(scene: Phaser.Scene) {
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
  const P: Palette = {
    e: 0xf0c39b, // piel
    h: 0x4a2f1c, // pelo
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
}
