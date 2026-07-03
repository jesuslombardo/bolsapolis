# Bolsápolis — Documento de diseño (v0.1)

> RTS de finanzas: **tu portafolio es tu imperio**. La acción sube → crece tu ciudad.

Este documento resume la visión, el estado actual del prototipo y el plan.
Escrito para que lo revises de un vistazo mañana. — *avance nocturno*

---

## 1. La idea en una frase

Compras y vendes acciones en tiempo real; **tu patrimonio se convierte,
literalmente, en una ciudad que crece delante de tus ojos**. Cuanto mejor
inviertes, más grande y viva es tu Bolsápolis. En multiplayer, varios jugadores
compiten por tener la metrópoli más próspera sobre el mismo mercado.

## 2. Por qué es original (investigación del día)

Busqué juegos existentes. Hay tycoons de bolsa (*Stock Market Tycoon*,
*Capitalism Lab*), city-builders económicos (*Urban Empire*) e idle de acciones
en itch.io. **Ninguno cierra el loop que proponemos**: el *feedback visual en
tiempo real* donde el precio de tus acciones **es** el motor de crecimiento de
una ciudad, en formato RTS competitivo. Ese es nuestro hueco.

## 3. El loop central (ya jugable en el prototipo)

```
   mercado sube/baja  ──►  operas (compra/venta)  ──►  cambia tu patrimonio
          ▲                                                     │
          └──────────────  la ciudad crece/decrece  ◄──────────┘
```

- El **patrimonio** (efectivo + valor de la cartera) determina el **tier** de
  ciudad: Descampado → Aldea → Pueblo → Villa → Ciudad → Metrópoli → Megalópolis.
- Dentro de cada tier, el skyline sube de forma continua con el progreso.
- Si tu cartera cae, la ciudad se contrae. **El riesgo se ve.**

## 4. Estado del prototipo (lo que hay hoy)

Funciona y está verificado en navegador (comprar → patrimonio ↑ → skyline crece
hasta Megalópolis). Stack: **Vite + TypeScript + Phaser 3**.

| Módulo | Archivo | Qué hace |
|---|---|---|
| Simulación pura | `src/sim/engine.ts` | reducer determinista: `tick`, `applyCommand` |
| Mercado | `src/sim/market.ts` | 5 valores ficticios (drift + volatilidad) |
| RNG | `src/sim/rng.ts` | mulberry32 seedable (clave para multiplayer) |
| Ciudad | `src/sim/city.ts` | mapea patrimonio → tiers y alturas de edificios |
| Runtime | `src/game/runtime.ts` | interfaz estable (`subscribe`/`send`); hoy local |
| Render | `src/game/CityScene.ts` | dibuja el skyline leyendo `cityView(state)` |
| HUD | `src/ui/hud.ts` | panel de trading (precios, P&L, comprar/vender) |
| Tests | `src/sim/engine.test.ts` | determinismo + reglas de trading (7 tests ✓) |

**Decisión clave de arquitectura:** la simulación es **pura y determinista**
(sin Phaser, sin DOM). Eso permite ejecutarla igual en el cliente y, mañana, en
el servidor autoritativo. El render solo *lee* estado derivado.

## 5. Camino a multiplayer (Cloudflare Durable Objects)

La interfaz `Runtime` (`getState` / `send` / `subscribe`) está pensada para
cambiar de implementación sin tocar UI ni render:

1. **Hoy:** `createLocalRuntime` avanza el mercado con `setInterval`.
2. **Mañana:** `createNetworkRuntime` habla por WebSocket con un Durable Object
   que corre `tick`/`applyCommand` como **autoridad** y difunde el estado.
   Como la sim es determinista y seedable, el cliente puede predecir y
   reconciliar. Una sala = un DO = una seed compartida.

## 6. Próximos pasos sugeridos (para decidir juntos)

- [ ] **Feed de precios real** (opcional): acciones reales vía API, o seguir con
      valores ficticios para no depender de datos de mercado.
- [ ] **Eventos de mercado**: noticias que sacuden un sector (sube VOLT, cae META).
- [ ] **Objetivos/victoria**: primero en llegar a Metrópoli, o mayor patrimonio
      en N minutos.
- [ ] **Isométrico**: pasar del skyline lateral a una ciudad iso con distritos
      por sector (energía, agro, industria…).
- [ ] **Networking**: montar el Durable Object y `createNetworkRuntime`.

## 7. Cómo probarlo

```bash
npm install
npm run dev        # abre http://localhost:5173
npm test           # tests de la simulación
```

En la consola del navegador (modo dev) tienes `window.__bolsapolis.runtime`
con `__debugGrantCash(cents)` para probar los niveles de ciudad rápido.
