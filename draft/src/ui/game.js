// The Prem Wheel page. All the rules live in the engine (draft.js, bot.js); this file draws screens and calls it.
import { makePool } from '../../../stickers/src/engine/deck.js';
import { firstNameOf, surnameOf } from '../../../stickers/src/engine/cards.js';
import { renderCard } from '../../../stickers/src/ui/card.js';
import { initTooltips } from '../../../stickers/src/ui/tooltip.js';
import { drawWheel } from './wheel.js';
import { shirtSvg } from './shirt.js';
import { openGuide } from './tutorial.js';
import { badgeSvg } from './badge.js';
import { CLUB_LABELS } from './clubs.js';
import { KITS, PATTERNS, codeFor, cleanKit } from '../engine/pyramid.js';
import { newTournament, finishRound, roundsWon, revealOpponent, bracketView, opponent, me, champion, ROUNDS } from '../engine/tournament.js';
import { COMMON, MODES, formationsOf, newMatch, nextMatch, pick, positionOf, canAfford, maxSpend, showdown, seriesOf, rulesOf } from '../engine/draft.js';
import { ATTRIBUTES, ATTRIBUTE, valueOf } from '../engine/attributes.js';
import { botMove } from '../engine/bot.js';

const $ = (id) => document.getElementById(id);
const n = (x) => x.toLocaleString('en-GB');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ONE = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
const SHORT = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };
const RECORD = 'blind-five:record:v1';
// the four rows on a Sticker Season card, in order, and which of them an attribute counts
const ROWS = ['goals', 'assists', 'games', 'discipline'];
const HIGHLIGHT = { goals: ['goals'], assists: ['assists'], involvements: ['goals', 'assists'], games: ['games'], discipline: ['discipline'], titles: [], wins: [], cleansheets: [] };

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid);
  return e;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function recall() { try { return JSON.parse(localStorage.getItem(RECORD)) ?? {}; } catch { return {}; } }
function remember(key, outcome) {
  try { const r = recall(); if (!r[key]) r[key] = { w: 0, l: 0, d: 0 }; r[key][outcome]++; localStorage.setItem(RECORD, JSON.stringify(r)); } catch { /* private window */ }
}

let pool, state, result, level = 'medium', mode = 'five', format = 'cup', tournament = null, busy = false, token = 0;
const CUP_RECORD = 'prem-wheel:cup:v1';
const CLUB_KEY = 'prem-wheel:club:v1';
const KIT_KEY = 'prem-wheel:kit:v1';
const GUIDE_KEY = 'prem-wheel:guide:v1';
const COACH_KEY = 'prem-wheel:coach:v1';
const DEFAULT_CLUB = 'Grandstand Town';
const ROUND_SHORT = ['R64', 'R32', 'R16', 'QF', 'SF', 'Final'];
// money is in £m, to one decimal: £30m, £4.5m
const gbp = (x) => '£' + (Number.isInteger(x) ? x : x.toFixed(1)) + 'm';
const clubName = (code) => CLUB_LABELS[code] ?? code;
// a crest for a club in the cup (the ones on the cards are looked up by code; the rest carry their own kit)
const crest = (x) => badgeSvg(x.code, { colours: x.colours, pattern: x.pattern });
const rules = () => rulesOf(state);
const recordKey = () => `${mode}-${level}`;
const attr = (k) => ATTRIBUTE[k];
const params = new URLSearchParams(location.search);

