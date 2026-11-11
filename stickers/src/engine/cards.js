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

// ---- names ---------------------------------------------------------------------------------------------------
// A card stores `full` ("Ian Wright") and `name`, the short display name, which carries an initial when the surname is
// shared by four or more players ("I.Wright"). The card face shows the first name above the surname, so it needs the
// two parts: the surname without the initial, and the first name.
export const surnameOf = (card) => card.name.replace(/^[A-Z]\./, '');

// The first given name: "Jimmy Floyd Hasselbaink" -> "Jimmy". '' for a mononym (Rodri, Willian, Jô). FBref writes some
// East Asian names surname-first ("Son Heung-min"), so the first name is what follows the surname there.
export function firstNameOf(card) {
  const sur = surnameOf(card);
  const full = card.full.replace(/\s+(jr|sr|jnr|snr)\.?$/i, '');
  if (full === sur) return '';
  if (full.startsWith(`${sur} `)) return full.slice(sur.length + 1).split(' ')[0];
  const head = full.endsWith(` ${sur}`) ? full.slice(0, -sur.length - 1) : full;
  if (/^El Hadji\b/.test(head)) return 'El Hadji';
  return head.split(' ')[0];
}

// 1992/93 to 1994/95 were 42-game seasons (22 clubs); their counting stats are scaled to 38 games in the build
// (meta.scaled in cards.json says the same, and a test keeps the two in step).
export const SCALED_SEASONS = ['1992-93', '1993-94', '1994-95'];
