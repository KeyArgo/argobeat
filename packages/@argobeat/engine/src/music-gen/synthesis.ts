/**
 * @module synthesis
 * Lo-fi Web Audio synthesis voices for ArgoBeat's generative music engine.
 *
 * Produces warm, lo-fi quality audio using FM synthesis (DX7-style Rhodes),
 * tape saturation, procedural reverb, filtered delay, and vinyl crackle.
 *
 * Each function creates oscillators/filters/gains, connects them to the
 * provided destination, schedules envelopes, and self-cleans via onended.
 */

const GAIN_EPSILON = 0.0001;

// =============================================================================
// Option types (unchanged — patterns.ts depends on these)
// =============================================================================

export interface NoteOptions {
  velocity: number;
  filterHz: number;
  durationS: number;
  attackS?: number;
  releaseS?: number;
}

export interface PadOptions {
  filterHz: number;
  gain: number;
  attackS: number;
  releaseS: number;
}

export interface BowlOptions {
  velocity: number;
  decayScale: number;
}

export interface GongOptions {
  velocity: number;
  decayS: number;
}

export interface BassPulseOptions {
  velocity: number;
  decayS: number;
}

export interface DroneOptions {
  gain: number;
  filterHz: number;
  attackS?: number;
}

// =============================================================================
// Voice handle types (unchanged — patterns.ts depends on these)
// =============================================================================

export interface StoppableVoice {
  stop: () => void;
}

export interface DroneVoice {
  stop: () => void;
  setGain: (g: number) => void;
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Build a Float32Array waveshaper curve for tanh-style tape saturation.
 * drive controls the steepness of the tanh — higher = more harmonics.
 */
function buildTanhCurve(drive: number, samples = 8192): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    // Map i to [-1, 1]
    const x = (2 * i) / (samples - 1) - 1;
    curve[i] = Math.tanh(drive * x);
  }
  return curve as Float32Array<ArrayBuffer>;
}

/**
 * Create a procedural impulse response for convolution reverb.
 *
 * Generates stereo exponentially-decaying white noise with a 200Hz highpass
 * baked in (via simple one-pole filter on the noise). This produces a warm
 * reverb that avoids low-end mud.
 */
function buildReverbIR(
  ctx: AudioContext,
  decayS: number,
  sampleRate: number,
): AudioBuffer {
  const length = Math.ceil(sampleRate * decayS);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    // Simple one-pole highpass state (fc ~ 200Hz)
    const rc = 1 / (2 * Math.PI * 200);
    const dt = 1 / sampleRate;
    const alpha = rc / (rc + dt);
    let prevIn = 0;
    let prevOut = 0;

    for (let i = 0; i < length; i++) {
      // White noise shaped by exponential decay
      const noise = (Math.random() * 2 - 1) * Math.exp(-3 * i / length);
      // One-pole highpass: y[n] = alpha * (y[n-1] + x[n] - x[n-1])
      const filtered = alpha * (prevOut + noise - prevIn);
      prevIn = noise;
      prevOut = filtered;
      data[i] = filtered;
    }
  }

  return buffer;
}

// =============================================================================
// Synthesis functions
// =============================================================================

/**
 * Play a single melodic note using FM synthesis for a DX7 Rhodes-like tone.
 *
 * Two carrier-modulator pairs:
 * - Body pair: 1:1 ratio, mod index ~2.0 decaying to ~0.5 over 2s
 * - Bell pair: 14:1 ratio, mod index ~4.0 with fast 150ms decay (iconic attack)
 *
 * Signal chain:
 *   mod1 -> car1.frequency (body)
 *   mod3 -> car3.frequency (bell)
 *   car1 (0.6) + car3 (0.4) -> mixGain -> envGain -> filter -> dest
 */
