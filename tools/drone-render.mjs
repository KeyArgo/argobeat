#!/usr/bin/env node
/**
 * DRONE renderer — parameterized per-mood textural/sustained renderer.
 *
 * Derived from the proven /tmp/drone-proto.mjs (measured clean 15Hz AM peak).
 * Produces: 3-voice sustained pad stack + sub-octave root drone + continuous
 * filtered-noise air floor. Long attack/release, slow harmonic movement with
 * crossfades, NO melody, NO drums, single strong clean amplitude modulation
 * at a per-mood entrainment rate.
 *
 * Run with Node 22+ (uses --experimental-strip-types to import the engine's
 * scales.ts directly). See the companion shell wrapper / parallel driver.
 *
 * Usage:
 *   node --experimental-strip-types tools/drone-render.mjs \
 *     --mood focus --duration 90 --output /tmp/focus.wav [--seed 1]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { OfflineAudioContext } from 'node-web-audio-api';
import {
  MOOD_MUSIC_CONFIGS,
  buildScaleFrequencies,
  midiToFreq,
} from '/mnt/homes/galileo/argo/Development/argobeat/packages/@argobeat/engine/src/music-gen/scales.ts';

// ── arg parsing ────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const mood = args.mood || 'focus';
const durationS = parseInt(args.duration || '90', 10);
const outputPath = args.output || '/tmp/drone.wav';
const seed = parseInt(args.seed || '1', 10);

// AM bus is OFF by default: the shipped bed must be CLEAN (no baked-in amplitude
// modulation). The app applies entrainment modulation live at playback, so the
// audio file must not double-modulate. `--am on` re-enables the baked AM bus for
// testing/reference only.
const amMode = (args.am || 'off').toLowerCase(); // 'off' (ship) | 'on' (reference)
const amEnabled = amMode === 'on';

// Rhythm intensity for the subtle pulse layer. 'subtle' is the default; 'none'
// removes it; 'light' is a touch more present. sleep biases toward 'none' (a
// barely-there 0.5 Hz swell) so nothing keeps a sleeper awake.
const rhythmMode = (args.rhythm || 'subtle').toLowerCase(); // 'none' | 'subtle' | 'light'

// ── deterministic RNG (mulberry32) so --seed reproduces a render ────────────
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(seed ^ 0x9e3779b9);

// ── per-mood drone parameter table ──────────────────────────────────────────
// AM Hz / depth + scale + register/filter character. Lower moods are slower,
// darker, lower in register with slower harmonic movement.
//
// Scale: the engine ships majorPentatonic, minorPentatonic, dorian, wholeTone,
// japaneseIn. The task asks for major / lydian / minor too — those are added in
// EXTRA_SCALES below and resolved through buildScale().
const DRONE_MOODS = {
  focus: {
    amHz: 15,
    amDepth: 0.22,
    scale: 'majorPentatonic',
    rootMidi: 48, // C3
    lowMidi: 36,
    highMidi: 72,
    padFilterHz: 1300, // brighter, present
    padTimbre: 'rich', // sawtooth-led harmonics
    holdS: 30,
    xfS: 10,
    driftHz: 0.2, // anti-habituation AM drift amplitude
    character: 'brighter, present',
    // Subtle rhythm: slow soft pulse for gentle forward motion. bpm + beats-per-pulse
    // give a pulse cadence; pulseStyle picks the voice. Kept well below the pads.
    bpm: 72,
    beatsPerPulse: 2, // one soft pulse every 2 beats
    pulseStyle: 'thump', // soft sine heartbeat
  },
  deepWork: {
    amHz: 18,
    amDepth: 0.22,
    scale: 'minorPentatonic',
    rootMidi: 45, // A2
    lowMidi: 33,
    highMidi: 69,
    padFilterHz: 750, // darker, steady
    padTimbre: 'rich',
    holdS: 35,
    xfS: 10,
    driftHz: 0.2,
    character: 'darker, steady',
    bpm: 80,
    beatsPerPulse: 2,
    pulseStyle: 'thump',
  },
  relax: {
    amHz: 10,
    amDepth: 0.14,
    scale: 'lydian', // major/lydian, warm + open
    rootMidi: 50, // D3
    lowMidi: 38,
    highMidi: 72,
    padFilterHz: 700, // warm, open
    padTimbre: 'rich',
    holdS: 40,
    xfS: 12,
    driftHz: 0.18,
    character: 'warm, open',
    bpm: 64,
    beatsPerPulse: 2,
    pulseStyle: 'pluck', // muted low pluck, lowpassed, gentle
  },
  meditate: {
    amHz: 6,
    amDepth: 0.16, // gentle by design, but deep enough to dominate the envelope spectrum
    scale: 'dorian', // dorian/minor, deep + slow
    rootMidi: 43, // G2
    lowMidi: 31,
    highMidi: 67,
    padFilterHz: 450, // deep, slow, darker filter
    padTimbre: 'pure', // sine/triangle-led — minimal harmonics so the AM stays the dominant envelope feature
    holdS: 48,
    xfS: 14,
    driftHz: 0.15,
    character: 'deep, slow',
    bpm: 52,
    beatsPerPulse: 4, // very sparse — one pulse per bar
    pulseStyle: 'thump',
  },
  sleep: {
    amHz: 2,
    amDepth: 0.12, // very gentle perceptually (slow 2Hz), deep enough to peak cleanly
    scale: 'minor', // minor, very dark
    rootMidi: 38, // D2 — lowest register
    lowMidi: 28,
    highMidi: 60,
    padFilterHz: 320, // very dark, minimal
    padTimbre: 'pure',
    holdS: 58,
    xfS: 16,
    driftHz: 0.12,
    character: 'very dark, minimal, lowest',
    // sleep has no discrete pulse: barely-there 0.5 Hz amplitude swell only, and
    // only when rhythm is explicitly 'light'. Default ('subtle') leaves it silent.
    bpm: 0,
    beatsPerPulse: 0,
    pulseStyle: 'swell',
  },
};

// Scales the engine does not ship but the task requests. Intervals are
// semitone offsets from the root, one octave; buildScale() tiles octaves.
const EXTRA_SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor (Aeolian)
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

const ENGINE_SCALES = ['majorPentatonic', 'minorPentatonic', 'dorian', 'wholeTone', 'japaneseIn'];

/**
 * Build ascending scale frequencies for the given root/scale/MIDI window.
 * Uses the engine's buildScaleFrequencies for the scales it ships; falls back
 * to a local interval table for major/minor/lydian.
 */
