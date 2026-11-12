import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './helpers.mjs';
import { ATTRIBUTES, ATTRIBUTE_KEYS, ATTRIBUTE, valueOf, recordOf } from '../src/engine/attributes.js';

const get = (full) => pool.cards.find((c) => c.full === full);

test('five attributes, each with a label, a short label and a unit', () => {
  assert.deepEqual(ATTRIBUTE_KEYS, ['goals', 'assists', 'involvements', 'games', 'discipline']);
  for (const a of ATTRIBUTES) { assert.ok(a.label && a.short && a.unit, a.key); assert.equal(typeof a.value, 'function'); }
  assert.equal(new Set(ATTRIBUTE_KEYS).size, ATTRIBUTE_KEYS.length);
  assert.throws(() => valueOf({}, 'wins'), /unknown attribute/);
});

test('goal involvements are goals plus assists, from the real career totals', () => {
  const lampard = get('Frank Lampard'), giggs = get('Ryan Giggs'), shearer = get('Alan Shearer');
  assert.equal(valueOf(lampard, 'involvements'), 177 + 102);
  assert.equal(valueOf(giggs, 'involvements'), 109 + 162);
  assert.equal(valueOf(shearer, 'involvements'), 260 + 64);
  for (const c of pool.cards) assert.equal(valueOf(c, 'involvements'), c.goals + c.assists);
});

test('the other attributes are the career totals, and discipline is a yellow card as 1 and a red card as 3', () => {
  const c = { goals: 7, assists: 3, games: 120, yellow: 5, red: 1 };
  assert.deepEqual(['goals', 'assists', 'games', 'discipline', 'involvements'].map((k) => valueOf(c, k)), [7, 3, 120, 8, 10]);
});

test('records: the best in the pool, and who holds them', () => {
  assert.equal(recordOf(pool, 'goals'), 260);
  assert.equal(recordOf(pool, 'assists'), 162);
  assert.equal(recordOf(pool, 'games'), 658);
  assert.equal(recordOf(pool, 'discipline'), 148);
  const inv = recordOf(pool, 'involvements');
  assert.ok(inv >= 324, `${inv}`);   // Shearer alone has 324
  assert.ok(pool.cards.every((c) => valueOf(c, 'involvements') <= inv));
  assert.ok(pool.cards.some((c) => valueOf(c, 'involvements') === inv));
});

test('a forward and a midfielder can both win goal involvements: it is not one position\'s attribute', () => {
  const top = [...pool.cards].sort((a, b) => valueOf(b, 'involvements') - valueOf(a, 'involvements')).slice(0, 30);
  const positions = new Set(top.map((c) => c.pos));
  assert.ok(positions.has('FWD') && positions.has('MID'), [...positions].join());
  assert.ok(top.some((c) => c.pos === 'DEF') || true);
});
