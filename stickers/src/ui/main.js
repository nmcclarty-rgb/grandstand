// The tabletop: deal a squad, pick up to five cards, see the hand and the arithmetic.
import { makePool, starterDeck, openPack } from '../engine/deck.js';
import { makeRng } from '../engine/rng.js';
import { startRound, playHand, discard, fixtureTarget, FIXTURE_KINDS, STAGE_BASE } from '../engine/round.js';
import { scoreHand } from '../engine/scoring.js';
import { CATEGORIES, CATEGORY_KEYS } from '../engine/cards.js';
import { JOKERS, JOKER_IDS } from '../engine/jokers.js';
import { HANDS } from '../engine/hands.js';
import { renderCard } from './card.js';

const $ = (id) => document.getElementById(id);
const MAX_MANAGERS = 5;
const params = new URLSearchParams(location.search);

let pool, round, rng;
let seed = Number(params.get('seed')) || 1;
let fixture = 0;
let categoryChoice = params.get('category') || 'goals';
let selected = [];
const managers = new Set((params.get('managers') || '').split(',').filter((id) => JOKERS[id]));
let packCount = 0;

const sorted = () => [...selected].sort((a, b) => a - b);
const n = (x) => x.toLocaleString('en-GB');

function ctx() {
  return {
    category: round.category, scale: round.scale, jokers: round.jokers, handLevels: round.handLevels,
    state: { handsLeft: round.handsLeft, discardsLeft: round.discardsLeft },
  };
}

function newDeal() {
  rng = makeRng(`table:${seed}`);
  const run = { deck: starterDeck(pool, rng), jokers: [...managers], handLevels: {}, scale: pool.scale };
  const category = categoryChoice === 'random' ? rng.pick(CATEGORY_KEYS) : categoryChoice;
  round = startRound(run, { target: fixtureTarget(Math.floor(fixture / 3), fixture % 3), category, rng });
  selected = [];
  render();
}

function toggle(i) {
  if (round.status !== 'playing' || i >= round.hand.length) return;
  const at = selected.indexOf(i);
  if (at > -1) selected.splice(at, 1);
  else if (selected.length < 5) selected.push(i);
  render();
}

function renderMeter() {
  const pct = Math.min(100, (100 * round.score) / round.target);
  $('score').innerHTML = `${n(round.score)}<small>of ${n(round.target)}</small>`;
  $('fill').style.width = `${pct}%`;
  $('hands').textContent = `${round.handsLeft} hands`;
  $('discards').textContent = `${round.discardsLeft} discards`;
  $('deckleft').textContent = `${round.drawPile.length} in deck`;
  $('cat').textContent = CATEGORIES[round.category].label;
  const st = $('status');
  st.className = `status ${round.status}`;
  st.textContent = round.status === 'won' ? `Full time: through, with ${round.handsLeft} hands to spare.`
    : round.status === 'lost' ? `Full time: out. ${n(round.target - round.score)} short.` : '';
}

function renderHand(preview) {
  const hand = $('hand');
  hand.replaceChildren();
  const scoring = new Set(preview ? preview.scoring.map((k) => sorted()[k]) : []);
  round.hand.forEach((card, i) => {
    const isSel = selected.includes(i);
    const state = preview && isSel ? (scoring.has(i) ? 'scoring' : 'kicker') : null;
    const el = renderCard(card, { category: round.category, scale: round.scale, selected: isSel, state });
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-pressed', String(isSel));
    el.setAttribute('aria-label', `${card.name}, ${card.club} ${card.season}, ${card.pos}. Press to ${isSel ? 'drop' : 'pick'}.`);
    el.addEventListener('click', () => toggle(i));
    el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggle(i); } });
    hand.append(el);
  });
}

function renderLive() {
  const live = $('live');
  const idx = sorted();
  const playing = round.status === 'playing';
  $('play').disabled = !playing || !idx.length;
  $('discard').disabled = !playing || !idx.length || round.discardsLeft === 0;
  if (!idx.length) {
    live.querySelector('.detail').innerHTML = `<p class="empty">${playing ? 'Pick up to five cards (tap them, or press 1-8).' : 'Deal again to keep playing.'}</p>`;
    return null;
  }
  const r = scoreHand(idx.map((i) => round.hand[i]), ctx());
  const rows = r.trace.map((t, k) => {
    const bits = [];
    if (t.chips !== undefined) bits.push(`<span class="add">${k === 0 ? '' : '+'}${t.chips}</span>`);
    if (t.mult !== undefined) bits.push(`<span class="add">${k === 0 ? '×' : '+'}${t.mult}</span>`);
    if (t.xmult !== undefined) bits.push(`<span class="xm">×${t.xmult}</span>`);
    return `<tr><td>${t.src.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td><td>${bits.join(' ')}</td><td>${n(t.runChips)} × ${+t.runMult.toFixed(2)}</td></tr>`;
  }).join('');
  live.querySelector('.detail').innerHTML = `
    <h3>${HANDS[r.type].name}</h3>
    <div class="blurb">${HANDS[r.type].blurb}. ${r.scoring.length} of ${idx.length} card${idx.length > 1 ? 's' : ''} score.</div>
    <div class="total">${n(r.total)} <small>= ${n(r.chips)} chips × ${+r.mult.toFixed(2)} mult</small></div>
    <table class="trace"><tbody>${rows}</tbody></table>`;
  return r;
}

