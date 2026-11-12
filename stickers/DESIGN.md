# Sticker Season: design notes

Written down because the interesting decisions are in the numbers, and numbers get
changed by whoever touches the file last.

## The rules

1. **A season is 38 games.** A run is 38 matchdays, as in the league. One fixture each, one target each.
   (The data is the real thing: career totals are not scaled to anything. The three 42-game seasons at the start are
   simply counted as played; see section 6.)
2. **Only stats that exist for every season.** A stat with gaps is not used: not as a category, not on a
   card, not in a manager, not in the rating. The stats that survive: **goals, assists, appearances, yellow
   cards, red cards.** Yellows and reds are combined into one category, **Discipline** (a yellow is 1 point,
   a red is 3), so there are four categories. Tests enforce this (`RULE:` in `test/`).
3. **One data source.** All 34 seasons come from FBref's Standard Stats table. An earlier build used a second
   source (the Fantasy Premier League archive) for 2016/17 onward; the two disagreed on assists for ~30% of
   players, handled mid-season transfers differently, and gave players different ids, so it was dropped.
4. **A card is a player, not a player-season.** There is only one Frank Lampard: his whole Premier League career.
   The real totals are on the card, ratings of 1-99 are what score (section 2).

## 1. The fusion

| | Borrowed | Becomes |
|---|---|---|
| **Balatro** | score targets, chips × mult, jokers, hand types, held-in-hand effects, shop between rounds | 38 fixtures with a target, managers, football hands, a keeper's Safe Hands, packs as the shop |
| **Top Trumps** | pick a stat, biggest number wins | every fixture names a category; a card's number in it is its chips |
| **Panini** | packs, shiny foils, a persistent album, swaps | pack odds and editions now; the album is **not built yet** |
| **Luck** | the spin | a wheel picks the category; **VAR** overturns it (section 5) |

A card is a **player**, his whole Premier League career since 1992/93: "Frank Lampard: 609 appearances, 177 goals, 102
assists, Chelsea 429 / West Ham 148 / Man City 32". The pool is every player with **at least 20 Premier League
appearances**: 3,162 cards out of 5,113 players in the exports. Duplicates are not a thing: you can only own one of each
player, and the only variation between copies is the **edition** (base, shiny, holo, gold). If a pack deals you a player
you already own, keeping him **upgrades your copy one edition** (see section 5).

(The first build had one card per player-season: 14,900 cards, "Henry, Arsenal 2003/04". It was replaced because a
card that is a stat line is not a person: nobody has a favourite Henry season, and a "Hat-trick of three Henry cards"
is not football. Team-mates survived the change: they are now players who share a club-season anywhere in their careers.)

## 2. Ratings, chips and categories

**Every stat on a card has two numbers**: the **real career total** (what the record books say) and a **rating from 1 to
99** (what scores). Totals are far too lopsided to score directly: the median player has 2 career goals and Shearer has 260.

`rating = 99 × (total / record)^0.35`, minimum 2 for a non-zero total, and 1 for zero. The **record** is the best in the
pool: 260 goals (Shearer), 162 assists (Giggs), 658 appearances (Milner), 148 discipline points (Barry). The exponent
0.35 is a gentle curve so a squad player with 56 goals (Milner) is a 58 and a legend with 177 (Lampard) is an 87, not 21
and 67. Two other ways were tried and rejected: **rank percentile** (a long career looked as good as a great one: Milner,
Heskey and James topped the lists and Shearer was 12th) and a **linear** scale (everyone but a handful bunched at 1-10).
Measuring against the record is what lets a legend stand clear of a long career.

`chips = round(rating × 0.606)`, so a rating of 99 is worth about 60 chips. A card is worth chips in the fixture's
category only, which is the Top Trumps tension.

**The overall (OVR, 1-99)** is the headline number on a card, and what makes it meaningful is that it is a transparent
blend of those ratings, weighted for the position (`OVR_WEIGHTS` in `cards.js`):

