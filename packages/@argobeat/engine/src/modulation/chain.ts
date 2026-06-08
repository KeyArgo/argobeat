/**
 * @argobeat/engine — Subtle Target-Rate Modulation Chain
 *
 * Three modulation layers applied to the audio content at the selected
 * target-rate marker frequency:
 *
 * 1. Amplitude Modulation — subtle volume pulsing (~6-12% depth)
 * 2. Spectral Modulation — EQ sweep at the target Hz with slow drift
 * 3. Stereo Field Modulation — subtle L/R panning
 *
 * All three modulate at the same target frequency with a shared
 * drift oscillator for natural variation. The user hears only the
 * content (rain, music) while the modulation stays subtle.
 *
 * Unlike classic binaural or isochronic tones, this modulation chain wraps
 * around existing audio content. It creates a measurable audio marker without
 * claiming a guaranteed EEG, sleep, mood, or performance outcome.
 *
 * Signal flow:
 * ```
 * [content audio]
 *   → spectralFilter (peaking EQ, gain oscillating at target Hz)
 *   → amGain (volume oscillating at target Hz, 6-12% depth)
 *   → panner (stereo pan oscillating at target Hz, 8-18% depth)
 *   → [output bus]
 *
 * LFO routing:
 *   amLfo ─→ amDepthGain ─→ amGain.gain
 *   specLfo ─→ specDepthGain ─→ spectralFilter.gain
 *   sweepLfo (1/45 Hz) ─→ sweepDepthGain ─→ spectralFilter.frequency
 *   panLfo ─→ panDepthGain ─→ panner.pan
 *
 * Drift routing (shared micro-detuning for organic feel):
 *   driftLfo (1/driftCycleSeconds Hz) ─→ driftGain ─→ amLfo.frequency
 *                                                    ─→ specLfo.frequency
 *                                                    ─→ panLfo.frequency
 * ```
 *
 * @module @argobeat/engine/modulation/chain
 */

import type { ModulationConfig, ModulationGraph } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Anti-habituation sweep cycle in seconds.
 * The spectral filter's center frequency slowly wanders on a 45-second cycle
 * to prevent the auditory system from adapting to a fixed modulation pattern.
 */
const SWEEP_CYCLE_SECONDS = 45;

/**
 * Default range (in Hz) of the spectral center frequency sweep.
 * The filter sweeps +/- this value around the configured center frequency.
 */
const SWEEP_DEPTH_HZ = 250;  // ±250 Hz keeps sweep within the validated 200–1000 Hz band

/**
 * Minimum ramp time in seconds for frequency transitions.
 * Prevents division-by-zero and ensures at least one audio frame of ramp.
 */
const MIN_RAMP_SECONDS = 0.01;

/**
 * Short fade-in time (seconds) for LFOs to prevent start-up clicks.
 * LFO depth gains ramp from 0 to target over this duration.
 */
const LFO_FADE_IN_SECONDS = 0.5;

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Build the complete three-layer modulation chain.
 *
 * Creates all Web Audio nodes for amplitude modulation, spectral modulation,
 * and stereo field modulation, wires the LFO routing and shared drift
 * oscillator, and starts all oscillators.
 *
 * The returned `input` node is the spectral filter — connect your content
 * audio source to it. The returned `output` node is the stereo panner —
 * connect it to your output bus / master gain.
 *
 * @param ctx - The active AudioContext. Must be in `'running'` or `'suspended'`
 *   state (not `'closed'`).
 * @param entrainmentHz - Target modulation frequency in Hz (e.g., 10 for alpha).
 *   Must be positive.
 * @param config - Per-mood modulation parameters controlling depth and character.
 * @param driftPhase - Random initial phase offset for the drift LFO in radians
 *   (0 to 2*PI). Shifts where in the 90-second drift cycle the session starts,
 *   so even identical Hz values produce different session textures. Defaults to 0.
 * @returns Object containing the {@link ModulationGraph}, the `input` node
 *   (connect content here), and the `output` node (connect to destination).
 *
 * @example
 * ```ts
 * const { graph, input, output } = buildModulationChain(
 *   audioContext,
 *   10,                          // 10 Hz alpha target
 *   { amDepth: 0.08, spectralDepthDb: 3, spectralCenterHz: 800, panDepth: 0.12, driftCycleSeconds: 90 },
 *   Math.random() * Math.PI * 2, // random drift phase
 * );
 *
 * sourceNode.connect(input);
 * output.connect(masterGain);
 * ```
 */
