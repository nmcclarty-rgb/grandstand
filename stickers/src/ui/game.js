// The game: title -> matchday intro (the wheel) -> fixture -> result -> shop -> ... -> champions or sacked.
// All the rules live in the engine (season.js, round.js). This file only draws screens and calls it.
import { makePool } from '../engine/deck.js';
import { CATEGORIES, CATEGORY_KEYS, EDITIONS, cardChips, safeHands } from '../engine/cards.js';
import { HANDS, HAND_ORDER } from '../engine/hands.js';
import { upgradedEdition } from '../engine/deck.js';
import { JOKERS } from '../engine/jokers.js';
import { playHand, discard, SEASON_LENGTH, VAR_PER_SEASON } from '../engine/round.js';
import { scoreHand } from '../engine/scoring.js';
import { bestPlay } from '../engine/advisor.js';
import {
  ECONOMY, PACKS, newSeason, restore, serialize, useVar, kickOff, finishMatchday, nextMatchday, buy, takePack, rerollShop,
  rerollCost, priceOf, sellManager, sellValue, releaseCard, trainingPrice, ownedCopy,
} from '../engine/season.js';
import { renderCard } from './card.js';
import { initTooltips } from './tooltip.js';

const $ = (id) => document.getElementById(id);
const n = (x) => x.toLocaleString('en-GB');
const money = (x) => `£${x}`;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// a small DOM builder: el('button', { class: 'x', onclick: fn, text: 'Go' }, child, child)
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid);
  return e;
}

// ---- saving -----------------------------------------------------------------------------------------------------
const SAVE = 'sticker-season:save:v2';
const BEST = 'sticker-season:best:v1';
function stash(key, value) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window: play without saving */ }
}
function recall(key) {
  try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch { return null; }
}

// ---- state ---------------------------------------------------------------------------------------------------------
let pool, run;
let selected = [];
let resultShown = false;
let reeling = null;

const round = () => run.fixture.round;
const sorted = () => [...selected].sort((a, b) => a - b);
const save = () => { if (run && run.status === 'playing') stash(SAVE, serialize(run)); };
const params = new URLSearchParams(location.search);

const SCREENS = ['title', 'intro', 'play', 'shop', 'over'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  document.body.dataset.screen = id;
  $('hud').hidden = id === 'title';
  renderHud();
  const h = $(id).querySelector('h1, h2');
  if (h) h.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

// ---- the HUD ---------------------------------------------------------------------------------------------------------
function renderHud() {
  if (!run) return;
  $('h-md').textContent = Math.min(run.matchday, SEASON_LENGTH);
  $('h-money').textContent = money(run.money);
  $('h-var').textContent = run.varLeft;
  $('h-squad').textContent = run.deck.length;
  const slots = $('h-mgrs');
  slots.replaceChildren(...Array.from({ length: ECONOMY.managerSlots }, (_, i) => {
    const id = run.jokers[i];
    return id ? el('li', { class: 'slot full', title: JOKERS[id].blurb }, el('b', { text: JOKERS[id].name }), el('small', { text: JOKERS[id].blurb }))
      : el('li', { class: 'slot', text: 'Empty manager slot' });
  }));
}

// ---- title -----------------------------------------------------------------------------------------------------------
function showTitle() {
  const saved = recall(SAVE);
  $('t-continue').hidden = !saved;
  if (saved) $('t-continue').textContent = `Continue: matchday ${saved.matchday}, ${money(saved.money)}`;
  const best = recall(BEST);
  $('t-best').textContent = best ? (best.won ? `Best: champions (all ${SEASON_LENGTH} matchdays).` : `Best season: ${best.cleared} of ${SEASON_LENGTH} matchdays cleared.`) : '';
  clearInterval(reeling); // a reel still spinning must not outlive the season it belongs to
  run = null;
  show('title');
}

function startSeason(seed) {
  run = newSeason(pool, seed || Date.now());
  stash(SAVE, null);
  save();
  enter();
}

function continueSeason() {
  try {
    run = restore(pool, recall(SAVE));
    enter();
  } catch (err) {
    stash(SAVE, null);
    $('t-continue').hidden = true;
    $('t-status').textContent = `That saved season could not be loaded (${err.message}). Start a new one.`;
  }
}

function enter() {
  if (run.phase === 'intro') showIntro();
  else if (run.phase === 'shop') showShop();
  else showOver();
}

// ---- matchday intro: the wheel -----------------------------------------------------------------------------------------
const strength = (cat) => run.deck.map((c) => cardChips(c, cat, run.scale)).sort((a, b) => b - a).slice(0, 8).reduce((a, b) => a + b, 0);

function buildWheel() {
  $('wheel').replaceChildren(...CATEGORY_KEYS.map((k) => el('div', { class: 'slice', 'data-cat': k, text: CATEGORIES[k].label })));
}

function showIntro() {
  const f = run.fixture;
  $('i-md').textContent = f.matchday;
  $('i-target').textContent = n(f.target);
  renderStrength();
  show('intro');
  reel(f.category);
}

function renderStrength() {
  const f = run.fixture;
  const values = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, strength(k)]));
  const top = Math.max(...Object.values(values), 1);
  $('i-strength').replaceChildren(
    el('p', { class: 'sub', text: 'Your best eight stickers, chips per stat' }),
    ...CATEGORY_KEYS.map((k) => el('div', { class: `bar${k === f.category ? ' now' : ''}`, 'data-cat': k },
      el('span', { text: CATEGORIES[k].short }),
      el('div', { class: 'meterbar' }, el('div', { style: `width:${Math.round((100 * values[k]) / top)}%` })),
      el('b', { text: n(values[k]) }))),
  );
}

