/**
 * GRANDSTAND — run state and persistence.
 *
 * A run is "a day out": you pick a fighter, then climb the ladder. Energy is
 * the run limiter — every fight costs to enter and every exchange costs on top
 * — so the decision is always "push on to the next rung, or go back down and
 * beat one of them properly for the third star?"
 *
 * Rep persists between runs in the league table. Nothing else does.
 */

import { Ladder, KIND, awardStars, RUNGS } from './ladder.js';
import { findCharacter } from '../data/characters.js';
import { hashSeed } from '../engine/rng.js';

/**
 * The energy budget is what makes a day out a day out. It is tuned so that a
 * 12-rung ladder is just about clearable if you answer well and just about not
 * if you don't: every exchange costs, so a player who nails their answers ends
 * fights sooner and spends less. Loosen these and the ladder stops being a
 * decision and becomes a corridor.
 */
export const START_ENERGY = 130;
export const ENTER_COST = 10;         // walking out to face someone
export const BATTLE_TURN_COST = 1;    // per exchange
export const WIN_REFUND = 6;
export const LOSS_PENALTY = 18;
export const PHYSIO_HEAL = 0.55;      // fraction of max condition restored
export const BONUS_REP = 250;

const SAVE_KEY = 'grandstand.save.v2';

export class Run {
  constructor({ seed, sports = [], characterId = 'ringer', name = 'YOU' } = {}) {
    this.seed = seed || (Math.random() * 0xffffffff) >>> 0;
    this.sports = sports;
    this.name = name;
    this.character = findCharacter(characterId);
    this.ladder = new Ladder(this.seed, { sports });

    const c = this.character;
    this.player = {
      name: c.name,
      id: c.id,
      palette: c.palette,
      build: c.build,
      gear: c.gear,
      hair: c.hair,
      facial: c.facial,
      brow: c.brow,
      hp: c.hp,
      maxHp: c.hp,
      power: c.power,
      nutmegs: c.nutmegs,
      perk: c.perk || {},
    };

    this.energy = START_ENERGY;
    this.maxEnergy = START_ENERGY;
    this.rep = 0;
    this.wins = 0;
    this.losses = 0;
    this.answered = 0;
    this.perfects = 0;
    this.bestCombo = 0;
    this.usedQuestions = new Set();
    this.defeatedIds = [];
    this.at = 1;                 // which rung you are standing on
    this.over = false;
    this.outcome = null;         // 'energy' | 'champion' | 'quit'
    this.startedAt = Date.now();
  }

  get accuracy() { return this.answered ? this.perfects / this.answered : 0; }
  get rung() { return this.ladder.get(this.at); }

  canAfford(cost = ENTER_COST) { return this.energy >= cost; }

  spendEnergy(n) {
    this.energy = Math.max(0, this.energy - n);
    if (this.energy <= 0 && !this.over) this.end('energy');
    return this.energy;
  }

  end(outcome) {
    // Beating the boss always trumps an earlier ending: running the energy down
    // on the final exchange and then winning is still a championship.
    if (this.over && outcome !== 'champion') return;
    this.over = true;
    this.outcome = outcome;
    this.finishedAt = Date.now();
  }

  /** Move to a rung you have unlocked. Costs nothing — the fight is the cost. */
  moveTo(n) {
    if (!this.ladder.available(n)) return false;
    this.at = Math.max(1, Math.min(RUNGS, n));
    return true;
  }

  /** Physio and bonus rungs resolve on arrival rather than in a fight. */
  takeRest() {
    const r = this.rung;
    if (r.kind === KIND.PHYSIO) {
      const before = this.player.hp;
      this.player.hp = Math.min(this.player.maxHp,
        this.player.hp + Math.round(this.player.maxHp * PHYSIO_HEAL));
      r.cleared = true; r.stars = Math.max(r.stars, 3);
      return { kind: KIND.PHYSIO, healed: this.player.hp - before };
    }
    if (r.kind === KIND.BONUS) {
      const gain = Math.round(BONUS_REP * (this.player.perk.repMult || 1));
      this.rep += gain;
      this.player.nutmegs++;
      r.cleared = true; r.stars = Math.max(r.stars, 3);
      return { kind: KIND.BONUS, rep: gain, nutmegs: 1 };
    }
    return null;
  }

  finishBattle(rung, battle, won) {
    this.answered += battle.answered;
    this.perfects += battle.perfects;
    this.bestCombo = Math.max(this.bestCombo, battle.bestCombo);
    this.rep += battle.repEarned;
    rung.attempts++;

    if (won) {
      const wasCleared = rung.cleared;
      rung.cleared = true;
      rung.stars = Math.max(rung.stars, awardStars(battle, this.player));
      if (!wasCleared) {
        this.wins++;
        if (rung.fighter) this.defeatedIds.push(rung.fighter.id);
      }
      this.rep += battle.victoryRep();
      this.energy = Math.min(this.maxEnergy, this.energy + WIN_REFUND);
      if (rung.kind === KIND.BOSS) this.end('champion');
    } else {
      this.losses++;
      this.player.hp = Math.max(1, Math.round(this.player.maxHp * 0.3));
      this.spendEnergy(LOSS_PENALTY);
    }
  }

  scoreCard() {
    const bonus =
      this.rep +
      Math.round(this.accuracy * 500) +
      this.bestCombo * 60 +
      this.ladder.totalStars() * 50 +
      (this.outcome === 'champion' ? 1000 : 0);
    return {
      name: this.name,
      character: this.character.id,
      characterName: this.character.name,
      seed: this.seed,
      rep: bonus,
      wins: this.wins,
      losses: this.losses,
      accuracy: this.accuracy,
      bestCombo: this.bestCombo,
      answered: this.answered,
      stars: this.ladder.totalStars(),
      maxStars: this.ladder.maxStars(),
      rungs: this.ladder.clearedCount(),
      outcome: this.outcome,
      sports: this.sports.slice(),
      date: Date.now(),
    };
  }
}

// ── persistence ───────────────────────────────────────────────────────────

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

const blankSave = () => ({
  league: [], beaten: [], totalRuns: 0, bestRep: 0, muted: false,
  lastSports: [], lastCharacter: 'ringer', lastName: 'YOU',
});

export function loadSave() { return { ...blankSave(), ...(readSave() || {}) }; }

export function recordRun(card) {
  const save = loadSave();
  save.league.push(card);
  save.league.sort((a, b) => b.rep - a.rep);
  save.league = save.league.slice(0, 12);
  save.totalRuns++;
  save.bestRep = Math.max(save.bestRep, card.rep);
  writeSave(save);
  return save;
}

export function recordBeaten(ids) {
  const save = loadSave();
  save.beaten = Array.from(new Set([...save.beaten, ...ids]));
  writeSave(save);
  return save;
}

export function savePrefs(prefs) { writeSave({ ...loadSave(), ...prefs }); }
export function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

export function makeSeedFrom(text) {
  return text && text.trim()
    ? hashSeed(text.trim().toUpperCase())
    : (Math.random() * 0xffffffff) >>> 0;
}

/** Turn a numeric seed into something you can read out in the pub. */
const WORDS = ['SHEARER', 'BRUNO', 'GAZZA', 'DALEY', 'TORVILL', 'HENDRY', 'BOTHAM',
  'FALDO', 'MANSELL', 'GUNNELL', 'CHRISTIE', 'TAYLOR', 'BORG', 'LINEKER', 'REDGRAVE', 'DAVIS'];
export function seedName(seed) {
  return `${WORDS[seed % WORDS.length]}-${(seed >> 8) % 90 + 10}`;
}