export function buildModulationChain(
  ctx: AudioContext,
  entrainmentHz: number,
  config: ModulationConfig,
  driftPhase: number = 0,
): { graph: ModulationGraph; input: AudioNode; output: AudioNode } {
  const now = ctx.currentTime;

  // ─── Layer 1: Amplitude Modulation ──────────────────────────────────────
  // A sine LFO at entrainmentHz modulates the content's overall gain.
  // The amGain node sits in the audio path; its gain parameter is the target.

  const amGain = ctx.createGain();
  amGain.gain.value = 1.0; // unity baseline; LFO oscillates around it

  const amLfo = ctx.createOscillator();
  amLfo.type = 'sine';
  amLfo.frequency.value = entrainmentHz;

  // Depth gain scales the LFO's [-1, +1] output to [-amDepth, +amDepth].
  // Result on amGain.gain: oscillates between (1 - amDepth) and (1 + amDepth).
  const amDepthGain = ctx.createGain();
  amDepthGain.gain.setValueAtTime(0, now);
  amDepthGain.gain.linearRampToValueAtTime(config.amDepth, now + LFO_FADE_IN_SECONDS);

  amLfo.connect(amDepthGain);
  amDepthGain.connect(amGain.gain);

  // ─── Layer 2: Spectral Modulation ───────────────────────────────────────
  // A peaking EQ filter whose gain oscillates at entrainmentHz, creating
  // rhythmic spectral emphasis. A second slow LFO sweeps the center frequency
  // to prevent auditory habituation.

  const spectralFilter = ctx.createBiquadFilter();
  spectralFilter.type = 'peaking';
  spectralFilter.frequency.value = config.spectralCenterHz;
  spectralFilter.Q.value = 1.0; // moderate resonance — wide enough to affect content naturally
  spectralFilter.gain.value = 0; // baseline; LFO oscillates around this

  const specLfo = ctx.createOscillator();
  specLfo.type = 'sine';
  specLfo.frequency.value = entrainmentHz;

  // Scale LFO output to +/- spectralDepthDb
  const specDepthGain = ctx.createGain();
  specDepthGain.gain.setValueAtTime(0, now);
  specDepthGain.gain.linearRampToValueAtTime(config.spectralDepthDb, now + LFO_FADE_IN_SECONDS);

  specLfo.connect(specDepthGain);
  specDepthGain.connect(spectralFilter.gain);

  // Anti-habituation sweep: slow LFO wanders the filter center frequency
  const sweepLfo = ctx.createOscillator();
  sweepLfo.type = 'sine';
  sweepLfo.frequency.value = 1 / SWEEP_CYCLE_SECONDS;

  const sweepDepthGain = ctx.createGain();
  sweepDepthGain.gain.setValueAtTime(0, now);
  sweepDepthGain.gain.linearRampToValueAtTime(SWEEP_DEPTH_HZ, now + LFO_FADE_IN_SECONDS);

  sweepLfo.connect(sweepDepthGain);
  sweepDepthGain.connect(spectralFilter.frequency);

  // ─── Layer 3: Stereo Field Modulation ───────────────────────────────────
  // A StereoPanner whose pan param oscillates at entrainmentHz for subtle
  // left/right motion. Works on all modern browsers including Safari 14.1+.

  const panner = ctx.createStereoPanner();
  panner.pan.value = 0; // center baseline

  const panLfo = ctx.createOscillator();
  panLfo.type = 'sine';
  panLfo.frequency.value = entrainmentHz;

  const panDepthGain = ctx.createGain();
  panDepthGain.gain.setValueAtTime(0, now);
  panDepthGain.gain.linearRampToValueAtTime(config.panDepth, now + LFO_FADE_IN_SECONDS);

  panLfo.connect(panDepthGain);
  panDepthGain.connect(panner.pan);
  // panDepth: 0.0 in mood config fully disables panning without removing nodes from the graph

  // ─── Drift System ──────────────────────────────────────────────────────
  // A single ultra-slow LFO modulates the frequency of all three target-rate
  // LFOs simultaneously, creating organic micro-detuning. The drift amount
  // is typically 0.2-1.5 Hz, so the marker frequency gently wanders
  // e.g., 10 Hz -> 10.8 Hz -> 9.5 Hz -> 10.3 Hz over a ~90-second cycle.
  //
  // The driftPhase parameter offsets the starting position in this cycle,
  // ensuring each session feels unique even with identical parameters.

  const driftLfo = ctx.createOscillator();
  driftLfo.type = 'sine';
  driftLfo.frequency.value = 1 / config.driftCycleSeconds;

  // Apply phase offset by scheduling a frequency-domain trick:
  // We can't set oscillator phase directly in Web Audio API, so we use
  // a PeriodicWave with the phase baked in. A sine wave with phase offset φ
  // is equivalent to: sin(ωt + φ) = cos(φ)·sin(ωt) + sin(φ)·cos(ωt)
  // PeriodicWave components: real[1] = sin(φ), imag[1] = cos(φ)
  if (driftPhase !== 0) {
    const real = new Float32Array([0, Math.sin(driftPhase)]);
    const imag = new Float32Array([0, Math.cos(driftPhase)]);
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    driftLfo.setPeriodicWave(wave);
  }

  // Drift gain: controls how many Hz the marker frequency wanders.
  // Default range derived from config.driftCycleSeconds:
  //   shorter cycles -> more aggressive drift allowed
  //   longer cycles -> gentler drift
  // Typical values: 0.2 Hz (sleep) to 1.5 Hz (focus/work)
  const driftAmountHz = computeDriftAmount(entrainmentHz, config.driftCycleSeconds);

  const driftGain = ctx.createGain();
  driftGain.gain.setValueAtTime(0, now);
  driftGain.gain.linearRampToValueAtTime(driftAmountHz, now + LFO_FADE_IN_SECONDS);

  // Route drift to all three target-rate LFO frequencies
  driftLfo.connect(driftGain);
  driftGain.connect(amLfo.frequency);
  driftGain.connect(specLfo.frequency);
  driftGain.connect(panLfo.frequency);

  // ─── Audio Signal Path ─────────────────────────────────────────────────
  // content -> spectralFilter -> amGain -> panner -> output
  spectralFilter.connect(amGain);
  amGain.connect(panner);

  // ─── Start All Oscillators ─────────────────────────────────────────────
  // OscillatorNodes can only be started once. They must be started after all
  // connections are made to avoid processing silent samples.
  amLfo.start(now);
  specLfo.start(now);
  panLfo.start(now);
  sweepLfo.start(now);
  driftLfo.start(now);

  // ─── Assemble Graph ────────────────────────────────────────────────────

  const allNodes: AudioNode[] = [
    spectralFilter,
    amGain,
    panner,
    amLfo,
    specLfo,
    panLfo,
    sweepLfo,
    driftLfo,
    amDepthGain,
    specDepthGain,
    sweepDepthGain,
    panDepthGain,
    driftGain,
  ];

  const graph: ModulationGraph = {
    spectralFilter,
    amGain,
    panner,
    amLfo,
    specLfo,
    panLfo,
    sweepLfo,
    driftLfo,
    allNodes,
  };

  return {
    graph,
    input: spectralFilter,
    output: panner,
  };
}

