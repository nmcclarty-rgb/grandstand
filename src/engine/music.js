/**
 * GRANDSTAND — music.
 *
 * Original compositions, written for this game. The brief was the sound of a
 * British Saturday-afternoon sports programme — brass-led fanfare, walking
 * bass, snappy kit, relentlessly major — which is a genre, and genre is free.
 * The specific themes those programmes used are not, so nothing here is
 * derived from any of them.
 *
 * Everything is synthesised at runtime. No audio files, same as the sprites.
 *
 * Timing uses lookahead scheduling rather than setTimeout-per-note: a worker
 * tick every 25ms schedules any note falling inside the next 120ms directly on
 * the WebAudio clock. Scheduling notes off the JS clock sounds drunk, and the
 * one thing a march cannot be is late.
 */

const STEPS_PER_BAR = 16;          // sixteenth-note resolution
const LOOKAHEAD_MS = 25;
const SCHEDULE_WINDOW = 0.12;

/** MIDI note number to frequency. */
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Note names, for readability in the patterns below.
const F3 = 53, G3 = 55, A3 = 57, Bb3 = 58, C4 = 60, D4 = 62, E4 = 64;
const F4 = 65, G4 = 67, A4 = 69, Bb4 = 70, C5 = 72, D5 = 74, E5 = 76, F5 = 77;
const G5 = 79, A5 = 81;

