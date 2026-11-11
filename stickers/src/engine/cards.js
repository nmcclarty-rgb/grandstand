// What a card is, what the Top Trumps categories are, and what editions do.
//
// A card is a player-season ("Salah, Liverpool 2017/18"). Same player in another
// season is another card with the same `pid`.

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

// The Top Trumps bit: each fixture names one category, and a card's number in it becomes its chips,
// scaled so the 99th percentile is worth 60 chips.
//
// RULE: only stats that exist for every season (1992/93 to 2025/26): goals, assists, games, yellow and red
// cards. Cards are one category, Discipline, because red cards alone are too rare to be a category. Clean sheets, saves and the like are not recorded for the early seasons, so they are not used.
export const CATEGORIES = {
  goals:      { label: 'GOALS',        short: 'GOALS',      unit: 'goals',  blurb: 'Every sticker is worth chips for the goals it scored.' },
  assists:    { label: 'ASSISTS',      short: 'ASSISTS',    unit: 'assists', blurb: 'Every sticker is worth chips for the assists it made.' },
  games:      { label: 'GAMES PLAYED', short: 'GAMES',      unit: 'games',  blurb: 'Every sticker is worth chips for the games it played.' },
  discipline: { label: 'DISCIPLINE',   short: 'DISCIPLINE', unit: 'points', blurb: 'Every sticker is worth chips for its record: a yellow card is 1 point, a red card is 3.' },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

// The Panini bit: some stickers are shiny. Same three slots as Balatro's
// foil / holographic / polychrome, one for each way to add to a score.
export const EDITIONS = {
  base:  { label: 'BASE',  blurb: '' },
  shiny: { label: 'SHINY', blurb: '+40 chips',  chips: 40 },
  holo:  { label: 'HOLO',  blurb: '+6 mult',    mult: 6 },
  gold:  { label: 'GOLD',  blurb: '×1.5 mult',  xmult: 1.5 },
};

export const teamKey = (card) => `${card.club}|${card.season}`;
export const seasonStart = (card) => Number.parseInt(card.season.slice(0, 4), 10);

// DISCIPLINE: the disciplinary record as one score. A yellow card is 1 point, a red card is 3. (Red cards alone are
// on only ~11% of cards, so as a category of their own most hands had nothing to score; combined, ~80% do.)
export const DISCIPLINE_POINTS = { yellow: 1, red: 3 };

// A card's number in a category. Four are plain stats on the card; discipline is derived.
export function statOf(card, category) {
  if (category === 'discipline') return card.yellow * DISCIPLINE_POINTS.yellow + card.red * DISCIPLINE_POINTS.red;
  return card[category];
}

// Chips a card is worth in a category. `scale` is meta.chipScale from cards.json.
export function cardChips(card, category, scale) {
  return Math.round(statOf(card, category) * scale[category].perUnit);
}

// 'goals' -> 'GOALS' etc. for display.
export const categoryLabel = (key) => CATEGORIES[key].label;

// The keeper's ability, SAFE HANDS: a goalkeeper held in your hand (not played) adds mult to every hand you
// play. Goalkeepers score almost nothing in any category, so this is their job: support. How much depends on
// how much he played (a stat every season has): a regular is worth more than a deputy.
//   30+ games: first choice, +3 mult    15-29: rotation, +2 mult    under 15: backup, +1 mult
export function safeHands(card) {
  if (card.pos !== 'GK') return 0;
  return card.games >= 30 ? 3 : card.games >= 15 ? 2 : 1;
}