// A short reel before the wheel settles. Purely cosmetic: the result is already decided by the engine.
function reel(final) {
  clearInterval(reeling);
  const slices = [...$('wheel').children];
  const land = () => {
    if (!run || document.body.dataset.screen !== 'intro') return;
    slices.forEach((s) => { s.classList.remove('lit'); s.classList.toggle('landed', s.dataset.cat === final); });
    $('i-cat').textContent = CATEGORIES[final].label;
    $('i-blurb').textContent = CATEGORIES[final].blurb;
    $('i-kick').disabled = false;
    $('i-var').disabled = run.varLeft === 0;
    $('i-var').textContent = `VAR (${run.varLeft} left)`;
    renderStrength();
    renderHud();
  };
  $('i-kick').disabled = true;
  $('i-var').disabled = true;
  slices.forEach((s) => s.classList.remove('landed'));
  if (reduceMotion) return land();
  $('i-cat').textContent = '…';
  $('i-blurb').textContent = '';
  const steps = 13 + CATEGORY_KEYS.indexOf(final); // the last lit slice is the result
  let i = 0;
  reeling = setInterval(() => {
    slices.forEach((s, k) => s.classList.toggle('lit', k === i % slices.length));
    i++;
    if (i >= steps) { clearInterval(reeling); land(); }
  }, 75);
}

function doVar() {
  if (run.phase !== 'intro' || run.varLeft === 0) return;
  const cat = useVar(run);
  save();
  reel(cat);
}

function doKickOff() {
  kickOff(run);
  selected = [];
  resultShown = false;
  $('result').hidden = true;
  show('play');
  renderPlay();
}

// ---- the fixture -------------------------------------------------------------------------------------------------------
function ctx(held) {
  const r = round();
  return {
    category: r.category, scale: r.scale, jokers: r.jokers, handLevels: r.handLevels, held,
    state: { handsLeft: r.handsLeft, discardsLeft: r.discardsLeft },
  };
}

function say(text, kind = '') {
  const s = $('status');
  s.className = `status ${kind}`;
  s.textContent = text;
}

function renderMeter() {
  const r = round();
  $('score').innerHTML = `${n(r.score)}<small>of ${n(r.target)}</small>`;
  $('fill').style.width = `${Math.min(100, (100 * r.score) / r.target)}%`;
  $('hands').textContent = `${r.handsLeft} hands`;
  $('discards').textContent = `${r.discardsLeft} discards`;
  $('deckleft').textContent = `${r.drawPile.length} in the pack`;
  $('cat').textContent = CATEGORIES[r.category].label;
}