function buildScale(rootMidi, scaleName, lowMidi, highMidi) {
  if (ENGINE_SCALES.includes(scaleName)) {
    return buildScaleFrequencies(rootMidi, scaleName, lowMidi, highMidi).map((n) => n.freq);
  }
  const intervals = EXTRA_SCALES[scaleName];
  if (!intervals) throw new Error(`Unknown scale: ${scaleName}`);
  const freqs = [];
  for (let octave = -2; octave <= 8; octave++) {
    for (const iv of intervals) {
      const midi = rootMidi + octave * 12 + iv;
      if (midi >= lowMidi && midi <= highMidi) freqs.push(midiToFreq(midi));
    }
  }
  return freqs.sort((a, b) => a - b);
}

// ── resolve config ──────────────────────────────────────────────────────────
const m = DRONE_MOODS[mood];
if (!m) {
  console.error(`Unknown mood: ${mood}. Valid: ${Object.keys(DRONE_MOODS).join(', ')}`);
  process.exit(1);
}
const engineCfg = MOOD_MUSIC_CONFIGS[mood] || MOOD_MUSIC_CONFIGS.focus;

const SAMPLE_RATE = 44100;
const ctx = new OfflineAudioContext(2, SAMPLE_RATE * durationS, SAMPLE_RATE);

const scale = buildScale(m.rootMidi, m.scale, m.lowMidi, m.highMidi);

// ── Master glue chain (mirrors shipped export, gentler, mood-darkened) ──────
const masterIn = ctx.createGain();
const lp = ctx.createBiquadFilter();
lp.type = 'lowpass';
// Brighter moods get more top end; lower moods are progressively darker.
lp.frequency.value = Math.max(2200, m.padFilterHz * 5);
lp.Q.value = 0.3;
const hp = ctx.createBiquadFilter();
hp.type = 'highpass';
hp.frequency.value = 28;
hp.Q.value = 0.3;
const master = ctx.createGain();
master.gain.value = 0.62;
masterIn.connect(lp);
lp.connect(hp);
hp.connect(master);
master.connect(ctx.destination);

