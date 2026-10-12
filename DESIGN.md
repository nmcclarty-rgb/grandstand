# GRANDSTAND — design notes

Written down because the interesting decisions in this game are all in the
numbers, and numbers get changed by whoever touches the file last.

---

## 1. The core idea, and the trap in it

> *"Multiple choice where the answer is always a whole number. The answer the
> player picks is the hit points against the opponent."*

That's the pitch, and it's a good one, because it collapses two things into
one: the quiz answer and the combat roll are the same act. No "you answered
correctly, now roll for damage". You pick Alan Shearer and 260 goals go into
someone's ribs.

The trap is that **real sporting numbers have no common scale**:

| Question | Range |
|---|---|
| Test runs | 13,289 – 15,921 |
| Premier League goals | 149 – 260 |
| World darts titles | 3 – 16 |
| Olympic rings | 5 |

Taken literally, one cricket question ends any fight in the game and a snooker
question does nothing. You'd have to either restrict the bank to questions
whose numbers happen to sit in a combat-friendly range — which throws away most
of the good trivia — or normalise.

**We normalise, within the question:**

```
ratio = 0.25 + 0.75 × (value − min) / (max − min)
damage = power × ratio × (1 + speed) × combo × (perfect ? 1.5 : 1)
```

Best answer 1.00×, worst 0.25×, regardless of units. The floor of 0.25 rather
than 0 matters: **there is no wrong answer, only a soft one.** A dad who thinks
Fowler outscored Cole still lands a punch. That's the difference between a quiz
that punishes you and a quiz that lets you play.

The raw number is still the hero of the presentation — "ANDY COLE — 187 GOALS
→ 42 DAMAGE" — so the fantasy survives the arithmetic underneath it.

**Consequence:** ties are a content bug, not a curiosity. If two options share
the top value, "the best answer" is ambiguous and the normalisation divides by
a smaller range than it should. `tools/validate.mjs` fails on ties. It found
eight on its first run.

---

## 2. Alternating MOST and FEWEST

The obvious design is: you answer, you hit; they attack, you take it. That's
half a game — the opponent's turn is something that happens *to* you.

Instead every opponent turn is a **BLOCK**: the same question format, flipped.
*"Who scored the FEWEST…"* Pick the smallest number and you take 25% of the
incoming hit; pick the biggest and you wear all of it.

This does three things:

1. **You're never idle.** Every turn in the fight is a decision.
2. **It creates a skill ceiling that isn't knowledge.** Knowing that Shearer
   got 260 is trivia. Remembering *which way round you're being asked* while a
   12-second clock runs down is a game. Experienced players fail here, not on
   the facts, which is exactly where you want a quiz game's difficulty to live.
3. **It doubles the bank for free.** 98 questions, 196 prompts.

Because the block prompt is the one the player reads in isolation, it has to
stand alone. Writing both by hand produced 55 prompts reading *"Who won
FEWER?"* with no noun in them. The block prompt is now **derived** from the
strike prompt by word substitution (`MOST`→`FEWEST`, `MORE`→`FEWER`, `OLDEST`→
`YOUNGEST`, `MOST recently`→`EARLIEST`). Write one good sentence, get two.

The UI also states the direction under every question — *PICK THE BIGGEST
NUMBER TO HIT HARDEST*. Confusing the two should be a lapse of concentration,
never a failure of the interface.

---

## 3. A ladder, not a dungeon

The first build read "map" as a place and gave you a tile overworld to walk
around. Wrong instinct. The reference points are the Street Fighter II select
screen and a level-progression path: the map is a **route**, not a room, and
the only navigation decision that matters is *which opponent next*.

So: twelve rungs, seeded, harder as you climb, boss at the top. You move along
it with two arrows. That's it.

What the ladder buys that the dungeon didn't:

- **Every screen is about a person.** The ladder screen shows you who is next,
  their epithet, their sport, their stats and their taunt. The dungeon screen
  showed you a car park.
- **Difficulty is legible.** Rung 9 is obviously harder than rung 2. In a
  free-roam map the player has no idea whether the bloke in the corner will
  flatten them.
- **The route is shareable.** A seed is now a specific run of twelve names, in
  order, which is a thing two people can actually compare.

**Stars** do the job the dungeon's side rooms used to. Three per rung — one for
winning, one for answering well, one for finishing in decent nick — and you can
climb back down to improve a rating. That's the whole reason to move backwards,
and because a rematch costs energy like anything else, it's a real trade rather
than free grinding.

### Why an energy budget rather than lives

Energy is a much better run-limiter than health for this audience, because it
prices **everything**, including the rematch. Walking out to face someone costs
10 and every exchange costs 1 more, so a player who answers well finishes
fights in fewer exchanges and gets further up the ladder on the same tank. Skill
converts directly into distance, without a separate XP system.

Health (`CONDITION`) still exists, but losing a fight doesn't end the day — it
costs energy and drops you to 30%. Getting beaten by Tank Bruno should be a
setback, not a game over. Forty-something dads play in twenty-minute windows; a
run that ends abruptly at minute four is a run they don't restart.

**Rung 11 is a physio, and that is the single most important number in the
file.** Tuning showed a clear failure mode: a decent player reached the boss
about 10 rungs in, on fumes, and lost to attrition rather than to the
questions. Raising the energy budget didn't fix it — past about 130 the budget
stopped being the binding constraint at all. Putting a physio immediately
before the final did:

```
                          RUNGS/12  CHAMPION%      with rung-11 physio
clueless   (33%, slow)         7.5         0%   ->    7.5     0%
pub quiz   (55%, 7s)           9.0         0%   ->    9.3    15%
decent dad (70%, 5s)          10.2         9%   ->   11.1    59%
encyclopaedic (90%, 3s)       11.6        62%   ->   12.0    99%
```

