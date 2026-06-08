/**
 * @argobeat/engine — Session Randomizer
 *
 * Generates per-session randomization seeds so that every play of the same
 * mood feels unique. Reduces repetitive listening fatigue by varying:
 *
 * - Target Hz within the mood's hzRange
 * - Soundscape category (weighted random from affinity matrix)
 * - Initial soundscape variation
 * - Drift LFO starting phase
 * - Crossfade interval between soundscape variations
 *
 * All randomization uses Math.random() — no crypto required for audio UX.
 * The returned SessionSeed is serializable for debugging/replay.
 *
 * @module @argobeat/engine/mood/randomizer
 */

import type { Mood, SessionSeed, SoundscapeCategory } from '../types.js';
import { getMood, getEligibleSoundscapes } from './moods.js';
import { getRandomVariation } from '../soundscape/variations.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum crossfade interval in milliseconds (90 seconds). */
const MIN_CROSSFADE_MS = 90 * 1000;

/** Maximum crossfade interval in milliseconds (4 minutes). */
const MAX_CROSSFADE_MS = 4 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete session seed for the given mood.
 *
 * The seed contains all random values needed to configure a unique session.
 * The engine calls this once at the start of each `play()` invocation.
 *
 * @param mood - The mood to generate a seed for.
 * @param categoryOverride - If provided and eligible for the mood, use this
 *   category instead of picking one from the affinity matrix. Incompatible
 *   overrides fall back to the mood's automatic pool.
 * @returns A fully populated {@link SessionSeed}.
 *
 * @example
 * ```ts
 * const seed = generateSessionSeed('focus');
 * console.log(seed.hz);       // e.g., 14.7 (random within 12-18)
 * console.log(seed.bpm);      // e.g., 77 (random within mood range)
 * console.log(seed.category); // e.g., 'rain' (weighted random)
 * ```
 */
export function generateSessionSeed(
  mood: Mood,
  categoryOverride?: SoundscapeCategory,
): SessionSeed {
  const config = getMood(mood);

  // 1. Random Hz within the mood's target-rate range
  const hz = randomInRange(config.hzRange[0], config.hzRange[1]);

  // 2. Random BPM for generative music patterns (mood-specific ranges)
  const bpm = generateMoodBpm(mood);

  // 3. Category: use only mood-compatible overrides, otherwise auto-select
  const category = resolveSoundscapeCategory(mood, categoryOverride);

  // 4. Random variation for the selected category
  const variation = getRandomVariation(category);
  const variationId = variation.id;

  // 5. Random drift phase (0 to 2*PI)
  const driftPhase = Math.random() * Math.PI * 2;

  // 6. Random crossfade interval
  const crossfadeIntervalMs = randomInRange(MIN_CROSSFADE_MS, MAX_CROSSFADE_MS);

  return {
    hz,
    bpm,
    category,
    variationId,
    driftPhase,
    crossfadeIntervalMs,
  };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve an optional explicit category through the mood-safe affinity pool.
 *
 * This keeps automatic playback and future API callers from forcing a
 * high-arousal category into sleep/meditation by accident.
 *
 * @internal
 */
function resolveSoundscapeCategory(
  mood: Mood,
  categoryOverride?: SoundscapeCategory,
): SoundscapeCategory {
  const eligible = getEligibleSoundscapes(mood);
  if (categoryOverride && eligible.some((entry) => entry.category === categoryOverride)) {
    return categoryOverride;
  }

  return pickWeightedEligibleCategory(eligible);
}

/**
 * Pick from an already-filtered eligible category list.
 *
 * @internal
 */
function pickWeightedEligibleCategory(eligible: ReturnType<typeof getEligibleSoundscapes>): SoundscapeCategory {
  // Sum weights for probability distribution
  const totalWeight = eligible.reduce((sum, entry) => sum + entry.weight, 0);

  // Weighted random selection
  let roll = Math.random() * totalWeight;
  for (const entry of eligible) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.category;
    }
  }

  // Fallback: return the highest-weighted category
  return eligible[0].category;
}

/**
 * Generate a random float within [min, max] (inclusive on both ends).
 *
 * @internal
 */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Generate a mood-specific BPM for generative music patterns.
 *
 * BPM is decoupled from the target-rate marker. Each mood has its own
 * typical tempo range:
 *
 * - focus: 70–85 BPM (steady, energetic lo-fi)
 * - deepWork: 65–75 BPM (slower, more relaxed lo-fi)
 * - relax: No beat-based patterns (returns 0)
 * - meditate: No beat-based patterns (returns 0)
 * - sleep: 50–70 BPM (very slow, settling)
 *
 * @param mood - The mood to generate BPM for.
 * @returns An integer BPM value within the mood's range.
 *
 * @internal
 */
function generateMoodBpm(mood: Mood): number {
  switch (mood) {
    case 'focus':
      return Math.floor(randomInRange(70, 85));
    case 'deepWork':
      return Math.floor(randomInRange(65, 75));
    case 'sleep':
      return Math.floor(randomInRange(50, 70));
    case 'relax':
    case 'meditate':
      // These moods don't use beat-based patterns
      return 0;
    default:
      return 75;
  }
}
