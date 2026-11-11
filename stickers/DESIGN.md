# Sticker Season: design notes

Written down because the interesting decisions are in the numbers, and numbers get
changed by whoever touches the file last.

## The two rules

1. **A season is 38 games.** A run is 38 matchdays, as in the league. One fixture each, one target each.
2. **Only stats that exist for every season.** The data set is 34 seasons from two sources, and only
   goals, assists and games played are recorded in all of them. Anything that has gaps is not used:
   not as a category, not on a card, not in a manager, not in the rating. Tests enforce this
   (`RULE:` in `test/`), so a partial stat cannot creep back in.

## 1. The fusion

| | Borrowed | Becomes |
|---|---|---|
| **Balatro** | score targets, chips × mult, jokers, hand types, shop between rounds | 38 fixtures with a target, managers, football hands, packs as the shop |
| **Top Trumps** | pick a stat, biggest number wins | every fixture names a category; a card's number in it is its chips |
| **Panini** | packs, shiny foils, a persistent album, swaps | pack odds and editions now; the album is **not built yet** |

A card is a **player-season**, not a player: "Henry, Arsenal 2003/04". That gives ~14,900 cards,
makes "team-mates" a real thing (same club *and* season), and lets one player be several cards,
which is what makes a Hat-trick possible.

## 2. Chips

`chips = round(stat × perUnit)` where `perUnit` is set per category so the **99th percentile is
worth 60 chips**. There are three categories: **goals, assists, games played.** A card is worth
chips in the fixture's category only, which is the Top Trumps tension.

Consequence of rule 2: goalkeepers score nothing in Goals or Assists rounds (they have almost none),
and are worth chips only in Games rounds. They are still useful for a Spine and for Sweeper Keeper.
That is a real limit of the data, not a bug.

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
Position is recorded for every season, so Spine is allowed under rule 2.

## 4. Scoring order

1. the hand's base chips and mult (at its level)
2. each scoring card, left to right: category chips → edition → every manager's per-card effect (a retrigger repeats all of it)
3. each manager's per-hand effect, in manager order
4. `total = floor(chips × mult)`

Order matters because ×mult multiplies whatever is already there (tested). `scoreHand`
returns a `trace` of every step so the UI can show the working.

**Editions** (rolled when a pack is opened): shiny +40 chips, holo +6 mult, gold ×1.5 mult.
**Managers** (14): Park the Bus, Route One, Sweeper Keeper, Total Football, One-Club Man,
Golden Boot, Playmaker, Added Time, Vintage Stickers (1990s cards), Super Sub, Captain's Armband and
three category specialists (Poacher, Creator, Ironman). Two specialists, The Wall and Shot Stopper,
were removed under rule 2: they needed clean sheets and saves, which only exist from 2016/17.

## 5. A season

**38 matchdays.** Each is one fixture: 8 cards in hand, 4 hands, 3 discards, no reshuffle (Balatro's
rules). The target climbs geometrically from **100 on matchday 1 to 40,000 on matchday 38**, about
19% harder each time, rounded to two significant figures (100, 120, 140, 170, 200 ... 25,000, 29,000 ... 40,000).
The end value is a tuning knob (`TARGET_END` in `round.js`): at 25,000 about 6% of a deck-building bot's
seasons finish, at 40,000 about 2%, at 55,000 under 1%, at 70,000 none.

**Starter squad**: 24 mid-table cards (rating 25-80): 3 clubs × 3 consecutive calendar seasons,
2 GK / 8 DEF / 8 MID / 6 FWD. Any era can supply one (every card has the same stats), so a squad
often mixes, say, Wimbledon 1996/97 with Burnley 2016/17.

## 6. Data

Two sources, joined at the cards. All 34 seasons from 1992/93 to 2025/26 are in; a test states the rule,
so a missing file fails by name.

