#!/usr/bin/env node
/**
 * LOFI renderer — tasteful lofi / chillhop / ambient dub-techno bed (prototype).
 *
 * Genre target: warm, mellow, consonant, loopable, non-distracting but clearly
 * MUSIC. "Beat felt more than heard" (Boards of Canada / DeepChord / lofi
 * hip-hop). The musical core is a 2-operator FM electric-piano (Rhodes/Wurli
 * style) playing lush A-minor 9th voicings over a pure sine sub, a soft
 * filtered-triangle bassline, a soft synthesized sine kick on beats 1 & 3, very
 * quiet swung closed hats, and an optional whisper-level airy texture.
 *
 * Deliberately AVOIDS the harshness of the rejected drone: NO detuned sawtooth
 * stacks, NO tanh saturation on clusters, NO loud broadband noise wall.
 *
 * The bed is rendered CLEAN — no baked-in amplitude modulation. The app applies
 * entrainment AM live at playback, so baking it here would double-modulate.
 *
 * Modeled on tools/drone-render.mjs (OfflineAudioContext via node-web-audio-api,
 * --arg parsing, mulberry32 seed RNG, WAV encode, RMS -26 dBFS normalize).
 *
 * Run with Node 22+:
 *   node --experimental-strip-types tools/lofi-render.mjs \
 *     --mood focus --duration 90 --output /tmp/focus-lofi.wav --seed 424242
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { OfflineAudioContext } from 'node-web-audio-api';
import { midiToFreq } from '/mnt/homes/galileo/argo/Development/argobeat/packages/@argobeat/engine/src/music-gen/scales.ts';

// ── arg parsing ────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const mood = args.mood || 'focus';
const durationS = parseInt(args.duration || '90', 10);
const outputPath = args.output || '/tmp/focus-lofi.wav';
const seed = parseInt(args.seed || '424242', 10);

// ── deterministic RNG (mulberry32) so --seed reproduces a render ─────────────
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

// ── per-mood config ──────────────────────────────────────────────────────────
// Prototype focuses on 'focus'. Other moods fall back to focus params so the
// CLI still runs, but the recipe is tuned for focus.
const LOFI_MOODS = {
  focus: {
    bpm: 84, // ~82-90 BPM lofi/chillhop pocket
    epFilterHz: 800, // electric-piano lowpass (600-900Hz mellow)
    swing: 0.10, // off-beat 8th delayed by swing*8thNote (gentle)
    character: 'warm A-minor lofi, gentle beat',
  },
};

// ── A-minor progression (rootless-ish lush extensions, no tritones) ──────────
// One chord per 2 bars (slow). Each chord: { bassMidi, root for sub, [chord voicing midi] }.
// Voicings are kept in a comfortable EP register (~C4-C5) with subtle voice-leading.
// Am9 -> G/A -> Fmaj7(9) -> Em7  (all in A natural minor, consonant 9th colors).
const A = 57; // A3 midi reference for bass roots
const PROG = [
  {
    name: 'Am9',
    bassMidi: A - 12, // A2
    subMidi: A - 24, // A1
    // A C E G B  -> rootless lush: C4 E4 G4 B4 (D5 nudge) => Am9 color (3 5 7 9 + add)
    voicing: [60, 64, 67, 71, 74], // C4 E4 G4 B4 D5
  },
  {
    name: 'G/A',
    bassMidi: A - 12, // pedal A in the bass (A2) under a G triad => warm sus/9 feel
    subMidi: A - 24, // A1 pedal
    voicing: [59, 62, 67, 71, 74], // B3 D4 G4 B4 D5  (G major colour over A pedal)
  },
  {
    name: 'Fmaj7(9)',
    bassMidi: 53 - 12, // F2
    subMidi: 53 - 24, // F1
    voicing: [60, 64, 65, 69, 72], // C4 E4 F4 A4 C5  (Fmaj7 add9: 5 7 R 3 5)
  },
  {
    name: 'Em7',
    bassMidi: 52 - 12, // E2
    subMidi: 52 - 24, // E1
    voicing: [59, 62, 64, 67, 71], // B3 D4 E4 G4 B4  (Em7: 5 b7 R b3 5)
  },
];

const cfg = LOFI_MOODS[mood] || LOFI_MOODS.focus;

const SAMPLE_RATE = 44100;
const ctx = new OfflineAudioContext(2, SAMPLE_RATE * durationS, SAMPLE_RATE);

const secPerBeat = 60 / cfg.bpm;
const secPerBar = secPerBeat * 4; // 4/4
const secPer8th = secPerBeat / 2;
const barsPerChord = 2;
const secPerChord = secPerBar * barsPerChord;

// ── Master glue chain ────────────────────────────────────────────────────────
// Warm, clean, gentle. Soft lowpass tames any incidental top end; high-pass
// clears sub-rumble below the intended sub-bass; gentle bus compression keeps it
// glued without pumping (slow attack/release, modest ratio — NOT sidechain).
const masterIn = ctx.createGain();
masterIn.gain.value = 1.0;

const busLp = ctx.createBiquadFilter();
busLp.type = 'lowpass';
busLp.frequency.value = 9000; // warm — roll off brittle highs
busLp.Q.value = 0.3;

const busHp = ctx.createBiquadFilter();
busHp.type = 'highpass';
busHp.frequency.value = 26; // protect the sub but clear DC/rumble
busHp.Q.value = 0.3;

const busComp = ctx.createDynamicsCompressor();
busComp.threshold.value = -18;
busComp.knee.value = 18; // soft knee
busComp.ratio.value = 2.2; // gentle glue
busComp.attack.value = 0.05; // slow attack — preserves transients, no pump
busComp.release.value = 0.35;

const master = ctx.createGain();
master.gain.value = 0.85;

masterIn.connect(busLp);
busLp.connect(busHp);
busHp.connect(busComp);
busComp.connect(master);
master.connect(ctx.destination);

// ── Layer sub-buses (so each layer's level is easy to balance) ───────────────
function makeBus(level) {
  const g = ctx.createGain();
  g.gain.value = level;
  g.connect(masterIn);
  return g;
}
const epBus = makeBus(0.55); // electric-piano chords — the musical core, loudest
const subBus = makeBus(0.42); // pure sine sub-bass
const bassBus = makeBus(0.30); // filtered-triangle bassline, supportive
const kickBus = makeBus(0.50); // soft sine kick
const hatBus = makeBus(0.045); // very quiet closed hats (~-24dB vs keys)
const airBus = makeBus(0.030); // whisper-level airy texture (~-30dB)

// ── 2-operator FM electric piano (Rhodes/Wurli-style) ────────────────────────
// Sine carrier + sine modulator. modIndex ~1-3 with a fast-decaying modulator
// envelope gives the mellow bell/EP attack that settles to a near-pure sine.
// Soft ~15ms attack, gentle decay to a low sustain, smooth release. Lowpassed
// ~600-900Hz so it stays dark and dreamy. Low velocity. No saws, no saturation.
function epNote(freq, startT, dur, vel, pan) {
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = freq;

  const mod = ctx.createOscillator();
  mod.type = 'sine';
  // Modulator at the fundamental (ratio 1:1) gives a warm EP/tine timbre.
  mod.frequency.value = freq;

  // Modulator depth in Hz = modIndex * carrierFreq. Start at ~2.6x (bright tine
  // attack), decay fast to ~0.4x (mellow body) so the "bell" only colours onset.
  const modDepth = ctx.createGain();
  const idxStart = 2.6;
  const idxEnd = 0.4;
  modDepth.gain.setValueAtTime(idxStart * freq, startT);
  modDepth.gain.exponentialRampToValueAtTime(idxEnd * freq, startT + 0.18);
  mod.connect(modDepth);
  modDepth.connect(carrier.frequency);

  // Tone-shaping lowpass — keeps the EP mellow.
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cfg.epFilterHz;
  f.Q.value = 0.5;

  // Amplitude envelope: soft 15ms attack, gentle decay to sustain, smooth tail.
  const g = ctx.createGain();
  const atk = 0.015;
  const decay = 0.9;
  const sustain = vel * 0.55;
  const rel = Math.min(1.2, dur * 0.4);
  g.gain.setValueAtTime(0.0001, startT);
  g.gain.linearRampToValueAtTime(vel, startT + atk);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, sustain), startT + atk + decay);
  g.gain.setValueAtTime(Math.max(0.0002, sustain), startT + dur - rel);
  g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);

  const p = ctx.createStereoPanner();
  p.pan.value = pan;

  carrier.connect(f);
  f.connect(g);
  g.connect(p);
  p.connect(epBus);

  carrier.start(startT);
  carrier.stop(startT + dur + 0.1);
  mod.start(startT);
  mod.stop(startT + dur + 0.1);
}

// ── Pure sine sub-bass (tracks chord root, low, gentle) ──────────────────────
function subNote(freq, startT, dur, vel) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const g = ctx.createGain();
  const atk = 0.04;
  const rel = Math.min(0.5, dur * 0.3);
  g.gain.setValueAtTime(0.0001, startT);
  g.gain.linearRampToValueAtTime(vel, startT + atk);
  g.gain.setValueAtTime(vel, startT + dur - rel);
  g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
  o.connect(g);
  g.connect(subBus);
  o.start(startT);
  o.stop(startT + dur + 0.1);
}

// ── Filtered-triangle bassline (1 note per bar, supportive) ──────────────────
function bassNote(freq, startT, dur, vel) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(420, startT);
  f.frequency.exponentialRampToValueAtTime(220, startT + dur * 0.6); // mellows as it sustains
  f.Q.value = 0.6;
  const g = ctx.createGain();
  const atk = 0.02;
  const rel = Math.min(0.4, dur * 0.35);
  g.gain.setValueAtTime(0.0001, startT);
  g.gain.linearRampToValueAtTime(vel, startT + atk);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel * 0.6), startT + dur - rel);
  g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
  o.connect(f);
  f.connect(g);
  g.connect(bassBus);
  o.start(startT);
  o.stop(startT + dur + 0.1);
}

// ── Soft synthesized sine kick (no click, no high end) ───────────────────────
// Pitch sweep ~70Hz -> 45Hz over 120ms, soft 8-12ms amplitude attack. Pure sine
// body only — no transient layer — so it dumps no broadband energy (science-safe).
function softKick(startT, vel) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(70, startT);
  o.frequency.exponentialRampToValueAtTime(45, startT + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, startT);
  g.gain.linearRampToValueAtTime(vel, startT + 0.010); // 10ms soft attack, no click
  g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.40);
  o.connect(g);
  g.connect(kickBus);
  o.start(startT);
  o.stop(startT + 0.5);
}

// ── Very quiet closed hat: short highpassed noise burst, fast decay ──────────
function closedHat(startT, vel) {
  const len = Math.ceil(SAMPLE_RATE * 0.06);
  const buf = ctx.createBuffer(1, len, SAMPLE_RATE);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = rng() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6500; // airy, ~6kHz+ only
  hp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, startT);
  g.gain.linearRampToValueAtTime(vel, startT + 0.002); // tiny soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.045); // fast decay
  const p = ctx.createStereoPanner();
  p.pan.value = (rng() - 0.5) * 0.25; // gentle stereo shimmer
  src.connect(hp);
  hp.connect(g);
  g.connect(p);
  p.connect(hatBus);
  src.start(startT);
  src.stop(startT + 0.07);
}

// ── Whisper-level airy texture (lowpassed slow-moving noise, autopanned) ─────
// WAY below everything (~-30dB). Optional warmth/vinyl-air, never a noise wall.
{
  const len = SAMPLE_RATE * durationS;
  const buf = ctx.createBuffer(2, len, SAMPLE_RATE);
  for (let c = 0; c < 2; c++) {
    const dch = buf.getChannelData(c);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = rng() * 2 - 1;
      last = (last + 0.015 * w) / 1.015; // heavy smoothing -> soft, dark air
      dch[i] = last * 3.0;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200; // dark, airy — no harsh top
  lp.Q.value = 0.3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, 0);
  g.gain.linearRampToValueAtTime(1.0, 6);
  // Slow autopan (sub-Hz) for gentle width — kept well below the keys.
  const panOsc = ctx.createOscillator();
  panOsc.type = 'sine';
  panOsc.frequency.value = 0.05;
  const p = ctx.createStereoPanner();
  panOsc.connect(p.pan);
  panOsc.start(0);
  panOsc.stop(durationS);
  src.connect(lp);
  lp.connect(g);
  g.connect(p);
  p.connect(airBus);
  src.start(0);
}

// ── Sequence the song ─────────────────────────────────────────────────────────
const totalChords = Math.ceil(durationS / secPerChord) + 1;

for (let ci = 0; ci < totalChords; ci++) {
  const chordStart = ci * secPerChord;
  if (chordStart >= durationS) break;
  const chord = PROG[ci % PROG.length];
  const chordDur = Math.min(secPerChord, durationS - chordStart) + 0.5;

  // SUB-BASS: one held sine on the chord root for the whole 2-bar span.
  subNote(midiToFreq(chord.subMidi), chordStart, chordDur, 0.5);

  // CHORDS: lay the EP voicing down, lush, low velocity, spread across stereo,
  // with a tiny per-note roll (humanized strum) so it breathes.
  chord.voicing.forEach((midi, k) => {
    const roll = Math.max(0, k * 0.012 + (rng() - 0.5) * 0.006); // gentle spread/humanize, never negative
    const pan = (k / (chord.voicing.length - 1) - 0.5) * 0.5; // -0.25..+0.25
    const vel = 0.14 - k * 0.012; // low, top voices quieter
    epNote(midiToFreq(midi), chordStart + roll, chordDur - roll, Math.max(0.05, vel), pan);
  });
}

// BASSLINE: 1 note per bar following the root motion of the current chord.
{
  const totalBars = Math.ceil(durationS / secPerBar);
  for (let b = 0; b < totalBars; b++) {
    const t = b * secPerBar;
    if (t >= durationS) break;
    const chord = PROG[Math.floor(b / barsPerChord) % PROG.length];
    const dur = Math.min(secPerBar, durationS - t) + 0.1;
    bassNote(midiToFreq(chord.bassMidi), t, dur, 0.42);
  }
}

// BEAT: soft kick on beats 1 & 3; quiet swung 8th-note closed hats.
{
  const totalBars = Math.ceil(durationS / secPerBar);
  for (let b = 0; b < totalBars; b++) {
    const barStart = b * secPerBar;
    // Kick on beat 1 and beat 3 only.
    for (const beat of [0, 2]) {
      const t = barStart + beat * secPerBeat;
      if (t < durationS) softKick(t, 0.55 * (0.92 + rng() * 0.16));
    }
    // Hats: 8th notes, swung. Skip the very first beat-1 hat so the kick speaks.
    for (let step = 0; step < 8; step++) {
      const isOff = step % 2 === 1; // off-beat 8th gets swing delay
      const swing = isOff ? cfg.swing * secPer8th : 0;
      const jitter = (rng() - 0.5) * 0.004; // micro-timing humanize
      const t = Math.max(0, barStart + step * secPer8th + swing + jitter);
      if (t >= durationS) break;
      // Accent pattern: slightly louder off-beats, quieter on strong beats so
      // the hats stay decorative, never driving. All very quiet overall.
      const accent = isOff ? 0.55 : 0.32;
      const vel = accent * (0.85 + rng() * 0.3);
      closedHat(t, vel);
    }
  }
}

// ── Master fades (gentle in/out) ─────────────────────────────────────────────
master.gain.setValueAtTime(0.001, 0);
master.gain.linearRampToValueAtTime(0.85, 3);
master.gain.setValueAtTime(0.85, durationS - 3);
master.gain.linearRampToValueAtTime(0.001, durationS);

console.log(
  `Rendering LOFI ${mood} ${durationS}s | ${cfg.bpm}bpm | ` +
    `prog ${PROG.map((c) => c.name).join(' -> ')} | EP lp ${cfg.epFilterHz}Hz | ` +
    `CLEAN bed (no baked AM) | ${cfg.character}`,
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
