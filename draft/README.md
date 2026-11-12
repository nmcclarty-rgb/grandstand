# PREM WHEEL (working title)

(The folder is still called `draft/`, and earlier versions were called Blind Five and FPL Battler.)

A **blind budget draft against a bot**, on the [Sticker Season](../stickers/) career cards (every Premier League player with
100+ appearances, 1992/93 to 2025/26). Inspired by the "you have £10, pick your front three" quiz.

Two games, one engine (pick on the title screen):

| | 5-a-side | 11-a-side |
|---|---|---|
| Budget | £10 | £30 |
| Rounds | 5 | 11 |
| Which position | a wheel names it each round (never one position three times) | a **formation** is rolled at the start of every match (4-4-2, 4-3-3, 4-5-1, 3-5-2, 3-4-3, 5-3-2) and both teams work through it, goalkeeper first, then defenders, midfielders, forwards |

Every draw is a **wheel you can see**: a spinning SVG wheel with a pointer, sized by the real odds (the 5-a-side position wheel's goalkeeper slice is half the size of the others, because the
wheel gives goalkeepers half as often), that lands on the slice the engine has already drawn. It spins for the attribute (faded slices are ones already used in the series), the formation
(11-a-side) and each round's position (5-a-side). Click it to skip. (`src/ui/wheel.js`: the geometry is tested to land every slice under the pointer, away from the edges.)

A series is a **best of three matches**, and every match is a fresh draft:

1. **An attribute is drawn** at the start of the match: goals, assists, goal involvements (goals plus assists), appearances, league titles, wins (est.), clean sheets (est.) or discipline (a yellow card is 1 point, a red card is 3). Never the same one twice in a series.
2. **You draft a fresh team for it** on a fresh budget, tailored to the attribute you know is being counted. Each round a board of eight players of one position goes up with **a name and a price only**: no stats, no club. You alternate picks (who goes first swaps every round, and the side that picked first last round of a match goes second in the next) and you can see what the bot takes. Anyone used in an earlier match of the series is gone.
3. **Add it up.** Each team's **real Premier League career totals** in the attribute; the bigger total wins the match. **First to two matches wins the series.**

No hands, no multipliers, no ratings: none of Sticker Season's rules are used, only its player data.

```bash
cd draft
npm test             # 49 tests: boards, prices, budget rules, turn order, every draft finishes, the attributes, fresh teams, the series, formations, the bot levels
npm run simulate     # the levels play each other; prints win rates and the hands that come up
npm start            # then open http://localhost:8779/draft/ and play (?mode=eleven&level=hard&seed=abc for a link)
```

Same stack as Sticker Season: plain ES modules, no build step. It imports the engine and the card data from `../stickers`.

## Publishing

The Claude artifact viewer does not load scripts that climb several folders (`../../../stickers/...`), which is how Prem Wheel reaches
Sticker Season's engine in this repo. (It shows "This browser isn't supported", on a phone that is fine in every other way.) So for
publishing, `tools/stage.mjs` copies everything into one flat tree laid out like Sticker Season's page (`src/engine`, `src/ui`, `src/draft`,
`src/data`, never more than one `../`) and rewrites the imports; it fails if any import would not resolve. Publish `.stage/blind-five/index.html`
with the files under it.

```bash
node tools/stage.mjs      # -> ../.stage/blind-five   (git-ignored)
```

```
src/engine/draft.js   the whole match as a pure state machine: wheel, boards, prices, budget, picks, showdown
src/engine/bot.js     easy / medium / hard
src/ui/               the page (game.js) and its stylesheet, on top of Sticker Season's card face
tools/simulate.mjs    bots against bots
```

## Rules in numbers

- **Budget** £10 for the team (£30 in 11-a-side), renewed every match. **You must keep £1 for every round still to come**, so a pick is never impossible.
- **Board** 8 players: three true tier 1 (always £1), two tier 2, one each tier 3, 4, 5. Tiers are the player's overall within his
  position (top 5% is tier 5, then 10%, 20%, 30%, 35%). Only players with 100+ Premier League appearances are on a board.
- **Price** is the true tier, nudged one step with probability 0.3 for tiers 2-4 (a **bargain** if down, a **trap** if up);
  a star can only be a £4 bargain. After the draft each player's caption says what he cost and whether he was a bargain or a trap.
