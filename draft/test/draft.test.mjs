import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './helpers.mjs';
import { RULES, TIER_SLOTS, PRICE_NOISE, newMatch, nextMatch, pick, free, canAfford, maxSpend, firstPicker, positionOf, showdown, seriesOf, universeOf, valueOf } from '../src/engine/draft.js';
import { choose, botMove, worth, LEVELS } from '../src/engine/bot.js';
import { ATTRIBUTE_KEYS, recordOf } from '../src/engine/attributes.js';

// play a whole draft (one match) with a policy for each side; returns the state
function draft(seed, policy = (s, who) => choose(s, who, 'medium'), opts = {}) {
  const s = newMatch(pool, seed, opts);
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, policy(s, who)); }
  return s;
}
// play a whole series with a policy for each side
function series(seed, policy = (s, who) => choose(s, who, 'medium'), opts = {}) {
  const s = newMatch(pool, seed, opts);
  for (;;) {
    while (s.phase === 'draft') { const who = s.turn; pick(s, who, policy(s, who)); }
    showdown(s);
    if (s.phase === 'over') return s;
    nextMatch(s);
  }
}

test('the rules: £10, five rounds, a board of eight, a best of three', () => {
  assert.deepEqual([RULES.budget, RULES.rounds, RULES.boardSize, RULES.matches], [10, 5, 8, 3]);
  assert.equal(TIER_SLOTS.length, RULES.boardSize);
  assert.equal(TIER_SLOTS.filter((t) => t === 1).length, 3, 'three cheap players, so the second picker always has a legal pick');
});

test('the wheel gives five positions, never one position three times, and is the same for a seed', () => {
  for (let i = 0; i < 300; i++) {
    const s = newMatch(pool, `w${i}`);
    assert.equal(s.positions.length, 5);
    for (const pos of ['GK', 'DEF', 'MID', 'FWD']) assert.ok(s.positions.filter((p) => p === pos).length <= 2, `${s.positions}`);
  }
  assert.deepEqual(newMatch(pool, 'same').positions, newMatch(pool, 'same').positions);
  const seen = new Set();
  for (let i = 0; i < 100; i++) newMatch(pool, `v${i}`).positions.forEach((p) => seen.add(p));
  assert.equal(seen.size, 4, 'every position comes up');
});

test('a board: eight different players of the round\'s position, with prices from £1 to £5', () => {
  for (let i = 0; i < 100; i++) {
    const s = newMatch(pool, `b${i}`);
    assert.equal(s.board.length, 8);
    assert.equal(new Set(s.board.map((b) => b.card.id)).size, 8);
    for (const b of s.board) {
      assert.equal(b.card.pos, positionOf(s));
      assert.ok(b.card.games >= RULES.minGames, `${b.card.full}: you should have heard of him (${b.card.games} games)`);
      assert.ok(b.price >= 1 && b.price <= 5);
    }
    assert.ok(s.board.filter((b) => b.price === 1).length >= 3, 'at least three £1 players');
  }
});

test('boards are reproducible, and no player is shown twice in a whole series', () => {
  const a = newMatch(pool, 'x'), b = newMatch(pool, 'x');
  assert.deepEqual(a.board.map((e) => [e.card.id, e.price]), b.board.map((e) => [e.card.id, e.price]));
  for (let i = 0; i < 30; i++) {
    const s = series(`u${i}`, (st, who) => choose(st, who, 'easy'), { categories: ['goals', 'assists', 'games'] });
    assert.equal(new Set(s.shown).size, s.shown.length, 'a player on two boards');
    assert.equal(s.shown.length, 8 * 5 * s.results.length);
  }
});

test('a price is a hint, not the truth: tiers 2-4 are nudged, tier 1 is always £1, a star is never above £5', () => {
  let moved = 0, n = 0, up = 0, down = 0;
  for (let i = 0; i < 400; i++) {
    const s = newMatch(pool, `n${i}`);
    for (const b of s.board) {
      if (b.tier === 1) assert.equal(b.price, 1);
      if (b.tier === 5) assert.ok(b.price >= 4 && b.price <= 5);
      assert.ok(Math.abs(b.price - b.tier) <= 1);
      if (b.tier >= 2 && b.tier <= 4) { n++; if (b.price !== b.tier) moved++; if (b.price > b.tier) up++; if (b.price < b.tier) down++; }
    }
  }
  assert.ok(Math.abs(moved / n - PRICE_NOISE) < 0.05, `${moved / n} of tiers 2-4 were nudged`);
  assert.ok(up > 0 && down > 0, 'both bargains and traps happen');
});

