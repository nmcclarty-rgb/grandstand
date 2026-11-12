// Where cards come from: the pool (every player with 20+ Premier League appearances), the starter squad, and
// Panini-style packs.
import { POSITIONS, TIER_BANDS, EDITION_ORDER } from './cards.js';

// json: the parsed cards.json
export function makePool(json) {
  const cards = json.cards;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const byStint = new Map();   // 'CHE|2004-05' -> the cards who were at that club that season
  for (const c of cards) for (const s of c.stints) { if (!byStint.has(s)) byStint.set(s, []); byStint.get(s).push(c); }
  return { cards, byId, byStint, scale: json.meta.chipScale, seasons: json.meta.seasons, clubs: json.meta.clubs, meta: json.meta };
}

let uidCounter = 0;
// A card in a deck: the card, plus a unique id for this copy and an edition. There is only one of each player in a
// squad, but a copy can be a foil.
export const instance = (card, edition = 'base') => ({ ...card, uid: `u${++uidCounter}`, edition });

// ---- editions and duplicates ------------------------------------------------------------------------------------------
// You can only own one of each player. If a pack deals you a player you already have, keeping him UPGRADES your copy: one
// edition above the better of the two (base -> shiny -> holo -> gold), and gold stays gold.
export const nextEdition = (ed) => EDITION_ORDER[Math.min(EDITION_ORDER.indexOf(ed) + 1, EDITION_ORDER.length - 1)];
export const upgradedEdition = (owned, pulled) => nextEdition(EDITION_ORDER[Math.max(EDITION_ORDER.indexOf(owned), EDITION_ORDER.indexOf(pulled))]);

// ---- the starter squad -----------------------------------------------------------------------------------------------------
// `clubs` clubs (the sim: six, so that the big team-mate hands have to be built, not dealt), and for each a window of `seasons` consecutive seasons: the squad is the players who were at that club
// then, so they really were team-mates. `positions` is the whole squad's position budget (real squads are mostly outfield:
// goalkeepers are rare, which is what keeps Spine from being the answer to everything). Players are mid-table (an overall
// of 12 to 54: bronze and silver), the most-appearances first, dealt round-robin across the clubs.
export const STARTER_SHAPE = { clubs: 6, seasons: 2, positions: { GK: 2, DEF: 8, MID: 8, FWD: 6 } };
const MIDTABLE = (c) => c.rating >= 12 && c.rating <= 54;

export function starterDeck(pool, rng, shape = STARTER_SHAPE) {
  const { clubs: nClubs, seasons: nSeasons, positions } = { ...STARTER_SHAPE, ...shape };
  const share = Object.fromEntries(POSITIONS.map((p) => [p, Math.floor(positions[p] / nClubs)]));

  // the mid-table players who were at `club` at any point in a window of seasons
  const squadOf = (club, window) => {
    const seen = new Map();
    for (const season of window) for (const c of pool.byStint.get(`${club}|${season}`) ?? []) if (MIDTABLE(c)) seen.set(c.id, c);
    return [...seen.values()];
  };
  const enough = (group) => POSITIONS.every((p) => group.filter((c) => c.pos === p).length >= Math.max(1, share[p]));

  const options = new Map();
  for (const club of Object.keys(pool.clubs)) {
    const windows = [];
    for (let i = 0; i + nSeasons <= pool.seasons.length; i++) {
      const window = pool.seasons.slice(i, i + nSeasons);
      const y0 = Number.parseInt(window[0], 10);
      if (!window.every((x, k) => Number.parseInt(x, 10) === y0 + k)) continue;
      if (enough(squadOf(club, window))) windows.push(window);
    }
    if (windows.length) options.set(club, windows);
  }
  const chosen = rng.shuffle([...options.keys()]).slice(0, nClubs);
  if (chosen.length < nClubs) throw new Error('not enough clubs for a starter squad');
  const groups = chosen.map((club) => squadOf(club, rng.pick(options.get(club))));

  const deck = [];
  const used = new Set();
  POSITIONS.forEach((pos, pi) => {
    const queues = groups.map((g) => g.filter((c) => c.pos === pos).sort((a, b) => b.games - a.games || a.id.localeCompare(b.id)));
    for (let n = 0; n < positions[pos]; n++) {
      // round-robin, skipping any club that has run out of that position, and anyone already picked for another club
      let card = null;
      for (let k = 0; k < groups.length && !card; k++) {
        const q = queues[(n + pi + k) % groups.length];
        while (q.length && used.has(q[0].id)) q.shift();
        if (q.length) card = q.shift();
      }
      if (!card) throw new Error(`starter squad ran out of ${pos}s`);
      used.add(card.id);
      deck.push(instance(card));
    }
  });
  return deck;
}

// ---- packs -------------------------------------------------------------------------------------------------------------------
// Rarity is the card's tier, from its overall; the edition (foil) is rolled separately. Most stickers are bronze.
export const PACK_WEIGHTS = { bronze: 68, silver: 25, gold: 6, icon: 1 };
export const TIERS = TIER_BANDS.map((t) => ({ ...t, weight: PACK_WEIGHTS[t.id] }));
export const EDITION_ODDS = [['base', 86], ['shiny', 8], ['holo', 4], ['gold', 2]];

// filter: optional predicate on a card. A club pack only deals players who played for a club in your squad; a squad pack
// only players who were team-mates of someone in your squad. Rarity odds apply within whatever the pool leaves. Five
// DIFFERENT players: no two stickers in a pack are the same person.
export function openPack(pool, rng, size = 5, { filter } = {}) {
  const cards = filter ? pool.cards.filter(filter) : pool.cards;
  if (cards.length < size) throw new Error('not enough players match this pack');
  const tiers = TIERS.map((t) => ({ ...t, cards: cards.filter((c) => c.rating >= t.min && c.rating <= t.max) })).filter((t) => t.cards.length);
  const out = [], taken = new Set();
  while (out.length < size) {
    const tier = rng.weighted(tiers.map((t) => [t, t.weight]));
    const card = rng.pick(tier.cards);
    if (taken.has(card.id)) continue;
    taken.add(card.id);
    out.push(instance(card, rng.weighted(EDITION_ODDS)));
  }
  return out;
}
