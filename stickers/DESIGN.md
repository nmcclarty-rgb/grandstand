# Sticker Season: design notes

Written down because the interesting decisions are in the numbers, and numbers get
changed by whoever touches the file last.

## The three rules

1. **A season is 38 games.** A run is 38 matchdays, as in the league. One fixture each, one target each.
   Every season in the data is also made a 38-game season (the first three were 42 games; see section 6).
2. **Only stats that exist for every season.** A stat with gaps is not used: not as a category, not on a
   card, not in a manager, not in the rating. The stats that survive: **goals, assists, games played, yellow
   cards, red cards.** Yellows and reds are combined into one category, **Discipline** (a yellow is 1 point,
   a red is 3), so there are four categories. Tests enforce this (`RULE:` in `test/`).
3. **One data source.** All 34 seasons come from FBref's Standard Stats table. An earlier build used a second
   source (the Fantasy Premier League archive) for 2016/17 onward; the two disagreed on assists for ~30% of
   players, handled mid-season transfers differently, and gave players different ids, so it was dropped.

## 1. The fusion

| | Borrowed | Becomes |
|---|---|---|
| **Balatro** | score targets, chips × mult, jokers, hand types, held-in-hand effects, shop between rounds | 38 fixtures with a target, managers, football hands, a keeper's Safe Hands, packs as the shop |
| **Top Trumps** | pick a stat, biggest number wins | every fixture names a category; a card's number in it is its chips |
| **Panini** | packs, shiny foils, a persistent album, swaps | pack odds and editions now; the album is **not built yet** |
| **Luck** | the spin | a wheel picks the category; **VAR** overturns it (section 5) |

A card is a **player-season**, not a player: "Henry, Arsenal 2003/04". That gives ~14,900 cards,
makes "team-mates" a real thing (same club *and* season), and lets one player be several cards,
which is what makes a Hat-trick possible. Ids are consistent across the whole data set, so a player's
2015/16 and 2016/17 cards are the same player (Kane: ten seasons, Milner: 23).

## 2. Chips and categories

`chips = round(stat × perUnit)` where `perUnit` is set per category so the **99th percentile is
worth 60 chips**. A card is worth chips in the fixture's category only, which is the Top Trumps tension.

| Category | Non-zero on | Notes |
|---|---|---|
| goals | 59% of cards | the hardest: most players score 0-3 |
| assists | 58% | |
| games played | ~100% | the easiest: everyone plays ~35, so a typical card is worth far more here |
| discipline | 81% | yellow cards 1 point + red cards 3 points; a typical card with a record has 3, the 99th percentile is 14, the most is 22 |

**Why Discipline is one category.** Red cards on their own were a category the design started with, and they were
the problem one: only 11% of cards had any, so most hands had nothing to score, and in the sim a Red round was won
77% of the time against 87-100% for the rest. Combining them (suggested in review) puts a score on 81% of cards,
keeps a red worth three yellows, and lifts the category to 97-98%. The top of the list is the right people: Batty
1997/98 (12 yellows, 3 reds), Phil Neville, Ndidi, Mulumbu. Goalkeepers do get booked (a mean of 0.9 points), so
they are not dead weight here. The card shows the points; hovering shows the split ("8 yellow, 0 red: 8 + 3 × 0").
The weights live in `DISCIPLINE_POINTS` in `cards.js`.

## 3. Hands

"Rank" is the team-season, "suit" is the club, a straight is consecutive seasons.
**Only the cards that make the hand score** (as in Balatro), so a kicker adds nothing.

| Hand | Needs | Base |
|---|---|---|
| The Invincibles | 5 from one team-season | 120 × 12 |
| Dynasty | 5 consecutive seasons, one club | 100 × 8 |
| Back Four | 4 from one team-season | 60 × 7 |
| Full Strength | 3 + 2 from two team-seasons | 40 × 4 |
| Club Side | 5 from one club, any seasons | 35 × 4 |
| Run of Seasons | 5 consecutive seasons, any clubs | 30 × 4 |
| Hat-trick | 3 cards of the same player | 30 × 3 |
| Triangle | 3 from one team-season | 30 × 3 |
| Spine | GK + DEF + MID + FWD (all cards score) | 20 × 3 |
| Double Act | two pairs of team-mates | 20 × 2 |
| One-Two | 2 from one team-season | 10 × 2 |
| Kickabout | nothing: only the best card scores | 5 × 1 |

