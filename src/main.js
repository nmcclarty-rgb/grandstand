/**
 * GRANDSTAND — boot, screens, input, loop.
 *
 * Flow: title -> setup -> character select -> ladder -> fight -> ladder -> ...
 *
 * The canvas shows the world; everything you read or press is real DOM below
 * it. That split is what makes this playable on a phone in a pub without
 * squinting, and it means the quiz text is selectable, scalable and screen
 * readable rather than blitted pixels.
 */

import { setupCanvas, drawBattleScene, drawSelectScene, drawLadderScene,
         drawTitleScene, drawTitleWordmark, drawStars,
         rungPos, ladderWidth, VIEW_W, VIEW_H } from './engine/render.js';
import { drawFace, drawPortrait, PORTRAIT_W, PORTRAIT_H } from './engine/sprites.js';
import { initAudio, sfx, setMuted, isMuted } from './engine/audio.js';
import { Battle, PHASE, ANSWER_MS } from './game/battle.js';
import { PvpMatch, PVP_PHASE } from './game/pvp.js';
import { KIND, RUNGS } from './game/ladder.js';
import { Run, loadSave, recordRun, recordBeaten, savePrefs, wipeSave,
         makeSeedFrom, seedName, ENTER_COST, BATTLE_TURN_COST } from './game/state.js';
import { SPORTS, availableSports, countBySport, QUESTIONS } from './data/questions.js';
import { CHARACTERS, findCharacter } from './data/characters.js';
import { ROSTER, findFighter } from './data/roster.js';

const $ = (id) => document.getElementById(id);
const panel = $('panel');
const stage = $('stage');
const { ctx, resize } = setupCanvas($('game'));

const G = {
  screen: 'title',
  run: null, battle: null, match: null, rung: null,
  t: 0,
  camX: 0,
  scene: { player: null, foe: null, floaters: [], shake: 0, playerFlash: 0, foeFlash: 0,
           playerPose: null, foePose: null, playerDown: false, foeDown: false,
           venue: 'THE REC' },
  setup: { mode: 'career', sports: [], character: 'ringer', name: 'YOU', name2: 'THEM', seed: '' },
  timer: { running: false, start: 0, lastTick: 0 },
  busy: false,
};

const save = loadSave();
G.setup.sports = save.lastSports || [];
G.setup.character = save.lastCharacter || 'ringer';
G.setup.name = save.lastName || 'YOU';
setMuted(!!save.muted);

// ── helpers ────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => `${Math.max(0, Math.min(100, (a / b) * 100))}%`;
const starStr = (n, of = 3) => '★'.repeat(n) + '☆'.repeat(Math.max(0, of - n));

function toast(msg, ms = 1700) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function shakeStage(power = 1) {
  G.scene.shake = power;
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
  setTimeout(() => { G.scene.shake = 0; }, 230);
}

function floater(text, x, y, colour, big = false) {
  G.scene.floaters.push({ text, x, y, vy: -0.8, life: 46, colour, big });
}

function setHud(on) { $('hud').classList.toggle('on', on); }

function updateHud() {
  const r = G.run;
  if (!r) return;
  $('energy-num').textContent = Math.round(r.energy);
  $('cond-num').textContent = Math.round(r.player.hp);
  $('energy-fill').style.width = pct(r.energy, r.maxEnergy);
  const cf = $('cond-fill');
  cf.style.width = pct(r.player.hp, r.player.maxHp);
  cf.classList.toggle('low', r.player.hp / r.player.maxHp < 0.3);
  $('rep-chip').textContent = `REP ${r.rep}`;
}

function show(html) { panel.innerHTML = html; panel.scrollTop = 0; }

function layout() {
  const app = $('app');
  const hudH = $('hud').classList.contains('on') ? $('hud').offsetHeight : 0;
  const budget = Math.min((app.clientHeight - hudH) * 0.54, app.clientWidth * 0.60);
  stage.style.height = `${Math.max(120, Math.round(budget))}px`;
  resize();
  const drawn = $('game').getBoundingClientRect().height;
  if (drawn > 0) stage.style.height = `${Math.round(drawn)}px`;
}
window.addEventListener('resize', layout);

// ═══════════════════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════════════════

function screenTitle() {
  G.screen = 'title';
  setHud(false);
  const best = save.bestRep ? `BEST DAY: ${save.bestRep} REP` : 'NO RESULT RECORDED';
  show(`
    <div class="screen on">
      <p class="dim small">A turn-based sports-quiz RPG. Every answer is a whole
      number, and the number is how hard you hit.</p>
      <div class="btn-row">
        <button class="primary" data-act="go-setup" data-mode="career">START A DAY OUT</button>
      </div>
      <div class="btn-row">
        <button data-act="go-setup" data-mode="pvp">HOT-SEAT PvP</button>
        <button data-act="league">LEAGUE TABLE</button>
      </div>
      <div class="btn-row">
        <button data-act="codex">THE ROSTER</button>
        <button data-act="howto">HOW TO PLAY</button>
      </div>
      <p class="dim small">${esc(best)} · ${QUESTIONS.length} questions ·
        ${ROSTER.length} opponents · ${CHARACTERS.length} fighters</p>
    </div>`);
  layout();
}

