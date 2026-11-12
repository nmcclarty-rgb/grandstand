// A whole 38-matchday season as a state machine. No UI in here: the page, the tests and the bots all drive this.
//
//   phase 'intro'  a matchday is announced: the wheel has picked a category; you may use VAR, then kick off
//   phase 'play'   the fixture is on (fixture.round is a round.js round)
//   phase 'shop'   you won: you are paid, and can buy before the next matchday
//   phase 'over'   status is 'won' (all 38 cleared) or 'lost' (a fixture failed)
//
// Every random thing (spins, deals, shop stock, pack contents) comes from a labelled seed stream, so a seed always
// gives the same season and a saved game resumes exactly.
import { makeRng } from './rng.js';
import { starterDeck, openPack, instance, upgradedEdition } from './deck.js';
import { startRound, fixtureTarget, SEASON_LENGTH, spinWheel, WHEEL, VAR_PER_SEASON } from './round.js';
import { JOKERS, JOKER_IDS } from './jokers.js';
import { HAND_ORDER } from './hands.js';

export const ECONOMY = {
  startMoney: 4,
  winPayout: 4,          // for any win ...
  perSpareHand: 1,       // ... plus this for each hand you did not need
  pack: { standard: 4, club: 6, squad: 8 },
  pick: 1,               // you keep this many of a pack's five (the sim: a smaller squad plays better than a bloated one)
  rerollBase: 2, rerollStep: 1,
  trainingBase: 3, trainingStep: 2, // a hand's next level costs base + step x (levels it already has)
  releaseCost: 1, minDeck: 16,
  managerSlots: 5,
  managerMarkup: 2,      // a manager's shop price is his cost x this (his sale value stays on his cost)
  sellRatio: 0.5,
};

export const PACKS = {
  standard: { name: 'Sticker Pack', blurb: '5 players from anywhere' },
  club:     { name: 'Club Pack',    blurb: '5 players who played for a club in your squad' },
  squad:    { name: 'Squad Pack',   blurb: '5 players who were team-mates of someone in your squad' },
};

const stream = (run, label) => makeRng(`${run.seed}|${label}`);

// opts.targets: { start, end } overrides the target curve, opts.shape the starter squad's shape (the sim uses them for tuning; neither is saved)
export function newSeason(pool, seed = Date.now(), opts = {}) {
  const run = {
    seed: String(seed), matchday: 1, money: ECONOMY.startMoney, jokers: [], handLevels: {}, varLeft: VAR_PER_SEASON,
    status: 'playing', phase: 'intro', cleared: 0, history: [], played: {}, fixture: null, shop: null, pack: null, scale: pool.scale,
  };
  Object.defineProperty(run, 'pool', { value: pool, enumerable: false });
  Object.defineProperty(run, 'targets', { value: opts.targets, enumerable: false, writable: true });
  run.deck = starterDeck(pool, stream(run, 'start'), opts.shape);
  beginMatchday(run);
  return run;
}

const need = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---- a matchday ---------------------------------------------------------------------------------------------
function beginMatchday(run) {
  run.phase = 'intro';
  run.fixture = {
    matchday: run.matchday, target: fixtureTarget(run.matchday, run.targets), varUsed: 0, round: null,
    category: spinWheel(stream(run, `spin|${run.matchday}|0`)),
  };
}

// VAR: overturn the spin, to a different category. Five a season, and only before kick-off.
export function useVar(run) {
  need(run.phase === 'intro', 'VAR is only before kick-off');
  need(run.varLeft > 0, 'no VAR reviews left');
  const f = run.fixture;
  f.varUsed++;
  f.category = spinWheel(stream(run, `spin|${run.matchday}|${f.varUsed}`), WHEEL, { not: f.category });
  run.varLeft--;
  return f.category;
}

export function kickOff(run) {
  need(run.phase === 'intro', `cannot kick off from phase ${run.phase}`);
  const f = run.fixture;
  f.round = startRound(
    { deck: run.deck, jokers: run.jokers, handLevels: run.handLevels, scale: run.scale },
    { target: f.target, category: f.category, rng: stream(run, `deal|${run.matchday}`) },
  );
  run.phase = 'play';
  return f.round;
}