Ordered by base value; that is also the priority when a hand matches several
(enforced by a test). Each training level adds a per-hand bonus (`lvl` in `hands.js`).

## 4. Scoring order

1. the hand's base chips and mult (at its level)
2. each scoring card, left to right: category chips → edition → every manager's per-card effect (a retrigger repeats all of it)
3. **cards held in your hand: a goalkeeper's Safe Hands**
4. each manager's per-hand effect, in manager order
5. `total = floor(chips × mult)`

Order matters because ×mult multiplies whatever is already there (tested). `scoreHand`
returns a `trace` of every step so the UI can show the working.

**Safe Hands (the goalkeeper's ability).** Goalkeepers score almost nothing in any category, so their job is
support. A goalkeeper **held in your hand** (not played) adds mult to every hand you play: **+3** if he played 30+
games (first choice), **+2** for 15-29 (rotation), **+1** under 15 (backup). It uses only `games`, which every
season has. It creates a real choice, because the keeper you need for a Spine is the keeper you would rather hold.
Measured before Discipline was combined (sim, 500 runs, Safe Hands on against off): the bare starter squad clears a median of 15 matchdays
against 13, random play 3 against 1, and Spine falls from 39% to 28% of plays. Late in a season a flat +3 matters
less next to managers (24 against 25 for a deck-building bot, which is inside the noise), so it is an
early-game aid. If it needs to scale, make it a multiplier.

**Editions** (rolled when a pack is opened): shiny +40 chips, holo +6 mult, gold ×1.5 mult.
**Managers** (15): Park the Bus, Route One, Sweeper Keeper, Total Football, One-Club Man,
Golden Boot, Playmaker, Added Time, Vintage Stickers (1990s cards), Super Sub, Captain's Armband and
four category specialists (Poacher, Creator, Ironman, Hard Man). Clean-sheet and save specialists were removed under rule 2.
No manager uses the yellow or red card counts directly yet (only through Hard Man's Discipline rounds).

## 5. A season

**38 matchdays.** Each is one fixture: 8 cards in hand, 4 hands, 3 discards, no reshuffle (Balatro's rules). The
target climbs geometrically from **100 on matchday 1 to 40,000 on matchday 38**, about 17% harder each time, rounded
to two significant figures. The end value is a tuning knob (`TARGET_END` in `round.js`), set with the sim on the real
economy: a shopping bot finishes 12% of seasons at 30,000, 4% at 40,000, 1% at 50,000 and none at 80,000.

**The flow** (`season.js`, a pure state machine the page, the tests and the bots all drive):

1. **Intro.** The wheel has picked the matchday's category. You may use VAR, then kick off.
2. **The fixture.** Reach the target within four hands.
3. **Win:** you are paid and the shop opens (after matchday 38 you are champions). **Lose:** you are sacked, and the
   season is over.

**The wheel.** One slice per category (equal weights, adjustable in `WHEEL`). Luck decides the fixture; the squad you
have built decides how well you cope, and building for more than one stat is the answer to the wheel.

**VAR.** You have **5 reviews a season**. VAR overturns the spin and spins again, to a **different** category.
Only before kick-off. Both bots spend all five every season, so it is scarce enough to matter.

**Money.** You start with £4. A win pays **£4 plus £1 for each hand you did not need** (£4 to £7).

**The shop**, after every win:

| Offer | Price | Notes |
|---|---|---|
| Sticker Pack | £4 | five stickers from anywhere |
| Club Pack | £6 | five stickers from clubs already in your squad |
| Squad Pack | £8 | five stickers from team-seasons already in your squad (this is how you build Back Four and Invincibles) |
| Manager | £4-£7 (their cost) | up to 5 slots; sell one for half |
| Training | £3 + £2 per level the hand already has | the hand you play most, plus one other. +chips and +mult every time you play it |
| Reroll | £2, then £3, £4... | replaces the stock |
| Release a sticker | £1 | thins the squad; the squad cannot go under 16 |

Two packs, two managers and two trainings are in stock; packs are Sticker / Club / Squad in the ratio 5:3:2. A pack
is opened at once and **you keep one of the five**.

*Why keep one, not two* (sim): a shopping bot reached a median of 29 matchdays keeping one and 27 keeping two. A
squad that bloats plays less reliably (the keep-two bot had 76 stickers by matchday 30), so keep-one is both simpler and
better. *Why training offers your favourite hand:* with a random hand on offer, the first shop offered "Training:
Kickabout" and the bot trained every hand once; offering the hand you play most lifted the shopping bot from a 2% to a
12% finish rate at the same targets, which is why the target curve was re-measured afterwards.

**Saving.** Everything random comes from labelled seed streams (spins, deals, shop stock, pack contents), so a seed
is a whole season and a save is small. The page saves in the shop and at each matchday intro (`localStorage`). A
fixture in progress is not saved: after a reload you kick off again and get the **same deal** (same seed).

**Starter squad**: 24 mid-table cards (rating 25-80): 3 clubs × 3 consecutive calendar seasons,
2 GK / 8 DEF / 8 MID / 6 FWD. Any era can supply one (every card has the same stats), so a squad
often mixes, say, Wimbledon 1996/97 with Burnley 2016/17.

## 6. Data

All 34 seasons from 1992/93 to 2025/26, one source: **FBref "Standard Stats" tables**, exported by hand
(Share & Export, Excel) into `data/fbref/`, two files per season. A test states the rule, so a missing season
fails by name. 14,897 cards, 3,983 players, 51 clubs; `cards.json` is about 3 MB (fine for a prototype page,
worth slimming before any release).

A card keeps: id, `pid` (the player), display name, full name, position, club, season, goals, assists,
games, yellow, red, rating. Nothing else; a test whitelists the fields.

- **FBref was not scrapeable.** It sits behind a Cloudflare challenge, which I did not try to defeat.
  The exports are saved by a person in a browser. FBref truncates an export at 499 rows (a season has ~560
  players), so each season needs two files: `1992-93.xls` (table as it comes) and `1992-93-z-a.xls` (click the
  Player header to reverse the sort, export again). `tools/fbref.mjs` merges them and refuses to continue if an
  overlapping row disagrees, if a season has a single export cut off at the 499-row cap, or if two truncated exports
  share no rows (a gap). The `.xls` is really an HTML table. **Export the "Standard Stats" table** (anchor
  `#all_stats_standard`); the other tables on the page (Playing Time, Shooting...) have no goals or assists, and the
  importer refuses them. The exports are git-ignored; `cards.json` is the derived product.
- **38 games.** 1992/93 to 1994/95 were 42-game seasons (22 clubs). Their goals, assists, games and cards are scaled by
  38/42 and rounded, so Sheringham's 21 goals show as 19 and Schmeichel's 42 games as 38. The real figure is in
  the test, with the scaling as part of the assertion. A test checks no card shows more than 38 games.
- **Mid-season movers get one card per club**, in every season (Sánchez 2017/18: 7 goals for Arsenal, 2 for
  Manchester United). Cameos under 270 minutes (three full games) are not cards.
- **`rating`** (1-99) is a percentile within position across the whole data set, from **one formula**:
  `2 × goals + assists + 0.15 × games`, and goalkeepers on games played. It is the headline number on the card
  and decides pack rarity. It is a rough guide: it flatters attackers, a keeper's rating only means "played a lot",
  and discipline does not count. A test checks it is monotonic in the formula and not skewed to an era.
- **Display names** come from the full name by a heuristic (last word, plus particles like van/del/Dalla/Boa, minus
  Jr./Sr., surname-first East Asian names like "Son Heung-min" read right), a table of 12 compound surnames the
  heuristic gets wrong, and a first initial for a surname shared by four or more players ("I.Wright", "A.Smith": 15%
  of cards). Pinned by tests; an odd one is a one-line fix in `build-cards.mjs`.
- **Why one source** (the evidence). Cross-checked over all ten seasons where the two overlapped (~3,500 matched
  players): goals agreed for 99.1% and games for 98.5%, so FBref is trustworthy. **Assists agreed for only 68.5%**
  (FPL has its own definition; FBref uses Opta's), mid-season transfers differed (FPL gave the whole season to the
  last club: Semenyo 2025/26 was 17 goals for Manchester City in FPL against 7 for them in FBref), and name-plus-club
  matching linked only 80% of players across the two. Using FBref throughout removes all three problems.
  The cross-check tool was removed with the second source.

**Before this goes public:** FBref's figures are Opta's, and Sports Reference's terms apply to republishing them.
The cards use real player names. Fine for a private prototype; a public release needs a licensing decision. Club
colours are used, but no crests, logos or photos: the art is a generic silhouette.

## 7. What the simulator found

`npm run simulate`: three bots, 500 runs each, deterministic from a seed, playing whole seasons **through the real
season engine** (spin, VAR, kick-off, payout, shop). `random` plays 1-5 random cards and never uses VAR. `greedy` plays
the best-scoring hand, discards when behind pace, never discards a keeper, and spends VAR when its deck is weak in the
spun category; it earns money but never shops. `greedy+` also shops: managers first, then training for its favourite
hand, then the best pack it can afford, keeping the one sticker that best fits its squad. It never rerolls or sells.

| Bot | Matchdays cleared (of 38) | Best 10% reach | Full seasons |
|---|---|---|---|
| random | median 4 | 7 | 0 / 500 |
| greedy, no shop | median 16 | 19 | 0 / 500 |
| greedy+, shops | median 31 | 36 | 19 / 500 (4%) |

1. **The curve works, and the shop is worth about 2x.** Random play is dead by matchday 4, a competent player on the bare
   starter squad runs out of steam around matchday 16, and shopping roughly doubles that. A few runs finish, which suits
   a roguelike.
2. **Category luck is no longer decisive.** With seven categories (four of them partial) the same starter squad won
   100% of Games rounds and about 2% of Saves rounds at one target. With four complete categories, a wheel and VAR:

   | category | greedy | greedy+ |
   |---|---|---|
   | goals | 80% | 95% |
   | assists | 87% | 95% |
   | games | 100% | 99% |
   | discipline | 98% | 97% |

   The spread is goals at the bottom and games at the top, about 20 points for the bare squad and 4 for a built deck.
   Combining yellow and red cards into Discipline took that slice from 77% to 98% (section 2).
3. **Starter squad shape drives the hand mix.** With 4 team-seasons of 6 cards (the first attempt), Back Four and
   Full Strength were 73% of all plays, i.e. the aspirational hands were routine. 3 clubs × 3 seasons is the only
   shape tried that spreads plays across Full Strength, Club Side, Run and the pair hands.
4. **Spine is still too reliable. Open problem.** It is 28% of the greedy bot's plays and 50% of greedy+'s (unchanged by Discipline), because it
   scores 4-5 cards where a pair scores 2 and the deck is small enough (24 cards, 3 discards) to fish for the one
   keeper. Safe Hands helped a little (39% to 28% for the bare squad) by making the keeper worth holding. Candidates:
   score only one card per position; require 5 cards; make keepers rarer in packs; or accept it as the bread-and-butter
   hand and let managers and training make the group hands outscale it. Needs a human playtest.
5. **Money is not what limits the shopping bot.** It fills all five manager slots by matchday 5, then buys packs, and ends
   every shop with about £8 unspent. By matchday 30 it holds 46 stickers (from 24). So prices could be harsher without
   changing the sim, and the real constraint is choosing well: which manager, which hand to train, which sticker to
   keep. That is a design question for a human playtest. The bot's release heuristic made no measurable difference, so
   release is a player tool, not something the economy leans on.
6. **Never made by either bot:** Invincibles, Back Four, Dynasty. They need deck-building the bot doesn't do
   (collecting several seasons of one club or one player). That is the intent (they are the chase) but it means
   they are untested under real play. Because players now keep one id across 2016, a Hat-trick or Dynasty can span
   any seasons of a career.

## 8. Not built

The sticker album (persistence between seasons, page completion, perks) · swaps · boss-fixture rules · sound ·
managers that use yellow and red card counts directly · a way to earn or buy more VAR · interest on saved money ·
anything that spends the unspent £8 the bot ends each shop with · a second pair of eyes: **nobody has playtested this
yet except bots**. The first human season is the most valuable thing to do next.