function screenHowTo() {
  G.screen = 'howto';
  show(`
    <div class="screen on">
      <h2>HOW TO PLAY</h2>
      <div class="card">
        <h3>THE IDEA</h3>
        <p class="small">Pick a fighter, then climb a ladder of people who were
        on the telly in 1987. Each rung is settled with a quiz.</p>
      </div>
      <div class="card gold">
        <h3>YOUR GO — <span style="color:var(--gold)">STRIKE</span></h3>
        <p class="small">You're asked who has the <b>MOST</b> of something.
        Pick the biggest number and you hit hardest. Pick a smaller one and you
        still connect — just softer. The number <i>is</i> the damage.</p>
      </div>
      <div class="card blue">
        <h3>THEIR GO — <span style="color:var(--blue)">BLOCK</span></h3>
        <p class="small">Now you're asked who has the <b>FEWEST</b>. Pick the
        smallest number to take the sting out of what's coming. Getting the two
        the wrong way round is how everybody loses.</p>
      </div>
      <div class="card">
        <h3>STARS</h3>
        <p class="small">Every rung is worth three. One for winning, one for
        answering well, one for finishing in decent nick. Go back down and beat
        someone properly if you want the third.</p>
      </div>
      <div class="card">
        <h3>THE CLOCK, COMBOS, CARDS</h3>
        <p class="small">12 seconds. Answering fast adds up to +50%. Perfect
        answers in a row build a combo up to ×2. Pick the <i>worst</i> option
        and you're booked — two yellows and you sit an exchange out.</p>
      </div>
      <div class="card">
        <h3>ENERGY</h3>
        <p class="small">Walking out to face someone costs ${ENTER_COST}. Every
        exchange costs 1 more. When it's gone, the day's over and you get your
        score. Rung 4 is the physio, rung 8 is a freebie.</p>
      </div>
      <div class="card">
        <h3>KEYS</h3>
        <p class="small"><span class="kbd">◀ ▶</span> move along the ladder ·
        <span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span> answer ·
        <span class="kbd">N</span> nutmeg · <span class="kbd">ENTER</span> continue ·
        <span class="kbd">M</span> mute</p>
      </div>
      <div class="btn-row"><button data-act="title">BACK</button></div>
    </div>`);
}

function screenSetup(mode) {
  G.screen = 'setup';
  G.setup.mode = mode;
  setHud(false);
  const counts = countBySport();
  const chips = availableSports().map((s) => {
    const on = G.setup.sports.includes(s);
    return `<button class="chip ${on ? 'on' : ''}" data-act="toggle-sport" data-sport="${s}">
      ${esc(SPORTS[s].name)} <span class="dim">${counts[s]}</span></button>`;
  }).join('');
  const pool = G.setup.sports.length
    ? QUESTIONS.filter((q) => G.setup.sports.includes(q.sport)).length
    : QUESTIONS.length;

  show(`
    <div class="screen on">
      <h2>${mode === 'pvp' ? 'HOT-SEAT PvP' : 'A DAY OUT'}</h2>
      <div class="card">
        <h3>SPORTS — PICK SOME, OR LEAVE IT EMPTY FOR THE LOT</h3>
        <div class="chip-row">${chips}</div>
        <p class="small dim">${G.setup.sports.length ? `${G.setup.sports.length} selected` : 'ALL SPORTS'}
          · ${pool} questions in play</p>
        ${pool < 12 ? '<div class="warn-strip">Thin pool — questions will repeat. Add another sport.</div>' : ''}
      </div>
      ${mode === 'pvp' ? `
        <div class="card">
          <h3>PLAYERS</h3>
          <label class="small dim">PLAYER ONE</label>
          <input id="p1name" class="txt" value="${esc(G.setup.name)}" maxlength="10">
          <label class="small dim">PLAYER TWO</label>
          <input id="p2name" class="txt" value="${esc(G.setup.name2)}" maxlength="10">
          <p class="small dim">One device. You take it in turns and pass it over.</p>
        </div>` : `
        <div class="card">
          <h3>SEED — LEAVE BLANK FOR A RANDOM LADDER</h3>
          <input id="seedin" class="txt" value="${esc(G.setup.seed)}" maxlength="16" placeholder="e.g. SHEARER">
          <p class="small dim">Same seed, same opponents in the same order.</p>
        </div>`}
      <div class="btn-row">
        <button class="primary" data-act="${mode === 'pvp' ? 'start-pvp' : 'go-select'}">
          ${mode === 'pvp' ? 'THROW IN' : 'CHOOSE YOUR FIGHTER'}</button>
        <button data-act="title">BACK</button>
      </div>
    </div>`);
}

// ── character select ───────────────────────────────────────────────────────
function screenSelect() {
  G.screen = 'select';
  setHud(false);
  const c = findCharacter(G.setup.character);
  const grid = CHARACTERS.map((ch) => `
    <button class="pick ${ch.id === G.setup.character ? 'on' : ''}" data-act="pick" data-id="${ch.id}">
      <canvas class="pickface" data-cid="${ch.id}" width="42" height="42"></canvas>
      <span class="pickname">${esc(ch.name)}</span>
    </button>`).join('');

  const perkLines = [];
  if (c.perk.speedMult) perkLines.push(`Clock bonus ×${c.perk.speedMult}`);
  if (c.perk.blockFloor) perkLines.push(`Perfect block lets only ${Math.round(c.perk.blockFloor * 100)}% through`);
  if (c.perk.repMult) perkLines.push(`Rep ×${c.perk.repMult}`);
  if (c.perk.comboBoost) perkLines.push('Combos build a rung early');
  if (c.perk.glassJaw) perkLines.push(`Takes ${Math.round((c.perk.glassJaw - 1) * 100)}% extra damage`);

  show(`
    <div class="screen on">
      <div class="pick-grid">${grid}</div>
      <div class="card gold">
        <h2 style="font-size:11px">${esc(c.name)}</h2>
        <span class="epithet">${esc(c.epithet)}</span>
        <div class="stat-grid">
          <div class="stat"><span class="k">CONDITION</span><span class="v">${c.hp}</span></div>
          <div class="stat"><span class="k">POWER</span><span class="v">${c.power}</span></div>
          <div class="stat"><span class="k">NUTMEGS</span><span class="v">${c.nutmegs}</span></div>
        </div>
        <p class="small">${esc(c.blurb)}</p>
        ${perkLines.length ? `<p class="small" style="color:var(--gold)">${perkLines.map(esc).join(' · ')}</p>` : ''}
      </div>
      <div class="btn-row">
        <button class="primary" data-act="start-run">FIGHT</button>
        <button data-act="go-setup" data-mode="career">BACK</button>
      </div>
    </div>`);
  paintPickFaces();
  layout();
}

