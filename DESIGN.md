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

Winning moves you up a rung without being asked. Standing on someone you have
just beaten and having to press right is a tax on the common case — nearly
everyone wants the next fight. Going back for a better rating is the rarer
choice, so that is the one that costs a press, and the left arrow is right
there. The same goes for the ladder screen's buttons: it is down to a single
action, because an end-the-day control already sits in the status bar and the
roster is a thing you browse between runs, not during one.

### Rest rungs are decisions too

The treatment room began as one button that healed you, which made it a rung
you walked through rather than played. It is now three: a safe heal, a trade of
health for stamina, and a gamble that gives you a full tank 60% of the time and
costs you energy the rest.

The gamble is the interesting one, because it is the only place in the game
where the player takes a risk that isn't a question. At 60/40 it is correct to
take when you are badly hurt and wrong when you are nearly full, which is a
real decision rather than a coin you flip for fun.

**Not every rung should be a choice, though.** The other rest rung got the same
three-option treatment — rep, nutmegs or energy — and it was wrong. Those were
three ways of saying "have a reward" rather than three things to weigh, and a
menu that doesn't make you think is just a slower button. It is now a water
break: one action, straight energy, which is the resource that actually runs
out. The rule that fell out of it is worth keeping — a choice earns its screen
when the options pull against each other, and not otherwise.

That change moved the difficulty, as any change to the energy economy does: a
free +30 took a decent player from 59% to 74% champion. Settling the water
break at +16 put the curve back where it was (0 / 11 / 62 / 99 across the four
skill levels). Anything touching energy needs `npm run balance` afterwards.

### Running out is an ending, not a wall

Energy ran the run down, but the run only *ended* at exactly zero. Land on 7
with fights costing 10 and you were alive, on the ladder, with every button
disabled and nothing to press — a dead end dressed up as a game state. A run
now ends the moment you cannot afford a fight and no restorative rung is still
in reach, and goes straight to the scorecard. Reachability matters: a physio
three rungs up you can't get to is not a lifeline.

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

### Nothing between you and the question

The fight used to open on a screen with SECONDS OUT and LEG IT on it. Both were
dead weight. You had already committed — and paid the energy — by choosing to
fight on the ladder, so LEG IT was an undo for a decision nobody regrets, and
SECONDS OUT was a button whose only job was to say "yes, still". A three-beat
countdown does the same framing work, puts it where you are already looking
(between the two fighters), and costs no input at all.

The caption under the numbers went the same way. Every version of it either
collided with the far fighter's gloves or washed out against the crowd, and
"3 - 2 - 1" has never needed explaining.

## 4b. The host

The ladder gave the game a shape. Des Rider gives it a voice.

He is not decoration. A progression screen that says "RUNG 7 OF 12" is a menu;
the same screen with *"A marquee name now, and the crowd knows it"* over the
top is an afternoon of television. He introduces every rung, reacts to the
result, nags you when the energy runs low, and signs off at the end — about
fifty lines in `src/data/host.js`, picked by context rather than at random, so
the boss gets boss lines and a narrow win gets a backhanded compliment.

Three decisions worth keeping:

- **The register is specific.** Unhurried, faintly pompous, treats a pub quiz
  as the Olympic final. That voice is the single strongest piece of audience
  targeting in the game — it is doing more for the 40-something dad than any
  mechanic does.
- **He is a composite, not an impersonation.** The name is a mash of two
  presenters, the station ident is ours, and no real broadcaster's marks appear
  anywhere. Same principle as the roster.
- **His mouth moves while he talks and stops when he's done.** A tiny thing,
  but a static portrait beside a line of dialogue reads as a label; a moving
  one reads as a person.

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

### The music

Three pieces, all synthesised: a march for the titles, a lighter walk for the
ladder, a faster minor-key theme for fights. They are deliberately the same
band — same brass patch, same kit — at different tempos and densities, so
moving between screens feels like one programme rather than three games.

The one technical point worth keeping: notes are scheduled with **lookahead**,
not with a `setTimeout` per note. A tick every 25ms commits anything falling in
the next 120ms directly to the WebAudio clock. Driving a sequencer off the JS
clock sounds drunk under any load at all, and the one thing a march cannot be
is late.

Music has its own bus and its own toggle, separate from effects. A soundtrack
is much more intrusive than a bleep, and plenty of people want one without the
other — particularly the audience for this, who may well be playing with the
actual football on in the background.

## 5b. Editions

**An edition is a different game with the same rules, not a filter.**

The obvious way to ship "Premier League '90s" is a checkbox that keeps only
football questions. That gives you Dixie Dean, Just Fontaine and the 1966 World
Cup alongside Tony Yeboya, which is not the thing the name promises. So an
edition carries its own question bank, its own roster, its own venue names and
its own backdrop, and `src/data/editions.js` is the only place that knows about
any of it. The ladder, the battle system and the UI all read from there, so a
third track is a data file and a roster, not a change to the engine.

Three things turned out to matter:

**It needs its own roster.** A '90s track where you fight a snooker player is
immediately a mode rather than a game. `roster.js` tags every fighter with an
`edition`, and `byTier`/`bosses` take one.

**It needs its own backdrop.** Reusing the football arena would have worked and
would have been forgettable. The `prem90s` arena is a separate set: lattice
floodlight pylons, mown stripes converging on the far touchline, perimeter
hoardings nobody could read from the terraces, and the roof stanchion you did
not get a refund for.