export function playNote(
  ctx: AudioContext,
  freq: number,
  dest: AudioNode,
  opts: NoteOptions,
): void {
  const now = ctx.currentTime;
  const attack = opts.attackS ?? 0.06; // Softer attack to avoid pops
  const release = opts.releaseS ?? 0.5;
  const sustain = opts.durationS - attack;
  const endTime = now + opts.durationS + release;

  // For high frequencies (>1500 Hz, used for drum simulation), skip FM
  // synthesis entirely — use a simple filtered oscillator instead.
  // FM's 14:1 ratio would exceed the 24kHz oscillator limit.
  if (freq > 1500) {
    const osc = ctx.createOscillator();
    osc.type = 'sine'; // Sine for all high-freq — square/triangle are too harsh
    osc.frequency.value = Math.min(freq, 20000);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(opts.filterHz, 20000);
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(GAIN_EPSILON, now);
    gain.gain.linearRampToValueAtTime(opts.velocity, now + attack);
    gain.gain.setValueAtTime(opts.velocity, now + attack + Math.max(sustain, 0));
    gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, endTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(endTime + 0.1);

    osc.onended = () => {
      try { osc.disconnect(); } catch { /* noop */ }
      try { filter.disconnect(); } catch { /* noop */ }
      try { gain.disconnect(); } catch { /* noop */ }
    };
    return;
  }

  // --- Body pair: carrier + modulator at 1:1 ratio ---

  // Modulator 1: sine at note frequency, modulation index decays from 2.0 to 0.5
  const mod1 = ctx.createOscillator();
  mod1.type = 'sine';
  mod1.frequency.value = freq;

  const mod1Gain = ctx.createGain();
  // Modulation depth = mod_index * mod_freq
  // Index 0.4 at start, decaying to 0.1 over 2 seconds (warm, not metallic)
  const mod1DepthStart = 0.4 * freq;
  const mod1DepthEnd = 0.1 * freq;
  mod1Gain.gain.setValueAtTime(mod1DepthStart, now);
  mod1Gain.gain.exponentialRampToValueAtTime(mod1DepthEnd, now + 2.0);

  // Carrier 1: the body tone
  const car1 = ctx.createOscillator();
  car1.type = 'sine';
  car1.frequency.value = freq;

  // Wire modulator into carrier frequency
  mod1.connect(mod1Gain);
  mod1Gain.connect(car1.frequency);

  const bodyGain = ctx.createGain();
  bodyGain.gain.value = 0.8; // body dominant
  car1.connect(bodyGain);

  // --- Bell pair: carrier + modulator at 14:1 ratio (bell attack) ---

  // Modulator 3: sine at freq * 14, mod index 4.0 with fast 150ms decay
  const mod3 = ctx.createOscillator();
  mod3.type = 'sine';
  mod3.frequency.value = freq * 14;

  const mod3Gain = ctx.createGain();
  const mod3DepthStart = 0.5 * freq; // very subtle bell shimmer
  mod3Gain.gain.setValueAtTime(mod3DepthStart, now);
  mod3Gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, now + 0.06);

  // Carrier 3: the bell tone
  const car3 = ctx.createOscillator();
  car3.type = 'sine';
  car3.frequency.value = freq;

  mod3.connect(mod3Gain);
  mod3Gain.connect(car3.frequency);

  const bellGain = ctx.createGain();
  bellGain.gain.value = 0.06; // very quiet bell shimmer
  car3.connect(bellGain);

  // --- Mix body + bell ---
  const mixGain = ctx.createGain();
  mixGain.gain.value = 1.0;
  bodyGain.connect(mixGain);
  bellGain.connect(mixGain);

  // --- ADSR envelope ---
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(GAIN_EPSILON, now);
  envGain.gain.linearRampToValueAtTime(opts.velocity, now + attack);
  envGain.gain.setValueAtTime(opts.velocity, now + attack + Math.max(sustain, 0));
  envGain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, endTime);

  // --- Lowpass filter for warmth ---
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = opts.filterHz;
  filter.Q.value = 0.7;

  // --- Connect signal chain ---
  mixGain.connect(envGain);
  envGain.connect(filter);
  filter.connect(dest);

  // --- Start and stop all oscillators ---
  const stopTime = endTime + 0.1;
  mod1.start(now);
  car1.start(now);
  mod3.start(now);
  car3.start(now);
  mod1.stop(stopTime);
  car1.stop(stopTime);
  mod3.stop(stopTime);
  car3.stop(stopTime);

  // --- Self-cleanup on the last oscillator to stop ---
  car1.onended = () => {
    try { mod1.disconnect(); } catch { /* noop */ }
    try { mod1Gain.disconnect(); } catch { /* noop */ }
    try { car1.disconnect(); } catch { /* noop */ }
    try { bodyGain.disconnect(); } catch { /* noop */ }
    try { mod3.disconnect(); } catch { /* noop */ }
    try { mod3Gain.disconnect(); } catch { /* noop */ }
    try { car3.disconnect(); } catch { /* noop */ }
    try { bellGain.disconnect(); } catch { /* noop */ }
    try { mixGain.disconnect(); } catch { /* noop */ }
    try { envGain.disconnect(); } catch { /* noop */ }
    try { filter.disconnect(); } catch { /* noop */ }
  };
}

