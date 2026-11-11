// Hand detection: poker hands, but football.
//
// "Rank" is the team-season (Arsenal 2017/18), "suit" is the club, and a straight
// is a run of consecutive seasons. Only the cards that make the hand score, as in
// Balatro, so a lone kicker adds nothing and building the combo matters more than
// playing your five biggest numbers.
import { POSITIONS, teamKey, seasonStart } from './cards.js';

// chips/mult: base values. lvl: what each training level adds. Ordered by base value,
// highest first. That is also the priority order when a hand matches several.
export const HANDS = {
  invincibles:  { name: 'The Invincibles',  blurb: '5 from one team-season',               chips: 120, mult: 12, lvl: [40, 3] },
  dynasty:      { name: 'Dynasty',          blurb: '5 seasons in a row, one club',         chips: 100, mult: 8,  lvl: [40, 3] },
  backFour:     { name: 'Back Four',        blurb: '4 from one team-season',               chips: 60,  mult: 7,  lvl: [30, 3] },
  fullStrength: { name: 'Full Strength',    blurb: '3 + 2 from two team-seasons',          chips: 40,  mult: 4,  lvl: [25, 2] },
  clubSide:     { name: 'Club Side',        blurb: '5 from one club, any seasons',         chips: 35,  mult: 4,  lvl: [15, 2] },
  run:          { name: 'Run of Seasons',   blurb: '5 consecutive seasons, any clubs',     chips: 30,  mult: 4,  lvl: [30, 3] },
  hatTrick:     { name: 'Hat-trick',        blurb: '3 cards of the same player',           chips: 30,  mult: 3,  lvl: [20, 2] },
  triangle:     { name: 'Triangle',         blurb: '3 from one team-season',               chips: 30,  mult: 3,  lvl: [20, 2] },
  spine:        { name: 'Spine',            blurb: 'GK + DEF + MID + FWD',                 chips: 20,  mult: 3,  lvl: [20, 2] },
  doubleAct:    { name: 'Double Act',       blurb: 'two pairs of team-mates',              chips: 20,  mult: 2,  lvl: [20, 1] },
  oneTwo:       { name: 'One-Two',          blurb: '2 from one team-season',               chips: 10,  mult: 2,  lvl: [15, 1] },
  kickabout:    { name: 'Kickabout',        blurb: 'nothing in common: best card only',    chips: 5,   mult: 1,  lvl: [10, 1] },
};
export const HAND_ORDER = Object.keys(HANDS);

function groupBy(cards, keyFn) {
  const map = new Map();
  cards.forEach((c, i) => {
    const k = keyFn(c);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  });
  return [...map.values()].sort((a, b) => b.length - a.length);
}

const consecutive = (cards) => {
  const years = cards.map(seasonStart).sort((a, b) => a - b);
  return years.every((y, i) => i === 0 || y === years[i - 1] + 1);
};

// cards: 1-5 played cards, in play order.
// chipsOf: card -> number, used only to choose the single scoring card of a Kickabout.
// -> { type, scoring: [indices into cards, ascending] }
export function evaluateHand(cards, chipsOf = () => 0) {
  const n = cards.length;
  if (n < 1 || n > 5) throw new Error(`a hand is 1-5 cards, got ${n}`);
  const all = cards.map((_, i) => i);
  const teams = groupBy(cards, teamKey);
  const clubs = groupBy(cards, (c) => c.club);
  const players = groupBy(cards, (c) => c.pid);
  const sizes = teams.map((g) => g.length);
  const sorted = (idx) => [...idx].sort((a, b) => a - b);
  const hit = (type, idx = all) => ({ type, scoring: sorted(idx) });

  if (n === 5 && sizes[0] === 5) return hit('invincibles');
  if (n === 5 && clubs[0].length === 5 && new Set(cards.map(seasonStart)).size === 5 && consecutive(cards)) return hit('dynasty');
  if (sizes[0] >= 4) return hit('backFour', teams[0].slice(0, 4));
  if (n === 5 && sizes[0] === 3 && sizes[1] === 2) return hit('fullStrength');
  if (n === 5 && clubs[0].length === 5) return hit('clubSide');
  if (n === 5 && new Set(cards.map(seasonStart)).size === 5 && consecutive(cards)) return hit('run');
  if (players[0].length >= 3) return hit('hatTrick', players[0].slice(0, 3));
  if (sizes[0] === 3) return hit('triangle', teams[0]);
  if (n >= 4 && POSITIONS.every((p) => cards.some((c) => c.pos === p))) return hit('spine');
  if (sizes[0] >= 2 && sizes[1] >= 2) return hit('doubleAct', [...teams[0].slice(0, 2), ...teams[1].slice(0, 2)]);
  if (sizes[0] === 2) return hit('oneTwo', teams[0]);

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
