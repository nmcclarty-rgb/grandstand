// The English football pyramid, as the knockout cup's field: 63 clubs plus yours, 16 from each of the top four divisions (the Premier League, the Championship,
// League One and League Two), and YOU are a League Two club. Money follows the pyramid: a Premier League club has a bigger budget than a League Two one.
//
// This is flavour with a purpose: the players are all Premier League careers (the same pool for everyone), so a club's identity changes nothing about who is on
// the board. What a club brings is its BUDGET, which is the game's difficulty dial. Divisions are as they were at about the time of writing; they are not kept up
// to date season to season, and the badges are generated, not real crests (see stickers/src/ui/badge.js).
//
// Each tier lists its clubs from strongest to weakest, and the budget runs from `hi` down to `lo` (as a share of the player's budget) in that order.
export const TIERS = [
  { key: 'prem', name: 'Premier League', hi: 1.30, lo: 1.12 },
  { key: 'champ', name: 'Championship', hi: 1.15, lo: 1.05 },
  { key: 'one', name: 'League One', hi: 1.08, lo: 1.00 },
  { key: 'two', name: 'League Two', hi: 0.95, lo: 0.80 },
];
export const YOUR_TIER = 3;     // League Two
export const YOUR_MULT = 1.0;   // you are on the base budget (£10 in 5-a-side, £30 in 11-a-side): level with the best League Two clubs, short of everyone from League One up

// code, name, kit colours, optional badge pattern ('stripes' | 'hoops' | 'halves' | 'sash')
const C = (code, name, c1, c2, pattern) => ({ code, name, colours: [c1, c2], pattern });
export const FIELD = [
  [ // Premier League
    C('MCI', 'Man City', '#6CABDD', '#FFFFFF'), C('LIV', 'Liverpool', '#C8102E', '#F6EB61'), C('ARS', 'Arsenal', '#EF0107', '#FFFFFF'), C('CHE', 'Chelsea', '#034694', '#FFFFFF'),
    C('MUN', 'Man Utd', '#DA291C', '#FBE122'), C('TOT', 'Spurs', '#132257', '#FFFFFF'), C('NEW', 'Newcastle', '#241F20', '#FFFFFF', 'stripes'), C('AVL', 'Aston Villa', '#670E36', '#95BFE5'),
    C('WHU', 'West Ham', '#7A263A', '#1BB1E7'), C('BHA', 'Brighton', '#0057B8', '#FFFFFF', 'stripes'), C('CRY', 'Crystal Palace', '#1B458F', '#C4122E', 'stripes'), C('FUL', 'Fulham', '#222222', '#FFFFFF'),
    C('BRE', 'Brentford', '#E30613', '#FFFFFF', 'stripes'), C('EVE', 'Everton', '#003399', '#FFFFFF'), C('NFO', "Nott'm Forest", '#DD0000', '#FFFFFF'), C('BOU', 'Bournemouth', '#DA291C', '#111111', 'stripes'),
  ],
  [ // Championship
    C('LEE', 'Leeds', '#FFCD00', '#1D428A'), C('LEI', 'Leicester', '#003090', '#FDBE11'), C('SOU', 'Southampton', '#D71920', '#FFFFFF', 'stripes'), C('SUN', 'Sunderland', '#EB172B', '#FFFFFF', 'stripes'),
    C('BUR', 'Burnley', '#6C1D45', '#99D6EA'), C('WOL', 'Wolves', '#FDB913', '#231F20'), C('IPS', 'Ipswich', '#3A64A3', '#FFFFFF'), C('MID', 'Middlesbrough', '#E1202E', '#FFFFFF'),
    C('NOR', 'Norwich', '#00A650', '#FFF200'), C('WBA', 'West Brom', '#122F67', '#FFFFFF', 'stripes'), C('SHU', 'Sheffield Utd', '#EE2737', '#111111', 'stripes'), C('COV', 'Coventry', '#59CBE8', '#FFFFFF'),
    C('STK', 'Stoke', '#E03A3E', '#FFFFFF', 'stripes'), C('QPR', 'QPR', '#1D5BA4', '#FFFFFF', 'hoops'), C('BIR', 'Birmingham', '#1D3DBF', '#FFFFFF'), C('HUL', 'Hull', '#F5A12D', '#111111'),
  ],
  [ // League One
    C('DER', 'Derby', '#E8E8E8', '#111111'), C('BOL', 'Bolton', '#263C7E', '#FFFFFF'), C('BLA', 'Blackburn', '#0069B4', '#FFFFFF', 'halves'), C('REA', 'Reading', '#004494', '#FFFFFF', 'hoops'),
    C('POR', 'Portsmouth', '#001489', '#FFFFFF'), C('WAT', 'Watford', '#FBEE23', '#ED2127'), C('SWA', 'Swansea', '#333333', '#FFFFFF'), C('CAR', 'Cardiff', '#0070B5', '#D01217'),
    C('HUD', 'Huddersfield', '#0E63AD', '#FFFFFF', 'stripes'), C('LUT', 'Luton', '#F78F1E', '#002D62'), C('CHA', 'Charlton', '#D4021D', '#FFFFFF'), C('WIG', 'Wigan', '#1D59AF', '#FFFFFF'),
    C('BLP', 'Blackpool', '#F68712', '#FFFFFF'), C('BAR', 'Barnsley', '#D81920', '#FFFFFF'), C('SHW', 'Sheffield Wed', '#0E4C92', '#FFFFFF', 'stripes'), C('BRA', 'Bradford City', '#7A1F2B', '#F2B705', 'stripes'),
  ],
  [ // League Two (15, plus you)
    C('NTC', 'Notts County', '#1A1A1A', '#FFFFFF', 'stripes'), C('STO', 'Stockport', '#1F4E9C', '#FFFFFF'), C('DON', 'Doncaster', '#D3202F', '#FFFFFF', 'hoops'), C('WAL', 'Walsall', '#C8102E', '#FFFFFF'),
    C('SWI', 'Swindon', '#E4002B', '#FFFFFF'), C('GRI', 'Grimsby', '#1A1A1A', '#FFFFFF', 'stripes'), C('PTV', 'Port Vale', '#F2F2F2', '#111111'), C('CRE', 'Crewe', '#D3202F', '#FFFFFF'),
    C('GIL', 'Gillingham', '#1F4E9C', '#FFFFFF'), C('COL', 'Colchester', '#1F4E9C', '#FFFFFF', 'stripes'), C('ACC', 'Accrington', '#C8102E', '#FFFFFF'), C('TRA', 'Tranmere', '#F2F2F2', '#1F4E9C'),
    C('SAL', 'Salford', '#D3202F', '#FFFFFF'), C('HAR', 'Harrogate', '#F4D200', '#111111'), C('BRW', 'Barrow', '#1F4E9C', '#FFFFFF'),
  ],
];

