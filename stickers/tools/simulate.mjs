// Balance sim: bots play whole runs so the target curve is tuned with data.
//
//   node tools/simulate.mjs                  # 200 runs per bot
//   node tools/simulate.mjs --runs 500 --seed 7
//   node tools/simulate.mjs --end 50000      # tune the last matchday's target (default 40000)
//
// A season is 38 matchdays. After every win the greedy+ bot gets a pack; every 5th matchday it also gets a
// manager and a training level.
//
// Three bots, three questions:
//   random      plays 1-5 random cards.            "How bad is not trying?"
//   greedy      best-scoring hand it can find,     "How far does a competent player get with
//               discards when behind pace.          nothing but the starter squad?"
//   greedy+     greedy, plus a pack after every win (keeps the 2 cards that best fit its deck),
//               a random manager every 5 matchdays, and a training level for its favourite hand.
//               "Does the curve still bite once the economy is feeding the deck?"
import { readFileSync } from 'node:fs';
import { makeRng } from '../src/engine/rng.js';
import { makePool, starterDeck, openPack, STARTER_SHAPE } from '../src/engine/deck.js';
import { startRound, playHand, discard, fixtureTarget, SEASON_LENGTH, TARGET_START, TARGET_END, spinWheel, WHEEL, VAR_PER_SEASON } from '../src/engine/round.js';
import { scoreHand } from '../src/engine/scoring.js';
import { CATEGORY_KEYS, cardChips, teamKey } from '../src/engine/cards.js';
import { JOKER_IDS } from '../src/engine/jokers.js';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : dflt;
};
const RUNS = arg('runs', 200);
const SEED = arg('seed', 1);
const MAX_MANAGERS = 5;
const MILESTONE = 5; // matchdays between manager / training rewards
const TARGETS = { start: arg('start', TARGET_START), end: arg('end', TARGET_END) };
const SHAPE = { clubs: arg('clubs', STARTER_SHAPE.clubs), seasons: arg('seasons', STARTER_SHAPE.seasons) };
const pool = makePool(JSON.parse(readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8')));

// ---- bots ---------------------------------------------------------------------------
function subsets(n, maxSize) {
  const out = [];
  const rec = (start, cur) => {
    if (cur.length) out.push([...cur]);
    if (cur.length === maxSize) return;
    for (let i = start; i < n; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}
const SUBSETS = subsets(8, 5);

function ctxOf(s, held) {
  return { category: s.category, scale: s.scale, jokers: s.jokers, handLevels: s.handLevels, held, state: { handsLeft: s.handsLeft, discardsLeft: s.discardsLeft } };
}
function bestPlay(s) {
  let best = null;
  for (const idx of SUBSETS) {
    if (idx[idx.length - 1] >= s.hand.length) continue;
    const held = s.hand.filter((_, i) => !idx.includes(i)); // a keeper left in hand adds Safe Hands
    const r = scoreHand(idx.map((i) => s.hand[i]), ctxOf(s, held));
    if (!best || r.total > best.total) best = { idx, total: r.total, scoring: r.scoring };
  }
  return best;
}

const bots = {
  random(s, rng) {
    const k = 1 + rng.int(5);
    const idx = rng.shuffle(s.hand.map((_, i) => i)).slice(0, Math.min(k, s.hand.length));
    playHand(s, idx);
  },
  greedy(s) {
    const best = bestPlay(s);
    const pace = (s.target - s.score) / s.handsLeft;
    if (s.discardsLeft > 0 && best.total < pace && s.drawPile.length) {
      const keep = new Set(best.scoring.map((i) => best.idx[i]));
      const toss = s.hand.map((_, i) => i).filter((i) => !keep.has(i) && s.hand[i].pos !== 'GK') // keepers are worth holding
        .sort((a, b) => cardChips(s.hand[a], s.category, s.scale) - cardChips(s.hand[b], s.category, s.scale)).slice(0, 5);
      if (toss.length) return discard(s, toss);
    }
    playHand(s, best.idx);
  },
};

// ---- a run --------------------------------------------------------------------------
function playRun(botName, rewarded, seed) {
  const rng = makeRng(`${seed}`);
  const run = { deck: starterDeck(pool, rng, SHAPE), jokers: [], handLevels: {}, scale: pool.scale };
  const results = [];
  const played = {};
  let varLeft = VAR_PER_SEASON, varUsed = 0;
  results.varUsed = 0;
  for (let matchday = 1; matchday <= SEASON_LENGTH; matchday++) {
    let category = spinWheel(rng);
    // VAR: a bot that knows its deck overturns a spin that lands on a category the deck is weak in
    if (botName !== 'random' && varLeft > 0) {
      const strength = (cat) => run.deck.map((c) => cardChips(c, cat, pool.scale)).sort((a, b) => b - a).slice(0, 8).reduce((a, b) => a + b, 0);
      const best = Math.max(...CATEGORY_KEYS.map(strength));
      if (strength(category) < 0.5 * best) { category = spinWheel(rng, WHEEL, { not: category }); varLeft--; varUsed++; results.varUsed = varUsed; }
    }
    const s = startRound(run, { target: fixtureTarget(matchday, TARGETS), category, rng });
    let guard = 0;
    while (s.status === 'playing' && guard++ < 50) bots[botName](s, rng);
    results.push({ won: s.status === 'won', score: s.score, handsLeft: s.handsLeft, category, plays: s.plays.map((p) => p.type) });
    for (const p of s.plays) played[p.type] = (played[p.type] ?? 0) + 1;
    if (s.status !== 'won') return results;
    if (rewarded) {
      // a player builds around what they already own: prefer team-mates and club-mates
      const teams = new Set(run.deck.map((c) => teamKey(c)));
      const clubs = new Set(run.deck.map((c) => c.club));
      const want = (c) => c.rating + (teams.has(teamKey(c)) ? 60 : 0) + (clubs.has(c.club) ? 30 : 0);
      const pack = openPack(pool, rng).sort((a, b) => want(b) - want(a));
      run.deck.push(...pack.slice(0, 2));
      if (matchday % MILESTONE === 0) {
        if (run.jokers.length < MAX_MANAGERS) {
          const free = JOKER_IDS.filter((id) => !run.jokers.includes(id));
          run.jokers.push(rng.pick(free));
        }
        // training: level up the hand you play most
        const fav = Object.entries(played).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (fav) run.handLevels[fav] = (run.handLevels[fav] ?? 1) + 1;
      }
    }
  }
  return results;
}

// ---- report -------------------------------------------------------------------------
const configs = [
  ['random', 'random', false],
  ['greedy', 'greedy', false],
  ['greedy+', 'greedy', true],
];
const table = {};
const t0 = Date.now();
for (const [label, bot, rewarded] of configs) {
  const runs = Array.from({ length: RUNS }, (_, i) => playRun(bot, rewarded, `${SEED}:${label}:${i}`));
  const reached = Array(SEASON_LENGTH).fill(0), cleared = Array(SEASON_LENGTH).fill(0), spare = Array(SEASON_LENGTH).fill(0);
  for (const r of runs) r.forEach((x, i) => { reached[i]++; if (x.won) { cleared[i]++; spare[i] += x.handsLeft; } });
  table[label] = { reached, cleared, spare, runs };
}

const pct = (n, d) => (d ? `${String(Math.round((100 * n) / d)).padStart(3)}%` : '  - ');
console.log(`\n${RUNS} runs per bot, seed ${SEED}, targets ${TARGETS.start} -> ${TARGETS.end}  (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
console.log('matchday   target |  random    |  greedy    |  greedy+   |  spare hands (greedy+)');
console.log('-'.repeat(86));
for (let i = 0; i < SEASON_LENGTH; i++) {
  const cell = (l) => `${pct(table[l].cleared[i], table[l].reached[i])} of ${String(table[l].reached[i]).padStart(3)}`;
  const sp = table['greedy+'].cleared[i] ? (table['greedy+'].spare[i] / table['greedy+'].cleared[i]).toFixed(1) : '-';
  console.log(`${String(i + 1).padStart(5)} ${String(fixtureTarget(i + 1, TARGETS)).padStart(10)} | ${cell('random')} | ${cell('greedy')} | ${cell('greedy+')} | ${sp}`);
}
console.log('-'.repeat(86));
for (const [label] of configs) {
  const deaths = table[label].runs.map((r) => r.length - (r.at(-1).won ? 0 : 1));
  deaths.sort((a, b) => a - b);
  const median = deaths[Math.floor(deaths.length / 2)];
  const p90 = deaths[Math.floor(deaths.length * 0.9)];
  const wins = table[label].runs.filter((r) => r.length === SEASON_LENGTH && r.at(-1).won).length;
  console.log(`${label.padEnd(8)} matchdays cleared: median ${String(median).padStart(2)}, best 10% reach ${String(p90).padStart(2)} of ${SEASON_LENGTH}   full seasons: ${wins}/${RUNS}`);
}

const used = (l) => (table[l].runs.reduce((a, r) => a + r.varUsed, 0) / RUNS).toFixed(1);
console.log(`\nVAR reviews used per season (of ${VAR_PER_SEASON}): greedy ${used('greedy')}, greedy+ ${used('greedy+')}`);

// ---- does the category you draw decide the result? ------------------------------------
console.log('\nwin rate by category (all fixtures played)');
console.log('category'.padEnd(10) + configs.slice(1).map(([l]) => l.padStart(10)).join(''));
for (const cat of CATEGORY_KEYS) {
  console.log(cat.padEnd(10) + configs.slice(1).map(([l]) => {
    let w = 0, n = 0;
    for (const r of table[l].runs) for (const x of r) if (x.category === cat) { n++; if (x.won) w++; }
    return pct(w, n).padStart(10);
  }).join(''));
}

// ---- which hands do the bots actually make? -------------------------------------------
import { HANDS, HAND_ORDER } from '../src/engine/hands.js';
console.log('\nhands played (share of all plays)');
console.log('hand'.padEnd(18) + configs.slice(1).map(([l]) => l.padStart(9)).join(''));
const freq = (label) => {
  const f = {}; let n = 0;
  for (const r of table[label].runs) for (const x of r) for (const t of x.plays) { f[t] = (f[t] ?? 0) + 1; n++; }
  return { f, n };
};
const fq = configs.slice(1).map(([l]) => freq(l));
for (const t of HAND_ORDER) console.log(HANDS[t].name.padEnd(18) + fq.map(({ f, n }) => `${(100 * (f[t] ?? 0) / n).toFixed(1)}%`.padStart(9)).join(''));
