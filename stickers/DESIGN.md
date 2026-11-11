# Sticker Season: design notes

Written down because the interesting decisions are in the numbers, and numbers get
changed by whoever touches the file last.

## The three rules

1. **A season is 38 games.** A run is 38 matchdays, as in the league. One fixture each, one target each.
   Every season in the data is also made a 38-game season (the first three were 42 games; see section 6).
2. **Only stats that exist for every season.** A stat with gaps is not used: not as a category, not on a
   card, not in a manager, not in the rating. The five that survive: **goals, assists, games played,
   yellow cards, red cards.** Tests enforce this (`RULE:` in `test/`).
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
| goals | 59% of cards | |
| assists | 58% | |
| games played | ~100% | the easiest: everyone plays ~35, so a typical card is worth far more here |
| yellow cards | 80% | every position gets booked, goalkeepers included |
| red cards | 11% | the hardest: most cards have none, and the best have 3-4 |

Red cards are the sparse one. Left alone they would behave like the "Saves" category an earlier design
had, where most decks could not score. They are playable only because VAR and the base hand chips
cover the early fixtures; in the sim a Red round is won 77% of the time against 87-100% for the rest.
If it turns out to feel bad, the wheel slice can be made smaller (`WHEEL` in `round.js`).

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
Measured (sim, 500 runs, Safe Hands on against off): the bare starter squad clears a median of 15 matchdays
against 13, random play 3 against 1, and Spine falls from 39% to 28% of plays. Late in a season a flat +3 matters
less next to managers (24 against 25 for a deck-building bot, which is inside the noise), so it is an
early-game aid. If it needs to scale, make it a multiplier.

**Editions** (rolled when a pack is opened): shiny +40 chips, holo +6 mult, gold ×1.5 mult.
**Managers** (14): Park the Bus, Route One, Sweeper Keeper, Total Football, One-Club Man,
Golden Boot, Playmaker, Added Time, Vintage Stickers (1990s cards), Super Sub, Captain's Armband and
three category specialists (Poacher, Creator, Ironman). Clean-sheet and save specialists were removed under rule 2.
No manager uses the card stats yet.

## 5. A season

**38 matchdays.** Each is one fixture: 8 cards in hand, 4 hands, 3 discards, no reshuffle (Balatro's
rules). The target climbs geometrically from **100 on matchday 1 to 40,000 on matchday 38**, about
19% harder each time, rounded to two significant figures. The end value is a tuning knob (`TARGET_END` in
`round.js`): at 25,000 about 9% of a deck-building bot's seasons finish, at 40,000 about 1.4%, at 55,000 0.4%,
at 70,000 none (500 runs each).

**The wheel.** Before each fixture a wheel picks the category, one slice each (equal, adjustable weights). Luck
decides the fixture; the deck you have built decides how well you cope, and building for more than one stat is
the answer to the wheel.

**VAR.** You have **5 reviews a season**. VAR overturns the spin and spins again, to a **different** category.
Only before you play a hand. It is the player's agency against the wheel, and it is scarce on purpose.
(Sim: both bots spend all five every season, so five may be too few, or the bot policy too eager. A human will tell.)

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

`npm run simulate`: three bots, 500 runs each, deterministic from a seed. The wheel picks every category.
`random` plays 1-5 random cards. `greedy` plays the best-scoring hand, discards when behind pace, never discards a
keeper, and spends VAR when its deck is weak in the spun category. `greedy+` is `greedy` plus a pack after each win
(keeps the two cards that best fit its deck), and every 5th matchday a random manager and a training level for its
favourite hand.

| Bot | Matchdays cleared (of 38) | Best 10% reach | Full seasons |
|---|---|---|---|
| random | median 3 | 6 | 0 / 500 |
| greedy, starter squad only | median 15 | 18 | 0 / 500 |
| greedy+ | median 25 | 34 | 7 / 500 (1.4%) |

1. **The curve works.** Random play is dead by matchday 3, a competent player on the bare starter squad runs out of
   steam around matchday 15, and building a deck gets about 1.7x that. A few runs finish, which suits a roguelike.
2. **Category luck is no longer decisive.** With seven categories (four of them partial) the same starter squad won
   100% of Games rounds and about 2% of Saves rounds at one target. With five complete stats, a wheel and VAR:

   | category | greedy | greedy+ |
   |---|---|---|
   | goals | 87% | 95% |
   | assists | 93% | 96% |
   | games | 100% | 99% |
   | yellow cards | 100% | 98% |
   | red cards | **77%** | 90% |

   Red is the weak one, as expected from section 2.
3. **Starter squad shape drives the hand mix.** With 4 team-seasons of 6 cards (the first attempt), Back Four and
   Full Strength were 73% of all plays, i.e. the aspirational hands were routine. 3 clubs × 3 seasons is the only
   shape tried that spreads plays across Full Strength, Club Side, Run and the pair hands.
4. **Spine is still too reliable. Open problem.** It is 28% of the greedy bot's plays and 50% of greedy+'s, because it
   scores 4-5 cards where a pair scores 2 and the deck is small enough (24 cards, 3 discards) to fish for the one
   keeper. Safe Hands helped a little (39% to 28% for the bare squad) by making the keeper worth holding. Candidates:
   score only one card per position; require 5 cards; make keepers rarer in packs; or accept it as the bread-and-butter
   hand and let managers and training make the group hands outscale it. Needs a human playtest.
5. **Never made by either bot:** Invincibles, Back Four, Dynasty. They need deck-building the bot doesn't do
   (collecting several seasons of one club or one player). That is the intent (they are the chase) but it means
   they are untested under real play. Because players now keep one id across 2016, a Hat-trick or Dynasty can span
   any seasons of a career.

## 8. Not built

Run loop and shop · the sticker album (persistence, page completion, perks) · swaps · boss-fixture rules ·
sound · saving · managers that use yellow and red cards · a way to earn or buy more VAR.
