// The Blind Five page. All the rules live in the engine (draft.js, bot.js); this file draws screens and calls it.
import { makePool } from '../../../stickers/src/engine/deck.js';
import { CATEGORIES, CATEGORY_KEYS, firstNameOf, surnameOf } from '../../../stickers/src/engine/cards.js';
import { renderCard } from '../../../stickers/src/ui/card.js';
import { initTooltips } from '../../../stickers/src/ui/tooltip.js';
import { RULES, newMatch, pick, positionOf, canAfford, maxSpend, showdown } from '../engine/draft.js';
import { botMove } from '../engine/bot.js';

const $ = (id) => document.getElementById(id);
const n = (x) => x.toLocaleString('en-GB');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LABEL = { GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' };
const SHORT = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };
const RECORD = 'blind-five:record:v1';

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
function remember(level, outcome) {
  try { const r = recall(); r[level] ??= { w: 0, l: 0, d: 0 }; r[level][outcome]++; localStorage.setItem(RECORD, JSON.stringify(r)); } catch { /* private window */ }
}

let pool, state, result, level = 'medium', busy = false, token = 0;
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
  const bits = ['easy', 'medium', 'hard'].filter((l) => r[l]).map((l) => `${l}: ${r[l].w} won, ${r[l].l} lost${r[l].d ? `, ${r[l].d} drawn` : ''}`);
  $('t-record').textContent = bits.length ? `Your record. ${bits.join(' · ')}.` : '';
  show('title');
}

