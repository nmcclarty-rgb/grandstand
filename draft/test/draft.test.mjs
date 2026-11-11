import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './helpers.mjs';
import { RULES, TIER_SLOTS, PRICE_NOISE, newMatch, pick, free, canAfford, maxSpend, firstPicker, positionOf, showdown, universeOf, valueOf } from '../src/engine/draft.js';
import { choose, botMove, worth, LEVELS } from '../src/engine/bot.js';
import { CATEGORY_KEYS, statOf } from '../../stickers/src/engine/cards.js';

// play a whole draft with a policy for each side; returns the finished state
function draft(seed, policy = (s, who) => choose(s, who, 'medium')) {
  const s = newMatch(pool, seed);
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, policy(s, who)); }
  return s;
}

test('the rules: £10, five rounds, a board of eight', () => {
  assert.deepEqual([RULES.budget, RULES.rounds, RULES.boardSize], [10, 5, 8]);
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

test('boards are reproducible, and no player is shown twice in a match', () => {
  const a = newMatch(pool, 'x'), b = newMatch(pool, 'x');
  assert.deepEqual(a.board.map((e) => [e.card.id, e.price]), b.board.map((e) => [e.card.id, e.price]));
  for (let i = 0; i < 60; i++) {
    const s = draft(`u${i}`);
    assert.equal(new Set(s.shown).size, s.shown.length, 'a player on two boards');
    assert.equal(s.shown.length, 40);
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
  // keepers are only ranked among keepers: the best keeper is a star even though a keeper scores little
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
    // a policy that spends as much as it can, one that spends as little, and a random one
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

test('an attribute is rolled before the draft: all four come up, it is the same for a seed, and it does not change', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(newMatch(pool, `c${i}`).category);
  assert.deepEqual([...seen].sort(), [...CATEGORY_KEYS].sort());
  assert.equal(newMatch(pool, 'same').category, newMatch(pool, 'same').category);
  const s = draft('stable');
  const cat = s.category;
  assert.equal(showdown(s).category, cat);
});

test('the showdown is just addition: each team\'s real career totals in the attribute, biggest wins', () => {
  const tally = (s, who, cat) => s.teams[who].reduce((sum, c) => sum + (cat === 'discipline' ? c.yellow + 3 * c.red : c[cat]), 0);
  let you = 0, bot = 0, draws = 0;
  for (let i = 0; i < 400; i++) {
    const s = draft(`sd${i}`);
    const cat = s.category;
    const r = showdown(s);
    assert.equal(r.you.total, tally(s, 'you', cat));
    assert.equal(r.bot.total, tally(s, 'bot', cat));
    assert.equal(r.you.players.length, 5);
    assert.deepEqual(r.you.players.map((p) => p.value), s.teams.you.map((c) => statOf(c, cat)));
    assert.deepEqual(r.you.players.map((p) => p.paid), s.paid.you);
    assert.equal(r.winner, r.you.total > r.bot.total ? 'you' : r.bot.total > r.you.total ? 'bot' : 'draw');
    assert.equal(s.phase, 'over');
    if (r.winner === 'you') you++; else if (r.winner === 'bot') bot++; else draws++;
  }
  assert.ok(you > 50 && bot > 50, 'both sides win some');
  assert.throws(() => showdown(newMatch(pool, 'early')), /not picked yet/);
});

test('discipline counts a yellow card as 1 and a red card as 3; goals, assists and appearances are the career totals', () => {
  const c = { goals: 7, assists: 3, games: 120, yellow: 5, red: 1 };
  assert.equal(valueOf(c, 'goals'), 7);
  assert.equal(valueOf(c, 'assists'), 3);
  assert.equal(valueOf(c, 'games'), 120);
  assert.equal(valueOf(c, 'discipline'), 8);
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

test('the hard bot looks for value: it is not simply buying the dearest, and in the last round it spends what it can', () => {
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

test('worth is a share of the record, so all four attributes are on one 0-100 scale', () => {
  for (const cat of CATEGORY_KEYS) {
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

test('the levels are ordered: hard beats medium beats easy, over many matches', () => {
  const win = (a, b, n = 300) => {
    let w = 0;
    for (let i = 0; i < n; i++) {
      const s = newMatch(pool, `lv-${a}-${b}-${i}`, { level: b });
      while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, who === 'you' ? a : b)); }
      const r = showdown(s);
      if (r.winner === 'you') w++; else if (r.winner === 'draw') w += 0.5;
    }
    return w / n;
  };
  assert.ok(win('hard', 'easy') > 0.6);
  assert.ok(win('medium', 'easy') > 0.5);
  assert.ok(win('hard', 'medium') > 0.55);
  assert.ok(win('easy', 'hard') < 0.4);
});
