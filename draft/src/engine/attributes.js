// The attributes a match can count: a player's REAL Premier League career total in each, 1992/93 to 2025/26.
//
// Wins and clean sheets are ESTIMATES: a club-season's real wins (or clean sheets) from the match results, times the share of its minutes he was on the
// pitch. Clean sheets go to goalkeepers and defenders only, season by season (see stickers/tools/build-cards.mjs).
//
// Each one is complete for every season (see "Attributes we have" in the README). Adding one is one entry here: the draw, the bot's idea
// of value, the tally and the page all read this list. Blind Five has its own list, rather than reusing Sticker Season's four categories,
// so that adding one cannot change the card game's ratings.
import { statOf } from '../../../stickers/src/engine/cards.js';

export const ATTRIBUTES = [
  { key: 'goals',        label: 'GOALS',             short: 'GOALS',      unit: 'goals',                                          value: (c) => c.goals },
  { key: 'assists',      label: 'ASSISTS',           short: 'ASSISTS',    unit: 'assists',                                        value: (c) => c.assists },
  { key: 'involvements', label: 'GOAL INVOLVEMENTS', short: 'G+A',        unit: 'goal involvements (goals plus assists)',          value: (c) => c.goals + c.assists },
  { key: 'games',        label: 'APPEARANCES',       short: 'APPS',       unit: 'appearances',                                    value: (c) => c.games },
  { key: 'titles',       label: 'LEAGUE TITLES',     short: 'TITLES',     unit: 'Premier League titles (a season with the champions, 5+ league appearances)', value: (c) => c.titles },
  { key: 'wins',         label: 'WINS (EST.)',       short: 'WINS',       unit: 'Premier League wins while on the pitch (estimated from his minutes)', value: (c) => c.wins },
  { key: 'cleansheets',  label: 'CLEAN SHEETS (EST.)', short: 'CLEAN SHEETS', unit: 'clean sheets as a goalkeeper or defender (estimated from his minutes)', value: (c) => c.cleanSheets,
    // only goalkeepers and defenders earn them, so a 5-a-side match on this needs at least two of those slots to be worth playing
    needs: { positions: ['GK', 'DEF'], min: 2 } },
  { key: 'discipline',   label: 'DISCIPLINE',        short: 'DISCIPLINE', unit: 'discipline points (a yellow card is 1, a red 3)', value: (c) => statOf(c, 'discipline') },
];
export const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key);
export const ATTRIBUTE = Object.fromEntries(ATTRIBUTES.map((a) => [a.key, a]));

// a player's real career total in an attribute
export const valueOf = (card, key) => {
  const a = ATTRIBUTE[key];
  if (!a) throw new Error(`unknown attribute '${key}'`);
  return a.value(card);
};

// the all-time best in the pool in an attribute: the scale the bot measures worth against, and the tie-break for a level series
const records = new WeakMap();
export function recordOf(pool, key) {
  if (!records.has(pool)) records.set(pool, {});
  const r = records.get(pool);
  if (r[key] === undefined) r[key] = Math.max(...pool.cards.map((c) => valueOf(c, key)));
  return r[key];
}
