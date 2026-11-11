import { readFileSync } from 'node:fs';
import { makePool } from '../src/engine/deck.js';

let n = 0;
// A fake card with just enough to score. Override anything.
export const mk = (over = {}) => ({
  uid: `t${++n}`, id: `t${n}`, pid: 1000 + n, name: `P${n}`,
  club: 'ARS', season: '2017-18', pos: 'MID', edition: 'base',
  goals: 0, assists: 0, games: 0, cleanSheets: 0, saves: 0, bonus: 0, price: 0, points: 0, rating: 50,
  ...over,
});

// 1 chip per unit everywhere except goals (2 per goal), so the sums are checkable by eye.
export const scale = {
  goals: { perUnit: 2 }, assists: { perUnit: 1 }, games: { perUnit: 1 }, cleanSheets: { perUnit: 1 },
  saves: { perUnit: 1 }, bonus: { perUnit: 1 }, price: { perUnit: 1 },
};

export const loadJson = () => JSON.parse(readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
export const loadPool = () => makePool(loadJson());
