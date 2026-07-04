// Sonidos del juego generados por WebAudio (sin assets externos).
// Compartido entre la escena (pasos) y el HUD (compra/venta/etc.).
// El AudioContext se crea/reanuda tras el primer gesto del usuario (asi lo
// exigen los navegadores, sobre todo en el celular).

let audio: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    audio ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function beep(freqs: number[], dur = 0.09, type: OscillatorType = "square", gain = 0.05) {
  const c = ctx();
  if (!c) return;
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = f;
    const t0 = c.currentTime + i * dur;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  });
}

// Pasito corto y seco. Alterna dos tonos graves -> sensacion "tiki-tiki".
let stepFlip = false;
function step() {
  stepFlip = !stepFlip;
  beep([stepFlip ? 130 : 105], 0.035, "triangle", 0.028);
}

export const sfx = {
  buy: () => beep([440, 660], 0.08, "square"),
  sell: () => beep([550, 330], 0.08, "square"),
  coin: () => beep([880, 1170], 0.06, "triangle"),
  levelup: () => beep([523, 659, 784, 1047], 0.1, "square", 0.06),
  deny: () => beep([180, 120], 0.12, "sawtooth", 0.04),
  talk: () => beep([330, 440], 0.06, "square", 0.04),
  step,
  // Combate
  hit: () => beep([220, 160], 0.05, "square", 0.05),
  hurt: () => beep([140, 90], 0.09, "sawtooth", 0.05),
  mobdie: () => beep([500, 380, 260], 0.06, "square", 0.05),
  pickup: () => beep([990, 1320], 0.05, "triangle", 0.045),
  burn: () => beep([90, 70, 55], 0.08, "sawtooth", 0.04),
  faint: () => beep([300, 220, 150, 90], 0.12, "sine", 0.06),
};
