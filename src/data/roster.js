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

const F = (o) => ({ tier: 1, guile: 0.5, speed: 2, build: BUILD.NORMAL, edition: 'classic', ...o });

/** Shorthand for the Premier League '90s roster. */
const P = (o) => F({ ...o, sport: 'football', edition: 'prem90s' });

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

  F({
    id: 'canter', name: 'WILLIE CANTER', epithet: 'Five Foot Nothing, All Elbows',
    sport: 'racing', tier: 2, hp: 92, power: 20, guile: 0.61, speed: 3,
    build: BUILD.LEAN, gear: 'whip', hair: 'flattop', facial: 'none', brow: 'angry',
    palette: { skin: '#f0c49b', kit: '#e0b040', trim: '#16a34a', hair: '#9a6a3c' },
    taunt: 'I have done eight stone four since Tuesday. Try me.',
    defeat: 'Beaten a length and a half. No excuses.',
  }),
  F({
    id: 'boardroom', name: 'CHRIS BOARDROOM', epithet: 'Four Kilometres, Eyes Shut',
    sport: 'cycling', tier: 2, hp: 98, power: 19, guile: 0.69, speed: 3,
    build: BUILD.LEAN, gear: 'helmet', hair: 'bald', facial: 'none', brow: 'neutral',
    palette: { skin: '#f3cba4', kit: '#1f2937', trim: '#5eead4', hair: '#4b2e13' },
    taunt: 'I have done the numbers. You are four seconds down already.',
    defeat: 'The data says you were better. The data is never wrong.',
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

// ═══════════════════════════════════════════════════════════════════════════
// THE PREMIER LEAGUE '90s EDITION
//
// Affectionate fakes again, of the men who filled Saturday afternoons between
// the breakaway in 1992 and the turn of the century. Shirts you could see from
// space, and a back pass you were suddenly not allowed to pick up.
// ═══════════════════════════════════════════════════════════════════════════

export const ROSTER_90S = [
  // ── Tier 1 ───────────────────────────────────────────────────────────
  P({
    id: 'yeboya', name: 'TONY YEBOYA', epithet: 'Hits Them On The Drop',
    tier: 1, hp: 72, power: 15, guile: 0.44, speed: 2,
    build: BUILD.NORMAL, gear: 'ball', hair: 'bald', facial: 'none', brow: 'angry',
    palette: { skin: '#5a3418', kit: '#f4f4f6', trim: '#f0d060', hair: '#1a1a1a' },
    taunt: 'I do not pass it. I do not control it. I hit it.',
    defeat: 'That one dipped under the bar. Yours did not.',
  }),
  P({
    id: 'aspirin', name: 'FAUSTINO ASPIRIN', epithet: 'Nobody Knows What Happens Next',
    tier: 1, hp: 68, power: 16, guile: 0.38, speed: 3,
    build: BUILD.LEAN, gear: 'ball', hair: 'curly', facial: 'stubble', brow: 'raised',
    palette: { skin: '#6b4226', kit: '#1a1a20', trim: '#f4f4f6', hair: '#1a1a1a' },
    taunt: 'Even I am not sure what I am about to do.',
    defeat: 'Brilliant one week. This week, apparently, not.',
  }),
  P({
    id: 'letissue', name: 'MATT LE TISSUE', epithet: 'Has Not Run Since 1991',
    tier: 1, hp: 78, power: 14, guile: 0.62, speed: 1,
    build: BUILD.HEAVY, gear: 'ball', hair: 'bowl', facial: 'none', brow: 'neutral',
    palette: { skin: '#f0c49b', kit: '#c9303c', trim: '#f4f4f6', hair: '#3a2a18' },
    taunt: 'I will stand here. You bring it to me.',
    defeat: 'Forty-seven out of forty-eight. Today was the forty-eighth.',
  }),
  P({
    id: 'smikel', name: 'PETER SMIKEL', epithet: 'Enormous, And Furious About It',
    tier: 1, hp: 96, power: 12, guile: 0.48, speed: 1,
    build: BUILD.HEAVY, gear: 'gloves', hair: 'receding', facial: 'none', brow: 'angry',
    palette: { skin: '#f3cba4', kit: '#1f7a4a', trim: '#111827', hair: '#d8d2c0' },
    taunt: 'YOU. BACK. NOW. *waves arms*',
    defeat: 'That is going in the net and someone is getting shouted at.',
  }),

  // ── Tier 2 ───────────────────────────────────────────────────────────
  P({
    id: 'furdinand', name: 'LES FURDINAND', epithet: 'Up And Still Going Up',
    tier: 2, hp: 100, power: 19, guile: 0.56, speed: 2,
    build: BUILD.NORMAL, gear: 'ball', hair: 'bald', facial: 'none', brow: 'neutral',
    palette: { skin: '#5a3418', kit: '#1a1a20', trim: '#f4f4f6', hair: '#1a1a1a' },
    taunt: 'Put it in the air. I will be there when it comes down.',
    defeat: 'Beaten in the air. That does not happen often.',
  }),
  P({
    id: 'right', name: 'IAN RIGHT', epithet: 'Grin Like A Floodlight',
    tier: 2, hp: 96, power: 21, guile: 0.54, speed: 3,
    build: BUILD.LEAN, gear: 'ball', hair: 'spiky', facial: 'none', brow: 'raised',
    palette: { skin: '#6b4226', kit: '#c9303c', trim: '#f4f4f6', hair: '#1a1a1a' },
    taunt: 'Ian Right, Right, Right!',
    defeat: 'Fair play. Come here. *hugs you anyway*',
  }),
  P({
    id: 'zolo', name: 'GIANFRANCO ZOLO', epithet: 'Five Foot Six Of Problem',
    tier: 2, hp: 92, power: 20, guile: 0.68, speed: 3,
    build: BUILD.LEAN, gear: 'ball', hair: 'curly', facial: 'none', brow: 'raised',
    palette: { skin: '#e8b48a', kit: '#1d4ed8', trim: '#f0d060', hair: '#2a2018' },
    taunt: 'You are much bigger than me. It will not help.',
    defeat: 'Bravo. Genuinely, bravo.',
  }),
  P({
    id: 'klinsdive', name: 'JURGEN KLINSDIVE', epithet: 'Celebrates The Accusation',
    tier: 2, hp: 98, power: 20, guile: 0.60, speed: 3,
    build: BUILD.NORMAL, gear: 'ball', hair: 'flattop', facial: 'none', brow: 'neutral',
    palette: { skin: '#f3cba4', kit: '#f4f4f6', trim: '#1e3a8a', hair: '#d8c070' },
    taunt: 'You think I will go down. Watch how well I do it.',
    defeat: '*slides forty yards on his front, applauds you*',
  }),
  P({
    id: 'bergkamper', name: 'DENNIS BERGKAMPER', epithet: 'Will Not Fly, Will Not Rush',
    tier: 2, hp: 102, power: 20, guile: 0.72, speed: 2,
    build: BUILD.NORMAL, gear: 'ball', hair: 'anchor', facial: 'none', brow: 'neutral',
    palette: { skin: '#f6d5ae', kit: '#c9303c', trim: '#1a1a20', hair: '#b08040' },
    taunt: 'One touch to kill it. One to turn you. One to finish.',
    defeat: 'That was the better goal. I am allowed to say so.',
  }),

  // ── Tier 3 ───────────────────────────────────────────────────────────
  P({
    id: 'shearwater', name: 'ALAN SHEARWATER', epithet: 'One Arm Up, Nothing Else Needed',
    tier: 3, hp: 142, power: 25, guile: 0.64, speed: 2,
    build: BUILD.HEAVY, gear: 'ball', hair: 'anchor', facial: 'none', brow: 'angry',
    palette: { skin: '#f0c49b', kit: '#1a1a20', trim: '#f4f4f6', hair: '#6b5a3a' },
    taunt: 'Thirty-four in a season. Twice. Off you go.',
    defeat: '*raises one arm anyway, out of habit*',
  }),
  P({
    id: 'cantina', name: 'ERIC CANTINA', epithet: 'The Collar Stays Up',
    tier: 3, hp: 136, power: 26, guile: 0.70, speed: 3,
    build: BUILD.NORMAL, gear: 'ball', hair: 'bald', facial: 'stubble', brow: 'raised',
    palette: { skin: '#e8b48a', kit: '#c9303c', trim: '#f4f4f6', hair: '#1a1a1a' },
    taunt: 'When the seagulls follow the trawler, it is because they think sardines will be thrown into the sea.',
    defeat: 'I have said my piece. I shall go now.',
  }),
  P({
    id: 'keene', name: 'ROY KEENE', epithet: 'Has Already Decided About You',
    tier: 3, hp: 134, power: 27, guile: 0.66, speed: 3,
    build: BUILD.NORMAL, gear: 'ball', hair: 'spiky', facial: 'stubble', brow: 'angry',
    palette: { skin: '#f3cba4', kit: '#c9303c', trim: '#1a1a20', hair: '#2a2018' },
    taunt: 'Fail to prepare. You know the rest.',
    defeat: 'Not good enough. Me, I mean. Not you.',
  }),

  // ── Bosses ───────────────────────────────────────────────────────────
  P({
    id: 'hairdryer', name: 'THE HAIRDRYER', epithet: 'Squeaky Bum Time',
    tier: 4, hp: 196, power: 26, guile: 0.74, speed: 3, boss: true,
    build: BUILD.NORMAL, gear: 'clipboard', hair: 'anchor', facial: 'none', brow: 'angry',
    palette: { skin: '#f0c49b', kit: '#1a1a20', trim: '#c9303c', hair: '#c0bab0' },
    taunt: 'You have three minutes. I have watched better in the reserves.',
    defeat: 'Football, eh. Bloody hell.',
  }),
  P({
    id: 'sheepskin', name: 'THE SHEEPSKIN COAT', epithet: 'Has Seen Every Goal Since 1971',
    tier: 4, hp: 210, power: 27, guile: 0.78, speed: 3, boss: true,
    build: BUILD.HEAVY, gear: 'mic', hair: 'anchor', facial: 'none', brow: 'raised',
    palette: { skin: '#f3cba4', kit: '#8a6a3a', trim: '#e8dcc0', hair: '#d8d2c0' },
    taunt: 'And it is live, and it is Saturday, and you are in a lot of trouble.',
    defeat: 'Well. You will not see that again for a very long time.',
  }),
];

export const PLAYER_KITS = [
  { id: 'sunday', name: 'SUNDAY LEAGUE', palette: { skin: '#f3cba4', kit: '#1d4ed8', trim: '#facc15', hair: '#4b2e13' } },
  { id: 'away',   name: 'AWAY STRIP',    palette: { skin: '#7a4a21', kit: '#f8fafc', trim: '#dc2626', hair: '#111827' } },
  { id: 'third',  name: 'THIRD KIT',     palette: { skin: '#e8b48a', kit: '#065f46', trim: '#fbbf24', hair: '#6b21a8' } },
  { id: 'retro',  name: 'RETRO SHELLSUIT', palette: { skin: '#f6d5ae', kit: '#c026d3', trim: '#22d3ee', hair: '#78350f' } },
];

/** Every fighter in the game, across all editions. */
export const ALL_FIGHTERS = [...ROSTER, ...ROSTER_90S];

const ofEdition = (edition) => ALL_FIGHTERS.filter((f) => f.edition === edition);

export function byTier(tier, edition = 'classic') {
  return ofEdition(edition).filter((f) => f.tier === tier && !f.boss);
}
export function bosses(edition = 'classic') {
  return ofEdition(edition).filter((f) => f.boss);
}
export function findFighter(id) {
  return ALL_FIGHTERS.find((f) => f.id === id);
}
