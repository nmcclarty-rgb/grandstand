# PREM WHEEL (working title)

(The folder is still called `draft/`, and earlier versions were called Blind Five and FPL Battler.)

A **blind budget draft against a bot**, on the [Sticker Season](../stickers/) career cards (every Premier League player with
100+ appearances, 1992/93 to 2025/26). Inspired by the "you have £10, pick your front three" quiz.

Two games, one engine (pick on the title screen):

| | 5-a-side | 11-a-side |
|---|---|---|
| Budget | £10 | £30 |
| Rounds | 5 | 11 |
| Which position | a **formation** (1-2-1, 2-1-1, 1-1-2 or 2-2: one goalkeeper and four outfield players) is rolled at the start of every match | a **formation** is rolled at the start of every match (4-4-2, 4-3-3, 4-5-1, 3-5-2, 3-4-3, 5-3-2) |

Every draw is a **wheel you can see**: a spinning SVG wheel with a pointer, sized by the real odds (4-4-2 is a bigger slice than 5-3-2), that lands on the slice the engine has already drawn. It spins for the attribute (faded slices are ones already used in the series) and
the formation, in both modes. Click it to skip. (`src/ui/wheel.js`: the geometry is tested to land every slice under the pointer, away from the edges.)

Nothing between the rounds needs a button: when a draft ends the page moves to the showdown, counts by itself after two seconds, and after a match it counts down five seconds (to read the
result) and starts the next fresh draft. A tap, a click or Space on the showdown screen skips a wait. Only "Play again" and "Change opponent" at the very end are buttons.

## The game loop: the knockout ladder

The main game is a **knockout ladder** (`src/engine/tournament.js`): seven rounds, each a **single match** (one fresh draft for one attribute) against a Premier League club. **Lose and you are out; win the Final and you
are champions.** The opponent is always the same bot, the **medium** bot (it knows the stats through a fog). What changes up the ladder is its **money**: a bigger club has a bigger budget, as a share of yours.

| Round | Club (one picked from the seed) | Its budget, 5-a-side / 11-a-side |
|---|---|---|
| 1 | Luton, Sheffield Utd, Norwich, Watford, Huddersfield, Cardiff | 60% (£6 / £18) |
| 2 | Bournemouth, Brentford, Fulham, Crystal Palace, Ipswich, Stoke | 70% (£7 / £21) |
| 3 | Wolves, Southampton, Brighton, Leeds, Sunderland, West Brom | 80% (£8 / £24) |
| 4 | Everton, West Ham, Leicester, Aston Villa | 90% (£9 / £27) |
| Quarter-final | Newcastle, Spurs | 100% (£10 / £30) |
| Semi-final | Arsenal, Chelsea | 110% (£11 / £33) |
| Final | Man City, Liverpool, Man Utd | 120% (£12 / £36) |

You always have the mode's base budget. A round that is level on the count is decided by more appearances, then a coin (a knockout needs a winner). The path is the same for a seed. The page shows the whole path before each
round, with its badge and money, and everything flows by itself (a tap or Space skips a wait); a run is saved as "best run" and "times champions" in the browser. **Quick series** (a best of three against a bot of the level you
pick) is still on the title screen.

**Why money is the difficulty dial, not the bot** (`tools/budget-sim.mjs` in the notes below): for two bots of equal skill, giving one 25% more money turns a 47% coin flip into a 12% win for the other in 5-a-side (30% in 11-a-side,
where the board caps the benefit), and it works as a handicap too: a price-only player beats a hard bot 1% of the time at equal money, 19% with 50% more and 61% with double. The effect is **steep** (each £1 in 5-a-side is 10%, so
the ladder steps by 10%) and **saturates** (a pick costs at most £5, so money above about £25 in 5-a-side and £55 in 11-a-side buys nothing). One fixed bot also means the same opponent behaviour all the way up, which a human can learn.

**How far does each kind of player get?** (`node tools/ladder-sim.mjs`, 300 tournaments each; the share who win at least n rounds)

| 5-a-side | R1 | R2 | R3 | R4 | QF | SF | Final |
|---|---|---|---|---|---|---|---|
| random picker | 62% | 26% | 9% | 1% | 0% | 0% | 0% |
| price-only (easy) | 62% | 29% | 10% | 3% | 0% | 0% | 0% |
| equal to the bot (medium) | 97% | 90% | 68% | 46% | 21% | 7% | 2% |
| knows the stats exactly (hard) | 100% | 98% | 89% | 76% | 56% | 33% | 16% |

(11-a-side: medium 97 / 83 / 67 / 41 / 22 / 8 / 4%, hard 99 / 97 / 93 / 84 / 69 / 51 / 35%.) A player as good as the bot should usually win the first rounds, face a coin flip around Round 4 or the Quarter-final, and rarely win the Final.
Nobody has played it yet: the multipliers (`LADDER` in `tournament.js`) are the first thing to tune from real runs.

## The quick series

A series is a **best of three matches**, and every match is a fresh draft:

