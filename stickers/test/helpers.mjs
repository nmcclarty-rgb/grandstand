import { readFileSync } from 'node:fs';
import { makePool } from '../src/engine/deck.js';

let n = 0;
// A fake card with just enough to score. Override anything.
export const mk = (over = {}) => ({
  uid: `t${++n}`, id: `t${n}`, pid: 1000 + n, name: `P${n}`,
  club: 'ARS', season: '2017-18', pos: 'MID', edition: 'base',
  goals: 0, assists: 0, games: 0, yellow: 0, red: 0, rating: 50,
  ...over,
});

// 1 chip per unit everywhere except goals (2 per goal) and red cards (10), so the sums are checkable by eye.
export const scale = {
  goals: { perUnit: 2 }, assists: { perUnit: 1 }, games: { perUnit: 1 }, yellow: { perUnit: 1 }, red: { perUnit: 10 },
};

export const loadJson = () => JSON.parse(readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
export const loadPool = () => makePool(loadJson());
