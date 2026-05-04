/**
 * @module patterns
 * @description Per-mood generative music pattern generators.
 *
 * Each generator manages its own scheduling loop and voice lifecycle. The
 * pattern system uses a look-ahead scheduler: every ~25ms a tick function
 * checks if events need to be scheduled in the near future and dispatches
 * them via the Web Audio API's sample-accurate timing.
 *
 * Four distinct sonic personalities:
 *
 * | Mood           | Codename    | Character                              |
 * |----------------|-------------|----------------------------------------|
 * | focus/deepWork | Steady      | Regular rhythm, melody motif, pad/bass |
 * | relax          | Drift       | Arpeggiated, irregular, no beat        |
 * | meditate       | Resonance   | Singing bowls, gong, drone             |
 * | sleep          | Dissolve    | 4-phase dissolution into silence       |
 *
 * All randomness flows through a {@link SeededRNG} instance so that given
 * the same seed, the identical session is reproduced.
 */

import { SeededRNG } from './rng.js';
import {
  buildScaleFrequencies,
  midiToFreq,
  MOOD_MUSIC_CONFIGS,
  MOOD_BPM_DEFAULTS,
  MOOD_CHORD_VOICINGS,
  CHORD_VOICINGS,
  BOWL_FUNDAMENTALS,
  MOOD_PROGRESSIONS,
  DRUM_PATTERNS,
  MOOD_SWING,
  type ScaleType,
  type DrumPattern,
  type ChordVoicing,
} from './scales.js';
import {
  generateMarkovMelody,
  getMoodMarkovConfig,
} from './markov.js';
import {
  playNote,
  playPad,
  playBowl,
  playGong,
  playBassPulse,
  playDrone,
  createLofiEffectsChain,
  createVinylCrackle,
  playSample,
} from './synthesis.js';
import {
  preloadDrumSamples,
  getRandomDrumSample,
  getRandomClosedHihat,
  getRandomOpenHihat,
} from './samples.js';

// =============================================================================
// Public types
// =============================================================================

/**
 * Configuration passed to the pattern generator when starting a session.
 */
export interface MusicPatternConfig {
  /** Active mood name (e.g. 'focus', 'sleep'). */
  mood: string;
  /** Integer seed for deterministic PRNG. */
  seed: number;
  /** Brainwave entrainment target frequency in Hz. */
  entrainmentHz: number;
  /** Total session duration in seconds. */
  sessionDurationS: number;
}

/**
 * Handle returned by {@link startMusicPattern} to control a running pattern.
 */
export interface ActivePattern {
  /** Stop the pattern, cancelling all scheduled events and releasing voices. */
  stop: () => void;
}

// =============================================================================
// Internal voice-handle types (matching synthesis.ts return shapes)
// =============================================================================

/** Anything that can be stopped (pads, drones). */
interface StoppableVoice {
  stop: () => void;
}

/** Drone voice with gain control. */
interface DroneVoice {
  stop: () => void;
  setGain: (g: number) => void;
}

// =============================================================================
// Minimum gain for exponentialRamp (must never be exactly zero)
// =============================================================================

const GAIN_EPSILON = 0.0001;

// =============================================================================
// Entry point
// =============================================================================

/**
 * Start the generative music pattern for the given mood.
 *
 * The returned handle's `stop()` method tears down all scheduled events,
 * active voices, and interval timers cleanly.
 *
 * @param ctx    - The active AudioContext.
 * @param output - The AudioNode to connect all generated audio to.
 * @param config - Session parameters (mood, seed, Hz, duration).
 * @returns A handle to stop the pattern.
 */
