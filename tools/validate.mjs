/**
 * Content validator for the question bank and roster.
 *
 *   node tools/validate.mjs
 *
 * This is the guard rail for the thing most likely to break the game: the
 * data. A question with two equal options, a missing unit, or a prompt that
 * doesn't say which way round it's asking is a bug you only find when a
 * player hits it mid-fight.
 */

import { readFileSync } from 'node:fs';
import { SPORTS, countBySport } from '../src/data/questions.js';
import { ALL_FIGHTERS as ROSTER, bosses, byTier } from '../src/data/roster.js';
import { EDITIONS } from '../src/data/editions.js';

// Every check below runs over every edition's bank at once: a tie or an
// undirected prompt is just as broken in the '90s bank as in the classic one.
const QUESTIONS = EDITIONS.flatMap((e) => e.questions);
import { CHARACTERS } from '../src/data/characters.js';
import { PERK_KEYS } from '../src/game/battle.js';
import { Ladder, RUNGS } from '../src/game/ladder.js';

let errors = 0;
let warnings = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); errors++; };
const warn = (msg) => { console.warn(`  ! ${msg}`); warnings++; };

const DIRECTION = /MOST|FEWEST|MORE|FEWER|BIGGEST|SMALLEST|HIGHEST|LOWEST|OLDEST|YOUNGEST|EARLIEST|SHORTEST|LONGEST|FURTHEST|DEEPEST|SHALLOWEST/;

console.log(`\nQUESTIONS (${QUESTIONS.length})`);
QUESTIONS.forEach((q, i) => {
  const id = `#${i} "${q.most.slice(0, 44)}"`;

  if (!SPORTS[q.sport]) fail(`${id}: unknown sport "${q.sport}"`);
  if (!q.unit) fail(`${id}: missing unit`);
  if (q.options.length !== 3) fail(`${id}: ${q.options.length} options, expected 3`);

  for (const o of q.options) {
    if (!Number.isInteger(o.value)) fail(`${id}: "${o.label}" value ${o.value} is not a whole number`);
    if (o.value < 0) fail(`${id}: "${o.label}" is negative`);
    if (!o.label || !o.label.trim()) fail(`${id}: an option has no label`);
  }

  const vals = q.options.map((o) => o.value);
  // Ties at the top make the "best answer" ambiguous and the damage maths wrong.
  const max = Math.max(...vals), min = Math.min(...vals);
  if (vals.filter((v) => v === max).length > 1) fail(`${id}: tie for the highest value (${max})`);
  if (vals.filter((v) => v === min).length > 1) fail(`${id}: tie for the lowest value (${min})`);

  if (!DIRECTION.test(q.most)) fail(`${id}: strike prompt doesn't say which way round`);
  if (!DIRECTION.test(q.least)) fail(`${id}: block prompt doesn't say which way round`);
  if (q.most === q.least) fail(`${id}: block prompt is identical to the strike prompt`);
  if (q.least.split(' ').length < 4) warn(`${id}: block prompt is very terse — "${q.least}"`);
  if (!q.note) warn(`${id}: no note, so the player learns nothing from it`);
});

// Duplicate detection: same three labels asked twice is a content smell.
const seen = new Map();
QUESTIONS.forEach((q, i) => {
  const key = q.options.map((o) => o.label).sort().join('|') + '::' + q.unit;
  if (seen.has(key)) warn(`#${i} duplicates #${seen.get(key)} (same people, same unit)`);
  else seen.set(key, i);
});

console.log(`\nSPORT COVERAGE`);
const counts = countBySport();
for (const sport of Object.keys(SPORTS)) {
  const n = counts[sport] || 0;
  const bar = '█'.repeat(Math.min(n, 30));
  console.log(`  ${SPORTS[sport].name.padEnd(12)} ${String(n).padStart(3)} ${bar}`);
  // Below this a single-sport run repeats inside one afternoon. The floor has
  // been raised as the bank grew; it should keep rising.
  if (n < 8) fail(`${sport}: only ${n} questions — a single-sport run would repeat badly`);
  else if (n < 12) warn(`${sport}: ${n} questions — thin if single-sport runs ever ship`);
}

