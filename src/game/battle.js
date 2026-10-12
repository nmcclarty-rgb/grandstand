/**
 * GRANDSTAND — turn-based combat.
 *
 * The question IS the weapon.
 *
 *   STRIKE turn: you're asked who has the MOST of something. The number on
 *                the answer you pick becomes the hit. Pick the biggest number,
 *                hit hardest. Pick a smaller one, still connect — just weaker.
 *                There is no "wrong", only "soft".
 *
 *   BLOCK turn:  they're coming at you. You're asked who has the FEWEST.
 *                Pick the smallest number to take the sting out of it.
 *
 * Alternating MOST/FEWEST is the whole skill ceiling: you have to keep
 * remembering which way round you're being asked, at speed, with a clock on.
 *
 * DAMAGE MODEL — why we normalise
 * ------------------------------
 * Raw stat values are wildly different in scale (Tendulkar's 15,921 Test runs
 * vs 5 Olympic rings). So the damage is rank-normalised within the question:
 *
 *     ratio = 0.25 + 0.75 * (value - min) / (max - min)
 *
 * Best answer = 1.00x, worst = 0.25x, regardless of whether the numbers are
 * single digits or five figures. The raw number is still shown, big, because
 * that's the fantasy — "260 GOALS" landing on someone's chin. See DESIGN.md.
 */

import { QUESTIONS } from '../data/questions.js';
import { makeRng } from '../engine/rng.js';

export const PHASE = {
  INTRO: 'intro',
  STRIKE: 'strike',       // player answering, attacking
  BLOCK: 'block',         // player answering, defending
  RESOLVE: 'resolve',     // showing the result of an answer
  WON: 'won',
  LOST: 'lost',
};

export const ANSWER_MS = 12000;
export const SPEED_BONUS_MAX = 0.5;   // +50% for an instant answer
export const CRIT_BONUS = 0.5;        // +50% for the perfect pick
export const COMBO_STEPS = [1, 1, 1.25, 1.5, 2];  // by combo length
export const BLOCK_FLOOR = 0.25;      // best possible block takes 25% through

/**
 * Character perks, read off `player.perk`. Kept here rather than in the
 * character data so there is one place to look when a fight does something
 * surprising.
 *
 *   speedMult   multiplies the clock bonus
 *   blockFloor  replaces BLOCK_FLOOR — lower is a better blocker
 *   repMult     multiplies all rep earned
 *   comboBoost  starts the combo ladder this many rungs up
 *   glassJaw    multiplies damage taken
 */
export const PERK_KEYS = ['speedMult', 'blockFloor', 'repMult', 'comboBoost', 'glassJaw'];

export class Battle {
  /**
   * @param {object} player  { name, hp, maxHp, power, palette, nutmegs }
   * @param {object} foe     roster fighter
   * @param {object} opts    { level, sports:[], seed, usedQuestions:Set, pvp:bool, player2 }
   */
  constructor(player, foe, opts = {}) {
    this.player = player;
    this.opts = opts;
    this.rng = makeRng(opts.seed || (Date.now() & 0xffffffff));
    this.level = opts.level || 1;
    this.sports = opts.sports || [];
    this.used = opts.usedQuestions || new Set();
    this.pvp = !!opts.pvp;

    const scale = 1 + (this.level - 1) * 0.20;
    this.foe = {
      ...foe,
      maxHp: Math.round(foe.hp * scale),
      hp: Math.round(foe.hp * scale),
      power: Math.round(foe.power * scale),
    };

    this.round = 1;
    this.phase = PHASE.INTRO;
    this.combo = 0;
    this.bestCombo = 0;
    this.yellowCards = 0;
    this.redCard = false;
    this.skipNext = false;
    this.log = [];
    this.question = null;
    this.lastResult = null;
    this.perfects = 0;
    this.answered = 0;
    this.repEarned = 0;
    this.askedAt = 0;
    this.eliminated = [];   // option indices removed by a nutmeg
  }

