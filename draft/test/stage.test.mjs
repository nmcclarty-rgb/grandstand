import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The Claude artifact viewer will not load scripts that climb several folders ("../../../"), so the published page is a flat tree
// like Sticker Season's, built by tools/stage.mjs. The script itself checks every import; this runs it.
test('the staged site is flat: every import resolves inside it and climbs at most one level', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'b5-')), 'site');
  const log = execFileSync('node', [new URL('../tools/stage.mjs', import.meta.url).pathname, out], { encoding: 'utf8' });
  assert.match(log, /staged 16 files/);
  for (const f of ['index.html', 'src/ui/blind.js', 'src/draft/draft.js', 'src/draft/bot.js', 'src/engine/rng.js', 'src/data/cards.json']) assert.ok(existsSync(join(out, f)), f);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="src\/ui\/blind\.js">/);
  assert.ok(!/<link rel="stylesheet"/.test(html), 'styles are inlined');
  for (const f of ['src/ui/blind.js', 'src/draft/draft.js', 'src/draft/bot.js']) assert.ok(!/\.\.\/\.\.\//.test(readFileSync(join(out, f), 'utf8')), `${f} has a deep import`);
});
