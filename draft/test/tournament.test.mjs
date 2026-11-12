import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './helpers.mjs';
import { ROUNDS, SIZE, SAFE_SLOTS, BOT_LEVEL, budgetFor, drawFor, youTeam, newTournament, opponent, me, finishRound, playRound, roundsWon, revealOpponent, bracketView, champion } from '../src/engine/tournament.js';
import { opponents, FIELD, TIERS, YOUR_TIER, kitFor, codeFor } from '../src/engine/pyramid.js';
import { newMatch, nextMatch, pick, showdown, seriesOf, canAfford, MODES } from '../src/engine/draft.js';
import { choose } from '../src/engine/bot.js';

const play = (t, you = 'medium') => playRound(t, (s, who) => choose(s, who, who === 'you' ? you : t.level));

test('a series can be any length, with its own budgets: one match is a whole series, and the budgets are each side\'s money', () => {
  const s = newMatch(pool, 'one', { matches: 1, budgets: { you: 10, bot: 13 } });
  assert.deepEqual(s.money, { you: 10, bot: 13 });
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'medium')); }
  showdown(s);
  assert.equal(s.phase, 'over', 'one match is the whole series');
  assert.ok(seriesOf(s).over);
  assert.throws(() => nextMatch(s), /not waiting/);
  const d = newMatch(pool, 'default');
  assert.equal(d.total, 3); assert.deepEqual(d.money, { you: 10, bot: 10 });
  assert.throws(() => newMatch(pool, 'poor', { budgets: { you: 4, bot: 10 } }), /budget must cover/);
  const rich = newMatch(pool, 'rich', { first: 'bot', budgets: { you: 10, bot: 13 } });
  assert.ok(canAfford(rich, 'bot', 5) && canAfford(rich, 'bot', 9) && !canAfford(rich, 'you', 7));
});

