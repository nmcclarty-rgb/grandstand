import { readFileSync } from 'node:fs';
import { makePool } from '../../stickers/src/engine/deck.js';
export const pool = makePool(JSON.parse(readFileSync(new URL('../../stickers/src/data/cards.json', import.meta.url), 'utf8')));
