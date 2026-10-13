/**
 * GRANDSTAND — the ladder.
 *
 * Replaces the free-roam overworld. You climb a fixed run of rungs, one
 * opponent per rung, getting harder as you go, finishing with a boss. This is
 * the Street Fighter II world tour shape rather than a dungeon: the map is a
 * route, not a place, and the only navigation decision is whether to push on
 * or go back and beat a rung more convincingly.
 *
 * Cleared rungs can be replayed to improve your star rating, which is what
 * stops the ladder being a single one-way corridor — but replaying costs
 * energy, same as anything else.
 */

import { makeRng } from '../engine/rng.js';
import { byTier, bosses } from '../data/roster.js';
import { findEdition, DEFAULT_EDITION } from '../data/editions.js';

export const RUNGS = 12;

export const KIND = { FIGHT: 'fight', PHYSIO: 'physio', WATER: 'water', BOSS: 'boss' };

/**
 * A rung's venue follows its opponent's sport, not its position on the ladder.
 * You fight the snooker player in a snooker club. Deriving it the other way
 * round put a man with a cue in the middle of a football pitch.
 */
export const SPORT_VENUE = {
  football:   'THE REC',
  boxing:     'THE SPORTS HALL',
  athletics:  'THE ATHLETICS TRACK',
  cricket:    'THE COUNTY GROUND',
  snooker:    'THE SNOOKER CLUB',
  darts:      'THE TAP ROOM',
  golf:       'THE MUNICIPAL LINKS',
  tennis:     'THE TENNIS COURTS',
  motorsport: 'THE PADDOCK',
  rugby:      'THE RECREATION GROUND',
  olympics:   'THE OLYMPIC STADIUM',
  telly:      'THE STUDIO',
  racing:     'THE RACECOURSE',
  cycling:    'THE VELODROME',
};
export const PHYSIO_VENUE = 'THE TREATMENT ROOM';
export const WATER_VENUE = 'THE WATER BREAK';
export const BOSS_VENUE = 'THE MAIN ARENA';

/** Star thresholds — see awardStars. */
export const STAR_ACCURACY = 0.6;
export const STAR_CONDITION = 0.6;

export class Ladder {
  constructor(seed, opts = {}) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.sports = opts.sports || [];
    this.editionId = opts.edition || DEFAULT_EDITION;
    this.edition = findEdition(this.editionId);
    this.rungs = [];
    this.build();
  }

  build() {
    const rng = this.rng;
    const inFilter = (f) =>
      !this.sports.length || f.sport === 'any' || this.sports.includes(f.sport);
    const pool = (tier) => {
      const all = byTier(tier, this.editionId);
      const filtered = all.filter(inFilter);
      return filtered.length ? filtered : all;
    };

    // Draw without replacement inside a tier where we can, so one climb does
    // not put you against the same person three rungs running.
    const bags = { 1: rng.shuffle(pool(1)), 2: rng.shuffle(pool(2)), 3: rng.shuffle(pool(3)) };
    const take = (tier) => {
      if (!bags[tier].length) bags[tier] = rng.shuffle(pool(tier));
      return bags[tier].pop();
    };

    for (let i = 0; i < RUNGS; i++) {
      const n = i + 1;
      const last = n === RUNGS;
      // Rung 11 is a physio on purpose. Without it a decent player reaches the
      // boss on fumes and loses to attrition rather than to the questions,
      // which is the least satisfying way to end a climb.
      let kind = KIND.FIGHT;
      if (last) kind = KIND.BOSS;
      else if (n === 4 || n === 11) kind = KIND.PHYSIO;
      else if (n === 8) kind = KIND.WATER;

      const tier = n <= 3 ? 1 : n <= 7 ? 2 : 3;
      const level = n <= 3 ? 1 : n <= 6 ? 2 : n <= 9 ? 3 : 4;

      const fighter = kind === KIND.BOSS ? rng.pick(bosses(this.editionId))
                    : kind === KIND.FIGHT ? take(tier) : null;
      // An edition can carry its own venue names; otherwise the venue follows
      // the opponent's sport.
      const venue = kind === KIND.BOSS ? (this.edition.venues ? this.edition.venues[this.edition.venues.length - 1] : BOSS_VENUE)
                  : kind === KIND.PHYSIO ? PHYSIO_VENUE
                  : kind === KIND.WATER ? WATER_VENUE
                  : this.edition.venues ? this.edition.venues[i % this.edition.venues.length]
                  : SPORT_VENUE[fighter.sport] || 'THE REC';

      this.rungs.push({
        n, kind, level,
        venue,
        fighter,
        cleared: false,
        stars: 0,
        attempts: 0,
      });
    }
  }

  get(n) { return this.rungs[n - 1]; }

  /** A rung is available once the one below it is cleared. */
  available(n) {
    if (n < 1 || n > RUNGS) return false;
    if (n === 1) return true;
    return this.rungs[n - 2].cleared;
  }

  /** The highest rung you can currently walk to. */
  frontier() {
    for (let n = 1; n <= RUNGS; n++) if (!this.rungs[n - 1].cleared) return n;
    return RUNGS;
  }

  clearedCount() { return this.rungs.filter((r) => r.cleared).length; }
  totalStars() { return this.rungs.reduce((a, r) => a + r.stars, 0); }
  maxStars() { return RUNGS * 3; }
  complete() { return this.rungs[RUNGS - 1].cleared; }
}

/**
 * One star for winning, one for answering well, one for not getting hurt.
 * Replaying a rung keeps your best rating.
 */
export function awardStars(battle, player) {
  let stars = 1;
  const accuracy = battle.answered ? battle.perfects / battle.answered : 0;
  if (accuracy >= STAR_ACCURACY) stars++;
  if (player.hp / player.maxHp >= STAR_CONDITION) stars++;
  return stars;
}
