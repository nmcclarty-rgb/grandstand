/**
 * GRANDSTAND — local hot-seat PvP.
 *
 * Two players, one device, pass it across. Symmetric: no block phase, you just
 * take it in turns to hit each other with a number. A "PASS THE DEVICE" screen
 * sits between turns so nobody reads the other's question over their shoulder.
 *
 * Online PvP is deliberately not here. See DESIGN.md "What's not built".
 */

import { QUESTIONS } from '../data/questions.js';
import { makeRng } from '../engine/rng.js';
import { ANSWER_MS, SPEED_BONUS_MAX, CRIT_BONUS, COMBO_STEPS } from './battle.js';

export const PVP_HP = 140;
export const PVP_POWER = 24;

export const PVP_PHASE = {
  HANDOVER: 'handover',
  ANSWER: 'answer',
  RESOLVE: 'resolve',
  DONE: 'done',
};

export class PvpMatch {
  constructor(p1, p2, opts = {}) {
    this.rng = makeRng(opts.seed || (Date.now() & 0xffffffff));
    this.sports = opts.sports || [];
    this.used = new Set();
    this.bestOf = opts.bestOf || 1;
    this.players = [
      { ...p1, hp: PVP_HP, maxHp: PVP_HP, power: PVP_POWER, combo: 0, perfects: 0, answered: 0 },
      { ...p2, hp: PVP_HP, maxHp: PVP_HP, power: PVP_POWER, combo: 0, perfects: 0, answered: 0 },
    ];
    this.turn = 0;             // index of whoever is on strike
    this.round = 1;
    this.phase = PVP_PHASE.HANDOVER;
    this.question = null;
    this.lastResult = null;
    this.winner = null;
  }

  get active() { return this.players[this.turn]; }
  get target() { return this.players[1 - this.turn]; }

  pickQuestion() {
    const filter = this.sports;
    let pool = QUESTIONS.map((q, i) => ({ q, i }))
      .filter(({ q }) => !filter.length || filter.includes(q.sport));
    if (!pool.length) pool = QUESTIONS.map((q, i) => ({ q, i }));
    let fresh = pool.filter(({ i }) => !this.used.has(i));
    if (!fresh.length) { this.used.clear(); fresh = pool; }
    const chosen = this.rng.pick(fresh);
    this.used.add(chosen.i);
    const order = this.rng.shuffle(chosen.q.options.map((_, i) => i));
    return { ...chosen.q, index: chosen.i, options: order.map((i) => chosen.q.options[i]) };
  }

  /** Called after the handover screen is dismissed by the player taking over. */
  beginTurn() {
    this.question = this.pickQuestion();
    this.askedAt = performance.now();
    this.phase = PVP_PHASE.ANSWER;
    return this.question;
  }

  values() { return this.question.options.map((o) => o.value); }

  answer(optionIndex, elapsedMs) {
    const opt = this.question.options[optionIndex];
    const vals = this.values();
    const max = Math.max(...vals), min = Math.min(...vals);
    const elapsed = elapsedMs == null ? performance.now() - this.askedAt : elapsedMs;
    const timedOut = elapsed >= ANSWER_MS;

    const ratio = timedOut ? 0.15
      : (max === min ? 1 : 0.25 + 0.75 * ((opt.value - min) / (max - min)));
    const perfect = !timedOut && opt.value === max;
    const speed = timedOut ? 0 : SPEED_BONUS_MAX * (1 - Math.min(1, elapsed / ANSWER_MS));

    const me = this.active, them = this.target;
    me.answered++;
    if (perfect) { me.perfects++; me.combo++; } else { me.combo = 0; }

    let dmg = me.power * ratio * (1 + speed) * COMBO_STEPS[Math.min(me.combo, COMBO_STEPS.length - 1)];
    if (perfect) dmg *= 1 + CRIT_BONUS;
    dmg = Math.max(1, Math.round(dmg));
    them.hp = Math.max(0, them.hp - dmg);

    this.lastResult = {
      by: this.turn, option: opt, optionIndex, perfect, timedOut, damage: dmg,
      correctValue: max, unit: this.question.unit, note: this.question.note,
      combo: me.combo,
    };
    this.phase = PVP_PHASE.RESOLVE;
    return this.lastResult;
  }

  advance() {
    if (this.target.hp <= 0) {
      this.winner = this.turn;
      this.phase = PVP_PHASE.DONE;
      return this.phase;
    }
    this.turn = 1 - this.turn;
    if (this.turn === 0) this.round++;
    this.phase = PVP_PHASE.HANDOVER;
    return this.phase;
  }
}
