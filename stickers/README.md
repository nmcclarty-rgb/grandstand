# STICKER SEASON (working title)

**Balatro × Top Trumps × Panini**, on the Premier League. Build a squad of player
stickers, play up to five a hand against a stat category, and make the chips × mult
climb past each fixture's target, over a **38-game season**.

**It is playable.** A full 38-matchday season: a wheel picks the stat, you play hands against a target, and between
matchdays you shop for packs, managers and training. See [DESIGN.md](DESIGN.md) for the rules, the data and what the
balance simulator found.

```bash
cd stickers
npm test             # 115 tests: hand rules, exact scoring arithmetic, managers, rounds, the wheel, data anchors, the design rules
npm run simulate     # bots play whole 38-game seasons; prints where the target curve breaks
npm run build:data   # data/fbref/*.xls -> src/data/cards.json (cards.json is committed, so you can skip this)
npm start            # then open http://localhost:8778 and play
```

Plain ES modules, no build step, no dependencies (Node 22+ for the tests and tools).

```
src/engine/   rng · cards (categories, editions, Safe Hands) · hands · jokers (managers) · scoring · round (wheel, VAR) · deck
              season (the whole run: shop, money, saving) · advisor (best hand, for Hint and the bots)
src/ui/       the card face (card.js, badge.js, tips.js, tooltip.js), club colours, the game page (game.js)
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
**VAR** overturns a spin you don't like: five a season. Win a matchday and you are paid and can shop; lose one and you are sacked.