// ── Bed bus ─────────────────────────────────────────────────────────────────
// All bed voices (pad / sub / air / rhythm) connect to `amBus`. By default
// (`--am off`) `amBus` is a plain unity gain that routes straight to master —
// the rendered bed has NO baked amplitude modulation, which is what ships. The
// app applies entrainment modulation live at playback, so baking it here would
// double-modulate.
//
// With `--am on`, the same bus is driven by the original dual-detuned-LFO + drift
// tremolo for testing/reference renders only.
const amBus = ctx.createGain();
if (amEnabled) {
  // Strong clean amplitude modulation on the WHOLE drone bed.
  // Two slightly-detuned LFOs (the "dual-detuned-LFO trick") so the tremolo is
  // not mechanically periodic — it slowly phases. A super-slow drift LFO nudges
  // the centre rate ±driftHz over minutes (anti-habituation).
  amBus.gain.value = 1.0 - m.amDepth; // bias so the modulation sits below unity, never clips the bus
  amBus.connect(masterIn);

  // drift modulator on the AM centre frequency (very slow, period = whole track-ish)
  const driftPeriod = Math.max(120, durationS * 1.7); // > track length so it never repeats
  const drift = ctx.createOscillator();
  drift.type = 'sine';
  drift.frequency.value = 1 / driftPeriod;
  const driftGain = ctx.createGain();
  driftGain.gain.value = m.driftHz;
  drift.connect(driftGain);
  drift.start(0);
  drift.stop(durationS);

  // LFO A — primary rate
  const lfoA = ctx.createOscillator();
  lfoA.type = 'sine';
  lfoA.frequency.value = m.amHz;
  driftGain.connect(lfoA.frequency); // drift rides the rate
  const depthA = ctx.createGain();
  depthA.gain.value = m.amDepth * 0.62;
  lfoA.connect(depthA);
  depthA.connect(amBus.gain);
  lfoA.start(0);
  lfoA.stop(durationS);

  // LFO B — detuned partner (~+0.13Hz) for slow phasing, no mechanical tremolo
  const lfoB = ctx.createOscillator();
  lfoB.type = 'sine';
  lfoB.frequency.value = m.amHz + 0.13;
  driftGain.connect(lfoB.frequency);
  const depthB = ctx.createGain();
  depthB.gain.value = m.amDepth * 0.38;
  lfoB.connect(depthB);
  depthB.connect(amBus.gain);
  lfoB.start(0);
  lfoB.stop(durationS);
} else {
  // CLEAN bed: flat unity gain straight to master. No AM baked in.
  amBus.gain.value = 1.0;
  amBus.connect(masterIn);
}

// ── Sustained drone pad voice (fat detuned stack, slow filter breathing) ────
function droneVoice(freq, startT, dur, vel, pan, filterHz) {
  const pure = m.padTimbre === 'pure';
  const o1 = ctx.createOscillator();
  // 'pure' moods (meditate/sleep) use a sine-led pad: few harmonics means almost
  // no difference-tone beating between chord voices, so the AM bus stays the
  // single dominant amplitude-modulation feature in the energy envelope.
  o1.type = pure ? 'sine' : 'sawtooth';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = pure ? 'sine' : 'triangle';
  // Tiny detune for slow chorusing; smaller for pure moods to keep beats sub-Hz.
  o2.frequency.value = freq * (pure ? 1.003 : 1.005);
  const o3 = ctx.createOscillator();
  o3.type = 'sine';
  // Sub octave for rich moods. For pure (deep) moods a sub octave on a low root
  // can fall to ~25-30Hz and beat in the entrainment band, so keep it at the
  // fundamental there (no sub).
  o3.frequency.value = pure ? freq : freq * 0.5;
  const o4 = ctx.createOscillator();
  o4.type = 'sine';
  o4.frequency.value = freq * 2; // air
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 0.5;
  // Slow filter breathing across the whole note (drone evolution, not melody).
  f.frequency.setValueAtTime(filterHz * 0.55, startT);
  f.frequency.linearRampToValueAtTime(filterHz, startT + dur * 0.5);
  f.frequency.linearRampToValueAtTime(filterHz * 0.7, startT + dur);
  const sat = ctx.createWaveShaper();
  {
    const n = 4096;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (2 * i) / (n - 1) - 1;
      c[i] = Math.tanh(0.8 * x);
    }
    sat.curve = c;
    sat.oversample = '4x';
  }
  const g = ctx.createGain();
  // Long attack/release scaled gently for lower moods (slower swells).
  const atk = mood === 'sleep' || mood === 'meditate' ? 9 : 6;
  const rel = mood === 'sleep' || mood === 'meditate' ? 11 : 8;
  g.gain.setValueAtTime(0.0001, startT);
  g.gain.linearRampToValueAtTime(vel, startT + atk);
  g.gain.setValueAtTime(vel, startT + dur - rel);
  g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
  const o4g = ctx.createGain();
  o4g.gain.value = pure ? 0.0 : 0.06; // octave-air harmonic only on rich moods (it beats across triad tones)
  const o3g = ctx.createGain();
  o3g.gain.value = 0.5;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  o1.connect(f);
  o2.connect(f);
  o3.connect(o3g);
  o3g.connect(f);
  o4.connect(o4g);
  o4g.connect(f);
  f.connect(sat);
  sat.connect(g);
  g.connect(p);
  p.connect(amBus);
  for (const o of [o1, o2, o3, o4]) {
    o.start(startT);
    o.stop(startT + dur + 0.2);
  }
}

