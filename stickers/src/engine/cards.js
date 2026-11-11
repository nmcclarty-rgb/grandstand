// What a card is, what the Top Trumps categories are, and what editions do.
//
// A card is a player-season ("Salah, Liverpool 2017/18"). Same player in another
// season is another card with the same `pid`.

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

// The Top Trumps bit: each fixture names one category, and a card's chips are its
// number in that category, scaled so the 99th percentile is worth 60 chips.
export const CATEGORIES = {
  goals:       { label: 'GOALS',        short: 'GOALS',   unit: 'goals' },
  assists:     { label: 'ASSISTS',      short: 'ASSISTS', unit: 'assists' },
  games:       { label: 'GAMES PLAYED', short: 'GAMES',   unit: 'games' },
  cleanSheets: { label: 'CLEAN SHEETS', short: 'CLEAN SHEETS', unit: 'clean sheets' },
  saves:       { label: 'SAVES',        short: 'SAVES',   unit: 'saves' },
  bonus:       { label: 'BONUS POINTS', short: 'BONUS',   unit: 'bonus pts' },
  price:       { label: 'VALUE (£m)',   short: 'VALUE',   unit: '£m' },
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

// Chips a card is worth in a category. `scale` is meta.chipScale from cards.json.
export function cardChips(card, category, scale) {
  return Math.round(card[category] * scale[category].perUnit);
}

// 'goals' -> 'GOALS' etc. for display.
export const categoryLabel = (key) => CATEGORIES[key].label;