1. **An attribute is drawn** at the start of the match: goals, assists, goal involvements (goals plus assists), appearances, league titles, wins (est.), clean sheets (est.) or discipline (a yellow card is 1 point, a red card is 3). Never the same one twice in a series.
2. **You draft a fresh team for it** on a fresh budget, tailored to the attribute you know is being counted. Each round a board of eight players of one position goes up with **a name and a price only**: no stats, no club. You alternate picks (who goes first swaps every round, and the side that picked first last round of a match goes second in the next) and you can see what the bot takes. Anyone used in an earlier match of the series is gone.
3. **Add it up.** Each team's **real Premier League career totals** in the attribute; the bigger total wins the match. **First to two matches wins the series.**

No hands, no multipliers, no ratings: none of Sticker Season's rules are used, only its player data.

```bash
cd draft
npm test             # 57 tests: boards, prices, budget rules, turn order, every draft finishes, the attributes, fresh teams, the series, formations, the bot levels
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
src/engine/draft.js   the whole series as a pure state machine: attribute, formation, boards, prices, budget, picks, showdown
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
- **Formation** rolled at the start of every match, the same for both teams, worked through goalkeeper first (5-a-side: 1-2-1 and 2-1-1 at weight 3, 1-1-2 at 2, 2-2 at 1; 11-a-side: 4-4-2 and 4-3-3 at 3, 4-5-1 and 3-5-2 at 2, 3-4-3 and 5-3-2 at 1). There is always exactly **one goalkeeper**. (5-a-side used to roll a position each round on a wheel, which could give two goalkeepers; it works like 11-a-side now.)
- **Attributes** one per match, drawn at the start of the match from those not yet used in the series, from the seed (so it never depends on who you buy). Goals, assists, appearances and league titles are career totals; goal involvements are goals + assists; wins and clean sheets are estimates (below); discipline is yellow cards + 3 × red cards. The list is in `src/engine/attributes.js`: **adding an attribute is one entry there** and the draw, the bot, the tally and the page pick it up.
- **Clean sheets always have a back line.** Only goalkeepers and defenders earn them, and every formation has a goalkeeper and at least one defender (every 5-a-side formation has a defender, and 11-a-side has three or more), so a clean-sheets match is never empty.
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

A **league** after the ladder: a mini-league against clubs, single matches, with a table whose other fixtures are played by the same engine bot against bot, and promotion to a division with bigger budgets · a cup of best-of-3 ties ·
the budget in finer steps (£m, so a rung can be 5%) · more attributes (minutes, penalties scored, nationality) · a human-tested ladder: the multipliers and the Round 1 gift are guesses from the simulator · sound.

## Positions

The pots are by position, so a wrong position puts a player in the wrong pot. FBref gives each player a position per season and, for many, two ("DF,MF", "FW,MF") in an order that is not reliable: Michael Essien and
Nicky Butt are "DF,MF" in every season they played, so taking the first listed position made them defenders. 116 players with 100+ appearances were defenders, and 122 were forwards, only because of such a row.
A classifier on goals, assists, cards and minutes found the candidates (85% accurate for defender-or-midfielder and 94% for forward-or-midfielder on players with an unambiguous position), and the clear
cases were moved by hand in `stickers/tools/positions.mjs`: **100 players to midfield**.

- **33 defenders to midfield**: defensive and central midfielders (Essien, Butt, Gilberto Silva, Petit, Delph, Rodwell) and wide midfielders (Kanchelskis, Navas, Kilbane, Brunt, Richardson), and Milner.
  Full-backs and centre-backs who are listed "DF,MF" (Carragher, Walker, Coleman, Azpilicueta, Ledley King, Zabaleta...) stay defenders.
- **67 forwards to midfield**: wingers, wide forwards and playmakers, as Fantasy Premier League does it (Giggs, Fàbregas, David Silva, Hazard, Sterling, Mahrez, Mané, Bale, Saka, Foden, Lennon, Downing,
  Grealish...). Strikers and second strikers stay forwards (Rooney, Welbeck, Yorke, Tevez, Aubameyang). Salah and Kane, whom FBref lists as plain "FW", are untouched even though Fantasy Premier League has
  Salah as a midfielder.
- **The pots are now** GK 216, DEF 1,101, MID 1,111, FWD 734 (from 216 / 1,134 / 1,011 / 801 before either fix).
- **Effects.** A player's overall (so his tier and price) is recalculated with his corrected position, and the midfielder weights favour assists and appearances, so wingers with long careers rise: **Giggs is now
  the top overall (92, from 83)**, ahead of Rooney and Shearer (90). A corrected midfielder earns no clean sheets.
- The build refuses an override for a player who isn't in the pool or one that changes nothing, and tests pin the famous cases both ways.

**Judgement calls, not errors**: players who played both roles over their careers (Walcott, Sánchez, Ronaldo, Arnautović, Cahill, Dempsey, Ayew's role at different clubs) were left as FBref has them where the
classifier was not clear. If you spot another, add the id to `positions.mjs`.
