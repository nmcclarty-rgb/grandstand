# BLIND FIVE (working title)

A **blind budget draft against a bot**, on the [Sticker Season](../stickers/) career cards (every Premier League player with
100+ appearances, 1992/93 to 2025/26). Inspired by the "you have £10, pick your front three" quiz.

Two games, one engine (pick on the title screen):

| | 5-a-side | 11-a-side |
|---|---|---|
| Budget | £10 | £30 |
| Rounds | 5 | 11 |
| Which position | a wheel names it each round (never one position three times) | a **formation** is rolled at the start of every match (4-4-2, 4-3-3, 4-5-1, 3-5-2, 3-4-3, 5-3-2) and both teams work through it, goalkeeper first, then defenders, midfielders, forwards |

A series is a **best of three matches**, and every match is a fresh draft:

1. **An attribute is drawn** at the start of the match: goals, assists, goal involvements (goals plus assists), appearances, league titles or discipline (a yellow card is 1 point, a red card is 3). Never the same one twice in a series.
2. **You draft a fresh team for it** on a fresh budget, tailored to the attribute you know is being counted. Each round a board of eight players of one position goes up with **a name and a price only**: no stats, no club. You alternate picks (who goes first swaps every round, and the side that picked first last round of a match goes second in the next) and you can see what the bot takes. Anyone used in an earlier match of the series is gone.
3. **Add it up.** Each team's **real Premier League career totals** in the attribute; the bigger total wins the match. **First to two matches wins the series.**

No hands, no multipliers, no ratings: none of Sticker Season's rules are used, only its player data.

```bash
cd draft
npm test             # 43 tests: boards, prices, budget rules, turn order, every draft finishes, the attributes, fresh teams, the series, formations, the bot levels
npm run simulate     # the levels play each other; prints win rates and the hands that come up
npm start            # then open http://localhost:8779/draft/ and play (?mode=eleven&level=hard&seed=abc for a link)
```

Same stack as Sticker Season: plain ES modules, no build step. It imports the engine and the card data from `../stickers`.

## Publishing

The Claude artifact viewer does not load scripts that climb several folders (`../../../stickers/...`), which is how Blind Five reaches
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
- **Attributes** one per match, drawn at the start of the match from those not yet used in the series, from the seed (so it never depends on who you buy). Goals, assists, appearances are career totals; goal involvements are goals + assists; discipline is yellow cards + 3 × red cards. The list is in `src/engine/attributes.js`: **adding an attribute is one entry there** and the draw, the bot, the tally and the page pick it up.
- **Fresh teams** every match: a fresh budget, a fresh team, a fresh formation (11-a-side). A player who was on any board earlier in the series is not on a later one, so nobody can be used twice (if a tier runs out, the board takes the nearest tier that has someone left: there are only five star goalkeepers).
- **Showdown** the sum of each team's players' totals in the match's attribute; the bigger total wins the match, equal totals are a draw. First to two matches wins (the series stops at 2-0). If a three-match series is level (a drawn match), the larger share of each attribute's all-time record wins; otherwise a draw.

## Attributes we have

Everything below is in the FBref Standard Stats exports for **all 34 seasons** (1992/93 to 2025/26), checked column by column. It is more than
the four in the game: the Sticker Season cards were built to use only appearances, goals, assists and cards, so these are not on the cards yet.

**In the game now**: appearances, goals, assists, goal involvements (goals + assists), league titles, discipline (yellows + 3 × reds).

**Complete in every season but not used yet**
- **Starts** (so substitute appearances = appearances - starts), **minutes** and **90s played**.
- **Non-penalty goals**, **penalties scored** and **penalties taken** (so penalty goals and conversion rate).
- **Yellow cards** and **red cards** separately (the game combines them).
- **Nationality** (a country code on every row) and **age / birth year**.
- **Season-by-season rows** (not only career totals): best season for goals or assists, seasons with 10+ goals, seasons played, clubs, club-seasons.

**Derived from those, no new data needed**: goals or assists per game or per 90 minutes (with a minimum-minutes rule), starts as a share of appearances ("a regular"), career length in seasons, number of clubs, a one-club career, debut season, goals from the bench.

**Not available for 34 seasons**: match wins, tackles, interceptions, saves, clean sheets, shots, xG, passes, fouls, offsides, trophies, transfer fees, minutes by position, results, anything per match. (Rule 2: a stat with gaps is not used.)

Next, in my order of preference: **minutes** (like appearances but it rewards starters), **penalties scored** (a lucky, funny one), **nationality** (a team of eleven from
eleven countries, or "most English players"), **seasons played / career length**, **non-penalty goals**.

## League titles, not wins

Match wins are not in the exports (no results, no per-match lineups), but **league titles** are easy and exact: who won the Premier League each
season is public record, so a player gets a title for every season he made **5 or more league appearances for the champions** (the line the
Premier League uses for a winners' medal). The 34 champions are in `stickers/tools/champions.mjs` (Man Utd 13, Man City 8, Chelsea 5, Arsenal 4,
Liverpool 2, Blackburn 1, Leicester 1; 2025/26 is Arsenal, checked against several published final tables, and the exports have a complete 38 games
for every club that season). It is attached to every card as `titles` by `build-cards.mjs`.

Checked against careers everyone knows: Giggs 13, Scholes 11, Neville 8, Keane 7, Rooney 5, Terry 5, Cantona 4, Kompany 4, Lampard 3 (not the one
at Man City when Chelsea won), Henry 2, Salah 2 (two league games for Chelsea in 2014/15 don't count), Shearer 1, Kane 0, Gerrard 0. 334 of the
3,162 players have at least one. It is an attribute a person can really *know from a name*, and it is a club's achievement: a squad player at a title-winning club
beats a star at one that never won it. It is the one attribute where the bots' idea of value (a share of the record, 13) is nearly worthless to a
price-only reader, which makes it a good one for a knowledgeable human.

A match on titles is drawn about 5% of the time against a bot that knows the stats (up to about 11% for two hard bots in 5-a-side, rarer in
11-a-side), because totals are small (a mean of 6.5 titles per team in 5-a-side, 18 in 11-a-side). A drawn match just doesn't count; the series
then goes to the third match, and a level three-match series is settled by the larger share of the records.

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
- **Which attribute is hardest to beat the bot at**: hard's match win rate against medium is highest on discipline (80%) and appearances (75%) and
  lowest on goal involvements (67%) and goals (70%), where the stars are on everyone's lips and prices already point at them.
- About two series in three are over after two matches. A quarter of matches (24% in 5-a-side, 30% in 11-a-side) are within 10%.
- The bot levels: easy = prices only; medium = knows the stats through a fog; hard = exact stats and value for money, for the attribute drawn for the match.

## Not built

More attributes (see "Attributes we have"), including wins (see above) · keeping a player you like across matches (a rule for a different game) · a human-tested medium level · a formation you choose rather than roll · substitutes · the same match from the other seat · a streak or ladder · sound.
