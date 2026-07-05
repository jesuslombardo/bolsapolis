// Capa de interfaz (DOM): vidas, objetivo, prompts, modales de pista y acertijo.

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      lives: $('lives'),
      objective: $('objective-text'),
      prompt: $('prompt'),
      hintBtn: $('hint-btn'),
      intro: $('intro'),
      startBtn: $('start-btn'),
      resume: $('resume'),
      resumeBtn: $('resume-btn'),
      clue: $('clue'),
      clueText: $('clue-text'),
      clueClose: $('clue-close'),
      riddle: $('riddle'),
      riddleQ: $('riddle-question'),
      riddleInput: $('riddle-input'),
      riddleMsg: $('riddle-msg'),
      riddleSubmit: $('riddle-submit'),
      riddleHint: $('riddle-hint'),
      riddleClose: $('riddle-close'),
      win: $('win'),
      winText: $('win-text'),
      winRestart: $('win-restart'),
      gameover: $('gameover'),
      gameoverRestart: $('gameover-restart'),
      toast: $('toast'),
      flash: $('damage-flash'),
    };
    this._toastTimer = null;
  }

  showHUD() { this.el.hud.classList.remove('hidden'); }

  setLives(n) {
    this.el.lives.textContent = '❤️'.repeat(Math.max(0, n)) + '🖤'.repeat(Math.max(0, 3 - n));
  }

  setObjective(text) { this.el.objective.textContent = text; }

  showPrompt(text) {
    this.el.prompt.textContent = text;
    this.el.prompt.classList.remove('hidden');
  }
  hidePrompt() { this.el.prompt.classList.add('hidden'); }

  toast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.el.toast.classList.add('hidden'), ms);
  }

  flashDamage() {
    this.el.flash.classList.add('show');
    setTimeout(() => this.el.flash.classList.remove('show'), 160);
  }

  // ---- overlays ----
  showClue(text) {
    this.el.clueText.textContent = text;
    this.el.clue.classList.remove('hidden');
  }
  hideClue() { this.el.clue.classList.add('hidden'); }

  showRiddle(pista, { onSubmit, onHint }) {
    this._pista = pista;
    this._hintIdx = 0;
    this.el.riddleQ.textContent = pista.question;
    this.el.riddleInput.value = '';
    this.el.riddleMsg.textContent = '';
    this.el.riddleMsg.className = '';
    this.el.riddle.classList.remove('hidden');
    setTimeout(() => this.el.riddleInput.focus(), 50);
    this._onSubmit = onSubmit;
    this._onHint = onHint;
  }
  hideRiddle() { this.el.riddle.classList.add('hidden'); }

  riddleFeedback(ok, msg) {
    this.el.riddleMsg.textContent = msg;
    this.el.riddleMsg.className = ok ? 'ok' : 'bad';
  }

  showWin(text) {
    this.el.winText.textContent = text;
    this.el.win.classList.remove('hidden');
  }

  showGameOver() { this.el.gameover.classList.remove('hidden'); }

  showResume() { this.el.resume.classList.remove('hidden'); }
  hideResume() { this.el.resume.classList.add('hidden'); }
}
