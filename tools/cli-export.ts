#!/usr/bin/env npx tsx
/**
 * ArgoBeat CLI Audio Export — renders sessions offline to WAV files.
 *
 * Uses node-web-audio-api's OfflineAudioContext to render faster-than-realtime.
 * Directly uses the engine's synthesis and pattern functions.
 *
 * Usage:
 *   npx tsx tools/cli-export.ts --output test.wav --mood focus --duration 30
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { parseArgs } from 'util';

// Node.js Web Audio API polyfill
import {
  OfflineAudioContext,
  // @ts-ignore - node-web-audio-api types may not be perfect
} from 'node-web-audio-api';

// Engine imports
import { SeededRNG } from '../packages/@argobeat/engine/src/music-gen/rng.js';
import {
  MOOD_MUSIC_CONFIGS,
  MOOD_BPM_DEFAULTS,
  MOOD_PROGRESSIONS,
  CHORD_VOICINGS,
  buildScaleFrequencies,
  type ChordVoicing,
} from '../packages/@argobeat/engine/src/music-gen/scales.js';
import {
  generateMarkovMelody,
  getMoodMarkovConfig,
} from '../packages/@argobeat/engine/src/music-gen/markov.js';

// =============================================================================
// CLI argument parsing
// =============================================================================

const { values: args } = parseArgs({
  options: {
    output: { type: 'string', short: 'o' },
    mood: { type: 'string', short: 'm', default: 'focus' },
    duration: { type: 'string', short: 'd', default: '30' },
    seed: { type: 'string', short: 's', default: String(Date.now()) },
    bpm: { type: 'string' },
    padFilterMult: { type: 'string', default: '1' },
    melodyFilterMult: { type: 'string', default: '1' },
    masterLowpass: { type: 'string', default: '7600' },
    masterPresence: { type: 'string', default: '2.5' },
    masterGain: { type: 'string', default: '0.72' },
    fadeSeconds: { type: 'string', default: '2' },
  },
  strict: true,
});

const outputPath = resolve(args.output || 'argobeat-export.wav');
const mood = args.mood || 'focus';
const durationS = parseInt(args.duration || '30');
const seed = parseInt(args.seed || String(Date.now()));
const bpmOverride = args.bpm ? parseFloat(args.bpm) : null;
const padFilterMult = Math.max(0.1, parseFloat(args.padFilterMult || '1'));
const melodyFilterMult = Math.max(0.1, parseFloat(args.melodyFilterMult || '1'));
const masterLowpassHz = Math.max(200, parseFloat(args.masterLowpass || '7600'));
const masterPresenceDb = parseFloat(args.masterPresence || '2.5');
const masterGainValue = Math.max(0.05, parseFloat(args.masterGain || '0.5'));
const fadeSeconds = Math.max(0, parseFloat(args.fadeSeconds || '2'));

console.log(`\n🎵 ArgoBeat CLI Export`);
console.log(`   Mood:     ${mood}`);
console.log(`   Duration: ${durationS}s`);
console.log(`   Seed:     ${seed}`);
if (bpmOverride !== null && !Number.isNaN(bpmOverride)) console.log(`   BPM override: ${bpmOverride}`);
console.log(`   Pad filter x: ${padFilterMult}`);
console.log(`   Melody filter x: ${melodyFilterMult}`);
console.log(`   Master lowpass: ${masterLowpassHz}`);
console.log(`   Master presence: ${masterPresenceDb} dB`);
console.log(`   Master gain: ${masterGainValue}`);
console.log(`   Fade seconds: ${fadeSeconds}`);
console.log(`   Output:   ${outputPath}\n`);

// =============================================================================
// Offline render
// =============================================================================

const SAMPLE_RATE = 44100;
const CHANNELS = 2;
const totalSamples = SAMPLE_RATE * durationS;

async function render(): Promise<Float32Array[]> {
  // @ts-ignore - OfflineAudioContext constructor signature
  const ctx = new OfflineAudioContext(CHANNELS, totalSamples, SAMPLE_RATE);

  const rng = new SeededRNG(seed);
  const config = MOOD_MUSIC_CONFIGS[mood] || MOOD_MUSIC_CONFIGS.focus;

  // Build scale frequencies
  const scaleNotes = buildScaleFrequencies(
    config.rootMidi,
    config.scaleType,
    config.lowMidi,
    config.highMidi,
  );
  const freqs = scaleNotes.map(n => n.freq);

  // Pick chord progressions
  const progressions = MOOD_PROGRESSIONS[mood] || MOOD_PROGRESSIONS.focus;
  const progression = rng.pick(progressions);

  const bpmConfig = MOOD_BPM_DEFAULTS[mood] || MOOD_BPM_DEFAULTS.focus;
  const bpm = bpmOverride !== null && !Number.isNaN(bpmOverride)
    ? bpmOverride
    : rng.gaussian(bpmConfig.minBpm, bpmConfig.maxBpm);
  const beatDuration = 60 / bpm;
  const melodyBeats = mood === 'deepWork' ? [0, 3, 6] : [0, 2, 4, 7];
  const motifLength = mood === 'deepWork' ? 3 : 4;
  const markovConfig = getMoodMarkovConfig(mood);
  const motifRefreshPhrases = rng.intRange(4, 8);

  console.log(`   BPM:      ${bpm}`);
  console.log(`   Scale:    ${config.scaleType} (root MIDI ${config.rootMidi})`);
  console.log(`   Notes:    ${freqs.length} in pool`);
  console.log(`   Progression: ${progression.join(' → ')}`);

  // Master output with a small lo-fi glue chain so the export is less clinical.
  const masterInput = ctx.createGain();
  const masterSaturator = ctx.createWaveShaper();
  masterSaturator.curve = buildTanhCurve(1.0);
  masterSaturator.oversample = '4x';
  const masterLowpass = ctx.createBiquadFilter();
  masterLowpass.type = 'lowpass';
  masterLowpass.frequency.value = masterLowpassHz;
  masterLowpass.Q.value = 0.3;
  const masterPresence = ctx.createBiquadFilter();
  masterPresence.type = 'highshelf';
  masterPresence.frequency.value = 2600;
  masterPresence.gain.value = masterPresenceDb;
  const masterHighpass = ctx.createBiquadFilter();
  masterHighpass.type = 'highpass';
  masterHighpass.frequency.value = 38;
  masterHighpass.Q.value = 0.3;
  const masterGain = ctx.createGain();
  masterGain.gain.value = masterGainValue;
  masterInput.connect(masterSaturator);
  masterSaturator.connect(masterLowpass);
  masterLowpass.connect(masterPresence);
  masterPresence.connect(masterHighpass);
  masterHighpass.connect(masterGain);
  masterGain.connect(ctx.destination);

  // Generate melody notes
  const totalBeats = Math.floor(durationS / beatDuration);
  let chordIndex = 0;
  let phraseIndex = 0;
  let motif = generateOfflineMotif(rng, scaleNotes, progression, chordIndex, motifLength, markovConfig);

  for (let beat = 0; beat < totalBeats; beat++) {
    const time = beat * beatDuration;
    const beatInBar = beat % 4;
    const phrasePosition = beat % 8;

    // Change chord every 4 bars to match the real pattern engine.
    if (beat % 16 === 0) {
      chordIndex = Math.floor(beat / 16) % progression.length;
      const chordType = progression[chordIndex];
      const voicing = CHORD_VOICINGS[chordType] || CHORD_VOICINGS.maj7;
      const rootFreq = scaleNotes[Math.min(4, scaleNotes.length - 1)]?.freq ?? freqs[Math.min(2, freqs.length - 1)];

      // Play pad chord
      for (const interval of voicing) {
          const noteFreq = rootFreq * Math.pow(2, interval / 12);
        if (noteFreq > 20 && noteFreq < 4000) {
          playOfflinePad(ctx, masterInput, noteFreq, time, beatDuration * 15.5, 0.03, config.padFilterHz * 1.22 * padFilterMult, {
            pan: ((interval % 5) - 2) * 0.16,
            brightness: 0.72,
          });
        }
      }
      motif = generateOfflineMotif(rng, scaleNotes, progression, chordIndex, motifLength, markovConfig);
    }

    if (phrasePosition === 0 && beat > 0) {
      phraseIndex++;
      if (phraseIndex % motifRefreshPhrases === 0) {
        motif = generateOfflineMotif(rng, scaleNotes, progression, chordIndex, motifLength, markovConfig);
      }
    }

    // Melody note on phrase anchors using Markov-generated motifs.
    if (melodyBeats.includes(phrasePosition)) {
      const noteIdx = melodyBeats.indexOf(phrasePosition) % Math.max(motif.length, 1);
      let freq = motif[noteIdx] ?? null;
      if (typeof freq === 'number' && beat > 0 && beat % 16 === 8 && rng.next() < 0.35) {
        freq = applyOfflineVariation(freqs, freq, rng);
      }
      if (typeof freq === 'number' && rng.next() >= 0.18) {
        const velocity = mood === 'deepWork'
          ? [0.034, 0.026, 0.03][noteIdx % 3]
          : [0.048, 0.034, 0.04, 0.03][noteIdx % 4];
        const noteDuration = beatDuration * (0.62 + rng.next() * 0.28);
        playOfflineNote(ctx, masterInput, freq, time, noteDuration, velocity, config.melodyFilterHz * 1.2 * melodyFilterMult, {
          pan: rng.floatRange(-0.22, 0.22),
          brightness: 0.82,
        });
      }
    } else if (rng.next() < 0.06 && phrasePosition !== 1 && phrasePosition !== 5) {
      const passingFreq = freqs[rng.intRange(Math.floor(freqs.length * 0.35), Math.max(Math.floor(freqs.length * 0.85), 0))];
      if (typeof passingFreq === 'number') {
        playOfflineNote(ctx, masterInput, passingFreq, time, beatDuration * 0.4, 0.014, config.melodyFilterHz * melodyFilterMult, {
          pan: rng.floatRange(-0.15, 0.15),
          brightness: 0.46,
        });
      }
    }

    // Bass pulse on beats 1 and 3.
    if (beatInBar === 0 || (beatInBar === 2 && rng.next() < 0.45)) {
      const bassFreq = (scaleNotes[0]?.freq ?? freqs[0]) / 2;
        playOfflineBass(ctx, masterInput, bassFreq, time, beatDuration * 0.72, beatInBar === 0 ? 0.044 : 0.026);
    }

    // Softer lo-fi pulse with shaped transient/noise instead of bare test tones.
    if (mood === 'focus' || mood === 'deepWork') {
      if (beatInBar === 0) {
        playOfflineKick(ctx, masterInput, 54, time, 0.28, 0.052, -0.03);
      }
      if (beatInBar === 2) {
        playOfflinePulse(ctx, masterInput, 185, time, 0.14, 0.03, 0.05);
      }
      if ((beatInBar === 1 || beatInBar === 3) && rng.next() < 0.5) {
        playOfflinePulse(ctx, masterInput, 240, time + beatDuration * 0.5, 0.09, 0.014, rng.floatRange(-0.12, 0.12));
      }
      if (beatInBar === 1 || beatInBar === 3) {
        playOfflineHat(ctx, masterInput, time + beatDuration * 0.02, 0.028, 0.0055, rng.floatRange(-0.18, 0.18), 7000);
      }
      if (rng.next() < 0.88) {
        playOfflineShaker(ctx, masterInput, time + beatDuration * 0.5, 0.045, beatInBar === 0 || beatInBar === 2 ? 0.0045 : 0.0035, rng.floatRange(-0.28, 0.28));
      }
    }
  }

  // Optional fade in/out. Disable for loop-safe renders.
  if (fadeSeconds > 0) {
    const boundedFade = Math.min(fadeSeconds, Math.max(durationS / 2 - 0.01, 0.01));
    masterGain.gain.setValueAtTime(0.001, 0);
    masterGain.gain.linearRampToValueAtTime(masterGainValue, boundedFade);
    masterGain.gain.setValueAtTime(masterGainValue, Math.max(durationS - boundedFade, boundedFade));
    masterGain.gain.linearRampToValueAtTime(0.001, durationS);
  } else {
    masterGain.gain.setValueAtTime(masterGainValue, 0);
  }

  console.log(`   Rendering ${totalBeats} beats...`);

  const renderedBuffer = await ctx.startRendering();

  // Extract channel data
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < renderedBuffer.numberOfChannels; ch++) {
    channels.push(renderedBuffer.getChannelData(ch));
  }

  return channels;
}

// =============================================================================
// Offline synthesis helpers
// =============================================================================

function playOfflineNote(
  ctx: OfflineAudioContext,
  dest: any,
  freq: number,
  startTime: number,
  duration: number,
  velocity: number,
  filterHz: number,
  options?: {
    pan?: number;
    brightness?: number;
  },
): void {
  const bodyMod = ctx.createOscillator();
  bodyMod.type = 'sine';
  bodyMod.frequency.value = freq;
  const bodyModGain = ctx.createGain();
  bodyModGain.gain.setValueAtTime(freq * 0.34, startTime);
  bodyModGain.gain.exponentialRampToValueAtTime(freq * 0.09, startTime + Math.min(2, duration + 0.2));

  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.value = freq;
  bodyMod.connect(bodyModGain);
  bodyModGain.connect(body.frequency);

  const shimmerMod = ctx.createOscillator();
  shimmerMod.type = 'sine';
  shimmerMod.frequency.value = Math.min(freq * 9, 18000);
  const shimmerModGain = ctx.createGain();
  shimmerModGain.gain.setValueAtTime(freq * 0.22, startTime);
  shimmerModGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.09);

  const shimmer = ctx.createOscillator();
  shimmer.type = 'triangle';
  shimmer.frequency.value = freq * 2;
  shimmerMod.connect(shimmerModGain);
  shimmerModGain.connect(shimmer.frequency);

  const presence = ctx.createOscillator();
  presence.type = 'triangle';
  presence.frequency.value = Math.min(freq * 4, 12000);
  const presenceHighpass = ctx.createBiquadFilter();
  presenceHighpass.type = 'highpass';
  presenceHighpass.frequency.value = Math.max(1500, Math.min(filterHz * 0.9, 3600));
  presenceHighpass.Q.value = 0.4;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterHz;
  filter.Q.value = 0.65;
  const saturator = ctx.createWaveShaper();
  saturator.curve = buildTanhCurve(0.7);
  saturator.oversample = '4x';

  const mix = ctx.createGain();
  const bodyGain = ctx.createGain();
  const shimmerGain = ctx.createGain();
  const presenceGain = ctx.createGain();
  bodyGain.gain.value = 0.82;
  shimmerGain.gain.value = 0.12 + (options?.brightness ?? 0.2) * 0.1;
  presenceGain.gain.value = 0.008 + (options?.brightness ?? 0.2) * 0.03;
  const attack = 0.06;
  const release = 0.3;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(velocity, startTime + attack);
  gain.gain.setValueAtTime(velocity, startTime + duration);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);

  const panner = ctx.createStereoPanner();
  panner.pan.value = options?.pan ?? 0;

  body.connect(bodyGain);
  shimmer.connect(shimmerGain);
  presence.connect(presenceHighpass);
  presenceHighpass.connect(presenceGain);
  bodyGain.connect(mix);
  shimmerGain.connect(mix);
  presenceGain.connect(saturator);
  mix.connect(filter);
  filter.connect(saturator);
  saturator.connect(gain);
  gain.connect(panner);
  panner.connect(dest);

  bodyMod.start(startTime);
  body.start(startTime);
  shimmerMod.start(startTime);
  shimmer.start(startTime);
  presence.start(startTime);
  bodyMod.stop(startTime + duration + release + 0.1);
  body.stop(startTime + duration + release + 0.1);
  shimmerMod.stop(startTime + duration + release + 0.1);
  shimmer.stop(startTime + duration + release + 0.1);
  presence.stop(startTime + duration + release + 0.1);
}

function playOfflinePad(
  ctx: OfflineAudioContext,
  dest: any,
  freq: number,
  startTime: number,
  duration: number,
  velocity: number,
  filterHz: number,
  options?: {
    pan?: number;
    brightness?: number;
  },
): void {
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = freq;
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = freq * 1.004;
  const air = ctx.createOscillator();
  air.type = 'sine';
  air.frequency.value = freq * 2;
  const sparkle = ctx.createOscillator();
  sparkle.type = 'triangle';
  sparkle.frequency.value = Math.min(freq * 4, 12000);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterHz;
  filter.Q.value = 0.4;
  const saturator = ctx.createWaveShaper();
  saturator.curve = buildTanhCurve(0.8);
  saturator.oversample = '4x';
  const sparkleHighpass = ctx.createBiquadFilter();
  sparkleHighpass.type = 'highpass';
  sparkleHighpass.frequency.value = Math.max(1200, Math.min(filterHz * 0.8, 3200));
  sparkleHighpass.Q.value = 0.35;
  const attack = 0.22;
  const release = 1.4;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(velocity, startTime + attack);
  gain.gain.setValueAtTime(velocity, startTime + duration);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);
  const panner = ctx.createStereoPanner();
  panner.pan.value = options?.pan ?? 0;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.11 + (options?.brightness ?? 0.3) * 0.12;
  const sparkleGain = ctx.createGain();
  sparkleGain.gain.value = 0.012 + (options?.brightness ?? 0.3) * 0.04;

  osc1.connect(filter);
  osc2.connect(filter);
  air.connect(airGain);
  airGain.connect(filter);
  sparkle.connect(sparkleHighpass);
  sparkleHighpass.connect(sparkleGain);
  filter.connect(saturator);
  sparkleGain.connect(saturator);
  saturator.connect(gain);
  gain.connect(panner);
  panner.connect(dest);

  osc1.start(startTime);
  osc2.start(startTime);
  air.start(startTime);
  sparkle.start(startTime);
  osc1.stop(startTime + duration + release + 0.1);
  osc2.stop(startTime + duration + release + 0.1);
  air.stop(startTime + duration + release + 0.1);
  sparkle.stop(startTime + duration + release + 0.1);
}

function playOfflineBass(
  ctx: OfflineAudioContext,
  dest: any,
  freq: number,
  startTime: number,
  duration: number,
  velocity: number,
): void {
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(freq * 1.5, startTime);
  sub.frequency.exponentialRampToValueAtTime(freq, startTime + 0.07);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.value = freq * 2;
  const bodyGain = ctx.createGain();
  bodyGain.gain.value = 0.18;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  filter.Q.value = 0.5;
  const saturator = ctx.createWaveShaper();
  saturator.curve = buildTanhCurve(1.05);
  saturator.oversample = '4x';
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(velocity, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  sub.connect(filter);
  body.connect(bodyGain);
  bodyGain.connect(filter);
  filter.connect(saturator);
  saturator.connect(gain);
  gain.connect(dest);

  sub.start(startTime);
  body.start(startTime);
  sub.stop(startTime + duration + 0.1);
  body.stop(startTime + duration + 0.1);
}

function playOfflineKick(
  ctx: OfflineAudioContext,
  dest: any,
  freq: number,
  startTime: number,
  decay: number,
  velocity: number,
  pan: number,
): void {
  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(freq * 2.4, startTime);
  body.frequency.exponentialRampToValueAtTime(freq, startTime + 0.08);
  const click = ctx.createBufferSource();
  click.buffer = createNoiseBuffer(ctx, 0.04);
  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = 'bandpass';
  clickFilter.frequency.value = 1800;
  clickFilter.Q.value = 0.9;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(velocity * 0.16, startTime);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.025);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(velocity, startTime);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  const saturator = ctx.createWaveShaper();
  saturator.curve = buildTanhCurve(1.15);
  saturator.oversample = '4x';
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;

  body.connect(bodyGain);
  bodyGain.connect(saturator);
  click.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(saturator);
  saturator.connect(panner);
  panner.connect(dest);

  body.start(startTime);
  click.start(startTime);
  body.stop(startTime + decay + 0.1);
}

function playOfflinePulse(
  ctx: OfflineAudioContext,
  dest: any,
  freq: number,
  startTime: number,
  decay: number,
  velocity: number,
  pan: number,
): void {
  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.value = freq;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.08);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1200;
  noiseFilter.Q.value = 1.2;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(velocity * 0.35, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);
  const toneGain = ctx.createGain();
  toneGain.gain.setValueAtTime(velocity, startTime);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;

  tone.connect(toneGain);
  toneGain.connect(filter);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(filter);
  filter.connect(panner);
  panner.connect(dest);

  tone.start(startTime);
  noise.start(startTime);
  tone.stop(startTime + decay + 0.1);
}

function playOfflineHat(
  ctx: OfflineAudioContext,
  dest: any,
  startTime: number,
  decay: number,
  velocity: number,
  pan: number,
  centerHz: number,
): void {
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.08);
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = Math.max(4200, centerHz - 1800);
  highpass.Q.value = 0.8;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = centerHz;
  bandpass.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;

  noise.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(panner);
  panner.connect(dest);

  noise.start(startTime);
}

function playOfflineShaker(
  ctx: OfflineAudioContext,
  dest: any,
  startTime: number,
  decay: number,
  velocity: number,
  pan: number,
): void {
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.1);
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 2600;
  highpass.Q.value = 0.6;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 4200;
  bandpass.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;

  noise.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(panner);
  panner.connect(dest);

  noise.start(startTime);
}

function buildTanhCurve(drive: number, samples = 8192): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (2 * i) / (samples - 1) - 1;
    curve[i] = Math.tanh(drive * x);
  }
  return curve;
}

function createNoiseBuffer(ctx: OfflineAudioContext, durationS: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationS));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function generateOfflineMotif(
  rng: SeededRNG,
  scaleNotes: { midi: number; freq: number }[],
  progression: ChordVoicing[],
  progressionIdx: number,
  phraseLength: number,
  markovConfig: ReturnType<typeof getMoodMarkovConfig>,
): Array<number | null> {
  const freqs = scaleNotes.map((note) => note.freq);
  const chordToneIndices = getChordToneIndices(
    scaleNotes,
    CHORD_VOICINGS[progression[progressionIdx % progression.length]] || CHORD_VOICINGS.maj7,
  );
  const melody = generateMarkovMelody(rng, freqs, chordToneIndices, phraseLength, markovConfig);
  return melody.map((index) => (index >= 0 ? freqs[index] : null));
}

function getChordToneIndices(
  scaleNotes: { midi: number; freq: number }[],
  chordIntervals: number[],
): number[] {
  if (scaleNotes.length === 0) return [];

  const rootMidi = scaleNotes[0].midi;
  const center = (scaleNotes.length - 1) / 2;
  const intervalClasses = Array.from(new Set(chordIntervals.map((interval) => ((interval % 12) + 12) % 12)));
  const prioritized = intervalClasses.includes(0)
    ? [0, ...intervalClasses.filter((intervalClass) => intervalClass !== 0)]
    : intervalClasses;
  const indices: number[] = [];

  for (const intervalClass of prioritized) {
    const matches = scaleNotes
      .map((note, index) => ({ index, intervalClass: ((note.midi - rootMidi) % 12 + 12) % 12 }))
      .filter((note) => note.intervalClass === intervalClass)
      .sort((a, b) => Math.abs(a.index - center) - Math.abs(b.index - center))
      .map((note) => note.index);
    indices.push(...matches);
  }

  return indices.length > 0 ? indices : [Math.round(center)];
}

function applyOfflineVariation(freqs: number[], currentFreq: number, rng: SeededRNG): number {
  const idx = freqs.indexOf(currentFreq);
  if (idx < 0) return currentFreq;
  const roll = rng.next();
  if (roll < 0.3 && idx > 0) return freqs[idx - 1];
  if (roll < 0.6 && idx < freqs.length - 1) return freqs[idx + 1];
  return currentFreq;
}

// =============================================================================
// WAV encoding
// =============================================================================

function encodeWav(channels: Float32Array[], sampleRate: number): Buffer {
  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;  // PCM format
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * blockAlign, offset); offset += 4; // byte rate
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Interleave and write samples
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = sample < 0
        ? Math.max(-32768, Math.floor(sample * 32768))
        : Math.min(32767, Math.floor(sample * 32767));
      buffer.writeInt16LE(int16, offset);
      offset += 2;
    }
  }

  return buffer;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  try {
    const channels = await render();

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true });

    // Encode to WAV
    const wavBuffer = encodeWav(channels, SAMPLE_RATE);
    writeFileSync(outputPath, wavBuffer);

    const sizeMB = (wavBuffer.length / (1024 * 1024)).toFixed(1);
    console.log(`\n✅ Exported: ${outputPath} (${sizeMB} MB)`);
    console.log(`\nNext steps:`);
    console.log(`  # Analyze with built-in tool:`);
    console.log(`  python tools/analyze_audio.py --file "${outputPath}" --mood ${mood}`);
    console.log(`\n  # Generate spectrogram:`);
    console.log(`  python -c "import librosa,librosa.display,matplotlib.pyplot as plt; y,sr=librosa.load('${outputPath}'); S=librosa.feature.melspectrogram(y=y,sr=sr); librosa.display.specshow(librosa.power_to_db(S),sr=sr,x_axis='time',y_axis='mel'); plt.savefig('spectrogram.png',dpi=150); print('Saved spectrogram.png')"`);
    console.log(`\n  # Upload to GPT-4o for analysis:`);
    console.log(`  Upload ${outputPath} and ask: "Analyze frequency balance, beat quality, harshness"`);
  } catch (err) {
    console.error('Export failed:', err);
    process.exit(1);
  }
}

main();
