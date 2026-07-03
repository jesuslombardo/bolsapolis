# Roadmap — Bolsápolis

Filosofía: empezar chico, validar la diversión, y recién ahí escalar a online.

## ✅ DONE
- **Fase 0 — Scaffold + MVP jugable (client-side)**
  - Vite + TypeScript + Phaser 3.
  - Mercado simulado y mapeo portafolio → población → edificios.
  - HUD, feedback visual (aldeanos animados, flash verde/rojo), botones demo.

## 🔜 NEXT (sin bloqueos, se puede hacer solo)
- **Fase 1 — Profundidad del single-player**
  - Comprar/vender acciones con "tesoro" del imperio (loop económico real).
  - Más edificios con *efectos* (granja = +población máxima, mercado = +interés).
  - Eventos de mercado (booms, crashes, rumores) con narrativa.
  - Persistencia local (`localStorage`) para no perder la partida.
  - Look: reemplazar emoji por sprites/tiles isométricos.

## 🔒 BLOQUEADO POR JESÚS (necesita cuota/API keys o infra suya)
- **Fase 2 — Precios reales**
  - Cloudflare Worker que consulte una API bursátil (Alpha Vantage / Finnhub /
    Polygon). **Requiere API key de Jesús.**
  - Cache de precios en KV o D1 para no quemar cuota.
- **Fase 3 — Online / multiplayer (MMO ligero)**
  - **Durable Objects** para el estado por-jugador y salas en tiempo real.
  - **D1** para persistencia de imperios, rankings, alianzas.
  - Auth (¿GitHub / email mágico?).
  - Requiere cuenta Cloudflare con Workers Paid (DO) → decisión de Jesús.

## Notas de arquitectura
- El código de **simulación** (`src/sim/`) es puro y sin dependencias de Phaser:
  cuando llegue el backend, esta misma lógica puede correr en el Worker (server
  authoritative) y el cliente solo renderiza. Esa separación es a propósito.
