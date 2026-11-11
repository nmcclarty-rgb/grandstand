# Sticker Season: design notes

Written down because the interesting decisions are in the numbers, and numbers get
changed by whoever touches the file last.

## 1. The fusion

| | Borrowed | Becomes |
|---|---|---|
| **Balatro** | score targets, chips × mult, jokers, hand types, shop between rounds | fixtures with a target, managers, football hands, packs as the shop |
| **Top Trumps** | pick a stat, biggest number wins | every fixture names a category; a card's number in it is its chips |
| **Panini** | packs, shiny foils, a persistent album, swaps | pack odds and editions now; the album is **not built yet** |

A card is a **player-season**, not a player. That gives ~4,300 cards from ten seasons,
makes "team-mates" a real thing (same club *and* season), and lets one player be several
cards, which is what makes a Hat-trick possible.

## 2. Chips

`chips = round(stat × perUnit)` where `perUnit` is set per category so the **99th
percentile is worth 60 chips**. Goals, assists, saves and price are therefore
equally strong at the top end; what differs is *who has them* (only keepers have
saves), which is the Top Trumps tension: the fixture's category decides which of
your cards matter.

Categories: goals, assists, games played, clean sheets, saves, bonus points, value (£m).

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
3. each manager's per-hand effect, in manager order
4. `total = floor(chips × mult)`

Order matters because ×mult multiplies whatever is already there (tested). `scoreHand`
returns a `trace` of every step so the UI can show the working.

**Editions** (rolled when a pack is opened): shiny +40 chips, holo +6 mult, gold ×1.5 mult.
**Managers** (16): Park the Bus, Route One, Sweeper Keeper, Total Football, One-Club Man,
Golden Boot, Playmaker, Added Time, Vintage Stickers (1990s cards), Super Sub, Captain's Armband and
five category specialists. Each is a small function in `jokers.js`.

## 5. A fixture

