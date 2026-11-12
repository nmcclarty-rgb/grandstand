// Stage Prem Wheel for publishing as a flat site, laid out exactly like Sticker Season's page (src/engine, src/ui, src/data, and
// at most one "../" in any import). In the repo, Prem Wheel imports the Sticker Season engine from "../../../stickers/...", which
// the Claude artifact viewer will not load, so for publishing the files are copied into one tree and the import paths rewritten.
//
//   node tools/stage.mjs [outDir]        default: ../.stage/blind-five
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const out = resolve(process.argv[2] ?? join(REPO, '.stage', 'blind-five'));
rmSync(out, { recursive: true, force: true });
const put = (rel, text) => { mkdirSync(dirname(join(out, rel)), { recursive: true }); writeFileSync(join(out, rel), text); };
const read = (p) => readFileSync(join(REPO, p), 'utf8');

// Sticker Season's files, unchanged
for (const f of ['cards', 'deck', 'hands', 'jokers', 'rng', 'scoring']) copyIn(`stickers/src/engine/${f}.js`, `src/engine/${f}.js`);
for (const f of ['badge', 'card', 'clubs', 'tips', 'tooltip']) copyIn(`stickers/src/ui/${f}.js`, `src/ui/${f}.js`);
copyIn('stickers/src/data/cards.json', 'src/data/cards.json');
function copyIn(from, to) { mkdirSync(dirname(join(out, to)), { recursive: true }); copyFileSync(join(REPO, from), join(out, to)); }

// Prem Wheel's files, with the imports rewritten
const fix = (s) => s
  .replace(/'\.\.\/\.\.\/\.\.\/stickers\/src\/engine\/([a-z]+\.js)'/g, "'../engine/$1'")
  .replace(/'\.\.\/\.\.\/\.\.\/stickers\/src\/ui\/([a-z]+\.js)'/g, "'./$1'")
  .replace(/'\.\.\/\.\.\/\.\.\/stickers\/src\/data\/cards\.json'/g, "'../data/cards.json'");
put('src/draft/draft.js', fix(read('draft/src/engine/draft.js')));
put('src/draft/bot.js', fix(read('draft/src/engine/bot.js')));
put('src/draft/attributes.js', fix(read('draft/src/engine/attributes.js')));
put('src/draft/tournament.js', fix(read('draft/src/engine/tournament.js')));
put('src/draft/pyramid.js', fix(read('draft/src/engine/pyramid.js')));
put('src/ui/wheel.js', read('draft/src/ui/wheel.js'));
put('src/ui/shirt.js', read('draft/src/ui/shirt.js'));
put('src/ui/tutorial.js', fix(read('draft/src/ui/tutorial.js')).replace(/'\.\.\/engine\/(draft|attributes)\.js'/g, "'../draft/$1.js'"));
put('src/ui/blind.js', fix(read('draft/src/ui/game.js')).replace("'../engine/draft.js'", "'../draft/draft.js'").replace("'../engine/bot.js'", "'../draft/bot.js'").replace("'../engine/attributes.js'", "'../draft/attributes.js'").replace("'../engine/tournament.js'", "'../draft/tournament.js'").replace("'../engine/pyramid.js'", "'../draft/pyramid.js'"));

// the page: both stylesheets inlined, as Sticker Season's page is
let html = read('draft/index.html');
const css = `${read('stickers/src/ui/style.css')}\n${read('draft/src/ui/style.css')}`;
html = html.replace(/ {2}<link rel="stylesheet" href="\.\.\/stickers\/src\/ui\/style\.css">\n {2}<link rel="stylesheet" href="src\/ui\/style\.css">/, `  <style>\n${css}\n  </style>`)
  .replace('src="src/ui/game.js"', 'src="src/ui/blind.js"').replace('<a href="../stickers/">Sticker Season</a>', 'Sticker Season');
if (/<link rel="stylesheet" href="(?!https:\/\/fonts\.googleapis\.com\/)/.test(html)) throw new Error('a local stylesheet link was left in the page');
put('index.html', html);

// every import in the staged tree must resolve to a staged file, with at most one "../"
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(out);
for (const f of files.filter((p) => p.endsWith('.js'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(f), m[1]);
    if (!files.includes(target)) throw new Error(`${f}: imports ${m[1]}, which is not in the staged tree`);
    if ((m[1].match(/\.\.\//g) ?? []).length > 1) throw new Error(`${f}: ${m[1]} climbs more than one level`);
  }
}
if (!/new URL\('\.\.\/data\/cards\.json', import\.meta\.url\)/.test(readFileSync(join(out, 'src/ui/blind.js'), 'utf8'))) throw new Error('blind.js does not fetch ../data/cards.json');
console.log(`staged ${files.length} files in ${out}`);
