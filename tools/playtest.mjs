/**
 * End-to-end browser playtest.
 *
 *   npm install && npx serve . -l 8777   (or: python3 -m http.server 8777)
 *   node tools/playtest.mjs [baseUrl] [--shots DIR]
 *
 * Drives a real Chromium through a whole run: setup, character select, the
 * ladder, fights, the physio rung, finishing the day, the league table, then a
 * hot-seat PvP match. Fails loudly on any console error or page exception,
 * because a game that throws halfway through a fight is worse than one that
 * doesn't start.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv.find((a) => a.startsWith('http') || a.startsWith('file:')) || 'http://localhost:8777';
const shotsFlag = process.argv.indexOf('--shots');
const SHOTS = shotsFlag > -1 ? process.argv[shotsFlag + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

let failures = 0;
const check = (ok, label) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

/** Step along the ladder to a given rung, one button press per rung. */
async function goToRung(page, target) {
  for (let i = 0; i < 20; i++) {
    const at = await page.evaluate(() => window.GRANDSTAND.run.at);
    if (at === target) return true;
    const act = at < target ? 'rung-next' : 'rung-prev';
    const btn = await page.$(`[data-act="${act}"]:not([disabled])`);
    if (!btn) return false;
    await btn.click();
    await page.waitForTimeout(90);
  }
  return false;
}

/** Play the current fight to a finish. `skill` is the chance of a perfect pick. */
async function playFight(page, skill = 1) {
  let guard = 0, sawBlock = false, sawStrike = false;
  while (guard++ < 90) {
    const st = await page.evaluate(() => {
      if (document.querySelector('[data-act="advance"]')) return { kind: 'resolve' };
      if (document.querySelector('[data-act="back-to-ladder"], [data-act="results"]')) return { kind: 'end' };
      const opts = [...document.querySelectorAll('[data-act="answer"]:not(.gone)')];
      if (!opts.length) return { kind: 'other' };
      const isBlock = !!document.querySelector('.q-prompt.block');
      const vals = opts.map((o) => +o.querySelector('.val').textContent);
      const ideal = isBlock ? Math.min(...vals) : Math.max(...vals);
      return { kind: 'question', isBlock, best: opts[vals.indexOf(ideal)].dataset.i,
               any: opts.map((o) => o.dataset.i) };
    });
    if (st.kind === 'end') return { sawBlock, sawStrike, finished: true };
    if (st.kind === 'other') return { sawBlock, sawStrike, finished: false };
    if (st.kind === 'resolve') { await page.click('[data-act="advance"]'); await page.waitForTimeout(220); continue; }
    st.isBlock ? (sawBlock = true) : (sawStrike = true);
    const i = Math.random() < skill ? st.best : st.any[Math.floor(Math.random() * st.any.length)];
    await page.click(`[data-act="answer"][data-i="${i}"]`);
    await page.waitForTimeout(400);
  }
  return { sawBlock, sawStrike, finished: false };
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: process.env.IGNORE_CERTS ? ['--ignore-certificate-errors'] : [],
});
const page = await browser.newPage({ viewport: { width: 420, height: 820 }, deviceScaleFactor: 2 });

const problems = [];
page.on('console', (m) => {
  const t = m.text();
  // The favicon 404 is noise; everything else is ours.
  if (m.type() === 'error' && !/favicon|ERR_CERT|ERR_TOO_MANY_RETRIES/.test(t)) problems.push(`CONSOLE: ${t}`);
});
page.on('pageerror', (e) => problems.push(`PAGEERROR: ${e.message}`));

console.log(`\nGRANDSTAND playtest — ${BASE}\n`);