8 cards in hand, 4 hands, 3 discards, no reshuffle (Balatro's rules). Targets are
currently Balatro's ante curve ×1 / ×1.5 / ×2 for League / Cup tie / Derby. The sim
says that curve is a reasonable start for this scoring scale (§7); it has not been
tuned further.

**Starter squad**: 24 mid-table cards (rating 25-80): 3 clubs × 3 consecutive calendar seasons,
2 GK / 8 DEF / 8 MID / 6 FWD. See §7 for why that shape. The starter only uses cards with full stat lines (2016/17 onward), so
the 1990s cards reach you through packs for now.

## 6. Data

Two sources, joined at the cards:

| Seasons | Source | Stats available |
|---|---|---|
| 2016/17 to 2025/26 | the **Fantasy Premier League season archive** ([vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League)), fetched by `tools/fetch-data.mjs` | all seven categories, plus fantasy points |
| 1992/93 to 1994/95, 1996/97 to 2015/16 | **FBref** "Standard Stats" tables, exported by hand (Share & Export, Excel) into `data/fbref/` | games, goals, assists (plus cards, not used yet) |

Still missing: **1995/96**, the only gap. A test states the rule (every season 1992/93 to 2025/26 but that one), so a missing file fails by name. Each extra FBref season is one
more export (two files, see below) and no code change unless it names a club the importer doesn't
know yet; an unknown club stops the build rather than guessing.

- **FBref was not scrapeable.** It sits behind a Cloudflare challenge, which I did not try to defeat.
  The exports are saved by a person in a browser and dropped in `data/fbref/<season>.xls`.
  FBref truncates an export at 499 rows (a season has ~560 players), so each season needs two files:
  `1992-93.xls` (table as it comes) and `1992-93-z-a.xls` (click the Player header to reverse the sort,
  export again). `tools/fbref.mjs` merges them and refuses to continue if an overlapping row disagrees, if a
  season has a single export cut off at the 499-row cap, or if two truncated exports share no rows (a gap).
  The `.xls` is really an HTML table. **Export the "Standard Stats" table** (the page anchor `#all_stats_standard`);
  the other tables on the same page (Playing Time, Shooting...) have no goals or assists, and the importer
  refuses them. Files that are not wanted yet can sit in `data/fbref/unused/`, which is ignored.
- **1990s cards only have three stats.** Clean sheets, saves, bonus points and value are zero, shown as a
  dash on the card. So a 1990s goalkeeper is worth chips only in Games rounds, and everyone is worth
  nothing in Saves rounds. This is deliberate: invented numbers would look like data.
- **Mid-season movers get one card per club** in the FBref seasons (Sheringham: 1 goal at Forest, 21 at Spurs).
  FPL assigns a player to the club they finished the season with, so there it is one card.
- A "season" needs 270 minutes in either source (three full games). 2026/27 is excluded as incomplete.
- Counts: 14,444 cards, 4,351 players, 51 clubs. `cards.json` is about 3 MB: fine for a prototype page, worth slimming (short keys, one array per card) before any release. Sanity checks in `test/data.test.mjs`: known season totals
  for both sources, and the goals on the cards add up to a plausible total for the number of matches
  (about 96% of the real figure; the shortfall is own goals, which FBref does not credit to a player).
- 2016/17 to 2018/19 ship no `teams.csv`; clubs are mapped from FPL's alphabetical team ids, checked in the tests.
- **`rating`** (1-99) is a percentile within position and within source, so a 1990s striker is ranked against
  1990s strikers. FPL cards rank on fantasy points. FBref cards have none, so they rank on
  `2 x goals + assists + 0.15 x games`, and goalkeepers on games played. That makes ratings a rough guide
  and not comparable across eras. It decides pack rarity.
- Display names come from the full name by a heuristic (last word, plus particles like van/del/Dalla/Boa, minus Jr./Sr.), pinned by tests; an odd one is a one-line fix in `build-cards.mjs`.
- **The two sources agree where they overlap.** `npm run crosscheck` compares FBref exports for 2016/17 to
  2019/20 (kept in `data/fbref/overlap/`, git-ignored, not read by the build) with the FPL cards, matched by
  name and club. Over 4 seasons and ~1,500 players: **goals equal for 99.0%**, **games within 1 for 98.6%**.
  The disagreements are mid-season transfers (FPL gives the whole season to the last club: Sanchez shows 9
  for Manchester United where FBref has 2 for them) and one disputed goal (Kane 2017/18: 30 in FBref, 29 in
  FPL). **Assists equal for only 67.5%**: FPL uses its own assist definition and FBref uses Opta's. So
  an assist is slightly different before and after 2016/17, which matters for Assists rounds.
- Players are not yet linked across the two sources, so a Hat-trick can only be built within one source:
  Kane's 2015/16 card (FBref) and 2016/17 card (FPL) are different players to the engine. The seasons now join
  up (1996/97 to 2025/26 is unbroken), so this is the next data problem. FBref ids are `fb:<name>:<birth year>`;
  FPL ids are numbers and carry no birth year in `cards.json`. Name plus club alone matched only 85.5% of
  players in the cross-check (misses: "Willian", "Bernardo Silva", "Gylfi Sigurdsson" against FPL's full
  legal names, and anyone who moved mid-season), so linking needs a looser name match plus age.
- The stats are FPL's for 2016+: *bonus points* and *value (£m)* are fantasy concepts used because they are there.

**Before this goes public:** the FPL archive has no licence file and its figures originate from the
Premier League's FPL service; the FBref tables are Sports Reference's and their terms apply to
republishing them (the raw exports are git-ignored; `cards.json` is the derived product). The cards use real
player names. Fine for a private prototype; a public release needs a licensing decision. Club colours are
used, but no crests, logos or photos: the art is a generic silhouette.

## 7. What the simulator found

`npm run simulate`: three bots, 500 runs each, deterministic from a seed.
`random` plays 1-5 random cards. `greedy` plays the best-scoring hand and discards when behind
pace. `greedy+` is `greedy` plus a pack after each win (keeps the two cards that best fit its
deck), a random manager per stage, and a training level for its favourite hand.

| Bot | Median fixtures cleared (of 24) | Full seasons |
|---|---|---|
| random | 1 | 0 / 500 |
| greedy, starter squad only | 7 | 0 / 500 |
| greedy+ | 13 | 0 / 500 |

1. **The curve works as a starting point.** Random play is dead by fixture 2, a competent
   player on the bare starter squad runs out of steam around stage 3, and building a deck
   gets about 1.9x that. Almost nobody finishes, which suits a roguelike.
2. **Starter squad shape drives the hand mix.** With 4 team-seasons of 6 cards (the first
   attempt), Back Four and Full Strength were 73% of all plays, i.e. the aspirational hands
   were routine. 3 clubs × 3 seasons is the only shape tried that spreads plays across
   Full Strength, Club Side, Run and the pair hands.
3. **Spine is too reliable. Open problem.** It is 33% of the greedy bot's plays and 48% of
   greedy+'s even after cutting its base from 30×4 to 20×3, because it scores 4-5 cards where a
   pair scores 2 and the deck is small enough (24 cards, 3 discards) to fish for the one keeper.
   Candidates: score only one card per position; require 5 cards; make keepers rarer in packs;
   or accept it as the bread-and-butter hand and let managers/levels make the group hands
   outscale it. Needs a human playtest, not more bot tuning.
4. **The category you draw matters more than the deck you built. Open problem.** Same bare starter squad,
   fixture 3.1 (target 800), greedy bot, 579 modern decks / 921 decks with 1990s cards (measured before
   the starter was restricted, see 5):

   | deck | goals | assists | games | clean sheets | saves | bonus | value |
   |---|---|---|---|---|---|---|---|
   | modern | 60% | 84% | 100% | 99% | **2%** | 87% | 100% |
   | with 1990s cards | 48% | 77% | 100% | 74% | **1%** | 38% | 83% |

   At fixture 4.1 (target 2000) almost nothing wins except Games (84%) and Value (51%, modern only).
   Two causes. Chips are scaled so the 99th percentile is 60 in every category, but a *typical* card is
   worth ~50 in Games (everyone plays ~35 games) and ~5 in Goals (most players score 0-3), so Games is the
   easy category and Goals the hard one. And a Saves round with two keepers in the deck is unwinnable, and
   the category is drawn at random, so a run can end on the draw. Options: offer three categories per
   fixture and let the player choose (true to Top Trumps); scale chips against the median non-zero value
   instead of the 99th percentile; make hand base values carry less of the early game. Fixture 1 is won by
   every deck in every category (base hand chips alone clear 100), so the category is irrelevant until stage 3.
5. **The starter squad is restricted to full-stat cards.** Once 1992/93-1994/95 gave three consecutive
   seasons, 61% of starter decks were 1990s squads, which have no clean sheets, saves, bonus or value. They are
   excluded from the starter and arrive through packs. Found by measuring, not by assumption: the headline
   medians did not move at all, and the per-category table above did.
6. **Never made by either bot:** Dynasty, Hat-trick, Invincibles. They need deck-building the
   bot doesn't do (collecting several seasons of one club or one player). That is the intent
   (they are the chase) but it means they are untested under real play.

## 8. Not built

Run loop and shop · the sticker album (persistence, page completion, perks) · swaps · more
than one card of the same player as a deliberate mechanic · boss-fixture rules ·
sound · saving · 1995/96 · linking a player across the two sources.
