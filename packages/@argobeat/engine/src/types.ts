/**
 * @argobeat/engine — Core type definitions (v2)
 *
 * Complete type system for mood-based audio with subtle target-rate
 * modulation. Replaces the old 8-mode / raw-Hz approach with 5 moods,
 * curated soundscape/music playback, and content modulation rather than
 * layering audible tones.
 *
 * Zero external dependencies. All audio types reference the Web Audio API
 * interfaces available in modern browsers (Chrome 66+, Firefox 76+, Safari 14.1+).
 */

// ---------------------------------------------------------------------------
// Core Enums & Unions
// ---------------------------------------------------------------------------

/**
 * The five mood states that drive the entire experience.
 *
 * Each mood maps to a target frequency band, a set of modulation parameters,
 * and a weighted affinity matrix of compatible soundscapes. Users never
 * see Hz values — they pick a mood and the engine handles the rest.
 *
 * | Mood      | Band  | Hz Range   | Typical Use                         |
 * |-----------|-------|------------|-------------------------------------|
 * | focus     | beta  | 12–18 Hz   | Reading, coding, detail work        |
 * | deepWork  | beta  | 16–20 Hz   | Long creative/engineering sessions  |
 * | relax     | alpha | 8–12 Hz    | Unwinding, casual reading           |
 * | meditate  | theta | 4–7 Hz     | Mindfulness, breathwork             |
 * | sleep     | delta | 0.5–3.5 Hz | Sleep onset and quiet rest          |
 */
export type Mood = 'focus' | 'deepWork' | 'relax' | 'meditate' | 'sleep';

/**
 * Categories of curated ambient soundscapes.
 *
 * The primary engine plays static ambient recordings for these categories.
 * Legacy procedural variations remain available as a fallback path.
 */
export type SoundscapeCategory =
  | 'rain'
  | 'ocean'
  | 'forest'
  | 'cafe'
  | 'fire'
  | 'space'
  | 'stream'
  | 'wind'
  | 'thunder'
  | 'gongs'
  | 'jungle'
  | 'noise'
  | 'birds'
  | 'cave';

/**
 * Common EEG-band labels used as audio design targets.
 *
 * | Band  | Range      | Associated state                       |
 * |-------|------------|----------------------------------------|
 * | delta | 0.5–4 Hz   | Deep sleep and very low arousal states |
 * | theta | 4–8 Hz     | Meditation, creativity, REM sleep      |
 * | alpha | 8–13 Hz    | Relaxed focus, calm alertness          |
 * | beta  | 13–30 Hz   | Active thinking, concentration         |
 * | gamma | 30–100 Hz  | Peak awareness, insight, integration   |
 */
export type BrainwaveBand = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

/**
 * Entrainment delivery method.
 *
 * - `invisible`:  Legacy API name for the default subtle-modulation path.
 *                 It modulates amplitude, spectral content, and stereo
 *                 position of the soundscape/music at the target frequency
 *                 while keeping the content layer listenable.
 *
 * - `binaural`:   Classic two-tone method. Separate carrier frequencies in
 *                 each ear; the perceived beat is the frequency difference.
 *                 Requires headphones. Opt-in for users who prefer it.
 *
 * - `isochronic`: Single tone amplitude-modulated at the target frequency.
 *                 Works on speakers. Opt-in for users who prefer it.
 */
export type EntrainmentMethod = 'invisible' | 'binaural' | 'isochronic';

/**
 * Audio source mode — controls the content layer the target-rate modulation
 * modulation is applied to.
 *
 * - `soundscape`:  Real ambient recordings
 * - `music`:       Curated music tracks
 * - `both`:        Blended soundscape + music with independent volume
 * - `generated`:   Infinite Tone.js FM synthesis — no files, never repeats
 * - `generated+soundscape`: Generated music blended with soundscape
 */
export type AudioSourceMode = 'soundscape' | 'music' | 'both' | 'generated' | 'generated+soundscape';

// ---------------------------------------------------------------------------
// Mood Configuration
// ---------------------------------------------------------------------------