test('the true tiers follow the overall within a position: a star is better than a squad player', () => {
  const u = universeOf(pool);
  for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
    const mean = (t) => u[pos][t].reduce((s, c) => s + c.rating, 0) / u[pos][t].length;
    for (let t = 1; t < 5; t++) assert.ok(mean(t + 1) > mean(t), `${pos} tier ${t + 1} should be better than tier ${t}`);
    assert.ok(u[pos][5].length >= 3 && u[pos][4].length >= 6, `${pos} has enough players for every tier`);
  }
  assert.ok(u.GK[5].some((c) => c.full === 'David James' || c.full === 'Mark Schwarzer' || c.full === 'Shay Given'));
});

test('budget: you must keep £1 for every round still to come', () => {
  const s = newMatch(pool, 'budget');
  assert.equal(maxSpend(s, 'you'), 10 - 4);
  assert.ok(canAfford(s, 'you', 6) && !canAfford(s, 'you', 7));
  const first = s.turn;
  const star = s.board.find((b) => b.price === 5);
  pick(s, first, star.card.id);
  assert.equal(s.money[first], 5);
  assert.throws(() => pick(s, first, s.board[0].card.id), /not .* turn/);
});

test('turns: the first picker alternates each round, and each side picks once a round', () => {
  const s = newMatch(pool, 'turns', { first: 'you' });
  const order = [];
  while (s.phase === 'draft') { const who = s.turn; order.push(`${s.round}:${who}`); pick(s, who, choose(s, who, 'easy')); }
  assert.deepEqual(order, ['1:you', '1:bot', '2:bot', '2:you', '3:you', '3:bot', '4:bot', '4:you', '5:you', '5:bot']);
  assert.equal(s.teams.you.length, 5);
  assert.equal(s.teams.bot.length, 5);
  assert.equal(s.phase, 'showdown');
  assert.equal(firstPicker(newMatch(pool, 'f', { first: 'bot' })), 'bot');
});

test('who picks first in the next match: the side that picked first in the last round of this one goes second', () => {
  const s = newMatch(pool, 'seat', { first: 'you' });
  const firsts = [];
  for (let m = 0; m < 2; m++) {
    firsts.push(s.turn);
    while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'easy')); }
    showdown(s);
    if (s.phase === 'between') nextMatch(s);
  }
  assert.deepEqual(firsts, ['you', 'bot']);
});

test('illegal picks are refused', () => {
  const s = newMatch(pool, 'illegal', { first: 'you' });
  assert.throws(() => pick(s, 'bot', s.board[0].card.id), /not the bot's turn/);
  assert.throws(() => pick(s, 'you', 'nobody:1900'), /not on the board/);
  const e = s.board.find((b) => b.price === 1);
  pick(s, 'you', e.card.id);
  assert.throws(() => pick(s, 'bot', e.card.id), /already picked/);
  assert.equal(free(s).length, 7);
});

test('RULE: every draft always finishes: both teams get five players and nobody goes under £0 (any policy)', () => {
  for (let i = 0; i < 400; i++) {
    for (const policy of [
      (s, who) => free(s).filter((b) => canAfford(s, who, b.price)).sort((a, b) => b.price - a.price)[0].card.id,
      (s, who) => free(s).filter((b) => canAfford(s, who, b.price)).sort((a, b) => a.price - b.price)[0].card.id,
      (s, who) => { const o = free(s).filter((b) => canAfford(s, who, b.price)); return o[(i * 7 + s.round) % o.length].card.id; },
    ]) {
      const s = draft(`f${i}`, policy);
      assert.equal(s.teams.you.length, 5); assert.equal(s.teams.bot.length, 5);
      assert.ok(s.money.you >= 0 && s.money.bot >= 0);
      assert.equal(s.money.you, 10 - s.paid.you.reduce((a, b) => a + b, 0));
    }
  }
});

// ---- the series --------------------------------------------------------------------------------------------------------------------
test('three different attributes, one drawn at the start of each match, from all five', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const s = series(`a${i}`, (st, who) => choose(st, who, 'easy'), { categories: undefined });
    // a series can stop after two matches: whatever was played used different attributes
    const cats = s.results.map((r) => r.category);
    assert.equal(new Set(cats).size, cats.length, `a repeated attribute: ${cats}`);
    assert.ok(cats.length >= 2 && cats.length <= 3);
    for (const c of cats) { assert.ok(ATTRIBUTE_KEYS.includes(c)); seen.add(c); }
    assert.equal(s.used.length, cats.length);
  }
  assert.deepEqual([...seen].sort(), [...ATTRIBUTE_KEYS].sort(), 'all five come up');
});