function renderHand(preview) {
  const r = round();
  const hand = $('hand');
  hand.replaceChildren();
  const scoring = new Set(preview ? preview.scoring.map((k) => sorted()[k]) : []);
  r.hand.forEach((card, i) => {
    const isSel = selected.includes(i);
    // a keeper left in hand is working for you (Safe Hands), so it is marked while the fixture is live
    const state = preview && isSel ? (scoring.has(i) ? 'scoring' : 'kicker')
      : !isSel && r.status === 'playing' && safeHands(card) ? 'held' : null;
    const c = renderCard(card, { category: r.category, scale: r.scale, selected: isSel, state });
    c.tabIndex = 0;
    c.setAttribute('role', 'button');
    c.setAttribute('aria-pressed', String(isSel));
    c.setAttribute('aria-label', `${card.full}, overall ${card.rating}, ${card.pos}, ${card.club}. Press to ${isSel ? 'drop' : 'pick'}.`);
    c.addEventListener('click', () => toggle(i));
    c.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggle(i); } });
    hand.append(c);
  });
}

function renderLive() {
  const r = round();
  const idx = sorted();
  const live = r.status === 'playing';
  $('play-btn').disabled = !live || !idx.length;
  $('discard').disabled = !live || !idx.length || r.discardsLeft === 0;
  $('hint').disabled = !live;
  $('clear').disabled = !live;
  const detail = $('live').querySelector('.detail');
  if (!idx.length) {
    detail.replaceChildren(el('p', { class: 'empty', text: live ? 'Pick up to five stickers (tap them, or press 1-8). Only the ones that make the hand score.' : '' }));
    return null;
  }
  const res = scoreHand(idx.map((i) => r.hand[i]), ctx(r.hand.filter((_, i) => !idx.includes(i))));
  const rows = res.trace.map((t, k) => {
    const bits = [];
    if (t.chips !== undefined) bits.push(el('span', { class: 'add', text: `${k === 0 ? '' : '+'}${t.chips}` }));
    if (t.mult !== undefined) bits.push(el('span', { class: 'add', text: `${k === 0 ? '×' : '+'}${t.mult}` }));
    if (t.xmult !== undefined) bits.push(el('span', { class: 'xm', text: `×${t.xmult}` }));
    return el('tr', {}, el('td', { text: t.src }), el('td', {}, ...bits.flatMap((b, i) => (i ? [' ', b] : [b]))), el('td', { text: `${n(t.runChips)} × ${+t.runMult.toFixed(2)}` }));
  });
  detail.replaceChildren(
    el('h3', { text: HANDS[res.type].name }),
    el('div', { class: 'blurb', text: `${HANDS[res.type].blurb}. ${res.scoring.length} of ${idx.length} sticker${idx.length > 1 ? 's' : ''} score.` }),
    el('div', { class: 'total' }, `${n(res.total)} `, el('small', { text: `= ${n(res.chips)} chips × ${+res.mult.toFixed(2)} mult` })),
    el('table', { class: 'trace' }, el('tbody', {}, ...rows)),
  );
  return res;
}

function renderPlay() {
  renderMeter();
  const preview = renderLive();
  renderHand(preview);
  renderHud();
}

function toggle(i) {
  const r = round();
  if (r.status !== 'playing' || i >= r.hand.length) return;
  const at = selected.indexOf(i);
  if (at > -1) selected.splice(at, 1);
  else if (selected.length < 5) selected.push(i);
  renderPlay();
}

function afterAction() {
  selected = [];
  renderPlay();
  if (round().status !== 'playing') showResult();
}

function doPlay() {
  const idx = sorted();
  if (!idx.length || round().status !== 'playing') return;
  playHand(round(), idx);
  afterAction();
}

function doDiscard() {
  const idx = sorted();
  const r = round();
  if (!idx.length || r.status !== 'playing' || r.discardsLeft === 0) return;
  discard(r, idx);
  afterAction();
}

function doHint() {
  const r = round();
  if (r.status !== 'playing') return;
  const b = bestPlay(r);
  selected = [...b.idx];
  renderPlay();
  say(`Suggested: ${HANDS[b.type].name} for ${n(b.total)}.`);
}