// ---------------------------------------------------------------------------
// Destroy
// ---------------------------------------------------------------------------

/**
 * Destroy the modulation chain — stop all LFOs and disconnect all nodes.
 *
 * Safe to call multiple times. Stopped oscillators throw a benign
 * `InvalidStateError` that is caught and ignored.
 *
 * After destruction, the graph is inert — do not attempt to reconnect nodes.
 * Create a new chain via {@link buildModulationChain} instead.
 *
 * @param graph - The modulation graph returned by {@link buildModulationChain}.
 */
export function destroyModulationChain(graph: ModulationGraph): void {
  // Stop all oscillator LFOs first (prevents them from generating samples
  // into disconnected nodes, which some browsers log warnings about)
  const oscillators: OscillatorNode[] = [
    graph.amLfo,
    graph.specLfo,
    graph.panLfo,
    graph.sweepLfo,
    graph.driftLfo,
  ];

  for (const osc of oscillators) {
    try {
      osc.stop();
    } catch {
      // Already stopped — safe to ignore (InvalidStateError)
    }
  }

  // Disconnect every node in the graph to release references and allow GC
  for (const node of graph.allNodes) {
    try {
      node.disconnect();
    } catch {
      // Already disconnected — safe to ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Live Updates
// ---------------------------------------------------------------------------

/**
 * Update the target modulation frequency in real-time with a smooth ramp.
 *
 * Simultaneously ramps all three modulation LFOs (amplitude, spectral,
 * stereo) to the new target frequency. Used during live mood transitions
 * (e.g., focus 15 Hz -> relax 10 Hz) without audible discontinuities.
 *
 * The drift LFO frequency is NOT changed — it continues its current cycle
 * to maintain session continuity.
 *
 * @param graph - The active modulation graph.
 * @param ctx - The active AudioContext (for `currentTime`).
 * @param newHz - New target modulation frequency in Hz. Must be positive.
 * @param rampSeconds - Duration of the frequency crossfade in seconds.
 *   Clamped to a minimum of {@link MIN_RAMP_SECONDS} to prevent clicks.
 *   Defaults to 3 seconds, which produces a smooth perceptual transition.
 *
 * @example
 * ```ts
 * // Transition from relax alpha (10 Hz) to meditate theta (6 Hz) over 5 seconds
 * updateModulationFrequency(graph, ctx, 6, 5);
 * ```
 */
export function updateModulationFrequency(
  graph: ModulationGraph,
  ctx: AudioContext,
  newHz: number,
  rampSeconds: number = 3,
): void {
  const safeRamp = Math.max(rampSeconds, MIN_RAMP_SECONDS);
  const target = ctx.currentTime + safeRamp;

  // Cancel any in-progress ramps before scheduling new ones.
  // setValueAtTime anchors the current value so the ramp starts from
  // wherever the parameter is right now (not from a stale scheduled value).
  graph.amLfo.frequency.cancelScheduledValues(ctx.currentTime);
  graph.amLfo.frequency.setValueAtTime(graph.amLfo.frequency.value, ctx.currentTime);
  graph.amLfo.frequency.linearRampToValueAtTime(newHz, target);

  graph.specLfo.frequency.cancelScheduledValues(ctx.currentTime);
  graph.specLfo.frequency.setValueAtTime(graph.specLfo.frequency.value, ctx.currentTime);
  graph.specLfo.frequency.linearRampToValueAtTime(newHz, target);

  graph.panLfo.frequency.cancelScheduledValues(ctx.currentTime);
  graph.panLfo.frequency.setValueAtTime(graph.panLfo.frequency.value, ctx.currentTime);
  graph.panLfo.frequency.linearRampToValueAtTime(newHz, target);
}

/**
 * Update modulation depths in real-time with a smooth ramp.
 *
 * Used when transitioning between moods that have different modulation
 * intensities (e.g., sleep uses deeper AM than focus). Ramps the depth
 * gain nodes that scale each LFO's output.
 *
 * Note: This targets the depth gain nodes stored in `allNodes`. Since the
 * depth gains are at indices 8 (amDepth), 9 (specDepth), 11 (panDepth)
 * in the allNodes array, this function accesses them positionally. If the
 * graph structure changes, this function must be updated.
 *
 * @param graph - The active modulation graph.
 * @param ctx - The active AudioContext.
 * @param config - New modulation config with updated depth values.
 * @param rampSeconds - Duration of the depth crossfade (default 3s).
 */
export function updateModulationDepths(
  graph: ModulationGraph,
  ctx: AudioContext,
  config: ModulationConfig,
  rampSeconds: number = 3,
): void {
  const safeRamp = Math.max(rampSeconds, MIN_RAMP_SECONDS);
  const target = ctx.currentTime + safeRamp;

  // allNodes layout: [spectralFilter, amGain, panner, amLfo, specLfo, panLfo,
  //                   sweepLfo, driftLfo, amDepthGain, specDepthGain,
  //                   sweepDepthGain, panDepthGain, driftGain]
  const amDepthGain = graph.allNodes[8] as GainNode;
  const specDepthGain = graph.allNodes[9] as GainNode;
  const panDepthGain = graph.allNodes[11] as GainNode;

  amDepthGain.gain.cancelScheduledValues(ctx.currentTime);
  amDepthGain.gain.setValueAtTime(amDepthGain.gain.value, ctx.currentTime);
  amDepthGain.gain.linearRampToValueAtTime(config.amDepth, target);

  specDepthGain.gain.cancelScheduledValues(ctx.currentTime);
  specDepthGain.gain.setValueAtTime(specDepthGain.gain.value, ctx.currentTime);
  specDepthGain.gain.linearRampToValueAtTime(config.spectralDepthDb, target);

  panDepthGain.gain.cancelScheduledValues(ctx.currentTime);
  panDepthGain.gain.setValueAtTime(panDepthGain.gain.value, ctx.currentTime);
  panDepthGain.gain.linearRampToValueAtTime(config.panDepth, target);
}

/**
 * Update the spectral filter center frequency in real-time.
 *
 * Smoothly ramps the peaking EQ center to a new frequency. The sweep LFO
 * continues to oscillate around this new center point.
 *
 * @param graph - The active modulation graph.
 * @param ctx - The active AudioContext.
 * @param centerHz - New spectral center frequency in Hz (500-1200 recommended).
 * @param rampSeconds - Duration of the crossfade (default 3s).
 */
export function updateSpectralCenter(
  graph: ModulationGraph,
  ctx: AudioContext,
  centerHz: number,
  rampSeconds: number = 3,
): void {
  const safeRamp = Math.max(rampSeconds, MIN_RAMP_SECONDS);
  const target = ctx.currentTime + safeRamp;

  graph.spectralFilter.frequency.cancelScheduledValues(ctx.currentTime);
  graph.spectralFilter.frequency.setValueAtTime(
    graph.spectralFilter.frequency.value,
    ctx.currentTime,
  );
  graph.spectralFilter.frequency.linearRampToValueAtTime(centerHz, target);
}

/**
 * Accelerate drift rate as session progresses to counteract habituation.
 *
 * The habituation research shows AM benefits degrade within ~20 minutes.
 * Tightening the drift cycle over time keeps the modulation pattern novel.
 * Call every 15 minutes from the session timer.
 *
 * @param graph - The active modulation graph.
 * @param ctx - The active AudioContext.
 * @param sessionElapsedMinutes - How many minutes into the session we are.
 */
export function accelerateHabituationDrift(
  graph: ModulationGraph,
  ctx: AudioContext,
  sessionElapsedMinutes: number,
  baseCycleSeconds: number = 120,
): void {
  // Drift cycle tightens from baseCycleSeconds at start to half that at 60+ minutes
  const cycleSeconds = Math.max(baseCycleSeconds / 2, baseCycleSeconds - sessionElapsedMinutes * 1.0);
  const newFreq = 1 / cycleSeconds;

  graph.driftLfo.frequency.cancelScheduledValues(ctx.currentTime);
  graph.driftLfo.frequency.setValueAtTime(graph.driftLfo.frequency.value, ctx.currentTime);
  graph.driftLfo.frequency.linearRampToValueAtTime(newFreq, ctx.currentTime + 30);
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the drift amount in Hz based on the target marker frequency and
 * drift cycle duration.
 *
 * Higher target frequencies tolerate more absolute drift without perceptual
 * discontinuity. The drift is capped at 15% of the target frequency so the
 * marker stays near the selected mood band.
 *
 * Shorter drift cycles (more restless modulation) use slightly less drift
 * to avoid seasickness-like artifacts.
 *
 * @param entrainmentHz - Target marker frequency.
 * @param driftCycleSeconds - Duration of one complete drift cycle.
 * @returns Drift amount in Hz (typically 0.2-1.5).
 *
 * @internal
 */
function computeDriftAmount(entrainmentHz: number, driftCycleSeconds: number): number {
  // Base drift: 10% of marker frequency
  const baseDrift = entrainmentHz * 0.1;

  // Scale factor: longer cycles allow slightly more drift (up to 1.5x)
  // Normalized around a 90-second reference cycle
  const cycleFactor = Math.min(driftCycleSeconds / 90, 1.5);

  // Final drift, clamped to [0.1, 3.0] Hz absolute bounds
  const drift = baseDrift * cycleFactor;
  return Math.max(0.1, Math.min(drift, 3.0));
}
