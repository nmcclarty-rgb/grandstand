// The best hand you could play right now. Used by the balance sim's bots and by the page's Hint button.
import { scoreHand } from './scoring.js';

// every selection of 1-5 cards from an 8-card hand: 218 of them
const SUBSETS = [];
(function build(start, cur) {
  if (cur.length) SUBSETS.push([...cur]);
  if (cur.length === 5) return;
  for (let i = start; i < 8; i++) { cur.push(i); build(i + 1, cur); cur.pop(); }
})(0, []);

// round: a round.js round. -> { idx, total, type, scoring } where idx are positions in round.hand
export function bestPlay(round) {
  let best = null;
  for (const idx of SUBSETS) {
    if (idx[idx.length - 1] >= round.hand.length) continue;
    const held = round.hand.filter((_, i) => !idx.includes(i)); // a keeper left in hand adds Safe Hands
    const r = scoreHand(idx.map((i) => round.hand[i]), {
      category: round.category, scale: round.scale, jokers: round.jokers, handLevels: round.handLevels, held,
      state: { handsLeft: round.handsLeft, discardsLeft: round.discardsLeft },
    });
    if (!best || r.total > best.total) best = { idx, total: r.total, type: r.type, scoring: r.scoring };
  }
  return best;
}
