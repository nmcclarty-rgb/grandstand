// What a card is, what the Top Trumps categories are, and what editions do.
//
// A card is a PLAYER, his whole Premier League career since 1992/93: "Frank Lampard, 609 appearances, 177 goals".
// There is only one of him. He carries
//   the REAL TOTALS      games (appearances), goals, assists, yellow, red     shown on the card, in the record books' terms
//   a RATING per stat    rate.goals / assists / games / discipline, 1-99      what actually scores
//   an OVERALL           rating, 1-99                                          his headline number, and how rare he is
//   his CLUBS            club (most appearances), clubs [[club, apps]...]
//   his CLUB-SEASONS     stints ['CHE|2004-05', ...]                          how two players come to be team-mates
//   his span             first, last                                           the first and last season he played

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

// The Top Trumps bit: each fixture names one category, and a card is worth chips in it according to its RATING (1-99)
// for that stat, not its raw total: a career total is wildly lopsided (the median player has 2 goals, Shearer 260), so the
// total is for reading and the rating is for playing.
//
// RULE: only stats that exist for every season (1992/93 to 2025/26): appearances, goals, assists, yellow and red cards.
// Cards are one category, Discipline, because red cards alone are too rare to be a category. Clean sheets, saves and the
// like are not recorded for the early seasons, so they are not used.
export const CATEGORIES = {
  goals:      { label: 'GOALS',        short: 'GOALS',      unit: 'goals',  blurb: 'Every sticker is worth chips for its goals rating.' },
  assists:    { label: 'ASSISTS',      short: 'ASSISTS',    unit: 'assists', blurb: 'Every sticker is worth chips for its assists rating.' },
  games:      { label: 'GAMES PLAYED', short: 'APPS',       unit: 'games',  blurb: 'Every sticker is worth chips for its appearances rating.' },
  discipline: { label: 'DISCIPLINE',   short: 'DISCIPLINE', unit: 'points', blurb: 'Every sticker is worth chips for its disciplinary record: a yellow card is 1 point, a red card is 3.' },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

// ---- ratings ------------------------------------------------------------------------------------------------------
// A rating is measured against the BEST EVER in the pool: 99 is the record (Shearer's 260 goals, Giggs's 162 assists, Barry's
// 653 appearances) and everyone else is a fraction of it, on a gentle curve (the exponent). 0 is always 1.
//   rating = 99 x (total / record) ^ RATING_EXPONENT
// Measuring against the record, rather than ranking players, is what keeps a legend apart from a long career: a rank would
// put 56 goals and 260 goals both in the top few percent. chips = rating x RATING_TO_CHIPS, so a rating of 99 is worth 60.
export const RATING_EXPONENT = 0.35;
export const RATING_TO_CHIPS = 0.606;
export const ratingFor = (total, record) => (total > 0 ? Math.min(99, Math.max(2, Math.round(99 * (total / record) ** RATING_EXPONENT))) : 1);

// OVERALL = his ratings, weighted for what his position is for. Discipline is not in it (a booking is not a skill). A forward
// is his goals. We have no defensive or goalkeeping stats, so a defender is mostly how long he lasted and a keeper is how much
// he played (discounted, or keepers, who play every week, would fill the top of the list): a limit of the data, not a judgement.
export const OVR_WEIGHTS = {
  FWD: { goals: 0.60, assists: 0.25, games: 0.15 },
  MID: { goals: 0.25, assists: 0.40, games: 0.35 },
  DEF: { goals: 0.15, assists: 0.25, games: 0.60 },
  GK:  { games: 0.80 },   // no saving stats, so a keeper's overall is how much he played, discounted by 20%
};
export const overallOf = (position, rate) => Object.entries(OVR_WEIGHTS[position]).reduce((sum, [k, w]) => sum + w * rate[k], 0);

// Rarity bands of the overall, set from the real distribution so they come out near 61% / 27% / 10% / 2% of the pool.
// Bronze is most of the pool; an Icon is a legend (Rooney, Shearer, Lampard, Salah, Giggs, Gerrard, Kane, Henry...).
export const TIER_BANDS = [
  { id: 'bronze', min: 1,  max: 39 },
  { id: 'silver', min: 40, max: 54 },
  { id: 'gold',   min: 55, max: 69 },
  { id: 'icon',   min: 70, max: 99 },
];
export const tierOf = (rating) => TIER_BANDS.find((t) => rating >= t.min && rating <= t.max).id;

// The Panini bit: some stickers are shiny. Same three slots as Balatro's foil / holographic / polychrome, one for each
// way to add to a score. A foil is the only way two copies of the same player differ.
export const EDITIONS = {
  base:  { label: 'BASE',  blurb: '' },
  shiny: { label: 'SHINY', blurb: '+40 chips',  chips: 40 },
  holo:  { label: 'HOLO',  blurb: '+6 mult',    mult: 6 },
  gold:  { label: 'GOLD',  blurb: '×1.5 mult',  xmult: 1.5 },
};
export const EDITION_ORDER = ['base', 'shiny', 'holo', 'gold'];

// DISCIPLINE: the disciplinary record as one score. A yellow card is 1 point, a red card is 3. (Red cards alone are
// on only ~11% of cards, so as a category of their own most hands had nothing to score; combined, most do.)
export const DISCIPLINE_POINTS = { yellow: 1, red: 3 };

// A card's REAL total in a category: what is printed under the rating. Discipline is derived.
export function statOf(card, category) {
  if (category === 'discipline') return card.yellow * DISCIPLINE_POINTS.yellow + card.red * DISCIPLINE_POINTS.red;
  return card[category];
}

// A card's rating (1-99) in a category.
export const ratingOf = (card, category) => card.rate[category];

// Chips a card is worth in a category. `scale` is meta.chipScale from cards.json.
export function cardChips(card, category, scale) {
  return Math.round(ratingOf(card, category) * scale[category].perUnit);
}

// 'goals' -> 'GOALS' etc. for display.
export const categoryLabel = (key) => CATEGORIES[key].label;

// The keeper's ability, SAFE HANDS: a goalkeeper held in your hand (not played) adds mult to every hand you play.
// Goalkeepers score almost nothing in any category, so this is their job: support. How much depends on how much he
// played, in the Premier League career total:
//   250+ appearances: a first-choice legend, +3 mult    100-249: a regular, +2 mult    under 100: a deputy, +1 mult
export function safeHands(card) {
  if (card.pos !== 'GK') return 0;
  return card.games >= 250 ? 3 : card.games >= 100 ? 2 : 1;
}

// ---- club-seasons ----------------------------------------------------------------------------------------------------
// Two players are TEAM-MATES if they share a club-season: both are on the same club's books in the same season. A card's
// `stints` are his club-seasons, so any number of cards can share one, and the team-season hands (One-Two, Triangle, Back
// Four, Invincibles) ask whether their cards have a club-season in common.
export const stintClub = (key) => key.slice(0, key.indexOf('|'));
export const stintSeason = (key) => key.slice(key.indexOf('|') + 1);
export const careerYears = (card) => `${card.first.slice(0, 4)}-${card.last.slice(0, 4) === card.first.slice(0, 4) ? '' : card.last.slice(2, 4)}`.replace(/-$/, '');

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