function paintPickFaces() {
  for (const cv of panel.querySelectorAll('canvas.pickface')) {
    const ch = findCharacter(cv.dataset.cid);
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#2b2448'; c.fillRect(0, 0, 42, 42);
    drawFace(c, ch, 1, 0, 40);
  }
}

// ── the ladder ─────────────────────────────────────────────────────────────
function screenLadder() {
  G.screen = 'ladder';
  setHud(true);
  const r = G.run;
  const rung = r.rung;
  const l = r.ladder;
  const canGoBack = r.at > 1;
  const canGoOn = r.at < RUNGS && l.available(r.at + 1);
  const isRest = rung.kind === KIND.PHYSIO || rung.kind === KIND.BONUS;
  const affordable = r.canAfford(ENTER_COST);

  let action;
  if (rung.cleared && isRest) {
    action = `<button disabled>ALREADY TAKEN</button>`;
  } else if (isRest) {
    action = `<button class="primary" data-act="rest">${rung.kind === KIND.PHYSIO ? 'SEE THE PHYSIO' : 'COLLECT'}</button>`;
  } else if (!affordable) {
    action = `<button disabled>NOT ENOUGH ENERGY (${ENTER_COST})</button>`;
  } else {
    action = `<button class="primary" data-act="fight">${rung.cleared ? 'REMATCH' : 'HAVE A GO'} (-${ENTER_COST})</button>`;
  }

  const who = rung.fighter
    ? `<div class="rung-head">
         <canvas class="rungface" width="52" height="52"></canvas>
         <div>
           <div class="rung-name">${esc(rung.fighter.name)}</div>
           <span class="epithet">${esc(rung.fighter.epithet)}</span>
           <div class="small dim">${esc(SPORTS[rung.fighter.sport]?.name || 'ALL SPORTS')}
             · TIER ${rung.fighter.tier} · ${rung.fighter.hp} COND · ${rung.fighter.power} POWER</div>
         </div>
       </div>`
    : `<div class="rung-name">${rung.kind === KIND.PHYSIO ? 'THE PHYSIO ROOM' : 'THE CLUB SHOP'}</div>
       <p class="small dim">${rung.kind === KIND.PHYSIO
          ? 'Magic sponge, cold spray, back out you go. Restores over half your condition.'
          : 'A match programme and a spare nutmeg. Take it, you have earned it.'}</p>`;

  show(`
    <div class="screen on">
      <div class="ladder-bar">
        <button class="nav" data-act="rung-prev" ${canGoBack ? '' : 'disabled'}>◀</button>
        <div class="ladder-meta">
          <div class="small dim">RUNG ${rung.n} OF ${RUNGS} · ${esc(rung.venue)}</div>
          <div class="stars-line">${starStr(rung.stars)}
            <span class="dim">${l.totalStars()}/${l.maxStars()} TOTAL</span></div>
        </div>
        <button class="nav" data-act="rung-next" ${canGoOn ? '' : 'disabled'}>▶</button>
      </div>
      <div class="card ${rung.kind === KIND.BOSS ? 'red' : ''}">
        ${who}
        ${rung.fighter ? `<p class="small">"${esc(rung.fighter.taunt)}"</p>` : ''}
      </div>
      <div class="btn-row">${action}</div>
      <div class="btn-row">
        <button class="small-btn" data-act="codex">ROSTER</button>
        <button class="small-btn" data-act="end-day">END THE DAY</button>
      </div>
      <p class="small dim">${r.player.nutmegs} nutmeg${r.player.nutmegs === 1 ? '' : 's'} left
        · ${l.clearedCount()}/${RUNGS} rungs cleared</p>
    </div>`);

  const fc = panel.querySelector('canvas.rungface');
  if (fc && rung.fighter) {
    const c = fc.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#2b2448'; c.fillRect(0, 0, 52, 52);
    drawFace(c, rung.fighter, 1, 0, 50);
  }
  layout();
  updateHud();
}

// ── battle ─────────────────────────────────────────────────────────────────
function fighterBars() {
  const b = G.battle;
  const p = G.run.player;
  return `
    <div class="fighter-bar">
      <div class="row">
        <span class="nm" style="color:var(--red)">${esc(b.foe.name)}</span>
        <span class="hpnum">${b.foe.hp}/${b.foe.maxHp}</span>
      </div>
      <div class="hp-track"><div class="hp-fill foe" style="width:${pct(b.foe.hp, b.foe.maxHp)}"></div></div>
    </div>
    <div class="fighter-bar">
      <div class="row">
        <span class="nm" style="color:var(--green)">${esc(p.name)}</span>
        <span class="hpnum">${p.hp}/${p.maxHp}${b.combo > 1 ? ` · COMBO ×${b.comboMult()}` : ''}</span>
      </div>
      <div class="hp-track"><div class="hp-fill ${p.hp / p.maxHp < 0.35 ? 'hurt' : ''}"
        style="width:${pct(p.hp, p.maxHp)}"></div></div>
    </div>`;
}

function screenBattleIntro() {
  G.screen = 'battle';
  const b = G.battle;
  show(`
    <div class="screen on">
      ${fighterBars()}
      <div class="card red">
        <h3>${esc(G.scene.venue)} · RUNG ${G.rung.n}</h3>
        <p>"${esc(b.foe.taunt)}"</p>
      </div>
      <div class="btn-row">
        <button class="primary" data-act="begin">SECONDS OUT</button>
        <button data-act="leg-it">LEG IT</button>
      </div>
    </div>`);
  layout();
}

