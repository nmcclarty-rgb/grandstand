# BLIND FIVE (working title)

A **blind budget draft against a bot**, on the [Sticker Season](../stickers/) career cards (every Premier League player with
100+ appearances, 1992/93 to 2025/26). Inspired by the "you have £10, pick your front three" quiz.

Three steps:

1. **Pick a team of five** with £10 each over five rounds. Each round the wheel names a position and eight players go on the board with
   **a name and a price only**: no stats, no club. You alternate picks (who goes first swaps every round) and you can see what the bot takes.
2. **Roll which attribute** is counted: goals, assists, appearances or discipline (a yellow card is 1 point, a red card is 3). It is rolled
   **after** the draft, so you buy without knowing.
3. **Add it up.** Each team's **real Premier League career totals** in the attribute. The biggest total wins.

No hands, no multipliers, no ratings: none of Sticker Season's rules are used, only its player data.

```bash
cd draft
npm test             # 19 tests: boards, prices, budget rules, turn order, every draft finishes, the roll, the totals, the bot levels
npm run simulate     # the levels play each other; prints win rates and the hands that come up
npm start            # then open http://localhost:8779/draft/ and play
```

Same stack as Sticker Season: plain ES modules, no build step. It imports the engine and the card data from `../stickers`.

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
- **Attribute** rolled once from the seed **after** the draft (it does not depend on who you picked). Goals, assists and appearances are
  career totals; discipline is yellow cards + 3 × red cards.
- **Showdown** the sum of each team's five players' totals. Equal totals are a draw.

## What the simulator found (win %, draws count half; the attribute is rolled after the draft)

| you \ opponent | random | easy | medium | hard |
|---|---|---|---|---|
| random | 47 | 38 | 26 | 11 |
| easy | 62 | 50 | 36 | 18 |
| medium | 75 | 67 | 45 | 25 |
| hard | 85 | 85 | 72 | 47 |

- **Price carries information**: easy, which only reads prices, beats a random picker 62-38.
- **Knowledge still wins, but luck is real.** Rolling after the draft means nobody can pick for the attribute: the bots value a player by his
  average standing across all four. Hard beats medium 72% of the time (it was 86% when the attribute was known), and a random picker
  still beats hard 11% of the time: the roll decides some matches.
- The bot levels: easy = prices only; medium = knows the stats through a fog; hard = exact stats and value for money. Hard is not beatable
  for a person who does not know every career total; medium is the fair fight. No human has played it yet.
- **What the blind roll changes:** you should buy a team that is good at more than one attribute. A long-serving player scores in appearances
  and discipline; a striker only in goals; a goalkeeper in appearances and discipline but never goals.

## Not built

A rematch against the same boards from the other seat · a streak or ladder · a medium level calibrated against real people · an option to roll the attribute before the draft (a knowledge game rather than a gamble) · sound.