/**
 * Play a sustained pad — two detuned triangle oscillators through lowpass
 * with tape saturation for analog warmth.
 * Returns a handle to stop it with a fade-out.
 */
export function playPad(
  ctx: AudioContext,
  freq: number,
  dest: AudioNode,
  opts: PadOptions,
): StoppableVoice {
  const now = ctx.currentTime;

  // Two detuned oscillators for chorus effect
  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.value = freq;

  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = freq * 1.003; // ~5 cents sharp = slow beating

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = opts.filterHz;
  filter.Q.value = 0.5;

  // Very mild tape saturation for harmonic warmth
  const saturator = ctx.createWaveShaper();
  saturator.curve = buildTanhCurve(0.8); // Gentler than before
  saturator.oversample = '4x';

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(GAIN_EPSILON, now);
  gain.gain.linearRampToValueAtTime(opts.gain, now + opts.attackS);

  // Signal chain: oscs -> filter -> saturator -> gain -> dest
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(saturator);
  saturator.connect(gain);
  gain.connect(dest);

  osc1.start(now);
  osc2.start(now);

  let stopped = false;

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, t + opts.releaseS);

      setTimeout(() => {
        try { osc1.stop(); } catch { /* noop */ }
        try { osc2.stop(); } catch { /* noop */ }
        try { osc1.disconnect(); } catch { /* noop */ }
        try { osc2.disconnect(); } catch { /* noop */ }
        try { filter.disconnect(); } catch { /* noop */ }
        try { saturator.disconnect(); } catch { /* noop */ }
        try { gain.disconnect(); } catch { /* noop */ }
      }, (opts.releaseS + 0.2) * 1000);
    },
  };
}

/**
 * Singing bowl strike — 5 inharmonic partials with independent exponential decays.
 * Real Tibetan bowl harmonic ratios from spectral analysis.
 * Kept as-is: already produces an organic, lo-fi-compatible timbre.
 */
export function playBowl(
  ctx: AudioContext,
  freq: number,
  dest: AudioNode,
  opts: BowlOptions,
): void {
  const now = ctx.currentTime;

  // Real bowl partial ratios (inharmonic — this creates the shimmer)
  const ratios = [1.0, 2.71, 5.04, 8.09, 11.79];
  const amps = [1.0, 0.6, 0.35, 0.15, 0.08];
  const decays = [8.0, 6.0, 4.0, 2.5, 1.5];

  const mixGain = ctx.createGain();
  mixGain.gain.value = opts.velocity * 0.7;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3000;
  filter.Q.value = 0.3;

  mixGain.connect(filter);
  filter.connect(dest);

  for (let i = 0; i < ratios.length; i++) {
    const partialFreq = freq * ratios[i];
    if (partialFreq > 10000) continue; // skip inaudibly high partials

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = partialFreq;

    const partialGain = ctx.createGain();
    const decayTime = decays[i] * opts.decayScale;

    // Strike envelope: instant attack, exponential decay
    partialGain.gain.setValueAtTime(amps[i], now);
    partialGain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, now + decayTime);

    osc.connect(partialGain);
    partialGain.connect(mixGain);

    osc.start(now);
    osc.stop(now + decayTime + 0.1);

    osc.onended = () => {
      try { osc.disconnect(); } catch { /* noop */ }
      try { partialGain.disconnect(); } catch { /* noop */ }
    };
  }

  // Clean up mix node after longest decay
  const maxDecay = decays[0] * opts.decayScale;
  setTimeout(() => {
    try { mixGain.disconnect(); } catch { /* noop */ }
    try { filter.disconnect(); } catch { /* noop */ }
  }, (maxDecay + 0.5) * 1000);
}

