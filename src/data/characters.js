/**
 * GRANDSTAND — playable characters.
 *
 * The Street Fighter II select screen only works if the choice means
 * something, so every one of these changes the maths of a fight rather than
 * just the colour of the shirt. The perk fields are read directly by
 * battle.js — see PERK_KEYS there.
 */

export const CHARACTERS = [
  {
    id: 'ringer', name: 'THE RINGER', epithet: 'Plays For Three Teams',
    hp: 130, power: 24, nutmegs: 3,
    build: 'normal', gear: 'ball', hair: 'mullet', facial: 'none', brow: 'neutral',
    palette: { skin: '#f0c49b', kit: '#1d4ed8', trim: '#facc15', hair: '#4b2e13' },
    perk: {},
    blurb: 'No weaknesses, no tricks. If you do not know what you are doing, start here.',
  },
  {
    id: 'landlord', name: 'THE LANDLORD', epithet: 'Last Orders, Lads',
    hp: 170, power: 19, nutmegs: 2,
    build: 'heavy', gear: 'none', hair: 'receding', facial: 'chops', brow: 'raised',
    palette: { skin: '#e8b48a', kit: '#7f1d1d', trim: '#e5e7eb', hair: '#3f3f46' },
    perk: {},
    blurb: 'Enormous reserves of condition and absolutely no hurry. Outlasts people.',
  },
  {
    id: 'fivaside', name: 'FIVE-A-SIDE LEGEND', epithet: 'Tuesdays, 8pm, Astroturf',
    hp: 112, power: 27, nutmegs: 3,
    build: 'lean', gear: 'ball', hair: 'spiky', facial: 'stubble', brow: 'angry',
    palette: { skin: '#c68642', kit: '#ea580c', trim: '#0f172a', hair: '#1c1917' },
    perk: { speedMult: 1.5 },
    blurb: 'Answers fast or not at all. The clock bonus is worth half again as much.',
  },
  {
    id: 'stato', name: 'THE STATISTICIAN', epithet: 'Actually, In All Competitions',
    hp: 118, power: 21, nutmegs: 7,
    build: 'lean', gear: 'clipboard', hair: 'bowl', facial: 'none', brow: 'neutral',
    palette: { skin: '#f3cba4', kit: '#065f46', trim: '#fbbf24', hair: '#78350f' },
    perk: {},
    blurb: 'Seven nutmegs. Turns the ones you do not know into a coin flip you can win.',
  },
  {
    id: 'keeper', name: 'THE KEEPER', epithet: 'Number One, Numb Fingers',
    hp: 145, power: 20, nutmegs: 3,
    build: 'normal', gear: 'gloves', hair: 'curly', facial: 'tash', brow: 'angry',
    palette: { skin: '#f0c49b', kit: '#16a34a', trim: '#111827', hair: '#111827' },
    perk: { blockFloor: 0.12 },
    blurb: 'A perfect block lets almost nothing through. Punishing to play against.',
  },
  {
    id: 'touchline', name: 'TOUCHLINE DAD', epithet: 'HE WAS THROUGH ON GOAL',
    hp: 100, power: 32, nutmegs: 2,
    build: 'heavy', gear: 'none', hair: 'bald', facial: 'beard', brow: 'angry',
    palette: { skin: '#e8a878', kit: '#0f172a', trim: '#dc2626', hair: '#57534e' },
    perk: { glassJaw: 1.15 },
    blurb: 'Hits like a lorry, takes 15% extra. Short fights, one way or the other.',
  },
  {
    id: 'fantasy', name: 'THE FANTASY MANAGER', epithet: 'Triple Captain, Gameweek 9',
    hp: 124, power: 22, nutmegs: 4,
    build: 'normal', gear: 'clipboard', hair: 'flattop', facial: 'none', brow: 'raised',
    palette: { skin: '#7a4a21', kit: '#7c3aed', trim: '#22d3ee', hair: '#1c1917' },
    perk: { repMult: 1.6 },
    blurb: 'Everything is worth 60% more rep. Slow to start, top of the table by Sunday.',
  },
  {
    id: 'veteran', name: 'THE VETERAN', epithet: 'Thirty Years On The Terraces',
    hp: 136, power: 23, nutmegs: 3,
    build: 'normal', gear: 'none', hair: 'perm', facial: 'tash', brow: 'neutral',
    palette: { skin: '#f6d5ae', kit: '#b45309', trim: '#fef3c7', hair: '#9ca3af' },
    perk: { comboBoost: 1 },
    blurb: 'Combos build a rung early. Two right on the bounce and you are already hurting people.',
  },
];

export function findCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
