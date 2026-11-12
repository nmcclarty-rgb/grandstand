// Balance sim: bots play whole runs so the target curve is tuned with data.
//
//   node tools/simulate.mjs                  # 200 runs per bot
//   node tools/simulate.mjs --runs 500 --seed 7
//   node tools/simulate.mjs --end 50000      # tune the last matchday's target (default 40000)
//
// A season is 38 matchdays, played through the real season engine (spin, VAR, kick-off, payout, shop).
//
// Three bots, three questions:
//   random      plays 1-5 random cards, never uses VAR.   "How bad is not trying?"
//   greedy      best-scoring hand it can find, discards when behind pace, never discards a keeper, spends VAR when
//               its deck is weak in the spun category. Earns money but never shops.
//               "How far does a competent player get with nothing but the starter squad?"
//   greedy+     greedy that also shops: managers, then training for its favourite hand, then the best pack it can
//               afford (keeps the two stickers that fit its squad).
//               "Does the economy turn a squad into something that can finish a season?"
import { readFileSync } from 'node:fs';
import { makeRng } from '../src/engine/rng.js';
import { makePool, STARTER_SHAPE } from '../src/engine/deck.js';
import { playHand, discard, fixtureTarget, SEASON_LENGTH, TARGET_START, TARGET_END, TARGET_BEND, VAR_PER_SEASON } from '../src/engine/round.js';
import { newSeason, useVar, kickOff, finishMatchday, nextMatchday, buy, takePack, priceOf, releaseCard, ECONOMY } from '../src/engine/season.js';
import { bestPlay as advisorBestPlay } from '../src/engine/advisor.js';
import { CATEGORY_KEYS, cardChips } from '../src/engine/cards.js';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : dflt;
};
const RUNS = arg('runs', 200);
const SEED = arg('seed', 1);
// economy knobs, for tuning: --pick N (stickers kept from a pack), --win N (payout), --release 1 (the bot thins its squad)
if (process.argv.includes('--pick')) ECONOMY.pick = arg('pick', ECONOMY.pick);
if (process.argv.includes('--win')) ECONOMY.winPayout = arg('win', ECONOMY.winPayout);
if (process.argv.includes('--markup')) ECONOMY.managerMarkup = arg('markup', ECONOMY.managerMarkup);
const RELEASE = arg('release', 0);
const TARGETS = { start: arg('start', TARGET_START), end: arg('end', TARGET_END), bend: arg('bend', TARGET_BEND) };
const SHAPE = { clubs: arg('clubs', STARTER_SHAPE.clubs), seasons: arg('seasons', STARTER_SHAPE.seasons) };
const pool = makePool(JSON.parse(readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8')));

// ---- bots ---------------------------------------------------------------------------
const bestPlay = advisorBestPlay;

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

// ---- a season, played through the real season engine --------------------------------------------------------
const deckStrength = (run, cat) => run.deck.map((c) => cardChips(c, cat, pool.scale)).sort((a, b) => b - a).slice(0, 8).reduce((a, b) => a + b, 0);

// The shopping bot: managers first (they multiply everything), then training for the hand it plays most, then the best
// pack it can afford, keeping the two stickers that fit its squad. It never rerolls and never sells.
function shop(run, played) {
  // a sticker fits if he was a team-mate of someone in the squad (shares a club-season), or played for one of its clubs;
  // one you already own is worth a foil upgrade, not a second copy
  const want = (c, stints, clubs, ids) => c.rating + (c.stints.some((x) => stints.has(x)) ? 60 : 0) + (c.clubs.some(([k]) => clubs.has(k)) ? 30 : 0) + (ids.has(c.id) ? 15 : 0);
  const fav = Object.entries(played).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h);
  for (let guard = 0; guard < 20; guard++) {
    const open = run.shop.offers.filter((o) => !o.bought && priceOf(run, o) <= run.money);
    const mgr = open.find((o) => o.kind === 'manager' && run.jokers.length < ECONOMY.managerSlots);
    const trn = open.find((o) => o.kind === 'training' && fav.includes(o.hand));
    const packs = open.filter((o) => o.kind === 'pack').sort((a, b) => priceOf(run, b) - priceOf(run, a));
    const pick = mgr ?? trn ?? packs[0];
    if (!pick) return;
    buy(run, pick.slot);
    if (run.pack) {
      const stints = new Set(run.deck.flatMap((c) => c.stints)), clubs = new Set(run.deck.flatMap((c) => c.clubs.map(([k]) => k))), ids = new Set(run.deck.map((c) => c.id));
      const best = [...run.pack.cards].sort((a, b) => want(b, stints, clubs, ids) - want(a, stints, clubs, ids)).slice(0, ECONOMY.pick);
      takePack(run, best.map((c) => c.uid));
    }
  }
  // thin the squad: release the stickers that fit it least, keeping two keepers (they are worth holding)
  if (RELEASE) {
    const count = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
    const tc = new Map(), cc = new Map();
    for (const c of run.deck) { for (const x of c.stints) count(tc, x); count(cc, c.club); }
    const mates = (c) => c.stints.reduce((n, x) => n + tc.get(x) - 1, 0);
    const keep = (c) => c.rating + 3 * mates(c) + 10 * (cc.get(c.club) - 1);
    const out = [...run.deck].filter((c) => c.pos !== 'GK').sort((a, b) => keep(a) - keep(b));
    for (const c of out) {
      if (run.deck.length <= Math.max(ECONOMY.minDeck, RELEASE) || run.money < ECONOMY.releaseCost + 4) break;
      releaseCard(run, c.uid);
    }
  }
}

function playRun(botName, shops, seed) {
  const rng = makeRng(`${seed}:bot`);
  const run = newSeason(pool, seed, { targets: TARGETS, shape: SHAPE });
  const results = [];
  results.varUsed = 0;
  const played = {};
  while (run.status === 'playing') {
    // VAR: a bot that knows its deck overturns a spin that lands on a category the deck is weak in
    if (botName !== 'random' && run.varLeft > 0) {
      const best = Math.max(...CATEGORY_KEYS.map((c) => deckStrength(run, c)));
      if (deckStrength(run, run.fixture.category) < 0.5 * best) { useVar(run); results.varUsed++; }
    }
    const category = run.fixture.category;
    const round = kickOff(run);
    let guard = 0;
    while (round.status === 'playing' && guard++ < 50) bots[botName](round, rng);
    for (const p of round.plays) played[p.type] = (played[p.type] ?? 0) + 1;
    const fin = finishMatchday(run);
    results.push({ won: fin.won, handsLeft: round.handsLeft, category, plays: round.plays.map((p) => p.type), managers: run.jokers.length, deck: run.deck.length, money: run.money });
    if (run.phase === 'shop') { if (shops) shop(run, played); nextMatchday(run); }
  }
  return results;
}

// ---- report -------------------------------------------------------------------------
const configs = [
  ['random', 'random', false],
  ['greedy', 'greedy', false],     // earns money but never shops
  ['greedy+', 'greedy', true],     // shops
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
console.log(`\n${RUNS} runs per bot, seed ${SEED}, targets ${TARGETS.start} -> ${TARGETS.end} (bend ${TARGETS.bend})  (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
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

// ---- what the shopping bot ends up with ----------------------------------------------------------------------
{
  const rows = table['greedy+'].runs;
  const at = (md) => { const r = rows.filter((x) => x.length >= md).map((x) => x[md - 1]); return r.length ? { n: r.length, managers: r.reduce((a, x) => a + x.managers, 0) / r.length, deck: r.reduce((a, x) => a + x.deck, 0) / r.length, money: r.reduce((a, x) => a + x.money, 0) / r.length } : null; };
  console.log('\ngreedy+ after matchday: managers owned / squad size / unspent money  (runs still going)');
  for (const md of [5, 10, 15, 20, 25, 30]) { const x = at(md); if (x) console.log(`  ${String(md).padStart(2)}: ${x.managers.toFixed(1)} / ${x.deck.toFixed(0)} / £${x.money.toFixed(0)}  (${x.n})`); }
}

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
