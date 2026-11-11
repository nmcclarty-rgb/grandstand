# STICKER SEASON (working title)

**Balatro × Top Trumps × Panini**, on the Premier League. Build a squad of player
stickers, play up to five a hand against a stat category, and make the chips × mult
climb past each fixture's target, over a **38-game season**.

This folder is the **engine prototype**: the cards, the scoring maths, a balance
simulator and a tabletop page to feel it with. There is no run loop, shop or album
yet. See [DESIGN.md](DESIGN.md) for the rules, the data caveats and what the
simulator found.

```bash
cd stickers
npm test             # 83 tests: hand rules, exact scoring arithmetic, managers, rounds, the wheel, data anchors, the design rules
npm run simulate     # bots play whole 38-game seasons; prints where the target curve breaks
npm run build:data   # data/fbref/*.xls -> src/data/cards.json (cards.json is committed, so you can skip this)
npm start            # http://localhost:8778 : the tabletop
```

Plain ES modules, no build step, no dependencies (Node 22+ for the tests and tools).

```
src/engine/   rng · cards (categories, editions, Safe Hands) · hands · jokers (managers) · scoring · round (wheel, VAR) · deck
src/ui/       card renderer, club colours, tabletop
src/data/     cards.json: one card per player-season, every season 1992/93 to 2025/26
data/fbref/   the 34 season exports, two files each (git-ignored; see DESIGN.md section 6)
tools/        fbref (export reader) · clubs · build-cards · simulate
test/         node:test suites
```

## What it is, in one paragraph

A **card is a player in a season** ("Salah, Liverpool 2017/18", 32 goals). A run is a **38-game season**.
Before each matchday a **wheel** picks a **category** (goals, assists, games or discipline, which is yellow cards at 1 point and red cards at 3), and each
card's number in it becomes chips. Cards that share a club-season, a club, a run of seasons or a player form
**hands** with a multiplier; **managers** bend the arithmetic; **editions** (shiny, holo, gold) are the Panini foils.
A **goalkeeper held in your hand** (not played) adds mult to every hand you play. Reach the target in four hands.
**VAR** overturns a spin you don't like: five a season.
