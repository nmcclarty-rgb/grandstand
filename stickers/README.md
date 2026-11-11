# STICKER SEASON (working title)

**Balatro × Top Trumps × Panini**, on the Premier League. Build a squad of player
stickers, play up to five a hand against a stat category, and make the chips × mult
climb past each fixture's target.

This folder is the **engine prototype**: the cards, the scoring maths, a balance
simulator and a tabletop page to feel it with. There is no run loop, shop or album
yet. See [DESIGN.md](DESIGN.md) for the rules, the data caveats and what the
simulator found.

```bash
cd stickers
npm run fetch        # download the FPL season files (raw, git-ignored)
npm run build:data   # FPL + data/fbref/*.xls -> src/data/cards.json (committed, so you can skip the two above)
npm test             # 63 tests: hand rules, exact scoring arithmetic, managers, rounds, data anchors
npm run simulate     # bots play whole runs; prints where the target curve breaks
npm run crosscheck   # FBref vs FPL where they overlap (needs exports in data/fbref/overlap/)
npm start            # http://localhost:8778 : the tabletop
```

Plain ES modules, no build step, no dependencies (Node 22+ for the tests and tools).

```
src/engine/   rng · cards (categories, editions) · hands · jokers (managers) · scoring · round · deck
src/ui/       card renderer, club colours, tabletop
src/data/     cards.json: one card per player-season: every season 1992/93 to 2025/26
data/fbref/   hand-exported FBref tables (git-ignored); see DESIGN.md §6 for how to add a season
tools/        fetch-data · fbref (export reader) · clubs · build-cards · simulate · crosscheck
test/         node:test suites
```

## What it is, in one paragraph

A **card is a player in a season** ("Salah, Liverpool 2017/18", 32 goals). Each
fixture names a **category** (Goals, Assists, Clean Sheets…) and each card's number in
it becomes chips. Cards that share a club-season, a club, a run of seasons or a
player form **hands** with a multiplier; **managers** bend the arithmetic;
**editions** (shiny, holo, gold) are the Panini foils. Reach the target in four hands.