const SCREENS = ['loading', 'title', 'ladder', 'draft', 'show'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  document.body.dataset.screen = id;
  const h = $(id).querySelector('h1, h2');
  if (h) h.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
const say = (html) => { $('d-say').innerHTML = html; };

// A wait you can skip: the game flows on by itself, and a tap (or Space / Enter) on the showdown screen moves on at once.
let skipHold = null;
const holdFor = (ms) => new Promise((resolve) => {
  const t = setTimeout(done, ms);
  function done() { clearTimeout(t); if (skipHold === done) skipHold = null; resolve(); }
  skipHold = done;
});
// the same, counting down in whole seconds: render(secondsLeft)
const countdown = (seconds, render) => new Promise((resolve) => {
  let left = seconds;
  render(left);
  const iv = setInterval(() => { left--; if (left <= 0) done(); else render(left); }, 1000);
  function done() { clearInterval(iv); if (skipHold === done) skipHold = null; resolve(); }
  skipHold = done;
});

// ---- title ------------------------------------------------------------------------------------------------------------------
function showTitle() {
  token++;
  busy = false;
  const r = recall();
  const bits = Object.keys(MODES).flatMap((m) => ['easy', 'medium', 'hard'].map((l) => [`${MODES[m].label} ${l}`, r[`${m}-${l}`] ?? (m === 'five' ? r[l] : null)]))
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v.w} won, ${v.l} lost${v.d ? `, ${v.d} drawn` : ''}`);
  const lad = (() => { try { return JSON.parse(localStorage.getItem(CUP_RECORD)); } catch { return null; } })();
  const ladBit = lad ? `Cup: best run ${lad.best} of ${ROUNDS.length} rounds, ${lad.champions} time${lad.champions === 1 ? '' : 's'} champions in ${lad.runs} run${lad.runs === 1 ? '' : 's'}` : '';
  $('t-record').textContent = [ladBit, bits.length ? `Quick series: ${bits.join(' · ')}` : ''].filter(Boolean).join('. ') + (ladBit || bits.length ? '.' : '');
  tournament = null;
  show('title');
}

// Two ways to play. The CUP is a 64-club knockout of single matches, you a League Two club, every club's budget set by its division (tournament.js); the QUICK
// SERIES is a best of three against a bot of the level you choose. Either way each match is a fresh draft for the attribute drawn at its start.
function startMatch(seed) {
  mode = document.querySelector('input[name=mode]:checked').value;
  format = document.querySelector('input[name=format]:checked').value;
  document.body.dataset.mode = mode;
  document.body.dataset.format = format;
  result = null;
  const my = ++token;
  if (format === 'cup') {
    const name = $('t-name').value.trim() || DEFAULT_CLUB;
    saveClub(name);
    tournament = newTournament(pool, seed || Date.now(), { mode, name, kit: currentKit() });
    state = tournament.tie;
    level = tournament.level;
    cupIntro(my);
  } else {
    level = document.querySelector('input[name=level]:checked').value;
    tournament = null;
    state = newMatch(pool, seed || Date.now(), { level, mode });
    beginMatchPage(my);
  }
}

// ---- teaching: the guide before a first game, and the coach panel in the first drafts ---------------------------------------------------
const guideSeen = () => { try { return localStorage.getItem(GUIDE_KEY) === '1'; } catch { return false; } };
const markGuide = () => { try { localStorage.setItem(GUIDE_KEY, '1'); } catch { /* private window */ } };
// "Kick off": a first-time player gets the short guide first (skippable); everyone else goes straight in
function kickOff() {
  const seed = $('t-seed').value.trim();
  if (params.get('guide') === '0' || guideSeen()) { startMatch(seed); return; }
  let rules = false;
  openGuide({ pool, first: true, onFullRules: () => { rules = true; }, onClose: () => { markGuide(); if (rules) $('manual').showModal?.(); else startMatch(seed); } });
}
function showGuide() { openGuide({ pool, first: false, onFullRules: () => $('manual').showModal?.(), onClose: markGuide }); }
// a short panel above the board for the first two matches (until "Got it"), worded for the attribute that has just landed
function coachState() { try { return JSON.parse(localStorage.getItem(COACH_KEY)) ?? { shown: 0, off: false }; } catch { return { shown: 0, off: false }; } }
function showCoach() {
  const c = coachState();
  if (c.off || c.shown >= 2 || params.get('guide') === '0') { $('d-coach').hidden = true; return; }
  c.shown++;
  try { localStorage.setItem(COACH_KEY, JSON.stringify(c)); } catch { /* private window */ }
  const who = tournament ? opponent(tournament).name : 'the bot';
  $('c-1').innerHTML = `This match counts <b>${esc(attr(state.category).label)}</b>. Every player has a real career total in it. Both teams are added up, and the <b>bigger total beats ${esc(who)}</b>.`;
  $('d-coach').hidden = false;
}
function dismissCoach() {
  $('d-coach').hidden = true;
  try { localStorage.setItem(COACH_KEY, JSON.stringify({ shown: 2, off: true })); } catch { /* private window */ }
}

// ---- your club (the title screen) -------------------------------------------------------------------------------------------------
const PLACES = ['Grandstand', 'Sunday', 'Dockside', 'Riverside', 'Hilltop', 'Orchard', 'Foundry', 'Harbour', 'Moorland', 'Millbrook', 'Ashgrove', 'Kingsway', 'Brickworks', 'Lakeside', 'Northgate', 'Parkhead'];
const SUFFIXES = ['Town', 'Rovers', 'United', 'Athletic', 'Wanderers', 'City', 'Albion', 'Rangers', 'Borough', 'Argyle', 'Villa', 'County'];
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];
const kit = { colour: 0, pattern: 'stripes' };
const currentKit = () => cleanKit({ colours: [KITS[kit.colour][1], KITS[kit.colour][2]], pattern: kit.pattern }, $('t-name').value || DEFAULT_CLUB);
function saveClub(name) {
  try { localStorage.setItem(CLUB_KEY, name); localStorage.setItem(KIT_KEY, JSON.stringify(kit)); } catch { /* private window */ }
}
function drawClub() {
  const name = $('t-name').value.trim();
  $('t-shirt').innerHTML = shirtSvg(currentKit(), codeFor(name || DEFAULT_CLUB));
  $('t-clubsub').textContent = name ? `${name} · League Two` : 'League Two';
  document.querySelectorAll('#t-colours button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === kit.colour)));
  document.querySelectorAll('#t-designs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pattern === kit.pattern)));
}
function buildClubPicker() {
  $('t-colours').replaceChildren(...KITS.map(([label, c1, c2], i) => el('button', { type: 'button', class: 'swatch', title: label, 'aria-label': label, style: `background:linear-gradient(135deg, ${c1} 0 50%, ${c2} 50% 100%)`, onclick: () => { kit.colour = i; drawClub(); } })));
  $('t-designs').replaceChildren(...PATTERNS.map(([key, label]) => el('button', { type: 'button', class: 'design', 'data-pattern': key, text: label, onclick: () => { kit.pattern = key; drawClub(); } })));
  try {
    const saved = JSON.parse(localStorage.getItem(KIT_KEY));
    if (saved && Number.isInteger(saved.colour) && KITS[saved.colour] && PATTERNS.some(([k]) => k === saved.pattern)) { kit.colour = saved.colour; kit.pattern = saved.pattern; }
    else { kit.colour = Math.floor(Math.random() * KITS.length); kit.pattern = PATTERNS[1 + Math.floor(Math.random() * (PATTERNS.length - 1))][0]; }
  } catch { /* private window */ }
  $('t-name').addEventListener('input', drawClub);
  $('t-dice').addEventListener('click', () => { $('t-name').value = `${pickOf(PLACES)} ${pickOf(SUFFIXES)}`; drawClub(); });
  drawClub();
}
// "The Cup · 11-a-side · £30m" under the Kick off button, so the defaults are visible and the other modes are one click away
function drawSummary() {
  const cup = document.querySelector('input[name=format]:checked').value === 'cup';
  const m = document.querySelector('input[name=mode]:checked').value;
  const lv = document.querySelector('input[name=level]:checked').value;
  $('t-summary').textContent = `${cup ? 'The Cup' : `Quick series vs ${lv} bot`} · ${MODES[m].label} · ${gbp(MODES[m].budget)}`;
  $('t-club').hidden = !cup;
}

// ---- the cup ----------------------------------------------------------------------------------------------------------------------
// You see yourself travel: a road of six stops with your crest at the round you are in, and the bracket filling in behind you. What is ahead stays a "?" until the
// round starts (the engine's bracketView carries nothing else).
function renderRoad(targetId) {
  const t = tournament, you = me(t);
  const stops = ROUNDS.map((name, i) => {
    const h = t.history[i];
    const here = i === t.round && t.status === 'playing';
    const cls = h ? (h.winner === 'you' ? 'won' : 'lost') : here ? 'now' : 'todo';
    const opp = h ? t.teams.find((x) => x.name === h.clubName) : null;
    return el('li', { class: `stop ${cls}`, title: name },
      el('span', { class: 'sn', text: ROUND_SHORT[i] }),
      el('span', { class: 'sb', html: here ? crest(you) : opp ? crest(opp) : '<i>?</i>' }),
      el('span', { class: 'sr', text: h ? `${h.winner === 'you' ? 'W' : 'L'} ${n(h.you)}–${n(h.bot)}` : here ? 'You' : '' }));
  });
  const done = t.status === 'champions';
  stops.push(el('li', { class: `stop trophy ${done ? 'won' : 'todo'}`, title: 'Champions' },
    el('span', { class: 'sn', text: 'Cup' }), el('span', { class: 'sb', html: done ? crest(you) : '<i>🏆</i>' }), el('span', { class: 'sr', text: done ? 'Won' : '' })));
  $(targetId).replaceChildren(...stops);
}

const COLW = 90;
function slotEl(x, side) {
  if (!x.known) return el('div', { class: 'bslot unknown' }, el('span', { class: 'bq', text: '?' }));
  return el('div', { class: `bslot ${x.you ? 'you' : ''} ${side ? (side.won ? 'won' : 'lost') : ''}`, title: `${x.name} (${x.tierName}, ${gbp(x.budget)})` },
    el('span', { class: 'bb', style: `background:${x.colours[0]}` }), el('span', { class: 'bn', text: x.name }), side ? el('span', { class: 'bs', text: n(side.score) }) : null);
}
// The bracket like a World Cup poster: the top half of the draw down the left, the bottom half down the right, the rounds closing in towards the Final in the middle.
// Round r has 64 >> r slots; the left half of it is the first half of them, and its tie i is made of slots 2i and 2i + 1.
function renderBracket(targetId) {
  const t = tournament, v = bracketView(t), box = $(targetId);
  const last = ROUNDS.length - 1;   // the Final is in the middle
  const matchEl = (r, m) => {
    const tie = v.ties[r][m];
    const sides = tie ? [{ won: tie.winner === 'a', score: tie.a }, { won: tie.winner === 'b', score: tie.b }] : [null, null];
    return el('div', { class: `bmatch${tie ? ' played' : ''}`, style: `height:calc(var(--u) * ${2 ** (r + 1)})`, title: tie ? ATTRIBUTE[tie.category].short : '' }, slotEl(v.rounds[r][2 * m], sides[0]), slotEl(v.rounds[r][2 * m + 1], sides[1]));
  };
  const column = (r, half) => {
    const per = v.ties[r].length / 2;
    const body = el('div', { class: 'bcol' }, Array.from({ length: per }, (_, i) => matchEl(r, half * per + i)));
    return el('div', { class: `bround ${half ? 'right' : 'left'}${r === v.round && v.status === 'playing' ? ' current' : ''}` }, el('div', { class: 'bhead', text: ROUNDS[r] }), body);
  };
  const final = v.ties[last][0];
  const fin = (i) => slotEl(v.rounds[last][i], final ? { won: final.winner === (i ? 'b' : 'a'), score: i ? final.b : final.a } : null);
  const middle = el('div', { class: `bround middle${v.round === last && v.status === 'playing' ? ' current' : ''}` }, el('div', { class: 'bhead', text: 'Final' }),
    el('div', { class: 'bcol mid', style: 'height:calc(var(--u) * 32)' }, fin(0), el('div', { class: 'cup', html: '🏆' }), slotEl(v.rounds[last + 1][0], null), fin(1)));
  const left = Array.from({ length: last }, (_, r) => column(r, 0));
  const right = Array.from({ length: last }, (_, r) => column(last - 1 - r, 1));
  box.replaceChildren(...left, middle, ...right);
  box.scrollTop = 0;
  // keep the action in view: start at the left edge in the early rounds, and move inwards as the road does
  box.scrollLeft = v.status === 'playing' ? Math.max(0, (v.round - 1) * COLW) : Math.max(0, (box.scrollWidth - box.clientWidth) / 2);
}
const drawCup = (road, bracket) => { renderRoad(road); renderBracket(bracket); };

// the screen before a round: the draw. Your opponent is revealed here, not before, with how much money each side has
async function cupIntro(my) {
  const t = tournament, you = me(t), opp = opponent(t);
  show('ladder');
  $('l-h').textContent = ROUNDS[t.round];
  $('l-you-badge').innerHTML = crest(you);
  $('l-you-name').textContent = you.name;
  $('l-you-div').textContent = you.tierName;
  $('l-you').textContent = `${gbp(state.money.you)}`;
  drawCup('l-path', 'l-bracket');
  if (t.round > 0) {
    // the draw showed you who it could be (the two clubs of the tie that feeds this round); who won is a secret until now
    $('l-badge').innerHTML = '<span class="qmark">?</span>';
    $('l-club').textContent = 'Who won?';
    $('l-div').textContent = ' ';
    $('l-bot').textContent = '£?m';
    $('l-say').textContent = 'The tie that feeds your match has been played. You find out who you have in a moment.';
    await holdFor(1800);
    if (my !== token) return;
  }
  revealOpponent(t);
  $('l-badge').innerHTML = crest(opp);
  $('l-club').textContent = opp.name;
  $('l-div').textContent = opp.tierName;
  $('l-bot').textContent = `${gbp(opp.budget)}`;
  const pct = Math.round((opp.budget / state.money.you - 1) * 100);
  $('l-say').textContent = (t.round === 0 ? 'The draw is made. ' : '') + (pct === 0 ? 'The same money as you.' : pct < 0 ? `${-pct}% less money than you.` : `${pct}% more money than you: an upset if you win.`);
  drawCup('l-path', 'l-bracket');
  await holdFor(t.round === 0 ? 7000 : 4800);
  if (my !== token) return;
  beginMatchPage(my);
}

// the end of a cup round: through to the next, or out, or champions
async function endRound(m, my) {
  const r = finishRound(tournament);
  const h = tournament.history.at(-1);
  const club = h.clubName;
  const margin = Math.abs(h.you - h.bot);
  const how = r.decidedBy && r.decidedBy !== 'the count' ? ` (level on the count: ${r.decidedBy})` : '';
  const line = r.winner === 'you' ? `You beat ${club} by ${n(margin)}${how}.` : `${club} beat you by ${n(margin)}${how}.`;
  $('s-path').hidden = false; $('s-bracket').hidden = false;
  drawCup('s-path', 's-bracket');
  if (tournament.status === 'playing') {
    $('s-hint').hidden = false;
    await countdown(6, (left) => { $('s-say').textContent = `${line} Through to the ${ROUNDS[tournament.round]}. Who you play is decided by a tie you cannot see yet: ${left}…`; });
    if (my !== token) return;
    state = tournament.tie;
    cupIntro(++token);
    return;
  }
  const champions = tournament.status === 'champions';
  const won = roundsWon(tournament);
  const winner = champion(tournament);
  $('s-say').innerHTML = champions
    ? `<span class="verdict won">Champions!</span> ${esc(me(tournament).name)} won the cup from League Two: all ${ROUNDS.length} rounds. ${esc(line)} Code: ${esc(tournament.seed)}.`
    : `<span class="verdict lost">Knocked out</span> in the ${esc(h.name)} by ${esc(club)}, after winning ${won} round${won === 1 ? '' : 's'}. ${esc(line)} ${esc(winner.name)} won the cup. Code: ${esc(tournament.seed)}.`;
  try {
    const old = JSON.parse(localStorage.getItem(CUP_RECORD)) ?? { best: 0, champions: 0, runs: 0 };
    old.runs++; old.best = Math.max(old.best, won); if (champions) old.champions++;
    localStorage.setItem(CUP_RECORD, JSON.stringify(old));
  } catch { /* private window */ }
  $('s-actions').replaceChildren(
    el('button', { class: 'primary', type: 'button', text: 'Play again', onclick: () => startMatch('') }),
    el('button', { class: 'ghost', type: 'button', text: 'Change mode', onclick: showTitle }));
}

// the pills: one per match. Played ones say who won and the totals; the current one shows its attribute; the rest are still ???
function renderSeries(targetId, current, hideLast = false, hideCurrent = false) {
  const target = $(targetId);
  const done = hideLast ? state.results.slice(0, -1) : state.results;   // at the showdown, this match's result is not shown until it is counted
  target.replaceChildren(...Array.from({ length: COMMON.matches }, (_, i) => {
    const r = done[i];
    const cls = r ? (r.winner === 'you' ? 'w' : r.winner === 'bot' ? 'l' : 'd') : (i === current ? 'next' : '');
    const label = r ? attr(r.category).short : i === current && !hideCurrent ? attr(state.category).short : '???';
    return el('div', { class: `pill ${cls}` }, el('small', { text: `Match ${i + 1}` }), el('b', { text: label }), r ? el('span', { text: `${n(r.you.total)}–${n(r.bot.total)}` }) : null);
  }));
}

// ---- the wheel -------------------------------------------------------------------------------------------------------------------
// The engine has already drawn the result; the wheel only shows it, landing on the slice the engine picked. Click the wheel to skip.
let skipSpin = null;
async function wheelSpin(slices, index, caption, landed, my, duration) {
  const box = $('d-wheelbox');
  box.hidden = false;
  $('d-wheelcap').textContent = caption;
  const w = drawWheel($('d-wheel'), slices);
  const s = w.spin(index, { duration, jitter: Math.random() * 2 - 1, turns: 3 + Math.floor(Math.random() * 2), reduce: reduceMotion });
  skipSpin = s.skip;
  await s.done;
  skipSpin = null;
  if (my !== token) return false;
  $('d-wheelcap').textContent = landed;
  await sleep(850);
  box.hidden = true;
  return my === token;
}

// the attribute for this match, drawn at the start from the ones not yet used in the series
function spinAttribute(my) {
  const usedBefore = state.used.slice(0, -1);
  const slices = ATTRIBUTES.map((a) => ({ label: a.short, dim: usedBefore.includes(a.key) }));
  const index = ATTRIBUTES.findIndex((a) => a.key === state.category);
  return wheelSpin(slices, index, state.match === 1 ? 'Which attribute?' : `Match ${state.match}: which attribute? (faded ones are used)`, attr(state.category).label, my, 3300);
}
// this match's formation, with each slice as big as its chances
function spinFormation(my) {
  const list = formationsOf(mode);
  return wheelSpin(list.map((f) => ({ label: f.name, weight: f.weight })), list.findIndex((f) => f.name === state.formation.name), 'Which formation?', state.formation.name, my, 2700);
}

async function beginMatchPage(my) {
  busy = true;
  show('draft');
  const opp = tournament ? opponent(tournament) : null;
  $('d-matchlbl').textContent = tournament ? ROUNDS[tournament.round] : `Match ${state.match}`;
  $('d-botlbl').textContent = tournament ? `${opp.name} has` : 'Bot has';
  $('d-series').hidden = !!tournament;
  $('p-you-h').textContent = tournament ? me(tournament).name : 'Your team';
  $('p-bot-h').textContent = tournament ? opp.name : "The bot's team";
  $('s-you-h').textContent = $('p-you-h').textContent; $('s-bot-h').textContent = $('p-bot-h').textContent;
  $('d-rounds').textContent = `/${rules().rounds}`;
  $('d-round').textContent = 1;
  $('d-attr').textContent = '?';
  $('d-formation').hidden = false;
  $('d-poslabel').textContent = 'Now drafting';
  $('d-pos').textContent = ' ';
  $('d-formation-name').textContent = '…';
  $('d-board').classList.add('waiting');
  renderSeries('d-series', state.match - 1, false, true);   // the attribute is not shown until the wheel has landed
  renderAll();
  say(tournament ? `${ROUNDS[tournament.round]} against ${opp.name}. Spin the wheel for the attribute.` : state.match === 1 ? 'Spin the wheel for the first attribute.' : `Match ${state.match}: a fresh team and a fresh budget. Spin for the attribute.`);
  if (!(await spinAttribute(my))) return;
  $('d-attr').textContent = attr(state.category).short;
  showCoach();
  renderSeries('d-series', state.match - 1);
  say(`${tournament ? ROUNDS[tournament.round] : `Match ${state.match}`}: <b>${attr(state.category).label}</b>. ${attr(state.category).unit.replace(/^./, (c) => c.toUpperCase())}, added up. Build a team for it.`);
  await sleep(1000);
  if (my !== token) return;
  await runRound(my);
}

// ---- the draft --------------------------------------------------------------------------------------------------------------------
// "Defender 2 of 4" for the slot being drafted
function slotLabel() {
  const pos = positionOf(state);
  const same = state.positions.filter((p) => p === pos).length;
  const nth = state.positions.slice(0, state.round).filter((p) => p === pos).length;
  return same > 1 ? `${ONE[pos]} ${nth} of ${same}` : ONE[pos];
}

async function runRound(my) {
  busy = true;
  $('d-round').textContent = state.round;
  renderMoney();
  $('d-board').classList.add('waiting');
  renderAll();
  if (state.round === 1) {
    $('d-pos').textContent = ' ';
    say('Spin the wheel for the formation.');
    if (!(await spinFormation(my))) return;
    $('d-formation-name').textContent = state.formation.name;
    say(`<b>${state.formation.name}.</b> Both teams play it. You work through it from the goalkeeper to the forwards.`);
    renderAll();
    await sleep(600);
  } else await sleep(350);
  if (my !== token) return;
  $('d-pos').textContent = slotLabel();
  $('d-board').classList.remove('waiting');
  renderAll();
  const first = state.turn === 'you' ? 'You pick first.' : 'The bot picks first.';
  say(`<b>${slotLabel()}.</b> ${first}`);
  if (state.turn === 'bot') { await sleep(800); await botTurn(my); } else { busy = false; say(`${$('d-say').innerHTML} <b>Your pick.</b>`); }
}

async function botTurn(my) {
  busy = true;
  say('The bot is picking…');
  await sleep(900);
  if (my !== token) return;
  const before = state.round;
  const e = botMove(state);
  renderAll();
  say(`The bot took <b>${esc(e.card.full)}</b> for ${gbp(e.price)}.`);
  await after(my, before);
}

async function after(my, before) {
  if (state.phase === 'showdown') { await sleep(1300); if (my === token) goShowdown(); return; }
  if (state.round !== before) { await sleep(1300); if (my === token) await runRound(my); return; }
  if (state.turn === 'bot') { await sleep(700); if (my === token) await botTurn(my); return; }
  busy = false;
  say(`${$('d-say').innerHTML} <b>Your pick.</b>`);
}

async function choose(id) {
  if (busy || !state || state.turn !== 'you') return;
  const entry = state.board.find((b) => b.card.id === id);
  if (!entry || entry.takenBy) return;
  if (!canAfford(state, 'you', entry.price)) { say(`Too dear: you must keep ${gbp(COMMON.minPrice)} for every round still to come. The most you can spend now is <b>${gbp(maxSpend(state, 'you'))}</b>.`); return; }
  busy = true;
  const my = token, before = state.round;
  pick(state, 'you', id);
  renderAll();
  say(`You took <b>${esc(entry.card.full)}</b> for ${gbp(entry.price)}.`);
  await after(my, before);
}

function renderMoney() {
  $('d-money').textContent = `${gbp(state.money.you)}`;
  $('d-botmoney').textContent = `${gbp(state.money.bot)}`;
}

function renderBoard() {
  $('d-board').replaceChildren(...state.board.map((b) => {
    const dear = !b.takenBy && !canAfford(state, 'you', b.price);
    const first = firstNameOf(b.card);
    const t = el('button', {
      class: `tile${dear ? ' over' : ''}${b.takenBy ? ` taken ${b.takenBy}` : ''}`, type: 'button',
      'data-by': b.takenBy ? (b.takenBy === 'you' ? 'YOURS' : "BOT'S") : null,
      'aria-label': `${b.card.full}, ${gbp(b.price)}${b.takenBy ? `, taken by ${b.takenBy === 'you' ? 'you' : 'the bot'}` : dear ? ', over budget' : ''}`,
      'aria-disabled': b.takenBy || dear ? 'true' : null,
      onclick: () => choose(b.card.id),
    },
    el('span', { class: 'first', text: first || ' ' }),
    el('span', { class: 'last', text: surnameOf(b.card) }),
    el('span', { class: 'price', text: `${gbp(b.price)}` }),
    el('span', { class: 'over-note', text: 'Over budget' }));
    return t;
  }));
}

function renderTeams() { renderPitches(); }

// each team on a pitch in the formation, goalkeeper at the bottom. Slot i is round i + 1.
function renderPitches() {
  for (const who of ['you', 'bot']) {
    const pitch = $(`p-${who}`);
    pitch.classList.toggle('small', state.positions.length <= 5);
    pitch.replaceChildren(...['FWD', 'MID', 'DEF', 'GK'].filter((line) => state.positions.includes(line)).map((line) => el('div', { class: 'line' },
      state.positions.map((pos, i) => pos === line ? i : -1).filter((i) => i >= 0).map((i) => {
        const c = state.teams[who][i];
        const now = state.phase === 'draft' && i === state.round - 1 && !c;
        return el('div', { class: `pslot${c ? ' full' : ''}${now ? ' now' : ''}`, title: c ? `${c.full}, ${gbp(state.paid[who][i])}` : '' },
          el('span', { class: 'sn', text: c ? surnameOf(c) : (now ? '?' : '') }),
          c ? el('span', { class: 'sc', text: `${gbp(state.paid[who][i])}` }) : null);
      }))));
  }
}
function renderAll() { renderBoard(); renderTeams(); renderMoney(); }

// ---- the showdown -----------------------------------------------------------------------------------------------------------
// After the draft: this match's showdown. The page plays one match at a time; the series stops as soon as one side has two.
async function goShowdown() {
  const my = token;
  result = showdown(state);
  show('show');
  $('s-tally').hidden = true;
  $('s-cards').hidden = true;
  $('s-you').replaceChildren(); $('s-bot').replaceChildren();
  $('s-head').textContent = tournament ? `${ROUNDS[tournament.round]}: ${opponent(tournament).name}` : `Match ${state.match}: ${attr(state.category).label}`;
  $('s-series').hidden = !!tournament;
  $('s-path').hidden = true; $('s-bracket').hidden = true;
  if (!tournament) renderSeries('s-series', state.match - 1, true);
  $('s-say').textContent = `Both teams are in. ${attr(state.category).unit.replace(/^./, (c) => c.toUpperCase())}, added up.`;
  $('s-actions').replaceChildren();
  $('s-hint').hidden = false;
  await holdFor(2200);   // a moment to see who is playing what, then it counts by itself
  if (my !== token) return;
  countMatch();
}

// what each player cost against what he was: a bargain was priced below his tier, a trap above
function captionFor(who, c) {
  const e = state.log.find((l) => l.who === who && l.id === c.id);
  if (!e) return null;
  const tag = e.price < e.tier ? 'bargain' : e.price > e.tier ? 'trap' : '';
  return el('div', { class: `cap ${tag}`, text: `${gbp(e.price)}${tag ? ` · ${tag}` : ''}` });
}

// The Sticker Season card, turned into a Prem Wheel card: here the REAL career totals are what counts, so each row shows the
// total (not the 1-99 rating), the rows being counted are highlighted, and the overall plate is hidden.
function playerCard(c, category) {
  const node = renderCard(c, {});
  const lis = node.querySelectorAll('.stats li');
  ROWS.forEach((key, i) => {
    const li = lis[i];
    const total = key === 'discipline' ? c.yellow + 3 * c.red : c[key === 'games' ? 'games' : key];
    li.classList.remove('active');
    if (category && HIGHLIGHT[category].includes(key)) li.classList.add('active');
    li.querySelector('i').textContent = n(total);
    li.querySelector('em')?.remove();
    li.querySelector('.chips')?.remove();
    li.dataset.tip = `${n(total)} ${attr(key === 'games' ? 'games' : key).unit} in his Premier League career${key === 'discipline' ? ` (${c.yellow} yellow, ${c.red} red)` : ''}`;
  });
  node.querySelector('.rating')?.remove();
  const pos = node.querySelector('.pos');
  if (pos) pos.textContent = c.pos;
  // titles, wins and clean sheets aren't rows on a Sticker Season card: a gold tag on the art, lit up when it is what is being counted.
  // Titles are always shown when he has any; wins and clean sheets (estimates) only when they are the attribute being counted.
  if (category === 'wins' || category === 'cleansheets') {
    const v = valueOf(c, category);
    node.querySelector('.art').append(el('div', { class: 'ttag on', text: `${n(v)} ${attr(category).short}`, 'data-tip': `${n(v)} ${attr(category).unit}` }));
  } else if (c.titles) {
    node.querySelector('.art').append(el('div', { class: `ttag${category === 'titles' ? ' on' : ''}`, text: `${c.titles}× TITLE${c.titles > 1 ? 'S' : ''}`, 'data-tip': `${c.titles} Premier League title${c.titles > 1 ? 's' : ''}: seasons with the champions, 5+ league appearances` }));
  }
  return node;
}

function renderCards(category) {
  for (const who of ['you', 'bot']) {
    $(`s-${who}`).replaceChildren(...state.teams[who].map((c) => el('div', { class: 'pickable' }, playerCard(c, category), captionFor(who, c))));
  }
}

// count one match: reveal both teams, then each player's real total in the attribute, row by row with running totals
async function countMatch() {
  const my = token;
  const m = result;
  $('s-actions').replaceChildren();
  $('s-hint').hidden = true;
  $('s-say').textContent = `${attr(m.category).label}: the real career totals, added up.`;
  renderCards(m.category);
  $('s-cards').hidden = false;
  const tally = $('s-tally');
  tally.hidden = false;
  const rows = Array.from({ length: rules().rounds }, (_, i) => {
    const y = m.you.players[i], b = m.bot.players[i];
    const pay = (p) => el('small', { text: `${gbp(p.paid)}` });
    return el('div', { class: 'trow pending' },
      el('div', { class: 'nm' }, y.card.full, pay(y)), el('div', { class: 'v', text: n(y.value) }),
      el('div', { class: 'tpos', text: y.card.pos === b.card.pos ? y.card.pos : `${y.card.pos}/${b.card.pos}` }),
      el('div', { class: 'v r', text: n(b.value) }), el('div', { class: 'nm r' }, b.card.full, pay(b)));
  });
  const totalY = el('div', { class: 'v', text: '0' }), totalB = el('div', { class: 'v r', text: '0' });
  const total = el('div', { class: 'trow total' }, el('div', { class: 'nm', text: 'Total' }), totalY, el('div', { class: 'lbl', text: attr(m.category).short }), totalB, el('div', { class: 'nm r' }));
  tally.replaceChildren(
    el('div', { class: 'trow head' }, el('div', { class: 'y', text: 'You' }), el('div', { class: 'b', text: 'The bot' })),
    ...rows, total);
  tally.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  let y = 0, b = 0;
  for (let i = 0; i < rows.length; i++) {
    await sleep(rows.length > 5 ? 380 : 750);
    if (my !== token) return;
    rows[i].classList.remove('pending');
    rows[i].classList.add('hit');
    y += m.you.players[i].value; b += m.bot.players[i].value;
    totalY.textContent = n(y); totalB.textContent = n(b);
  }
  await sleep(500);
  if (my !== token) return;
  total.classList.add(m.winner === 'draw' ? 'draw' : `win-${m.winner}`);
  if (tournament) return endRound(m, my);
  renderSeries('s-series', -1);
  const margin = Math.abs(m.you.total - m.bot.total);
  const line = m.winner === 'draw' ? 'Exactly level.' : `${m.winner === 'you' ? 'You win' : 'The bot wins'} match ${m.match} by ${n(margin)}.`;
  const ser = m.series;
  if (!ser.over) {
    // on to the next match by itself, after time to read the result
    $('s-hint').hidden = false;
    await countdown(5, (left) => { $('s-say').textContent = `${line} It is ${ser.wins.you}–${ser.wins.bot}. Match ${state.match + 1}: a fresh team in ${left}…`; });
    if (my !== token) return;
    nextMatch(state);
    beginMatchPage(++token);
    return;
  }
  const won = ser.winner === 'you', draw = ser.winner === 'draw';
  $('s-say').innerHTML = `<span class="verdict ${won ? 'won' : draw ? '' : 'lost'}">${draw ? 'A draw' : won ? 'You win' : 'The bot wins'}</span> ${draw ? 'Level on everything.' : `the series ${Math.max(ser.wins.you, ser.wins.bot)}–${Math.min(ser.wins.you, ser.wins.bot)}.`} ${esc(line)} Match code: ${esc(state.seed)}.`;
  remember(recordKey(), won ? 'w' : draw ? 'd' : 'l');
  $('s-actions').replaceChildren(
    el('button', { class: 'primary', type: 'button', text: 'Play again', onclick: () => startMatch('') }),
    el('button', { class: 'ghost', type: 'button', text: 'Change opponent', onclick: showTitle }));
}

// ---- the manual ------------------------------------------------------------------------------------------------------------------------
function buildManual() {
  const five = MODES.five, eleven = MODES.eleven;
  const list = ATTRIBUTES.map((a) => `<li><b>${a.label.toLowerCase()}</b>: ${a.unit}</li>`).join('');
  $('m-body').innerHTML = `
    <h2 id="m-h">How to play</h2>
    <h3>Two ways to play</h3>
    <ul>
      <li><b>The Cup</b> (the main game): 64 clubs from the English pyramid, <b>16 each from the Premier League, the Championship and League One, and League Two (you are one of them)</b>. The draw is made at the start and you can see all 64. Six knockout rounds, each a single match. The opponent is always the same bot; what changes is its <b>money</b>, which follows the division: a League Two club has about what you have or less, a Premier League club up to 30% more. The big clubs cannot reach you before about the quarter-final. After round one you know the two clubs your next opponent could be, but not which one won until the round starts. Win a round and you go through; <b>lose and you are out</b>. If a round is level on the count, more appearances goes through, then a coin. Name your club on the title screen.</li>
      <li><b>Quick series</b>: a best of three against a bot of the level you choose (easy, medium or hard).</li>
    </ul>
    <h3>A match</h3>
    <p><b>The aim.</b> Beat the bot, with teams you build knowing nothing about the players but their names and prices.</p>
    <h3>In a quick series: up to three matches</h3>
    <ol>
      <li><b>An attribute is drawn</b> at the start of each match (never the same one twice in a series). The attributes are:<ul>${list}</ul>Each is a player's <b>real Premier League career total</b>, 1992/93 to 2025/26.</li>
      <li><b>You draft a fresh team</b> for it, every match, on a fresh budget: <b>${gbp(five.budget)}</b> in 5-a-side, <b>${gbp(eleven.budget)}</b> in 11-a-side. You know the attribute while you pick, so you can tailor the team to it. Anyone who played in an earlier match is gone.</li>
      <li><b>The teams are counted.</b> Each player's total in the attribute is added up and the bigger total wins the match. <b>First to two matches wins the series</b>, so it can be over after two.</li>
    </ol>
    <h3>The draft</h3>
    <p>Each round a board of eight players of one position goes up with <b>a name and a price</b> from £1m to £5m: no stats, no club. You and the bot take turns to pick <b>one</b> each; who picks first swaps every round. Once a player is taken he is gone, and you see what the bot takes as it takes it. You must keep <b>${gbp(COMMON.minPrice)} for every round still to come</b>, so you can never be locked out.</p>
    <ul>
      <li><b>5-a-side</b>: ${five.rounds} rounds a match. A <b>formation</b> (1-2-1, 2-1-1, 1-1-2 or 2-2: one goalkeeper and four outfield players) is rolled at the start of each match and both teams play it.</li>
      <li><b>11-a-side</b>: ${eleven.rounds} rounds a match. A <b>formation</b> (4-4-2, 4-3-3, 4-5-1, 3-5-2, 3-4-3 or 5-3-2) is rolled at the start of each match and both teams play it. You work through it from the goalkeeper to the forwards, so you decide early how much of the money goes into defence and how much is kept for attack.</li>
    </ul>
    <h3>Estimates</h3>
    <p><b>Wins</b> and <b>clean sheets</b> are estimates. We know every club's real results, so a club-season's wins and clean sheets are exact; a player gets the share that matches the minutes he was on the pitch (a goalkeeper who played every minute gets all of them). Clean sheets only count for the seasons he is listed as a goalkeeper or defender. Checked against the published totals: Čech 199 against 202, James 169 against 169.</p>
    <h3>Prices are a hint, not the truth</h3>
    <p>A £5m player is usually a star of his position and a £1m player a squad man, but about one player in three in the middle prices is a <b>bargain</b> (at least half a million cheaper than he should be) or a <b>trap</b> (at least half a million dearer). Prices are by position: the best goalkeeper in the league is a £5 goalkeeper, but he will score no goals. Everyone on a board has made at least ${COMMON.minGames} Premier League appearances.</p>
    <h3>Tips</h3>
    <ul>
      <li>Tailor each team to its attribute. <b>Clean sheets</b>: only goalkeepers and defenders earn them (a striker is worth nothing), so spend on the back line and £1m on everyone else. <b>Wins</b>: everyone counts, so it is the long careers at winning clubs: a £1 midfielder at Man Utd can beat a £5 striker at a mid-table side. <b>League titles</b>: think of the champions (Man Utd in the 90s and 00s, Chelsea, Man City now, Arsenal, Liverpool): a squad player at a club that won it beats a star at one that never did. <b>Goals</b>: forwards, and never pay for a goalkeeper. <b>Assists</b>: midfielders and wingers. <b>Goal involvements</b>: goals plus assists, so attacking midfielders are as good as strikers. <b>Appearances</b>: a long-serving defender or keeper is worth as much as a star. <b>Discipline</b>: find the hard men.</li>
      <li>Money left at the end is wasted. Spend it, but not on the wrong name.</li>
      <li>A career total rewards a long career: someone who played 15 years beats a brilliant two-season wonder.</li>
      <li>You can only use a player once in a series, so a bargain you spend in match 1 is not there in match 3.</li>
    </ul>`;
}

// ---- boot -----------------------------------------------------------------------------------------------------------------------------
function wire() {
  $('t-new').addEventListener('click', kickOff);
  $('d-help').addEventListener('click', showGuide);
  $('d-coach-ok').addEventListener('click', dismissCoach);
  $('t-help').addEventListener('click', showGuide);
  $('d-quit').addEventListener('click', () => { $('d-coach').hidden = true; token++; skipSpin = null; $('d-wheelbox').hidden = true; showTitle(); });
  $('d-wheelbox').addEventListener('click', () => skipSpin?.());
  $('show').addEventListener('click', () => skipHold?.());
  $('ladder').addEventListener('click', (e) => { if (!e.target.closest('.bracket')) skipHold?.(); });
  const tf = () => { const cup = document.querySelector('input[name=format]:checked').value === 'cup'; $('t-levels').hidden = cup; drawSummary(); };
  document.querySelectorAll('input[name=format], input[name=mode], input[name=level]').forEach((x) => x.addEventListener('change', tf));
  $('t-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('t-new').click(); } });
  $('t-more').addEventListener('click', () => { const open = $('t-other').hidden; $('t-other').hidden = !open; $('t-more').setAttribute('aria-expanded', String(open)); $('t-more').textContent = open ? 'Hide other modes' : 'Other game modes'; });
  tf();
  document.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && skipHold && (!$('show').hidden || !$('ladder').hidden) && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); skipHold(); } });
  let fm = params.get('format'); if (fm === 'ladder') fm = 'cup';
  if (fm === 'cup' || fm === 'series') document.querySelector(`input[name=format][value=${fm}]`).checked = true;
  const m = params.get('mode'); if (m && MODES[m]) document.querySelector(`input[name=mode][value=${m}]`).checked = true;
  const l = params.get('level'); if (['easy', 'medium', 'hard'].includes(l)) document.querySelector(`input[name=level][value=${l}]`).checked = true;
  if (params.get('seed')) $('t-seed').value = params.get('seed');
  let saved = null; try { saved = localStorage.getItem(CLUB_KEY); } catch { /* private window */ }
  $('t-name').value = params.get('club') ?? saved ?? `${pickOf(PLACES)} ${pickOf(SUFFIXES)}`;
  buildClubPicker();
  if (params.get('format') || params.get('mode') || params.get('level') || params.get('seed')) { $('t-other').hidden = false; $('t-more').setAttribute('aria-expanded', 'true'); $('t-more').textContent = 'Hide other modes'; }
  tf();
}

(async function boot() {
  try {
    const res = await fetch(new URL('../../../stickers/src/data/cards.json', import.meta.url));
    if (!res.ok) throw new Error(`cards.json: ${res.status}`);
    pool = makePool(await res.json());
    buildManual();
    wire();
    initTooltips();
    showTitle();
  } catch (err) {
    $('l-msg').textContent = `Couldn't load the players (${err.message}). Serve the project folder over http, e.g. npm start in draft/.`;
  }
})();