/** [step, midi, lengthInSteps, velocity] */
const TRACKS = {
  /**
   * THE MARCH — titles and menus. Eight bars: a four-bar brass statement, an
   * answering phrase, then a lift into the turnaround.
   */
  theme: {
    bpm: 132,
    bars: 8,
    lead: [
      [0, F4, 2, 1], [2, F4, 1, 0.8], [4, F4, 2, 1], [8, D5, 2, 1], [12, C5, 3, 0.9],
      [16, Bb4, 2, 1], [20, C5, 1, 0.8], [22, D5, 1, 0.8], [24, C5, 6, 1],
      [32, C5, 2, 1], [34, C5, 1, 0.8], [36, C5, 2, 1], [40, F5, 3, 1], [44, E5, 3, 0.9],
      [48, D5, 8, 1],
      [64, E5, 2, 1], [66, E5, 1, 0.8], [68, E5, 2, 1], [72, D5, 2, 1], [76, C5, 3, 0.9],
      [80, Bb4, 2, 1], [84, A4, 1, 0.8], [86, Bb4, 1, 0.8], [88, C5, 6, 1],
      [96, D5, 2, 1], [100, C5, 2, 0.9], [104, Bb4, 2, 0.9], [108, A4, 2, 0.9], [110, G4, 2, 0.9],
      [112, F4, 10, 1],
    ],
    stabs: [
      [0, A4, 2, 0.5], [4, A4, 2, 0.5], [16, D4, 2, 0.5], [24, E4, 4, 0.5],
      [32, E4, 2, 0.5], [36, E4, 2, 0.5], [48, F4, 8, 0.5],
      [64, G4, 2, 0.5], [68, G4, 2, 0.5], [80, F4, 2, 0.5], [88, E4, 4, 0.5],
      [96, F4, 2, 0.5], [104, D4, 2, 0.5], [112, A3, 10, 0.5],
    ],
    bass: [
      [0, F3, 2], [4, F3, 2], [8, C4, 2], [12, F3, 2],
      [16, Bb3, 2], [20, Bb3, 2], [24, F3, 2], [28, A3, 2],
      [32, C4, 2], [36, C4, 2], [40, G3, 2], [44, C4, 2],
      [48, F3, 2], [52, F3, 2], [56, A3, 2], [60, C4, 2],
      [64, D4, 2], [68, D4, 2], [72, A3, 2], [76, D4, 2],
      [80, Bb3, 2], [84, Bb3, 2], [88, F3, 2], [92, A3, 2],
      [96, G3, 2], [100, G3, 2], [104, C4, 2], [108, C4, 2],
      [112, F3, 2], [116, F3, 2], [120, C4, 2], [124, C4, 2],
    ],
    kick: [0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 126],
    snare: [4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 122, 124],
    hat: 'eighths',
  },

  /** THE WALK — the ladder. Same world, lower stakes: no brass, lighter kit. */
  ladder: {
    bpm: 120,
    bars: 4,
    lead: [
      [0, C5, 2, 0.55], [4, Bb4, 2, 0.55], [8, A4, 2, 0.55], [12, F4, 3, 0.55],
      [16, Bb4, 2, 0.55], [20, C5, 2, 0.55], [24, A4, 4, 0.55],
      [32, D5, 2, 0.55], [36, C5, 2, 0.55], [40, Bb4, 2, 0.55], [44, G4, 3, 0.55],
      [48, F4, 2, 0.55], [52, G4, 2, 0.55], [56, A4, 6, 0.55],
    ],
    stabs: [],
    bass: [
      [0, F3, 3], [8, C4, 3], [16, Bb3, 3], [24, F3, 3],
      [32, Bb3, 3], [40, F3, 3], [48, C4, 3], [56, F3, 3],
    ],
    kick: [0, 8, 16, 24, 32, 40, 48, 56],
    snare: [8, 24, 40, 56],
    hat: 'quarters',
  },

  /** SECONDS OUT — the fight. Minor, faster, busier, and it does not resolve. */
  battle: {
    bpm: 150,
    bars: 4,
    lead: [
      [0, D5, 1, 0.75], [2, D5, 1, 0.75], [4, F5, 2, 0.8], [8, E5, 1, 0.75], [10, D5, 1, 0.75],
      [12, C5, 3, 0.8],
      [16, A4, 1, 0.75], [18, A4, 1, 0.75], [20, C5, 2, 0.8], [24, Bb4, 4, 0.8],
      [32, D5, 1, 0.75], [34, D5, 1, 0.75], [36, G5, 2, 0.85], [40, F5, 1, 0.8], [42, E5, 1, 0.8],
      [44, D5, 3, 0.85],
      [48, E5, 2, 0.8], [52, F5, 2, 0.85], [56, A5, 6, 0.9],
    ],
    stabs: [
      [0, A3, 1, 0.45], [8, A3, 1, 0.45], [16, F3, 1, 0.45], [24, F3, 1, 0.45],
      [32, A3, 1, 0.45], [40, A3, 1, 0.45], [48, Bb3, 1, 0.45], [56, C4, 1, 0.45],
    ],
    bass: [
      [0, D4, 1], [2, D4, 1], [4, D4, 1], [6, A3, 1], [8, D4, 1], [10, D4, 1], [12, F4, 1], [14, E4, 1],
      [16, F4 - 12, 1], [18, F4 - 12, 1], [20, F4 - 12, 1], [22, C4, 1], [24, F4 - 12, 1], [26, F4 - 12, 1], [28, A3, 1], [30, Bb3, 1],
      [32, D4, 1], [34, D4, 1], [36, D4, 1], [38, A3, 1], [40, D4, 1], [42, D4, 1], [44, F4, 1], [46, E4, 1],
      [48, Bb3, 1], [50, Bb3, 1], [52, C4, 1], [54, C4, 1], [56, D4, 1], [58, D4, 1], [60, D4, 1], [62, A3, 1],
    ],
    kick: [0, 6, 8, 14, 16, 22, 24, 30, 32, 38, 40, 46, 48, 54, 56, 62],
    snare: [4, 12, 20, 28, 36, 44, 52, 60],
    hat: 'sixteenths',
  },
};

export const TRACK_NAMES = Object.keys(TRACKS);

// ── the player ────────────────────────────────────────────────────────────

let ctx = null;
let bus = null;
let timer = null;
let current = null;
let step = 0;
let nextNoteTime = 0;
let pending = null;
let enabled = true;

export function attachMusic(audioCtx, destination) {
  ctx = audioCtx;
  bus = ctx.createGain();
  bus.gain.value = enabled ? 0.17 : 0;
  bus.connect(destination);
  if (pending) { const p = pending; pending = null; playTrack(p); }
}

