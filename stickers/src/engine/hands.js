// Hand detection: poker hands, but football.
//
// A card is a whole career, so he has played at several clubs in several seasons: his CLUB-SEASONS are his `stints`
// ('CHE|2004-05'). Two cards are TEAM-MATES if they share a club-season. The hands ask whether the cards you play have a
// club-season in common:
//   One-Two      2 who shared a club-season          Back Four     4 who shared one
//   Triangle     3 who shared one                    The Invincibles  all 5 shared one
//   Double Act   two such pairs                      Full Strength  a trio and a pair, each sharing one
//   Club Side    5 who all played for one club, any time
//   Class Of     5 who all made their debut within 3 seasons of each other
//   Hat-trick    3 foil stickers (shiny, holo or gold)
//   Spine        a GK, a DEF, a MID and a FWD (a Double Act outranks it)
// Only the cards that make the hand score, as in Balatro, so a lone kicker adds nothing.
import { POSITIONS } from './cards.js';

// chips/mult: base values. lvl: what each training level adds. Ordered by base value, highest first. That is also the
// priority when a hand matches several.
export const HANDS = {
  invincibles:  { name: 'The Invincibles', blurb: '5 who were all at one club in one season',  chips: 120, mult: 12, lvl: [40, 3] },
  backFour:     { name: 'Back Four',       blurb: '4 who were at one club in one season',      chips: 60,  mult: 7,  lvl: [30, 3] },
  fullStrength: { name: 'Full Strength',   blurb: '3 + 2 who were team-mates',                 chips: 40,  mult: 4,  lvl: [25, 2] },
  clubSide:     { name: 'Club Side',       blurb: '5 who all played for one club',             chips: 35,  mult: 4,  lvl: [15, 2] },
  classOf:      { name: 'Class Of',        blurb: '5 who all debuted within 3 seasons',        chips: 30,  mult: 4,  lvl: [30, 3] },
  hatTrick:     { name: 'Hat-trick',       blurb: '3 foil stickers',                           chips: 30,  mult: 3,  lvl: [20, 2] },
  triangle:     { name: 'Triangle',        blurb: '3 who were at one club in one season',      chips: 30,  mult: 3,  lvl: [20, 2] },
  doubleAct:    { name: 'Double Act',      blurb: 'two pairs of team-mates',                   chips: 20,  mult: 2,  lvl: [20, 1] },
  spine:        { name: 'Spine',           blurb: 'GK + DEF + MID + FWD',                      chips: 15,  mult: 2,  lvl: [15, 1] },
  oneTwo:       { name: 'One-Two',         blurb: '2 who were at one club in one season',      chips: 10,  mult: 2,  lvl: [15, 1] },
  kickabout:    { name: 'Kickabout',       blurb: 'nothing in common: best card only',         chips: 5,   mult: 1,  lvl: [10, 1] },
};
export const HAND_ORDER = Object.keys(HANDS);

// ---- helpers -------------------------------------------------------------------------------------------------------
function combos(n, k) {
  const out = [];
  (function rec(start, cur) {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = start; i < n; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  })(0, []);
  return out;
}

// the club-seasons every one of these cards has in common
export function sharedStints(cards, idxs = cards.map((_, i) => i)) {
  let shared = new Set(cards[idxs[0]].stints);
  for (const i of idxs.slice(1)) shared = new Set(cards[i].stints.filter((s) => shared.has(s)));
  return [...shared];
}
const sharedClubs = (cards) => {
  let shared = new Set(cards[0].clubs.map(([c]) => c));
  for (const c of cards.slice(1)) shared = new Set(c.clubs.map(([k]) => k).filter((k) => shared.has(k)));
  return [...shared];
};
const debutYear = (card) => Number.parseInt(card.first.slice(0, 4), 10);
const isTeam = (cards, idxs) => sharedStints(cards, idxs).length > 0;

// the k cards, of those given, that are team-mates and have the most chips between them
function bestTeam(cards, k, chipsOf) {
  let best = null;
  for (const idxs of combos(cards.length, k)) {
    if (!isTeam(cards, idxs)) continue;
    const score = idxs.reduce((s, i) => s + chipsOf(cards[i]), 0);
    if (!best || score > best.score) best = { idxs, score };
  }
  return best?.idxs ?? null;
}

// cards: 1-5 played cards, in play order.
// chipsOf: card -> number, used to choose WHICH cards score when several would do (e.g. the best pair of three team-mates).
// -> { type, scoring: [indices into cards, ascending] }
export function evaluateHand(cards, chipsOf = () => 0) {
  const n = cards.length;
  if (n < 1 || n > 5) throw new Error(`a hand is 1-5 cards, got ${n}`);
  const all = cards.map((_, i) => i);
  const hit = (type, idx = all) => ({ type, scoring: [...idx].sort((a, b) => a - b) });

  if (n === 5 && isTeam(cards, all)) return hit('invincibles');
  if (n >= 4) { const four = bestTeam(cards, 4, chipsOf); if (four) return hit('backFour', four); }
  if (n === 5) {
    // a trio and the remaining pair, each sharing a club-season of their own
    for (const trio of combos(5, 3)) {
      const pair = all.filter((i) => !trio.includes(i));
      if (isTeam(cards, trio) && isTeam(cards, pair)) return hit('fullStrength');
    }
    if (sharedClubs(cards).length > 0) return hit('clubSide');
    const years = cards.map(debutYear);
    if (Math.max(...years) - Math.min(...years) <= 2) return hit('classOf');
  }
  const foils = all.filter((i) => (cards[i].edition ?? 'base') !== 'base');
  if (foils.length >= 3) return hit('hatTrick', foils);
  const three = n >= 3 ? bestTeam(cards, 3, chipsOf) : null;
  if (three) return hit('triangle', three);
  if (n >= 4) {
    // two disjoint pairs, each team-mates: the pair of pairs with the most chips
    let best = null;
    for (const first of combos(n, 2)) {
      if (!isTeam(cards, first)) continue;
      const rest = all.filter((i) => !first.includes(i));
      for (const second of combos(rest.length, 2).map((c) => c.map((x) => rest[x]))) {
        if (!isTeam(cards, second)) continue;
        const score = [...first, ...second].reduce((s, i) => s + chipsOf(cards[i]), 0);
        if (!best || score > best.score) best = { idxs: [...first, ...second], score };
      }
    }
    if (best) return hit('doubleAct', best.idxs);
  }
  if (n >= 4 && POSITIONS.every((p) => cards.some((c) => c.pos === p))) return hit('spine');
  const two = n >= 2 ? bestTeam(cards, 2, chipsOf) : null;
  if (two) return hit('oneTwo', two);

  let best = 0;
  for (let i = 1; i < n; i++) if (chipsOf(cards[i]) > chipsOf(cards[best])) best = i;
  return hit('kickabout', [best]);
}

// Base chips and mult for a hand at a training level (level 1 = no bonus).
export function handBase(type, level = 1) {
  const h = HANDS[type];
  const up = Math.max(0, level - 1);
  return { chips: h.chips + h.lvl[0] * up, mult: h.mult + h.lvl[1] * up };
}