// Call once the round is won or lost. Won: you are paid and the shop opens (or the season is won). Lost: it is over.
export function finishMatchday(run) {
  need(run.phase === 'play', `cannot finish from phase ${run.phase}`);
  const { round } = run.fixture;
  need(round.status !== 'playing', 'the fixture is still on');
  const best = round.plays.reduce((b, p) => (!b || p.total > b.total ? p : b), null);
  for (const p of round.plays) run.played[p.type] = (run.played[p.type] ?? 0) + 1; // what you play decides what training is offered
  const entry = {
    matchday: run.matchday, category: run.fixture.category, target: run.fixture.target, score: round.score,
    won: round.status === 'won', handsLeft: round.handsLeft, best: best && { hand: best.type, total: best.total },
  };
  if (!entry.won) {
    run.history.push({ ...entry, payout: 0 });
    run.status = 'lost';
    run.phase = 'over';
    return { won: false, payout: 0, spare: 0 };
  }
  const spare = round.handsLeft;
  const payout = ECONOMY.winPayout + spare * ECONOMY.perSpareHand;
  run.money += payout;
  run.cleared++;
  run.history.push({ ...entry, payout });
  if (run.matchday >= SEASON_LENGTH) { run.status = 'won'; run.phase = 'over'; run.shop = null; }
  else { run.matchday++; run.phase = 'shop'; run.shop = makeShop(run, 0); }
  return { won: true, payout, spare };
}

// Leave the shop for the next matchday.
export function nextMatchday(run) {
  need(run.phase === 'shop', 'not in the shop');
  need(!run.pack, 'open your pack first');
  run.shop = null;
  beginMatchday(run);
}

// ---- the shop ------------------------------------------------------------------------------------------------
export const trainingPrice = (run, hand) => ECONOMY.trainingBase + ECONOMY.trainingStep * ((run.handLevels[hand] ?? 1) - 1);
export const rerollCost = (run) => ECONOMY.rerollBase + ECONOMY.rerollStep * run.shop.rerolls;

function makeShop(run, rerolls) {
  const rng = stream(run, `shop|${run.matchday}|${rerolls}`);
  const offers = [];
  for (let i = 0; i < 2; i++) {
    const type = rng.weighted([['standard', 5], ['club', 3], ['squad', 2]]);
    offers.push({ slot: `p${i}`, kind: 'pack', type, price: ECONOMY.pack[type], bought: false });
  }
  const free = JOKER_IDS.filter((id) => !run.jokers.includes(id));
  rng.shuffle(free).slice(0, 2).forEach((id, i) => offers.push({ slot: `m${i}`, kind: 'manager', id, price: JOKERS[id].cost * ECONOMY.managerMarkup, bought: false }));
  // training: the hand you play most (a random one before you have played any), and one other at random
  const favourite = Object.entries(run.played).sort((a, b) => b[1] - a[1])[0]?.[0] ?? rng.pick(HAND_ORDER);
  offers.push({ slot: 't0', kind: 'training', hand: favourite, bought: false });
  offers.push({ slot: 't1', kind: 'training', hand: rng.pick(HAND_ORDER.filter((h) => h !== favourite)), bought: false });
  return { rerolls, offers };
}

export function priceOf(run, offer) {
  return offer.kind === 'training' ? trainingPrice(run, offer.hand) : offer.price;
}

export function rerollShop(run) {
  need(run.phase === 'shop' && !run.pack, 'cannot reroll now');
  const cost = rerollCost(run);
  need(run.money >= cost, 'not enough money');
  run.money -= cost;
  run.shop = makeShop(run, run.shop.rerolls + 1);
  run.shop.paid = true;
}

// Who a pack of this type can deal. Club pack: players who played for a club in your squad. Squad pack: players who were
// team-mates of someone in your squad (they share a club-season with one of your players). Standard: anyone.
function packFilter(run, type) {
  if (type === 'club') {
    const clubs = new Set(run.deck.map((c) => c.club));
    return (c) => c.clubs.some(([k]) => clubs.has(k));
  }
  if (type === 'squad') {
    const stints = new Set(run.deck.flatMap((c) => c.stints));
    return (c) => c.stints.some((s) => stints.has(s));
  }
  return undefined;
}

// The copy of this player you already own, if any (there is only ever one).
export const ownedCopy = (run, card) => run.deck.find((c) => c.id === card.id) ?? null;