export function startMusicPattern(
  ctx: AudioContext,
  output: AudioNode,
  config: MusicPatternConfig,
): ActivePattern {
  const rng = new SeededRNG(config.seed);

  switch (config.mood) {
    case 'focus':
    case 'deepWork':
      return startNeuralPattern(ctx, output, config, rng);
    case 'relax':
      return startDriftPattern(ctx, output, config, rng);
    case 'meditate':
      return startResonancePattern(ctx, output, config, rng);
    case 'sleep':
      return startDissolvePattern(ctx, output, config, rng);
    default:
      return startNeuralPattern(ctx, output, config, rng);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Focus / DeepWork: "Neural" Pattern — Lo-fi Hip-Hop
//
// A lo-fi hip-hop beat generator producing warm, tape-saturated grooves:
//
//   - Boom-bap drum patterns with swing and velocity humanization
//   - Jazz chord progressions (ii-V-I, minor loops) cycling every 4 bars
//   - FM Rhodes-style melody routed through tape saturation + filtered delay
//   - Sub-bass pulses on beats 1 and 3
//   - Vinyl crackle atmosphere layer
//   - Full lo-fi effects chain: saturation → lowpass → reverb → delay
//
// BPM: 70-85 (focus) or 65-75 (deepWork) for that classic lo-fi tempo.
// Scheduling runs at 16th-note resolution for drum pattern accuracy.
// ═══════════════════════════════════════════════════════════════════════════════

function startNeuralPattern(
  ctx: AudioContext,
  output: AudioNode,
  config: MusicPatternConfig,
  rng: SeededRNG,
): ActivePattern {
  const mc = MOOD_MUSIC_CONFIGS[config.mood] || MOOD_MUSIC_CONFIGS.focus;

  // Randomize the key for this session (transpose root by 0-5 semitones)
  const transpose = rng.intRange(0, 5);
  const sessionRootMidi = mc.rootMidi + transpose;
  const scaleNotes = buildScaleFrequencies(sessionRootMidi, mc.scaleType, mc.lowMidi + transpose, mc.highMidi + transpose);
  const freqs = scaleNotes.map((n) => n.freq);

  const rootFreq = midiToFreq(sessionRootMidi);

  // --- Lo-fi BPM: mood-dependent Gaussian defaults for more natural tempo selection ---
  const bpmConfig = MOOD_BPM_DEFAULTS[config.mood] || MOOD_BPM_DEFAULTS.focus;
  const bpm = rng.gaussian(bpmConfig.minBpm, bpmConfig.maxBpm);
  const secondsPerBeat = 60 / bpm;

  // --- Create lo-fi effects chain ---
  const lofi = createLofiEffectsChain(ctx, {
    saturationDrive: 2.0,
    filterHz: config.mood === 'deepWork' ? 3000 : 4000,
    reverbDecayS: 2.0,
    reverbWetMix: 0.25,
    delayTimeMs: Math.round(secondsPerBeat * 750), // dotted 8th
    delayFeedback: 0.3,
    delayFilterHz: 2000,
  });
  lofi.output.connect(output);

  // --- Start vinyl crackle atmosphere ---
  const vinyl = createVinylCrackle(ctx, output, { gain: 0.02 });

  // --- Pick a chord progression for this session ---
  const progressions = MOOD_PROGRESSIONS[config.mood] || MOOD_PROGRESSIONS.focus;
  const progression = rng.pick(progressions);
  let progressionIdx = 0;

  // --- Pick a drum pattern ---
  const drumPatterns = DRUM_PATTERNS[config.mood] || [];
  const drumPattern: DrumPattern | null = drumPatterns.length > 0 ? rng.pick(drumPatterns) : null;
  const swing = MOOD_SWING[config.mood] || 0;
  const markovConfig = getMoodMarkovConfig(config.mood);

  // --- Preload drum samples for this session ---
  let drumSampleBuffers = new Map<string, AudioBuffer>();
  let drumSamplesLoaded = false;
  // Load samples in background (non-blocking)
  preloadDrumSamples(ctx)
    .then((buffers) => {
      drumSampleBuffers = buffers;
      drumSamplesLoaded = true;
    })
    .catch((err) => {
      console.warn('[ArgoBeat] Failed to preload drum samples:', err);
    });

  // --- Generate motif: 4 notes for focus, 3 for deepWork ---
  const motifLength = config.mood === 'deepWork' ? 3 : 4;
  let motif = generateNeuralMotif(rng, scaleNotes, progression, progressionIdx, motifLength, markovConfig);

  // Interval (in steps) at which a completely new motif is generated
  const motifRefreshSteps = rng.intRange(64, 128) * 4; // convert beats to steps

  // --- Velocity patterns for melody dynamics ---
  // Gentle — background music, not a concert
  const focusVelocities = [0.35, 0.25, 0.30, 0.20];
  const deepWorkVelocities = [0.30, 0.20, 0.25];

  // --- Melody beat positions within an 8-beat phrase (quarter notes) ---
  const melodyBeats = config.mood === 'deepWork' ? [0, 3, 6] : [0, 2, 4, 7];

  // --- 16th-note step scheduling ---
  const stepsPerBar = 16;
  const stepIntervalS = secondsPerBeat / 4; // 16th note duration
  const stepsPerChordChange = stepsPerBar * 4; // chord changes every 4 bars (64 steps)

  // --- State ---
  let stepCount = 0;
  let activePads: StoppableVoice[] = [];
  let intervalId: number | null = null;
  let stopped = false;

  // --- Start initial pad chord ---
  startChord();

  // --- Schedule 16th-note steps ---
  intervalId = window.setInterval(() => {
    if (stopped) return;

    const stepInBar = stepCount % stepsPerBar;
    const beatInPhrase = Math.floor(stepInBar / 4); // 0-3, which quarter note

    // === DRUMS: play samples every step ===
    if (drumPattern && drumSamplesLoaded) {
      // Velocity humanization: +/- 15%
      const humanize = () => 1.0 + (rng.next() - 0.5) * 0.3;

      // Swing: push every other 8th-note step late (steps 2,6,10,14)
      // (applied via timing offset concept — here we shift which step triggers)
      const _swingOffset = (stepInBar % 2 === 1) ? swing * stepIntervalS : 0;

      // All drums are very soft — background texture, not foregrounded
      if (drumPattern.kick[stepInBar] > 0) {
        // Pick a random kick sample and play it
        const kickSample = getRandomDrumSample('kick');
        const kickBuffer = drumSampleBuffers.get(kickSample.id);
        if (kickBuffer) {
          playSample(ctx, kickBuffer, lofi.input, {
            velocity: drumPattern.kick[stepInBar] * humanize() * 0.15,
            pitchSemitones: 0,
            filterHz: 100,
          });
        }
      }

      if (drumPattern.snare[stepInBar] > 0) {
        // Pick a random snare sample and play it
        const snareSample = getRandomDrumSample('snare');
        const snareBuffer = drumSampleBuffers.get(snareSample.id);
        if (snareBuffer) {
          playSample(ctx, snareBuffer, lofi.input, {
            velocity: drumPattern.snare[stepInBar] * humanize() * 0.08,
            pitchSemitones: 0,
            filterHz: 1500,
          });
        }
      }

      if (drumPattern.hihat[stepInBar] > 0) {
        // Closed hi-hat sample
        const hihatSample = getRandomClosedHihat();
        const hihatBuffer = drumSampleBuffers.get(hihatSample.id);
        if (hihatBuffer) {
          playSample(ctx, hihatBuffer, lofi.input, {
            velocity: drumPattern.hihat[stepInBar] * humanize() * 0.04,
            pitchSemitones: 0,
            filterHz: 2000,
          });
        }
      }

      if (drumPattern.openHat[stepInBar] > 0) {
        // Open hi-hat sample
        const openHatSample = getRandomOpenHihat();
        const openHatBuffer = drumSampleBuffers.get(openHatSample.id);
        if (openHatBuffer) {
          playSample(ctx, openHatBuffer, lofi.input, {
            velocity: drumPattern.openHat[stepInBar] * humanize() * 0.05,
            pitchSemitones: 0,
            filterHz: 1800,
          });
        }
      }
    }

    // === MELODY: on quarter-note boundaries (every 4th step) ===
    if (stepInBar % 4 === 0) {
      const phrasePosition = beatInPhrase + Math.floor((stepCount / stepsPerBar) % 2) * 4;

      if (melodyBeats.includes(phrasePosition % 8)) {
        const noteIdx = melodyBeats.indexOf(phrasePosition % 8) % motif.length;
        let freq = motif[noteIdx];

        // Micro-variation: every 4th phrase (128 steps) apply a variation
        if (typeof freq === 'number' && stepCount > 0 && stepCount % 128 === 0) {
          freq = applyNeuralVariation(rng, freqs, freq);
        }

        // Generate a completely new motif periodically
        if (stepCount > 0 && stepCount % motifRefreshSteps === 0) {
          motif = generateNeuralMotif(rng, scaleNotes, progression, progressionIdx, motifLength, markovConfig);
        }

        // 20% chance to skip a note for rhythmic interest
        if (typeof freq === 'number' && rng.next() >= 0.2) {
          const velocities = config.mood === 'deepWork' ? deepWorkVelocities : focusVelocities;
          const vel = velocities[noteIdx % velocities.length];

          // Melody through lo-fi chain (sounds like Rhodes through tape)
          playNote(ctx, freq, lofi.input, {
            velocity: vel,
            filterHz: mc.melodyFilterHz,
            durationS: secondsPerBeat * 0.8,
          });
        }
      }

      // 15% chance to add a passing tone on non-melody beats
      if (!melodyBeats.includes(phrasePosition % 8) && rng.next() < 0.15) {
        const passingFreq = rng.pick(freqs);
        playNote(ctx, passingFreq, lofi.input, {
          velocity: 0.4,
          filterHz: mc.melodyFilterHz * 0.7,
          durationS: secondsPerBeat * 0.4,
        });
      }
    }

    // === BASS: on beat 1 and beat 3 (steps 0 and 8) ===
    if (stepInBar === 0 || stepInBar === 8) {
      playBassPulse(ctx, rootFreq / 2, lofi.input, {
        velocity: 0.2,
        decayS: 0.6,
      });
    }

    // === CHORD CHANGE: every 4 bars (64 steps) ===
    if (stepCount > 0 && stepCount % stepsPerChordChange === 0) {
      progressionIdx++;
      motif = generateNeuralMotif(rng, scaleNotes, progression, progressionIdx, motifLength, markovConfig);
      changeChord();
    }

    stepCount++;
  }, stepIntervalS * 1000);

  // --- Chord helpers ---

  function startChord(): void {
    const voicingName = progression[progressionIdx % progression.length];
    const intervals = CHORD_VOICINGS[voicingName];
    for (const interval of intervals) {
      const freq = rootFreq * Math.pow(2, interval / 12);
      // Pads routed through lo-fi chain for warmth
      const pad = playPad(ctx, freq, lofi.input, {
        filterHz: mc.padFilterHz,
        gain: 0.12,
        attackS: 3,
        releaseS: 4,
      });
      activePads.push(pad);
    }
  }

  function changeChord(): void {
    for (const pad of activePads) pad.stop();
    activePads = [];
    startChord();
  }

  return {
    stop: () => {
      stopped = true;
      if (intervalId !== null) clearInterval(intervalId);
      for (const pad of activePads) pad.stop();
      activePads = [];
      vinyl.stop();
      lofi.destroy();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Relax: "Drift" Pattern
//
// No regular beat. Arpeggiated bell-like notes at irregular intervals,
// ascending then descending through chord tones. 5-10 seconds of silence
// between phrases. Very gentle, soft-attack tones over slow-moving pad
// chords that change every 45-90 seconds.
// ═══════════════════════════════════════════════════════════════════════════════

function startDriftPattern(
  ctx: AudioContext,
  output: AudioNode,
  config: MusicPatternConfig,
  rng: SeededRNG,
): ActivePattern {
  const mc = MOOD_MUSIC_CONFIGS.relax;

  // Randomize the key for this session (transpose root by 0-5 semitones)
  const transpose = rng.intRange(0, 5);
  const sessionRootMidi = mc.rootMidi + transpose;
  const scaleNotes = buildScaleFrequencies(sessionRootMidi, mc.scaleType, mc.lowMidi + transpose, mc.highMidi + transpose);
  const freqs = scaleNotes.map((n) => n.freq);
  const rootFreq = midiToFreq(sessionRootMidi);

  const voicings = [...(MOOD_CHORD_VOICINGS.relax || ['root5th'])];
  rng.shuffle(voicings);

  let stopped = false;
  let activePads: StoppableVoice[] = [];
  let currentChordIdx = 0;
  const timeoutIds: number[] = [];

  // --- Start a gentle pad that changes every 45-90 seconds ---
  startDriftPad();

  const padChangeIntervalMs = rng.intRange(45000, 90000);
  const padIntervalId = window.setInterval(() => {
    if (stopped) return;
    currentChordIdx = (currentChordIdx + 1) % voicings.length;
    changeDriftPad();
  }, padChangeIntervalMs);

  // --- Schedule the first arpeggio phrase ---
  schedulePhrase();

  // --- Arpeggio phrase scheduler ---

  function schedulePhrase(): void {
    if (stopped) return;

    // Decide phrase structure: 3-7 notes
    const phraseLength = rng.intRange(3, 7);

    // Choose a starting position in the scale
    const phraseRootIdx = rng.intRange(0, Math.max(0, freqs.length - 1));

    // Build arpeggio: ascending portion
    const ascending = rng.next() > 0.4;
    const arpeggioFreqs: number[] = [];

    for (let i = 0; i < phraseLength; i++) {
      let idx: number;
      if (ascending) {
        idx = Math.min(freqs.length - 1, phraseRootIdx + i);
      } else {
        idx = Math.max(0, phraseRootIdx - i);
      }
      arpeggioFreqs.push(freqs[idx]);
    }

    // For longer phrases, mirror back (ascending → descending or vice versa)
    if (phraseLength > 3) {
      for (let i = phraseLength - 2; i >= 1; i--) {
        let idx: number;
        if (ascending) {
          idx = Math.min(freqs.length - 1, phraseRootIdx + i);
        } else {
          idx = Math.max(0, phraseRootIdx - i);
        }
        arpeggioFreqs.push(freqs[idx]);
      }
    }

    // Schedule each note with irregular timing (2-5 seconds between notes)
    let offset = 0;
    for (let i = 0; i < arpeggioFreqs.length; i++) {
      const noteDelay = offset;
      const noteFreq = arpeggioFreqs[i];

      // Bell-like tone: gentle velocity, longer duration, soft filter
      const velocity = rng.floatRange(0.4, 0.7);
      const durationS = rng.floatRange(1.5, 3.5);
      const noteIntervalS = rng.floatRange(2, 5);

      const tid = window.setTimeout(() => {
        if (stopped) return;
        playNote(ctx, noteFreq, output, {
          velocity,
          filterHz: mc.melodyFilterHz,
          durationS,
          attackS: 0.08,  // softer attack for bell-like quality
          releaseS: 1.5,  // longer ring
        });
      }, noteDelay * 1000);
      timeoutIds.push(tid);

      offset += noteIntervalS;
    }

    // Silence between phrases: 5-10 seconds after the last note
    const silenceDurationS = rng.floatRange(5, 10);
    const nextPhraseDelayMs = (offset + silenceDurationS) * 1000;

    const nextTid = window.setTimeout(() => {
      schedulePhrase();
    }, nextPhraseDelayMs);
    timeoutIds.push(nextTid);
  }

  // --- Pad helpers ---

  function startDriftPad(): void {
    const voicingName = voicings[currentChordIdx];
    const intervals = CHORD_VOICINGS[voicingName];
    for (const interval of intervals) {
      const freq = rootFreq * Math.pow(2, interval / 12);
      const pad = playPad(ctx, freq, output, {
        filterHz: mc.padFilterHz,
        gain: 0.25,
        attackS: 5,
        releaseS: 5,
      });
      activePads.push(pad);
    }
  }

  function changeDriftPad(): void {
    for (const pad of activePads) pad.stop();
    activePads = [];
    startDriftPad();
  }

  return {
    stop: () => {
      stopped = true;
      clearInterval(padIntervalId);
      for (const tid of timeoutIds) clearTimeout(tid);
      timeoutIds.length = 0;
      for (const pad of activePads) pad.stop();
      activePads = [];
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Meditate: "Resonance" Pattern
//
// Extremely sparse: 1-3 events per minute. A continuous drone (root +
// perfect 5th) with a slow "breathing" volume oscillation. Singing bowl
// strikes every 15-45 seconds. Gong every 90-180 seconds (only for
// sessions longer than 10 minutes). The drone is felt more than heard.
// ═══════════════════════════════════════════════════════════════════════════════

function startResonancePattern(
  ctx: AudioContext,
  output: AudioNode,
  config: MusicPatternConfig,
  rng: SeededRNG,
): ActivePattern {
  const mc = MOOD_MUSIC_CONFIGS.meditate;

  // Randomize the drone root for this session (transpose by 0-5 semitones)
  const transpose = rng.intRange(0, 5);
  const sessionRootMidi = mc.rootMidi + transpose;
  const rootFreq = midiToFreq(sessionRootMidi);

  // Shuffle bowl fundamentals for this session so strikes vary per session
  const sessionBowls = [...BOWL_FUNDAMENTALS];
  rng.shuffle(sessionBowls);

  let stopped = false;
  const timeoutIds: number[] = [];
  const stoppableVoices: StoppableVoice[] = [];

  // --- Breathing gain node: modulates the drone's volume gently ---
  const breathGain = ctx.createGain();
  breathGain.gain.value = 1.0;
  breathGain.connect(output);

  const breathLfo = ctx.createOscillator();
  breathLfo.type = 'sine';
  const breathCycleS = rng.floatRange(8, 15);
  breathLfo.frequency.value = 1 / breathCycleS;

  // LFO output [-1, +1] scaled by 0.2 => gain oscillates between 0.8 and 1.2
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 0.2;
  breathLfo.connect(breathDepth);
  breathDepth.connect(breathGain.gain);

  breathLfo.start(ctx.currentTime);

  // --- Continuous drone: root + perfect 5th ---
  const droneRoot = playDrone(ctx, rootFreq, breathGain, {
    gain: 0.25,
    filterHz: mc.padFilterHz,
  });
  stoppableVoices.push(droneRoot);

  const fifthFreq = rootFreq * Math.pow(2, 7 / 12);
  const droneFifth = playDrone(ctx, fifthFreq, breathGain, {
    gain: 0.18,
    filterHz: mc.padFilterHz,
  });
  stoppableVoices.push(droneFifth);

  // --- Singing bowl strikes: every 15-45 seconds ---
  scheduleBowlStrike();

  function scheduleBowlStrike(): void {
    if (stopped) return;
    const delayS = rng.floatRange(15, 45);

    const tid = window.setTimeout(() => {
      if (stopped) return;

      // Pick a bowl fundamental from session-shuffled set
      const bowlFreq = rng.pick(sessionBowls);
      const velocity = rng.floatRange(0.5, 0.85);
      const decayScale = rng.floatRange(0.8, 1.3);

      playBowl(ctx, bowlFreq, output, { velocity, decayScale });

      scheduleBowlStrike();
    }, delayS * 1000);
    timeoutIds.push(tid);
  }

  // --- Gong strikes: every 90-180 seconds (sessions > 10 min only) ---
  if (config.sessionDurationS > 600) {
    scheduleGongStrike();
  }

  function scheduleGongStrike(): void {
    if (stopped) return;
    const delayS = rng.floatRange(90, 180);

    const tid = window.setTimeout(() => {
      if (stopped) return;

      const velocity = rng.floatRange(0.4, 0.7);
      playGong(ctx, rootFreq, output, { velocity, decayS: 14 });

      scheduleGongStrike();
    }, delayS * 1000);
    timeoutIds.push(tid);
  }

  return {
    stop: () => {
      stopped = true;
      for (const tid of timeoutIds) clearTimeout(tid);
      timeoutIds.length = 0;
      for (const voice of stoppableVoices) voice.stop();
      stoppableVoices.length = 0;

      try { breathLfo.stop(); } catch { /* already stopped */ }
      try { breathLfo.disconnect(); } catch { /* already disconnected */ }
      try { breathDepth.disconnect(); } catch { /* already disconnected */ }
      try { breathGain.disconnect(); } catch { /* already disconnected */ }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sleep: "Dissolve" Pattern
//
// Progressive dissolution across four phases:
//
//   Twilight  (0-20%)  — Sparse whole-tone notes descending in register,
//                        soft pad chord beneath. Gentle, lullaby-like.
//
//   Descent   (20-50%) — Melody stops. Pad simplifies to fewer notes.
//                        Filter cutoff closes progressively. Volume drops.
//
//   Deep      (50-80%) — Pad fades to a single-note drone. Volume becomes
//                        nearly inaudible. Filter is very low.
//
//   Silence   (80-100%) — All sound fades to zero. Session ends silently.
//
// The dissolve is managed by a dedicated GainNode whose value is driven
// by the phase tick loop.
// ═══════════════════════════════════════════════════════════════════════════════

function startDissolvePattern(
  ctx: AudioContext,
  output: AudioNode,
  config: MusicPatternConfig,
  rng: SeededRNG,
): ActivePattern {
  const mc = MOOD_MUSIC_CONFIGS.sleep;

  // Randomize the key for this session (transpose root by 0-5 semitones)
  const transpose = rng.intRange(0, 5);
  const sessionRootMidi = mc.rootMidi + transpose;
  const scaleNotes = buildScaleFrequencies(sessionRootMidi, mc.scaleType, mc.lowMidi + transpose, mc.highMidi + transpose);
  const freqs = scaleNotes.map((n) => n.freq);
  const rootFreq = midiToFreq(sessionRootMidi);

  const voicings = [...(MOOD_CHORD_VOICINGS.sleep || ['rootMaj7', 'rootOctave'])];
  rng.shuffle(voicings);

  let stopped = false;
  const timeoutIds: number[] = [];
  let activePads: StoppableVoice[] = [];
  let activeDrone: DroneVoice | null = null;
  let tickIntervalId: number | null = null;
  let chordChangeId: number | null = null;
  let droneTransitioned = false;

  const startTime = ctx.currentTime;
  const totalDurationS = config.sessionDurationS;

  // Master envelope for the dissolve progression
  const dissolveGain = ctx.createGain();
  dissolveGain.gain.value = 1.0;
  dissolveGain.connect(output);

  // --- Phase 1: Twilight — start pad and melody ---
  let currentChordIdx = 0;
  let currentPadFilterHz = mc.padFilterHz;
  startDissolvePad(currentPadFilterHz);
  scheduleTwilightMelody();

  // --- Chord change every ~30 seconds during Twilight/Descent ---
  chordChangeId = window.setInterval(() => {
    if (stopped) return;
    const elapsed = ctx.currentTime - startTime;
    const progress = elapsed / totalDurationS;

    // Stop changing chords once we enter the Deep phase
    if (progress > 0.5) return;

    currentChordIdx = (currentChordIdx + 1) % voicings.length;

    // Progressively lower the filter during Descent
    const descentFactor = progress > 0.2
      ? (progress - 0.2) / 0.3
      : 0;
    currentPadFilterHz = mc.padFilterHz * (1.0 - descentFactor * 0.5);

    for (const pad of activePads) pad.stop();
    activePads = [];
    startDissolvePad(currentPadFilterHz);
  }, 30000);

  // --- Phase evolution tick (every 500ms for smooth transitions) ---
  tickIntervalId = window.setInterval(() => {
    if (stopped) return;

    const elapsed = ctx.currentTime - startTime;
    const progress = Math.min(1, elapsed / totalDurationS);
    const now = ctx.currentTime;

    if (progress < 0.2) {
      // Twilight: full presence
      dissolveGain.gain.setTargetAtTime(1.0, now, 0.5);
    } else if (progress < 0.5) {
      // Descent: volume fading from 1.0 to 0.6, filter closing
      const descentProgress = (progress - 0.2) / 0.3;
      const volume = 1.0 - descentProgress * 0.4;
      dissolveGain.gain.setTargetAtTime(volume, now, 0.5);
    } else if (progress < 0.8) {
      // Deep: very quiet
      const deepProgress = (progress - 0.5) / 0.3;
      const volume = 0.6 - deepProgress * 0.45; // 0.6 -> 0.15
      dissolveGain.gain.setTargetAtTime(Math.max(GAIN_EPSILON, volume), now, 0.5);

      // Transition from pad to drone at the start of Deep phase
      if (!droneTransitioned) {
        droneTransitioned = true;
        transitionToDrone();
      }
    } else {
      // Silence: fade to zero
      const silenceProgress = (progress - 0.8) / 0.2;
      const volume = Math.max(GAIN_EPSILON, 0.15 * (1.0 - silenceProgress));
      dissolveGain.gain.setTargetAtTime(volume, now, 0.5);

      // Fade the drone down to nothing
      if (activeDrone) {
        activeDrone.setGain(Math.max(0.001, 0.04 * (1.0 - silenceProgress)));
      }
    }
  }, 500);

  // --- Twilight melody: sparse descending notes ---

  function scheduleTwilightMelody(): void {
    if (stopped) return;

    const elapsed = ctx.currentTime - startTime;
    const progress = elapsed / totalDurationS;

    // Only play melody in Twilight (0-20%) and early Descent (20-30%)
    if (progress > 0.3) return;

    // Pick a note biased toward upper range, descending over time
    const progressInMelodyPhase = Math.min(1, progress / 0.3);
    const upperBound = Math.floor(freqs.length * (1.0 - progressInMelodyPhase * 0.6));
    const lowerBound = Math.max(0, upperBound - Math.floor(freqs.length * 0.4));
    const safeUpper = Math.max(lowerBound, upperBound - 1);
    const noteIdx = rng.intRange(lowerBound, safeUpper);
    const freq = freqs[Math.min(noteIdx, freqs.length - 1)];

    // Velocity decreases as we approach the Descent phase
    const velocity = rng.floatRange(0.35, 0.6) * (1.0 - progressInMelodyPhase * 0.5);
    const durationS = rng.floatRange(2, 5);

    if (velocity > 0.02) {
      playNote(ctx, freq, dissolveGain, {
        velocity,
        filterHz: mc.melodyFilterHz * (1.0 - progressInMelodyPhase * 0.3),
        durationS,
        attackS: 0.05,
        releaseS: 1.5,
      });
    }

    // Next note: 3-8 seconds apart, getting sparser over time
    const baseIntervalS = rng.floatRange(3, 8);
    const sparsityMultiplier = 1.0 + progressInMelodyPhase * 2.0;
    const nextDelayMs = baseIntervalS * sparsityMultiplier * 1000;

    const tid = window.setTimeout(() => {
      scheduleTwilightMelody();
    }, nextDelayMs);
    timeoutIds.push(tid);
  }

  // --- Pad helpers ---

  function startDissolvePad(filterHz: number): void {
    const voicingName = voicings[currentChordIdx % voicings.length];
    const intervals = CHORD_VOICINGS[voicingName];
    for (const interval of intervals) {
      const freq = rootFreq * Math.pow(2, interval / 12);
      const pad = playPad(ctx, freq, dissolveGain, {
        filterHz,
        gain: 0.3,
        attackS: 5,
        releaseS: 5,
      });
      activePads.push(pad);
    }
  }

  function transitionToDrone(): void {
    // Fade out remaining pads
    for (const pad of activePads) pad.stop();
    activePads = [];

    // Stop chord changes
    if (chordChangeId !== null) {
      clearInterval(chordChangeId);
      chordChangeId = null;
    }

    // Start a very gentle drone at root with extremely low filter
    activeDrone = playDrone(ctx, rootFreq, dissolveGain, {
      gain: 0.2,
      filterHz: mc.padFilterHz * 0.3,
      attackS: 8,
    });
  }

  return {
    stop: () => {
      stopped = true;
      if (tickIntervalId !== null) clearInterval(tickIntervalId);
      if (chordChangeId !== null) clearInterval(chordChangeId);
      for (const tid of timeoutIds) clearTimeout(tid);
      timeoutIds.length = 0;
      for (const pad of activePads) pad.stop();
      activePads = [];
      if (activeDrone) {
        activeDrone.stop();
        activeDrone = null;
      }
      try { dissolveGain.disconnect(); } catch { /* already disconnected */ }
    },
  };
}

// =============================================================================
// Shared helpers
// =============================================================================

function generateNeuralMotif(
  rng: SeededRNG,
  scaleNotes: { midi: number; freq: number }[],
  progression: ChordVoicing[],
  progressionIdx: number,
  length: number,
  markovConfig: ReturnType<typeof getMoodMarkovConfig>,
): Array<number | null> {
  const freqs = scaleNotes.map((note) => note.freq);
  const voicingName = progression[progressionIdx % progression.length];
  const chordToneIndices = getChordToneIndices(scaleNotes, CHORD_VOICINGS[voicingName] || []);
  const melody = generateMarkovMelody(rng, freqs, chordToneIndices, length, markovConfig);
  return melody.map((index) => (index >= 0 ? freqs[index] : null));
}

function getChordToneIndices(
  scaleNotes: { midi: number; freq: number }[],
  chordIntervals: number[],
): number[] {
  if (scaleNotes.length === 0) return [];

  const center = (scaleNotes.length - 1) / 2;
  const intervalClasses = Array.from(new Set(chordIntervals.map((interval) => ((interval % 12) + 12) % 12)));
  const prioritizedClasses = intervalClasses.includes(0)
    ? [0, ...intervalClasses.filter((intervalClass) => intervalClass !== 0)]
    : intervalClasses;
  const indices: number[] = [];

  for (const intervalClass of prioritizedClasses) {
    const matches = scaleNotes
      .map((note, index) => ({ index, midiClass: ((note.midi - scaleNotes[0].midi) % 12 + 12) % 12 }))
      .filter((note) => note.midiClass === intervalClass)
      .sort((a, b) => Math.abs(a.index - center) - Math.abs(b.index - center))
      .map((note) => note.index);
    indices.push(...matches);
  }

  if (indices.length > 0) return indices;

  return [Math.round(center)];
}

/**
 * Apply a micro-variation to a single note in the Neural pattern.
 *
 * Probabilities:
 *   30% shift to adjacent scale degree below
 *   30% shift to adjacent scale degree above
 *   40% no change (preserve the motif)
 *
 * @param rng         - Seeded PRNG.
 * @param freqs       - Full scale frequency array.
 * @param currentFreq - The frequency to potentially vary.
 * @returns The (possibly shifted) frequency.
 */
function applyNeuralVariation(
  rng: SeededRNG,
  freqs: number[],
  currentFreq: number,
): number {
  const roll = rng.next();
  const idx = freqs.indexOf(currentFreq);
  if (idx < 0) return currentFreq;

  if (roll < 0.3 && idx > 0) {
    return freqs[idx - 1]; // shift down one scale degree
  }
  if (roll < 0.6 && idx < freqs.length - 1) {
    return freqs[idx + 1]; // shift up one scale degree
  }
  return currentFreq; // no change
}
