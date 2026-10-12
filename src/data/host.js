/**
 * GRANDSTAND — the host.
 *
 * He is the spine of the game. Every rung, every result and every ending is
 * introduced by him, which is what turns a list of twelve fights into an
 * afternoon of television. The register is the one every 40-something
 * recognises: unhurried, faintly pompous, fond of a pause, treating a pub quiz
 * as though it were the Olympic final.
 *
 * A pastiche of a job, not of a person — the name is a composite and no real
 * broadcaster's marks appear anywhere in the game.
 */

export const HOST = {
  id: 'des',
  name: 'DES RIDER',
  role: 'Your Host For The Afternoon',
  skin: '#f0c49b',
  hair: '#b9b2a4',
  hairStyle: 'anchor',
  suit: '#2b2b3a',
  shirt: '#d9dceb',
  tie: '#7b3f6e',
};

/** Deterministic enough to feel authored, varied enough not to repeat. */
let seq = 0;
export function pick(lines) {
  if (!lines || !lines.length) return '';
  seq = (seq * 1103515245 + 12345) & 0x7fffffff;
  return lines[seq % lines.length];
}

export const SCRIPT = {
  // ── the opening titles ────────────────────────────────────────────────
  title: [
    'Good afternoon. Grandstand, and a full card for you today.',
    'Welcome along. Twelve names between you and the trophy.',
    'Afternoon all. The scores are coming in, and so are the questions.',
    'Settle down, get a brew on. We start in a moment.',
    'A packed programme today, and not one of them will go quietly.',
  ],

  // ── picking a fighter ─────────────────────────────────────────────────
  select: [
    'So. Who are we sending out?',
    'Take your time. You will be living with this one all afternoon.',
    'Pick carefully — they do not all fight the same way.',
  ],

  // ── the climb begins ──────────────────────────────────────────────────
  runStart: (name) => [
    `${name} it is. Twelve rungs, one trophy, let's see what happens.`,
    `${name} steps out. Nervous? You should be.`,
    `And we're off, with ${name} carrying the hopes of the nation. Or at least of this sofa.`,
  ],

  // ── arriving at a rung ────────────────────────────────────────────────
  rung: {
    1: [
      'A gentle one to start. Enjoy it, because it does not last.',
      'First up, and frankly a warm-up. Do not get comfortable.',
      'We begin, as we always do, with someone you should beat.',
    ],
    2: [
      'Right. This is where it starts to mean something.',
      'A step up, and you can feel it in the room.',
      'No more free afternoons. This one can play.',
    ],
    3: [
      'A marquee name now, and the crowd knows it.',
      'This is a proper test. Deep breath.',
      'One of the big ones. Nobody climbs past this without a mark on them.',
    ],
    boss: [
      'And so to the final. Everything you have, right now.',
      'This is it. Thirty years of Saturday afternoons, all leading here.',
      'The last one. Beat this and they will be talking about it in the pub for years.',
    ],
  },

  physio: [
    'Sensible. Get seen to, and go again.',
    'The magic sponge. Never fails, never explained.',
    'Take the treatment. There is no medal for limping.',
  ],
  bonus: [
    'A little something from the club shop. Take it.',
    'Programme, pin badge, and a spare trick up your sleeve.',
    'Free of charge, and very much earned.',
  ],

  // ── results ───────────────────────────────────────────────────────────
  win: [
    'Oh, that is lovely. Absolutely lovely.',
    'And that is how it is done. Take a bow.',
    'Well. You will not see many better than that.',
    'Comfortable in the end, and deservedly so.',
  ],
  winNarrow: [
    'By the skin of your teeth, but they all count.',
    'Ugly. Effective. Nobody asks how, they ask how many.',
    'That was far closer than it needed to be. On we go.',
  ],
  loss: [
    'Oh dear. Oh dear, oh dear.',
    'Well, that is a setback, and no mistake.',
    'Beaten, and beaten fairly. Dust yourself down.',
    'Not your afternoon, that one. It happens to everybody.',
  ],

  // ── running on empty ──────────────────────────────────────────────────
  lowEnergy: [
    'You are running on fumes now. Choose carefully.',
    'Legs have gone. One more, maybe two.',
    'That is nearly the lot. Make it count.',
  ],

  // ── sign-offs ─────────────────────────────────────────────────────────
  champion: [
    'Champion of the ladder. What a way to spend an afternoon.',
    'They said it could not be done. Mostly me. I was wrong.',
    'And that is the trophy. Quite remarkable.',
  ],
  exhausted: [
    'And that is all we have time for. The energy has gone.',
    'We leave it there — nothing left in the tank.',
    'Time beats everybody in the end. Same again next week?',
  ],
  quit: [
    'Calling it there. Probably wise.',
    'We shall leave it at that. Thanks for your company.',
    'A sensible retirement. Not everyone manages one.',
  ],
};

/** The right line for wherever the player currently is. */
export function lineForRung(rung) {
  if (rung.kind === 'boss') return pick(SCRIPT.rung.boss);
  if (rung.kind === 'physio') return pick(SCRIPT.physio);
  if (rung.kind === 'bonus') return pick(SCRIPT.bonus);
  const tier = rung.fighter ? rung.fighter.tier : 1;
  return pick(SCRIPT.rung[Math.min(3, tier)] || SCRIPT.rung[1]);
}

export function lineForResult(won, player) {
  if (!won) return pick(SCRIPT.loss);
  const narrow = player.hp / player.maxHp < 0.3;
  return pick(narrow ? SCRIPT.winNarrow : SCRIPT.win);
}

export function lineForEnding(outcome) {
  if (outcome === 'champion') return pick(SCRIPT.champion);
  if (outcome === 'energy') return pick(SCRIPT.exhausted);
  return pick(SCRIPT.quit);
}
