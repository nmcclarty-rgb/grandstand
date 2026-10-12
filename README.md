# GRANDSTAND — Trivia Athletic

A turn-based sports-quiz RPG for people who remember when *Grandstand* started
at twelve and finished when the football results came in.

Pick a fighter, then climb a ladder of people who were on the telly in 1987.
Every rung is settled with a quiz — and **the answer you pick is the damage you
do**.

> *Who scored more Premier League goals — Robbie Fowler, Andy Cole, or Les Ferdinand?*
>
> Pick Cole (187) and you land 187 goals on his chin. Pick Ferdinand (149) and
> you still connect, just softer. There's no "wrong", only "soft".

16-bit arcade pixel art, no build step, plays in a browser on a phone.

---

## Playing it

**Play it:** <https://nmcclarty-rgb.github.io/grandstand/>

**As a file:** `docs/index.html` is the whole game in one
self-contained file — no server, no install, no module loading. Download it and
open it. It works from a USB stick, an email attachment or `file://`; the only
thing it fetches from the network is two Google Fonts, and it falls back to a
monospace stack without them. The playtest suite is run against both the
multi-file source and the bundle, including from a `file://` URL, so "it only
works on a dev server" can't creep in.

**Working on it:**

```bash
python3 -m http.server 8777     # or: npx serve . -l 8777
open http://localhost:8777      # loads src/ directly, no build step
npm run build                   # regenerate docs/index.html
```

Source is plain ES modules — no bundler, no framework, no install needed to
develop or play. `npm install` is only for the browser playtest.

Starting a run is two taps: **START A DAY OUT**, pick a fighter, **FIGHT**.
Winning carries you up to the next rung automatically; the left arrow takes you
back down if you want a better star rating.
If a friend sends you their ladder code, there's a disclosure on the select
screen to type it in; leave it alone for a random ladder.

**Keys:** `◀` `▶` move along the ladder · `1` `2` `3` answer · `N` nutmeg ·
`Enter` continue · `M` mute. On a phone: tap the arrows, swipe the ladder, tap
the answers.

---

## The loop

**Music.** Three original pieces, synthesised at runtime like everything else:
a brass-led march for the titles and menus, a lighter walk for the ladder, and
a faster minor-key theme for fights. Two toggles in the status bar — `♬` for
music, `♪` for everything — because plenty of people want the effects without
a soundtrack.

**The studio.** The game opens on a Saturday-afternoon sports programme: the
monitor stack, the orbiting set graphics, the gallery working away behind, and
**Des Rider** at the desk. He is the spine of the whole thing — he introduces
every rung, reacts to every result and signs the afternoon off, which is what
turns a list of twelve fights into an afternoon of television rather than a
menu. `src/data/host.js`.

**Choose your fighter.** Eight of them, Street Fighter II style, and the choice
is mechanical rather than cosmetic — the Keeper's perfect blocks let almost
nothing through, the Statistician carries seven nutmegs, Touchline Dad hits
like a lorry and takes 15% extra. See `src/data/characters.js`.

**The ladder (PvE).** Twelve rungs, seeded, getting harder as you climb, with
a boss at the top. Rungs 4 and 11 are the treatment room — a choice of three, including a gamble
that beats both safe options when it lands and is worse than either when it
doesn't. Rung 8 is a water break: one button, straight energy. Walking
out to face someone costs 10 energy and every exchange costs 1 more, so a
player who answers well finishes fights sooner and gets further up. When you can no longer afford a fight and there's no
restorative rung left in reach, the day ends on its own and the score goes to
the league table.

**Stars.** Three per rung: one for winning, one for answering well, one for
finishing in decent nick. Cleared rungs can be replayed for a better rating,
which is the only reason to ever climb back down — and it costs energy, so it
is a real decision rather than free grinding.

**The arena matches the opponent.** You fight the snooker player in a club,
over a lit table; the runner on a track with lane markings; the darts player in
a tap room with a board on the wall. Thirteen arenas, each with its own palette
and set dressing, keyed off the opponent's sport — so a rung's venue follows
*who* you are fighting rather than *where* you are on the ladder.
`tools/arenacheck.html` renders all of them on one page.

**The fight.** A three-beat countdown runs between the two fighters and hands
straight over to the first question — no button to press to start. Then turns
alternate, and so does the question:

| Your turn | **STRIKE** | *"Who scored the MOST…"* | Pick the **biggest** number. It's your damage. |
| Their turn | **BLOCK** | *"Who scored the FEWEST…"* | Pick the **smallest** number to take the sting out. |

Getting those two the wrong way round at speed is the entire skill ceiling, and
it is a more interesting failure than not knowing the answer.

On top of that: a 12-second clock worth up to +50% damage, a combo multiplier
up to ×2 for perfect answers in a row, and a **yellow card** if you pick the
outright worst option. Two yellows and you sit an exchange out. Three
**nutmegs** a day knock a duff option off the board and leave you a 50:50.

**Sports.** Every run uses the whole bank. The filter plumbing is still there —
`Ladder` and `Battle` both take a list of sports, and `validate.mjs` warns when
any one sport is too thin to support a run on its own — but nothing sets it.
Single-sport runs are a later feature and this is the hook for them.