/**
 * Gong strike — low sine fundamental + filtered noise burst with long decay.
 * Kept as-is: already produces a rich, organic timbre.
 */
export function playGong(
  ctx: AudioContext,
  freq: number,
  dest: AudioNode,
  opts: GongOptions,
): void {
  const now = ctx.currentTime;

  const mixGain = ctx.createGain();
  mixGain.gain.value = opts.velocity * 0.6;
  mixGain.connect(dest);

  // Sine fundamental with long decay
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.8, now);
  oscGain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, now + opts.decayS);

  osc.connect(oscGain);
  oscGain.connect(mixGain);
  osc.start(now);
  osc.stop(now + opts.decayS + 0.1);

  // Second harmonic for richness
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2.76; // inharmonic ratio

  const osc2Gain = ctx.createGain();
  osc2Gain.gain.setValueAtTime(0.3, now);
  osc2Gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, now + opts.decayS * 0.6);

  osc2.connect(osc2Gain);
  osc2Gain.connect(mixGain);
  osc2.start(now);
  osc2.stop(now + opts.decayS * 0.6 + 0.1);

  // Noise burst for the initial "hit" texture
  const bufferSize = ctx.sampleRate * 0.5;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = freq * 1.5;
  noiseFilter.Q.value = 2;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, now + 0.3);

  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(mixGain);
  noiseSrc.start(now);

  // Cleanup
  osc.onended = () => {
    try { osc.disconnect(); } catch { /* noop */ }
    try { oscGain.disconnect(); } catch { /* noop */ }
  };
  osc2.onended = () => {
    try { osc2.disconnect(); } catch { /* noop */ }
    try { osc2Gain.disconnect(); } catch { /* noop */ }
  };

  setTimeout(() => {
    try { mixGain.disconnect(); } catch { /* noop */ }
    try { noiseFilter.disconnect(); } catch { /* noop */ }
    try { noiseGain.disconnect(); } catch { /* noop */ }
  }, (opts.decayS + 1) * 1000);
}

/**
 * Sub-bass pulse — low sine with fast attack, medium decay, and slight
 * tape saturation for harmonic warmth and presence.
 */
export function playBassPulse(
  ctx: AudioContext,
  freq: number,
  dest: AudioNode,
  opts: BassPulseOptions,
): void {
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;
  filter.Q.value = 0.5;

  // Mild tape saturation to add even harmonics and warmth
  const saturator = ctx.createWaveShaper();
  saturator.curve = buildTanhCurve(1.1);
  saturator.oversample = '4x';

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(GAIN_EPSILON, now);
  gain.gain.linearRampToValueAtTime(opts.velocity, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, now + opts.decayS);

  // Signal chain: osc -> filter -> saturator -> gain -> dest
  osc.connect(filter);
  filter.connect(saturator);
  saturator.connect(gain);
  gain.connect(dest);

  osc.start(now);
  osc.stop(now + opts.decayS + 0.1);

  osc.onended = () => {
    try { osc.disconnect(); } catch { /* noop */ }
    try { filter.disconnect(); } catch { /* noop */ }
    try { saturator.disconnect(); } catch { /* noop */ }
    try { gain.disconnect(); } catch { /* noop */ }
  };
}