// ---- the result ----------------------------------------------------------------------------------------------------------
function showResult() {
  if (resultShown) return;
  resultShown = true;
  const r = round();
  const wasMatchday = run.matchday;
  const fin = finishMatchday(run);
  const items = [];
  if (fin.won) {
    items.push(el('li', {}, 'Match fee', el('b', { text: money(ECONOMY.winPayout) })));
    if (fin.spare) items.push(el('li', {}, `Spare hands (${fin.spare})`, el('b', { text: money(fin.spare * ECONOMY.perSpareHand) })));
    items.push(el('li', { class: 'total' }, 'Paid', el('b', { text: money(fin.payout) })));
    $('r-h').textContent = run.status === 'won' ? `Full time: that's the title! All ${SEASON_LENGTH} matchdays cleared.` : `Full time: through. Matchday ${wasMatchday} cleared.`;
    $('r-go').textContent = run.status === 'won' ? 'Lift the trophy' : 'To the transfer window';
    say('');
    save();
  } else {
    items.push(el('li', {}, 'Scored', el('b', { text: n(r.score) })));
    items.push(el('li', {}, 'Needed', el('b', { text: n(r.target) })));
    items.push(el('li', { class: 'total' }, 'Short by', el('b', { text: n(r.target - r.score) })));
    $('r-h').textContent = `Full time: out. Sacked after ${run.cleared} matchday${run.cleared === 1 ? '' : 's'}.`;
    $('r-go').textContent = 'See the season';
  }
  if (run.status !== 'playing') { stash(SAVE, null); recordBest(); }
  $('r-ledger').replaceChildren(...items);
  $('result').hidden = false;
  renderHud();
  $('r-h').focus({ preventScroll: false });
}

function recordBest() {
  const best = recall(BEST);
  if (!best || run.cleared > best.cleared || (run.status === 'won' && !best.won)) stash(BEST, { cleared: run.cleared, won: run.status === 'won' });
}

function afterResult() {
  if (run.phase === 'shop') showShop();
  else showOver();
}

// ---- the shop ---------------------------------------------------------------------------------------------------------------
function shopSay(text, kind = '') {
  const s = $('s-status');
  s.className = `status ${kind}`;
  s.textContent = text;
}

function showShop() {
  $('s-sub').textContent = `after matchday ${run.matchday - 1}`;
  shopSay('');
  show('shop');
  renderShop();
  save();
}

function attempt(fn, ok) {
  try { const r = fn(); renderShop(); renderHud(); save(); if (ok) shopSay(ok(r)); } catch (err) { shopSay(err.message, 'lost'); }
}

function renderShop() {
  $('s-money').textContent = money(run.money);
  const packOpen = !!run.pack;
  $('s-reroll').textContent = `Reroll ${money(rerollCost(run))}`;
  $('s-reroll').disabled = packOpen || run.money < rerollCost(run);
  $('s-next').disabled = packOpen;

  // an open pack: choose one sticker to keep
  $('pack-panel').hidden = !packOpen;
  if (packOpen) {
    // a player you already own is not a second copy: keeping him upgrades yours one edition
    $('pk-cards').replaceChildren(...run.pack.cards.map((c) => {
      const mine = ownedCopy(run, c);
      const up = mine ? EDITIONS[upgradedEdition(mine.edition, c.edition)].label : null;
      return el('div', { class: 'pickable' },
        mine ? el('div', { class: 'own-tag', text: `YOU OWN HIM (${EDITIONS[mine.edition].label})` }) : null,
        renderCard(c),
        el('button', { class: 'primary', type: 'button', text: mine ? `Upgrade to ${up}` : 'Keep',
          onclick: () => attempt(() => takePack(run, [c.uid]), ([r]) => (r.upgraded ? `${c.name} upgraded to ${EDITIONS[r.upgraded].label}.` : `${c.name} joins the squad.`)) }));
    }));
    $('pk-skip').onclick = () => attempt(() => takePack(run, []), () => 'You kept none.');
  }

  $('offers').replaceChildren(...run.shop.offers.map(renderOffer));
  $('owned').replaceChildren(...(run.jokers.length ? run.jokers.map((id) => el('li', { class: 'own' },
    el('div', {}, el('b', { text: JOKERS[id].name }), el('small', { text: JOKERS[id].blurb })),
    el('button', { class: 'ghost', type: 'button', text: `Sell ${money(sellValue(id))}`, onclick: () => attempt(() => sellManager(run, id), () => `Sold ${JOKERS[id].name} for ${money(sellValue(id))}.`) })))
    : [el('li', { class: 'empty', text: 'None yet. Managers bend the maths: the first one is usually the best buy.' })]));
}