/**
 * Complete configuration for a single mood.
 *
 * Defines the target-rate band, timing, modulation parameters, and
 * UI theming. The engine uses this as the source of truth when a user
 * selects a mood — all downstream synthesis is derived from these values.
 */
export interface MoodConfig {
  /** Unique mood identifier, matches the {@link Mood} union. */
  id: Mood;

  /** Human-readable display label (e.g., "Deep Work"). */
  label: string;

  /** One-line description for the UI mood selector. */
  description: string;

  /** EEG-inspired band label used as an audio design target for this mood. */
  band: BrainwaveBand;

  /**
   * Allowed frequency range for the target beat, as `[min, max]` in Hz.
   * The engine picks a random value within this range per session to
   * avoid habituation across repeated sessions.
   */
  hzRange: [number, number];

  /** Default target frequency in Hz, used when no randomization is desired. */
  defaultHz: number;

  /**
   * Maximum drift offset in Hz (+/-) for the slow drift LFO.
   * The actual frequency wanders within `defaultHz +/- driftRange`
   * over the drift cycle, keeping the audio marker from feeling static.
   */
  driftRange: number;

  /** Default session length in minutes. User-overridable. */
  sessionMinutes: number;

  /** Fade-in duration when starting or switching to this mood (ms). */
  fadeInMs: number;

  /** Fade-out duration when stopping or ending the session (ms). */
  fadeOutMs: number;

  /** Subtle target-rate modulation parameters for this mood. */
  modulation: ModulationConfig;

  /**
   * UI color theme for this mood.
   * Used by the visualizer, mood selector, and session screen.
   */
  color: {
    /** Primary accent color (hex). */
    primary: string;
    /** Glow/shadow color (rgba for transparency). */
    glow: string;
    /** Background gradient stops `[from, to]` (hex). */
    gradient: [string, string];
  };
}

// ---------------------------------------------------------------------------
// Target-Rate Modulation
// ---------------------------------------------------------------------------

/**
 * Parameters for the subtle target-rate modulation chain.
 *
 * Instead of layering audible tones, the engine modulates three properties
 * of the existing audio at the mood's target frequency:
 *
 * 1. **Amplitude modulation (AM)** — subtle volume pulsing
 * 2. **Spectral modulation** — gentle EQ sweep around a center frequency
 * 3. **Spatial modulation** — slight stereo panning oscillation
 *
 * Combined, these create a measurable rhythmic audio marker without making
 * the music or ambience depend on harsh foreground tones.
 */
export interface ModulationConfig {
  /**
   * Amplitude modulation depth (0.0–1.0).
   * Typical range: 0.06–0.12. Higher values make the pulsing more
   * perceptible; lower values keep the marker more subtle.
   */
  amDepth: number;

  /**
   * Spectral sweep depth in dB.
   * How much the EQ center boosts/cuts as it oscillates.
   * Typical range: 1.5–3.5 dB.
   */
  spectralDepthDb: number;

  /**
   * Center frequency for the spectral sweep in Hz.
   * Positioned in the 500–1200 Hz range where hearing is sensitive enough
   * that small dB changes remain measurable without becoming harsh.
   */
  spectralCenterHz: number;

  /**
   * Stereo pan oscillation depth (0.0–1.0).
   * Typical range: 0.08–0.18. Creates a gentle spatial movement
   * that adds another subtle rhythmic marker.
   */
  panDepth: number;

  /**
   * Duration of one complete drift cycle in seconds.
   * The target Hz slowly wanders over this period before returning.
   * Typically 90 seconds (matches natural attention micro-cycles).
   */
  driftCycleSeconds: number;
}

// ---------------------------------------------------------------------------
// Soundscape Affinity
// ---------------------------------------------------------------------------

/**
 * A weighted pairing between a soundscape category and a mood.
 *
 * The affinity matrix determines which soundscapes are eligible for a
 * given mood and how likely each is to be selected. Categories with
 * `weight >= 0.5` are eligible; selection uses weighted random sampling.
 */
export interface AffinityEntry {
  /** The soundscape category. */
  category: SoundscapeCategory;

