/**
 * GRANDSTAND — bleeps.
 *
 * WebAudio square/noise voices only. No audio files, so nothing to load and
 * nothing to licence. Muted until the first user gesture, per browser policy.
 */

let ctx = null;
let master = null;
let enabled = true;

export function initAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

export function setMuted(m) {
  enabled = !m;
  if (master) master.gain.value = m ? 0 : 0.22;
}
export function isMuted() { return !enabled; }

function tone(freq, dur, type = 'square', vol = 1, slideTo = null) {
  if (!ctx || !enabled) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.4 * vol, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + dur + 0.02);
}

function noise(dur, vol = 1, filterHz = 1200) {
  if (!ctx || !enabled) return;
  const n = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterHz;
  const g = ctx.createGain(); g.gain.value = 0.5 * vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

const seq = (notes) => {
  if (!ctx || !enabled) return;
  notes.forEach(([f, t, d], i) => setTimeout(() => tone(f, d || 0.09), t));
};

export const sfx = {
  step:    () => tone(180, 0.035, 'square', 0.35),
  blocked: () => tone(90, 0.07, 'square', 0.4),
  select:  () => tone(660, 0.05, 'square', 0.6),
  confirm: () => seq([[520, 0], [780, 60]]),
  back:    () => tone(300, 0.07, 'square', 0.5),
  encounter: () => seq([[220, 0, 0.08], [330, 70, 0.08], [440, 140, 0.16]]),
  hit:     () => { noise(0.12, 0.8, 900); tone(140, 0.1, 'square', 0.5, 70); },
  crit:    () => { noise(0.2, 1, 2200); seq([[880, 0, 0.06], [1180, 50, 0.06], [1560, 100, 0.14]]); },
  takeHit: () => { noise(0.16, 0.9, 500); tone(110, 0.14, 'sawtooth', 0.5, 60); },
  block:   () => { tone(400, 0.05, 'square', 0.5); setTimeout(() => tone(300, 0.07, 'square', 0.4), 40); },
  card:    () => seq([[520, 0, 0.1], [400, 110, 0.18]]),
  pickup:  () => seq([[660, 0, 0.05], [880, 55, 0.05], [1320, 110, 0.1]]),
  win:     () => seq([[523, 0, 0.1], [659, 110, 0.1], [784, 220, 0.1], [1047, 330, 0.3]]),
  lose:    () => seq([[392, 0, 0.14], [330, 150, 0.14], [262, 300, 0.4]]),
  tick:    () => tone(1200, 0.02, 'square', 0.25),
  whistle: () => { tone(2000, 0.18, 'square', 0.5); setTimeout(() => tone(2400, 0.22, 'square', 0.5), 60); },
};
