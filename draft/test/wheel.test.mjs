import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, landing, sliceAt } from '../src/ui/wheel.js';

const WHEEL = [{ label: 'GK', weight: 1 }, { label: 'DEF', weight: 2 }, { label: 'MID', weight: 2 }, { label: 'FWD', weight: 2 }];

test('slices are sized by their weights and fill the circle', () => {
  const L = layout(WHEEL);
  assert.equal(L.reduce((s, x) => s + x.size, 0), 360);
  assert.ok(Math.abs(L[0].size - 360 / 7) < 1e-9 && Math.abs(L[1].size - 720 / 7) < 1e-9, 'a 1-in-7 slice is 1/7 of the wheel');
  assert.equal(L[0].start, 0);
  for (let i = 1; i < L.length; i++) assert.ok(Math.abs(L[i].start - L[i - 1].end) < 1e-9, 'no gaps');
  assert.deepEqual(layout([{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }]).map((s) => s.size), [90, 90, 90, 90], 'equal by default');
});

test('landing puts the chosen slice under the pointer, for every slice and any jitter, and never near an edge', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ label: `s${i}`, dim: i === 3 }));
  for (const slices of [WHEEL, many, [{ label: '4-4-2', weight: 3 }, { label: '4-3-3', weight: 3 }, { label: '4-5-1', weight: 2 }, { label: '3-5-2', weight: 2 }, { label: '3-4-3', weight: 1 }, { label: '5-3-2', weight: 1 }]]) {
    const L = layout(slices);
    for (let i = 0; i < slices.length; i++) {
      for (let k = 0; k <= 20; k++) {
        const jitter = -1 + k / 10, turns = 3 + (k % 3);
        const rot = landing(slices, i, { turns, jitter });
        assert.equal(sliceAt(slices, rot), i, `slice ${i} jitter ${jitter}`);
        // the landing spot is at least 15% of the slice away from either edge
        const spot = (((360 - rot) % 360) + 360) % 360;
        assert.ok(spot - L[i].start >= 0.15 * L[i].size - 1e-9 && L[i].end - spot >= 0.15 * L[i].size - 1e-9, `slice ${i} landed too near an edge`);
        assert.ok(rot >= 360 * turns, 'at least the requested full turns');
      }
    }
  }
  assert.throws(() => landing(WHEEL, 9), /no slice/);
});

test('a rotation of nothing leaves the first slice under the pointer, and a half turn the opposite side', () => {
  assert.equal(sliceAt(WHEEL, 0), 0);
  assert.equal(sliceAt([{ label: 'a' }, { label: 'b' }], 180), 1);
  assert.equal(sliceAt([{ label: 'a' }, { label: 'b' }], 360 + 10), 1, 'the wheel turns clockwise, so the slice that was to the left comes round');
});