function renderOffer(o) {
  const price = priceOf(run, o);
  let title, blurb, extra = '';
  if (o.kind === 'pack') { title = PACKS[o.type].name; blurb = `${PACKS[o.type].blurb}. Keep one of five.`; }
  else if (o.kind === 'manager') { title = JOKERS[o.id].name; blurb = JOKERS[o.id].blurb; extra = 'Manager'; }
  else {
    const lvl = run.handLevels[o.hand] ?? 1;
    title = `Training: ${HANDS[o.hand].name}`;
    blurb = `Level ${lvl} → ${lvl + 1}: +${HANDS[o.hand].lvl[0]} chips and +${HANDS[o.hand].lvl[1]} mult every time you play it.`;
    extra = HANDS[o.hand].blurb;
  }
  const broke = run.money < price;
  const full = o.kind === 'manager' && run.jokers.length >= ECONOMY.managerSlots;
  const why = o.bought ? 'Bought' : run.pack ? 'Open your pack first' : full ? 'No free slot: sell a manager' : broke ? 'Not enough money' : '';
  return el('div', { class: `tile ${o.kind}${o.bought ? ' bought' : ''}` },
    el('small', { class: 'kind', text: o.kind === 'pack' ? 'Pack' : o.kind === 'manager' ? 'Manager' : 'Training' }),
    el('h4', { text: title }),
    el('p', { text: blurb }),
    extra && o.kind !== 'manager' ? el('p', { class: 'fine', text: extra }) : null,
    el('div', { class: 'buyrow' },
      el('b', { text: money(price) }),
      el('button', {
        class: 'primary', type: 'button', text: o.bought ? 'Bought' : 'Buy', disabled: !!why, title: why,
        onclick: () => attempt(() => buy(run, o.slot), () => (o.kind === 'pack' ? 'Pack opened.' : o.kind === 'manager' ? `Signed ${JOKERS[o.id].name}.` : `${HANDS[o.hand].name} trained to level ${run.handLevels[o.hand]}.`)),
      })));
}

function doNext() {
  try { nextMatchday(run); save(); showIntro(); } catch (err) { shopSay(err.message, 'lost'); }
}

// ---- the squad viewer ----------------------------------------------------------------------------------------------------------
function openDialog(d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }

function openSquad() {
  if (!run) return;
  const canRelease = run.phase === 'shop' && !run.pack;
  $('q-note').textContent = canRelease
    ? `Releasing a sticker costs ${money(ECONOMY.releaseCost)}. A smaller squad plays more reliably, but you need at least ${ECONOMY.minDeck}.`
    : 'You can release stickers in the transfer window.';
  const list = [...run.deck].sort((a, b) => b.rating - a.rating || a.club.localeCompare(b.club) || a.name.localeCompare(b.name));
  $('q-cards').replaceChildren(...list.map((c) => el('div', { class: 'pickable' },
    renderCard(c),
    canRelease ? el('button', {
      class: 'ghost', type: 'button', text: `Release ${money(ECONOMY.releaseCost)}`,
      disabled: run.money < ECONOMY.releaseCost || run.deck.length <= ECONOMY.minDeck,
      onclick: () => { try { releaseCard(run, c.uid); save(); renderHud(); renderShop(); openSquad(); } catch (err) { $('q-note').textContent = err.message; } },
    }) : null)));
  openDialog($('squad'));
}