// -> 63 opponents { code, name, colours, pattern, tier, tierName, mult }, strongest first within each tier
export function opponents() {
  return FIELD.flatMap((clubs, tier) => clubs.map((c, i) => ({
    ...c, tier, tierName: TIERS[tier].name,
    mult: Math.round((TIERS[tier].hi - ((TIERS[tier].hi - TIERS[tier].lo) * i) / Math.max(1, clubs.length - 1)) * 1000) / 1000,
  })));
}

// a deterministic stand-in kit for a club the player names: colours from the name
export function kitFor(name) {
  let h = 2166136261;
  for (const ch of name) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const hue = (h >>> 0) % 360;
  const hsl = (hh, s, l) => {
    const sf = s / 100, lf = l / 100, a = sf * Math.min(lf, 1 - lf);
    const f = (n) => { const k = (n + hh / 30) % 12; return Math.round(255 * (lf - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  return [hsl(hue, 62, 40), hsl((hue + 180) % 360, 70, 92)];
}

// the three letters on a badge: the first three letters of the name
export const codeFor = (name) => (name.replace(/[^A-Za-z]/g, '').slice(0, 3) || 'YOU').toUpperCase();

// What you can choose for your own club: a colourway (primary, secondary) and a shirt design. The designs are the badge patterns.
export const PATTERNS = [['solid', 'Plain'], ['stripes', 'Stripes'], ['hoops', 'Hoops'], ['halves', 'Halves'], ['sash', 'Sash']];
export const KITS = [
  ['Red & white', '#D81920', '#FFFFFF'], ['Blue & white', '#1F4E9C', '#FFFFFF'], ['Claret & blue', '#7A263A', '#7EC0EE'], ['Green & gold', '#0B7A3B', '#F4D200'],
  ['Black & white', '#1A1A1A', '#FFFFFF'], ['Yellow & black', '#F4D200', '#1A1A1A'], ['Sky & white', '#6CABDD', '#FFFFFF'], ['Orange & black', '#F26B1D', '#1A1A1A'],
  ['Purple & gold', '#5B2A86', '#F2C230'], ['White & navy', '#F4F4F4', '#14224F'],
];
const HEX = /^#[0-9a-fA-F]{6}$/;
// whatever the page sends, only a valid pair of colours and a known design get through
export function cleanKit(kit, fallbackName = 'x') {
  const colours = Array.isArray(kit?.colours) && kit.colours.length === 2 && kit.colours.every((c) => HEX.test(c)) ? kit.colours : kitFor(fallbackName);
  const pattern = PATTERNS.some(([k]) => k === kit?.pattern) ? kit.pattern : 'solid';
  return { colours, pattern };
}