test('the pyramid: 63 clubs, 16 from each of the top three divisions and 15 from League Two, all different; you are the sixteenth League Two club', () => {
  const o = opponents();
  assert.equal(o.length, 63);
  assert.deepEqual(FIELD.map((t) => t.length), [16, 16, 16, 15]);
  assert.equal(new Set(o.map((c) => c.code)).size, 63, 'every club has its own code');
  assert.equal(new Set(o.map((c) => c.name)).size, 63);
  assert.equal(TIERS[YOUR_TIER].name, 'League Two');
  // a bigger division has more money: every division's weakest club is no richer than the one above's strongest, and within a division the list runs strongest first
  for (let t = 0; t < 3; t++) assert.ok(Math.max(...o.filter((c) => c.tier === t + 1).map((c) => c.mult)) <= Math.max(...o.filter((c) => c.tier === t).map((c) => c.mult)));
  for (let t = 0; t < 4; t++) { const m = o.filter((c) => c.tier === t).map((c) => c.mult); assert.deepEqual([...m].sort((a, b) => b - a), m); }
  const prem = o.filter((c) => c.tier === 0), two = o.filter((c) => c.tier === 3);
  assert.ok(Math.min(...prem.map((c) => c.mult)) > Math.max(...two.map((c) => c.mult)), 'every Premier League club is richer than every League Two club');
  for (const c of o) assert.match(c.colours[0], /^#[0-9A-Fa-f]{6}$/);
  assert.match(kitFor('Grandstand Town')[0], /^#[0-9a-f]{6}$/);
  assert.equal(codeFor('Grandstand Town'), 'GRA'); assert.equal(codeFor('  '), 'YOU');
});

test('the draw: you in slot 0, 63 different clubs, the same for a seed, small clubs on your early road, big clubs anywhere from the quarter-final', () => {
  const d = drawFor('seed1', 'five', 'Sunday Rovers');
  assert.equal(d.length, 64);
  assert.equal(d[0].name, 'Sunday Rovers'); assert.equal(d[0].you, true); assert.equal(d[0].tierName, 'League Two');
  assert.equal(new Set(d.map((x) => x.name)).size, 64);
  assert.equal(new Set(d.slice(1).map((x) => x.code)).size, 63, 'the opponents have a code each (yours is only the letters on your badge)');
  assert.deepEqual(drawFor('seed1', 'five', 'Sunday Rovers').map((x) => x.code), d.map((x) => x.code));
  assert.notDeepEqual(drawFor('seed2', 'five', 'Sunday Rovers').map((x) => x.code), d.map((x) => x.code));
  assert.equal(SAFE_SLOTS, 7);
  // across many draws: your first three opponents' pools (slots 1 to 7) are League Two clubs only; later slots are a real shuffle where any club, big ones included, can be
  const seenAt = Array.from({ length: 64 }, () => new Set());
  for (let i = 0; i < 300; i++) {
    const x = drawFor(`g${i}`, 'five');
    x.slice(1, 1 + SAFE_SLOTS).forEach((c) => assert.equal(c.tier, 3, `${c.name} is League Two`));
    x.forEach((c, k) => seenAt[k].add(c.tier));
  }
  for (let k = 8; k < 64; k++) assert.ok(seenAt[k].has(0), `a Premier League club can be drawn in slot ${k}`);
  for (let k = 8; k < 16; k++) assert.ok(seenAt[k].has(0) && seenAt[k].has(3), `the quarter-final pool (slot ${k}) is open to big and small clubs`);
  // budgets are each side's share of the mode's budget
  for (const mode of ['five', 'eleven']) for (const c of drawFor('b', mode)) assert.equal(c.budget, budgetFor(mode, c.mult));
  assert.equal(youTeam('five', 'x').budget, 10); assert.equal(youTeam('eleven', 'x').budget, 30);
  assert.equal(youTeam('five', '   ').name, 'Your Club'); assert.equal(youTeam('five', 'A'.repeat(60)).name.length, 24);
});

test('a round is a single fresh draft: your budget against the club\'s, the medium bot', () => {
  const t = newTournament(pool, 'r1', { mode: 'five', name: 'Sunday Rovers' });
  assert.equal(t.status, 'playing'); assert.equal(t.round, 0);
  assert.equal(t.tie.total, 1); assert.equal(t.tie.level, BOT_LEVEL); assert.equal(BOT_LEVEL, 'medium');
  assert.deepEqual(t.tie.money, { you: 10, bot: opponent(t).budget });
  const e = newTournament(pool, 'r1', { mode: 'eleven' });
  assert.equal(e.tie.money.you, 30); assert.equal(e.tie.money.bot, opponent(e).budget);
  assert.equal(me(t).name, 'Sunday Rovers');
  assert.throws(() => newTournament(pool, 'x', { teams: [] }), /64 teams/);
});

test('lose and you are out; win and you go through to the next round; win the Final and you are champions', () => {
  let outs = 0, champions = 0, through = 0;
  for (let i = 0; i < 40; i++) {
    const t = newTournament(pool, `k${i}`);
    for (let guard = 0; guard < 8 && t.status === 'playing'; guard++) {
      const before = t.round;
      const r = play(t, 'hard');
      assert.ok(['you', 'bot'].includes(r.winner), 'a knockout always has a winner');
      if (r.winner === 'you') { through++; if (t.status === 'playing') { assert.equal(t.round, before + 1); assert.deepEqual(t.tie.money, { you: 10, bot: opponent(t).budget }); } }
    }
    assert.ok(t.status === 'out' || t.status === 'champions');
    assert.equal(t.history.length, t.status === 'champions' ? 6 : roundsWon(t) + 1);
    if (t.status === 'out') { outs++; assert.equal(t.history.at(-1).winner, 'bot'); assert.notEqual(champion(t).code, me(t).code); }
    else { champions++; assert.equal(roundsWon(t), 6); assert.equal(champion(t).you, true); }
  }
  assert.ok(outs > 0 && through > 40, `${outs} knocked out, ${through} rounds won, ${champions} champions`);
});

test('the bracket is complete and consistent: every winner came from the tie before', () => {
  const t = newTournament(pool, 'full', { name: 'Sunday Rovers' });
  while (t.status === 'playing') play(t, 'hard');
  assert.equal(t.bracket.length, 7);
  assert.deepEqual(t.bracket.map((r) => r.length), [64, 32, 16, 8, 4, 2, 1]);
  assert.deepEqual(t.ties.map((r) => r.length), [32, 16, 8, 4, 2, 1]);
  t.ties.forEach((round, r) => round.forEach((x, i) => {
    assert.equal(x.a, t.bracket[r][2 * i]); assert.equal(x.b, t.bracket[r][2 * i + 1]);
    assert.ok(x.winner === x.a || x.winner === x.b);
    assert.equal(t.bracket[r + 1][i], x.winner);
  }));
  assert.equal(new Set(t.bracket[0]).size, 64);
});

test('the history records each round: the club, its budget, the attribute and both totals', () => {
  const t = newTournament(pool, 'hist');
  const opp = opponent(t);
  play(t, 'hard');
  const h = t.history[0];
  assert.equal(h.name, 'Round of 64'); assert.equal(h.club, opp.code); assert.equal(h.clubName, opp.name); assert.equal(h.budget, opp.budget);
  assert.ok(h.category && Number.isFinite(h.you) && Number.isFinite(h.bot));
  assert.equal(h.winner, h.you > h.bot ? 'you' : h.bot > h.you ? 'bot' : h.winner);
});

test('a drawn round is decided: more appearances goes through, then a coin', () => {
  const t = newTournament(pool, 'draw');
  const s = t.tie;
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'medium')); }
  showdown(s);
  s.results[0].you.total = s.results[0].bot.total; s.results[0].winner = 'draw';
  s.teams.bot.forEach((c, i) => { c.games = 1000 + i; });
  s.teams.you.forEach((c) => { c.games = 10; });
  const r = finishRound(t);
  assert.equal(r.winner, 'bot'); assert.equal(r.decidedBy, 'more appearances');
  const t2 = newTournament(pool, 'draw'), s2 = t2.tie;
  while (s2.phase === 'draft') { const who = s2.turn; pick(s2, who, choose(s2, who, 'medium')); }
  showdown(s2);
  s2.results[0].you.total = s2.results[0].bot.total; s2.results[0].winner = 'draw';
  s2.teams.bot.forEach((c) => { c.games = 50; }); s2.teams.you.forEach((c) => { c.games = 50; });
  assert.equal(finishRound(t2).decidedBy, 'a coin');
  assert.throws(() => finishRound(newTournament(pool, 'early')), /not finished/);
});