  /**
   * Affinity weight (0.0–1.0).
   * Values >= 0.5 are eligible for automatic selection.
   * Higher weights increase selection probability.
   */
  weight: number;
}

// ---------------------------------------------------------------------------
// Soundscape Synthesis
// ---------------------------------------------------------------------------

/**
 * A specific variation of a soundscape category.
 *
 * Each category (e.g., "rain") has multiple variations (e.g., "light drizzle",
 * "heavy downpour", "rain on leaves") with different synthesis parameters.
 * The engine crossfades between variations during long sessions to prevent
 * auditory fatigue.
 */
export interface SoundscapeVariation {
  /** Unique identifier (e.g., "rain-light-drizzle"). */
  id: string;

  /** Parent category this variation belongs to. */
  category: SoundscapeCategory;

  /** Human-readable name (e.g., "Light Drizzle"). */
  name: string;

  /** Complete synthesis parameters for this variation. */
  params: SoundscapeParams;
}

/**
 * Full parameterization for procedural soundscape synthesis.
 *
 * Every soundscape is built from a noise source, shaped through filter
 * bands, optionally run through convolution reverb, and decorated with
 * amplitude/filter LFOs and randomized accent events. This config
 * drives the entire signal chain.
 */
export interface SoundscapeParams {
  /**
   * Base noise type for the primary texture.
   * - `white`: Equal energy per frequency (harsh, hissy)
   * - `pink`:  Equal energy per octave (natural, balanced)
   * - `brown`: Stronger low frequencies (warm, rumbling)
   */
  noiseType: 'white' | 'pink' | 'brown';

  /**
   * Noise buffer duration in seconds.
   * Uses prime numbers (29, 31, or 37) so that looping buffers
   * don't produce audible repetition patterns.
   */
  bufferSeconds: number;

  /** Filter band chain applied to the noise source. */
  bands: BandConfig[];

  /** Convolution reverb settings for spatial depth. */
  reverb: {
    /** Reverb decay time (RT60) in seconds. */
    rt60: number;
    /** Pre-delay before reverb onset, in milliseconds. */
    preDelayMs: number;
    /** Wet/dry mix (0.0 = fully dry, 1.0 = fully wet). */
    wetMix: number;
    /** High-pass filter on reverb input to prevent muddiness (Hz). */
    highpassHz: number;
  };

  /**
   * Optional slow amplitude LFO for organic volume variation.
   * Creates the "breathing" quality of natural environments.
   */
  amplitudeLFO?: {
    /** LFO rate in Hz (typically 0.03–0.15 for slow swells). */
    frequency: number;
    /** Modulation depth (0.0–1.0). */
    depth: number;
    /** LFO waveform shape. */
    waveform: OscillatorType;
  };

  /**
   * Optional slow filter sweep for timbral variation.
   * Moves a bandpass/lowpass cutoff up and down over time.
   */
  filterSweep?: {
    /** Sweep LFO rate in Hz. */
    frequency: number;
    /** Sweep range in octaves. */
    depth: number;
  };

  /**
   * Optional randomized accent events (bird chirps, thunder rumbles, etc.).
   * Scheduled stochastically to add life without becoming predictable.
   */
  accents?: AccentConfig[];

  /**
   * Master EQ applied as the final shaping stage before output.
   * Typically 3–5 bands for overall tonal balance.
   */
  masterEQ: EQBand[];
}

/**
 * Configuration for a single filter band in the soundscape signal chain.
 * Maps directly to a Web Audio BiquadFilterNode.
 */
export interface BandConfig {
  /** Filter type (lowpass, highpass, bandpass, peaking, etc.). */
  type: BiquadFilterType;
  /** Center/cutoff frequency in Hz. */
  frequency: number;
  /** Filter Q (resonance). Higher values = narrower bandwidth. */
  Q: number;
  /** Gain in dB (only applies to peaking, lowshelf, highshelf types). */
  gain: number;
}

/**
 * Configuration for a single master EQ band.
 * Maps directly to a Web Audio BiquadFilterNode.
 */
