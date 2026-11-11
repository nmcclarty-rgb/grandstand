# BLIND FIVE (working title)

A **blind budget draft against a bot**, on the [Sticker Season](../stickers/) career cards (every Premier League player with
100+ appearances, 1992/93 to 2025/26). Inspired by the "you have £10, pick your front three" quiz.

Three steps:

1. **Roll which attribute** is counted: goals, assists, appearances or discipline (a yellow card is 1 point, a red card is 3). It is shown all through the draft.
2. **Pick a team of five** with £10 each over five rounds. Each round the wheel names a position and eight players go on the board with
   **a name and a price only**: no stats, no club. You alternate picks (who goes first swaps every round) and you can see what the bot takes.
3. **Add it up.** Each team's **real Premier League career totals** in the attribute. The biggest total wins.

No hands, no multipliers, no ratings: none of Sticker Season's rules are used, only its player data.

```bash
cd draft
npm test             # 18 tests: boards, prices, budget rules, turn order, every draft finishes, the roll, the totals, the bot levels
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
- **Attribute** rolled once from the seed, before the draft, so you pick knowing what is counted. Goals, assists and appearances are
  career totals; discipline is yellow cards + 3 × red cards.
- **Showdown** the sum of each team's five players' totals. Equal totals are a draw.

## What the simulator found (1,000 matches per pairing; win %, draws count half)

| you \ opponent | random | easy | medium | hard |
|---|---|---|---|---|
| random | 49 | 39 | 27 | 3 |
| easy | 62 | 49 | 34 | 6 |
| medium | 72 | 67 | 52 | 11 |
| hard | 96 | 94 | 86 | 52 |

- **Price carries information**: easy, which only reads prices, beats a random picker 62-38.
- **Knowing the attribute matters far more than before**: once you know it is goals, a forward is worth the money and a goalkeeper
  is worth nothing, so a bot that knows the stats crushes one that does not. The bot levels are: easy = prices only; medium = knows the
  totals through a fog (55 points of the record either way); hard = exact totals and value for money.
- **Hard is unbeatable for a person**: nobody knows every player's exact totals. Medium is the fair fight, and the real test of
  whether it is fun is a human against medium. No human has played it yet.
- A match is decided by under 14% of the larger total about one time in seven, so there are close ones.
- Appearances favour long careers, goals favour forwards, and discipline is the most knowledge-driven of the four (hard beats medium 95%
  of the time there): who is dirty is not obvious from a name.

## Not built

A rematch against the same boards from the other seat · a streak or ladder · a medium level calibrated against real people · an option to roll
the attribute after the draft instead of before (a pure blind draft) · sound.