test('you see the whole draw at the start, but not who you play after round one, until the round starts', () => {
  const t = newTournament(pool, 'veil', { name: 'Sunday Rovers' });
  const known = (v, r) => v.rounds[r].filter((x) => x.known).length;
  const shown = (v) => v.ties.flatMap((r, k) => r.map((x, i) => (x ? `${k}:${i}` : null)).filter(Boolean));
  // the draw: all 64 clubs are in the view, and no result
  let v = bracketView(t);
  assert.equal(known(v, 0), 64); assert.deepEqual(shown(v), []);
  assert.deepEqual(v.rounds[0].map((x) => x.name), t.teams.map((x) => x.name), 'every club in its place');
  assert.equal(v.rounds[0][0].you, true);
  assert.equal(known(v, 1), 0, 'nobody has reached round two yet');
  // play on: after each round the winners of the other ties are shown, but not the tie that decides your next opponent, and not who he is
  let rounds = 0;
  while (t.status === 'playing') {
    play(t, 'hard');
    if (t.status !== 'playing') break;
    const R = t.round;
    const w = bracketView(t);
    assert.equal(w.rounds[R][0].you, true, 'you are in the next round');
    assert.equal(w.rounds[R][1].known, false, 'the next opponent is hidden');
    assert.equal(w.rounds[R][1].name, undefined, 'an unknown slot carries no club');
    assert.equal(w.ties[R - 1][1], null, 'the tie that decided him is not shown');
    assert.ok(w.ties[R - 1][0], 'your own result is');
    for (let i = 0; i < w.ties[R - 1].length; i++) if (i !== 1) assert.ok(w.ties[R - 1][i], `tie ${i} of the last round is shown`);
    for (let i = 2; i < w.rounds[R].length; i++) assert.ok(w.rounds[R][i].known, 'the other winners are shown');
    // the round starts: he is revealed with the result that put him there
    revealOpponent(t);
    const x = bracketView(t);
    assert.equal(x.rounds[R][1].name, opponent(t).name);
    assert.ok(x.ties[R - 1][1]);
    rounds++;
  }
  assert.ok(rounds > 0);
  const e = bracketView(t);
  assert.ok(e.rounds.every((r) => r.every((x) => x.known)) && shown(e).length === 63, 'the end of the cup shows everything');
});

test('the cup is a real climb: a medium-skill player is an underdog, and winning it is rare', () => {
  const reached = Array(ROUNDS.length + 1).fill(0); const N = 60;
  for (let i = 0; i < N; i++) {
    const t = newTournament(pool, `climb${i}`);
    while (t.status === 'playing') play(t, 'medium');
    reached[roundsWon(t)]++;
  }
  const atLeast = (n) => reached.slice(n).reduce((a, b) => a + b, 0) / N;
  assert.ok(atLeast(1) > 0.5, `most players win round 1 (${atLeast(1)})`);
  assert.ok(atLeast(1) > atLeast(3) && atLeast(3) > atLeast(5), 'each stage is rarer than the one before');
  assert.ok(atLeast(6) < 0.15, `winning the cup is rare (${atLeast(6)})`);
  assert.equal(SIZE, 64); assert.equal(MODES.five.budget, 10);
});