/**
 * Continuous drone — root + perfect fifth, filtered, with slow LFO
 * "breathing" on gain and a second LFO modulating the filter cutoff
 * for organic, evolving movement.
 *
 * Returns a handle to stop and adjust gain.
 */
export function playDrone(
  ctx: AudioContext,
  freq: number,
  dest: AudioNode,
  opts: DroneOptions,
): DroneVoice {
  const now = ctx.currentTime;
  const attack = opts.attackS ?? 8;

  // Root oscillator
  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.value = freq;

  // Perfect fifth (3:2 ratio)
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 1.5;

  const osc2Gain = ctx.createGain();
  osc2Gain.gain.value = 0.3; // fifth is quieter than root

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = opts.filterHz;
  filter.Q.value = 0.5;

  const mainGain = ctx.createGain();
  mainGain.gain.setValueAtTime(GAIN_EPSILON, now);
  mainGain.gain.linearRampToValueAtTime(opts.gain, now + attack);

  // Slow breathing LFO on gain (12-second cycle)
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 1 / 12;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = opts.gain * 0.05; // +/- 5% volume variation (barely perceptible)

  lfo.connect(lfoGain);
  lfoGain.connect(mainGain.gain);

  // Slow filter cutoff LFO for organic movement (0.1Hz, +/- 100Hz)
  const filterLfo = ctx.createOscillator();
  filterLfo.type = 'sine';
  filterLfo.frequency.value = 0.1;

  const filterLfoGain = ctx.createGain();
  filterLfoGain.gain.value = 100; // +/- 100Hz modulation depth

  filterLfo.connect(filterLfoGain);
  filterLfoGain.connect(filter.frequency);

  // Wire the audio graph
  osc1.connect(filter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  filter.connect(mainGain);
  mainGain.connect(dest);

  osc1.start(now);
  osc2.start(now);
  lfo.start(now);
  filterLfo.start(now);

  let stopped = false;

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      mainGain.gain.cancelScheduledValues(t);
      mainGain.gain.setValueAtTime(mainGain.gain.value, t);
      mainGain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, t + 3);

      setTimeout(() => {
        try { osc1.stop(); } catch { /* noop */ }
        try { osc2.stop(); } catch { /* noop */ }
        try { lfo.stop(); } catch { /* noop */ }
        try { filterLfo.stop(); } catch { /* noop */ }
        try { osc1.disconnect(); } catch { /* noop */ }
        try { osc2.disconnect(); } catch { /* noop */ }
        try { osc2Gain.disconnect(); } catch { /* noop */ }
        try { lfo.disconnect(); } catch { /* noop */ }
        try { lfoGain.disconnect(); } catch { /* noop */ }
        try { filterLfo.disconnect(); } catch { /* noop */ }
        try { filterLfoGain.disconnect(); } catch { /* noop */ }
        try { filter.disconnect(); } catch { /* noop */ }
        try { mainGain.disconnect(); } catch { /* noop */ }
      }, 3500);
    },
    setGain(g: number) {
      if (stopped) return;
      const t = ctx.currentTime;
      mainGain.gain.cancelScheduledValues(t);
      mainGain.gain.setValueAtTime(mainGain.gain.value, t);
      mainGain.gain.linearRampToValueAtTime(g, t + 2);
    },
  };
}

// =============================================================================
// New lo-fi utility functions
// =============================================================================

/**
 * Create a lo-fi master effects chain: saturation -> lowpass -> reverb -> delay.
 *
 * Returns { input, output } GainNodes to wire inline between your source and
 * destination. Call destroy() when done to free the ConvolverNode buffer and
 * disconnect all internal nodes.
 *
 * Signal flow:
 *   input -> saturator -> lpFilter -> [dry + convolver*wet] -> [dry + delay*feedback] -> output
 */
