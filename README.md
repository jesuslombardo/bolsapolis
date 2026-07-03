# 🏛️ Bolsápolis

**Tu portafolio es tu imperio.** Un RTS de finanzas: si tu acción sube, tu
ciudad crece y llegan aldeanos; si cae, tu gente se va. *Bolsa* (mercado
bursátil) + *polis* (ciudad-estado).

> Estado: **MVP v0.1** — jugable en el navegador con un mercado simulado.
> Arquitectura pensada para escalar a online/multiplayer (Cloudflare Durable
> Objects). Ver [`docs/concept.md`](docs/concept.md) y [`docs/roadmap.md`](docs/roadmap.md).

## Correr en local

```bash
npm install
npm run dev
```

Abrí la URL que imprime Vite (por defecto http://localhost:5173).

Vas a ver tu imperio: el mercado avanza cada ~1.4s, la población sube o baja con
el valor de tu portafolio, y se levantan edificios al cruzar hitos. Probá los
botones **Inyectar capital** y **Simular crash** para ver la mecánica al toque.

## Scripts

| comando | qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo con hot-reload |
| `npm run build` | typecheck + build de producción a `dist/` |
| `npm run typecheck` | solo chequeo de tipos |
| `npm run preview` | sirve el build de `dist/` |

## Cómo está armado

```
src/
  sim/          lógica pura (sin Phaser) — el "motor" del juego
    market.ts   mercado simulado + valor de portafolio
    empire.ts   portafolio -> población -> edificios
  game/         capa de render con Phaser 3
    config.ts
    scenes/VillageScene.ts
  main.ts       une simulación + render + HUD
```

La separación **sim / render** es a propósito: cuando llegue el backend, la
misma lógica de `sim/` puede correr server-authoritative en un Worker.

## Stack
Vite · TypeScript · Phaser 3 — y (roadmap) Cloudflare Workers + Durable
Objects + D1 para la etapa online.

## Licencia
MIT
