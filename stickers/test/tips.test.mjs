import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJson, mk, scale } from './helpers.mjs';
import { cardTips, careerSpan, seasonLabel } from '../src/ui/tips.js';

const { cards, meta } = loadJson();
const get = (full) => cards.find((c) => c.full === full);

test('a career span reads as seasons', () => {
  assert.equal(seasonLabel('2017-18'), '2017/18');
  assert.equal(careerSpan(get('Frank Lampard')), '1995/96 to 2014/15');
  assert.equal(careerSpan(mk({ season: '2001-02' })), '2001/02');
});

test('every number on a sticker explains itself: the rating AND the real total behind it', () => {
  const t = cardTips(get('Frank Lampard'), { category: 'goals', scale: meta.chipScale });
  assert.match(t.rows.goals, /177 career goals/);
  assert.match(t.rows.goals, /rated \d+ out of 99/);
  assert.match(t.rows.games, /609 Premier League appearances/);
  assert.match(t.rows.assists, /102 career assists/);
  assert.match(t.rows.discipline, /yellow cards? x 1 \+ \d+ red cards? x 3/);
  assert.match(t.chips.goals, /Worth \d+ chips .* rating \d+ x 0.606/);
  assert.equal(t.chips.assists, undefined, 'only the active row has chips');
  assert.match(t.band, /Chelsea 429, West Ham 148, Man City 32|CHE 429/);
  assert.match(t.band, /1995\/96 to 2014\/15/);
  assert.match(t.rating, /Overall \d+ out of 99, Icon/);
  assert.match(t.rating, /not worth chips/);
  assert.ok(!/42-game|scaled/.test(JSON.stringify(t)), 'nothing is scaled any more');
});

test('a one-club man, a goalless player and a keeper', () => {
  assert.match(cardTips(get('Ryan Giggs')).band, /only/);
  assert.match(cardTips(mk({ goals: 0, rate: { goals: 1, assists: 1, games: 1, discipline: 1 } })).rows.goals, /No career goals/);
  const gk = mk({ pos: 'GK', games: 300 });
  assert.match(cardTips(gk).ability, /\+3 mult.*250\+ appearances/);
  assert.equal(cardTips(mk()).ability, undefined);
  assert.match(cardTips(mk({ edition: 'holo' })).edition, /HOLO: \+6 mult/);
});