export function createLofiEffectsChain(
  ctx: AudioContext,
  opts: {
    saturationDrive?: number;
    filterHz?: number;
    reverbDecayS?: number;
    reverbWetMix?: number;
    delayTimeMs?: number;
    delayFeedback?: number;
    delayFilterHz?: number;
  } = {},
): { input: GainNode; output: GainNode; destroy: () => void } {
  const drive = opts.saturationDrive ?? 1.3; // Gentle warmth, not aggressive
  const filterHz = opts.filterHz ?? 2800;   // Lower cutoff = warmer, less harsh
  const reverbDecayS = opts.reverbDecayS ?? 2.0;
  const reverbWet = opts.reverbWetMix ?? 0.25;
  const delayTimeMs = opts.delayTimeMs ?? 375;
  const delayFeedback = opts.delayFeedback ?? 0.3;
  const delayFilterHz = opts.delayFilterHz ?? 2000;

  // --- Input gain node (entry point) ---
  const input = ctx.createGain();
  input.gain.value = 1.0;

  // --- Tape saturation ---
  const saturator = ctx.createWaveShaper();
  saturator.curve = buildTanhCurve(drive);
  saturator.oversample = '4x';

  // --- Lowpass filter (lo-fi bandwidth limiting) ---
  const lpFilter = ctx.createBiquadFilter();
  lpFilter.type = 'lowpass';
  lpFilter.frequency.value = filterHz;
  lpFilter.Q.value = 0.7;

  // --- Reverb (convolution with procedural IR) ---
  const reverbIR = buildReverbIR(ctx, reverbDecayS, ctx.sampleRate);
  const convolver = ctx.createConvolver();
  convolver.buffer = reverbIR;

  // Dry/wet mix for reverb
  const reverbDry = ctx.createGain();
  reverbDry.gain.value = 1.0 - reverbWet;

  const reverbWetGain = ctx.createGain();
  reverbWetGain.gain.value = reverbWet;

  // Post-reverb summing point
  const reverbMix = ctx.createGain();
  reverbMix.gain.value = 1.0;

  // --- Delay with filtered feedback ---
  const delay = ctx.createDelay(2.0);
  delay.delayTime.value = delayTimeMs / 1000;

  const feedbackGain = ctx.createGain();
  feedbackGain.gain.value = delayFeedback;

  // Lowpass in the feedback loop: each repeat gets darker
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = delayFilterHz;
  delayFilter.Q.value = 0.5;

  // Delay dry + wet summing
  const delayDry = ctx.createGain();
  delayDry.gain.value = 1.0;

  const delayWet = ctx.createGain();
  delayWet.gain.value = 0.5; // delay wet level

  // --- Output gain node (exit point) ---
  const output = ctx.createGain();
  output.gain.value = 1.0;

  // --- Wire the chain ---

  // input -> saturator -> lpFilter
  input.connect(saturator);
  saturator.connect(lpFilter);

  // lpFilter -> reverb dry path + reverb wet path -> reverbMix
  lpFilter.connect(reverbDry);
  lpFilter.connect(convolver);
  convolver.connect(reverbWetGain);
  reverbDry.connect(reverbMix);
  reverbWetGain.connect(reverbMix);

  // reverbMix -> delay dry path + delay -> delayWet -> output
  reverbMix.connect(delayDry);
  reverbMix.connect(delay);
  delay.connect(delayFilter);
  delayFilter.connect(feedbackGain);
  feedbackGain.connect(delay); // feedback loop
  delayFilter.connect(delayWet);

  delayDry.connect(output);
  delayWet.connect(output);

  return {
    input,
    output,
    destroy() {
      // Disconnect all internal nodes to allow GC
      const nodes = [
        input, saturator, lpFilter,
        convolver, reverbDry, reverbWetGain, reverbMix,
        delay, feedbackGain, delayFilter, delayDry, delayWet,
        output,
      ];
      for (const node of nodes) {
        try { node.disconnect(); } catch { /* noop */ }
      }
    },
  };
}

/**
 * Create a looping vinyl crackle / tape noise layer.
 *
 * Generates a noise buffer with random pops and hiss, routed through a
 * bandpass filter at 3000Hz to simulate vinyl surface noise. Returns a
 * StoppableVoice handle.
 *
 * The buffer loops continuously until stop() is called.
 */