| Seasons | Source | Used from it |
|---|---|---|
| 2016/17 to 2025/26 | the **Fantasy Premier League season archive** ([vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League)), fetched by `tools/fetch-data.mjs` | goals, assists, minutes |
| 1992/93 to 2015/16 | **FBref** "Standard Stats" tables, exported by hand (Share & Export, Excel) into `data/fbref/` | goals, assists, minutes |

**What rule 2 left out.** FPL also has clean sheets, saves, bonus points, price and fantasy points. They
are in the raw files and not on any card. `games` is `round(minutes / 90)` in both sources.

- **FBref was not scrapeable.** It sits behind a Cloudflare challenge, which I did not try to defeat.
  The exports are saved by a person in a browser and dropped in `data/fbref/<season>.xls`.
  FBref truncates an export at 499 rows (a season has ~560 players), so each season needs two files:
  `1992-93.xls` (table as it comes) and `1992-93-z-a.xls` (click the Player header to reverse the sort,
  export again). `tools/fbref.mjs` merges them and refuses to continue if an overlapping row disagrees, if a
  season has a single export cut off at the 499-row cap, or if two truncated exports share no rows (a gap).
  The `.xls` is really an HTML table. **Export the "Standard Stats" table** (the page anchor `#all_stats_standard`);
  the other tables on the same page (Playing Time, Shooting...) have no goals or assists, and the importer
  refuses them. Unwanted files can sit in `data/fbref/unused/`, which is ignored.
- **Mid-season movers get one card per club** in the FBref seasons (Sheringham: 1 goal at Forest, 21 at Spurs).
  FPL assigns a player to the club they finished the season with, so there it is one card.
- A "season" needs 270 minutes in either source (three full games). 2026/27 is excluded as incomplete.
- Counts: 14,851 cards, 4,383 players, 51 clubs. `cards.json` is about 3 MB: fine for a prototype page,
  worth slimming (short keys, one array per card) before any release. Sanity checks in `test/data.test.mjs`:
  known season totals for both sources, and the goals on the cards add up to a plausible total for the number
  of matches (about 96% of the real figure; the shortfall is own goals, which FBref does not credit to a player).
- 2016/17 to 2018/19 ship no `teams.csv`; clubs are mapped from FPL's alphabetical team ids, checked in the tests.
- **`rating`** (1-99) is a percentile within position across the whole data set, from **one formula for every
  card**: `2 × goals + assists + 0.15 × games`, and goalkeepers on games played. It is the headline number on the
  card and decides pack rarity. It is a rough guide: it flatters attackers, and a keeper's rating only means "played
  a lot". A test checks it is monotonic in the formula and not skewed to an era (each decade's share of the 90+ cards
  is within 10 points of its share of all cards).
- Display names come from the full name by a heuristic (last word, plus particles like van/del/Dalla/Boa, minus
  Jr./Sr.), pinned by tests; an odd one is a one-line fix in `build-cards.mjs`.
- **The two sources agree where they overlap.** `npm run crosscheck` compares FBref exports for 2016/17 to
  2025/26, i.e. every FPL season (kept in `data/fbref/overlap/`, git-ignored, not read by the build) with the
  FPL cards, matched by name and club. Over 10 seasons and ~3,500 matched players: **goals equal for 99.1%**,
  **games within 1 for 98.5%**. The disagreements are mid-season transfers (FPL gives the whole season to the
  last club: Semenyo 2025/26 shows 17 for Manchester City where FBref has 7 for them) and one disputed goal
  (Kane 2017/18: 30 in FBref, 29 in FPL). **Assists equal for only 68.5%** (60% to 73% by season): FPL uses its
  own assist definition and FBref uses Opta's. So an assist is slightly different before and after 2016/17.
  Assists are kept because they exist in every season, but this is a known inconsistency.