  // ── question selection ────────────────────────────────────────────────
  pickQuestion() {
    const filter = this.sports;
    const matches = (q) =>
      (!filter || filter.length === 0 || filter.includes(q.sport));

    let pool = QUESTIONS.map((q, i) => ({ q, i })).filter(({ q }) => matches(q));
    if (pool.length === 0) pool = QUESTIONS.map((q, i) => ({ q, i }));

    // Half the time, lean into the opponent's own discipline — fighting Tank
    // Bruno should feel like a boxing quiz.
    const themed = pool.filter(({ q }) => q.sport === this.foe.sport);
    if (themed.length >= 2 && this.rng.chance(0.5)) pool = themed;

    let fresh = pool.filter(({ i }) => !this.used.has(i));
    if (fresh.length === 0) { this.used.clear(); fresh = pool; }

    const chosen = this.rng.pick(fresh);
    this.used.add(chosen.i);

    // Shuffle option order so the biggest number isn't always in slot 1.
    const order = this.rng.shuffle(chosen.q.options.map((_, i) => i));
    return {
      ...chosen.q,
      index: chosen.i,
      options: order.map((i) => chosen.q.options[i]),
    };
  }

  values() { return this.question.options.map((o) => o.value); }
  maxValue() { return Math.max(...this.values()); }
  minValue() { return Math.min(...this.values()); }

  /** 0.25 .. 1.00, where 1.00 is the ideal pick for the current phase. */
  ratioFor(value, phase) {
    const max = this.maxValue(), min = this.minValue();
    if (max === min) return 1;
    const norm = (value - min) / (max - min);
    const good = phase === PHASE.BLOCK ? 1 - norm : norm;
    return 0.25 + 0.75 * good;
  }

  isPerfect(value, phase) {
    return phase === PHASE.BLOCK ? value === this.minValue() : value === this.maxValue();
  }
  isWorst(value, phase) {
    return phase === PHASE.BLOCK ? value === this.maxValue() : value === this.minValue();
  }

  perk(key, fallback) {
    const v = this.player.perk && this.player.perk[key];
    return v == null ? fallback : v;
  }

  comboMult() {
    const boost = this.perk('comboBoost', 0);
    return COMBO_STEPS[Math.min(this.combo + (this.combo > 0 ? boost : 0), COMBO_STEPS.length - 1)];
  }

  // ── turn flow ─────────────────────────────────────────────────────────
  begin() {
    this.phase = PHASE.STRIKE;
    this.nextQuestion();
    return this.phase;
  }

  nextQuestion() {
    this.question = this.pickQuestion();
    this.eliminated = [];
    this.askedAt = performance.now();
    return this.question;
  }

