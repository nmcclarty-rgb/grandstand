# BLIND FIVE (working title)

A **blind budget draft against a bot**, on the [Sticker Season](../stickers/) career cards (every Premier League player with
100+ appearances, 1992/93 to 2025/26). Inspired by the "you have £10, pick your front three" quiz.

You and the bot each have **£10** to build a **five-a-side team** over five rounds. Each round the wheel names a position and
eight players go on the board with **a name and a price only**: no stats, no club. You alternate picks (who goes first swaps every
round), and you can see what the bot takes. Then both teams are revealed and play a **best of three** over three different
categories (goals, assists, appearances, discipline), each team scored as a Sticker Season hand, so team-mates earn a multiplier.

```bash
cd draft
npm test             # 16 tests: boards, prices, budget rules, turn order, every draft finishes, the showdown, the bot levels
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
- **Showdown** three different categories; a team's five players are the hand (no goalkeeper held back, so Safe Hands is off).
  Most matches wins the series; level means the higher total; still level is a draw.

## What the simulator found (1,000 matches per pairing; win %, draws count half)

| you \ opponent | random | easy | medium | hard |
|---|---|---|---|---|
| random | 50 | 38 | 34 | 21 |
| easy | 62 | 51 | 45 | 26 |
| medium | 66 | 54 | 49 | 39 |
| hard | 73 | 74 | 66 | 47 |

A price carries real information (easy, which only reads prices, beats a random picker 62-38). Knowing the stats beats that
(medium beats easy, hard beats medium two matches in three). The first pick is worth a little (hard against hard is 47%
for the side that does not pick first in round 1 half the time).
Showdowns are close: about a quarter of matches are decided by under 10%. The hands that come up are mostly One-Two, Spine and
Kickabout: **Triangle and above are rare** because five random players seldom share a club-season. That is the first thing to
look at in a playtest: if team-mate hands should matter more, the board could offer players from the same eras or clubs.
No human has played it yet.

## Not built

A rematch against the same boards from the other seat · a streak or ladder · a bluff mechanic · letting the bot's hard level see only
what you see · foil editions · showing the true tier of every player after the draft · sound.