console.log(`\nROSTER (${ROSTER.length})`);
const ids = new Set();
for (const f of ROSTER) {
  const id = `"${f.name}"`;
  if (ids.has(f.id)) fail(`${id}: duplicate id "${f.id}"`);
  ids.add(f.id);
  for (const k of ['name', 'epithet', 'taunt', 'defeat', 'palette', 'gear']) {
    if (f[k] == null) fail(`${id}: missing ${k}`);
  }
  for (const [k, v] of Object.entries(f.palette || {})) {
    if (!/^#[0-9a-f]{6}$/i.test(v)) fail(`${id}: palette.${k} "${v}" is not a 6-digit hex colour`);
  }
  if (f.guile < 0 || f.guile > 1) fail(`${id}: guile ${f.guile} out of range`);
  if (f.hp <= 0 || f.power <= 0) fail(`${id}: non-positive hp/power`);
  if (f.sport !== 'any' && !SPORTS[f.sport]) fail(`${id}: unknown sport "${f.sport}"`);
}
for (const ed of EDITIONS) {
  console.log(`  ${ed.id}: ${ed.questions.length} questions`);
  for (const tier of [1, 2, 3]) {
    const n = byTier(tier, ed.id).length;
    if (n < 3) fail(`${ed.id} tier ${tier} has only ${n} fighters — runs will feel repetitive`);
    console.log(`    tier ${tier}: ${n}`);
  }
  if (bosses(ed.id).length < 1) fail(`${ed.id}: no bosses`);
  console.log(`    bosses: ${bosses(ed.id).length}`);
}

console.log(`\nPLAYABLE CHARACTERS (${CHARACTERS.length})`);
const cids = new Set();
for (const c of CHARACTERS) {
  const id = `"${c.name}"`;
  if (cids.has(c.id)) fail(`${id}: duplicate id "${c.id}"`);
  cids.add(c.id);
  for (const k of ['name', 'epithet', 'blurb', 'palette', 'build', 'gear']) {
    if (c[k] == null) fail(`${id}: missing ${k}`);
  }
  for (const [k, v] of Object.entries(c.palette || {})) {
    if (!/^#[0-9a-f]{6}$/i.test(v)) fail(`${id}: palette.${k} "${v}" is not a 6-digit hex colour`);
  }
  if (c.hp <= 0 || c.power <= 0 || c.nutmegs < 0) fail(`${id}: nonsense stats`);
  // A perk the engine does not read is a promise to the player we never keep.
  for (const k of Object.keys(c.perk || {})) {
    if (!PERK_KEYS.includes(k)) fail(`${id}: perk "${k}" is not read by battle.js`);
  }
}
console.log(`  ${CHARACTERS.length} fighters, ${CHARACTERS.filter((c) => Object.keys(c.perk || {}).length).length} with perks`);

console.log(`\nVERIFICATION`);
// A sign-off is keyed by a content-derived id, so an entry that no longer
// matches any question means that question was edited after being checked.
// Silently carrying the old tick forward is exactly the failure this scheme
// exists to prevent, so say so loudly.
const verified = JSON.parse(readFileSync(new URL('../src/data/verified.json', import.meta.url), 'utf8'));
const liveIds = new Set(QUESTIONS.map((q) => q.id));
const signOffs = Object.keys(verified).filter((k) => k !== '_README');
const orphaned = signOffs.filter((id) => !liveIds.has(id));
const checked = signOffs.filter((id) => liveIds.has(id)).length;

for (const id of orphaned) {
  warn(`sign-off "${id}" matches no current question — it was edited after checking, and is back on the checklist`);
}
const pc = Math.round((checked / QUESTIONS.length) * 100);
console.log(`  ${checked}/${QUESTIONS.length} questions checked against a source (${pc}%)`);
const highLeft = QUESTIONS.filter((q) => q.risk === 'high' && !liveIds.has(q.id) === false && !signOffs.includes(q.id)).length;
if (highLeft) console.log(`  ${highLeft} of the ${QUESTIONS.filter((q) => q.risk === 'high').length} high-risk ones are still outstanding`);
if (checked === 0) console.log('  nothing checked yet — run: node tools/checklist.mjs');

console.log(`\nARENAS`);
// Every sport a fighter can have needs a backdrop, or that fight falls back to
// a generic pitch and the whole point of the per-sport arenas is lost.
const arenaSrc = readFileSync(new URL('../src/engine/render.js', import.meta.url), 'utf8');
const arenaBlock = arenaSrc.slice(arenaSrc.indexOf('const ARENAS = {'));
const declared = new Set([...arenaBlock.slice(0, arenaBlock.indexOf('};'))
  .matchAll(/^\s{2}(\w+):\s*\{/gm)].map((m) => m[1]));
for (const sport of Object.keys(SPORTS)) {
  if (!declared.has(sport)) fail(`no arena for "${sport}" — that fight falls back to a generic pitch`);
}
if (!declared.has('any')) fail('no fallback arena for bosses (sport "any")');
console.log(`  ${declared.size} arenas for ${Object.keys(SPORTS).length} sports + bosses`);

console.log(`\nLADDER`);
// Generating a ladder must never leave a rung without an opponent, and must
// never put the same person on two rungs in a row.
for (const seed of [1, 7, 42, 999, 123456, 8675309]) {
  const l = new Ladder(seed);
  if (l.rungs.length !== RUNGS) fail(`seed ${seed}: ${l.rungs.length} rungs, expected ${RUNGS}`);
  let prev = null;
  for (const r of l.rungs) {
    if ((r.kind === 'fight' || r.kind === 'boss') && !r.fighter) fail(`seed ${seed}: rung ${r.n} has no opponent`);
    if (r.fighter && prev && r.fighter.id === prev) fail(`seed ${seed}: ${r.fighter.name} on rungs ${r.n - 1} and ${r.n}`);
    prev = r.fighter ? r.fighter.id : null;
  }
  if (!l.rungs.some((r) => r.kind === 'boss')) fail(`seed ${seed}: no boss`);
  if (l.available(2)) fail(`seed ${seed}: rung 2 unlocked before rung 1 was cleared`);
}
console.log(`  ${RUNGS} rungs, 6 seeds checked`);

console.log(`\n${errors ? '✗' : '✓'} ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}\n`);
process.exit(errors ? 1 : 0);