  /** Burn a nutmeg: remove one of the two non-ideal options. */
  useNutmeg() {
    if (this.player.nutmegs <= 0 || this.eliminated.length > 0) return false;
    const ideal = this.phase === PHASE.BLOCK ? this.minValue() : this.maxValue();
    const candidates = this.question.options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => o.value !== ideal);
    if (candidates.length === 0) return false;
    // Remove the worst of the remaining, so it's a genuine 50:50 after.
    candidates.sort((a, b) =>
      this.ratioFor(a.o.value, this.phase) - this.ratioFor(b.o.value, this.phase));
    this.eliminated = [candidates[0].i];
    this.player.nutmegs--;
    return true;
  }

  /**
   * Player commits to an option.
   * @returns a result object the UI narrates.
   */
  answer(optionIndex, elapsedMs) {
    const opt = this.question.options[optionIndex];
    const phase = this.phase;
    const elapsed = elapsedMs == null ? performance.now() - this.askedAt : elapsedMs;
    const timedOut = elapsed >= ANSWER_MS;

    const ratio = timedOut ? 0.15 : this.ratioFor(opt.value, phase);
    const perfect = !timedOut && this.isPerfect(opt.value, phase);
    const worst = timedOut || this.isWorst(opt.value, phase);

    // speed bonus decays linearly over the clock
    const speed = timedOut ? 0
      : SPEED_BONUS_MAX * this.perk('speedMult', 1) * (1 - Math.min(1, elapsed / ANSWER_MS));

    this.answered++;
    if (perfect) {
      this.perfects++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else {
      this.combo = 0;
    }

    const result = {
      phase, option: opt, optionIndex, perfect, worst, timedOut,
      ratio, speed, elapsed,
      correctValue: phase === PHASE.BLOCK ? this.minValue() : this.maxValue(),
      note: this.question.note,
      unit: this.question.unit,
      card: null, damage: 0, taken: 0, rep: 0,
    };

    if (phase === PHASE.STRIKE) {
      const base = this.player.power * (1 + (this.level - 1) * 0.1);
      let dmg = base * ratio * (1 + speed) * this.comboMult();
      if (perfect) dmg *= 1 + CRIT_BONUS;
      dmg = Math.max(1, Math.round(dmg));
      this.foe.hp = Math.max(0, this.foe.hp - dmg);
      result.damage = dmg;
      result.rep = perfect ? 25 : Math.round(12 * ratio);

      // A truly feeble answer gets you booked.
      if (worst && !timedOut) result.card = this.book();
      else if (timedOut) result.card = this.book();
    } else {
      // BLOCK: ratio 1.0 means best pick, which should take the LEAST damage.
      const floor = this.perk('blockFloor', BLOCK_FLOOR);
      const through = floor + (1 - floor) * (1 - (ratio - 0.25) / 0.75);
      let taken = Math.round(this.pendingIncoming * through * this.perk('glassJaw', 1));
      taken = Math.max(1, taken);
      this.player.hp = Math.max(0, this.player.hp - taken);
      result.taken = taken;
      result.blocked = Math.max(0, this.pendingIncoming - taken);
      result.rep = perfect ? 18 : Math.round(8 * ratio);
    }

    result.rep = Math.round(result.rep * this.perk('repMult', 1));
    this.repEarned += result.rep;
    this.lastResult = result;
    this.phase = PHASE.RESOLVE;
    this.log.push(result);
    return result;
  }

  book() {
    this.yellowCards++;
    if (this.yellowCards >= 2 && !this.redCard) {
      this.redCard = true;
      this.skipNext = true;
      return 'red';
    }
    return 'yellow';
  }

  /**
   * Advance out of RESOLVE. Returns the next phase, having run the opponent's
   * turn if it's theirs.
   */
  advance() {
    if (this.foe.hp <= 0) { this.phase = PHASE.WON; return this.phase; }
    if (this.player.hp <= 0) { this.phase = PHASE.LOST; return this.phase; }

    const wasStrike = this.lastResult.phase === PHASE.STRIKE;

    if (wasStrike) {
      // Their go. Work out how hard it's coming, then ask the player to block.
      if (this.skipCheck()) return this.phase;
      this.pendingIncoming = this.foeAttack();
      this.phase = PHASE.BLOCK;
      this.nextQuestion();
    } else {
      this.round++;
      this.phase = PHASE.STRIKE;
      this.nextQuestion();
    }
    return this.phase;
  }

  /** Red card: you sit the next exchange out and just eat the hit. */
  skipCheck() {
    if (!this.skipNext) return false;
    this.skipNext = false;
    const incoming = Math.round(this.foeAttack() * this.perk('glassJaw', 1));
    this.player.hp = Math.max(0, this.player.hp - incoming);
    this.lastResult = {
      phase: PHASE.BLOCK, sentOff: true, taken: incoming, damage: 0,
      option: null, perfect: false, worst: true, rep: 0,
      note: 'Sent off. You watch that one go past from the touchline.',
    };
    this.log.push(this.lastResult);
    this.phase = this.player.hp <= 0 ? PHASE.LOST : PHASE.RESOLVE;
    return true;
  }

  /**
   * The opponent answers their own question off-screen. `guile` is their hit
   * rate on the perfect pick; the rest of the time they fluff it, same as us.
   */
  foeAttack() {
    const nailed = this.rng.chance(this.foe.guile);
    const ratio = nailed ? 1 : 0.25 + this.rng() * 0.5;
    let dmg = this.foe.power * ratio;
    if (nailed) dmg *= 1.25;
    // fast opponents sometimes get a second dig in
    if (this.foe.speed >= 3 && this.rng.chance(0.18)) dmg *= 1.4;
    this.lastFoeNailed = nailed;
    return Math.max(1, Math.round(dmg));
  }

  /** Rep bonus for finishing the job. */
  victoryRep() {
    const base = 100 * this.level * (this.foe.boss ? 3 : 1);
    const accuracy = this.answered ? this.perfects / this.answered : 0;
    const cleanSheet = this.player.hp === this.player.maxHp ? 150 : 0;
    return Math.round((base + accuracy * 200 + this.bestCombo * 40 + cleanSheet)
      * this.perk('repMult', 1));
  }

  summary() {
    return {
      rounds: this.round,
      answered: this.answered,
      perfects: this.perfects,
      accuracy: this.answered ? this.perfects / this.answered : 0,
      bestCombo: this.bestCombo,
      cards: this.yellowCards,
      redCard: this.redCard,
      rep: this.repEarned,
    };
  }
}
