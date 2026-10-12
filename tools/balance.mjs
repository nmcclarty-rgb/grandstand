/**
 * Combat balance simulation.
 *
 *   node tools/balance.mjs
 *
 * Plays thousands of fights at four player skill levels and prints the win
 * rate, fight length and health remaining for each tier. Change any number in
 * battle.js or roster.js and run this before you believe yourself.
 *
 * Two reports:
 *
 *   SINGLE FIGHTS — win rate per tier at full health. Useful for tuning a
 *   fighter's numbers, but optimistic: in a real run you arrive battered.
 *
 *   FULL CLIMBS — the one that matters. Plays whole ladders, energy and all,
 *   and reports how far each skill level gets. Target curve:
 *     clueless      ~7/12 rungs, never champion
 *     pub quiz      ~9/12,  champion now and then
 *     decent dad    ~11/12, champion more often than not
 *     encyclopaedic  12/12, champion nearly always, still chasing stars
 *
 * A caveat worth remembering: the simulated player answers at a fixed speed
 * and so banks a very consistent clock bonus. Real people are slower and
 * streakier, so treat these as an upper bound.
 */

import { Battle, PHASE } from '../src/game/battle.js';
import { byTier, bosses } from '../src/data/roster.js';
import { CHARACTERS } from '../src/data/characters.js';
import { KIND, RUNGS } from '../src/game/ladder.js';

// The run needs a localStorage to import; it never reads one here.
globalThis.localStorage = globalThis.localStorage
  || { getItem: () => null, setItem() {}, removeItem() {} };
const { Run, ENTER_COST, BATTLE_TURN_COST } = await import('../src/game/state.js');

// How far up the ladder does a given skill level get before the energy runs out?

function climb(skill, answerMs, charId, trials = 300) {
  let cleared = 0, champions = 0, stars = 0, fights = 0;
  for (let t = 0; t < trials; t++) {
    const run = new Run({ seed: t * 7919 + 11, characterId: charId });
    let guard = 0;
    while (!run.over && guard++ < 60) {
      const n = run.ladder.frontier();
      run.moveTo(n);
      const rung = run.rung;
      if (rung.kind === KIND.PHYSIO || rung.kind === KIND.BONUS) { run.takeRest(); continue; }
      if (!run.canAfford(ENTER_COST)) { run.end('energy'); break; }
      run.spendEnergy(ENTER_COST);
      const b = new Battle(run.player, rung.fighter, {
        level: rung.level, usedQuestions: run.usedQuestions, seed: (run.seed ^ (rung.n * 104729)) >>> 0,
      });
      b.begin(); fights++;
      let g2 = 0;
      while (b.phase !== PHASE.WON && b.phase !== PHASE.LOST && g2++ < 200) {
        if (b.phase === PHASE.RESOLVE) { b.advance(); continue; }
        run.spendEnergy(BATTLE_TURN_COST);
        const o = b.question.options, v = o.map((x) => x.value);
        const ideal = b.phase === PHASE.BLOCK ? Math.min(...v) : Math.max(...v);
        const pick = Math.random() < skill ? v.indexOf(ideal) : Math.floor(Math.random() * 3);
        b.answer(pick, answerMs);
      }
      run.finishBattle(rung, b, b.phase === PHASE.WON);
    }
    cleared += run.ladder.clearedCount();
    stars += run.ladder.totalStars();
    if (run.outcome === 'champion') champions++;
  }
  return { rungs: cleared / trials, champ: champions / trials, stars: stars / trials, fights: fights / trials };
}




// Simulate a player of a given skill: chance of nailing the perfect pick,
// and a typical answer time.
function simulate(foe, level, skill, answerMs, trials = 600) {
  let wins = 0, rounds = 0, hpLeft = 0;
  for (let t = 0; t < trials; t++) {
    const player = { name: 'P', hp: 120, maxHp: 120, power: 22, nutmegs: 3 };
    const b = new Battle(player, foe, { level, seed: t * 7919 + 13 });
    b.begin();
    let guard = 0;
    while (b.phase !== PHASE.WON && b.phase !== PHASE.LOST && guard++ < 300) {
      if (b.phase === PHASE.RESOLVE) { b.advance(); continue; }
      const opts = b.question.options;
      const ideal = b.phase === PHASE.BLOCK ? Math.min(...opts.map(o=>o.value))
                                            : Math.max(...opts.map(o=>o.value));
      let pick;
      if (Math.random() < skill) pick = opts.findIndex(o => o.value === ideal);
      else pick = Math.floor(Math.random() * opts.length);
      b.answer(pick, answerMs);
    }
    if (b.phase === PHASE.WON) { wins++; hpLeft += player.hp; rounds += b.round; }
  }
  return {
    winRate: wins / trials,
    avgRounds: wins ? rounds / wins : 0,
    avgHpLeft: wins ? hpLeft / wins : 0,
  };
}

const skills = [
  ['clueless  (33% = random)', 0.33, 9000],
  ['pub quiz  (55%)',          0.55, 7000],
  ['decent dad(70%)',          0.70, 5000],
  ['encyclopaedic (90%)',      0.90, 3000],
];

console.log('%-26s %-18s %6s %8s %8s', 'SKILL', 'OPPONENT', 'WIN%', 'ROUNDS', 'HP LEFT');
for (const [label, skill, ms] of skills) {
  for (const [foe, lvl] of [[byTier(1)[0],1],[byTier(2)[0],2],[byTier(3)[0],3],[bosses()[1],4]]) {
    const r = simulate(foe, lvl, skill, ms, 400);
    console.log(
      label.padEnd(26),
      foe.name.padEnd(18),
      (r.winRate*100).toFixed(0).padStart(5)+'%',
      r.avgRounds.toFixed(1).padStart(8),
      r.avgHpLeft.toFixed(0).padStart(8));
  }
  console.log('');
}


console.log('\nFULL CLIMBS');
console.log('%s', 'SKILL'.padEnd(26) + 'RUNGS/12  CHAMPION%  STARS/36  FIGHTS');
const LEVELS = [
  ['clueless   (33%, slow)', 0.33, 9000],
  ['pub quiz   (55%, 7s)', 0.55, 7000],
  ['decent dad (70%, 5s)', 0.70, 5000],
  ['encyclopaedic (90%, 3s)', 0.90, 3000],
];
for (const [label, skill, ms] of LEVELS) {
  const r = climb(skill, ms, 'ringer');
  console.log(label.padEnd(26) + r.rungs.toFixed(1).padStart(8)
    + (r.champ * 100).toFixed(0).padStart(10) + '%'
    + r.stars.toFixed(1).padStart(9) + r.fights.toFixed(1).padStart(8));
}

console.log('\nCHARACTERS AT PUB-QUIZ SKILL (55%)');
console.log('  NB: the simulated player never spends a nutmeg, so THE');
console.log('  STATISTICIAN\'s entire perk is invisible here. Do not "fix" it');
console.log('  on the strength of this table. Same caveat, smaller, for THE');
console.log('  FANTASY MANAGER: it trades win rate for rep, which is the point.');
console.log('%s', 'FIGHTER'.padEnd(26) + 'RUNGS/12  CHAMPION%  STARS/36');
for (const ch of CHARACTERS) {
  const r = climb(0.55, 7000, ch.id, 200);
  console.log(ch.name.padEnd(26) + r.rungs.toFixed(1).padStart(8)
    + (r.champ * 100).toFixed(0).padStart(10) + '%' + r.stars.toFixed(1).padStart(9));
}
console.log('');