- **Wheel** GK 1 : DEF 2 : MID 2 : FWD 2, never one position more than twice in a match.
- **Attributes** one per match, drawn at the start of the match from those not yet used in the series, from the seed (so it never depends on who you buy). Goals, assists, appearances and league titles are career totals; goal involvements are goals + assists; wins and clean sheets are estimates (below); discipline is yellow cards + 3 × red cards. The list is in `src/engine/attributes.js`: **adding an attribute is one entry there** and the draw, the bot, the tally and the page pick it up.
- **Clean sheets need a back line.** Only goalkeepers and defenders earn them, so a 5-a-side match on clean sheets re-draws the wheel until it has at least two goalkeeper or defender slots (`needs` on the attribute in `attributes.js`); in 11-a-side every formation has four or more.
- **Fresh teams** every match: a fresh budget, a fresh team, a fresh formation (11-a-side). A player who was on any board earlier in the series is not on a later one, so nobody can be used twice (if a tier runs out, the board takes the nearest tier that has someone left: there are only five star goalkeepers).
- **Showdown** the sum of each team's players' totals in the match's attribute; the bigger total wins the match, equal totals are a draw. First to two matches wins (the series stops at 2-0). If a three-match series is level (a drawn match), the larger share of each attribute's all-time record wins; otherwise a draw.

## Attributes we have

Everything below is in the FBref Standard Stats exports for **all 34 seasons** (1992/93 to 2025/26), checked column by column. It is more than
the four in the game: the Sticker Season cards were built to use only appearances, goals, assists and cards, so these are not on the cards yet.

**In the game now**: appearances, goals, assists, goal involvements (goals + assists), league titles, wins (est.), clean sheets (est.), discipline (yellows + 3 × reds).

**Complete in every season but not used yet**
- **Starts** (so substitute appearances = appearances - starts), **minutes** and **90s played**.
- **Non-penalty goals**, **penalties scored** and **penalties taken** (so penalty goals and conversion rate).
- **Yellow cards** and **red cards** separately (the game combines them).
- **Nationality** (a country code on every row) and **age / birth year**.
- **Season-by-season rows** (not only career totals): best season for goals or assists, seasons with 10+ goals, seasons played, clubs, club-seasons.

**Derived from those, no new data needed**: goals or assists per game or per 90 minutes (with a minimum-minutes rule), starts as a share of appearances ("a regular"), career length in seasons, number of clubs, a one-club career, debut season, goals from the bench.

**Not available for 34 seasons**: tackles, interceptions, saves, clean sheets, shots, xG, passes, fouls, offsides, trophies, transfer fees, minutes by position, results, anything per match. (Rule 2: a stat with gaps is not used.)

Next, in my order of preference: **minutes** (like appearances but it rewards starters), **penalties scored** (a lucky, funny one), **nationality** (a team of eleven from
eleven countries, or "most English players"), **seasons played / career length**, **non-penalty goals**.

## Wins and clean sheets (estimated), and league titles