test('the attribute is known from the start of a match, is fixed for it, and depends only on the seed, never on who you buy', () => {
  const s = newMatch(pool, 'known');
  const cat = s.category;
  assert.ok(ATTRIBUTE_KEYS.includes(cat));
  while (s.phase === 'draft') { assert.equal(s.category, cat); const who = s.turn; pick(s, who, choose(s, who, 'easy')); }
  const a = series('indep', (st, who) => choose(st, who, 'easy')), b = series('indep', (st, who) => choose(st, who, 'hard'));
  assert.equal(a.results[0].category, b.results[0].category, 'match 1');
  assert.equal(newMatch(pool, 'known').category, cat, 'the same for a seed');
});

test('a fresh team every match: new money, new teams, and nobody from an earlier match', () => {
  const s = newMatch(pool, 'fresh');
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'medium')); }
  const first = { you: s.teams.you.map((c) => c.id), bot: s.teams.bot.map((c) => c.id), cat: s.category };
  const r = showdown(s);
  if (s.phase !== 'between') return assert.ok(r.series.over);
  assert.throws(() => pick(s, 'you', 'x'), /draft is over/);
  nextMatch(s);
  assert.equal(s.phase, 'draft');
  assert.equal(s.match, 2);
  assert.deepEqual(s.money, { you: 10, bot: 10 }, 'a fresh budget');
  assert.deepEqual(s.teams, { you: [], bot: [] }, 'a fresh team');
  assert.notEqual(s.category, first.cat, 'a different attribute');
  const used = new Set([...first.you, ...first.bot]);
  assert.ok(s.board.every((b) => !used.has(b.card.id)), 'nobody used in match 1 is on a board');
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'medium')); }
  for (const c of [...s.teams.you, ...s.teams.bot]) assert.ok(!used.has(c.id), `${c.full} was used in match 1`);
});

test('nextMatch only works between matches', () => {
  const s = newMatch(pool, 'nm');
  assert.throws(() => nextMatch(s), /not waiting/);
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'easy')); }
  assert.throws(() => nextMatch(s), /not waiting/);
  assert.throws(() => showdown(newMatch(pool, 'early')), /not picked yet/);
});

test('the showdown is addition: each team\'s real career totals in the attribute, the bigger total wins the match', () => {
  const tally = (s, who, cat) => s.teams[who].reduce((sum, c) => sum + (cat === 'discipline' ? c.yellow + 3 * c.red : cat === 'involvements' ? c.goals + c.assists : c[cat]), 0);
  let you = 0, bot = 0;
  for (let i = 0; i < 300; i++) {
    const s = draft(`sd${i}`);
    const cat = s.category;
    const t = { you: tally(s, 'you', cat), bot: tally(s, 'bot', cat) };
    const r = showdown(s);
    assert.equal(r.you.total, t.you);
    assert.equal(r.bot.total, t.bot);
    assert.equal(r.category, cat);
    assert.equal(r.you.players.length, 5);
    assert.deepEqual(r.you.players.map((p) => p.value), s.teams.you.map((c) => valueOf(c, cat)));
    assert.deepEqual(r.you.players.map((p) => p.paid), s.paid.you);
    assert.equal(r.winner, t.you > t.bot ? 'you' : t.bot > t.you ? 'bot' : 'draw');
    if (r.winner === 'you') you++; else if (r.winner === 'bot') bot++;
    assert.equal(s.results.length, 1);
    assert.equal(s.phase, 'between');   // one match is never a whole series
  }
  assert.ok(you > 50 && bot > 50, 'both sides win some');
});

test('the series: first to two matches wins, and it stops at 2-0', () => {
  let two = 0, three = 0;
  for (let i = 0; i < 200; i++) {
    const s = series(`ser${i}`);
    const r = seriesOf(s);
    assert.ok(r.over && r.winner);
    if (s.results.length === 2) { two++; assert.ok(r.wins.you === 2 || r.wins.bot === 2); assert.equal(s.results[0].winner, s.results[1].winner); }
    else { three++; assert.equal(s.results.length, 3); }
    if (r.wins.you !== r.wins.bot) assert.equal(r.winner, r.wins.you > r.wins.bot ? 'you' : 'bot');
    assert.equal(s.phase, 'over');
  }
  assert.ok(two > 20 && three > 20, `${two} ended 2-0, ${three} went to three`);
});

test('a level series (a drawn match): the larger share of the attribute records wins, otherwise a draw', () => {
  const s = newMatch(pool, 'level');
  const mk = (winner, you, bot, category) => ({ match: 1, category, winner, you: { total: you }, bot: { total: bot } });
  s.results = [mk('you', 100, 50, 'goals'), mk('bot', 20, 40, 'assists'), mk('draw', 300, 300, 'games')];
  const r = seriesOf(s);
  assert.equal(r.wins.you, 1); assert.equal(r.wins.bot, 1); assert.ok(r.over);
  const share = (who) => s.results.reduce((sum, x) => sum + x[who].total / recordOf(pool, x.category), 0);
  assert.equal(r.winner, share('you') > share('bot') ? 'you' : 'bot');
  assert.equal(r.decidedBy, 'share of the records');
  s.results = [mk('draw', 0, 0, 'goals'), mk('draw', 0, 0, 'assists'), mk('draw', 0, 0, 'games')];
  assert.equal(seriesOf(s).winner, 'draw');
  s.results = [mk('you', 1, 0, 'goals')];
  assert.equal(seriesOf(s).over, false);
});

