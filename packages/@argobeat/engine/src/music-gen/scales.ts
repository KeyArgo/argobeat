/**
 * @module scales
 * @description Musical scale definitions, MIDI/frequency conversion, mood-specific
 * configurations, singing bowl partials, and chord voicings.
 *
 * This module is the tonal foundation of the generative music system. Each mood
 * maps to a specific scale, register, and filter configuration that shapes the
 * sonic character of a session.
 */

// =============================================================================
// Scale intervals (semitones from root)
// =============================================================================

/**
 * Interval sets for each supported scale type.
 *
 * Values are semitone offsets from the root within one octave.
 * For example `majorPentatonic: [0, 2, 4, 7, 9]` gives C-D-E-G-A when rooted on C.
 */
export const SCALE_INTERVALS = {
  /** Bright, open feel. Great for focus and productivity. */
  majorPentatonic: [0, 2, 4, 7, 9],
  /** Darker, bluesy. Used in lo-fi and chill contexts. */
  minorPentatonic: [0, 3, 5, 7, 10],
  /** Japanese In scale (Miyako-bushi). Contemplative, meditative quality. */
  japaneseIn: [0, 1, 5, 7, 8],
  /** Whole-tone scale. Dreamy, floating, no tonal centre. Perfect for sleep. */
  wholeTone: [0, 2, 4, 6, 8, 10],
  /** Dorian mode. Warm minor with a raised 6th. Good for relaxation. */
  dorian: [0, 2, 3, 5, 7, 9, 10],
} as const;

/** Union of valid scale type keys. */
export type ScaleType = keyof typeof SCALE_INTERVALS;

// =============================================================================
// MIDI / frequency conversion
// =============================================================================

/**
 * Convert a MIDI note number to its frequency in Hz.
 *
 * Uses the standard A4 = 440 Hz tuning reference:
 *   `f = 440 * 2^((note - 69) / 12)`
 *
 * @param note - MIDI note number (0-127).
 * @returns Frequency in Hz.
 *
 * @example
 * ```ts
 * midiToFreq(69); // 440  (A4)
 * midiToFreq(60); // ~261.63  (C4 / middle C)
 * ```
 */
export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// =============================================================================
// Scale frequency builder
// =============================================================================

/**
 * Build an array of `{ midi, freq }` pairs for every note in the given scale
 * that falls within the specified MIDI range.
 *
 * The function iterates across octaves -2 through 6 (covering the full useful
 * range) and keeps only those notes whose MIDI value is between `lowMidi` and
 * `highMidi` inclusive.
 *
 * @param rootMidi  - MIDI note number of the scale root (defines the key).
 * @param scaleType - Which scale pattern to use.
 * @param lowMidi   - Lowest allowable MIDI note (inclusive).
 * @param highMidi  - Highest allowable MIDI note (inclusive).
 * @returns Sorted array of note objects within the range.
 *
 * @example
 * ```ts
 * // C3 major pentatonic, one octave
 * buildScaleFrequencies(48, 'majorPentatonic', 48, 60);
 * // => [{ midi: 48, freq: 130.81 }, { midi: 50, freq: 146.83 }, ...]
 * ```
 */
export function buildScaleFrequencies(
  rootMidi: number,
  scaleType: ScaleType,
  lowMidi: number,
  highMidi: number,
): { midi: number; freq: number }[] {
  const intervals = SCALE_INTERVALS[scaleType];
  const notes: { midi: number; freq: number }[] = [];

  for (let octave = -2; octave <= 6; octave++) {
    for (const interval of intervals) {
      const midi = rootMidi + octave * 12 + interval;
      if (midi >= lowMidi && midi <= highMidi) {
        notes.push({ midi, freq: midiToFreq(midi) });
      }
    }
  }

  return notes;
}

// =============================================================================
// Per-mood music configuration
// =============================================================================

/**
 * Tonal and spectral parameters that define a mood's sonic character.
 *
 * Each mood maps to one of these configs, which the generative system uses
 * to build scale note pools, set filter cutoffs, and shape the overall sound.
 */