export function buy(run, slot) {
  need(run.phase === 'shop', 'not in the shop');
  need(!run.pack, 'open your pack first');
  const offer = run.shop.offers.find((o) => o.slot === slot);
  need(offer, `no such offer ${slot}`);
  need(!offer.bought, 'already bought');
  const price = priceOf(run, offer);
  need(run.money >= price, 'not enough money');
  if (offer.kind === 'manager') {
    need(run.jokers.length < ECONOMY.managerSlots, 'no room: sell a manager first');
    run.jokers.push(offer.id);
  } else if (offer.kind === 'training') {
    run.handLevels[offer.hand] = (run.handLevels[offer.hand] ?? 1) + 1;
  } else {
    const rng = stream(run, `pack|${run.matchday}|${run.shop.rerolls}|${slot}`);
    run.pack = { type: offer.type, cards: openPack(run.pool, rng, 5, { filter: packFilter(run, offer.type) }) };
  }
  run.money -= price;
  offer.bought = true;
  return offer;
}

// Keep up to ECONOMY.pick stickers from the open pack; the rest are swapped away. uids: [] takes none.
// A player you already own is not a second copy: keeping him UPGRADES yours (see upgradedEdition). Returns, for each
// sticker kept, { card, upgraded } (upgraded is the new edition, or null for a new signing).
export function takePack(run, uids) {
  need(run.pack, 'no pack open');
  need(uids.length <= ECONOMY.pick, `keep at most ${ECONOMY.pick}`);
  need(new Set(uids).size === uids.length, 'pick each sticker once');
  const picked = uids.map((u) => run.pack.cards.find((c) => c.uid === u));
  need(picked.every(Boolean), 'that sticker is not in the pack');
  const result = picked.map((card) => {
    const owned = ownedCopy(run, card);
    if (!owned) { run.deck.push(card); return { card, upgraded: null }; }
    owned.edition = upgradedEdition(owned.edition, card.edition);
    return { card: owned, upgraded: owned.edition };
  });
  run.pack = null;
  return result;
}

export const sellValue = (id) => Math.floor(JOKERS[id].cost * ECONOMY.sellRatio);
export function sellManager(run, id) {
  need(run.phase === 'shop', 'not in the shop');
  need(run.jokers.includes(id), 'you do not have that manager');
  run.jokers.splice(run.jokers.indexOf(id), 1);
  run.money += sellValue(id);
}

// Thin the squad: fewer, better stickers make your hands more reliable.
export function releaseCard(run, uid) {
  need(run.phase === 'shop', 'not in the shop');
  need(run.deck.length > ECONOMY.minDeck, `a squad needs at least ${ECONOMY.minDeck} stickers`);
  need(run.money >= ECONOMY.releaseCost, 'not enough money');
  const i = run.deck.findIndex((c) => c.uid === uid);
  need(i > -1, 'that sticker is not in your squad');
  run.deck.splice(i, 1);
  run.money -= ECONOMY.releaseCost;
}

// ---- saving ---------------------------------------------------------------------------------------------------
// Plain data. A fixture in progress is not saved: it is replayed from kick-off (the deal is seeded).
export function serialize(run) {
  const slim = (c) => ({ id: c.id, edition: c.edition });
  const f = run.fixture;
  return {
    v: 1, seed: run.seed, matchday: run.matchday, money: run.money, jokers: [...run.jokers], handLevels: { ...run.handLevels },
    varLeft: run.varLeft, status: run.status, phase: run.phase === 'play' ? 'intro' : run.phase, cleared: run.cleared,
    history: run.history, played: { ...run.played }, deck: run.deck.map(slim), shop: run.shop,
    pack: run.pack && { type: run.pack.type, cards: run.pack.cards.map(slim) },
    fixture: f && { category: f.category, varUsed: f.varUsed },
  };
}

export function restore(pool, data) {
  need(data && data.v === 1, 'unrecognised save');
  const inst = (s) => instance(pool.byId.get(s.id) ?? (() => { throw new Error(`save has an unknown card ${s.id}`); })(), s.edition);
  const run = {
    seed: data.seed, matchday: data.matchday, money: data.money, jokers: [...data.jokers], handLevels: { ...data.handLevels },
    varLeft: data.varLeft, status: data.status, phase: data.phase, cleared: data.cleared, history: data.history, played: { ...(data.played ?? {}) },
    deck: data.deck.map(inst), shop: data.shop, pack: data.pack && { type: data.pack.type, cards: data.pack.cards.map(inst) },
    scale: pool.scale, fixture: null,
  };
  Object.defineProperty(run, 'pool', { value: pool, enumerable: false });
  Object.defineProperty(run, 'targets', { value: undefined, enumerable: false, writable: true });
  if (run.phase === 'intro') {
    run.fixture = { matchday: run.matchday, target: fixtureTarget(run.matchday), varUsed: data.fixture?.varUsed ?? 0, round: null, category: data.fixture?.category };
    if (!run.fixture.category) beginMatchday(run);
  }
  return run;
}