**The bank has to be big enough for a whole climb.** A full twelve-rung day
burns about seventy questions. The first draft of the '90s bank was 52, which
meant `pickQuestion` exhausted the pool and wrapped round inside a single run —
the player sees the same question twice in an afternoon, which reads as a bug
whatever the intent. It went to 101. The rule, for the next edition: **a bank
smaller than about a hundred is a demo, not a track.**

The balance curve was checked separately rather than assumed. `balance.mjs`
simulates a full climb per edition, and the '90s track lands at 53% champion
for a decent dad against 58% on the classic ladder — close enough to leave
alone, and a touch harder for the honest reason that a football-only bank has
no soft sports to fall back on.

Des Rider gets a couple of lines per edition. He is the thread through the
whole thing, and a new track he never acknowledges feels like a different
programme.

## 6. What's deliberately not built

**PvP, for now.** A hot-seat mode was built and has been removed at the
author's request, to keep the single-player climb the thing that gets polished.
The mechanic is worth recording for whoever brings it back: symmetric turns, no
block phase, with a "pass the device" screen between goes so nobody reads over
a shoulder. It is a small file to rebuild.

**Online** PvP is a different proposition entirely, and the reason is worth
stating before anyone promises it. It needs a server, accounts and matchmaking,
and — critically — **anti-cheat for a game where the answer is one search
away**. That last one isn't a feature, it's the whole design problem: any
real-time online quiz has to assume a second device. The honest routes are
asynchronous (both players answer the same seeded set, compare after) or a much
shorter clock. Both are real work.

**Sport filters.** Built, then taken out of the player's way. Every run is all
sports, because a filter screen between "I want to play" and playing is a tax
paid by everyone to serve a minority, and nobody picks a filter on their first
go. The engine still takes the parameter, so single-sport runs come back as a
mode you choose into rather than a form you fill in.

**Persistent progression.** Rep, stars and a league table persist; nothing else
does. Meta-progression (permanent upgrades, unlockable fighters) is the obvious
next hook and deliberately absent until the core fight is proven fun. Adding
upgrades to an unproven loop just hides whether the loop works. Character
select is the natural place to hang it when the time comes — locked portraits
in the grid are the oldest trick in the arcade.

**Licensed music.** The obvious thing to want is the actual theme from the
actual programme. That is a specific composition and still in copyright, and a
close rework of it is the same problem wearing a hat — the thing a rights
holder objects to is the tune, not the filename. So the three pieces in
`music.js` are original, written in the idiom rather than from the source:
brass-led fanfare, walking bass, snappy kit, relentlessly major. Genre is free;
melodies are not. If this ever wants the real thing, that is a licensing
conversation with a publisher, and a cheap one by the standards of games —
but it is a conversation, not a patch.

---

## 7. The bit that will actually decide whether this works

Not the combat maths, and not the art. **The question bank.**

The bank is at **205 across 14 sports**, up from 98. A player doing ~9 fights a
day at ~8 questions a fight sees about 70 in a session, so a single sitting no
longer shows you most of it — which was the state it was in before.

Rough targets from here:

- **500** to stop within-session repeats being obvious across several sittings
- **2,000+** for a game someone plays for a month
- **Per-sport minimum of ~80** before single-sport runs can ship. Every sport
  is now at 12 or more and `validate.mjs` fails below 8 and warns below 12; the
  floor should keep rising as the bank grows.

### Making verification tractable

Saying "this needs fact-checking" in a README achieves nothing; it is a note to
nobody. So the bank now carries the machinery to actually get it done.

Every question has three new fields. A **stable id** derived from its own
content. A **source hint** — the standard reference work for that sport, named
rather than linked, because a link rots and a name does not. And a **risk
rating**, assigned automatically: definitional questions (scoring values, team
sizes) are low, closed records held by retired players are medium, and anything
either flagged approximate in its own note or attached to someone still
competing is high. That last rule reads a short list of active names, so
retiring someone is a one-line edit.

`tools/checklist.mjs` turns that into a tick-box list ordered by risk, as
markdown and as CSV. It will not be finished in one sitting, so the top of it
has to be the part that matters.

The detail that makes the scheme worth having is that **ids are derived from
content**. Sign-off lives in `verified.json` keyed by id, so correcting a
number changes its id and automatically drops that question back onto the
checklist — and `validate.mjs` warns about any sign-off left pointing at
nothing. A verification scheme that can silently go out of date is worse than
none, because it tells you the bank is clean when it isn't.

What it cannot do is check anything. That still needs a person with a
reference work, and it is still the largest open risk in the project.

### What the expansion taught us

Expanding the bank proved the tooling's worth more than anything else has. Adding
~110 questions in one go produced, immediately and automatically: three ties
for the top or bottom value, six prompts that didn't say which way round they
were asking, and five questions that duplicated existing ones outright. Every
one of those is invisible on the page and obvious in a fight. That is the
argument for `validate.mjs` in one paragraph — content is where this game will
break, and the only defence that scales is a machine that reads all of it every
time.

That's a content job, not an engineering one, and it's the thing to cost
properly before anything else. The format is deliberately cheap to write to —
sport, one sentence, three names, three whole numbers, one line of colour — and
`validate.mjs` will catch the ties and the missing units automatically.

The 40-something dad audience is also unusually unforgiving here: they will
know when a number is wrong, and they will tell you. Get the bank verified.
