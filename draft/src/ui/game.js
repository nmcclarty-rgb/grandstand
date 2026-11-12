// The Blind Five page. All the rules live in the engine (draft.js, bot.js); this file draws screens and calls it.
import { makePool } from '../../../stickers/src/engine/deck.js';
import { CATEGORIES, CATEGORY_KEYS, firstNameOf, surnameOf } from '../../../stickers/src/engine/cards.js';
import { renderCard } from '../../../stickers/src/ui/card.js';
import { initTooltips } from '../../../stickers/src/ui/tooltip.js';
import { COMMON, MODES, newMatch, pick, positionOf, canAfford, maxSpend, showdown, rulesOf } from '../engine/draft.js';
import { botMove } from '../engine/bot.js';

const $ = (id) => document.getElementById(id);
const n = (x) => x.toLocaleString('en-GB');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LABEL = { GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' };
const ONE = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
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
function remember(key, outcome) {
  try { const r = recall(); if (!r[key]) r[key] = { w: 0, l: 0, d: 0 }; r[key][outcome]++; localStorage.setItem(RECORD, JSON.stringify(r)); } catch { /* private window */ }
}

let pool, state, result, level = 'medium', mode = 'five', reveal = 'before', busy = false, token = 0, played = 0;
const rules = () => rulesOf(state);
const recordKey = () => `${mode}-${level}`;
const shortList = (cats) => cats.map((k) => CATEGORIES[k].short).join(' · ');
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

function startMatch(seed) {
  level = document.querySelector('input[name=level]:checked').value;
  mode = document.querySelector('input[name=mode]:checked').value;
  reveal = document.querySelector('input[name=reveal]:checked').value;
  state = newMatch(pool, seed || Date.now(), { level, mode, reveal });
  document.body.dataset.mode = mode;
  result = null;
  const my = ++token;
  show('draft');
  $('d-attr').textContent = state.categories ? shortList(state.categories) : '???';
  $('d-rounds').textContent = `/${rules().rounds}`;
  $('d-formation').hidden = mode !== 'eleven';
  $('d-poslabel').textContent = mode === 'eleven' ? 'Now drafting' : 'The wheel says';
  $('d-formation-name').textContent = '…';
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
const UNIT = { goals: 'goals', assists: 'assists', games: 'appearances', discipline: 'discipline points' };

// The showdown is a best of three. Each attribute is a match; the series stops as soon as one side has two.
function goShowdown() {
  result = showdown(state);   // all three matches are worked out; the page plays them one at a time
  played = 0;
  show('show');
  $('s-tally').hidden = true;
  $('s-cards').hidden = true;
  $('s-you').replaceChildren(); $('s-bot').replaceChildren();
  renderSeries(reveal === 'after' ? null : result.categories);   // rolled after: the pills say ??? until the roll
  if (reveal === 'after') {
    $('s-say').textContent = 'Both teams are in. Which three attributes are being counted? Nobody knows yet.';
    $('s-actions').replaceChildren(el('button', { class: 'primary', type: 'button', text: 'Roll the attributes', onclick: roll }));
  } else {
    $('s-say').textContent = `Both teams are in. ${shortList(result.categories)}: best of three.`;
    $('s-actions').replaceChildren(el('button', { class: 'primary', type: 'button', text: 'Reveal the teams', onclick: revealTeams }));
  }
}

// the three matches as pills: the attribute (or ???) and, once played, who won it
function renderSeries(cats) {
  $('s-series').replaceChildren(...Array.from({ length: 3 }, (_, i) => {
    const m = result.matches[i];
    const done = i < played;
    const cls = done ? (m.winner === 'you' ? 'w' : m.winner === 'bot' ? 'l' : 'd') : (i === played && cats ? 'next' : '');
    return el('div', { class: `pill ${cls}`, id: `s-pill-${i}` },
      el('small', { text: `Match ${i + 1}` }),
      el('b', { text: cats ? CATEGORIES[cats[i]].short : '???' }),
      done ? el('span', { text: `${n(m.you.total)}–${n(m.bot.total)}` }) : null);
  }));
}

// the roll ('after' mode): the pills cycle through the attributes and land one at a time on the three that were drawn
async function roll() {
  const my = token;
  $('s-actions').replaceChildren();
  const labels = CATEGORY_KEYS.map((k) => CATEGORIES[k].short);
  for (let i = 0; i < 3; i++) {
    const b = $(`s-pill-${i}`).querySelector('b');
    if (!reduceMotion) for (let k = 0; k < 12; k++) { b.textContent = labels[(k + i) % 4]; await sleep(55 + k * 14); if (my !== token) return; }
    b.textContent = CATEGORIES[result.categories[i]].short;
    $(`s-pill-${i}`).classList.add('landed');
    await sleep(350);
    if (my !== token) return;
  }
  $('d-attr').textContent = shortList(result.categories);
  renderSeries(result.categories);
  $('s-say').textContent = `Counting ${shortList(result.categories)}, best of three.`;
  $('s-actions').replaceChildren(el('button', { class: 'primary', type: 'button', text: 'Reveal the teams', onclick: revealTeams }));
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

function renderCards(category) {
  for (const who of ['you', 'bot']) {
    $(`s-${who}`).replaceChildren(...state.teams[who].map((c) => el('div', { class: 'pickable' }, playerCard(c, category), captionFor(who, c))));
  }
}

function revealTeams() {
  renderCards(null);
  $('s-cards').hidden = false;
  $('s-say').textContent = 'Here is who you really bought.';
  nextMatchButton();
}

function nextMatchButton() {
  $('s-actions').replaceChildren(el('button', { class: 'primary', type: 'button', text: `Play match ${played + 1}: ${CATEGORIES[result.categories[played]].short}`, onclick: playMatch }));
}

// one match: count each player's real total in this attribute, row by row, with running totals
async function playMatch() {
  const my = token;
  const m = result.matches[played];
  $('s-actions').replaceChildren();
  $('s-say').textContent = `Match ${played + 1}: ${CATEGORIES[m.category].label}. The real career totals, added up.`;
  const tally = $('s-tally');
  tally.hidden = false;
  renderCards(m.category);
  const rows = Array.from({ length: rules().rounds }, (_, i) => {
    const y = m.you.players[i], b = m.bot.players[i];
    const pay = (p) => el('small', { text: `£${p.paid}` });
    return el('div', { class: 'trow pending' },
      el('div', { class: 'nm' }, y.card.full, pay(y)), el('div', { class: 'v', text: n(y.value) }),
      el('div', { class: 'tpos', text: y.card.pos === b.card.pos ? y.card.pos : `${y.card.pos}/${b.card.pos}` }),
      el('div', { class: 'v r', text: n(b.value) }), el('div', { class: 'nm r' }, b.card.full, pay(b)));
  });
  const totalY = el('div', { class: 'v', text: '0' }), totalB = el('div', { class: 'v r', text: '0' });
  const total = el('div', { class: 'trow total' }, el('div', { class: 'nm', text: 'Total' }), totalY, el('div', { class: 'lbl', text: UNIT[m.category].toUpperCase() }), totalB, el('div', { class: 'nm r' }));
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
  played++;
  renderSeries(result.categories);
  const w = { you: 0, bot: 0 };
  for (const x of result.matches.slice(0, played)) if (x.winner !== 'draw') w[x.winner]++;
  const decided = w.you === 2 || w.bot === 2 || played === 3;
  const margin = Math.abs(m.you.total - m.bot.total);
  const line = m.winner === 'draw' ? 'Exactly level.' : `${m.winner === 'you' ? 'You win' : 'The bot wins'} match ${played} by ${n(margin)} ${UNIT[m.category]}.`;
  if (!decided) {
    $('s-say').textContent = `${line} It is ${w.you}–${w.bot}.`;
    nextMatchButton();
    return;
  }
  // the series is over: the full result counts all matches played, and the one the engine reported is for all three, so work it out from those played
  const final = seriesResult(played);
  const won = final === 'you', draw = final === 'draw';
  $('s-say').innerHTML = `<span class="verdict ${won ? 'won' : draw ? '' : 'lost'}">${draw ? 'A draw' : won ? 'You win' : 'The bot wins'}</span> ${draw ? 'Level on everything.' : `the series ${Math.max(w.you, w.bot)}–${Math.min(w.you, w.bot)}.`} ${esc(line)} Match code: ${esc(state.seed)}.`;
  remember(recordKey(), won ? 'w' : draw ? 'd' : 'l');
  $('s-actions').replaceChildren(
    el('button', { class: 'primary', type: 'button', text: 'Play again', onclick: () => startMatch('') }),
    el('button', { class: 'ghost', type: 'button', text: 'Change opponent', onclick: showTitle }));
}

// who won the series after `count` matches (the series stops as soon as one side has two, so this is the engine's winner unless it was decided early)
function seriesResult(count) {
  const ms = result.matches.slice(0, count);
  const w = { you: ms.filter((x) => x.winner === 'you').length, bot: ms.filter((x) => x.winner === 'bot').length };
  if (w.you !== w.bot) return w.you > w.bot ? 'you' : 'bot';
  return result.winner;
}

// ---- the manual ------------------------------------------------------------------------------------------------------------------------
function buildManual() {
  const five = MODES.five, eleven = MODES.eleven;
  $('m-body').innerHTML = `
    <h2 id="m-h">How to play</h2>
    <p><b>The aim.</b> Build a team that wins two of three matches against the bot's, knowing nothing about the players but their names and prices.</p>
    <ol>
      <li><b>Pick your team.</b> You and the bot each have a budget for the whole team: <b>£${five.budget}</b> in 5-a-side, <b>£${eleven.budget}</b> in 11-a-side. Each round a board of eight players of one position goes up with <b>a name and a price</b> of £1 to £5. You and the bot take turns to pick <b>one</b> each; who picks first swaps every round. Once a player is taken he is gone, and you see what the bot takes as it takes it. You must keep <b>£${COMMON.minPrice} for every round still to come</b>, so you can never be locked out.
        <ul>
          <li><b>5-a-side</b>: ${five.rounds} rounds. A wheel names the position each round (never one position three times).</li>
          <li><b>11-a-side</b>: ${eleven.rounds} rounds. A <b>formation</b> (4-4-2, 4-3-3, 4-5-1, 3-5-2, 3-4-3 or 5-3-2) is rolled at the start and both teams play it. You work through it from the goalkeeper to the forwards, so you decide early how much of the money goes into defence and how much is kept for attack.</li>
        </ul></li>
      <li><b>Best of three.</b> Three different attributes are drawn from <b>goals, assists, appearances and discipline</b> (a yellow card is 1 point, a red card is 3). Depending on the game you pick on the title screen, they are <b>called out in advance</b>, so you buy knowing what is coming, or <b>rolled after the draft</b>, so you buy blind.</li>
      <li><b>Three matches.</b> The teams are revealed. For each attribute, each player's <b>real Premier League career total</b> (1992/93 to 2025/26) is added up, and the bigger total wins the match. First to two matches wins; if you are level, the larger share of the all-time records wins.</li>
    </ol>
    <h3>Prices are a hint, not the truth</h3>
    <p>A £5 is usually a star of his position and a £1 a squad man, but about one player in three in the middle prices is a <b>bargain</b> (cheaper than he is) or a <b>trap</b> (dearer). Prices are by position: the best goalkeeper in the league is a £5 goalkeeper, but he will score no goals. Everyone on a board has made at least ${COMMON.minGames} Premier League appearances.</p>
    <h3>Tips</h3>
    <ul>
      <li>You need to win two matches out of three, so buy a team that is good at more than one attribute: forwards for goals, midfielders for assists, and long-serving players of any position for appearances. A long-serving defender can win you appearances and discipline; a striker only goals.</li>
      <li>In 11-a-side every position is a slot: a team of eleven stars is impossible. Spend where the totals are, and find bargains everywhere else.</li>
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
  const m = params.get('mode'); if (m && MODES[m]) document.querySelector(`input[name=mode][value=${m}]`).checked = true;
  const rv = params.get('reveal'); if (rv === 'before' || rv === 'after') document.querySelector(`input[name=reveal][value=${rv}]`).checked = true;
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
