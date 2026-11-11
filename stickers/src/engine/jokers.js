// Managers: the Balatro jokers. Each one bends the arithmetic in one way.
//
//   onCard(card, j)   fires for every scoring card, left to right (and again on a retrigger)
//   onHand(j)         fires once after all cards have scored, in manager order
//   retrigger(card, j) -> extra times this scoring card scores again
//
// Effects are { chips, mult, xmult }; any may be omitted. `j` is the scoring context:
//   { category, scale, handType, played, scoring, index, state }
// where `scoring` is the array of cards that are scoring and `state` is the round
// ({ handsLeft, discardsLeft, ... }; handsLeft counts this hand).
import { CATEGORIES } from './cards.js';

const inCategory = (key) => (j) => j.category === key;

function specialist(id, name, category) {
  return {
    id, name, cost: 6,
    blurb: `×1.5 mult on ${CATEGORIES[category].label} fixtures`,
    onHand: (j) => (inCategory(category)(j) ? { xmult: 1.5 } : undefined),
  };
}

const list = [
  {
    id: 'parkTheBus', name: 'Park the Bus', cost: 4,
    blurb: 'each scoring DEF: +4 mult',
    onCard: (c) => (c.pos === 'DEF' ? { mult: 4 } : undefined),
  },
  {
    id: 'routeOne', name: 'Route One', cost: 4,
    blurb: 'each scoring FWD: +30 chips',
    onCard: (c) => (c.pos === 'FWD' ? { chips: 30 } : undefined),
  },
  {
    id: 'sweeperKeeper', name: 'Sweeper Keeper', cost: 5,
    blurb: 'a scoring GK: ×2 mult',
    onHand: (j) => (j.scoring.some((c) => c.pos === 'GK') ? { xmult: 2 } : undefined),
  },
  {
    id: 'totalFootball', name: 'Total Football', cost: 5,
    blurb: 'scoring cards from 3+ clubs: +12 mult',
    onHand: (j) => (new Set(j.scoring.map((c) => c.club)).size >= 3 ? { mult: 12 } : undefined),
  },
  {
    id: 'oneClubMan', name: 'One-Club Man', cost: 6,
    blurb: 'each scoring one-club man (8+ seasons, one club): +6 mult',
    onCard: (c) => (c.clubs.length === 1 && c.stints.length >= 8 ? { mult: 6 } : undefined),
  },
  {
    id: 'goldenBoot', name: 'Golden Boot', cost: 5,
    blurb: 'each scoring card with a Goals rating of 60+: +4 mult',
    onCard: (c) => (c.rate.goals >= 60 ? { mult: 4 } : undefined),
  },
  {
    id: 'playmaker', name: 'Playmaker', cost: 5,
    blurb: 'each scoring card with an Assists rating of 60+: +4 mult',
    onCard: (c) => (c.rate.assists >= 60 ? { mult: 4 } : undefined),
  },
  {
    id: 'addedTime', name: 'Added Time', cost: 6,
    blurb: 'on your last hand of the fixture: ×2 mult',
    onHand: (j) => (j.state.handsLeft === 1 ? { xmult: 2 } : undefined),
  },
  {
    id: 'vintage', name: 'Vintage Stickers', cost: 4,
    blurb: 'each scoring card who debuted in the 1990s: +20 chips',
    onCard: (c) => (c.first < '2000-01' ? { chips: 20 } : undefined),
  },
  {
    id: 'superSub', name: 'Super Sub', cost: 4,
    blurb: '+15 chips for every discard you have left',
    onHand: (j) => (j.state.discardsLeft > 0 ? { chips: 15 * j.state.discardsLeft } : undefined),
  },
  {
    id: 'captain', name: "Captain's Armband", cost: 7,
    blurb: 'the first scoring card scores again',
    retrigger: (c, j) => (c === j.scoring[0] ? 1 : 0),
  },
  specialist('poacher', 'Poacher', 'goals'),
  specialist('creator', 'Creator', 'assists'),
  specialist('ironman', 'Ironman', 'games'),
  specialist('hardMan', 'Hard Man', 'discipline'),
];

export const JOKERS = Object.fromEntries(list.map((j) => [j.id, j]));
export const JOKER_IDS = list.map((j) => j.id);
