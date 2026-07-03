# 🏛️ Bolsápolis

**RTS de finanzas: tu portafolio es tu imperio.** La acción sube → crece tu ciudad.

Vite + TS + Phaser, con la simulación separada del render para estar lista para
multiplayer (Cloudflare Durable Objects).

## Estado

Prototipo v0.1 del **loop central jugable**: operas en un mercado en tiempo real
y tu patrimonio hace crecer (o encoger) una ciudad de 7 niveles, desde
*Descampado* hasta *Megalópolis*.

Ver [`DESIGN.md`](./DESIGN.md) para la visión completa y el plan.

## Empezar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de la simulación (determinismo + trading)
npm run build      # build de producción
```

## Estructura

```
src/
  sim/     simulación pura y determinista (sin Phaser) — lista para el servidor
  game/    runtime del cliente + escena Phaser (render del skyline)
  ui/      HUD de trading (DOM)
```