function screenQuestion() {
  G.screen = 'battle';
  const b = G.battle;
  const isBlock = b.phase === PHASE.BLOCK;
  const q = b.question;
  const opts = q.options.map((o, i) => `
    <button class="opt ${b.eliminated.includes(i) ? 'gone' : ''}" data-act="answer" data-i="${i}">
      <span class="num">${i + 1}</span>
      <span class="label">${esc(o.label)}</span>
      <span class="val">${o.value}</span>
    </button>`).join('');

  show(`
    <div class="screen on">
      ${fighterBars()}
      <div class="q-mode">
        <span class="${isBlock ? 'block' : 'strike'}">${isBlock ? '▼ BLOCK — THEY\'RE COMING' : '▲ STRIKE — YOUR GO'}</span>
        <span class="dim">${esc(SPORTS[q.sport]?.name || q.sport)}</span>
      </div>
      <div id="timer-track"><div id="timer-fill"></div></div>
      <div class="q-prompt ${isBlock ? 'block' : ''}">${esc(isBlock ? q.least : q.most)}</div>
      <div class="q-hint ${isBlock ? 'block' : ''}">
        ${isBlock ? 'PICK THE SMALLEST NUMBER TO BLOCK' : 'PICK THE BIGGEST NUMBER TO HIT HARDEST'}</div>
      ${opts}
      <div class="btn-row">
        <button class="small-btn" data-act="nutmeg"
          ${G.run.player.nutmegs <= 0 || b.eliminated.length ? 'disabled' : ''}>
          NUTMEG (${G.run.player.nutmegs})</button>
      </div>
    </div>`);
  layout();
  startTimer();
}

function screenResolve() {
  const b = G.battle;
  const r = b.lastResult;
  stopTimer();

  let head, cls;
  if (r.sentOff) { head = 'SENT OFF — YOU WATCH THAT ONE GO PAST'; cls = 'bad'; }
  else if (r.timedOut) { head = 'TOO SLOW — THE WHISTLE WENT'; cls = 'bad'; }
  else if (r.phase === PHASE.STRIKE) {
    head = r.perfect ? 'SCREAMER!' : r.worst ? 'SCUFFED IT' : 'GOOD CONTACT';
    cls = r.perfect ? 'good' : r.worst ? 'bad' : 'mid';
  } else {
    head = r.perfect ? 'BLOCKED IT WELL' : r.worst ? 'CAUGHT FLUSH' : 'TOOK SOME OF IT';
    cls = r.perfect ? 'good' : r.worst ? 'bad' : 'mid';
  }

  const detail = r.sentOff
    ? `<p>You take <b style="color:var(--red)">${r.taken}</b>.</p>`
    : r.phase === PHASE.STRIKE
      ? `<p><b>${esc(r.option.label)}</b> — ${r.option.value} ${esc(r.unit)}
         → <b style="color:var(--gold)">${r.damage} DAMAGE</b>
         ${r.speed > 0.25 ? '<span class="dim">(quick off the mark)</span>' : ''}</p>`
      : `<p><b>${esc(r.option.label)}</b> — ${r.option.value} ${esc(r.unit)}
         → you take <b style="color:var(--red)">${r.taken}</b>
         ${r.blocked > 0 ? `<span class="dim">(${r.blocked} blocked)</span>` : ''}</p>`;

  const cardLine = r.card === 'red'
    ? '<div class="warn-strip red">RED CARD. You sit the next one out.</div>'
    : r.card === 'yellow'
      ? '<div class="warn-strip">BOOKED. One more and you\'re off.</div>' : '';

  show(`
    <div class="screen on">
      ${fighterBars()}
      <div class="feedback ${cls}">${esc(head)}</div>
      ${detail}
      ${!r.sentOff ? `<p class="small dim">Best answer was
        <b style="color:var(--green)">${r.correctValue} ${esc(r.unit)}</b>.</p>` : ''}
      ${cardLine}
      ${b.question && b.question.note && !r.sentOff ? `<div class="note">${esc(b.question.note)}</div>` : ''}
      <div class="btn-row"><button class="primary" data-act="advance">CARRY ON</button></div>
    </div>`);
  layout();
}

function screenBattleEnd(won) {
  stopTimer();
  const b = G.battle;
  const s = b.summary();
  const before = G.rung.stars;
  const vrep = won ? b.victoryRep() : 0;
  G.run.finishBattle(G.rung, b, won);
  const gained = G.rung.stars - before;
  if (won) sfx.win(); else sfx.lose();

  G.scene.foeDown = won;
  G.scene.playerDown = !won;
  const runOver = G.run.over;

  show(`
    <div class="screen on">
      <h2 style="color:${won ? 'var(--green)' : 'var(--red)'}">
        ${won ? 'HAVE THAT' : 'STRETCHERED OFF'}</h2>
      <p>"${esc(won ? b.foe.defeat : b.foe.taunt)}"</p>
      ${won ? `<div class="star-award">${starStr(G.rung.stars)}
        <span class="small dim">${gained > 0 ? `+${gained} this time` : 'no improvement'}</span></div>` : ''}
      <div class="stat-grid">
        <div class="stat"><span class="k">ANSWERED</span><span class="v">${s.answered}</span></div>
        <div class="stat"><span class="k">PERFECT</span><span class="v">${s.perfects}</span></div>
        <div class="stat"><span class="k">ACCURACY</span><span class="v">${Math.round(s.accuracy * 100)}%</span></div>
        <div class="stat"><span class="k">BEST COMBO</span><span class="v">×${s.bestCombo}</span></div>
        <div class="stat"><span class="k">REP</span><span class="v">${s.rep + vrep}</span></div>
        ${s.cards ? `<div class="stat"><span class="k">CARDS</span><span class="v" style="color:var(--red)">${s.cards}</span></div>` : ''}
      </div>
      ${!won ? '<p class="small dim">You lose energy and pick yourself up on 30% condition.</p>' : ''}
      <div class="btn-row">
        <button class="primary" data-act="${runOver ? 'results' : 'back-to-ladder'}">
          ${runOver ? 'SEE THE SCORE' : 'BACK TO THE LADDER'}</button>
      </div>
    </div>`);
  layout();
  updateHud();
}