// ── Filtered noise air layer (continuous texture floor) ─────────────────────
{
  const len = SAMPLE_RATE * durationS;
  const buf = ctx.createBuffer(2, len, SAMPLE_RATE);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = rng() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // simple brown/pink-ish smoothing
      d[i] = last * 3.5;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = m.padFilterHz * 0.8;
  nf.Q.value = 0.4;
  const ng = ctx.createGain();
  const airLevel = mood === 'sleep' ? 0.04 : 0.07; // minimal air for sleep
  ng.gain.setValueAtTime(0, 0);
  ng.gain.linearRampToValueAtTime(airLevel, 6);
  src.connect(nf);
  nf.connect(ng);
  ng.connect(amBus);
  src.start(0);
}

// ── Slow harmonic movement: hold a chord, crossfade to the next ─────────────
// Rich moods use stacked triads (close, warm). Pure (deep) moods use OPEN
// voicings — root + fifth + octave — so that no two simultaneous tones sit a
// small interval apart. Close intervals produce difference tones that land in
// the 8-20Hz entrainment band and would compete with the AM marker; open
// voicings push all difference tones well above 30Hz.
const rootIdx = Math.max(0, Math.floor(scale.length * 0.18));

/** Index, near root+span, whose freq is closest to `ratio`× the root freq. */
function idxAtRatio(baseIdx, ratio) {
  const tgt = scale[baseIdx] * ratio;
  let best = baseIdx;
  let bestErr = Infinity;
  for (let i = baseIdx; i < scale.length; i++) {
    const e = Math.abs(scale[i] - tgt);
    if (e < bestErr) {
      bestErr = e;
      best = i;
    }
  }
  return best;
}

let chordSets;
if (m.padTimbre === 'pure') {
  // Octave-stacked only (ratios 1, 2, 4). A perfect fifth's difference tone is
  // root/2, which for these low roots falls in the entrainment band — so we
  // avoid fifths entirely. Octave/double-octave difference tones equal the root
  // or higher (>= ~55Hz), safely above the AM band.
  const r0 = rootIdx;
  const r1 = Math.min(rootIdx + 1, scale.length - 1); // alternate root a scale-step up
  chordSets = [
    [r0, idxAtRatio(r0, 2.0), idxAtRatio(r0, 4.0)], // root + octave + double octave
    [r1, idxAtRatio(r1, 2.0), idxAtRatio(r1, 4.0)],
    [r0, idxAtRatio(r0, 2.0), idxAtRatio(r0, 4.0)],
  ];
} else {
  chordSets = [
    [rootIdx, rootIdx + 2, rootIdx + 4],
    [rootIdx + 1, rootIdx + 3, rootIdx + 5],
    [rootIdx, rootIdx + 3, rootIdx + 4],
  ];
}
const HOLD = m.holdS;
const XF = m.xfS;
let t = 0;
let ci = 0;
while (t < durationS) {
  const chord = chordSets[ci % chordSets.length];
  const dur = Math.min(HOLD + XF, durationS - t + XF);
  chord.forEach((idx, k) => {
    const f = scale[Math.min(idx, scale.length - 1)];
    if (f > 22 && f < 2000) droneVoice(f, t, dur, 0.16 - k * 0.02, (k - 1) * 0.35, m.padFilterHz * 1.1);
  });
  // Sub drone on the root, very low, constant presence under the chord.
  // Only add it when the resulting sub fundamental stays clear of the AM band
  // (>= ~33Hz). For pure deep moods the root is already low enough that an
  // explicit sub octave would land in-band, so it is skipped.
  const subFreq = scale[Math.max(0, rootIdx)] / 2;
  if (subFreq >= 33 && m.padTimbre !== 'pure') {
    droneVoice(subFreq, t, dur, 0.1, 0, Math.min(300, m.padFilterHz));
  }
  t += HOLD;
  ci++;
}

