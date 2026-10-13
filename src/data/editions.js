/**
 * GRANDSTAND — editions.
 *
 * An edition is a self-contained campaign: its own question bank, its own
 * roster, its own venues and its own backdrop. Adding one should not require
 * touching the ladder, the battle system or the UI — they all read from here.
 *
 * Deliberately not a filter on the main bank. "Only football questions" would
 * give you Dixie Dean and Just Fontaine alongside the Premier League; an
 * edition is a different game with the same rules.
 */

import { QUESTIONS } from './questions.js';
import { QUESTIONS_90S } from './questions90s.js';

export const EDITIONS = [
  {
    id: 'classic',
    name: 'GRANDSTAND',
    tagline: 'Every sport, every Saturday afternoon',
    blurb: 'Boxing, darts, snooker, the lot. Twelve rungs of people who were on '
         + 'the telly between 1978 and 1998.',
    questions: QUESTIONS,
    accent: '#ffd24a',
    // venue and backdrop follow each opponent's own sport
    arena: null,
    venues: null,
  },
  {
    id: 'prem90s',
    name: "PREMIER LEAGUE '90s",
    tagline: 'Eight seasons, three champions, one decade',
    blurb: 'Nothing but the Premier League, 1992 to 2000. Shirts you could see '
         + 'from space, and a back pass you were suddenly not allowed to pick up.',
    questions: QUESTIONS_90S,
    accent: '#5eead4',
    arena: 'prem90s',
    venues: [
      'A WET TUESDAY NIGHT',
      'THE OLD MAIN STAND',
      'THE AWAY END',
      'LIVE ON SATURDAY',
      'THE MIDWEEK REARRANGEMENT',
      'THE SIX-POINTER',
      'THE LOCAL DERBY',
      'THE LAST GAME OF THE SEASON',
      'THE TITLE DECIDER',
      'A FROZEN PITCH',
      'THE REPLAY',
      'THE FINAL WHISTLE',
    ],
  },
];

export const DEFAULT_EDITION = 'classic';

export function findEdition(id) {
  return EDITIONS.find((e) => e.id === id) || EDITIONS[0];
}