test('the easy bot goes on names: it takes the dearest player it can afford', () => {
  let dearest = 0, n = 0;
  for (let i = 0; i < 200; i++) {
    const s = newMatch(pool, `e${i}`, { first: 'bot' });
    const id = choose(s, 'bot', 'easy');
    const best = Math.max(...s.board.filter((b) => canAfford(s, 'bot', b.price)).map((b) => b.price));
    n++; if (s.board.find((b) => b.card.id === id).price >= best - 1) dearest++;
  }
  assert.ok(dearest / n > 0.95, `${dearest / n}`);
});

test('the hard bot looks for value for this match\'s attribute: it is not simply buying the dearest, and in the last round it spends what it can', () => {
  let nonStar = 0;
  for (let i = 0; i < 200; i++) {
    const s = newMatch(pool, `h${i}`, { first: 'bot', level: 'hard' });
    const id = choose(s, 'bot', 'hard');
    if (s.board.find((b) => b.card.id === id).price < 5) nonStar++;
  }
  assert.ok(nonStar > 100);
  const s = newMatch(pool, 'last', { first: 'bot', level: 'hard' });
  while (s.round < 5) { const who = s.turn; pick(s, who, choose(s, who, 'easy')); }
  const id = choose(s, s.turn, 'hard');
  const options = free(s).filter((b) => canAfford(s, s.turn, b.price));
  assert.equal(id, options.sort((a, b) => worth(b.card, s.category, pool) - worth(a.card, s.category, pool))[0].card.id, 'the best player it can afford for the attribute');
});

test('the bot picks for the attribute: told "goals" it buys at least as many goals as when told "discipline", and the other way round', () => {
  let goalsWhenGoals = 0, goalsWhenDiscipline = 0, discWhenDisc = 0, discWhenGoals = 0;
  for (let i = 0; i < 40; i++) {
    const run = (category) => {
      const s = newMatch(pool, `focus${i}`, { mode: 'eleven', categories: [category] });
      while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'hard')); }
      return s.teams.bot;
    };
    const g = run('goals'), d = run('discipline');
    const sum = (team, k) => team.reduce((t, c) => t + valueOf(c, k) / recordOf(pool, k), 0);
    goalsWhenGoals += sum(g, 'goals'); goalsWhenDiscipline += sum(d, 'goals');
    discWhenDisc += sum(d, 'discipline'); discWhenGoals += sum(g, 'discipline');
  }
  assert.ok(goalsWhenGoals > goalsWhenDiscipline, `${goalsWhenGoals} against ${goalsWhenDiscipline}`);
  assert.ok(discWhenDisc > discWhenGoals, `${discWhenDisc} against ${discWhenGoals}`);
});

test('worth is a share of the record, so every attribute is on one 0-100 scale', () => {
  for (const cat of ATTRIBUTE_KEYS) {
    const best = Math.max(...pool.cards.map((c) => worth(c, cat, pool)));
    assert.ok(Math.abs(best - 100) < 1e-9, `${cat}: ${best}`);
  }
});

test('botMove plays the bot\'s turn, and the bot never makes an illegal pick at any level', () => {
  for (const level of LEVELS) {
    for (let i = 0; i < 100; i++) {
      const s = newMatch(pool, `bm${level}${i}`, { level });
      while (s.phase === 'draft') { if (s.turn === 'bot') botMove(s); else pick(s, 'you', choose(s, 'you', 'easy')); }
      assert.equal(s.teams.bot.length, 5);
    }
  }
});

test('the levels are ordered over a series: hard beats medium beats easy', () => {
  const win = (a, b, n = 200) => {
    let w = 0;
    for (let i = 0; i < n; i++) {
      const s = series(`lv-${a}-${b}-${i}`, (st, who) => choose(st, who, who === 'you' ? a : b), { level: b });
      const r = seriesOf(s);
      if (r.winner === 'you') w++; else if (r.winner === 'draw') w += 0.5;
    }
    return w / n;
  };
  assert.ok(win('hard', 'easy') > 0.6);
  assert.ok(win('medium', 'easy') > 0.5);
  assert.ok(win('hard', 'medium') > 0.55);
  assert.ok(win('easy', 'hard') < 0.4);
});