// ---- the end ----------------------------------------------------------------------------------------------------------------------
function showOver() {
  const won = run.status === 'won';
  $('o-h').textContent = won ? 'Champions!' : `Sacked after ${run.cleared} matchday${run.cleared === 1 ? '' : 's'}`;
  $('o-lede').textContent = won
    ? `You cleared all ${SEASON_LENGTH} matchdays. Take a bow.`
    : `You needed ${n(run.history.at(-1).target)} on matchday ${run.history.at(-1).matchday} (${CATEGORIES[run.history.at(-1).category].label}) and scored ${n(run.history.at(-1).score)}.`;
  const bestHand = run.history.filter((h) => h.best).reduce((b, h) => (!b || h.best.total > b.best.total ? h : b), null);
  const trained = Object.entries(run.handLevels).filter(([, l]) => l > 1).map(([h, l]) => `${HANDS[h].name} ${l}`);
  const rows = [
    ['Matchdays cleared', `${run.cleared} of ${SEASON_LENGTH}`],
    ['Best hand', bestHand ? `${HANDS[bestHand.best.hand].name}, ${n(bestHand.best.total)} (matchday ${bestHand.matchday})` : 'none'],
    ['Managers', run.jokers.length ? run.jokers.map((id) => JOKERS[id].name).join(', ') : 'none'],
    ['Trained hands', trained.length ? trained.join(', ') : 'none'],
    ['Squad', `${run.deck.length} stickers`],
    ['Money left', money(run.money)],
    ['VAR left', `${run.varLeft} of ${VAR_PER_SEASON}`],
    ['Season code', run.seed],
  ];
  $('o-summary').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
  $('o-form').replaceChildren(...Array.from({ length: SEASON_LENGTH }, (_, i) => {
    const h = run.history[i];
    const cls = !h ? 'todo' : h.won ? 'won' : 'lost';
    return el('li', { class: cls, title: h ? `Matchday ${i + 1}: ${CATEGORIES[h.category].label}, ${n(h.score)} against ${n(h.target)}` : `Matchday ${i + 1}: not played`, text: h ? (h.won ? 'W' : 'L') : '' });
  }));
  show('over');
}

// ---- how to play -----------------------------------------------------------------------------------------------------------------
function buildManual() {
  const rows = HAND_ORDER.map((t) => `<tr><td>${HANDS[t].name}</td><td>${HANDS[t].blurb}</td><td>${HANDS[t].chips} × ${HANDS[t].mult}</td></tr>`).join('');
  $('m-body').innerHTML = `
    <h2 id="m-h">How to play</h2>
    <p><b>The aim.</b> Survive a 38-game season. Every matchday has a target score. Reach it within four hands and you win the match and get paid. Miss it and you're sacked.</p>
    <h3>The stickers</h3>
    <p>Every sticker is <b>one player's whole Premier League career</b> since 1992/93: there is only one Frank Lampard. The big number is his <b>overall</b> (1 to 99) and sets his frame: bronze, silver, gold, or an icon, a legend. Each stat row shows his <b>rating</b> out of 99 and, underneath, the real career total behind it ("177 goals").</p>
    <p>A rating is measured against the Premier League record: 99 is the best ever (260 goals, 162 assists, 653 games), so a legend and a long-serving squad player look very different. A sticker is worth <b>chips</b> in proportion to his rating, never his raw total.</p>
    <h3>Each matchday</h3>
    <ol>
      <li><b>The wheel</b> picks a stat: goals, assists, games or discipline (a yellow card is 1 point, a red card is 3). Every sticker is worth chips in that stat. <b>VAR</b> overturns the spin and spins again to a different stat: you get five a season, before kick-off only.</li>
      <li><b>You're dealt 8 stickers.</b> Pick up to five and <b>play</b> them as a hand, or <b>discard</b> up to five for new ones. You get four hands and three discards.</li>
      <li><b>Score = chips × mult.</b> Chips: the hand's base, plus each <i>scoring</i> sticker's rating in the stat. Mult: the hand's, plus your managers'. Only the stickers that make the hand score; the rest are kickers and add nothing.</li>
    </ol>
    <h3>The hands</h3>
    <p>Two players are <b>team-mates</b> if they were at the same club in the same season at any point in their careers: Lampard and Terry were team-mates for thirteen. A hand asks whether the stickers you play share a club-season.</p>
    <table class="manual-table"><thead><tr><th>Hand</th><th>You need</th><th>Base</th></tr></thead><tbody>${rows}</tbody></table>
    <h3>Goalkeepers</h3>
    <p>A goalkeeper <b>held in your hand</b>, not played, adds mult to every hand you play: +3 for a first-choice legend (250+ appearances), +2 for a regular (100+), +1 for a deputy. Play him in a Spine and you lose that. Hold or play?</p>
    <h3>The transfer window</h3>
    <p>Win a matchday and you're paid £${ECONOMY.winPayout}, plus £${ECONOMY.perSpareHand} for each hand you didn't need. Spend it on <b>packs</b> (five different players, keep one: club packs deal players who have played for a club in your squad, squad packs players who were team-mates of someone in it), <b>managers</b> (up to ${ECONOMY.managerSlots}; they bend the maths), and <b>training</b> (a hand gets stronger every time you play it). You can reroll the stock, sell a manager for half, or release a sticker for ${money(ECONOMY.releaseCost)}: a smaller squad is more reliable.</p>
    <h3>Duplicates and foils</h3>
    <p>You can only own one of each player. If a pack deals you one you already have, keeping him <b>upgrades your copy</b> one edition: base, then shiny (+40 chips), holo (+6 mult), gold (×1.5 mult). Gold stays gold.</p>
    <h3>Tips</h3>
    <ul>
      <li>Build around one or two clubs. Team-mate hands beat star power.</li>
      <li>Look at the strength bars before using VAR: spend it when the wheel lands on a stat your squad is weak in.</li>
      <li>Stuck? Press <b>Hint</b> to see the best hand in your eight.</li>
      <li>Not sure what a number on a sticker means? <b>Hover over it</b> (on a phone, press and hold). Every number explains itself.</li>
      <li>We only have goals, assists, appearances and cards for all 34 seasons, so there are no tackles or saves: a defender's overall is mostly how long he lasted, and a goalkeeper's is how much he played.</li>
    </ul>`;
}