export interface EQBand {
  /** Filter type (typically peaking, lowshelf, or highshelf). */
  type: BiquadFilterType;
  /** Center frequency in Hz. */
  frequency: number;
  /** Filter Q value. */
  Q: number;
  /** Gain in dB. */
  gain: number;
}

/**
 * Configuration for a randomized accent event layer.
 *
 * Accents are short synthesized sounds (bird calls, thunder, drips, etc.)
 * triggered at random intervals within a specified range. They add
 * naturalistic unpredictability to the soundscape.
 */
export interface AccentConfig {
  /** Type of accent sound to synthesize. */
  type: 'bird' | 'thunder' | 'cricket' | 'drip' | 'click' | 'chime';

  /** Minimum time between accent triggers (ms). */
  minIntervalMs: number;

  /** Maximum time between accent triggers (ms). */
  maxIntervalMs: number;

  /** Accent volume relative to soundscape (0.0–1.0). */
  gain: number;

  /**
   * Frequency range for the accent oscillator, as `[min, max]` in Hz.
   * A random frequency within this range is chosen per trigger.
   */
  frequencyRange: [number, number];
}

// ---------------------------------------------------------------------------
// Audio Node Graphs
// ---------------------------------------------------------------------------

/**
 * Tracks all Web Audio nodes created for a soundscape variation.
 *
 * Used for deterministic cleanup when crossfading between variations
 * or stopping playback. Every node created during soundscape construction
 * must be registered here.
 */
export interface SoundscapeGraph {
  /** All AudioNode instances (for generic iteration during cleanup). */
  nodes: AudioNode[];

  /** Source nodes that need `.stop()` before disconnection. */
  sources: (AudioBufferSourceNode | OscillatorNode | ConstantSourceNode)[];

  /** All GainNode instances in the graph. */
  gains: GainNode[];

  /** All BiquadFilterNode instances in the graph. */
  filters: BiquadFilterNode[];

  /** ConvolverNode for reverb, if present. */
  convolver?: ConvolverNode;

  /** Final output gain node (fade target for crossfades). */
  outputGain: GainNode;

  /**
   * Timer IDs for scheduled accent events.
   * Must be cleared with `clearTimeout()` during cleanup.
   */
  accentTimers: number[];
}

/**
 * Tracks all Web Audio nodes in the subtle modulation chain.
 *
 * The modulation chain sits between the content layer (soundscape/music)
 * and the master output. It applies AM, spectral, and spatial modulation
 * at the mood's target frequency.
 *
 * Signal flow:
 * ```
 * [content] -> spectralFilter -> amGain -> panner -> [master output]
 *                  ^                ^          ^
 *              specLfo          amLfo      panLfo
 *                                  ^
 *                              driftLfo (modulates amLfo frequency)
 * ```
 */
export interface ModulationGraph {
  /** Peaking EQ filter for spectral modulation. */
  spectralFilter: BiquadFilterNode;

  /** Gain node whose gain param receives AM modulation. */
  amGain: GainNode;

  /** StereoPannerNode for spatial modulation. */
  panner: StereoPannerNode;

  /** LFO driving amplitude modulation at the target Hz. */
  amLfo: OscillatorNode;

  /** LFO driving spectral (EQ) modulation at the target Hz. */
  specLfo: OscillatorNode;

  /** LFO driving stereo pan modulation at the target Hz. */
  panLfo: OscillatorNode;

  /** Slow LFO that sweeps the spectral filter center frequency. */
  sweepLfo: OscillatorNode;

  /**
   * Very slow LFO that modulates the target frequency itself.
   * Creates gradual drift within the mood's hzRange to prevent
   * fatigue from completely static modulation over long sessions.
   */
  driftLfo: OscillatorNode;

  /** All nodes in this graph, for bulk cleanup. */
  allNodes: AudioNode[];
}

// ---------------------------------------------------------------------------
// Engine State
// ---------------------------------------------------------------------------

/**
 * Immutable snapshot of the engine's current playback state.
 *
 * A new snapshot is emitted on every {@link EngineEvents.stateChange}
 * callback. The UI should treat this as the single source of truth
 * for rendering session state.
 */