export interface MoodMusicConfig {
  /** Which scale pattern to use. */
  scaleType: ScaleType;
  /** MIDI note of the scale root (defines the key). */
  rootMidi: number;
  /** Lowest MIDI note the generators may use. */
  lowMidi: number;
  /** Highest MIDI note the generators may use. */
  highMidi: number;
  /** Low-pass filter cutoff for pad voices (Hz). Lower = warmer/darker. */
  padFilterHz: number;
  /** Low-pass filter cutoff for melody voices (Hz). */
  melodyFilterHz: number;
}

/**
 * Default music configurations keyed by mood name.
 *
 * These values were tuned by ear to produce the right emotional quality:
 *
 * | Mood     | Key  | Scale            | Character                      |
 * |----------|------|------------------|--------------------------------|
 * | focus    | C3   | Major pentatonic | Bright, clean, unobtrusive     |
 * | deepWork | A2   | Major pentatonic | Slightly lower, steady         |
 * | relax    | G3   | Dorian           | Warm minor with gentle tension |
 * | meditate | D3   | Japanese In      | Contemplative, sparse          |
 * | sleep    | F2   | Whole tone       | Dreamy, no tonal gravity       |
 */
/**
 * BPM ranges per mood for variable tempo generation.
 * Used with `rng.gaussian()` to produce naturally distributed tempos.
 */
export const MOOD_BPM_DEFAULTS: Record<string, { minBpm: number; maxBpm: number }> = {
  focus:    { minBpm: 96, maxBpm: 116 },
  deepWork: { minBpm: 82, maxBpm: 102 },
  relax:    { minBpm: 60, maxBpm: 80 },
  meditate: { minBpm: 50, maxBpm: 70 },
  sleep:    { minBpm: 40, maxBpm: 60 },
};

export const MOOD_MUSIC_CONFIGS: Record<string, MoodMusicConfig> = {
  focus: {
    scaleType: 'majorPentatonic',
    rootMidi: 48,
    lowMidi: 48,
    highMidi: 72,
    padFilterHz: 1200,
    melodyFilterHz: 1900,
  },
  deepWork: {
    scaleType: 'minorPentatonic',  // darker, more serious than focus
    rootMidi: 45,
    lowMidi: 45,
    highMidi: 69,
    padFilterHz: 600,     // warmer
    melodyFilterHz: 900,  // slightly darker
  },
  relax: {
    scaleType: 'dorian',
    rootMidi: 55,
    lowMidi: 48,
    highMidi: 72,
    padFilterHz: 600,
    melodyFilterHz: 800,
  },
  meditate: {
    scaleType: 'japaneseIn',
    rootMidi: 50,
    lowMidi: 43,
    highMidi: 67,
    padFilterHz: 400,
    melodyFilterHz: 600,
  },
  sleep: {
    scaleType: 'wholeTone',
    rootMidi: 41,
    lowMidi: 36,
    highMidi: 60,
    padFilterHz: 300,
    melodyFilterHz: 200,
  },
};

// =============================================================================
// Singing bowl partial data
// =============================================================================

/**
 * Spectral data for synthesising singing bowls.
 *
 * Derived from spectral analysis of real Tibetan singing bowls. The non-integer
 * partial ratios are what give bowls their characteristic inharmonic shimmer
 * (unlike bells or strings which have mostly integer harmonics).
 *
 * - `ratios`     - Frequency multipliers relative to the fundamental.
 * - `amplitudes` - Relative loudness of each partial (fundamental = 1.0).
 * - `decays`     - How long each partial rings (seconds). Higher partials
 *                  decay faster, matching real bowl physics.
 */
export const BOWL_PARTIALS = {
  ratios: [1.0, 2.71, 5.04, 8.09, 11.79],
  amplitudes: [1.0, 0.6, 0.35, 0.15, 0.08],
  decays: [8.0, 6.0, 4.0, 2.5, 1.5],
};

/**
 * Standard fundamental frequencies for singing bowl voices (Hz).
 *
 * These correspond roughly to D3, E3, G3, A3, C4, D4, E4 and were chosen
 * to work well across all moods without clashing with scale roots.
 */
