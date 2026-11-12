# BLIND FIVE (working title)

A **blind budget draft against a bot**, on the [Sticker Season](../stickers/) career cards (every Premier League player with
100+ appearances, 1992/93 to 2025/26). Inspired by the "you have £10, pick your front three" quiz.

Two games, one engine (pick on the title screen):

| | 5-a-side | 11-a-side |
|---|---|---|
| Budget | £10 | £30 |
| Rounds | 5 | 11 |
| Which position | a wheel names it each round (never one position three times) | a **formation** is rolled at the start (4-4-2, 4-3-3, 4-5-1, 3-5-2, 3-4-3, 5-3-2) and both teams work through it, goalkeeper first, then defenders, midfielders, forwards |

Three steps:

1. **Pick a team** (five or eleven) on a budget. Each round a board of eight players of one position goes up with **a name and a price only**: no stats, no club. You alternate picks (who goes first swaps every round) and you can see what the bot takes.
2. **Three attributes** are drawn from goals, assists, appearances and discipline (a yellow card is 1 point, a red card is 3): a **best of three**. A setting on the title screen decides whether they are **called in advance** (the default: you know them while you pick) or **rolled after the draft** (you buy blind).
3. **Add it up, three times.** For each attribute, each team's **real Premier League career totals**; the bigger total wins the match. First to two matches wins the series.

No hands, no multipliers, no ratings: none of Sticker Season's rules are used, only its player data.

```bash
cd draft
npm test             # 32 tests: boards, prices, budget rules, turn order, every draft finishes, the roll, the totals, formations, the bot levels
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

- **Budget** £10 for the team. **You must keep £1 for every round still to come**, so a pick is never impossible.
- **Board** 8 players: three true tier 1 (always £1), two tier 2, one each tier 3, 4, 5. Tiers are the player's overall within his
  position (top 5% is tier 5, then 10%, 20%, 30%, 35%). Only players with 100+ Premier League appearances are on a board.
- **Price** is the true tier, nudged one step with probability 0.3 for tiers 2-4 (a **bargain** if down, a **trap** if up);
  a star can only be a £4 bargain. After the draft each player's caption says what he cost and whether he was a bargain or a trap.
- **Wheel** GK 1 : DEF 2 : MID 2 : FWD 2, never one position more than twice in a match.
- **Attributes** three different ones from the four, drawn once from the seed at the start (called in advance) or after the draft (rolled after). It is the same three either way for a seed, and it never depends on who you picked. Goals, assists and appearances are career totals; discipline is yellow cards + 3 × red cards.
- **Showdown** for each attribute, the sum of each team's players' totals; the bigger total wins the match, equal totals are a draw. First to two matches wins (the page stops at 2-0). If a series is somehow level, the larger share of each attribute's all-time record wins; otherwise a draw.

## Attributes we have

Everything below is in the FBref Standard Stats exports for **all 34 seasons** (1992/93 to 2025/26), checked column by column. It is more than
the four in the game: the Sticker Season cards were built to use only appearances, goals, assists and cards, so these are not on the cards yet.

**In the game now**: appearances, goals, assists, discipline (yellows + 3 × reds).

**Complete in every season but not used yet**
- **Starts** (so substitute appearances = appearances - starts), **minutes** and **90s played**.
- **Non-penalty goals**, **penalties scored** and **penalties taken** (so penalty goals and conversion rate).
- **Yellow cards** and **red cards** separately (the game combines them).
- **Nationality** (a country code on every row) and **age / birth year**.
- **Season-by-season rows** (not only career totals): best season for goals or assists, seasons with 10+ goals, seasons played, clubs, club-seasons.

**Derived from those, no new data needed**: goal involvements (goals + assists), goals or assists per game or per 90 minutes (with a minimum-minutes rule), starts as a share of appearances ("a regular"), career length in seasons, number of clubs, a one-club career, debut season, goals from the bench.

**Not available for 34 seasons**: tackles, interceptions, saves, clean sheets, shots, xG, passes, fouls, offsides, trophies, transfer fees, minutes by position, results, anything per match. (Rule 2: a stat with gaps is not used.)

Ones that would change the game, in my order of preference: **goal involvements** (goals + assists: forwards and midfielders both count),
**minutes** (like appearances but it rewards starters), **penalties scored** (a lucky, funny one), **nationality** (a team of eleven from
eleven countries, or "most English players"), **seasons played / career length**, **non-penalty goals**.

## What the simulator found (300 matches per pairing, win %; draws count half; rows are "you")

Best of three, 5-a-side (£10), attributes called in advance:

| you \ opponent | random | easy | medium | hard |
|---|---|---|---|---|
| random | 44 | 32 | 20 | 6 |
| easy | 66 | 52 | 27 | 8 |
| medium | 84 | 71 | 56 | 19 |
| hard | 95 | 90 | 76 | 54 |

Best of three, 11-a-side (£30), attributes called in advance:

| you \ opponent | random | easy | medium | hard |
|---|---|---|---|---|
| random | 50 | 33 | 3 | 0 |
| easy | 66 | 49 | 9 | 0 |
| medium | 94 | 93 | 53 | 10 |
| hard | 100 | 100 | 88 | 52 |

- **A best of three makes skill matter more**: the same bots against each other are more lopsided than in a single match (hard beats
  medium 76% in 5-a-side and 88% in 11-a-side, up from 72% and 81%), because one unlucky attribute no longer decides it. A random picker
  now almost never beats a bot that knows the stats in 11-a-side.
- **Called in advance vs rolled after makes little difference to the results** (5-a-side, hard against medium: 76% against 76%; 11-a-side
  88% against 87%). Three of the four attributes are in play either way, so all that "in advance" tells you is which ONE attribute is left out.
  It is a difference of feel (informed choices against a gamble), not of balance. A bigger difference would need a different rule, for example
  revealing attributes one at a time as the draft goes on, or only one before the draft.
- About two series in three are over after two matches (hard against medium: 62% in 5-a-side, 67% in 11-a-side), so the third match is
  often not played. A fifth of matches are within 10%.
- The bot levels: easy = prices only; medium = knows the stats through a fog; hard = exact stats and value for money, using the
  three attributes if they are known and the average of all four if not.
- The budget history for 11-a-side: £25, then £30 after a playtest said it needed more money.

## Not built

More attributes (see "Attributes we have") · revealing the attributes one at a time as the draft goes on · a human-tested medium level · a formation you choose rather than roll · substitutes · the same match from the other seat · a streak or ladder · sound.
