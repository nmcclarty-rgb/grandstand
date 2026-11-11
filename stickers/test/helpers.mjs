import { readFileSync } from 'node:fs';
import { makePool } from '../src/engine/deck.js';

let n = 0;
// A fake career card with just enough to score. Override anything.
//   club / season  where he played (becomes his only club-season, so two cards with the same club and season are team-mates)
//   stints, clubs, first   set directly when a test needs a longer career
//   goals, assists, games, yellow, red   his real totals. In tests his RATING in each stat equals the number, so the
//   arithmetic is checkable by eye. Give `rate` to say otherwise.
export const mk = (over = {}) => {
  const club = over.club ?? 'ARS';
  const season = over.season ?? '2017-18';
  const { season: _s, ...rest } = over;
  const card = {
    uid: `t${++n}`, id: `t${n}`, name: `P${n}`, full: `First P${n}`,
    pos: 'MID', edition: 'base',
    club, clubs: [[club, 100]], stints: [`${club}|${season}`], first: season, last: season,
    games: 0, goals: 0, assists: 0, yellow: 0, red: 0, rating: 50,
    ...rest,
  };
  card.rate = over.rate ?? { goals: card.goals, assists: card.assists, games: card.games, discipline: card.yellow + 3 * card.red };
  return card;
};

// 1 chip per rating point everywhere except goals and discipline (2 each), so the sums are checkable by eye.
export const scale = {
  goals: { perUnit: 2 }, assists: { perUnit: 1 }, games: { perUnit: 1 }, discipline: { perUnit: 2 },
};

export const loadJson = () => JSON.parse(readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
export const loadPool = () => makePool(loadJson());
