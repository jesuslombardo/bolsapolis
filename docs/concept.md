# Bolsápolis — concepto

## Pitch en una línea
Un RTS de finanzas donde **tu portafolio es tu imperio**: si tu acción sube, tu
ciudad crece; si cae, tu gente se va.

## La mecánica central
El puente entre finanzas y juego es una sola idea:

```
valor del portafolio  ──►  población del imperio  ──►  edificios / territorio
```

- Cada ~$250 de valor de portafolio sostiene **1 aldeano** (`VALUE_PER_VILLAGER`).
- La población se mueve **animada** hacia su objetivo: los aldeanos nacen y se
  van con transiciones, para que un +4% se *sienta* como una oleada de gente.
- Al cruzar hitos de población se **desbloquean edificios** (casa → granja →
  mercado → castillo → gran torre).

Así, mirar tu imperio es mirar tu cartera: no ves un número frío, ves si tu
ciudad florece o se vacía.

## Qué ya existe (MVP v0.1)
- Mercado **simulado** (random walk con leve deriva alcista) — `src/sim/market.ts`.
- Traducción portafolio → imperio — `src/sim/empire.ts`.
- Render con **Phaser 3**: césped, aldeanos (emoji), edificios que se levantan,
  y un flash verde/rojo según el día — `src/game/scenes/VillageScene.ts`.
- HUD con valor, variación diaria, tus acciones y botones de demo (inyectar
  capital / simular crash).

## Hacia dónde va (visión)
El objetivo a largo plazo es un **juego online tipo MMO ligero**:

- **Precios reales** de acciones/cripto (vía Worker + API bursátil).
- **Tu portafolio real** (o uno de fantasía) manejando tu ciudad.
- **Multiplayer**: cada jugador tiene su ciudad; rankings, alianzas, quizá
  "guerras económicas" (tu sector vs. el de otro).
- **Progresión**: territorio, unidades, mejoras que persisten entre sesiones.

Ver `roadmap.md` para el plan por fases.

## Decisiones de diseño (por qué así)
- **Empezar client-side y mock** para validar que la mecánica es *divertida*
  antes de meter backend. Si el bucle "sube la acción → crece la ciudad" no
  engancha, ninguna infra lo arregla.
- **Phaser** porque es el motor 2D de facto para web: escenas, tweens, input y
  escala responsive sin reinventar nada.
- **Emoji en vez de sprites** al inicio: cero pipeline de assets, iteramos la
  mecánica; los sprites llegan cuando el juego valga la pena vestirlo.