| Position | goals | assists | appearances |
|---|---|---|---|
| FWD | 60% | 25% | 15% |
| MID | 25% | 40% | 35% |
| DEF | 20% | 30% | 50% |
| GK | | | 80% (a keeper is discounted: see below) |

Discipline is not in it (a booking is not a skill). OVR sets the **tier** (the frame of the card) and how rare it is in a
pack: bronze 1-39 (64% of the pool), silver 40-54 (26%), gold 55-69 (9%), icon 70+ (1.5%, 48 players). The pantheon reads
right: Rooney and Shearer 90, Lampard 89, Salah 86, Milner 85, Cole 84, Giggs and Gerrard 83, Kane 82, Henry 81.
Milner is fifth because he holds the appearances record and 56 goals and plenty of assists: a stalwart, which is all a
defender's numbers can say. (The first weights, 60% appearances for a defender, put him fourth and Ashley Young tenth.)

**The limits are in the data, not a judgement.** We have no tackles, saves, clean sheets or shots for 34 seasons (the exports do have minutes, starts and penalties for every season, which the cards do not use: see "Attributes we have" in `draft/README.md`), so a
defender's OVR is mostly how long he lasted plus a few goals, and a keeper's is how much he played (his weight is
discounted 20%, or keepers, who play every week, would fill the top of the list). Ledley King and Joe Hart are accurate
about what we know of them, which is not much. Adding a stat that has gaps would break rule 2.

| Category | Notes |
|---|---|
| goals | the hardest: most players have a handful |
| assists | |
| appearances | the easiest to score |
| discipline | yellow cards 1 point + red cards 3 points |

**Why Discipline is one category.** Red cards on their own were a category the design started with, and they were
the problem one: almost nobody had any, so most hands had nothing to score. Combining them (suggested in review) puts a
score on nearly every career and keeps a red worth three yellows. The card shows the rating with the points underneath;
hovering shows the split ("8 yellow, 0 red: 8 + 3 × 0"). The weights live in `DISCIPLINE_POINTS` in `cards.js`.

## 3. Hands

**Team-mates are players who shared a club-season**: both on the same club's books in the same season, at any point in
their careers. A card carries all his club-seasons (`stints`, "CHE|2004-05"), so Lampard and Terry share thirteen of
them. The hands ask whether the cards you play have a club-season in common, so any number of cards can share one.
**Only the cards that make the hand score** (as in Balatro), so a kicker adds nothing.

| Hand | Needs | Base |
|---|---|---|
| The Invincibles | 5 who shared one club-season | 120 × 12 |
| Back Four | 4 who shared one | 60 × 7 |
| Full Strength | 3 who shared one + 2 who shared another | 40 × 4 |
| Club Side | 5 who all played for one club, any time | 35 × 4 |
| Class Of | 5 who all debuted within 3 seasons | 30 × 4 |
| Hat-trick | 3 foil stickers (shiny, holo or gold) | 30 × 3 |
| Triangle | 3 who shared one club-season | 30 × 3 |
| Double Act | two pairs of team-mates | 20 × 2 |
| Spine | GK + DEF + MID + FWD (all cards score) | 15 × 2 |
| One-Two | 2 who shared one | 10 × 2 |
| Kickabout | nothing: only the best card scores | 5 × 1 |

Dynasty and Run of Seasons (consecutive seasons) are gone: a career has no single season. The Hat-trick of three cards of
the same player is gone too, because there is only one of each; it is now three foils. The three-player hands need a real
shared season: three who each overlapped with another but never all together are only a pair (tested).

Ordered by base value; that is also the priority when a hand matches several (enforced by a test). Spine was
cut from 20 × 3 and moved under Double Act after the first career sim (section 7). Each training level adds a per-hand
bonus (`lvl` in `hands.js`).

## 4. Scoring order

