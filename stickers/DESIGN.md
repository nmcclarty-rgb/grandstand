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
Golden Boot, Playmaker, Added Time, Vintage Stickers, Super Sub, Captain's Armband and
five category specialists. Each is a small function in `jokers.js`.

## 5. A fixture

8 cards in hand, 4 hands, 3 discards, no reshuffle (Balatro's rules). Targets are
currently Balatro's ante curve ×1 / ×1.5 / ×2 for League / Cup tie / Derby. The sim
says that curve is a reasonable start for this scoring scale (§7); it has not been
tuned further.

**Starter squad**: 24 mid-table cards (rating 25-80): 3 clubs × 3 consecutive seasons,
2 GK / 8 DEF / 8 MID / 6 FWD. See §7 for why that shape.

## 6. Data

Source: the **Fantasy Premier League season archive**
([vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League)),
which republishes the official FPL API's end-of-season player totals.

- **Coverage is 2016/17 to 2025/26.** Not 1992. A quick probe from the build environment
  found no open player-level source reaching further back: Wikipedia's API returned 429 and
  Kaggle needs a login. FBref and Transfermarkt were not tried (their terms restrict
  scraping), so a 1992-2016 layer is still an open question. 2026/27 is excluded as incomplete.
- 4,296 cards, 1,476 players, 34 clubs. A "season" needs ≥ 270 minutes (three full games).
- FPL assigns one club per player per season (their club at the end of it), so a mid-season
  transfer shows as one card.
- 2016/17-2018/19 ship no `teams.csv`; clubs are mapped from FPL's alphabetical team ids.
  `test/data.test.mjs` checks the mapping against known player-club pairs.
- `rating` is the season-points percentile within the position (1-99), and decides pack rarity.
  It is a fantasy-points measure, so it flatters attackers and clean-sheet defenders.
- The stats are the FPL ones: *bonus points* and *value (£m)* are fantasy concepts, not
  football ones, and are used because they are in the data.

**Before this goes public:** the archive has no licence file, the figures originate from the
Premier League's FPL service, and the cards use real player names. Fine for a private
prototype; a public release needs a licensing decision. Club colours are used, but no crests,
logos or photos: the art is a generic silhouette.

## 7. What the simulator found

`npm run simulate`: three bots, 500 runs each, deterministic from a seed.
`random` plays 1-5 random cards. `greedy` plays the best-scoring hand and discards when behind
pace. `greedy+` is `greedy` plus a pack after each win (keeps the two cards that best fit its
deck), a random manager per stage, and a training level for its favourite hand.

| Bot | Median fixtures cleared (of 24) | Full seasons |
|---|---|---|
| random | 1 | 0 / 500 |
| greedy, starter squad only | 7 | 0 / 500 |
| greedy+ | 13 | 2 / 500 |

1. **The curve works as a starting point.** Random play is dead by fixture 2, a competent
   player on the bare starter squad runs out of steam around stage 3, and building a deck
   roughly doubles that. Almost nobody finishes, which suits a roguelike.
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
4. **Never made by either bot:** Dynasty, Hat-trick, Invincibles. They need deck-building the
   bot doesn't do (collecting several seasons of one club or one player). That is the intent
   (they are the chase) but it means they are untested under real play.

## 8. Not built

Run loop and shop · the sticker album (persistence, page completion, perks) · swaps · more
than one card of the same player as a deliberate mechanic · boss-fixture rules ·
sound · saving · anything before 2016/17.