export const BOWL_FUNDAMENTALS = [
  146.83, // D3
  164.81, // E3
  196.0,  // G3
  220.0,  // A3
  261.63, // C4
  293.66, // D4
  329.63, // E4
];

// =============================================================================
// Chord voicings
// =============================================================================

/**
 * Chord voicings expressed as arrays of semitone intervals from the root.
 *
 * Includes both sparse dyads (for ambient textures) and full jazz voicings
 * (for lo-fi harmonic richness). The generative system selects from these
 * based on the active mood's voicing pool.
 */
export const CHORD_VOICINGS = {
  // --- Sparse dyads (ambient, open) ---
  /** Power chord / open fifth. Universal, strong, neutral. */
  root5th: [0, 7],
  /** Major third. Bright, consonant. */
  root3rd: [0, 4],
  /** Octave doubling. Adds body without harmonic colour. */
  rootOctave: [0, 12],
  /** Perfect fourth. Suspended, slightly tense. */
  root4th: [0, 5],
  /** Minor third. Darker, more emotional. */
  rootMin3rd: [0, 3],
  /** Major seventh. Lush, jazzy, dreamy. */
  rootMaj7: [0, 11],
  /** Minor seventh. Warm, resolved tension. */
  rootMin7: [0, 10],

  // --- Full jazz chords (lo-fi voicings) ---
  /** Minor 7th chord (e.g., Am7 = A-C-E-G). Bread and butter of lo-fi. */
  min7: [0, 3, 7, 10],
  /** Major 7th chord (e.g., Cmaj7 = C-E-G-B). Warm, dreamy jazz staple. */
  maj7: [0, 4, 7, 11],
  /** Dominant 7th chord (e.g., G7 = G-B-D-F). Tension and resolution. */
  dom7: [0, 4, 7, 10],
  /** Minor 9th chord (e.g., Am9 = A-C-E-G-B). Rich, deep colour. */
  min9: [0, 3, 7, 10, 14],
  /** Major 9th chord (e.g., Cmaj9 = C-E-G-B-D). Lush, wide voicing. */
  maj9: [0, 4, 7, 11, 14],
  /** Minor 11th chord (e.g., Cmin11). Dense, stacked extensions. */
  min11: [0, 3, 7, 10, 14, 17],
  /** Diminished 7th chord. Symmetrical tension, useful for passing chords. */
  dim7: [0, 3, 6, 9],
};

/** Union of valid chord voicing keys. */
export type ChordVoicing = keyof typeof CHORD_VOICINGS;

// =============================================================================
// Mood-to-voicing mapping
// =============================================================================

/**
 * Which chord voicings are eligible for each mood.
 *
 * The generative system picks from this pool when building harmonic pads.
 * Jazz voicings (min7, maj7, etc.) provide the rich harmonic colour that
 * defines the lo-fi sound. Sparse dyads are kept for meditative moods.
 */
export const MOOD_CHORD_VOICINGS: Record<string, ChordVoicing[]> = {
  focus: ['maj7', 'min7', 'dom7', 'maj9'],           // bright jazz
  deepWork: ['min7', 'min9', 'root5th', 'min11'],     // darker, deeper
  relax: ['maj7', 'min7', 'maj9', 'dom7'],            // warm jazz
  meditate: ['root5th', 'rootOctave', 'maj7'],         // simple, spacious
  sleep: ['maj7', 'min7', 'maj9', 'rootOctave'],       // dreamy, unresolved
};

// =============================================================================
// Chord progressions
// =============================================================================

/**
 * Lo-fi chord progressions as sequences of chord voicing keys.
 * Each progression is 4 chords that cycle.
 * Multiple progressions per mood for variety (rng picks one per session).
 * Expanded to 20+ per mood for reduced repetition and musical variety.
 */