// ── Subtle rhythm layer ─────────────────────────────────────────────────────
// A soft, low-level pulse for gentle forward motion — NOT a beat. No kick, no
// hats, no shakers, no melody. One muted, lowpassed thump or pluck on a slow
// per-mood tempo, with a gentle (non-clicky) attack, sitting ~18-24 dB below the
// pads. sleep gets only a barely-there 0.5 Hz swell, and only when explicitly
// requested via `--rhythm light`.
//
// Pulse peak target relative to pad velocity (~0.16): ~21 dB down ≈ 0.014.
const RHYTHM_GAIN = { none: 0, subtle: 1.0, light: 1.5 };
const rhythmScale = RHYTHM_GAIN[rhythmMode] ?? 1.0;

/** Soft sine "heartbeat" thump on `freq`. Gentle attack, lowpassed, no click. */
function pulseThump(freq, startT, peak, filterHz) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq * 1.5, startT);
  o.frequency.exponentialRampToValueAtTime(freq, startT + 0.12); // subtle downward "thump" body
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterHz;
  f.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, startT);
  g.gain.linearRampToValueAtTime(peak, startT + 0.04); // 40ms attack — soft, no transient click
  g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.85);
  o.connect(f);
  f.connect(g);
  g.connect(amBus);
  o.start(startT);
  o.stop(startT + 1.0);
}

/** Muted low pluck — slightly brighter body than the thump, still gentle. */
function pulsePluck(freq, startT, peak, filterHz) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const o2g = ctx.createGain();
  o2g.gain.value = 0.18; // faint upper harmonic for pluck definition
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(filterHz * 1.4, startT);
  f.frequency.exponentialRampToValueAtTime(filterHz * 0.7, startT + 0.5); // mute the body as it decays
  f.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, startT);
  g.gain.linearRampToValueAtTime(peak, startT + 0.03); // 30ms attack — soft pluck, no click
  g.gain.exponentialRampToValueAtTime(0.0001, startT + 1.1);
  o.connect(f);
  o2.connect(o2g);
  o2g.connect(f);
  f.connect(g);
  g.connect(amBus);
  o.start(startT);
  o.stop(startT + 1.3);
  o2.start(startT);
  o2.stop(startT + 1.3);
}

if (rhythmScale > 0) {
  // Pulse pitch: the sub-octave root, kept low and felt rather than heard.
  const rootFreq = scale[Math.max(0, rootIdx)];
  const pulseFreq = Math.max(40, rootFreq / 2);
  const pulseFilter = Math.min(220, m.padFilterHz); // keep it muted/dark

  if (m.pulseStyle === 'swell' || m.bpm === 0) {
    // sleep: barely-there slow swell instead of discrete pulses, and only when
    // the user explicitly asks for 'light'. 'subtle' (default) leaves it silent.
    if (rhythmMode === 'light') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = pulseFreq;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.5; // 0.5 Hz amplitude swell
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.006;
      const g = ctx.createGain();
      g.gain.value = 0.007; // very low base level
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = pulseFilter;
      o.connect(f);
      f.connect(g);
      g.connect(amBus);
      o.start(6); // fade in after the bed establishes
      o.stop(durationS);
      lfo.start(0);
      lfo.stop(durationS);
    }
  } else {
    // Discrete soft pulses on a slow grid. ~21 dB below the pads, *1.0 subtle.
    const peak = 0.014 * rhythmScale;
    const secPerBeat = 60 / m.bpm;
    const stepS = secPerBeat * m.beatsPerPulse;
    const pulse = m.pulseStyle === 'pluck' ? pulsePluck : pulseThump;
    // Start a couple of bars in so the pad swell is established first.
    for (let pt = stepS * 2; pt < durationS - 1.5; pt += stepS) {
      // Tiny deterministic timing/level humanization so it never feels machined.
      const jitter = (rng() - 0.5) * 0.02 * secPerBeat;
      const lvl = peak * (0.9 + rng() * 0.2);
      pulse(pulseFreq, pt + jitter, lvl, pulseFilter);
    }
  }
}

