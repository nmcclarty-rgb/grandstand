// A wheel you can see. Pure geometry (layout, landing) that is tested, and an SVG wheel with a pointer at the top that spins and lands on the
// slice the engine has already drawn: the engine decides, the wheel only shows it.
//
// A slice is { label, weight = 1, dim = false }. Slice sizes are proportional to their weights, so a 1-in-7 slice looks 1-in-7.

// angles in degrees clockwise from the top, where the pointer is
export function layout(slices) {
  const total = slices.reduce((s, x) => s + (x.weight ?? 1), 0);
  let a = 0;
  return slices.map((x, i) => {
    const size = (360 * (x.weight ?? 1)) / total;
    const out = { index: i, label: x.label, dim: !!x.dim, start: a, end: a + size, size, mid: a + size / 2 };
    a += size;
    return out;
  });
}

// The rotation (clockwise degrees) that leaves slice `index` under the pointer after `turns` full turns. `jitter` in [-1, 1] moves the
// landing spot away from the middle of the slice, but never closer to its edge than 15% of the slice, so it never looks like a near miss.
export function landing(slices, index, { turns = 4, jitter = 0 } = {}) {
  const s = layout(slices)[index];
  if (!s) throw new Error(`no slice ${index}`);
  const spot = s.mid + Math.max(-1, Math.min(1, jitter)) * s.size * 0.35;
  return 360 * turns + (360 - spot);
}

// which slice is under the pointer after a rotation of `rotation` degrees
export function sliceAt(slices, rotation) {
  const a = (((360 - rotation) % 360) + 360) % 360;
  return layout(slices).find((s) => a >= s.start && a < s.end)?.index ?? slices.length - 1;
}

const SIZE = 300, C = SIZE / 2, R = 140;
const COLOURS = ['#1f7a47', '#f5c542', '#12552f', '#e9e2cb'];
const INKS = ['#ffffff', '#261c00', '#ffffff', '#14181c'];
const ease = (t) => 1 - (1 - t) ** 4;   // a quick start that slows to a stop
const pt = (deg, r) => [C + r * Math.sin((deg * Math.PI) / 180), C - r * Math.cos((deg * Math.PI) / 180)];
const NS = 'http://www.w3.org/2000/svg';

function node(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

// Draw the wheel into `svg` (cleared first). Returns { spin(index, opts) -> { done, skip } }.
export function drawWheel(svg, slices, { hub = 'PREM' } = {}) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `A wheel with ${slices.length} slices: ${slices.map((s) => s.label).join(', ')}`);
  const rot = node('g');
  const L = layout(slices);
  L.forEach((s, i) => {
    const [x0, y0] = pt(s.start, R), [x1, y1] = pt(s.end, R);
    const colour = COLOURS[i % COLOURS.length];
    const g = node('g', { opacity: s.dim ? '0.28' : '1' });
    g.append(node('path', { d: `M${C} ${C} L${x0} ${y0} A${R} ${R} 0 ${s.size > 180 ? 1 : 0} 1 ${x1} ${y1} Z`, fill: colour, stroke: '#0b2d1a', 'stroke-width': 3 }));
    // the label runs outwards along the slice's middle
    const len = s.label.length;
    const size = Math.max(9, Math.min(17, 92 / (len * 0.62)));
    const t = node('text', { transform: `rotate(${s.mid - 90} ${C} ${C})`, x: C + 38, y: C + size * 0.35, 'font-size': size, 'font-weight': 900, 'font-family': 'Impact, "Arial Narrow Bold", system-ui, sans-serif', 'letter-spacing': '.04em', fill: INKS[i % INKS.length] }, s.label);
    g.append(t);
    rot.append(g);
  });
  svg.append(node('circle', { cx: C, cy: C, r: R + 6, fill: '#0b2d1a' }), rot);
  svg.append(node('circle', { cx: C, cy: C, r: 30, fill: '#0b2d1a', stroke: '#f5c542', 'stroke-width': 4 }), node('text', { x: C, y: C + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 900, fill: '#f5c542', 'font-family': 'system-ui, sans-serif', 'letter-spacing': '.08em' }, hub));
  // the pointer, fixed at the top
  svg.append(node('path', { d: `M${C - 13} 2 L${C + 13} 2 L${C} 30 Z`, fill: '#ff6b6b', stroke: '#fff', 'stroke-width': 3, 'stroke-linejoin': 'round' }));

  const setRot = (deg) => rot.setAttribute('transform', `rotate(${deg} ${C} ${C})`);
  setRot(0);
  return {
    // Spin to land on `index`. Resolves when it has stopped; skip() jumps to the end. With reduced motion it lands at once.
    spin(index, { duration = 3200, turns = 4, jitter = 0, reduce = false } = {}) {
      const target = landing(slices, index, { turns, jitter });
      let finish, raf = 0, ended = false;
      const done = new Promise((resolve) => { finish = resolve; });
      const end = () => { if (ended) return; ended = true; cancelAnimationFrame(raf); setRot(target); svg.classList.add('landed'); finish(index); };
      svg.classList.remove('landed');
      if (reduce) end();
      else {
        const t0 = performance.now();
        const tick = (t) => { const k = Math.min(1, (t - t0) / duration); setRot(target * ease(k)); if (k < 1 && !ended) raf = requestAnimationFrame(tick); else end(); };
        raf = requestAnimationFrame(tick);
      }
      return { done, skip: end };
    },
  };
}
