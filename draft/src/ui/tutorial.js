// The "How to play" guide: six short slides with one idea each, shown before a player's first game and from the title screen and the draft screen.
// It teaches with the real thing where it can: a live wheel, and a real board of goalkeepers from the engine whose prices you can tap to reveal (so
// "prices are a hint" is shown, not told). The long written rules stay behind "Full rules".
import { firstNameOf, surnameOf } from '../../../stickers/src/engine/cards.js';
import { drawWheel } from './wheel.js';
import { newMatch, tagOf, valueOf, MODES } from '../engine/draft.js';
import { ATTRIBUTES } from '../engine/attributes.js';

const gbp = (x) => '£' + (Number.isInteger(x) ? x : x.toFixed(1)) + 'm';
const n = (x) => x.toLocaleString('en-GB');
function h(tag, props = {}, ...kids) {
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

// the demo board: a real first board of goalkeepers (counting appearances) with a bargain, a trap and a star on it
const DEMO_SEED = 'tutorial3954';
const DEMO_NAMES = ['Marcus Hahnemann', 'Alisson', 'Jens Lehmann', 'Shay Given'];
function demoBoard(pool) {
  const s = newMatch(pool, DEMO_SEED, { mode: 'eleven', categories: ['games'], formation: '4-4-2' });
  return DEMO_NAMES.map((name) => s.board.find((b) => b.card.full === name)).filter(Boolean).map((b) => ({
    card: b.card, price: b.price, tag: tagOf(b.price, b.fair), total: valueOf(b.card, 'games'),
  }));
}

// an <svg> has to be made in the SVG namespace
function svgEl() {
  const e = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  e.setAttribute('class', 'g-wheel'); e.setAttribute('aria-hidden', 'true');
  return e;
}

// ---- the slides ------------------------------------------------------------------------------------------------------------------------
function slideGoal() {
  const side = (who, total, win) => h('div', { class: `g-team${win ? ' win' : ''}` }, h('small', { text: who }), h('b', { class: 'g-total', 'data-to': total, text: '0' }), win ? h('span', { class: 'g-tick', text: 'Wins' }) : null);
  return {
    title: 'Build a team. Beat the bot.',
    text: 'You and the bot each pick a team of footballers. Add up their real Premier League career numbers and <b>the bigger total wins</b>. The catch: you pick <b>blind</b>.',
    graphic: () => h('div', { class: 'g-vs' }, side('You', 1204, true), h('span', { class: 'g-v', text: 'v' }), side('The bot', 987, false)),
    enter: (root) => {
      root.querySelectorAll('.g-total').forEach((el, i) => {
        const to = +el.dataset.to, t0 = performance.now() + i * 200;
        const tick = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / 1100)); el.textContent = n(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
    },
  };
}

function slideWheel() {
  let spinning = false;
  return {
    title: 'A wheel decides what counts',
    text: 'Goals, assists, clean sheets, league titles, red cards… Each match the wheel picks <b>one stat</b>, and only that stat counts. You know it <b>before</b> you pick, so build the team for it.',
    graphic: () => h('div', { class: 'g-wheelwrap' }, svgEl(), h('p', { class: 'g-cap', 'aria-live': 'polite', text: ' ' }), h('button', { class: 'ghost g-again', type: 'button', text: 'Spin again' })),
    enter: (root) => {
      const svg = root.querySelector('.g-wheel'), cap = root.querySelector('.g-cap'), again = root.querySelector('.g-again');
      const wheel = drawWheel(svg, ATTRIBUTES.map((a) => ({ label: a.short })));
      const go = async () => {
        if (spinning) return;
        spinning = true; again.disabled = true; cap.textContent = ' ';
        const i = Math.floor(Math.random() * ATTRIBUTES.length);
        await wheel.spin(i, { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2400, turns: 3, jitter: Math.random() * 2 - 1, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches }).done;
        cap.innerHTML = `This match: <b>${ATTRIBUTES[i].label}</b>`;
        spinning = false; again.disabled = false;
      };
      again.addEventListener('click', go);
      go();
    },
  };
}

function slideBlind(pool) {
  const board = demoBoard(pool);
  return {
    title: 'You only see a name and a price',
    text: 'No stats, no club. A £5m player is usually a star and a £1m player a squad man… but not always. <b>This match counts appearances. Tap each player to reveal his real total.</b>',
    graphic: () => {
      const note = h('p', { class: 'g-note', text: 'Tap a player.' });
      let seen = 0;
      const tiles = board.map((b) => {
        const rev = h('span', { class: 'g-rev' });
        const t = h('button', { class: 'tile g-tile', type: 'button', 'aria-label': `${b.card.full}, ${gbp(b.price)}. Tap to reveal.` },
          h('span', { class: 'first', text: firstNameOf(b.card) || ' ' }), h('span', { class: 'last', text: surnameOf(b.card) }), h('span', { class: 'price', text: gbp(b.price) }), rev);
        t.addEventListener('click', () => {
          if (t.classList.contains('shown')) return;
          t.classList.add('shown', b.tag || 'fair');
          rev.innerHTML = `<b>${n(b.total)}</b> apps${b.tag ? ` · ${b.tag}` : ''}`;
          seen++;
          if (seen >= 2) note.innerHTML = 'Prices are <b>a hint, not the truth</b>. Some players are bargains, some are traps. Your football knowledge is the edge.';
        });
        return t;
      });
      return h('div', { class: 'g-blind' }, h('div', { class: 'g-tiles' }, tiles), note);
    },
  };
}

function slideMoney() {
  const eleven = MODES.eleven.budget;
  return {
    title: 'One budget for the whole team',
    text: `You get <b>${gbp(eleven)}</b> to fill all 11 places (£10m in 5-a-side). Splash out on a star and you have less for the rest. You must keep <b>£1m for every player still to sign</b>, so you can never get stuck.`,
    graphic: () => h('div', { class: 'g-money' },
      h('div', { class: 'g-bar' },
        h('span', { class: 'seg spent', style: 'flex:4.8', text: '£4.8m spent' }),
        h('span', { class: 'seg can', style: 'flex:16.2', text: 'up to £16.2m on the next pick' }),
        h('span', { class: 'seg held', style: 'flex:9', text: '£9m kept back' })),
      h('p', { class: 'g-note', html: `After a <b>£4.8m</b> goalkeeper there are 9 players still to sign, so £9m is kept back for them.` })),
  };
}

function slideTurns() {
  const roles = ['Goalkeeper', 'Defenders', 'Midfielders', 'Forwards'];
  const mini = (cls, label) => h('span', { class: `g-mini ${cls || ''}`, 'data-by': label || null });
  return {
    title: 'Pick one each, take turns',
    text: 'Each round a board of eight players of <b>one position</b> goes up, goalkeeper first and forwards last. You pick one, the bot picks one, and who goes first swaps every round. <b>A player who is taken is gone</b>, so watch what the bot takes.',
    graphic: () => h('div', { class: 'g-turns' },
      h('div', { class: 'g-minis' }, mini(), mini('taken you', 'YOURS'), mini(), mini(), mini('taken bot', "BOT'S"), mini(), mini(), mini()),
      h('ol', { class: 'g-path' }, roles.map((r) => h('li', { text: r })))),
  };
}

function slideCup(openRules) {
  const stops = ['R64', 'R32', 'R16', 'QF', 'SF', 'Final'];
  return {
    title: 'Win the Cup from League Two',
    text: 'At the end every player’s real career total is added up. <b>Biggest total wins the match.</b> In the Cup that is the whole round: win and you go through, lose and you are out. 64 clubs, six rounds, and you start in League Two with the smallest wallet.',
    graphic: () => h('div', { class: 'g-cup' },
      h('ol', { class: 'g-road' }, stops.map((s, i) => h('li', { class: i === 0 ? 'now' : '' }, s, i === 0 ? h('small', { text: 'You start' }) : null))),
      h('p', { class: 'g-note', html: 'Bigger clubs have bigger budgets. <b>Your edge is knowing football.</b>' }),
      h('button', { class: 'linkbtn g-rules', type: 'button', text: 'Read the full rules', onclick: openRules })),
  };
}

// ---- the dialog ------------------------------------------------------------------------------------------------------------------------
// openGuide({ pool, first, onClose, onFullRules }): first = true when it is the pre-game guide (the last button says "Let's play").
export function openGuide({ pool, first = false, onClose = () => {}, onFullRules = () => {} } = {}) {
  let dlg = document.getElementById('guide');
  if (!dlg) { dlg = h('dialog', { id: 'guide', class: 'guide', 'aria-labelledby': 'g-title' }); document.body.append(dlg); }
  const close = () => { if (dlg.open) dlg.close(); };
  const slides = [slideGoal(), slideWheel(), slideBlind(pool), slideMoney(), slideTurns(), slideCup(() => { close(); onFullRules(); })];
  let i = 0;
  const render = () => {
    const s = slides[i];
    const last = i === slides.length - 1;
    const graphic = s.graphic();
    dlg.replaceChildren(
      h('div', { class: 'g-top' }, h('span', { class: 'g-step', text: `${i + 1} of ${slides.length}` }), h('button', { class: 'linkbtn g-skip', type: 'button', text: last ? 'Close' : 'Skip', onclick: close })),
      h('h2', { id: 'g-title', tabindex: '-1', text: s.title }),
      h('div', { class: 'g-stage' }, graphic),
      h('p', { class: 'g-text', html: s.text }),
      h('div', { class: 'g-dots', role: 'presentation' }, slides.map((_, k) => h('span', { class: k === i ? 'on' : '' }))),
      h('div', { class: 'g-nav' },
        h('button', { class: 'ghost', type: 'button', text: 'Back', disabled: i === 0, onclick: () => { i--; render(); } }),
        h('button', { class: 'primary', type: 'button', text: last ? (first ? 'Let’s play' : 'Got it') : 'Next', onclick: () => { if (last) close(); else { i++; render(); } } })));
    dlg.querySelector('h2').focus({ preventScroll: true });
    s.enter?.(graphic);
  };
  const onKey = (e) => { if (e.key === 'ArrowRight' && i < slides.length - 1) { i++; render(); } else if (e.key === 'ArrowLeft' && i > 0) { i--; render(); } };
  dlg.addEventListener('keydown', onKey);
  dlg.addEventListener('close', () => { dlg.removeEventListener('keydown', onKey); onClose(); }, { once: true });
  render();
  dlg.showModal();
}
