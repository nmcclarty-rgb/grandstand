/**
 * GRANDSTAND — the roster.
 *
 * Affectionate parodies of the sports stars who filled Saturday afternoons
 * between roughly 1978 and 1998. Names are deliberately wonky: this is
 * pastiche, not likeness. See README "On the names".
 *
 * Stats:
 *   hp      health pool
 *   power   base damage of their attacks
 *   guile   how good they are at picking their own answers (0..1 chance of a
 *           perfect pick; the rest of the time they fluff it like we all do)
 *   speed   turns per round at high values (>=3 means they occasionally
 *           get a free jab in)
 */

export const BUILD = { LEAN: 'lean', NORMAL: 'normal', HEAVY: 'heavy' };

const F = (o) => ({ tier: 1, guile: 0.5, speed: 2, build: BUILD.NORMAL, ...o });

export const ROSTER = [
  // ── Tier 1: the warm-up acts ─────────────────────────────────────────
  F({
    id: 'seagull', name: 'EDDIE THE SEAGULL', epithet: 'Plasterer, Ski Jumper',
    sport: 'olympics', tier: 1, hp: 65, power: 13, guile: 0.32, speed: 2,
    build: BUILD.NORMAL, gear: 'skis',
    palette: { skin: '#f3cba4', kit: '#dbeafe', trim: '#1d4ed8', hair: '#c2703d' },
    taunt: 'I have never actually won anything. Bear that in mind.',
    defeat: 'Right. I\'ll be off then. Downhill, probably.',
  }),
  F({
    id: 'beige', name: 'STEVE BEIGE', epithet: 'Interesting, Actually',
    sport: 'snooker', tier: 1, hp: 72, power: 14, guile: 0.55, speed: 2,
    build: BUILD.LEAN, gear: 'cue',
    palette: { skin: '#f0c49b', kit: '#1f2937', trim: '#f59e0b', hair: '#b45309' },
    taunt: 'I shall now take a very long time over this.',
    defeat: 'Well. That was a bit of a session.',
  }),
  F({
    id: 'bully', name: 'JOCKY McBULL', epithet: 'Two Darts, No Teeth',
    sport: 'darts', tier: 1, hp: 80, power: 15, guile: 0.46, speed: 2,
    build: BUILD.HEAVY, gear: 'dart',
    palette: { skin: '#e9a97a', kit: '#7f1d1d', trim: '#fbbf24', hair: '#111827' },
    taunt: 'Game on. Mine\'s a lager.',
    defeat: 'You couldnae hit a coo\'s erse wi\' a banjo. But ye did.',
  }),
  F({
    id: 'haybales', name: 'GIANT HAYBALES', epithet: 'Fourteen Stone of Grievance',
    sport: 'telly', tier: 1, hp: 120, power: 14, guile: 0.36, speed: 1,
    build: BUILD.HEAVY, gear: 'none',
    palette: { skin: '#e8a878', kit: '#0f172a', trim: '#64748b', hair: '#1f2937' },
    taunt: 'Easy! Easy! Easy!',
    defeat: 'That is NOT in the rule book.',
  }),

  // ── Tier 2: proper opposition ────────────────────────────────────────
  F({
    id: 'gunner', name: 'SALLY GUNNER', epithet: 'Over Everything In Her Way',
    sport: 'athletics', tier: 2, hp: 95, power: 19, guile: 0.6, speed: 3,
    build: BUILD.LEAN, gear: 'baton',
    palette: { skin: '#f2c9a0', kit: '#dc2626', trim: '#ffffff', hair: '#78350f' },
    taunt: 'Ten hurdles. Try and keep up.',
    defeat: 'Fair. You went out hard and you held on.',
  }),
  F({
    id: 'chrissy', name: 'LINFORD CHRISSY', epithet: 'Out of the Blocks',
    sport: 'athletics', tier: 2, hp: 100, power: 20, guile: 0.57, speed: 3,
    build: BUILD.NORMAL, gear: 'none',
    palette: { skin: '#8d5524', kit: '#1e3a8a', trim: '#f8fafc', hair: '#111827' },
    taunt: 'I go on the B of the Bang.',
    defeat: 'False start on my part. Well run.',
  }),
  F({
    id: 'moustachio', name: 'NIGEL MOUSTACHIO', epithet: 'Our Nige',
    sport: 'motorsport', tier: 2, hp: 105, power: 19, guile: 0.58, speed: 2,
    build: BUILD.NORMAL, gear: 'helmet',
    palette: { skin: '#f0c49b', kit: '#f8fafc', trim: '#dc2626', hair: '#7c2d12' },
    taunt: 'I\'ll take it round the outside at Peraltada if I have to.',
    defeat: 'The car was wrong all weekend. Not that I\'m making excuses.',
  }),
  F({
    id: 'bothered', name: 'IAN BOTHERED', epithet: 'Headingley, 1981',
    sport: 'cricket', tier: 2, hp: 115, power: 19, guile: 0.56, speed: 2,
    build: BUILD.HEAVY, gear: 'bat',
    palette: { skin: '#f3cba4', kit: '#f8fafc', trim: '#1e3a8a', hair: '#facc15' },
    taunt: 'Let\'s give it some humpty.',
    defeat: 'Fair play. Pint?',
  }),
  F({
    id: 'bjorn', name: 'BJORN AGAIN', epithet: 'Ice, Headband, Five In A Row',
    sport: 'tennis', tier: 2, hp: 100, power: 20, guile: 0.63, speed: 3,
    build: BUILD.LEAN, gear: 'racket',
    palette: { skin: '#f6d5ae', kit: '#f8fafc', trim: '#16a34a', hair: '#d4a017' },
    taunt: '...', // he says nothing. He never says anything.
    defeat: 'Good match.',
  }),
  F({
    id: 'fashion', name: 'JOHN FASHION', epithet: 'The Crazy Gang',
    sport: 'football', tier: 2, hp: 110, power: 21, guile: 0.5, speed: 2,
    build: BUILD.HEAVY, gear: 'ball',
    palette: { skin: '#7a4a21', kit: '#1d4ed8', trim: '#facc15', hair: '#0f172a' },
    taunt: 'You can have the ball. You can\'t have the elbow.',
    defeat: 'Respect. Awooga.',
  }),
  F({
    id: 'akabusy', name: 'KRISS AKABUSY', epithet: 'And The Laugh',
    sport: 'athletics', tier: 2, hp: 95, power: 18, guile: 0.62, speed: 3,
    build: BUILD.NORMAL, gear: 'baton',
    palette: { skin: '#6b4226', kit: '#dc2626', trim: '#f8fafc', hair: '#111827' },
    taunt: 'AHHHHH-HA-HA-HA-HAAA!',
    defeat: 'You dipped on the line. Textbook.',
  }),
  F({
    id: 'faldon', name: 'NICK FALDON', epithet: 'Grinding You Down',
    sport: 'golf', tier: 2, hp: 105, power: 18, guile: 0.68, speed: 2,
    build: BUILD.LEAN, gear: 'club',
    palette: { skin: '#f0c49b', kit: '#facc15', trim: '#1f2937', hair: '#92400e' },
    taunt: 'I will make eighteen pars and you will hate every one of them.',
    defeat: 'I\'d like to thank the press. From the heart of my bottom.',
  }),

  // ── Tier 3: the marquee names ────────────────────────────────────────
  F({
    id: 'tank', name: 'TANK BRUNO', epithet: 'The Bermondsey Bulldozer',
    sport: 'boxing', tier: 3, hp: 150, power: 25, guile: 0.54, speed: 2,
    build: BUILD.HEAVY, gear: 'gloves',
    palette: { skin: '#6b4226', kit: '#dc2626', trim: '#fbbf24', hair: '#111827' },
    taunt: 'Know what I mean, \'Arry?',
    defeat: 'You caught me with a good one there. Fair play to ya.',
  }),
  F({
    id: 'thompsen', name: 'DALEY THOMPSEN', epithet: 'Ten Events, One Whistle',
    sport: 'athletics', tier: 3, hp: 140, power: 23, guile: 0.66, speed: 3,
    build: BUILD.NORMAL, gear: 'javelin',
    palette: { skin: '#7a4a21', kit: '#1e3a8a', trim: '#dc2626', hair: '#111827' },
    taunt: 'Ten events. I\'m better than you at eight of them.',
    defeat: '*whistles the national anthem, walks off*',
  }),
  F({
    id: 'whitebread', name: 'FATIMA WHITEBREAD', epithet: 'Arm Like A Trebuchet',
    sport: 'athletics', tier: 3, hp: 145, power: 27, guile: 0.52, speed: 1,
    build: BUILD.HEAVY, gear: 'javelin',
    palette: { skin: '#e8b48a', kit: '#dc2626', trim: '#f8fafc', hair: '#4b2e13' },
    taunt: 'I throw a spear seventy-seven metres. Your move.',
    defeat: 'Good arm. Good arm.',
  }),
  F({
    id: 'gazzer', name: 'GAZZER', epithet: 'Daft As A Brush',
    sport: 'football', tier: 3, hp: 135, power: 24, guile: 0.61, speed: 3,
    build: BUILD.NORMAL, gear: 'ball',
    palette: { skin: '#f3cba4', kit: '#f8fafc', trim: '#1e3a8a', hair: '#e5c07b' },
    taunt: 'Howay. Shirt off, let\'s go.',
    defeat: '*bottom lip goes* ...Divvn\'t tell me mam.',
  }),
  F({
    id: 'torvbean', name: 'TORVILL & BEAN', epithet: 'Nine Perfect Sixes',
    sport: 'olympics', tier: 3, hp: 130, power: 22, guile: 0.72, speed: 3,
    build: BUILD.LEAN, gear: 'none',
    palette: { skin: '#f6d5ae', kit: '#7c3aed', trim: '#a78bfa', hair: '#7c2d12' },
    taunt: 'Four minutes and ten seconds. Try not to fall over.',
    defeat: 'Artistic impression: five point eight. Generous, frankly.',
  }),
  F({
    id: 'mcgizzard', name: 'BARRY McGIZZARD', epithet: 'The Clones Cyclone',
    sport: 'boxing', tier: 3, hp: 140, power: 26, guile: 0.58, speed: 3,
    build: BUILD.NORMAL, gear: 'gloves',
    palette: { skin: '#f3cba4', kit: '#16a34a', trim: '#f8fafc', hair: '#b45309' },
    taunt: 'Twenty-six thousand people at Loftus Road. All of them mine.',
    defeat: 'You\'ve a dig on you. I\'ll give you that.',
  }),

  // ── Tier 4: the bosses ───────────────────────────────────────────────
  F({
    id: 'gaffer', name: 'THE GAFFER', epithet: 'Host of A Question of Sport',
    sport: 'any', tier: 4, hp: 190, power: 24, guile: 0.7, speed: 3,
    build: BUILD.NORMAL, gear: 'clipboard', boss: true,
    palette: { skin: '#f0c49b', kit: '#1f2937', trim: '#facc15', hair: '#e5e7eb' },
    taunt: 'Round one. What happened next?',
    defeat: 'And that... is quite remarkable.',
  }),
  F({
    id: 'commentator', name: 'THE COMMENTATOR', epithet: 'They Think It\'s All Over',
    sport: 'any', tier: 4, hp: 210, power: 26, guile: 0.76, speed: 3,
    build: BUILD.LEAN, gear: 'mic', boss: true,
    palette: { skin: '#f0c49b', kit: '#7f1d1d', trim: '#f8fafc', hair: '#9ca3af' },
    taunt: 'Some people are on the pitch. They think it\'s all over.',
    defeat: 'It is now.',
  }),
];

export const PLAYER_KITS = [
  { id: 'sunday', name: 'SUNDAY LEAGUE', palette: { skin: '#f3cba4', kit: '#1d4ed8', trim: '#facc15', hair: '#4b2e13' } },
  { id: 'away',   name: 'AWAY STRIP',    palette: { skin: '#7a4a21', kit: '#f8fafc', trim: '#dc2626', hair: '#111827' } },
  { id: 'third',  name: 'THIRD KIT',     palette: { skin: '#e8b48a', kit: '#065f46', trim: '#fbbf24', hair: '#6b21a8' } },
  { id: 'retro',  name: 'RETRO SHELLSUIT', palette: { skin: '#f6d5ae', kit: '#c026d3', trim: '#22d3ee', hair: '#78350f' } },
];

export function byTier(tier) {
  return ROSTER.filter((f) => f.tier === tier && !f.boss);
}
export function bosses() {
  return ROSTER.filter((f) => f.boss);
}
export function findFighter(id) {
  return ROSTER.find((f) => f.id === id);
}