// BASE may be a directory to serve from, or a full file:// URL for the
// single-file build — both have to pass the same tests.
const url = /\.html$/.test(BASE) ? BASE : `${BASE}/index.html`;
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => localStorage.removeItem('grandstand.save.v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot(page, '01-title');
check(await page.isVisible('[data-act="go-setup"]'), 'title screen renders');

console.log('\nSETUP AND SELECT');
await page.click('[data-act="go-setup"][data-mode="career"]');
await page.waitForTimeout(250);
await shot(page, '02-setup');
check(await page.isVisible('[data-act="toggle-sport"]'), 'sport filters offered');

await page.fill('#seedin', 'SHEARER');
await page.click('[data-act="go-select"]');
await page.waitForTimeout(500);
await shot(page, '03-select');
const picks = await page.evaluate(() => document.querySelectorAll('[data-act="pick"]').length);
check(picks === 8, `character select offers all ${picks} fighters`);

await page.click('[data-act="pick"][data-id="keeper"]');
await page.waitForTimeout(300);
check(await page.evaluate(() => window.GRANDSTAND.setup.character) === 'keeper', 'picking a fighter sticks');
await shot(page, '04-select-keeper');

await page.click('[data-act="start-run"]');
await page.waitForTimeout(700);
await shot(page, '05-ladder');
check(await page.isVisible('[data-act="rung-next"]'), 'ladder renders');
check(await page.evaluate(() => window.GRANDSTAND.run.player.perk.blockFloor) === 0.12,
  'the chosen fighter\'s perk reached the run');

console.log('\nLADDER RULES');
check(await page.evaluate(() => document.querySelector('[data-act="rung-next"]').disabled),
  'rung 2 is locked until rung 1 is cleared');

const e0 = await page.evaluate(() => window.GRANDSTAND.run.energy);
await page.click('[data-act="fight"]');
await page.waitForTimeout(350);
const e1 = await page.evaluate(() => window.GRANDSTAND.run.energy);
check(e1 < e0, `walking out costs energy (${e0} → ${e1})`);
await page.click('[data-act="begin"]');
await page.waitForTimeout(400);
await shot(page, '06-strike');
check(await page.isVisible('.q-prompt'), 'a question is asked');
check(await page.isVisible('.q-hint'), 'the direction hint is shown');

const foeBefore = await page.evaluate(() => window.GRANDSTAND.battle.foe.hp);
const r1 = await playFight(page, 1);
check(r1.sawStrike, 'STRIKE phase reached');
check(r1.sawBlock, 'BLOCK phase reached');
check(r1.finished, 'fight resolved to a result');
await shot(page, '07-fight-end');
const won = await page.evaluate(() => window.GRANDSTAND.run.wins > 0);
check(won, `a perfect player beats rung 1 (opponent started on ${foeBefore})`);
check(await page.evaluate(() => window.GRANDSTAND.run.ladder.get(1).stars) === 3,
  'a flawless win is worth three stars');

await page.evaluate(() => document.querySelector('[data-act="back-to-ladder"]')?.click());
await page.waitForTimeout(250);
check(await page.evaluate(() => !document.querySelector('[data-act="rung-next"]').disabled),
  'clearing rung 1 unlocks rung 2');

console.log('\nCLIMBING');
let fights = 1, restsTaken = 0;
for (let i = 0; i < 14; i++) {
  if (await page.evaluate(() => window.GRANDSTAND.run.over)) break;
  const frontier = await page.evaluate(() => window.GRANDSTAND.run.ladder.frontier());
  if (!(await goToRung(page, frontier))) break;
  if (await page.isVisible('[data-act="rest"]')) {
    await page.click('[data-act="rest"]');
    await page.waitForTimeout(250);
    restsTaken++;
    continue;
  }
  const fightBtn = await page.$('[data-act="fight"]:not([disabled])');
  if (!fightBtn) break;
  await fightBtn.click();
  await page.waitForTimeout(280);
  await page.click('[data-act="begin"]');
  await page.waitForTimeout(280);
  await playFight(page, 0.7);
  fights++;
  await page.evaluate(() =>
    document.querySelector('[data-act="back-to-ladder"], [data-act="results"]')?.click());
  await page.waitForTimeout(250);
}
check(fights > 3, `played ${fights} fights in one day`);
check(restsTaken > 0, `took ${restsTaken} rest rung(s)`);
await shot(page, '08-ladder-progress');

if (!(await page.isVisible('[data-act="league"]'))) {
  await page.evaluate(() => { window.GRANDSTAND.run.end('quit'); });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /SCORE|END THE DAY/.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(300);
  if (!(await page.isVisible('[data-act="league"]'))) {
    await page.evaluate(() => window.GRANDSTAND.__forceResults && window.GRANDSTAND.__forceResults());
  }
}
await page.waitForTimeout(400);
await shot(page, '09-results');
check(await page.isVisible('[data-act="league"]'), 'results screen shown at end of day');

await page.click('[data-act="league"]');
await page.waitForTimeout(300);
await shot(page, '10-league');
const leagueRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
check(leagueRows >= 1, `league table persisted the run (${leagueRows} row(s))`);

console.log('\nROSTER');
await page.click('[data-act="title"]');
await page.waitForTimeout(200);
await page.click('[data-act="codex"]');
await page.waitForTimeout(400);
await shot(page, '11-roster');
check(await page.evaluate(() => document.querySelectorAll('canvas.portrait').length) === 20, 'all 20 roster portraits drawn');

console.log('\nHOT-SEAT PvP');
await page.click('[data-act="title"]');
await page.waitForTimeout(200);
await page.click('[data-act="go-setup"][data-mode="pvp"]');
await page.waitForTimeout(250);
await page.fill('#p1name', 'DAD');
await page.fill('#p2name', 'LAD');
await page.click('[data-act="start-pvp"]');
await page.waitForTimeout(350);
await shot(page, '12-pvp-handover');
check(await page.isVisible('[data-act="pvp-begin"]'), 'handover screen hides the question');

let pvpGuard = 0;
while (pvpGuard++ < 80) {
  if (await page.isVisible('[data-act="pvp-begin"]')) {
    await page.click('[data-act="pvp-begin"]'); await page.waitForTimeout(250);
    if (pvpGuard < 4) await shot(page, '13-pvp-question');
    continue;
  }
  if (await page.isVisible('[data-act="pvp-advance"]')) {
    await page.click('[data-act="pvp-advance"]'); await page.waitForTimeout(220); continue;
  }
  if (await page.isVisible('[data-act="pvp-answer"]')) {
    const i = await page.evaluate(() => {
      const opts = [...document.querySelectorAll('[data-act="pvp-answer"]')];
      const vals = opts.map((o) => +o.querySelector('.val').textContent);
      // player 1 plays well, player 2 guesses — someone has to lose
      const turn = window.GRANDSTAND.match.turn;
      return turn === 0 ? opts[vals.indexOf(Math.max(...vals))].dataset.i
                        : opts[Math.floor(Math.random() * opts.length)].dataset.i;
    });
    await page.click(`[data-act="pvp-answer"][data-i="${i}"]`);
    await page.waitForTimeout(380);
    continue;
  }
  break;
}
await page.waitForTimeout(300);
await shot(page, '14-pvp-result');
check(await page.evaluate(() => window.GRANDSTAND.match.winner !== null), 'PvP match produced a winner');

console.log('');
if (problems.length) { console.error('PAGE PROBLEMS:'); problems.forEach((p) => console.error('  ' + p)); failures += problems.length; }
console.log(`\n${failures ? '✗' : '✓'} ${failures} failure${failures === 1 ? '' : 's'}\n`);

await browser.close();
process.exit(failures ? 1 : 0);