function startMatch(seed) {
  level = document.querySelector('input[name=level]:checked').value;
  state = newMatch(pool, seed || Date.now(), { level });
  result = null;
  const my = ++token;
  show('draft');
  $('d-attr').textContent = '???';
  renderTeams();
  runRound(my);
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

async function runRound(my) {
  busy = true;
  $('d-round').textContent = state.round;
  renderMoney();
  $('d-board').classList.add('waiting');
  renderBoard();
  say(`Round ${state.round} of ${RULES.rounds}: the wheel is spinning…`);
  await spin(positionOf(state));
  if (my !== token) return;
  $('d-board').classList.remove('waiting');
  renderBoard();
  const first = state.turn === 'you' ? 'You pick first.' : 'The bot picks first.';
  say(`<b>${LABEL[positionOf(state)]}.</b> ${first}`);
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
  if (!canAfford(state, 'you', entry.price)) { say(`Too dear: you must keep £${RULES.minPrice} for every round still to come. The most you can spend now is <b>£${maxSpend(state, 'you')}</b>.`); return; }
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
  for (const who of ['you', 'bot']) {
    $(`d-${who}`).replaceChildren(...Array.from({ length: RULES.rounds }, (_, i) => {
      const c = state.teams[who][i];
      return c ? el('li', { class: `five-slot full ${who}` }, el('span', { class: 'p', text: SHORT[c.pos] }), el('span', { class: 'n', text: c.full }), el('span', { class: 'c', text: `£${state.paid[who][i]}` }))
        : el('li', { class: `five-slot ${who}` }, el('span', { class: 'p' }), el('span', { class: 'n', text: '—' }), el('span', { class: 'c' }));
    }));
  }
}
function renderAll() { renderBoard(); renderTeams(); renderMoney(); }

// ---- the showdown -----------------------------------------------------------------------------------------------------------
const UNIT = { goals: 'goals', assists: 'assists', games: 'appearances', discipline: 'discipline points' };

function goShowdown() {
  result = showdown(state);   // rolls the attribute; the page shows it when you press the button
  show('show');
  $('s-tally').hidden = true;
  $('s-cards').hidden = true;
  $('s-you').replaceChildren(); $('s-bot').replaceChildren();
  $('s-say').textContent = 'Both teams are in. Which attribute is being counted? Nobody knows yet.';
  $('s-actions').replaceChildren(el('button', { class: 'primary', type: 'button', text: 'Roll the attribute', onclick: roll }));
}

// the roll: the wheel cycles through the four attributes and lands on the one in the result
async function roll() {
  const my = token;
  $('s-actions').replaceChildren();
  const say = $('s-say');
  const order = CATEGORY_KEYS.map((k) => CATEGORIES[k].label);
  if (!reduceMotion) for (let i = 0; i < 16; i++) { say.innerHTML = `<span class="rolling">${order[i % 4]}</span>`; await sleep(60 + i * 18); if (my !== token) return; }
  say.innerHTML = `Counting <span class="rolling landed">${CATEGORIES[result.category].label}</span>: the real career totals, added up.`;
  $('d-attr').textContent = CATEGORIES[result.category].short;
  await sleep(700);
  if (my !== token) return;
  $('s-actions').replaceChildren(el('button', { class: 'primary', type: 'button', text: 'Reveal the teams', onclick: reveal }));
}

// what each player cost against what he was: a bargain was priced below his tier, a trap above
function captionFor(who, c) {
  const e = state.log.find((l) => l.who === who && l.id === c.id);
  if (!e) return null;
  const tag = e.price < e.tier ? 'bargain' : e.price > e.tier ? 'trap' : '';
  return el('div', { class: `cap ${tag}`, text: `£${e.price}${tag ? ` · ${tag}` : ''}` });
}

// The Sticker Season card, turned into a Blind Five card: here the REAL career totals are what counts, so each row shows the
// total (not the 1-99 rating), the counted row is highlighted, and the overall plate is hidden.
function playerCard(c, category) {
  const node = renderCard(c, { category });
  CATEGORY_KEYS.forEach((key, i) => {
    const li = node.querySelectorAll('.stats li')[i];
    const total = key === 'discipline' ? c.yellow + 3 * c.red : c[key];
    li.querySelector('i').textContent = n(total);
    li.querySelector('em')?.remove();
    li.dataset.tip = `${n(total)} ${UNIT[key]} in his Premier League career${key === 'discipline' ? ` (${c.yellow} yellow, ${c.red} red)` : ''}`;
  });
  node.querySelector('.rating')?.remove();
  const pos = node.querySelector('.pos');
  if (pos) pos.textContent = c.pos;
  return node;
}

function renderCards() {
  for (const who of ['you', 'bot']) {
    $(`s-${who}`).replaceChildren(...state.teams[who].map((c) => el('div', { class: 'pickable' }, playerCard(c, result.category), captionFor(who, c))));
  }
}

async function reveal() {
  const my = token;
  $('s-actions').replaceChildren();
  const tally = $('s-tally');
  tally.hidden = false;
  const rows = Array.from({ length: RULES.rounds }, (_, i) => {
    const y = result.you.players[i], b = result.bot.players[i];
    const pay = (p) => el('small', { text: `£${p.paid}` });
    return el('tr', { class: 'pending' },
      el('td', { class: 'nm' }, y.card.full, pay(y)), el('td', { class: 'v', text: n(y.value) }),
      el('td', { class: 'pos', text: y.card.pos === b.card.pos ? y.card.pos : `${y.card.pos}/${b.card.pos}` }),
      el('td', { class: 'v r', text: n(b.value) }), el('td', { class: 'nm r' }, b.card.full, pay(b)));
  });
  const totalY = el('td', { class: 'v', text: '0' }), totalB = el('td', { class: 'v r', text: '0' });
  const total = el('tr', { class: 'total' }, el('td', { class: 'nm', text: 'Total' }), totalY, el('td', { class: 'lbl', text: UNIT[result.category].toUpperCase() }), totalB, el('td'));
  tally.replaceChildren(el('table', {},
    el('thead', {}, el('tr', {}, el('th', { colspan: 2, text: 'You' }), el('th'), el('th', { colspan: 2, text: 'The bot' }))),
    el('tbody', {}, ...rows, total)));
  renderCards();
  $('s-cards').hidden = false;
  let y = 0, b = 0;
  for (let i = 0; i < rows.length; i++) {
    await sleep(750);
    if (my !== token) return;
    rows[i].classList.remove('pending');
    rows[i].classList.add('hit');
    y += result.you.players[i].value; b += result.bot.players[i].value;
    totalY.textContent = n(y); totalB.textContent = n(b);
  }
  await sleep(500);
  if (my !== token) return;
  const won = result.winner === 'you', draw = result.winner === 'draw';
  total.classList.add(draw ? 'draw' : `win-${result.winner}`);
  const margin = Math.abs(result.you.total - result.bot.total);
  $('s-say').innerHTML = draw ? '<b>A draw.</b> Exactly level.'
    : `<span class="verdict ${won ? 'won' : 'lost'}">${won ? 'You win' : 'The bot wins'}</span> by ${n(margin)} ${UNIT[result.category]}. Match code: ${esc(state.seed)}.`;
  remember(level, won ? 'w' : draw ? 'd' : 'l');
  $('s-actions').replaceChildren(
    el('button', { class: 'primary', type: 'button', text: 'Play again', onclick: () => startMatch('') }),
    el('button', { class: 'ghost', type: 'button', text: 'Change opponent', onclick: showTitle }));
}

// ---- the manual ------------------------------------------------------------------------------------------------------------------------
function buildManual() {
  $('m-body').innerHTML = `
    <h2 id="m-h">How to play</h2>
    <p><b>The aim.</b> Build a five-a-side team with a higher total than the bot's, knowing nothing about the players but their names and prices.</p>
    <ol>
      <li><b>Pick your team.</b> You and the bot each have <b>£${RULES.budget}</b> for the whole team. Each of <b>${RULES.rounds} rounds</b> the wheel names a position: goalkeepers, defenders, midfielders or forwards. Eight players of that position go on the board with a <b>name and a price</b> of £1 to £5. You and the bot take turns to pick <b>one</b> each; who picks first swaps every round. Once a player is taken he is gone, and you see what the bot takes as it takes it. You must keep <b>£${RULES.minPrice} for every round still to come</b>, so you can never be locked out.</li>
      <li><b>Roll which attribute</b> is being counted: <b>goals, assists, appearances or discipline</b> (a yellow card is 1 point, a red card is 3). It is rolled <b>after</b> the draft, so you pick without knowing.</li>
      <li><b>Add it up.</b> The teams are revealed and each player's <b>real Premier League career total</b> (1992/93 to 2025/26) in the attribute is added up. The biggest total wins.</li>
    </ol>
    <h3>Prices are a hint, not the truth</h3>
    <p>A £5 is usually a star of his position and a £1 a squad man, but about one player in three in the middle prices is a <b>bargain</b> (cheaper than he is) or a <b>trap</b> (dearer). Prices are by position: the best goalkeeper in the league is a £5 goalkeeper, but he will score no goals. Everyone on a board has made at least 100 Premier League appearances.</p>
    <h3>Tips</h3>
    <ul>
      <li>You do not know the attribute, so buy a team that can win more than one: forwards for goals, midfielders for assists and long-serving players of any position for appearances. Or gamble on one.</li>
      <li>A goalkeeper is the cheapest place to save: he will score no goals and make almost no assists, but a long-serving keeper has plenty of appearances.</li>
      <li>Money left at the end is wasted. Spend it, but not on the wrong name.</li>
      <li>A career total rewards a long career: someone who played 15 years beats a brilliant two-season wonder.</li>
    </ul>`;
}

// ---- boot -----------------------------------------------------------------------------------------------------------------------------
function wire() {
  $('t-new').addEventListener('click', () => startMatch($('t-seed').value.trim()));
  $('t-help').addEventListener('click', () => $('manual').showModal?.());
  $('d-quit').addEventListener('click', showTitle);
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