// ── results / tables ───────────────────────────────────────────────────────
function screenResults() {
  G.screen = 'results';
  setHud(false);
  const r = G.run;
  if (!r.over) r.end('quit');
  const card = r.scoreCard();
  recordBeaten(r.defeatedIds);
  Object.assign(save, recordRun(card));
  const place = save.league.findIndex((x) => x.date === card.date) + 1;
  const headline = r.outcome === 'champion' ? 'CHAMPION OF THE LADDER'
    : r.outcome === 'energy' ? 'THAT\'S YOUR LOT' : 'FULL TIME';

  show(`
    <div class="screen on">
      <h1 style="font-size:17px">${headline}</h1>
      <p class="small dim">${esc(card.characterName)} · ${card.rungs}/${RUNGS} rungs ·
        ${card.stars}/${card.maxStars} stars</p>
      <div class="stat-grid">
        <div class="stat"><span class="k">REP</span><span class="v">${card.rep}</span></div>
        <div class="stat"><span class="k">WON</span><span class="v">${card.wins}</span></div>
        <div class="stat"><span class="k">LOST</span><span class="v">${card.losses}</span></div>
        <div class="stat"><span class="k">ACCURACY</span><span class="v">${Math.round(card.accuracy * 100)}%</span></div>
        <div class="stat"><span class="k">BEST COMBO</span><span class="v">×${card.bestCombo}</span></div>
        <div class="stat"><span class="k">ANSWERED</span><span class="v">${card.answered}</span></div>
      </div>
      <div class="card ${place === 1 ? 'gold' : ''}">
        <p class="small">${place === 1 ? 'TOP OF THE LEAGUE.' : `Number ${place || '—'} in the league table.`}</p>
        <p class="small dim">Ladder: <b style="color:var(--gold)">${esc(seedName(card.seed))}</b>
          — give that to someone else for the exact same climb.</p>
      </div>
      <div class="btn-row">
        <button class="primary" data-act="go-setup" data-mode="career">GO AGAIN</button>
        <button data-act="league">LEAGUE TABLE</button>
      </div>
      <div class="btn-row"><button data-act="title">BACK TO THE TITLES</button></div>
    </div>`);
  layout();
}