export interface EngineState {
  /** Currently active mood, or `null` if no session is running. */
  mood: Mood | null;

  /** Whether audio is actively playing (not paused, not stopped). */
  isPlaying: boolean;

  /** Whether playback is paused (AudioContext suspended but session alive). */
  isPaused: boolean;

  /** Active modulation method. Defaults to legacy value `'invisible'`. */
  entrainmentMethod: EntrainmentMethod;

  /** Active audio source mode. Defaults to `'soundscape'`. */
  audioSource: AudioSourceMode;

  /** Currently playing soundscape category, or `null` if using music only. */
  soundscapeCategory: SoundscapeCategory | null;

  /** ID of the currently playing soundscape variation, or `null`. */
  currentVariation: string | null;

  /** ID of the currently playing music track, or `null`. */
  currentMusicTrack: string | null;

  /** Master output volume (0.0–1.0). */
  masterVolume: number;

  /** Seconds elapsed in the current session. */
  elapsedSeconds: number;

  /** Total session duration in seconds. */
  sessionSeconds: number;

  /**
   * Current effective entrainment frequency in Hz, including drift.
   * `null` when no session is active.
   */
  sessionHz: number | null;
}

// ---------------------------------------------------------------------------
// Engine Events
// ---------------------------------------------------------------------------

/**
 * Event callback signatures for the engine.
 *
 * Consumers register handlers via `engine.on(eventName, callback)`.
 * All callbacks fire synchronously on the main thread; keep handlers
 * lightweight to avoid audio glitches.
 */
export interface EngineEvents {
  /**
   * Fired whenever any part of the engine state changes.
   * The provided state is an immutable snapshot — safe to store directly.
   */
  stateChange: (state: EngineState) => void;

  /**
   * Fired once per second while playing.
   * @param elapsed - Seconds elapsed in the current session
   * @param total - Total session duration in seconds
   */
  tick: (elapsed: number, total: number) => void;

  /**
   * Fired when the engine crossfades to a new soundscape variation.
   * @param from - Previous variation ID, or `null` on first play
   * @param to - New variation ID
   */
  variationChange: (from: string | null, to: string) => void;

  /**
   * Fired when the session timer reaches its target duration.
   * The engine continues playing after this event — it's up to the
   * UI to decide whether to stop, extend, or prompt the user.
   */
  sessionComplete: (mood: Mood, durationSeconds: number) => void;

  /**
   * Fired on any audio or engine error.
   * Common errors: AudioContext creation failure, worklet load failure,
   * buffer allocation failure.
   */
  error: (error: Error) => void;

  /**
   * Fired when the user skips to the next music generation.
   * The soundscape and modulation continue; only the music engine restarts.
   */
  musicSkip: () => void;

  /**
   * Fired when the curated music layer crossfades to a new track.
   * @param from - Previous track ID, or `null` on first play
   * @param to - New track ID
   */
  musicTrackChange: (from: string | null, to: string) => void;
}

// ---------------------------------------------------------------------------
// Session Randomization
// ---------------------------------------------------------------------------

/**
 * Seed values generated at session start for deterministic randomization.
 *
 * Each session gets a unique seed so that repeated plays of the same mood
 * feel different. The seed can be serialized for session replay/debugging.
 */
export interface SessionSeed {
  /** Target entrainment frequency for this session (within mood's hzRange). */
  hz: number;

  /** Musical BPM for generative patterns (decoupled from entrainment Hz). */
  bpm: number;

  /** Selected soundscape category (from mood's eligible affinities). */
  category: SoundscapeCategory;

  /** Selected initial soundscape variation ID. */
  variationId: string;

  /**
   * Initial phase offset for the drift LFO (0–2*PI radians).
   * Randomized so drift doesn't always start at the same point.
   */
  driftPhase: number;

  /**
   * Interval between soundscape variation crossfades (ms).
   * Randomized within 3–8 minutes to prevent predictability.
   */
  crossfadeIntervalMs: number;
}