export function setMusicEnabled(on) {
  enabled = on;
  if (bus) {
    // A short ramp, because cutting a gain node to zero mid-note clicks.
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(on ? 0.17 : 0, ctx.currentTime, 0.04);
  }
  if (!on) stopTrack(); else if (current === null && pending) playTrack(pending);
}
export function isMusicEnabled() { return enabled; }

export function playTrack(name) {
  if (!TRACKS[name]) return;
  if (!ctx) { pending = name; return; }
  if (current === name && timer) return;      // already playing, don't restart
  pending = name;
  stopTrack();
  if (!enabled) return;
  current = name;
  step = 0;
  nextNoteTime = ctx.currentTime + 0.08;
  timer = setInterval(schedule, LOOKAHEAD_MS);
}

export function stopTrack() {
  if (timer) { clearInterval(timer); timer = null; }
  current = null;
}

function schedule() {
  if (!ctx || !current) return;
  const track = TRACKS[current];
  const stepDur = 60 / track.bpm / 4;
  const total = track.bars * STEPS_PER_BAR;

  while (nextNoteTime < ctx.currentTime + SCHEDULE_WINDOW) {
    const s = step % total;
    for (const [at, note, len, vel] of track.lead) {
      if (at === s) brass(hz(note), nextNoteTime, len * stepDur, vel);
    }
    for (const [at, note, len, vel] of track.stabs) {
      if (at === s) brass(hz(note), nextNoteTime, len * stepDur, vel * 0.8, true);
    }
    for (const [at, note, len] of track.bass) {
      if (at === s) bassNote(hz(note), nextNoteTime, len * stepDur);
    }
    if (track.kick.includes(s)) kick(nextNoteTime);
    if (track.snare.includes(s)) snare(nextNoteTime);
    const hatEvery = track.hat === 'sixteenths' ? 1 : track.hat === 'eighths' ? 2 : 4;
    if (s % hatEvery === 0) hat(nextNoteTime, s % 8 === 0);

    nextNoteTime += stepDur;
    step++;
  }
}

// ── voices ────────────────────────────────────────────────────────────────

/** Two detuned saws through a swept lowpass: as close to a brass section as
 *  three oscillators get. */
function brass(freq, time, dur, vel = 1, soft = false) {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq * 2.2, time);
  f.frequency.linearRampToValueAtTime(freq * (soft ? 3 : 5.5), time + 0.03);
  f.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 1.6), time + dur);
  f.Q.value = soft ? 2 : 5;

  for (const detune of [-7, 0, 6]) {
    const o = ctx.createOscillator();
    o.type = soft ? 'square' : 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(f);
    o.start(time);
    o.stop(time + dur + 0.05);
  }
  const peak = 0.16 * vel * (soft ? 0.6 : 1);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + 0.018);       // tongued attack
  g.gain.exponentialRampToValueAtTime(peak * 0.62, time + 0.09);
  g.gain.setTargetAtTime(0.0001, time + dur * 0.8, 0.05);
  f.connect(g);
  g.connect(bus);
}

function bassNote(freq, time, dur) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o.type = 'square';
  o.frequency.value = freq / 2;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq * 3.2, time);
  f.frequency.exponentialRampToValueAtTime(freq * 1.2, time + dur);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.2, time + 0.012);
  g.gain.setTargetAtTime(0.0001, time + dur * 0.7, 0.04);
  o.connect(f); f.connect(g); g.connect(bus);
  o.start(time);
  o.stop(time + dur + 0.05);
}

function kick(time) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(130, time);
  o.frequency.exponentialRampToValueAtTime(42, time + 0.1);
  g.gain.setValueAtTime(0.32, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
  o.connect(g); g.connect(bus);
  o.start(time); o.stop(time + 0.18);
}

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

function snare(time) {
  const src = noise();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.19, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(time); src.stop(time + 0.15);
}

function hat(time, accent) {
  const src = noise();
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 8200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(accent ? 0.075 : 0.042, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(time); src.stop(time + 0.06);
}