// ── Master fades ────────────────────────────────────────────────────────────
master.gain.setValueAtTime(0.001, 0);
master.gain.linearRampToValueAtTime(0.62, 4);
master.gain.setValueAtTime(0.62, durationS - 4);
master.gain.linearRampToValueAtTime(0.001, durationS);

const amDesc = amEnabled
  ? `AM ON ${m.amHz}Hz depth ${m.amDepth} (±${m.driftHz}Hz drift)`
  : 'AM OFF (clean bed)';
const rhythmDesc =
  rhythmScale > 0
    ? `rhythm ${rhythmMode} (${m.bpm === 0 ? 'swell' : `${m.pulseStyle} ${m.bpm}bpm/${m.beatsPerPulse}beat`})`
    : 'rhythm none';
console.log(
  `Rendering DRONE ${mood} ${durationS}s | ${amDesc} | ${rhythmDesc} | ` +
    `scale ${m.scale} ${scale.length} notes | filter ${m.padFilterHz}Hz | ${m.character}`,
);
const rendered = await ctx.startRendering();
const chans = [];
for (let c = 0; c < rendered.numberOfChannels; c++) chans.push(rendered.getChannelData(c));

// ── RMS normalize to ~-26 dBFS (match shipped target) ───────────────────────
let sumSq = 0;
let n = 0;
for (const ch of chans) for (const s of ch) {
  sumSq += s * s;
  n++;
}
const rms = 20 * Math.log10(Math.sqrt(sumSq / n) + 1e-10);
const mk = Math.pow(10, (-26 - rms) / 20);
for (const ch of chans) for (let i = 0; i < ch.length; i++) ch[i] *= mk;
let peak = 0;
for (const ch of chans) for (const s of ch) {
  const a = Math.abs(s);
  if (a > peak) peak = a;
}
if (peak > 0.891) {
  const sc = 0.891 / peak;
  for (const ch of chans) for (let i = 0; i < ch.length; i++) ch[i] *= sc;
}

// ── WAV encode (16-bit PCM stereo) ──────────────────────────────────────────
function encodeWav(channels, sr) {
  const nc = channels.length;
  const ns = channels[0].length;
  const bps = 16;
  const byps = bps / 8;
  const ba = nc * byps;
  const dataSize = ns * ba;
  const buffer = Buffer.alloc(44 + dataSize);
  let o = 0;
  buffer.write('RIFF', o); o += 4;
  buffer.writeUInt32LE(36 + dataSize, o); o += 4;
  buffer.write('WAVE', o); o += 4;
  buffer.write('fmt ', o); o += 4;
  buffer.writeUInt32LE(16, o); o += 4;
  buffer.writeUInt16LE(1, o); o += 2;
  buffer.writeUInt16LE(nc, o); o += 2;
  buffer.writeUInt32LE(sr, o); o += 4;
  buffer.writeUInt32LE(sr * ba, o); o += 4;
  buffer.writeUInt16LE(ba, o); o += 2;
  buffer.writeUInt16LE(bps, o); o += 2;
  buffer.write('data', o); o += 4;
  buffer.writeUInt32LE(dataSize, o); o += 4;
  for (let i = 0; i < ns; i++) {
    for (let c = 0; c < nc; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      buffer.writeInt16LE(s < 0 ? Math.max(-32768, Math.floor(s * 32768)) : Math.min(32767, Math.floor(s * 32767)), o);
      o += 2;
    }
  }
  return buffer;
}
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, encodeWav(chans, SAMPLE_RATE));
const finalRms = 20 * Math.log10(Math.sqrt(chans.reduce((a, ch) => a + ch.reduce((b, s) => b + s * s, 0), 0) / n) + 1e-10);
console.log(`Wrote ${outputPath} | final RMS ${finalRms.toFixed(1)} dBFS`);