---

## Why the damage is normalised

Raw stat values are wildly different in scale — Tendulkar's 15,921 Test runs
versus the 5 Olympic rings. If the number were literally the damage, a cricket
question would one-shot a boss and a darts question would tickle him. So
damage is rank-normalised *within the question*:

```
ratio = 0.25 + 0.75 × (value − min) / (max − min)
```

Best answer is 1.00×, worst is 0.25×, whatever the units. The raw number is
still shown, big, because that's the fantasy — "260 GOALS" landing on someone's
chin. Full reasoning in [DESIGN.md](DESIGN.md).

---

## On the names

The opponents are affectionate fakes: Tank Bruno, Sally Gunner, Nigel
Moustachio, Eddie the Seagull, Daley Thompsen. Nobody real is depicted and no
likeness is used — the sprites are generated from a shared humanoid template
and a palette.

The **questions** are about real people and real records, which is different
and fine: sporting facts aren't anyone's property. But see the health warning
below.

---

## Keeping the bank honest

**The question bank has not been fact-checked by a human.** It was written from
memory and needs a verification pass before this goes anywhere near players.
Two principles are baked in and worth keeping:

1. **Prefer retired players and closed records.** A bank full of active players
   rots — every number is wrong within a season. Where a figure is a moving
   target it's marked approximate in the note.
2. **No ties.** Two options sharing the top value makes "the best answer"
   ambiguous and the damage maths wrong. `tools/validate.mjs` fails the build
   on this, and it caught eight of them the first time it ran.

A few entries are explicitly approximate (career totals, weeks at number one,
years on air) and say so in their note. Those are the ones to check first.

---

## Tools

```bash
npm run validate   # content checks: ties, units, prompt direction, coverage
npm run balance    # simulate whole ladder climbs at four skill levels
npm run build      # regenerate the single-file docs/index.html
npm run playtest   # drive a real browser through a whole run
```

`playtest` takes a target, so the same suite covers both builds:

```bash
node tools/playtest.mjs http://localhost:8777              # multi-file source
node tools/playtest.mjs http://localhost:8777/docs/         # the bundle
node tools/playtest.mjs "file://$PWD/docs/index.html"       # no server at all
```

`validate` is the one that matters. Data is what will break this game, not
code — it checks for ties, missing units, prompts that don't say which way
round they're asking, perks the engine doesn't actually read, and ladders that
put the same opponent on two rungs running.

`balance` plays whole ladders, energy and all. The curve it's tuned to:

```
SKILL                     RUNGS/12  CHAMPION%  STARS/36
clueless   (33%, slow)         7.5         0%     17.4
pub quiz   (55%, 7s)           9.3        15%     24.3
decent dad (70%, 5s)          11.1        59%     30.1
encyclopaedic (90%, 3s)       12.0        99%     34.3
```

A clueless player never lifts it; a decent one usually does; nobody runs out of
stars to chase. Two caveats the tool prints itself: the simulated player
answers at a fixed speed so banks a very consistent clock bonus, and it never
spends a nutmeg — which makes THE STATISTICIAN look far worse than it plays.

---

## Layout

```
index.html              dev shell, all the CSS, the arcade chrome
docs/index.html         the whole game as one file (generated — edit src/)
src/
  main.js               boot, screens, input, the frame loop
  data/questions.js     98 questions — the content engine
  data/roster.js        20 opponents
  data/characters.js    8 playable fighters and their perks
  data/host.js          Des Rider, and everything he says
  engine/render.js      canvas: select screen, ladder, battle, title
  engine/sprites.js     procedural sprites and portraits, no image assets
  engine/palette.js     five-tone colour ramps — the art style in one file
  engine/audio.js       WebAudio bleeps, no audio files
  engine/music.js       three original themes, synthesised at runtime
  engine/rng.js         seeded RNG so a ladder can be shared
  game/ladder.js        the twelve rungs
  game/battle.js        turn-based combat, the damage model, perks
  game/state.js         run state, scoring, localStorage
tools/                  validate · balance · bundle · playtest
                        artcheck.html · arenacheck.html
```

The built single file lands at `docs/index.html` because GitHub Pages' "deploy
from a branch" mode serves only the repo root or `/docs`, and the root is
already the development shell. One settings click, no CI.

`tools/bundle.mjs` is a ~100-line CommonJS-style bundler with no dependencies.
It understands only the import/export forms this codebase uses and **throws**
on anything else, because a bundler that silently drops an export is far worse
than one that refuses to run. Re-run `npm run build` and commit `docs/` after
any change to `src/`, or the hosted page drifts from the source.

`tools/artcheck.html` renders every portrait, sprite pose and select-grid face
on one page. Open it after touching `sprites.js` — it is much faster than
finding a broken mullet mid-fight.

No images, no audio files, no fonts of our own — the only external request is
two Google Fonts. Everything visual is drawn from code, which is why the whole
game is a few hundred kilobytes and why a new opponent costs about fifteen
lines of data.
