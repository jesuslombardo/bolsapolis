# 🏴‍☠️ La Isla del Tesoro

Juego 3D en primera persona (WebGL / Three.js) sobre un naufragio y la búsqueda
de un tesoro. Corre 100% en el navegador, **sin build step** y sin dependencias
externas en tiempo de ejecución (Three.js está vendorizado en `vendor/`).

> **Estado: MVP** — Mundo 1 navegable + **Pista 1 (la cueva)** jugable de punta a
> punta, con sistema de 3 vidas y pistas (hints).

## 🎮 Cómo se juega

Naufragaste en una isla desconocida. Entre los restos del barco encontraste un
mapa: la primera marca apunta a una **cueva**. Encontrala, leé la inscripción de
la pared y usá esa pista para abrir el **cofre** y descubrir hacia dónde seguir.

### Controles

| Tecla | Acción |
|-------|--------|
| `W` `A` `S` `D` / flechas | Moverte |
| Mouse | Mirar (click para capturar el puntero) |
| `Shift` | Correr |
| `E` | Interactuar (leer inscripción, abrir cofre) |
| `Esc` | Liberar el mouse / pausa |
| 💡 Pista | Pedir una ayuda contextual |

### Reglas

- Tenés **3 vidas** ❤️❤️❤️.
- Las vidas se pierden **solo por peligros**: hundirte en el **mar profundo** o
  caer en una **trampa** (pozo). Al perder una vida reaparecés en el último punto
  seguro. Con 0 vidas, game over.
- Para resolver una pista: **explorás**, encontrás objetos/pistas y con eso
  respondés un **acertijo**.

## ▶️ Correr localmente

Al no tener build, alcanza con servir la carpeta con cualquier servidor estático:

```bash
cd isla-del-tesoro
python3 -m http.server 8099
# abrí http://127.0.0.1:8099/
```

(o `npx serve`, la extensión *Live Server* de VS Code, etc.)

> Abrir `index.html` directo con `file://` **no** funciona: los ES modules
> necesitan servirse por HTTP.

## 🧱 Estructura

```
isla-del-tesoro/
├── index.html        # HUD, overlays e importmap de Three.js
├── style.css         # estilos del HUD y modales (estética pergamino/oro)
├── vendor/           # Three.js vendorizado (no requiere internet)
│   ├── three.module.js
│   └── PointerLockControls.js
└── src/
    ├── main.js       # orquestador: game loop, estado, interacción
    ├── world.js      # isla 3D: terreno, mar, naufragio, cueva, volcán, flora
    ├── player.js     # controlador primera persona + colisiones + peligros
    ├── hud.js        # capa de interfaz (DOM)
    └── puzzles.js    # datos y validación de las pistas
```

## 🗺️ Roadmap (diseño completo del juego)

**Mundo 1 — La Isla**
- [x] Pista 0 · Naufragio (encontrás el mapa) — *punto de partida*
- [x] **Pista 1 · Cueva** — *incluida en el MVP*
- [ ] Pista 2 · Volcán
- [ ] Pista 3 · Lago
- [ ] Pista 4 · Dragón
- [ ] Subir la montaña → Mundo 2

**Mundo 2 — El Bosque**
- [ ] Pista 5 · Carrito minero
- [ ] Pista 6 · Palmera
- [ ] Pista 7 · Casa abandonada
- [ ] Pista 8 · Castillo con esqueleto viviente (que te persigue)
- [ ] Puente colgante + llave → **el cofre del tesoro** 🗝️

## 🛠️ Tecnología

- [Three.js](https://threejs.org/) r160 (WebGL), vendorizado localmente.
- JavaScript ES modules nativos (sin bundler).
- Pensado para desplegarse como sitio estático (GitHub Pages, Netlify, itch.io…).
