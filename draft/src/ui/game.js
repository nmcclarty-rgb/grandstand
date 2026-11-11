// The Blind Five page. All the rules live in the engine (draft.js, bot.js); this file draws screens and calls it.
import { makePool } from '../../../stickers/src/engine/deck.js';
import { CATEGORIES, firstNameOf, surnameOf } from '../../../stickers/src/engine/cards.js';
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

let pool, state, result, level = 'medium', busy = false, token = 0, shownMatches = 0;
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
function goShowdown() {
  result = showdown(state);
  shownMatches = 0;
  show('show');
  $('s-panel').hidden = true;
  $('s-say').textContent = 'Both teams are in. Here is who you really bought.';
  renderCards(null);
  setActions();
}

// what each player cost against what he was: a bargain was priced below his tier, a trap above
function captionFor(who, c) {
  const e = state.log.find((l) => l.who === who && l.id === c.id);
  if (!e) return null;
  const tag = e.price < e.tier ? 'bargain' : e.price > e.tier ? 'trap' : '';
  return el('div', { class: `cap ${tag}`, text: `£${e.price}${tag ? ` · ${tag}` : ''}` });
}

function renderCards(m) {
  for (const who of ['you', 'bot']) {
    const scoring = m ? new Set(m[who].scoring) : null;
    $(`s-${who}`).replaceChildren(...state.teams[who].map((c, i) => el('div', { class: 'pickable' },
      renderCard(c, { category: m?.category, scale: pool.scale, state: scoring ? (scoring.has(i) ? 'scoring' : 'kicker') : null }),
      captionFor(who, c))));
  }
}

function setActions() {
  const box = $('s-actions');
  if (shownMatches < RULES.matches) {
    box.replaceChildren(el('button', { class: 'primary', type: 'button', text: shownMatches === 0 ? `Match 1 of ${RULES.matches}` : `Match ${shownMatches + 1} of ${RULES.matches}`, onclick: playMatch }));
  } else {
    box.replaceChildren(
      el('button', { class: 'primary', type: 'button', text: 'Play again', onclick: () => startMatch('') }),
      el('button', { class: 'ghost', type: 'button', text: 'Change opponent', onclick: showTitle }));
  }
}

function countUp(node, to) {
  if (reduceMotion || to < 40) { node.textContent = n(to); return; }
  const t0 = performance.now(), dur = 900;
  const tick = (t) => { const k = Math.min(1, (t - t0) / dur); node.textContent = n(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

function side(who, m, label) {
  const r = m[who];
  const box = el('div', { class: `side${m.winner === who ? ' win' : ''}` },
    el('div', { class: 'who', text: label }),
    el('div', { class: 'hname', text: r.handName }),
    el('div', { class: 'tot', text: '0' }),
    el('div', { class: 'sum', text: `${n(r.chips)} chips × ${r.mult} mult` }));
  countUp(box.querySelector('.tot'), r.total);
  return box;
}

function playMatch() {
  const m = result.matches[shownMatches];
  shownMatches++;
  renderCards(m);
  const panel = $('s-panel');
  panel.hidden = false;
  const played = result.matches.slice(0, shownMatches);
  const chip = (x) => el('span', { class: x.winner === 'you' ? 'w' : x.winner === 'bot' ? 'l' : 'd', text: `${CATEGORIES[x.category].short}: ${x.winner === 'you' ? 'won' : x.winner === 'bot' ? 'lost' : 'drawn'} ${n(x.you.total)}–${n(x.bot.total)}` });
  const kids = [
    el('h3', { text: `Match ${shownMatches}: ${CATEGORIES[m.category].label}` }),
    el('p', { class: 'fine', text: CATEGORIES[m.category].blurb }),
    el('div', { class: 'vs' }, side('you', m, 'You'), el('div', { class: 'mid', text: 'vs' }), side('bot', m, 'The bot')),
    el('div', { class: 'series' }, played.map(chip)),
  ];
  if (shownMatches === RULES.matches) {
    const won = result.winner === 'you', draw = result.winner === 'draw';
    const score = `${result.wins.you}–${result.wins.bot}`;
    kids.push(el('div', { class: `verdict ${won ? 'won' : draw ? '' : 'lost'}`, text: draw ? 'A draw' : won ? 'You win' : 'The bot wins' }));
    kids.push(el('p', { class: 'fine', text: `${draw ? 'Level on everything' : `Series ${score}${result.decidedBy === 'total score' ? ', level on matches, decided on total score' : ''}`}. Match code: ${state.seed}.` }));
    remember(level, won ? 'w' : draw ? 'd' : 'l');
    $('s-say').textContent = won ? 'Good scouting.' : draw ? 'Honours even.' : 'Back to the scouting report.';
  } else {
    $('s-say').textContent = '';
  }
  panel.replaceChildren(...kids);
  setActions();
}

// ---- the manual ------------------------------------------------------------------------------------------------------------------------
function buildManual() {
  $('m-body').innerHTML = `
    <h2 id="m-h">How to play</h2>
    <p><b>The aim.</b> Build the better five-a-side team without going over budget, knowing nothing but names and prices.</p>
    <h3>The draft</h3>
    <ol>
      <li>You and the bot each have <b>£${RULES.budget}</b> for the whole team.</li>
      <li>Each of <b>${RULES.rounds} rounds</b>, the wheel names a position: goalkeepers, defenders, midfielders or forwards. Eight players of that position go on the board with a <b>name and a price</b> of £1 to £5.</li>
      <li>You and the bot take turns to pick <b>one</b> each. Who picks first swaps every round. Once a player is taken he is gone, and you see what the bot takes as it takes it.</li>
      <li>You must keep <b>£${RULES.minPrice} for every round still to come</b>, so you can never be locked out.</li>
    </ol>
    <h3>Prices are a hint, not the truth</h3>
    <p>A £5 is usually a star of his position and a £1 a squad man, but about one player in three in the middle prices is a <b>bargain</b> (cheaper than he is) or a <b>trap</b> (dearer). Prices are by position: the best goalkeeper in the league is a £5 goalkeeper, but goalkeepers score very little in three of the four categories. Everyone on a board has made at least 100 Premier League appearances since 1992/93.</p>
    <h3>The showdown</h3>
    <p>The teams are revealed. Three different categories are drawn: <b>goals, assists, appearances or discipline</b> (a yellow card is 1 point, a red card is 3). Each is a match. A team is scored like a hand in Sticker Season: each player is worth chips in the category (his rating out of 99), and players who were <b>team-mates</b> (at the same club in the same season at any point) make a hand with a multiplier: a pair, a trio, a Back Four, an Invincibles. A team with a goalkeeper, a defender, a midfielder and a forward is a <b>Spine</b>. Most matches wins the series; if level, the higher total score.</p>
    <h3>Tips</h3>
    <ul>
      <li>You do not know which categories will come up. A forward wins goals, a midfielder assists, a long-serving defender appearances, a hard man discipline. Spread your bets, or guess.</li>
      <li>Money left at the end is wasted. Spend it, but not on the wrong name.</li>
      <li>A goalkeeper is the cheapest place to save: he scores almost nothing for goals and assists.</li>
      <li>Players who were at the same club at the same time score more together. Think who played with whom.</li>
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
