// Where cards come from: the pool (every player-season), the starter squad, and
// Panini-style packs.
import { POSITIONS, teamKey } from './cards.js';

// json: the parsed cards.json
export function makePool(json) {
  const cards = json.cards;
  const byTeam = new Map();
  for (const c of cards) {
    const k = teamKey(c);
    if (!byTeam.has(k)) byTeam.set(k, []);
    byTeam.get(k).push(c);
  }
  return { cards, scale: json.meta.chipScale, seasons: json.meta.seasons, clubs: json.meta.clubs, byTeam };
}

let uidCounter = 0;
// A card in a deck: same data, plus a unique id (you can own two copies) and an edition.
export const instance = (card, edition = 'base') => ({ ...card, uid: `u${++uidCounter}`, edition });

// The starter squad: `clubs` clubs x `seasons` consecutive seasons each, so every
// "rank" is a team-season and every "suit" is a club. `positions` is the whole
// squad's position budget (real squads are mostly outfield: goalkeepers are rare,
// which is what keeps Spine from being the answer to everything). Cards are mid-table
// (rating 25-80), the most-played first, dealt round-robin across the team-seasons.
export const STARTER_SHAPE = { clubs: 3, seasons: 3, positions: { GK: 2, DEF: 8, MID: 8, FWD: 6 } };
// Starter cards are mid-table (rating 25-80). Every card has the same three stats whatever its era, so any
// era can supply a starter squad.
const MIDTABLE = (c) => c.rating >= 25 && c.rating <= 80;

export function starterDeck(pool, rng, shape = STARTER_SHAPE) {
  const { clubs: nClubs, seasons: nSeasons, positions } = { ...STARTER_SHAPE, ...shape };
  const teamsNeeded = nClubs * nSeasons;
  // every team-season must cover its guaranteed share of each position; the remainder is dealt on
  const share = Object.fromEntries(POSITIONS.map((p) => [p, Math.floor(positions[p] / teamsNeeded)]));
  const enough = (group) => POSITIONS.every((p) => group.filter((c) => c.pos === p && MIDTABLE(c)).length >= Math.max(1, share[p]));

  // clubs that have `nSeasons` consecutive seasons where a mid-table squad can be found
  const options = new Map();
  for (const club of Object.keys(pool.clubs)) {
    const runs = [];
    for (let i = 0; i + nSeasons <= pool.seasons.length; i++) {
      const window = pool.seasons.slice(i, i + nSeasons);
      const y0 = Number.parseInt(window[0], 10);
      if (!window.every((x, k) => Number.parseInt(x, 10) === y0 + k)) continue; // a gap in the data is not a run of seasons
      const groups = window.map((season) => pool.byTeam.get(`${club}|${season}`));
      if (groups.every((g) => g && enough(g))) runs.push(window);
    }
    if (runs.length) options.set(club, runs);
  }
  const chosen = rng.shuffle([...options.keys()]).slice(0, nClubs);
  if (chosen.length < nClubs) throw new Error('not enough clubs for a starter squad');
  const teams = chosen.flatMap((club) => rng.pick(options.get(club)).map((season) => pool.byTeam.get(`${club}|${season}`)));

  const deck = [];
  POSITIONS.forEach((pos, pi) => {
    const queues = teams.map((g) => g.filter((c) => c.pos === pos && MIDTABLE(c)).sort((a, b) => b.games - a.games));
    for (let n = 0; n < positions[pos]; n++) {
      // round-robin, skipping any team-season that has run out of that position
      const q = Array.from({ length: teams.length }, (_, k) => queues[(n + pi + k) % teams.length]).find((x) => x.length);
      if (!q) throw new Error(`starter squad ran out of ${pos}s`);
      deck.push(instance(q.shift()));
    }
  });
  return deck;
}

// Pack odds. Rarity is the card's rating band; edition is rolled separately.
export const TIERS = [
  { id: 'common',   min: 1,  max: 59, weight: 60 },
  { id: 'uncommon', min: 60, max: 84, weight: 28 },
  { id: 'rare',     min: 85, max: 96, weight: 10 },
  { id: 'legend',   min: 97, max: 99, weight: 2 },
];
export const EDITION_ODDS = [['base', 86], ['shiny', 8], ['holo', 4], ['gold', 2]];

export function openPack(pool, rng, size = 5) {
  const tiers = TIERS.map((t) => ({ ...t, cards: pool.cards.filter((c) => c.rating >= t.min && c.rating <= t.max) }));
  return Array.from({ length: size }, () => {
    const tier = rng.weighted(tiers.map((t) => [t, t.weight]));
    return instance(rng.pick(tier.cards), rng.weighted(EDITION_ODDS));
  });
}