export const MOOD_PROGRESSIONS: Record<string, ChordVoicing[][]> = {
  focus: [
    // Energizing, modern progressions for productivity (beta 12-18 Hz)
    ['maj7', 'min7', 'dom7', 'maj7'],         // I - vi - V - I (classic)
    ['min7', 'dom7', 'maj7', 'maj9'],         // ii - V - I - I
    ['maj9', 'min7', 'min7', 'dom7'],         // I - vi - ii - V
    ['maj7', 'maj9', 'min7', 'dom7'],         // I - I - vi - V
    ['dom7', 'maj7', 'min7', 'maj9'],         // V - I - vi - I (rhythmic)
    ['maj7', 'dom7', 'min7', 'maj7'],         // I - V - vi - I (tense)
    ['min7', 'maj7', 'dom7', 'maj9'],         // vi - I - V - I (dark start)
    ['maj9', 'dom7', 'maj7', 'min7'],         // I - V - I - vi (bright cycle)
    ['maj7', 'min7', 'maj9', 'dom7'],         // I - vi - I - V (smooth)
    ['dom7', 'maj9', 'min7', 'maj7'],         // V - I - vi - I (uplifting)
    ['maj7', 'min7', 'dom7', 'min7'],         // I - vi - V - vi (wavering)
    ['min7', 'dom7', 'maj9', 'maj7'],         // ii - V - I - I (bright)
    ['maj9', 'maj7', 'min7', 'dom7'],         // I - I - vi - V (resolute)
    ['maj7', 'dom7', 'maj9', 'min7'],         // I - V - I - vi (alternating)
    ['dom7', 'min7', 'maj7', 'maj9'],         // V - vi - I - I (energetic)
    ['min7', 'maj9', 'maj7', 'dom7'],         // vi - I - I - V (rounded)
    ['maj9', 'min7', 'dom7', 'maj7'],         // I - vi - V - I (varied)
    ['maj7', 'maj9', 'dom7', 'min7'],         // I - I - V - vi (open)
    ['dom7', 'maj7', 'maj9', 'min7'],         // V - I - I - vi (forward-moving)
    ['min7', 'maj7', 'maj9', 'dom7'],         // vi - I - I - V (gentle focus)
    ['maj7', 'min7', 'maj9', 'dom7'],         // I - vi - I - V (balanced)
    ['maj9', 'dom7', 'min7', 'maj7'],         // I - V - vi - I (dynamic)
  ],
  deepWork: [
    // Complex, sophisticated progressions for deep focus (beta 16-20 Hz)
    ['min7', 'min9', 'min7', 'root5th'],      // i - iv - i - V
    ['min9', 'dom7', 'min7', 'min11'],        // i - VII - iv - i
    ['min7', 'min7', 'root5th', 'min9'],      // i - iv - V - i
    ['min11', 'min9', 'min7', 'root5th'],     // Complex stack
    ['min7', 'min11', 'min9', 'min7'],        // Dense progression
    ['root5th', 'min7', 'min9', 'min11'],     // Building complexity
    ['min9', 'min7', 'min11', 'min9'],        // Stacked extensions
    ['min7', 'root5th', 'min9', 'min7'],      // Mix sparse and dense
    ['min11', 'min7', 'root5th', 'min9'],     // Varied complexity
    ['min9', 'min11', 'min7', 'root5th'],     // Alternating density
    ['min7', 'min9', 'root5th', 'min11'],     // Progressive build
    ['root5th', 'min11', 'min7', 'min9'],     // Sparse start
    ['min7', 'min7', 'min9', 'min11'],        // Double start
    ['min9', 'min7', 'root5th', 'min7'],      // Rich with breather
    ['min11', 'min9', 'root5th', 'min7'],     // Complex descent
    ['min7', 'min9', 'min11', 'root5th'],     // Ascending complexity
    ['root5th', 'min9', 'min7', 'min11'],     // Open to closed
    ['min9', 'root5th', 'min11', 'min7'],     // Alternating open
    ['min7', 'min11', 'root5th', 'min9'],     // Varied texture
    ['min11', 'root5th', 'min9', 'min7'],     // Sparse framework
    ['min7', 'min9', 'min7', 'min11'],        // Minor variations
    ['min9', 'min7', 'min9', 'min7'],         // Oscillating minor
  ],
  relax: [
    // Simple, comfortable progressions for relaxation (alpha 8-12 Hz)
    ['maj7', 'min7', 'dom7', 'maj7'],         // classic ii-V-I
    ['maj9', 'min7', 'maj7', 'dom7'],         // warm and floating
    ['min7', 'maj7', 'dom7', 'maj9'],         // gentle resolution
    ['maj7', 'maj7', 'min7', 'dom7'],         // sustained resolution
    ['maj9', 'maj7', 'min7', 'maj7'],         // floating bright
    ['dom7', 'maj7', 'maj9', 'min7'],         // tension and ease
    ['maj7', 'dom7', 'maj9', 'maj7'],         // wavering calm
    ['min7', 'maj9', 'maj7', 'dom7'],         // dark to light
    ['maj7', 'min7', 'maj7', 'dom7'],         // alternating
    ['maj9', 'dom7', 'maj7', 'min7'],         // resolving cycle
    ['dom7', 'min7', 'maj7', 'maj9'],         // tense start
    ['maj7', 'maj9', 'dom7', 'min7'],         // bright descent
    ['min7', 'dom7', 'maj7', 'maj9'],         // minor to major
    ['maj9', 'maj7', 'dom7', 'min7'],         // major prominence
    ['dom7', 'maj9', 'min7', 'maj7'],         // energetic ease
    ['maj7', 'min7', 'maj9', 'maj7'],         // smooth variation
    ['maj9', 'min7', 'maj7', 'dom7'],         // balanced warmth
    ['min7', 'maj7', 'maj9', 'dom7'],         // gentle arc
    ['dom7', 'maj7', 'min7', 'maj9'],         // resolving tension
    ['maj7', 'dom7', 'min7', 'maj9'],         // dynamic comfort
    ['maj9', 'dom7', 'maj7', 'min7'],         // floating resolution
    ['min7', 'maj9', 'dom7', 'maj7'],         // minor with brightness
  ],
  meditate: [
    // Sparse, minimal progressions for meditation (theta 4-7 Hz)
    ['root5th', 'rootOctave', 'root5th', 'maj7'],     // sparse, open
    ['maj7', 'root5th', 'rootOctave', 'root5th'],     // mostly space
    ['root5th', 'maj7', 'root5th', 'rootOctave'],     // alternating sparse
    ['rootOctave', 'root5th', 'maj7', 'root5th'],     // open grounded
    ['maj7', 'rootOctave', 'root5th', 'maj7'],        // sparse resolution
    ['root5th', 'root5th', 'rootOctave', 'maj7'],     // doubled sparse
    ['rootOctave', 'maj7', 'root5th', 'rootOctave'],  // grounding emphasis
    ['maj7', 'root5th', 'maj7', 'rootOctave'],        // minimal jazz
    ['root5th', 'rootOctave', 'maj7', 'root5th'],     // circular sparse
    ['rootOctave', 'root5th', 'rootOctave', 'maj7'],  // octave focus
    ['maj7', 'maj7', 'root5th', 'rootOctave'],        // sustained harmony
    ['root5th', 'maj7', 'rootOctave', 'maj7'],        // minimal expression
    ['rootOctave', 'rootOctave', 'maj7', 'root5th'],  // grounded sustained
    ['maj7', 'root5th', 'rootOctave', 'maj7'],        // gentle cycling
    ['root5th', 'rootOctave', 'rootOctave', 'maj7'],  // grounding with space
    ['rootOctave', 'maj7', 'maj7', 'root5th'],        // harmony emphasis
    ['maj7', 'rootOctave', 'maj7', 'root5th'],        // jazzy sparse
    ['root5th', 'maj7', 'maj7', 'rootOctave'],        // balanced minimal
    ['rootOctave', 'root5th', 'maj7', 'rootOctave'],  // return to grounding
    ['maj7', 'root5th', 'root5th', 'rootOctave'],     // sparse double
  ],
  sleep: [
    // Very simple, repetitive progressions for sleep (delta 0.5-3.5 Hz)
    ['maj7', 'min7', 'maj9', 'rootOctave'],           // dreamy
    ['maj7', 'maj7', 'min7', 'rootOctave'],           // very gentle
    ['maj9', 'rootOctave', 'maj7', 'min7'],           // floating
    ['rootOctave', 'maj7', 'min7', 'maj9'],           // grounded dreamy
    ['maj7', 'maj9', 'rootOctave', 'min7'],           // bright descent
    ['min7', 'maj7', 'rootOctave', 'maj9'],           // dark gentle
    ['maj9', 'maj7', 'min7', 'rootOctave'],           // floating gentle
    ['rootOctave', 'min7', 'maj7', 'maj9'],           // grounded dark
    ['maj7', 'rootOctave', 'maj9', 'min7'],           // alternating
    ['maj9', 'min7', 'rootOctave', 'maj7'],           // varied gentle
    ['min7', 'rootOctave', 'maj9', 'maj7'],           // dark to light
    ['rootOctave', 'maj9', 'maj7', 'min7'],           // floating grounded
    ['maj7', 'min7', 'rootOctave', 'maj9'],           // gentle emphasis
    ['maj9', 'rootOctave', 'min7', 'maj7'],           // floating with dark
    ['min7', 'maj9', 'maj7', 'rootOctave'],           // dark bright grounded
    ['rootOctave', 'maj7', 'maj9', 'min7'],           // grounded bright
    ['maj7', 'maj9', 'min7', 'rootOctave'],           // smooth descent
    ['maj9', 'maj7', 'rootOctave', 'min7'],           // floating resolution
    ['min7', 'maj7', 'maj9', 'rootOctave'],           // dark gentle grounded
    ['rootOctave', 'rootOctave', 'maj7', 'min7'],     // double grounded
    ['maj7', 'maj7', 'maj9', 'rootOctave'],           // sustained bright
    ['maj9', 'maj9', 'min7', 'maj7'],                 // floating double
  ],
};

