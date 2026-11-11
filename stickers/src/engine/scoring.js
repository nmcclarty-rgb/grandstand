// chips × mult, with the working shown.
//
// Order of play, which matters because xmult multiplies whatever is already there:
//   1. the hand's base chips and mult (at its training level)
//   2. each scoring card, left to right: its category chips, its edition, then every
//      manager's onCard effect. A retrigger repeats that whole step for the card.
//   3. cards held in your hand: a goalkeeper's Safe Hands adds mult for each one not played
//   4. each manager's onHand effect, in manager order
//   total = floor(chips × mult)
import { EDITIONS, cardChips, safeHands } from './cards.js';
import { evaluateHand, handBase, HANDS } from './hands.js';
import { JOKERS } from './jokers.js';

// ctx: { category, scale, jokers: [id], handLevels: {handType: level}, state: {handsLeft, discardsLeft},
//        held: [cards still in hand, not played] }
export function scoreHand(played, ctx) {
  const { category, scale } = ctx;
  const jokers = (ctx.jokers ?? []).map((id) => {
    const j = JOKERS[id];
    if (!j) throw new Error(`unknown manager '${id}'`);
    return j;
  });
  const state = ctx.state ?? { handsLeft: 1, discardsLeft: 0 };
  const chipsOf = (c) => cardChips(c, category, scale);

  const { type, scoring: scoringIdx } = evaluateHand(played, chipsOf);
  const scoring = scoringIdx.map((i) => played[i]);
  const j = { category, scale, handType: type, played, scoring, state };

  const base = handBase(type, ctx.handLevels?.[type] ?? 1);
  let chips = base.chips;
  let mult = base.mult;
  const trace = [{ src: HANDS[type].name, chips: base.chips, mult: base.mult, runChips: chips, runMult: mult }];

  const apply = (src, fx) => {
    if (!fx) return;
    const step = { src };
    if (fx.chips) { chips += fx.chips; step.chips = fx.chips; }
    if (fx.mult) { mult += fx.mult; step.mult = fx.mult; }
    if (fx.xmult) { mult *= fx.xmult; step.xmult = fx.xmult; }
    if (step.chips === undefined && step.mult === undefined && step.xmult === undefined) return;
    step.runChips = chips;
    step.runMult = mult;
    trace.push(step);
  };

  for (const card of scoring) {
    const extra = jokers.reduce((n, mgr) => n + (mgr.retrigger?.(card, j) ?? 0), 0);
    for (let pass = 0; pass <= extra; pass++) {
      const label = pass === 0 ? card.name : `${card.name} (again)`;
      apply(label, { chips: chipsOf(card) });
      const ed = EDITIONS[card.edition ?? 'base'];
      if (ed.chips || ed.mult || ed.xmult) apply(`${label} · ${ed.label}`, ed);
      for (const mgr of jokers) if (mgr.onCard) apply(`${mgr.name} → ${label}`, mgr.onCard(card, j));
    }
  }
  // held in hand: not scored, but a keeper's Safe Hands still counts
  for (const card of ctx.held ?? []) {
    const m = safeHands(card);
    if (m) apply(`Safe Hands: ${card.name} (held)`, { mult: m });
  }
  for (const mgr of jokers) if (mgr.onHand) apply(mgr.name, mgr.onHand(j));

  return {
    type,
    handName: HANDS[type].name,
    scoring: scoringIdx,
    chips,
    mult,
    total: Math.floor(chips * mult + 1e-9),
    trace,
  };
}
