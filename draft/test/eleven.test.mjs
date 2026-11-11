import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './helpers.mjs';
import { MODES, FORMATIONS, formationPositions, newMatch, pick, free, canAfford, positionOf, showdown, rollAttribute, rulesOf } from '../src/engine/draft.js';
import { choose, botMove } from '../src/engine/bot.js';

const play = (seed, policy = (s, who) => choose(s, who, 'medium'), opts = {}) => {
  const s = newMatch(pool, seed, { mode: 'eleven', ...opts });
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, policy(s, who)); }
  return s;
};

test('11-a-side rules: £30, eleven rounds, and the five-a-side game is unchanged', () => {
  assert.deepEqual([MODES.eleven.budget, MODES.eleven.rounds], [30, 11]);
  assert.deepEqual([MODES.five.budget, MODES.five.rounds], [10, 5]);
  const f = newMatch(pool, 'five'), e = newMatch(pool, 'eleven', { mode: 'eleven' });
  assert.equal(f.mode, 'five'); assert.equal(f.formation, null); assert.equal(f.positions.length, 5);
  assert.equal(e.mode, 'eleven'); assert.equal(e.positions.length, 11);
  assert.equal(e.money.you, 30); assert.equal(f.money.you, 10);
  assert.equal(rulesOf(e).rounds, 11);
  assert.throws(() => newMatch(pool, 'x', { mode: 'seven' }), /unknown mode/);
});

test('every formation is a goalkeeper and ten outfield players', () => {
  for (const f of FORMATIONS) {
    assert.equal(1 + f.DEF + f.MID + f.FWD, 11, f.name);
    assert.equal(f.name, `${f.DEF}-${f.MID}-${f.FWD}`);
    const p = formationPositions(f);
    assert.equal(p.length, 11);
    assert.equal(p[0], 'GK');
    assert.deepEqual(p, [...p].sort((a, b) => ['GK', 'DEF', 'MID', 'FWD'].indexOf(a) - ['GK', 'DEF', 'MID', 'FWD'].indexOf(b)), 'worked through back to front');
  }
});

test('the formation is rolled at the start: all of them come up, 4-4-2 and 4-3-3 most, and a seed gives the same one', () => {
  const counts = {};
  for (let i = 0; i < 600; i++) { const f = newMatch(pool, `f${i}`, { mode: 'eleven' }).formation.name; counts[f] = (counts[f] ?? 0) + 1; }
  assert.deepEqual(Object.keys(counts).sort(), FORMATIONS.map((f) => f.name).sort());
  assert.ok(counts['4-4-2'] > counts['5-3-2'] * 2 && counts['4-3-3'] > counts['3-4-3'] * 2, JSON.stringify(counts));
  assert.equal(newMatch(pool, 'same', { mode: 'eleven' }).formation.name, newMatch(pool, 'same', { mode: 'eleven' }).formation.name);
  assert.equal(newMatch(pool, 'forced', { mode: 'eleven', formation: '3-5-2' }).formation.name, '3-5-2');
  assert.throws(() => newMatch(pool, 'bad', { mode: 'eleven', formation: '1-1-8' }), /unknown formation/);
});

test('the draft works through the formation: each round is the next slot, and both teams end with the formation', () => {
  for (const name of ['4-4-2', '3-5-2', '5-3-2']) {
    const s = newMatch(pool, `w-${name}`, { mode: 'eleven', formation: name });
    const want = formationPositions(s.formation);
    const seen = [];
    while (s.phase === 'draft') {
      if (s.picksThisRound === 0) seen.push(positionOf(s));
      assert.ok(s.board.every((b) => b.card.pos === positionOf(s)), 'the board is the slot\'s position');
      const who = s.turn; pick(s, who, choose(s, who, 'easy'));
    }
    assert.deepEqual(seen, want, 'one round per slot, back to front');
    for (const who of ['you', 'bot']) {
      assert.deepEqual(s.teams[who].map((c) => c.pos), want, `${who} has the formation`);
    }
  }
});