function render() {
  renderMeter();
  const preview = renderLive();
  renderHand(preview);
}

function doPlay() {
  const idx = sorted();
  if (!idx.length || round.status !== 'playing') return;
  playHand(round, idx);
  selected = [];
  render();
}
function doDiscard() {
  const idx = sorted();
  if (!idx.length || round.status !== 'playing' || round.discardsLeft === 0) return;
  discard(round, idx);
  selected = [];
  render();
}

function renderManagers() {
  const box = $('mgrs');
  box.replaceChildren();
  for (const id of JOKER_IDS) {
    const b = document.createElement('button');
    b.className = 'mgr';
    b.type = 'button';
    b.setAttribute('aria-pressed', String(managers.has(id)));
    b.innerHTML = `${JOKERS[id].name}<small>${JOKERS[id].blurb}</small>`;
    b.addEventListener('click', () => {
      if (managers.has(id)) managers.delete(id);
      else if (managers.size < MAX_MANAGERS) managers.add(id);
      round.jokers = [...managers];
      renderManagers();
      render();
    });
    box.append(b);
  }
  $('mgrcount').textContent = `${managers.size} / ${MAX_MANAGERS}`;
}

function showPack() {
  const prng = makeRng(`pack:${seed}:${packCount++}`);
  const g = $('pack');
  g.replaceChildren(...openPack(pool, prng).map((c) => renderCard(c)));
}

function showEditions() {
  const star = pool.cards.find((c) => c.name === 'Salah' && c.season === '2017-18') ?? pool.cards[0];
  $('editions').replaceChildren(...['base', 'shiny', 'holo', 'gold'].map((e) => renderCard({ ...star, edition: e }, { category: 'goals', scale: pool.scale })));
}

async function init() {
  const res = await fetch(new URL('../data/cards.json', import.meta.url));
  pool = makePool(await res.json());

  const cat = $('category');
  cat.innerHTML = CATEGORY_KEYS.map((k) => `<option value="${k}">${CATEGORIES[k].label}</option>`).join('') + '<option value="random">Random</option>';
  cat.value = categoryChoice;
  cat.addEventListener('change', () => { categoryChoice = cat.value; newDeal(); });

  const fx = $('fixture');
  fx.innerHTML = Array.from({ length: STAGE_BASE.length * 3 }, (_, i) => {
    const s = Math.floor(i / 3), k = i % 3;
    return `<option value="${i}">${s + 1}.${k + 1} ${FIXTURE_KINDS[k].name}: ${n(fixtureTarget(s, k))}</option>`;
  }).join('');
  fx.addEventListener('change', () => { fixture = Number(fx.value); newDeal(); });

  $('seed').value = seed;
  $('seed').addEventListener('change', (e) => { seed = Number(e.target.value) || 1; newDeal(); });
  $('deal').addEventListener('click', () => { seed++; $('seed').value = seed; newDeal(); });
  $('play').addEventListener('click', doPlay);
  $('discard').addEventListener('click', doDiscard);
  $('openpack').addEventListener('click', showPack);
  $('clear').addEventListener('click', () => { selected = []; render(); });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('select, input, textarea')) return;
    if (e.key >= '1' && e.key <= '8') toggle(Number(e.key) - 1);
    else if (e.key === 'Enter' && !e.target.closest('button')) doPlay();
    else if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey) doDiscard();
    else if (e.key === 'Escape') { selected = []; render(); }
  });

  renderManagers();
  showEditions();
  showPack();
  newDeal();
  document.body.dataset.ready = 'true';
}

init().catch((err) => {
  document.body.dataset.ready = 'error';
  $('status').className = 'status lost';
  $('status').textContent = `Couldn't load the cards (${err.message}). Serve this folder over http, e.g. npm start.`;
});