**Match results are open data.** `stickers/tools/fetch-results.mjs` downloads every Premier League match from
[footballcsv/england](https://github.com/footballcsv/england) (1992/93 to 2020/21) and
[openfootball/england](https://github.com/openfootball/england) (2021/22 to 2025/26), both CC0 / public domain, and writes
`stickers/data/results.json` (committed, 237 KB, about 12,400 matches). Each season is checked before it is written: the right number of matches
(380, or 462 for the first three 22-club seasons), every club with the same number of games, goals for = goals against, and **the table leader equal to the champion**
in `stickers/tools/champions.mjs` (all 34 match, which independently confirms the champions list, including Arsenal in 2025/26). Spot checks are in
`stickers/test/results.test.mjs`: Arsenal 2003/04 26-12-0, Derby 11 points, Man City 100, Chelsea 2004/05 95 points and 25 clean sheets, Arsenal 2025/26 85 points.

**The player stat is an estimate**, because the results have no lineups. For every player's row in every season (club, position, minutes):

```
share = his minutes / (the club's matches x 90)
wins          += the club's wins x share                           (every player)
cleanSheets   += the club's clean sheets x share                   (only if the row's first position is GK or DF)
```

- **It adds up, and the build checks that.** Across every club-season the players' shares sum to 10.34 to 11.14 (11 players are on the pitch) and the goalkeepers'
  to 0.96 to 1.03 (exactly one is). A club-season outside 10.2-11.3 or 0.9-1.05 stops the build.
- **Checked against published goalkeeper totals**: Čech 199 (published 202), James 169 (169), de Gea 152 (147). Within about 3%.
- **Wins are minutes-weighted**, not "appearances in a win": a winger who is substituted at 70 minutes gets 78% of the win. So Giggs is 333, not the 400-odd his appearances in wins would give.
  The label says (est.). It is credited to every position.
- **Clean sheets go to goalkeepers and defenders only, season by season**, as the official stat does. A striker earns none, and neither does a midfielder (including the 33 corrected ones below:
  Milner, Essien, Butt...). If credited to everyone, clean sheets would correlate 0.89 with appearances and Lampard (235) and Giggs (227) would top
  the list: a team-success stat, not a defensive one. The back-line version is what gives a reason to spend on keepers and defenders: the top six are Terry 215, Čech 199, Ferdinand 195,
  Carragher 194, James 169, Phil Neville 164. Goalkeepers average 33.7 and defenders 28.4 a player against 0.3 for midfielders and 0.0 for forwards.
- **Why both?** Wins (est.) is the one where every one of the eleven slots counts and price does the sorting (it correlates 0.86 with appearances, so a long career matters most, with a
  club-quality swing on top). Clean sheets (est.) is the one with a clear job, where the back line is the whole match.

**League titles.** A player gets a title for every season he made **5 or more league appearances for the champions** (the line the Premier League uses for a winners' medal). The 34 champions
are in `stickers/tools/champions.mjs` (Man Utd 13, Man City 8, Chelsea 5, Arsenal 4, Liverpool 2, Blackburn 1, Leicester 1). Checked against careers everyone knows: Giggs 13, Scholes 11, Neville 8,
Keane 7, Rooney 5, Terry 5, Cantona 4, Kompany 4, Lampard 3 (not the one at Man City when Chelsea won), Henry 2, Salah 2, Shearer 1, Kane 0, Gerrard 0. 334 of 3,162 players have one. It is
the attribute that is least like appearances (correlation 0.27), and a squad player at a title-winning club beats a star at one that never won it. A match on titles is drawn about 5% of the time
against a bot that knows the stats; a drawn match just doesn't count and the series goes to the third.

## What the simulator found (win % over a whole series; draws count half; rows are "you")

Best of three, fresh teams, 5-a-side (£10), 400 series per pairing:

| you \ opponent | random | easy | medium | hard |
|---|---|---|---|---|
| random | 48 | 33 | 3 | 0 |
| easy | 68 | 49 | 8 | 1 |
| medium | 96 | 90 | 54 | 15 |
| hard | 100 | 99 | 80 | 50 |

Best of three, fresh teams, 11-a-side (£30), 200 series per pairing:

| you \ opponent | random | easy | medium | hard |
|---|---|---|---|---|
| random | 51 | 39 | 1 | 0 |
| easy | 55 | 48 | 0 | 0 |
| medium | 100 | 100 | 54 | 9 |
| hard | 100 | 100 | 89 | 45 |

- **Knowing the attribute while you pick makes the bots' knowledge close to decisive.** A bot that knows the stats (even through a fog) beats one that
  only reads prices 90% of the time in 5-a-side and every time in 11-a-side, and a random picker has almost no chance against it. That is the intended
  skill (football knowledge), but it also means **a human sits somewhere between easy and medium**: the real test of difficulty is a person against
  medium, which has not happened yet. If medium proves too strong, the fog (`FOG` in `bot.js`) is the dial.
- A fresh draft every match is why the series is so skill-driven: three independent chances to buy the right team. Hard beats medium 80% (5-a-side) and
  89% (11-a-side).
- **Which attribute is hardest to beat the bot at** (hard's match win rate against medium, with all eight attributes): in 5-a-side goal involvements 65%, appearances and titles 68%, clean sheets 69%, goals 71%, wins 72%,
  assists and discipline 78%. In 11-a-side titles 77% and wins 71% (the team-success attributes, where prices point least at the answer), clean sheets 83%, discipline 88%. The spread is narrow, so no
  attribute is a lottery and none is solved.
- About two series in three are over after two matches. A quarter of matches (24% in 5-a-side, 30% in 11-a-side) are within 10%.
- The bot levels: easy = prices only; medium = knows the stats through a fog; hard = exact stats and value for money, for the attribute drawn for the match.

## Not built

More attributes (see "Attributes we have"), including wins (see above) · keeping a player you like across matches (a rule for a different game) · a human-tested medium level · a formation you choose rather than roll · substitutes · the same match from the other seat · a streak or ladder · sound.

## Positions

The pots are by position, so a wrong position puts a player in the wrong pot. FBref gives each player a position per season and, for many, two ("DF,MF") in an order that is not reliable: Michael Essien and
Nicky Butt are "DF,MF" in every season they played, so taking the first listed position made them defenders. 116 players with 100+ appearances were defenders only because of a "DF,MF" row. A classifier on goals,
assists, cards and minutes (85% accurate on players with an unambiguous position) found the candidates, and the clear midfielders were corrected by hand in `stickers/tools/positions.mjs`: 33 of them (defensive and
central midfielders such as Essien, Butt, Gilberto Silva, Petit, Delph, Rodwell; wingers and wide midfielders such as Kanchelskis, Navas, Kilbane, Brunt, Richardson; and Milner). Full-backs and centre-backs
who are listed "DF,MF" (Carragher, Walker, Coleman, Azpilicueta, Ledley King, Zabaleta...) stay defenders. The build refuses an override for a player who isn't in the pool or one that changes nothing. A player's
overall (OVR, so his tier and price) is recalculated with his corrected position.

**Not corrected, a known limit:** 122 players tagged forward from an "FW,MF" row, most of them wingers and attacking midfielders (Giggs, Fàbregas, David Silva, Hazard, Sterling, Lennon, Mahrez...). Whether a winger
belongs in the forward pot or the midfield pot is a design choice rather than an error, so they are untouched.