export function createVinylCrackle(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    gain?: number;
    popDensity?: number;
  } = {},
): StoppableVoice {
  const volume = opts.gain ?? 0.04; // Quieter default — atmosphere, not distraction
  const popDensity = opts.popDensity ?? 1; // Very sparse pops

  // Create a 4-second looping noise buffer (longer = less obvious loop)
  const bufferLengthS = 4.0;
  const bufferLength = Math.ceil(ctx.sampleRate * bufferLengthS);
  const noiseBuffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);

  // Fill with very low-level hiss
  for (let i = 0; i < bufferLength; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.12; // Much quieter base noise
  }

  // Very sparse, gentle pops (not sharp transients)
  const totalPops = Math.floor(popDensity * bufferLengthS);
  for (let p = 0; p < totalPops; p++) {
    const popPosition = Math.floor(Math.random() * bufferLength);
    const popLength = Math.floor(ctx.sampleRate * 0.008); // 8ms pop (softer, longer)
    const popAmplitude = 0.15 + Math.random() * 0.2; // 0.15 - 0.35 (much gentler)
    const popSign = Math.random() > 0.5 ? 1 : -1;

    for (let i = 0; i < popLength && popPosition + i < bufferLength; i++) {
      // Slower decay = rounder pop (less click)
      const envelope = Math.exp(-i / (popLength * 0.5));
      data[popPosition + i] += popSign * popAmplitude * envelope;
    }
  }

  // Create buffer source (looping)
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  // Bandpass filter to shape the crackle spectrum (~3000Hz center)
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 3000;
  bandpass.Q.value = 0.8;

  // Output gain
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;

  // Wire: source -> bandpass -> gain -> dest
  source.connect(bandpass);
  bandpass.connect(gainNode);
  gainNode.connect(dest);

  source.start(ctx.currentTime);

  let stopped = false;

  return {
    stop() {
      if (stopped) return;
      stopped = true;

      // Quick fade out to avoid click
      const t = ctx.currentTime;
      gainNode.gain.setValueAtTime(gainNode.gain.value, t);
      gainNode.gain.exponentialRampToValueAtTime(GAIN_EPSILON, t + 0.1);

      setTimeout(() => {
        try { source.stop(); } catch { /* noop */ }
        try { source.disconnect(); } catch { /* noop */ }
        try { bandpass.disconnect(); } catch { /* noop */ }
        try { gainNode.disconnect(); } catch { /* noop */ }
      }, 200);
    },
  };
}

/**
 * Play a one-shot audio sample (drum hit, piano stab, etc.).
 *
 * Pitch-shifts via playbackRate for different notes. Applies velocity
 * scaling and an optional lowpass filter. Self-cleans on completion.
 */
export function playSample(
  ctx: AudioContext,
  buffer: AudioBuffer,
  dest: AudioNode,
  opts: {
    velocity?: number;
    pitchSemitones?: number;
    filterHz?: number;
  } = {},
): void {
  const velocity = opts.velocity ?? 0.8;
  const pitchSemitones = opts.pitchSemitones ?? 0;
  const filterHz = opts.filterHz;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Pitch shift via playback rate: 2^(semitones/12)
  source.playbackRate.value = Math.pow(2, pitchSemitones / 12);

  // Velocity gain
  const gainNode = ctx.createGain();
  gainNode.gain.value = velocity;

  // Optional lowpass filter
  let filterNode: BiquadFilterNode | null = null;
  if (filterHz !== undefined) {
    filterNode = ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = filterHz;
    filterNode.Q.value = 0.7;

    source.connect(filterNode);
    filterNode.connect(gainNode);
  } else {
    source.connect(gainNode);
  }

  gainNode.connect(dest);
  source.start(ctx.currentTime);

  // Self-cleanup when the sample finishes playing
  source.onended = () => {
    try { source.disconnect(); } catch { /* noop */ }
    if (filterNode) {
      try { filterNode.disconnect(); } catch { /* noop */ }
    }
    try { gainNode.disconnect(); } catch { /* noop */ }
  };
}
