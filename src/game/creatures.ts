import Phaser from "phaser";
import { sfx } from "./audio.ts";

// Sistema de criaturas estilo Argentum: deambulan, te persiguen si te acercas,
// les pegas (barra espaciadora / boton tactil), sueltan monedas fisicas y XP.
//
// Cada criatura ENSENYA un peligro financiero:
//  - Deudita (rata): deuda chica. Facil, suelta moneditas.
//  - La Inflacion (llama): si te toca, te QUEMA el efectivo que llevas encima.

export interface MobDef {
  kind: "deudita" | "inflacion";
  tex: string;
  hp: number;
  speed: number;
  aggroR: number;
  /** Danyo al animo por golpe (0 = no pega al animo). */
  damage: number;
  /** % del efectivo que quema por toque (solo inflacion). */
  burnPct: number;
  xp: number;
  /** Monedas que suelta: [min,max] y valor por moneda en centavos. */
  coins: [number, number];
  coinValue: [number, number];
  scale: number;
}

export const MOB_DEFS: Record<string, MobDef> = {
  deudita: {
    kind: "deudita",
    tex: "mob_deudita",
    hp: 40,
    speed: 34,
    aggroR: 55,
    damage: 6,
    burnPct: 0,
    xp: 10,
    coins: [2, 3],
    coinValue: [25_000, 60_000], // $250 - $600
    scale: 1,
  },
  inflacion: {
    kind: "inflacion",
    tex: "mob_inflacion",
    hp: 130,
    speed: 26,
    aggroR: 78,
    damage: 0,
    burnPct: 0.006, // 0.6% del efectivo por toque
    xp: 45,
    coins: [4, 6],
    coinValue: [40_000, 90_000],
    scale: 1.1,
  },
};

interface Mob {
  def: MobDef;
  sprite: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBack: Phaser.GameObjects.Rectangle;
  hp: number;
  home: { x: number; y: number };
  wanderTarget: { x: number; y: number };
  wanderTimer: number;
  hitCooldown: number;
  dead: boolean;
}

interface Pickup {
  sprite: Phaser.GameObjects.Image;
  kind: "coin" | "orb";
  valueCents: number;
  xp: number;
}

export interface CreatureCallbacks {
  isWater(x: number, y: number): boolean;
  isSafeZone(x: number, y: number): boolean;
  onHeroHurt(damage: number): void;
  onBurn(pctOfCash: number): void;
}

export class CreatureManager {
  private scene: Phaser.Scene;
  private cb: CreatureCallbacks;
  private mobs: Mob[] = [];
  private pickups: Pickup[] = [];
  private spawns: Array<{ def: MobDef; x: number; y: number; respawnIn: number; alive: boolean }> = [];
  private rnd: () => number;

