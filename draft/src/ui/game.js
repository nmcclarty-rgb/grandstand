// The Blind Five page. All the rules live in the engine (draft.js, bot.js); this file draws screens and calls it.
import { makePool } from '../../../stickers/src/engine/deck.js';
import { firstNameOf, surnameOf } from '../../../stickers/src/engine/cards.js';
import { renderCard } from '../../../stickers/src/ui/card.js';
import { initTooltips } from '../../../stickers/src/ui/tooltip.js';
import { COMMON, MODES, newMatch, nextMatch, pick, positionOf, canAfford, maxSpend, showdown, seriesOf, rulesOf } from '../engine/draft.js';
import { ATTRIBUTES, ATTRIBUTE, valueOf } from '../engine/attributes.js';
import { botMove } from '../engine/bot.js';

const $ = (id) => document.getElementById(id);
const n = (x) => x.toLocaleString('en-GB');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LABEL = { GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' };
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

let pool, state, result, level = 'medium', mode = 'five', busy = false, token = 0;
const rules = () => rulesOf(state);
const recordKey = () => `${mode}-${level}`;
const attr = (k) => ATTRIBUTE[k];
const params = new URLSearchParams(location.search);

const SCREENS = ['loading', 'title', 'draft', 'show'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  document.body.dataset.screen = id;
  const h = $(id).querySelector('h1, h2');
  if (h) h.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
const say = (html) => { $('d-say').innerHTML = html; };

// ---- title ------------------------------------------------------------------------------------------------------------------
function showTitle() {
  token++;
  busy = false;
  const r = recall();
  const bits = Object.keys(MODES).flatMap((m) => ['easy', 'medium', 'hard'].map((l) => [`${MODES[m].label} ${l}`, r[`${m}-${l}`] ?? (m === 'five' ? r[l] : null)]))
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v.w} won, ${v.l} lost${v.d ? `, ${v.d} drawn` : ''}`);
  $('t-record').textContent = bits.length ? `Your record. ${bits.join(' · ')}.` : '';
  show('title');
}

// A series is three matches (the page stops at 2-0). Each match is a fresh draft for the attribute drawn at its start.
function startMatch(seed) {
  level = document.querySelector('input[name=level]:checked').value;
  mode = document.querySelector('input[name=mode]:checked').value;
  state = newMatch(pool, seed || Date.now(), { level, mode });
  document.body.dataset.mode = mode;
  result = null;
  const my = ++token;
  beginMatchPage(my);
}

// the pills: one per match. Played ones say who won and the totals; the current one shows its attribute; the rest are still ???
function renderSeries(targetId, current, hideLast = false) {
  const target = $(targetId);
  const done = hideLast ? state.results.slice(0, -1) : state.results;   // at the showdown, this match's result is not shown until it is counted
  target.replaceChildren(...Array.from({ length: COMMON.matches }, (_, i) => {
    const r = done[i];
    const cls = r ? (r.winner === 'you' ? 'w' : r.winner === 'bot' ? 'l' : 'd') : (i === current ? 'next' : '');
    const label = r ? attr(r.category).short : i === current ? attr(state.category).short : '???';
    return el('div', { class: `pill ${cls}` }, el('small', { text: `Match ${i + 1}` }), el('b', { text: label }), r ? el('span', { text: `${n(r.you.total)}–${n(r.bot.total)}` }) : null);
  }));
}

// the draw: the attribute for this match is drawn at the start, so you can tailor the team to it
async function rollAttribute(my) {
  const h = $('d-attr');
  if (!reduceMotion) for (let i = 0; i < 14; i++) { h.textContent = ATTRIBUTES[i % ATTRIBUTES.length].short; await sleep(50 + i * 14); if (my !== token) return false; }
  h.textContent = attr(state.category).short;
  return true;
}

async function beginMatchPage(my) {
  busy = true;
  show('draft');
  $('d-match').textContent = state.match;
  $('d-rounds').textContent = `/${rules().rounds}`;
  $('d-round').textContent = 1;
  $('d-attr').textContent = '…';
  $('d-formation').hidden = mode !== 'eleven';
  $('d-poslabel').textContent = mode === 'eleven' ? 'Now drafting' : 'The wheel says';
  $('d-pos').textContent = ' ';
  $('d-formation-name').textContent = '…';
  $('d-board').classList.add('waiting');
  renderSeries('d-series', state.match - 1);
  renderAll();
  say(state.match === 1 ? 'Drawing the first attribute…' : `Match ${state.match}: a fresh team, a fresh budget. Drawing the attribute…`);
  if (!(await rollAttribute(my))) return;
  $('d-attr').textContent = attr(state.category).short;
  renderSeries('d-series', state.match - 1);
  say(`Match ${state.match}: <b>${attr(state.category).label}</b>. ${attr(state.category).unit.replace(/^./, (c) => c.toUpperCase())}, added up. Build a team for it.`);
  await sleep(1000);
  if (my !== token) return;
  await runRound(my);
}

// ---- the draft --------------------------------------------------------------------------------------------------------------------
async function spin(final) {
  const h = $('d-pos');
  h.parentElement.classList.add('spinning');
  const order = Object.keys(LABEL);
  if (!reduceMotion) for (let i = 0; i < 14; i++) { h.textContent = LABEL[order[(i + 1) % 4]]; await sleep(55 + i * 16); }
  h.textContent = LABEL[final];
  h.parentElement.classList.remove('spinning');
}

// 11-a-side: the formation is rolled once, at the start, and the draft then works through it
async function rollFormation() {
  const names = ['4-4-2', '4-3-3', '4-5-1', '3-5-2', '3-4-3', '5-3-2'];
  const h = $('d-pos');
  h.parentElement.classList.add('spinning');
  if (!reduceMotion) for (let i = 0; i < 16; i++) { h.textContent = names[i % names.length]; await sleep(55 + i * 16); }
  h.textContent = state.formation.name;
  $('d-formation-name').textContent = state.formation.name;
  h.parentElement.classList.remove('spinning');
}

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
  if (mode === 'eleven') {
    if (state.round === 1) {
      $('d-pos').textContent = ' ';
      say('Rolling the formation…');
      await rollFormation();
      if (my !== token) return;
      say(`<b>${state.formation.name}.</b> Both teams play it. You work through it from the goalkeeper to the forwards.`);
      renderAll();
      await sleep(1200);
    } else await sleep(350);
    if (my !== token) return;
    $('d-pos').textContent = slotLabel();
  } else {
    say(`Round ${state.round} of ${rules().rounds}: the wheel is spinning…`);
    await spin(positionOf(state));
    if (my !== token) return;
  }
  $('d-board').classList.remove('waiting');
  renderAll();
  const first = state.turn === 'you' ? 'You pick first.' : 'The bot picks first.';
  say(`<b>${mode === 'eleven' ? slotLabel() : LABEL[positionOf(state)]}.</b> ${first}`);
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
  say(`The bot took <b>${esc(e.card.full)}</b> for £${e.price}.`);
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
  if (!canAfford(state, 'you', entry.price)) { say(`Too dear: you must keep £${COMMON.minPrice} for every round still to come. The most you can spend now is <b>£${maxSpend(state, 'you')}</b>.`); return; }
  busy = true;
  const my = token, before = state.round;
  pick(state, 'you', id);
  renderAll();
  say(`You took <b>${esc(entry.card.full)}</b> for £${entry.price}.`);
  await after(my, before);
}

function renderMoney() {
  $('d-money').textContent = `£${state.money.you}`;
  $('d-botmoney').textContent = `£${state.money.bot}`;
}

function renderBoard() {
  $('d-board').replaceChildren(...state.board.map((b) => {
    const dear = !b.takenBy && !canAfford(state, 'you', b.price);
    const first = firstNameOf(b.card);
    const t = el('button', {
      class: `tile${dear ? ' over' : ''}${b.takenBy ? ` taken ${b.takenBy}` : ''}`, type: 'button',
      'data-by': b.takenBy ? (b.takenBy === 'you' ? 'YOURS' : "BOT'S") : null,
      'aria-label': `${b.card.full}, £${b.price}${b.takenBy ? `, taken by ${b.takenBy === 'you' ? 'you' : 'the bot'}` : dear ? ', over budget' : ''}`,
      'aria-disabled': b.takenBy || dear ? 'true' : null,
      onclick: () => choose(b.card.id),
    },
    el('span', { class: 'first', text: first || ' ' }),
    el('span', { class: 'last', text: surnameOf(b.card) }),
    el('span', { class: 'price', text: `£${b.price}` }),
    el('span', { class: 'over-note', text: 'Over budget' }));
    return t;
  }));
}

function renderTeams() {
  if (mode === 'eleven') return renderPitches();
  for (const who of ['you', 'bot']) {
    $(`d-${who}`).replaceChildren(...Array.from({ length: rules().rounds }, (_, i) => {
      const c = state.teams[who][i];
      return c ? el('li', { class: `five-slot full ${who}` }, el('span', { class: 'p', text: SHORT[c.pos] }), el('span', { class: 'n', text: c.full }), el('span', { class: 'c', text: `£${state.paid[who][i]}` }))
        : el('li', { class: `five-slot ${who}` }, el('span', { class: 'p' }), el('span', { class: 'n', text: '—' }), el('span', { class: 'c' }));
    }));
  }
}

// 11-a-side: each team on a pitch in the formation, goalkeeper at the bottom. Slot i is round i + 1.
function renderPitches() {
  for (const who of ['you', 'bot']) {
    const pitch = $(`p-${who}`);
    pitch.replaceChildren(...['FWD', 'MID', 'DEF', 'GK'].map((line) => el('div', { class: 'line' },
      state.positions.map((pos, i) => pos === line ? i : -1).filter((i) => i >= 0).map((i) => {
        const c = state.teams[who][i];
        const now = state.phase === 'draft' && i === state.round - 1 && !c;
        return el('div', { class: `pslot${c ? ' full' : ''}${now ? ' now' : ''}`, title: c ? `${c.full}, £${state.paid[who][i]}` : '' },
          el('span', { class: 'sn', text: c ? surnameOf(c) : (now ? '?' : '') }),
          c ? el('span', { class: 'sc', text: `£${state.paid[who][i]}` }) : null);
      }))));
  }
}
function renderAll() { renderBoard(); renderTeams(); renderMoney(); }

// ---- the showdown -----------------------------------------------------------------------------------------------------------
// After the draft: this match's showdown. The page plays one match at a time; the series stops as soon as one side has two.
function goShowdown() {
  result = showdown(state);
  show('show');
  $('s-tally').hidden = true;
  $('s-cards').hidden = true;
  $('s-you').replaceChildren(); $('s-bot').replaceChildren();
  $('s-head').textContent = `Match ${state.match}: ${attr(state.category).label}`;
  renderSeries('s-series', state.match - 1, true);
  $('s-say').textContent = `Both teams are in. ${attr(state.category).unit.replace(/^./, (c) => c.toUpperCase())}, added up.`;
  $('s-actions').replaceChildren(el('button', { class: 'primary', type: 'button', text: 'Reveal the teams', onclick: countMatch }));
}

// what each player cost against what he was: a bargain was priced below his tier, a trap above
function captionFor(who, c) {
  const e = state.log.find((l) => l.who === who && l.id === c.id);
  if (!e) return null;
  const tag = e.price < e.tier ? 'bargain' : e.price > e.tier ? 'trap' : '';
  return el('div', { class: `cap ${tag}`, text: `£${e.price}${tag ? ` · ${tag}` : ''}` });
}

// The Sticker Season card, turned into a Blind Five card: here the REAL career totals are what counts, so each row shows the
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
  $('s-say').textContent = `${attr(m.category).label}: the real career totals, added up.`;
  renderCards(m.category);
  $('s-cards').hidden = false;
  const tally = $('s-tally');
  tally.hidden = false;
  const rows = Array.from({ length: rules().rounds }, (_, i) => {
    const y = m.you.players[i], b = m.bot.players[i];
    const pay = (p) => el('small', { text: `£${p.paid}` });
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
  renderSeries('s-series', -1);
  const margin = Math.abs(m.you.total - m.bot.total);
  const line = m.winner === 'draw' ? 'Exactly level.' : `${m.winner === 'you' ? 'You win' : 'The bot wins'} match ${m.match} by ${n(margin)}.`;
  const ser = m.series;
  if (!ser.over) {
    $('s-say').textContent = `${line} It is ${ser.wins.you}–${ser.wins.bot}. Next: a fresh team.`;
    $('s-actions').replaceChildren(el('button', { class: 'primary', type: 'button', text: `Match ${state.match + 1}: fresh team`, onclick: () => { nextMatch(state); beginMatchPage(++token); } }));
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
    <p><b>The aim.</b> Win two matches out of three against the bot, with teams you build knowing nothing about the players but their names and prices.</p>
    <h3>A series is up to three matches</h3>
    <ol>
      <li><b>An attribute is drawn</b> at the start of each match (never the same one twice in a series). The attributes are:<ul>${list}</ul>Each is a player's <b>real Premier League career total</b>, 1992/93 to 2025/26.</li>
      <li><b>You draft a fresh team</b> for it, every match, on a fresh budget: <b>£${five.budget}</b> in 5-a-side, <b>£${eleven.budget}</b> in 11-a-side. You know the attribute while you pick, so you can tailor the team to it. Anyone who played in an earlier match is gone.</li>
      <li><b>The teams are counted.</b> Each player's total in the attribute is added up and the bigger total wins the match. <b>First to two matches wins the series</b>, so it can be over after two.</li>
    </ol>
    <h3>The draft</h3>
    <p>Each round a board of eight players of one position goes up with <b>a name and a price</b> of £1 to £5: no stats, no club. You and the bot take turns to pick <b>one</b> each; who picks first swaps every round. Once a player is taken he is gone, and you see what the bot takes as it takes it. You must keep <b>£${COMMON.minPrice} for every round still to come</b>, so you can never be locked out.</p>
    <ul>
      <li><b>5-a-side</b>: ${five.rounds} rounds a match. A wheel names the position each round (never one position three times).</li>
      <li><b>11-a-side</b>: ${eleven.rounds} rounds a match. A <b>formation</b> (4-4-2, 4-3-3, 4-5-1, 3-5-2, 3-4-3 or 5-3-2) is rolled at the start of each match and both teams play it. You work through it from the goalkeeper to the forwards, so you decide early how much of the money goes into defence and how much is kept for attack.</li>
    </ul>
    <h3>Estimates</h3>
    <p><b>Wins</b> and <b>clean sheets</b> are estimates. We know every club's real results, so a club-season's wins and clean sheets are exact; a player gets the share that matches the minutes he was on the pitch (a goalkeeper who played every minute gets all of them). Clean sheets only count for the seasons he is listed as a goalkeeper or defender. Checked against the published totals: Čech 199 against 202, James 169 against 169.</p>
    <h3>Prices are a hint, not the truth</h3>
    <p>A £5 is usually a star of his position and a £1 a squad man, but about one player in three in the middle prices is a <b>bargain</b> (cheaper than he is) or a <b>trap</b> (dearer). Prices are by position: the best goalkeeper in the league is a £5 goalkeeper, but he will score no goals. Everyone on a board has made at least ${COMMON.minGames} Premier League appearances.</p>
    <h3>Tips</h3>
    <ul>
      <li>Tailor each team to its attribute. <b>Clean sheets</b>: only goalkeepers and defenders earn them (a striker is worth nothing), so spend on the back line and £1 on everyone else. <b>Wins</b>: everyone counts, so it is the long careers at winning clubs: a £1 midfielder at Man Utd can beat a £5 striker at a mid-table side. <b>League titles</b>: think of the champions (Man Utd in the 90s and 00s, Chelsea, Man City now, Arsenal, Liverpool): a squad player at a club that won it beats a star at one that never did. <b>Goals</b>: forwards, and never pay for a goalkeeper. <b>Assists</b>: midfielders and wingers. <b>Goal involvements</b>: goals plus assists, so attacking midfielders are as good as strikers. <b>Appearances</b>: a long-serving defender or keeper is worth as much as a star. <b>Discipline</b>: find the hard men.</li>
      <li>Money left at the end is wasted. Spend it, but not on the wrong name.</li>
      <li>A career total rewards a long career: someone who played 15 years beats a brilliant two-season wonder.</li>
      <li>You can only use a player once in a series, so a bargain you spend in match 1 is not there in match 3.</li>
    </ul>`;
}

// ---- boot -----------------------------------------------------------------------------------------------------------------------------
function wire() {
  $('t-new').addEventListener('click', () => startMatch($('t-seed').value.trim()));
  $('t-help').addEventListener('click', () => $('manual').showModal?.());
  $('d-quit').addEventListener('click', showTitle);
  const m = params.get('mode'); if (m && MODES[m]) document.querySelector(`input[name=mode][value=${m}]`).checked = true;
  const l = params.get('level'); if (['easy', 'medium', 'hard'].includes(l)) document.querySelector(`input[name=level][value=${l}]`).checked = true;
  if (params.get('seed')) $('t-seed').value = params.get('seed');
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