Losing the last fight of the day should feel like losing the last fight of the
day, not like running out of petrol.

---

## 4. Cards, combos, nutmegs

Three modifiers, each doing a specific job:

- **The clock (+50% max)** stops the optimal play from being "sit and think for
  a minute". It decays linearly, so there's a real speed/accuracy trade.
- **Combos (up to ×2)** reward a run of perfect answers and make a strong
  player's fight *visibly* shorter. Streaks are what make a quiz feel good.
- **Cards** punish only the *outright worst* pick — not a middling one. Two
  yellows is a red and you sit an exchange out. It's the one genuinely punitive
  mechanic, and it's aimed at guessing rather than being wrong.
- **Nutmegs (3 a day)** remove one duff option for a 50:50. A knowledge game
  needs an escape hatch, or a question you simply don't know is dead air. The
  scarcity is the decision: burn one on Sally Gunner or save it for the boss.

---

## 5. Getting the art out of 8-bit and into 16-bit

The first build was too far down the pixel hole — NES, not arcade. The target
is the Street Fighter II select screen and a modern cartoon level map: still
pixels, but *painted* pixels. Four changes did nearly all of it, and none of
them required an artist.

**1. Every colour is a five-tone ramp, not a swatch.** `palette.js` turns one
base colour into darkest/dark/base/light/lightest, with shadows drifting cool
and highlights drifting warm. Flat fills read as 8-bit; a lit side and a shaded
side read as 16-bit. This is the whole style in about forty lines.

**2. Silhouettes are built from row profiles, not rectangles.** A head is a
rounded crown tapering through the cheek to a jaw (`HEAD_PROFILE`); a torso is
a V from shoulder to waist (`TORSO_TAPER`). The first version drew both as
plain boxes, and boxes are exactly what makes generated art look generated.

**3. Every sprite gets an automatic ink outline**, traced from its own
silhouette after drawing. One function, applied to all twenty-eight characters,
and it's the single biggest "reads as a proper sprite" upgrade per line of code
in the project.

**4. Sprites are cached.** Each variant renders once into an offscreen canvas.
That's what makes 1 and 3 affordable — the outline pass needs a `getImageData`
read-back, which you could not do every frame.

Resolution went from 320×180 to 480×270 and battle sprites from 2× to 3×, so a
marquee opponent now actually fills the screen.

**Backgrounds break the pixel grid on purpose.** Skies are gradients, trees and
path ribbons are curves, the ladder badges are bevelled and glossy. That mix —
crisp characters on painted backdrops — is what an arcade cabinet looked like,
and it's what the level-map reference is doing too. Keeping everything on the
same chunky grid would be more *consistent* and less *right*.

**The one rule we knowingly break:** the final scale-to-fit is not an integer.
Snapping to whole-number scales would mean scale 1 on a 420px phone — a postage
stamp in a black frame. We fit the space and let `image-rendering: pixelated`
do the snapping. Some source pixels end up a device pixel wider than their
neighbours. Nobody notices that; everybody notices a tiny picture.

**Still generated, still deliberate.** One humanoid template, a four-colour
palette, a build, a hair style, facial hair, a brow and one held item gives
twenty-eight distinct-looking characters for about fifteen lines of data each.
A solo project that needs twenty commissioned sprite sheets before it's
playable is a project that never gets playtested; this one was balanced against
a simulation before it had a single asset. Hand-authored sprites are the
eventual upgrade, and the renderer is the thing you'd replace.

`tools/artcheck.html` renders every portrait, pose and grid face on one page.
Every art bug in this section — boxy heads, floating mullets, a blond beard
that read as a bar across the mouth, hair clipped off the top of the select
panel — was found by looking at that page, not by playing.

---

## 6. What's deliberately not built

**Online PvP.** The brief asks for PvP and this ships hot-seat only. Online
competitive trivia needs a server, an account system, matchmaking, and —
critically — **anti-cheat for a game where the answer is one search away**.
That last one isn't a feature, it's the entire design problem: any real-time
online quiz has to assume a second device. The honest routes are asynchronous
(both players answer the same seeded set, compare after) or a much shorter
clock. Both are real work and neither is a prototype. Hot-seat is what two
people in a pub will actually use anyway.

**Persistent progression.** Rep, stars and a league table persist; nothing else
does. Meta-progression (permanent upgrades, unlockable fighters) is the obvious
next hook and deliberately absent until the core fight is proven fun. Adding
upgrades to an unproven loop just hides whether the loop works. Character
select is the natural place to hang it when the time comes — locked portraits
in the grid are the oldest trick in the arcade.

**Audio beyond bleeps.** WebAudio square waves and noise. Music would be a
licensing conversation, and this doesn't need one yet.

---

## 7. The bit that will actually decide whether this works

Not the combat maths, and not the art. **The question bank.**

98 questions is a demo. A player doing 7 fights a day at ~8 questions a fight
sees ~56 in a session — more than half the bank in one sitting. The repeat is
noticeable on day two.

Rough targets:

- **500** to stop within-session repeats being obvious
- **2,000+** for a game someone plays for a month
- **Per-sport minimum of ~80**, or the sport filters are a trap: picking
  "darts only" currently gives you five questions and a bad time. `validate.mjs`
  warns below a floor for exactly this reason.

That's a content job, not an engineering one, and it's the thing to cost
properly before anything else. The format is deliberately cheap to write to —
sport, one sentence, three names, three whole numbers, one line of colour — and
`validate.mjs` will catch the ties and the missing units automatically.

The 40-something dad audience is also unusually unforgiving here: they will
know when a number is wrong, and they will tell you. Get the bank verified.