function screenLeague() {
  G.screen = 'league';
  setHud(false);
  const s = loadSave();
  const rows = s.league.length ? s.league.map((c, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td>${esc(c.characterName || c.name)}<br><span class="dim small">${esc(seedName(c.seed))}</span></td>
      <td class="n">${c.rep}</td>
      <td>${c.wins}-${c.losses}<br><span class="dim small">${c.stars ?? 0}★ · ${Math.round(c.accuracy * 100)}%</span></td>
    </tr>`).join('')
    : '<tr><td colspan="4" class="dim">Nothing on the board yet.</td></tr>';

  show(`
    <div class="screen on">
      <h2>LEAGUE TABLE</h2>
      <table>
        <thead><tr><th>#</th><th>FIGHTER / LADDER</th><th>REP</th><th>W-L</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="small dim">${s.totalRuns} day${s.totalRuns === 1 ? '' : 's'} out ·
        ${s.beaten.length}/${ROSTER.length} of the roster beaten. Saved on this device only.</p>
      <div class="btn-row">
        <button data-act="title">BACK</button>
        ${s.league.length ? '<button data-act="wipe">WIPE THE RECORD</button>' : ''}
      </div>
    </div>`);
}

function screenCodex() {
  G.screen = 'codex';
  const s = loadSave();
  const cards = ROSTER.map((f) => {
    const beaten = s.beaten.includes(f.id);
    return `
      <div class="card ${beaten ? 'green' : ''}">
        <div class="rung-head">
          <canvas class="portrait" data-fid="${f.id}" width="44" height="44"></canvas>
          <div style="min-width:0">
            <div class="rung-name" style="color:${beaten ? 'var(--green)' : 'var(--ink)'}">${esc(f.name)}</div>
            <span class="epithet">${esc(f.epithet)}</span>
          </div>
        </div>
        <div class="small dim">${esc(SPORTS[f.sport]?.name || 'ALL SPORTS')} ·
          TIER ${f.tier} · ${f.hp} COND · ${f.power} POWER ·
          ${Math.round(f.guile * 100)}% ACCURATE${beaten ? ' · <span style="color:var(--green)">BEATEN</span>' : ''}</div>
      </div>`;
  }).join('');

  show(`
    <div class="screen on">
      <h2>THE ROSTER</h2>
      <p class="small dim">Affectionate fakes, all of them. Nobody real was harmed.</p>
      <div class="btn-grid">${cards}</div>
      <div class="btn-row"><button data-act="${G.run && !G.run.over ? 'back-to-ladder' : 'title'}">BACK</button></div>
    </div>`);

  for (const cv of panel.querySelectorAll('canvas.portrait')) {
    const f = findFighter(cv.dataset.fid);
    if (!f) continue;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#2b2448'; c.fillRect(0, 0, 44, 44);
    drawFace(c, f, 1, 0, 42);
  }
}

// ── PvP ────────────────────────────────────────────────────────────────────
function pvpBars() {
  const m = G.match;
  return m.players.map((p, i) => `
    <div class="fighter-bar">
      <div class="row">
        <span class="nm" style="color:${i === 0 ? 'var(--green)' : 'var(--red)'}">
          ${esc(p.name)}${m.turn === i && m.phase !== PVP_PHASE.DONE ? ' ◀' : ''}</span>
        <span class="hpnum">${p.hp}/${p.maxHp}${p.combo > 1 ? ` · ×${p.combo}` : ''}</span>
      </div>
      <div class="hp-track"><div class="hp-fill ${i === 1 ? 'foe' : ''}" style="width:${pct(p.hp, p.maxHp)}"></div></div>
    </div>`).join('');
}

function screenPvpHandover() {
  G.screen = 'pvp';
  const m = G.match;
  show(`
    <div class="screen on">
      ${pvpBars()}
      <div class="card gold">
        <h2>PASS IT TO ${esc(m.active.name)}</h2>
        <p class="small dim">Round ${m.round}. Don't look until it's yours.</p>
      </div>
      <div class="btn-row"><button class="primary" data-act="pvp-begin">I'M ${esc(m.active.name)} — GO</button></div>
    </div>`);
  layout();
}

function screenPvpQuestion() {
  G.screen = 'pvp';
  const m = G.match;
  const q = m.question;
  const opts = q.options.map((o, i) => `
    <button class="opt" data-act="pvp-answer" data-i="${i}">
      <span class="num">${i + 1}</span>
      <span class="label">${esc(o.label)}</span>
      <span class="val">${o.value}</span>
    </button>`).join('');
  show(`
    <div class="screen on">
      ${pvpBars()}
      <div class="q-mode">
        <span class="strike">▲ ${esc(m.active.name)} — YOUR GO</span>
        <span class="dim">${esc(SPORTS[q.sport]?.name || q.sport)}</span>
      </div>
      <div id="timer-track"><div id="timer-fill"></div></div>
      <div class="q-prompt">${esc(q.most)}</div>
      <div class="q-hint">PICK THE BIGGEST NUMBER TO HIT HARDEST</div>
      ${opts}
    </div>`);
  layout();
  startTimer();
}

function screenPvpResolve() {
  stopTimer();
  const m = G.match;
  const r = m.lastResult;
  const who = m.players[r.by];
  show(`
    <div class="screen on">
      ${pvpBars()}
      <div class="feedback ${r.perfect ? 'good' : r.timedOut ? 'bad' : 'mid'}">
        ${r.timedOut ? 'TOO SLOW' : r.perfect ? 'SCREAMER!' : 'GOOD CONTACT'}</div>
      <p><b>${esc(who.name)}</b> picked <b>${esc(r.option.label)}</b> —
        ${r.option.value} ${esc(r.unit)} → <b style="color:var(--gold)">${r.damage} DAMAGE</b></p>
      <p class="small dim">Best answer was <b style="color:var(--green)">${r.correctValue} ${esc(r.unit)}</b>.</p>
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
      <div class="btn-row"><button class="primary" data-act="pvp-advance">CARRY ON</button></div>
    </div>`);
  layout();
}

function screenPvpDone() {
  const m = G.match;
  const w = m.players[m.winner], l = m.players[1 - m.winner];
  sfx.win();
  show(`
    <div class="screen on">
      <h1 style="font-size:18px">${esc(w.name)} WINS</h1>
      <div class="stat-grid">
        <div class="stat"><span class="k">${esc(w.name)} ACC</span><span class="v">${Math.round((w.perfects / Math.max(1, w.answered)) * 100)}%</span></div>
        <div class="stat"><span class="k">${esc(l.name)} ACC</span><span class="v">${Math.round((l.perfects / Math.max(1, l.answered)) * 100)}%</span></div>
        <div class="stat"><span class="k">ROUNDS</span><span class="v">${m.round}</span></div>
      </div>
      <div class="btn-row">
        <button class="primary" data-act="go-setup" data-mode="pvp">BEST OF THREE?</button>
        <button data-act="title">TITLES</button>
      </div>
    </div>`);
  layout();
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════════════════════════════════
function startTimer() { G.timer.running = true; G.timer.start = performance.now(); G.timer.lastTick = 0; }
function stopTimer() { G.timer.running = false; }

function tickTimer() {
  if (!G.timer.running) return;
  const el = $('timer-fill');
  if (!el) return;
  const elapsed = performance.now() - G.timer.start;
  const frac = Math.max(0, 1 - elapsed / ANSWER_MS);
  el.style.width = `${frac * 100}%`;
  el.className = frac < 0.22 ? 'panic' : frac < 0.5 ? 'warn' : '';
  const secs = Math.ceil((ANSWER_MS - elapsed) / 1000);
  if (secs <= 3 && secs !== G.timer.lastTick && secs > 0) { G.timer.lastTick = secs; sfx.tick(); }
  if (elapsed >= ANSWER_MS) {
    stopTimer();
    if (G.match && G.match.phase === PVP_PHASE.ANSWER) doPvpAnswer(worstIndexPvp(), ANSWER_MS);
    else if (G.battle) doAnswer(worstIndex(), ANSWER_MS);
  }
}

function worstIndex() {
  const b = G.battle;
  const vals = b.question.options.map((o) => o.value);
  return vals.indexOf(b.phase === PHASE.BLOCK ? Math.max(...vals) : Math.min(...vals));
}
function worstIndexPvp() {
  const vals = G.match.question.options.map((o) => o.value);
  return vals.indexOf(Math.min(...vals));
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function startRun() {
  const seed = makeSeedFrom(G.setup.seed);
  G.run = new Run({ seed, sports: G.setup.sports, characterId: G.setup.character, name: G.setup.name });
  G.battle = null; G.rung = null;
  savePrefs({ lastSports: G.setup.sports, lastCharacter: G.setup.character, lastName: G.setup.name });
  G.camX = rungPos(1).x - VIEW_W / 2;
  sfx.whistle();
  screenLadder();
}

function startPvp() {
  const n1 = ($('p1name')?.value || 'PLAYER 1').toUpperCase().slice(0, 10);
  const n2 = ($('p2name')?.value || 'PLAYER 2').toUpperCase().slice(0, 10);
  G.setup.name = n1; G.setup.name2 = n2;
  G.match = new PvpMatch(
    { ...CHARACTERS[0], name: n1 },
    { ...CHARACTERS[5], name: n2 },
    { sports: G.setup.sports });
  G.scene.venue = 'THE MAIN ARENA';
  G.scene.player = G.match.players[0];
  G.scene.foe = G.match.players[1];
  G.scene.playerDown = G.scene.foeDown = false;
  setHud(false);
  sfx.whistle();
  screenPvpHandover();
}

function moveRung(delta) {
  const r = G.run;
  if (!r || r.over) return;
  const target = r.at + delta;
  if (!r.ladder.available(target)) { sfx.blocked(); return; }
  r.moveTo(target);
  sfx.step();
  screenLadder();
}

function enterBattle() {
  const r = G.run;
  const rung = r.rung;
  if (!r.canAfford(ENTER_COST)) { sfx.blocked(); return; }
  r.spendEnergy(ENTER_COST);
  G.rung = rung;
  sfx.encounter();
  G.scene.venue = rung.venue;
  G.battle = new Battle(r.player, rung.fighter, {
    level: rung.level,
    sports: G.setup.sports,
    usedQuestions: r.usedQuestions,
    seed: (r.seed ^ (rung.n * 104729)) >>> 0,
  });
  G.scene.player = r.player;
  G.scene.foe = G.battle.foe;
  G.scene.playerDown = G.scene.foeDown = false;
  G.scene.playerPose = G.scene.foePose = null;
  G.scene.floaters.length = 0;
  setHud(true);
  updateHud();
  screenBattleIntro();
}

function doAnswer(i, forcedMs) {
  const b = G.battle;
  if (!b || b.phase === PHASE.RESOLVE || G.busy) return;
  if (b.eliminated.includes(i)) return;
  G.busy = true;
  stopTimer();

  const wasStrike = b.phase === PHASE.STRIKE;
  if (wasStrike) G.scene.playerPose = 'strike'; else G.scene.foePose = 'strike';

  G.run.spendEnergy(BATTLE_TURN_COST);
  const r = b.answer(i, forcedMs);

  setTimeout(() => {
    G.scene.playerPose = G.scene.foePose = null;
    if (wasStrike) {
      G.scene.foeFlash = 9;
      floater(`-${r.damage}`, 340, 140, r.perfect ? '#ffd24a' : '#f87171', r.perfect);
      if (r.perfect) sfx.crit(); else sfx.hit();
      shakeStage(r.perfect ? 1.7 : 1);
    } else {
      G.scene.playerFlash = 9;
      G.scene.playerPose = 'guard';
      floater(`-${r.taken}`, 96, 146, '#f87171', r.taken > 30);
      if (r.perfect) sfx.block(); else sfx.takeHit();
      shakeStage(r.perfect ? 0.6 : 1.4);
      setTimeout(() => { G.scene.playerPose = null; }, 420);
    }
    if (r.card) sfx.card();
    updateHud();
    G.busy = false;
    screenResolve();
  }, 280);
}

function advanceBattle() {
  const b = G.battle;
  const next = b.advance();
  if (next === PHASE.WON) { screenBattleEnd(true); return; }
  if (next === PHASE.LOST) { screenBattleEnd(false); return; }
  if (b.phase === PHASE.RESOLVE) {          // sent off — they got a free hit
    G.scene.playerFlash = 9;
    floater(`-${b.lastResult.taken}`, 96, 146, '#f87171', true);
    sfx.takeHit(); shakeStage(1.5); updateHud();
    screenResolve(); return;
  }
  screenQuestion();
}

function doPvpAnswer(i, forcedMs) {
  const m = G.match;
  if (!m || m.phase !== PVP_PHASE.ANSWER || G.busy) return;
  G.busy = true;
  stopTimer();
  const attacker = m.turn;
  if (attacker === 0) G.scene.playerPose = 'strike'; else G.scene.foePose = 'strike';
  const r = m.answer(i, forcedMs);
  setTimeout(() => {
    G.scene.playerPose = G.scene.foePose = null;
    if (attacker === 0) {
      G.scene.foeFlash = 9;
      floater(`-${r.damage}`, 340, 140, r.perfect ? '#ffd24a' : '#f87171', r.perfect);
    } else {
      G.scene.playerFlash = 9;
      floater(`-${r.damage}`, 96, 146, r.perfect ? '#ffd24a' : '#f87171', r.perfect);
    }
    if (r.perfect) sfx.crit(); else sfx.hit();
    shakeStage(r.perfect ? 1.7 : 1);
    G.busy = false;
    screenPvpResolve();
  }, 280);
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════════════════

panel.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  initAudio();
  switch (btn.dataset.act) {
    case 'title': sfx.back(); screenTitle(); break;
    case 'howto': sfx.select(); screenHowTo(); break;
    case 'go-setup': sfx.select(); screenSetup(btn.dataset.mode); break;
    case 'go-select':
      G.setup.seed = $('seedin')?.value || '';
      sfx.confirm(); screenSelect(); break;
    case 'pick':
      G.setup.character = btn.dataset.id; sfx.select(); screenSelect(); break;
    case 'league': sfx.select(); screenLeague(); break;
    case 'codex': sfx.select(); screenCodex(); break;
    case 'wipe':
      if (confirm('Wipe the league table and everything you have beaten? This cannot be undone.')) {
        wipeSave(); Object.assign(save, loadSave()); screenLeague();
      }
      break;
    case 'toggle-sport': {
      const s = btn.dataset.sport;
      const i = G.setup.sports.indexOf(s);
      if (i >= 0) G.setup.sports.splice(i, 1); else G.setup.sports.push(s);
      sfx.select(); screenSetup(G.setup.mode); break;
    }
    case 'start-run': sfx.confirm(); startRun(); break;
    case 'start-pvp': sfx.confirm(); startPvp(); break;
    case 'rung-prev': moveRung(-1); break;
    case 'rung-next': moveRung(1); break;
    case 'fight': sfx.confirm(); enterBattle(); break;
    case 'rest': {
      const res = G.run.takeRest();
      sfx.pickup();
      if (res) toast(res.kind === KIND.PHYSIO
        ? `PHYSIO — +${res.healed} CONDITION`
        : `CLUB SHOP — +${res.rep} REP, +1 NUTMEG`);
      updateHud(); screenLadder(); break;
    }
    case 'begin': sfx.confirm(); G.battle.begin(); screenQuestion(); break;
    case 'leg-it':
      sfx.back(); G.battle = null; G.rung = null;
      updateHud();
      if (G.run.over) screenResults(); else screenLadder();
      break;
    case 'answer': doAnswer(+btn.dataset.i); break;
    case 'nutmeg':
      if (G.battle.useNutmeg()) { sfx.select(); toast('NUTMEG — one option gone'); screenQuestion(); }
      break;
    case 'advance': sfx.select(); advanceBattle(); break;
    case 'back-to-ladder': G.battle = null; G.rung = null; screenLadder(); break;
    case 'end-day':
      if (confirm('End the day here and take your score?')) { G.run.end('quit'); screenResults(); }
      break;
    case 'results': screenResults(); break;
    case 'pvp-begin': sfx.confirm(); G.match.beginTurn(); screenPvpQuestion(); break;
    case 'pvp-answer': doPvpAnswer(+btn.dataset.i); break;
    case 'pvp-advance': {
      sfx.select();
      if (G.match.advance() === PVP_PHASE.DONE) screenPvpDone(); else screenPvpHandover();
      break;
    }
  }
});

$('btn-sound').addEventListener('click', () => {
  initAudio();
  setMuted(!isMuted());
  savePrefs({ muted: isMuted() });
  $('btn-sound').textContent = isMuted() ? '♪̸' : '♪';
});
$('btn-quit').addEventListener('click', () => {
  if (G.run && !G.run.over && confirm('End the day here and take your score?')) {
    G.run.end('quit'); screenResults();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  initAudio();
  if (G.screen === 'ladder') {
    if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); moveRung(-1); return; }
    if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); moveRung(1); return; }
  }
  if (e.key === 'm' || e.key === 'M') { $('btn-sound').click(); return; }
  if (['1', '2', '3'].includes(e.key)) {
    const i = +e.key - 1;
    const b = panel.querySelector(`[data-act="answer"][data-i="${i}"], [data-act="pvp-answer"][data-i="${i}"]`);
    if (b && !b.classList.contains('gone')) { e.preventDefault(); b.click(); }
    return;
  }
  if (e.key === 'n' || e.key === 'N') { panel.querySelector('[data-act="nutmeg"]:not([disabled])')?.click(); return; }
  if (e.key === 'Enter' || e.key === ' ') {
    const b = panel.querySelector('button.primary:not([disabled])');
    if (b) { e.preventDefault(); b.click(); }
  }
});

// swipe along the ladder
let touchStart = null;
stage.addEventListener('touchstart', (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
stage.addEventListener('touchend', (e) => {
  if (!touchStart || G.screen !== 'ladder') return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  if (Math.abs(dx) > 32) moveRung(dx < 0 ? 1 : -1);
  touchStart = null;
}, { passive: true });

// ═══════════════════════════════════════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════════════════════════════════════

function frame() {
  G.t++;
  tickTimer();
  if (G.scene.foeFlash > 0) G.scene.foeFlash--;
  if (G.scene.playerFlash > 0) G.scene.playerFlash--;
  for (let i = G.scene.floaters.length - 1; i >= 0; i--) {
    const f = G.scene.floaters[i];
    f.y += f.vy; f.life--;
    if (f.life <= 0) G.scene.floaters.splice(i, 1);
  }

  switch (G.screen) {
    case 'ladder': {
      const target = Math.max(0, Math.min(ladderWidth(RUNGS) - VIEW_W,
        rungPos(G.run.at).x - VIEW_W / 2));
      G.camX += (target - G.camX) * 0.14;
      drawLadderScene(ctx, G.run.ladder, G.run.at, Math.round(G.camX), G.t, G.run.player);
      break;
    }
    case 'select':
      drawSelectScene(ctx, {
        player: findCharacter(G.setup.character),
        foe: ROSTER[0],
        hint: 'TAP A FIGHTER BELOW',
      }, G.t);
      break;
    case 'battle':
    case 'pvp':
      drawBattleScene(ctx, G.scene, G.t);
      break;
    default:
      drawTitleScene(ctx, G.t);
      if (G.screen === 'title') drawTitleWordmark(ctx, G.t);
      break;
  }
  requestAnimationFrame(frame);
}

// Exposed for the browser playtest harness in tools/ and for poking about in
// devtools. Nothing in the game reads it.
window.GRANDSTAND = G;
window.GRANDSTAND.__forceResults = () => screenResults();

$('btn-sound').textContent = isMuted() ? '♪̸' : '♪';
document.fonts?.ready.then(layout);
screenTitle();
layout();
requestAnimationFrame(frame);