- **Players are not yet linked across the two sources**, so a Hat-trick can only be built within one source:
  Kane's 2015/16 card (FBref) and 2016/17 card (FPL) are different players to the engine. The seasons now join
  up, so this is the next data problem. FBref ids are `fb:<name>:<birth year>`; FPL ids are numbers and carry
  no birth year in `cards.json`. Name plus club alone matched only 80% of players in the cross-check (73% to 90%
  by season, falling with recency; misses are "Willian", "Bernardo Silva", "Gylfi Sigurdsson" against FPL's
  full legal names, and anyone who moved mid-season), so linking needs a looser name match plus age.
- **1992/93 to 1994/95 were 42-game seasons** (22 clubs), so a regular there can show up to 42 games and
  proportionally more goals than a 38-game season would give. Cards show what was recorded. Open question:
  scale those three seasons to 38? (Rating is affected slightly: 1990s cards are 26% of the 90+ ratings
  against 24% of all cards.)

**Before this goes public:** the FPL archive has no licence file and its figures originate from the
Premier League's FPL service; the FBref tables are Sports Reference's and their terms apply to
republishing them (the raw exports are git-ignored; `cards.json` is the derived product). The cards use real
player names. Fine for a private prototype; a public release needs a licensing decision. Club colours are
used, but no crests, logos or photos: the art is a generic silhouette.

## 7. What the simulator found

`npm run simulate`: three bots, 500 runs each, deterministic from a seed. Categories are drawn at random.
`random` plays 1-5 random cards. `greedy` plays the best-scoring hand and discards when behind
pace. `greedy+` is `greedy` plus a pack after each win (keeps the two cards that best fit its
deck), and every 5th matchday a random manager and a training level for its favourite hand.

| Bot | Matchdays cleared (of 38) | Best 10% reach | Full seasons |
|---|---|---|---|
| random | median 2 | 4 | 0 / 500 |
| greedy, starter squad only | median 13 | 15 | 0 / 500 |
| greedy+ | median 23 | 33 | 10 / 500 (2%) |

1. **The curve works.** Random play is dead by matchday 2, a competent player on the bare starter squad
   runs out of steam around matchday 13, and building a deck gets about 1.8x that. A few runs finish,
   which suits a roguelike.
2. **Rule 2 removed the category-luck problem.** With seven categories (four of them partial), the same
   starter squad won 100% of Games rounds and about 2% of Saves rounds at the same target, so a run could end
   on the draw. With the three complete stats the win rates are 87-100%:

   | category | greedy | greedy+ |
   |---|---|---|
   | goals | 87% | 94% |
   | assists | 92% | 95% |
   | games | 100% | 98% |

   Games is still the easiest (everyone plays ~35 games, so a typical card is worth far more there than in
   Goals), but the gap is about 10 points, not 98.
3. **Starter squad shape drives the hand mix.** With 4 team-seasons of 6 cards (the first
   attempt), Back Four and Full Strength were 73% of all plays, i.e. the aspirational hands
   were routine. 3 clubs × 3 seasons is the only shape tried that spreads plays across
   Full Strength, Club Side, Run and the pair hands.
4. **Spine is too reliable. Open problem.** It is 38% of the greedy bot's plays and 52% of
   greedy+'s even after cutting its base from 30×4 to 20×3, because it scores 4-5 cards where a
   pair scores 2 and the deck is small enough (24 cards, 3 discards) to fish for the one keeper.
   Candidates: score only one card per position; require 5 cards; make keepers rarer in packs;
   or accept it as the bread-and-butter hand and let managers/levels make the group hands
   outscale it. Needs a human playtest, not more bot tuning.
5. **Never made by either bot:** Invincibles, Back Four, Dynasty. They need deck-building the
   bot doesn't do (collecting several seasons of one club or one player). That is the intent
   (they are the chase) but it means they are untested under real play.

## 8. Not built

Run loop and shop · the sticker album (persistence, page completion, perks) · swaps · more
than one card of the same player as a deliberate mechanic · boss-fixture rules ·
sound · saving · linking a player across the two sources · choosing a category (there are now only
three, so a "pick one of three" would mean picking any category).
