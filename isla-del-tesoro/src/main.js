import * as THREE from 'three';
import { World, SPAWN, CAVE, VOLCANO, terrainHeightAt } from './world.js';
import { Player } from './player.js';
import { HUD } from './hud.js';
import { PISTA_1, isCorrect } from './puzzles.js';

// ============================================================================
//  La Isla del Tesoro — MVP
//  Mundo 1: isla navegable en 3D + Pista 1 (la cueva).
// ============================================================================

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 600);

const world = new World(scene);
const player = new Player(camera, canvas, world);
scene.add(player.object);

const hud = new HUD();

const state = {
  lives: 3,
  started: false,
  inscriptionRead: false,
  solved: false,
  won: false,
  over: false,
  modalOpen: false,
  active: null, // interactuable actual en rango
  safePos: SPAWN.clone(),
};

// ---------------------------------------------------------------- interacción
function assignHandlers() {
  for (const it of world.interactables) {
    if (it.id === 'inscripcion') {
      it.handler = () => {
        state.inscriptionRead = true;
        openModal(() => hud.showClue(PISTA_1.inscription));
        hud.setObjective('Volvé al cofre y respondé con la palabra clave.');
      };
    } else if (it.id === 'cofre') {
      it.handler = () => {
        if (state.solved) { hud.toast('El cofre ya está abierto ✅'); return; }
        openModal(() =>
          hud.showRiddle(PISTA_1, {
            onSubmit: submitRiddle,
            onHint: () => showRiddleHint(),
          })
        );
      };
    }
  }
}

function submitRiddle() {
  const val = hud.el.riddleInput.value;
  if (!val.trim()) return;
  if (isCorrect(PISTA_1, val)) {
    hud.riddleFeedback(true, '¡Correcto! 🗝️');
    state.solved = true;
    world.openChest();
    world.hideCaveBeacon();
    setTimeout(() => {
      closeModal(() => hud.hideRiddle());
      state.won = true;
      state.modalOpen = true; // la pantalla de victoria queda abierta
      hud.showWin(PISTA_1.solvedText);
    }, 900);
  } else {
    hud.riddleFeedback(false, 'No es la palabra. Probá de nuevo o pedí una pista 💡');
  }
}

let riddleHintIdx = 0;
function showRiddleHint() {
  const hints = PISTA_1.hints;
  const h = hints[Math.min(riddleHintIdx, hints.length - 1)];
  riddleHintIdx++;
  hud.riddleFeedback(true, '💡 ' + h);
}

// --------------------------------------------------------- modales / puntero
function openModal(show) {
  state.modalOpen = true;
  if (player.controls.isLocked) player.controls.unlock();
  show();
}
function closeModal(hide) {
  hide();
  state.modalOpen = false;
  if (state.started && !state.won && !state.over) player.controls.lock();
}

// ------------------------------------------------------------------ peligros
function onDanger(msg) {
  if (state.over || state.won) return;
  state.lives -= 1;
  hud.setLives(state.lives);
  hud.flashDamage();
  hud.toast('💔 ' + msg + '  (-1 vida)');
  if (state.lives <= 0) {
    state.over = true;
    state.modalOpen = true;
    if (player.controls.isLocked) player.controls.unlock();
    hud.showGameOver();
  } else {
    player.spawn(state.safePos);
  }
}

// ------------------------------------------------------------------ arranque
function startGame() {
  state.started = true;
  hud.showHUD();
  hud.setLives(state.lives);
  hud.setObjective('Explorá la isla y encontrá la cueva (seguí el haz de luz).');
  hud.el.intro.classList.add('hidden');
  player.enabled = true;
  player.spawn(SPAWN);
  player.lookAt(CAVE); // mirando hacia la cueva al arrancar
  player.controls.lock();
}

function restart() {
  window.location.reload();
}

// --------------------------------------------------------------- event wiring
assignHandlers();

hud.el.startBtn.addEventListener('click', startGame);
hud.el.resumeBtn.addEventListener('click', () => {
  hud.hideResume();
  player.controls.lock();
});
hud.el.clueClose.addEventListener('click', () => closeModal(() => hud.hideClue()));
hud.el.riddleSubmit.addEventListener('click', submitRiddle);
hud.el.riddleHint.addEventListener('click', showRiddleHint);
hud.el.riddleClose.addEventListener('click', () => closeModal(() => hud.hideRiddle()));
hud.el.riddleInput.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') submitRiddle();
});
hud.el.winRestart.addEventListener('click', restart);
hud.el.gameoverRestart.addEventListener('click', restart);

// Botón global de pista (contextual)
hud.el.hintBtn.addEventListener('click', () => {
  if (state.won || state.over) return;
  if (!state.solved) {
    if (!state.inscriptionRead) {
      hud.toast('💡 Entrá a la cueva y leé la inscripción de la pared.');
    } else {
      hud.toast('💡 ' + PISTA_1.hints[0]);
    }
  }
});

// Tecla E: interactuar con lo que esté en rango
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && state.active && !state.modalOpen && player.controls.isLocked) {
    state.active.handler && state.active.handler();
  }
});

// Al perder el lock sin modal abierto -> pausa
player.controls.addEventListener('unlock', () => {
  if (state.started && !state.modalOpen && !state.won && !state.over) {
    hud.showResume();
  }
});
player.controls.addEventListener('lock', () => hud.hideResume());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --------------------------------------------------------- detección de rango
function updateInteraction() {
  if (state.modalOpen || !player.controls.isLocked) { hud.hidePrompt(); state.active = null; return; }
  const p = player.object.position;
  let best = null;
  let bestD = Infinity;
  for (const it of world.interactables) {
    if (it.id === 'cofre' && state.solved) continue;
    const d = Math.hypot(p.x - it.position.x, p.z - it.position.z);
    if (d < it.radius && d < bestD) { best = it; bestD = d; }
  }
  state.active = best;
  if (best) hud.showPrompt(best.prompt);
  else hud.hidePrompt();
}

// Actualiza el último punto seguro (para respawnear tras un peligro)
function updateSafePos() {
  const p = player.object.position;
  const h = terrainHeightAt(p.x, p.z);
  if (h < 1.3) return;
  for (const tr of world.traps) {
    if (Math.hypot(p.x - tr.x, p.z - tr.z) < tr.r + 2) return;
  }
  state.safePos.set(p.x, 0, p.z);
}

// ------------------------------------------------------------------ game loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  world.update(dt);
  if (state.started && !state.won && !state.over) {
    player.update(dt, { onDanger });
    updateSafePos();
    updateInteraction();
  }
  renderer.render(scene, camera);
}
animate();

// Exponer para debug/pruebas
window.__isla = { state, world, player };