test('boards: eight different players per round and nobody shown twice in a match of 88', () => {
  for (let i = 0; i < 30; i++) {
    const s = play(`b${i}`);
    assert.equal(s.shown.length, 88);
    assert.equal(new Set(s.shown).size, 88);
  }
});

test('turns alternate and each side picks once a round, eleven times', () => {
  const s = newMatch(pool, 'turns', { mode: 'eleven', first: 'bot' });
  const order = [];
  while (s.phase === 'draft') { const who = s.turn; order.push(who); pick(s, who, choose(s, who, 'easy')); }
  assert.equal(order.length, 22);
  for (let r = 0; r < 11; r++) assert.deepEqual(order.slice(2 * r, 2 * r + 2), r % 2 === 0 ? ['bot', 'you'] : ['you', 'bot']);
});

test('RULE: every 11-a-side draft finishes, whatever the policy: eleven players each and nobody under £0', () => {
  for (let i = 0; i < 120; i++) {
    for (const policy of [
      (s, who) => free(s).filter((b) => canAfford(s, who, b.price)).sort((a, b) => b.price - a.price)[0].card.id,
      (s, who) => free(s).filter((b) => canAfford(s, who, b.price)).sort((a, b) => a.price - b.price)[0].card.id,
      (s, who) => { const o = free(s).filter((b) => canAfford(s, who, b.price)); return o[(i * 5 + s.round) % o.length].card.id; },
    ]) {
      const s = play(`f${i}`, policy);
      assert.equal(s.teams.you.length, 11); assert.equal(s.teams.bot.length, 11);
      assert.ok(s.money.you >= 0 && s.money.bot >= 0);
      assert.equal(s.money.you, 30 - s.paid.you.reduce((a, b) => a + b, 0));
    }
  }
});

test('the showdown adds up eleven players\' real totals in a rolled attribute', () => {
  for (let i = 0; i < 100; i++) {
    const s = play(`sd${i}`);
    assert.equal(s.category, null);
    const r = showdown(s);
    assert.equal(r.you.players.length, 11);
    const tally = (who) => s.teams[who].reduce((sum, c) => sum + (r.category === 'discipline' ? c.yellow + 3 * c.red : c[r.category]), 0);
    assert.equal(r.you.total, tally('you'));
    assert.equal(r.bot.total, tally('bot'));
    assert.equal(rollAttribute(s), r.category);
  }
});

test('the bot never makes an illegal pick in 11-a-side, at any level', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < 40; i++) {
      const s = newMatch(pool, `bm${level}${i}`, { mode: 'eleven', level });
      while (s.phase === 'draft') { if (s.turn === 'bot') botMove(s); else pick(s, 'you', choose(s, 'you', 'easy')); }
      assert.equal(s.teams.bot.length, 11);
    }
  }
});

test('knowledge pays in 11-a-side too: hard beats medium beats a random picker', () => {
  const win = (a, b, n = 150) => {
    let w = 0;
    for (let i = 0; i < n; i++) {
      const s = newMatch(pool, `lv-${a}-${b}-${i}`, { mode: 'eleven', level: b });
      let k = 0;
      while (s.phase === 'draft') {
        const who = s.turn, p = who === 'you' ? a : b;
        const id = p === 'random' ? (() => { const o = free(s).filter((x) => canAfford(s, who, x.price)); return o[(i * 7 + k++) % o.length].card.id; })() : choose(s, who, p);
        pick(s, who, id);
      }
      const r = showdown(s);
      if (r.winner === 'you') w++; else if (r.winner === 'draw') w += 0.5;
    }
    return w / n;
  };
  assert.ok(win('hard', 'medium') > 0.6);
  assert.ok(win('medium', 'random') > 0.6);
  assert.ok(win('random', 'hard') < 0.3);
});