  constructor(scene: Phaser.Scene, seed: number, cb: CreatureCallbacks) {
    this.scene = scene;
    this.cb = cb;
    let s = seed >>> 0;
    this.rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /** Registra un punto de spawn (la criatura reaparece sola al morir). */
  addSpawn(kind: keyof typeof MOB_DEFS, x: number, y: number) {
    const def = MOB_DEFS[kind];
    this.spawns.push({ def, x, y, respawnIn: 0, alive: false });
  }

  /** Suelta una moneda fisica en el piso (tambien la usa la renta del pueblo). */
  dropCoin(x: number, y: number, valueCents: number) {
    if (this.pickups.length > 60) return; // tope de objetos en el piso
    const sprite = this.scene.add.image(x, y, "coin").setDepth(y).setScale(1);
    this.scene.tweens.add({ targets: sprite, y: y - 3, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.pickups.push({ sprite, kind: "coin", valueCents, xp: 0 });
  }

  private dropOrb(x: number, y: number, xp: number) {
    const sprite = this.scene.add.image(x, y, "orb").setDepth(y);
    this.scene.tweens.add({ targets: sprite, y: y - 4, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.pickups.push({ sprite, kind: "orb", valueCents: 0, xp });
  }

  private spawnMob(sp: { def: MobDef; x: number; y: number }) {
    const sprite = this.scene.add.image(sp.x, sp.y, sp.def.tex).setDepth(sp.y).setScale(sp.def.scale);
    const hpBack = this.scene.add.rectangle(sp.x, sp.y - 12, 14, 2.5, 0x222833).setDepth(99998).setVisible(false);
    const hpBar = this.scene.add.rectangle(sp.x, sp.y - 12, 14, 2.5, 0x5ee08a).setDepth(99999).setVisible(false);
    this.mobs.push({
      def: sp.def,
      sprite,
      hpBar,
      hpBack,
      hp: sp.def.hp,
      home: { x: sp.x, y: sp.y },
      wanderTarget: { x: sp.x, y: sp.y },
      wanderTimer: 0,
      hitCooldown: 0,
      dead: false,
    });
  }

  /** Intento de ataque del heroe: pega al mob mas cercano en rango. Devuelve true si conecto. */
  heroAttack(hx: number, hy: number, damage: number): boolean {
    let best: Mob | null = null;
    let bestD = 20; // alcance del golpe
    for (const m of this.mobs) {
      if (m.dead) continue;
      const d = Math.hypot(m.sprite.x - hx, m.sprite.y - hy);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    if (!best) return false;
    const target = best;
    target.hp -= damage;
    sfx.hit();
    // Flash + knockback.
    target.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => !target.dead && target.sprite.clearTint());
    const kx = target.sprite.x - hx;
    const ky = target.sprite.y - hy;
    const kl = Math.hypot(kx, ky) || 1;
    target.sprite.x += (kx / kl) * 6;
    target.sprite.y += (ky / kl) * 6;
    if (target.hp <= 0) this.killMob(target);
    return true;
  }

  private killMob(m: Mob) {
    m.dead = true;
    sfx.mobdie();
    const { x, y } = m.sprite;
    // Animacion de muerte.
    this.scene.tweens.add({
      targets: m.sprite,
      alpha: 0,
      scale: m.sprite.scale * 1.4,
      duration: 180,
      onComplete: () => m.sprite.destroy(),
    });
    m.hpBar.destroy();
    m.hpBack.destroy();
    // Drops: monedas desparramadas + orbe de XP.
    const n = m.def.coins[0] + Math.floor(this.rnd() * (m.def.coins[1] - m.def.coins[0] + 1));
    for (let i = 0; i < n; i++) {
      const ang = this.rnd() * Math.PI * 2;
      const r = 6 + this.rnd() * 12;
      const v = m.def.coinValue[0] + Math.floor(this.rnd() * (m.def.coinValue[1] - m.def.coinValue[0]));
      this.dropCoin(x + Math.cos(ang) * r, y + Math.sin(ang) * r, v);
    }
    this.dropOrb(x, y - 6, m.def.xp);
    // Programa el respawn en su punto de origen.
    const sp = this.spawns.find((s) => s.alive && Math.hypot(s.x - m.home.x, s.y - m.home.y) < 2);
    if (sp) {
      sp.alive = false;
      sp.respawnIn = 9000 + this.rnd() * 8000;
    }
    this.mobs = this.mobs.filter((x2) => x2 !== m);
  }

  /** Devuelve {cents, xp} recogidos este frame (el llamador emite los comandos). */
  update(delta: number, hx: number, hy: number): { lootCents: number; lootXp: number } {
    // Respawns.
    for (const sp of this.spawns) {
      if (!sp.alive) {
        sp.respawnIn -= delta;
        if (sp.respawnIn <= 0 && Math.hypot(sp.x - hx, sp.y - hy) > 90) {
          sp.alive = true;
          this.spawnMob(sp);
        }
      }
    }

    // IA de los bichos.
    for (const m of this.mobs) {
      if (m.dead) continue;
      m.hitCooldown -= delta;
      const dHero = Math.hypot(hx - m.sprite.x, hy - m.sprite.y);
      const heroSafe = this.cb.isSafeZone(hx, hy);
      let tx: number;
      let ty: number;
      let speed = m.def.speed;
      if (dHero < m.def.aggroR && !heroSafe) {
        // Persigue al heroe.
        tx = hx;
        ty = hy;
        speed *= 1.35;
      } else {
        // Deambula cerca de su casa.
        m.wanderTimer -= delta;
        if (m.wanderTimer <= 0) {
          m.wanderTimer = 1200 + this.rnd() * 2400;
          const ang = this.rnd() * Math.PI * 2;
          m.wanderTarget = { x: m.home.x + Math.cos(ang) * 30, y: m.home.y + Math.sin(ang) * 30 };
        }
        tx = m.wanderTarget.x;
        ty = m.wanderTarget.y;
        speed *= 0.5;
      }
      const dx = tx - m.sprite.x;
      const dy = ty - m.sprite.y;
      const dl = Math.hypot(dx, dy);
      if (dl > 3) {
        const nx = m.sprite.x + (dx / dl) * speed * (delta / 1000);
        const ny = m.sprite.y + (dy / dl) * speed * (delta / 1000);
        // No entra al agua ni a la zona segura (dentro de la muralla).
        if (!this.cb.isWater(nx, ny) && !this.cb.isSafeZone(nx, ny)) {
          m.sprite.x = nx;
          m.sprite.y = ny;
        }
        m.sprite.setFlipX(dx < 0);
      }
      m.sprite.setDepth(m.sprite.y);
      // Barra de vida (visible si esta danyado).
      const hurt = m.hp < m.def.hp;
      m.hpBack.setVisible(hurt).setPosition(m.sprite.x, m.sprite.y - 12);
      m.hpBar
        .setVisible(hurt)
        .setPosition(m.sprite.x - 7 + (7 * m.hp) / m.def.hp, m.sprite.y - 12)
        .setSize(Math.max(0.5, (14 * m.hp) / m.def.hp), 2.5);

      // Contacto con el heroe.
      if (dHero < 10 && m.hitCooldown <= 0 && !heroSafe) {
        m.hitCooldown = 700;
        if (m.def.damage > 0) this.cb.onHeroHurt(m.def.damage);
        if (m.def.burnPct > 0) this.cb.onBurn(m.def.burnPct);
      }
    }

    // Recoleccion de loot (pisandolo).
    let lootCents = 0;
    let lootXp = 0;
    this.pickups = this.pickups.filter((p) => {
      const d = Math.hypot(p.sprite.x - hx, p.sprite.y - hy);
      if (d < 10) {
        lootCents += p.valueCents;
        lootXp += p.xp;
        sfx.pickup();
        p.sprite.destroy();
        return false;
      }
      return true;
    });
    return { lootCents, lootXp };
  }

  destroy() {
    for (const m of this.mobs) {
      m.sprite.destroy();
      m.hpBar.destroy();
      m.hpBack.destroy();
    }
    for (const p of this.pickups) p.sprite.destroy();
    this.mobs = [];
    this.pickups = [];
  }
}