1. the hand's base chips and mult (at its level)
2. each scoring card, left to right: category chips → edition → every manager's per-card effect (a retrigger repeats all of it)
3. **cards held in your hand: a goalkeeper's Safe Hands**
4. each manager's per-hand effect, in manager order
5. `total = floor(chips × mult)`

Order matters because ×mult multiplies whatever is already there (tested). `scoreHand`
returns a `trace` of every step so the UI can show the working.

**Safe Hands (the goalkeeper's ability).** Goalkeepers score almost nothing in any category, so their job is
support. A goalkeeper **held in your hand** (not played) adds mult to every hand you play: **+3** with 250+ career
appearances (a first-choice legend), **+2** for 100-249 (a regular), **+1** under 100 (a deputy). It uses only
appearances, which every season has. It creates a real choice, because the keeper you need for a Spine is the keeper you would rather hold.
(Measured on the old season cards, before Discipline was combined: sim, 500 runs, Safe Hands on against off): the bare starter squad clears a median of 15 matchdays
against 13, random play 3 against 1, and Spine falls from 39% to 28% of plays. Late in a season a flat +3 matters
less next to managers (24 against 25 for a deck-building bot, which is inside the noise), so it is an
early-game aid. If it needs to scale, make it a multiplier.

**Editions** (rolled when a pack is opened: 86% base, 8% shiny, 4% holo, 2% gold): shiny +40 chips, holo +6 mult,
gold ×1.5 mult. A shiny's +40 is large against rating-based chips of 15-35, which is deliberate: it is the Panini chase.
**Managers** (15): Park the Bus, Route One, Sweeper Keeper, Total Football,
Golden Boot (goals rating 60+), Playmaker (assists rating 60+), One-Club Man (never left, 8+ seasons), Added Time, Vintage Stickers (a career that began before 2000/01), Super Sub, Captain's Armband and
four category specialists (Poacher, Creator, Ironman, Hard Man). Clean-sheet and save specialists were removed under rule 2.
No manager uses the yellow or red card counts directly yet (only through Hard Man's Discipline rounds).

## 5. A season

**38 matchdays.** Each is one fixture: 8 cards in hand, 4 hands, 3 discards, no reshuffle (Balatro's rules). The
target climbs from **800 on matchday 1 to 40,000 on matchday 38**, rounded to two significant figures, on a curve that is
**front-loaded** (`TARGET_BEND` 0.7 in `round.js`): a pure geometric curve would be about 17% harder each day, the bend
makes the early steps the big ones and the late ones gentler. A few targets: matchday 5 is 1,800, 10 is 3,400, 20 is 9,300,
30 is 22,000. **Why it was retuned:** the first career-card build kept the old 100-to-40,000 curve and was far too easy
(playtest: "the cumulative scores on the cards clear the targets quite easily"). Ratings made a card worth up to 60 chips
and a starter-squad hand scores 600 to 1,000 on matchday 1, so for 20 matchdays the bots won every fixture with a single
hand (spare hands: 3.0 of 4). Starting at 800 and bending the curve makes the bare starter squad fail around matchday 7.
The end value is a tuning knob (`TARGET_END`).

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
| Sticker Pack | £4 | five different players from anywhere |
| Club Pack | £6 | five players who have played for a club in your squad |
| Squad Pack | £8 | five players who were team-mates of someone in your squad (they share a club-season with one of your players: this is how you build Back Four and Invincibles) |
| Manager | £8-£14 (twice their cost, `managerMarkup`) | up to 5 slots; sell one for half of their cost (£2-£3) |
| Training | £3 + £2 per level the hand already has | the hand you play most, plus one other. +chips and +mult every time you play it |
| Reroll | £2, then £3, £4... | replaces the stock |
| Release a sticker | £1 | thins the squad; the squad cannot go under 16 |

Two packs, two managers and two trainings are in stock; packs are Sticker / Club / Squad in the ratio 5:3:2. A pack
is opened at once and **you keep one of the five**. **Duplicates:** you can only own one of each player, so if you keep one you already have, he **upgrades your copy one edition** (the better of the two copies, plus one: base → shiny → holo → gold, and gold stays gold) instead of joining the squad. A pack's five are always five different players. The pack shows "YOU OWN HIM" and what the upgrade would be.

*Why keep one, not two* (sim): a shopping bot reached a median of 29 matchdays keeping one and 27 keeping two. A
squad that bloats plays less reliably (the keep-two bot had 76 stickers by matchday 30), so keep-one is both simpler and
better. *Why training offers your favourite hand:* with a random hand on offer, the first shop offered "Training:
Kickabout" and the bot trained every hand once; offering the hand you play most lifted the shopping bot from a 2% to a
12% finish rate at the same targets, which is why the target curve was re-measured afterwards.

**Saving.** Everything random comes from labelled seed streams (spins, deals, shop stock, pack contents), so a seed
is a whole season and a save is small. The page saves in the shop and at each matchday intro (`localStorage`). A
fixture in progress is not saved: after a reload you kick off again and get the **same deal** (same seed).

**Starter squad**: 24 mid-table players (overall 12-54: bronze and silver), **6 clubs × 2 consecutive seasons**, 2 GK /
8 DEF / 8 MID / 6 FWD, dealt round-robin from each club's players who were there in that window. They really were
team-mates (in a typical squad about a quarter of the 276 pairs share a club-season). Any era can supply one, so a squad
can mix Wimbledon 1996/97 with Burnley 2016/17.

## 6. Data

All 34 seasons from 1992/93 to 2025/26, one source: **FBref "Standard Stats" tables**, exported by hand
(Share & Export, Excel) into `data/fbref/`, two files per season. A test states the rule, so a missing season
fails by name. Every row of every export is summed per player: 5,113 players, 3,162 of them with 20+ appearances
(the pool, `MIN_APPS` in `build-cards.mjs`), 51 clubs. `cards.json` is about 1.2 MB.

A card keeps: id, display name, full name, position, club (most appearances), clubs `[[club, apps]...]`, stints
(club-seasons), first and last season, the real totals (games, goals, assists, yellow, red), league `titles`, `wins` and `cleanSheets` (see `draft/README.md`: titles are seasons with the champions at 5+ league appearances; wins and clean sheets are estimated from the club's real match results, `data/results.json`, and his share of its minutes; the Sticker Season game does not use them, Prem Wheel does), the four ratings and the overall. Nothing else; a test whitelists the fields and checks that a career adds up (his clubs sum to his appearances).

- **FBref was not scrapeable.** It sits behind a Cloudflare challenge, which I did not try to defeat.
  The exports are saved by a person in a browser. FBref truncates an export at 499 rows (a season has ~560
  players), so each season needs two files: `1992-93.xls` (table as it comes) and `1992-93-z-a.xls` (click the
  Player header to reverse the sort, export again). `tools/fbref.mjs` merges them and refuses to continue if an
  overlapping row disagrees, if a season has a single export cut off at the 499-row cap, or if two truncated exports
  share no rows (a gap). The `.xls` is really an HTML table. **Export the "Standard Stats" table** (anchor
  `#all_stats_standard`); the other tables on the page (Playing Time, Shooting...) have no goals or assists, and the
  importer refuses them. The exports are git-ignored; `cards.json` is the derived product.
- **One id for a career**: name + birth year, so a player is one card even across clubs and a rename of his club.
  An identity check (two ids with the same name and overlapping careers) found 0 candidates. Totals match the record
  books: Lampard 609 / 177 / 102, Shearer 441 / 260 / 64, Giggs 632 / 109 / 162, Rooney 491 / 208 / 102, Kane 213 goals
  (all pinned by a test).
- **Nothing is scaled any more.** 1992/93 to 1994/95 were 42-game seasons (22 clubs). The season-card build scaled those
  by 38/42 so no card showed more than 38 games. A career card shows what he actually played, so those seasons are
  counted as played; a long career is a long career.
- **Mid-season movers** have a club-season at each club (Sánchez 2017/18: ARS|2017-18 and MUN|2017-18) and his
  appearances split by club. Cameos count towards the 20 appearances, so a player with a handful of games for each of
  three clubs can qualify.
- **Position** is where he played most (by appearances). **Club** is where he made most appearances. Wing-backs and
  full-backs are FBref defenders, which is why Milner is a defender here.
- **Display names** come from the full name by a heuristic (last word, plus particles like van/del/Dalla/Boa, minus
  Jr./Sr., surname-first East Asian names like "Son Heung-min" read right), a table of 12 compound surnames the
  heuristic gets wrong, and a first initial for a surname shared by four or more players ("I.Wright", "A.Smith").
  Pinned by tests; an odd one is a one-line fix in `build-cards.mjs`.
- **Why one source** (the evidence). Cross-checked over all ten seasons where the two overlapped (~3,500 matched
  players): goals agreed for 99.1% and games for 98.5%, so FBref is trustworthy. **Assists agreed for only 68.5%**
  (FPL has its own definition; FBref uses Opta's), mid-season transfers differed, and name-plus-club matching linked only
  80% of players across the two. Using FBref throughout removes all three problems.

**Before this goes public:** FBref's figures are Opta's, and Sports Reference's terms apply to republishing them.
The cards use real player names. Fine for a private prototype; a public release needs a licensing decision. There are
no photos and no real crests or logos (see "The card face"); the badges are generated.

### The card face

There are no headshots in the data, so a card is built from what we have, in the manner of a FIFA Ultimate Team card.
The **frame** is the tier (bronze, silver, gold, or a dark navy and gold icon); a foil edition replaces it with its own
foil. Top band: his main club's name and his career span ("95-15"). Art panel: a pale sunburst in the club's kit colours
with the **club badge**, the **overall** on a plate in the tier colour (top left, with his position under it), the tier
name (top right) and an edition tag or the goalkeeper's Safe Hands badge (bottom). Name band: the **first name** above the
**surname** (a mononym such as Rodri or Willian has no first name). Four stat rows: each shows the **rating** large, the
**real career total** small underneath the stat name ("GOALS / 177"), and the chips beside the active category.

- **Badges are generated, not real crests.** Real club crests are trademarks and need licensed artwork, and we have none.
  Each badge is a shield in the club's kit colours and a pattern that loosely follows its kit (stripes, hoops, halves, a
  sash), with the club code. Fifty-one clubs, all distinct. `badge.js` is the one place to change when real artwork exists.
  The badge is his **main** club; the full list of clubs (Chelsea 429, West Ham 148, Man City 32) is in the band's tooltip.
- **First names** are derived from the stored full name (`firstNameOf` in `cards.js`). Tested on every card.
- **Every number explains itself on hover** (on a phone, press and hold): the overall, the tier, the club and span, the
  name, each stat, the chips, the keeper's Safe Hands, the edition. The wording is a pure function (`tips.js`), tested. It
  says, for example, "177 career goals: rated 87 out of 99, against the Premier League record of 260" and "Worth 53 chips
  in this matchday's goals round: rating 87 x 0.606 chips each". One tooltip serves the whole page and lives inside an
  open dialog, because a dialog covers the page.
- **A pack shows duplicates**: a player you own is marked "YOU OWN HIM (BASE)" and the button reads "Upgrade to SHINY".

## 7. What the simulator found

`npm run simulate`: three bots playing whole seasons **through the real season engine** (spin, VAR, kick-off, payout,
shop), deterministic from a seed. `random` plays 1-5 random cards and never uses VAR. `greedy` plays the best-scoring
hand, discards when behind pace, never discards a keeper, and uses VAR when its deck is weak in the spun category; it earns
money but never shops. `greedy+` also shops: managers first, then training for its favourite hand, then the best pack it can
afford, keeping the one sticker that best fits its squad (a team-mate of its squad, then a former club's player, then an
upgrade for one it owns). It never rerolls or sells. Numbers below are from the career cards, 300 runs per bot.

| Bot | Matchdays cleared (of 38) | Best 10% reach | Full seasons |
|---|---|---|---|
| random | median 0 | 1 | 0 / 300 |
| greedy, no shop | median 7 | 9 | 0 / 300 |
| greedy+, shops | median 25 | 34 | 7 / 300 (2%) |

1. **The first career curve was too easy; this one is not.** With the old 100-to-40,000 curve the bare squad cleared a median
   20 matchdays and won every early fixture with one hand. Now: random play fails matchday 1 about 4 times in 5, the bare
   squad dies around matchday 7, and a shopping bot reaches 25 with spare hands falling from 2.2 (matchday 1) to 1.3 (25)
   to 0.7 (30). Two levers did it, in this order of effect: a **higher, front-loaded target curve** (800, bend 0.7) and
   **managers at double price** (£8-£14: the shopping bot used to own all five by matchday 5 and now has 1.5 then, 3.5 by
   15 and 4.5 by 25). Raising only the start (to 700 or 1,000, unbent) made early days harder but left the shopping bot
   with a long stretch of 2.5 spare hands in the middle of the season, which is the "easy" the playtest felt.
   Triple price was too much (a shopping bot clears a median 16). **Still true:** the shopping bot wins most fixtures with
   about two hands until matchday 20; the curve gets hard in the 25s, not before. If a human still finds the middle easy,
   next levers are training prices, a lower win payout, or a flat target on the last quarter.
2. **Category luck is small.** Win rates by category: goals 92% / 96%, assists 93% / 96%, appearances 99%, discipline 97% / 98%
   (greedy / greedy+). **The bots never use VAR**: with ratings, every category is worth about the same to a balanced
   squad, so a bot never sees a category it is "weak in". VAR is a tool for a squad built around goals that draws appearances,
   and needs a human to tell us whether it matters.
3. **Starter squad shape drives the hand mix, and it needed re-tuning for careers.** Players now carry up to twenty
   club-seasons, so team-mates are everywhere. With 3 clubs × 3 seasons, **Invincibles, Back Four and Full Strength were
   95% of the bare squad's plays** (Invincibles alone 17%): the chase hands were routine. 6 clubs × 2 seasons gives
   Invincibles 0.5%, Back Four 10%, Full Strength 51%, Double Act 25%. 8 clubs was tried and made the starter pair hands
   and Spine dominant; 6 is the compromise.
4. **Spine was too reliable again, and still partly is.** It was 28-50% of plays; moving it under Double Act and cutting
   it from 20 × 3 to 15 × 2 brought greedy+ to 25%. Greedy+ now makes Double Act 41% of the time. Candidates if a
   human finds it samey: score one card per position, require 5 cards, or make keepers rarer in packs.
5. **Money is still not what limits the shopping bot.** It fills five manager slots by matchday 5 and ends every shop with
   about £8 unspent; by matchday 30 it has 45 stickers. The real constraint is choosing well, which a bot cannot test.
6. **Not tested under real play:** Invincibles, Club Side (0.3%), Hat-trick (0.6%), the foil upgrade path (the bot keeps
   a duplicate only when it ranks it first), and everything about editions: shiny's +40 chips is large against 15-35 chips
   a card.

## 8. Not built

Icon abilities for the 70+ overalls (a legend that does something no stat line can) · a partnership bonus for a pair who
shared many seasons (Lampard and Terry: thirteen) · the sticker album (persistence between seasons, page completion,
perks) · swaps · boss-fixture rules · sound · a way to earn or buy more VAR · interest on saved money · defensive and
goalkeeping ratings, which need data with gaps, so they break rule 2 · a second pair of eyes: **nobody has playtested this
yet except bots**. The first human season is the most valuable thing to do next.