// ---- boot ------------------------------------------------------------------------------------------------------------------------------
function wire() {
  $('t-new').addEventListener('click', () => startSeason($('t-seed').value.trim()));
  $('t-continue').addEventListener('click', continueSeason);
  for (const id of ['t-help', 'h-help']) $(id).addEventListener('click', () => openDialog($('manual')));
  $('h-quit').addEventListener('click', () => { save(); showTitle(); });
  $('h-squad').addEventListener('click', openSquad);
  $('i-var').addEventListener('click', doVar);
  $('i-kick').addEventListener('click', doKickOff);
  $('play-btn').addEventListener('click', doPlay);
  $('discard').addEventListener('click', doDiscard);
  $('hint').addEventListener('click', doHint);
  $('clear').addEventListener('click', () => { selected = []; renderPlay(); say(''); });
  $('r-go').addEventListener('click', afterResult);
  $('s-reroll').addEventListener('click', () => attempt(() => rerollShop(run), () => 'The stock changed.'));
  $('s-next').addEventListener('click', doNext);
  $('o-new').addEventListener('click', () => startSeason(''));
  $('o-again').addEventListener('click', () => startSeason(run.seed));
  $('o-title').addEventListener('click', showTitle);

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || e.target.closest('input, textarea, select')) return;
    if (document.body.dataset.screen !== 'play' || !run || run.phase !== 'play') return;
    if (e.key >= '1' && e.key <= '8') toggle(Number(e.key) - 1);
    else if (e.key === 'Enter' && !e.target.closest('button')) doPlay();
    else if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey) doDiscard();
    else if (e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey) doHint();
    else if (e.key === 'Escape') { selected = []; renderPlay(); }
  });
}

async function init() {
  const res = await fetch(new URL('../data/cards.json', import.meta.url));
  pool = makePool(await res.json());
  buildWheel();
  buildManual();
  wire();
  initTooltips();
  window.__game = { get run() { return run; }, pool };   // for tests and the curious
  if (params.get('seed')) $('t-seed').value = params.get('seed');
  showTitle();
  document.body.dataset.ready = 'true';
}

init().catch((err) => {
  document.body.dataset.ready = 'error';
  const s = $('t-status');
  s.className = 'status lost';
  s.textContent = `Couldn't load the stickers (${err.message}). Serve this folder over http, e.g. npm start.`;
  document.body.dataset.screen = 'title';
});