// =============================================================================
// Drum patterns
// =============================================================================

/**
 * Drum pattern step sequences (16 steps per bar).
 * Each value is velocity (0 = silent, 0.1-1.0 = hit).
 */
export interface DrumPattern {
  kick:    number[];  // 16 steps
  snare:   number[];  // 16 steps
  hihat:   number[];  // 16 steps
  openHat: number[];  // 16 steps
}

/**
 * Lo-fi boom-bap drum patterns.
 * Multiple patterns per mood for variety.
 */
export const DRUM_PATTERNS: Record<string, DrumPattern[]> = {
  focus: [
    {
      kick:    [0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0],
      snare:   [0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0],
      hihat:   [0.5, 0, 0.4, 0, 0.5, 0, 0.4, 0, 0.5, 0, 0.4, 0, 0.5, 0, 0.4, 0],
      openHat: [0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      kick:    [0.9, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.8, 0, 0, 0, 0, 0],
      snare:   [0, 0, 0, 0, 0.8, 0, 0, 0.3, 0, 0, 0, 0, 0.7, 0, 0, 0.2],
      hihat:   [0.6, 0, 0.3, 0, 0.5, 0, 0.3, 0, 0.6, 0, 0.3, 0, 0.5, 0, 0.3, 0],
      openHat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4],
    },
  ],
  deepWork: [
    {
      // Sparser, slower feel
      kick:    [0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0],
      snare:   [0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0],
      hihat:   [0.4, 0, 0.3, 0, 0.4, 0, 0.3, 0, 0.4, 0, 0.3, 0, 0.4, 0, 0.3, 0],
      openHat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ],
  relax: [],     // No drums for relax
  meditate: [],  // No drums for meditate
  sleep: [],     // No drums for sleep
};

// =============================================================================
// Swing / groove
// =============================================================================

/**
 * Swing amount per mood (0 = straight, 0.5 = full triplet).
 * Applied to every other hi-hat step.
 */
export const MOOD_SWING: Record<string, number> = {
  focus: 0.15,
  deepWork: 0.1,
  relax: 0,
  meditate: 0,
  sleep: 0,
};
