/**
 * @argobeat/engine
 *
 * Mood-based audio engine with subtle target-rate modulation.
 *
 * Plays curated local music and ambient recordings with subtle modulation
 * (amplitude, spectral, spatial) applied to the content audio, not through
 * audible tones. Procedural generation remains available as a fallback.
 *
 * Users interact with moods (focus, deepWork, relax, meditate, sleep),
 * not raw frequencies. Every session is randomized for uniqueness.
 *
 * @packageDocumentation
 */

// Core engine
export { ArgoBeatEngine, default } from './engine.js';

// Mood system
export { MOODS, getMood, getEligibleSoundscapes } from './mood/moods.js';
export { generateSessionSeed } from './mood/randomizer.js';

// Soundscape system
export { SoundscapeManager } from './soundscape/manager.js';
export { FileMusicManager } from './soundscape/music-manager.js';
export {
  getVariationsForCategory,
  getVariation,
  getRandomVariation,
} from './soundscape/variations.js';

// Modulation system
export { buildModulationChain, destroyModulationChain } from './modulation/chain.js';

// Generative music (legacy procedural fallback)
export { GenerativeMusicEngine } from './music-gen/generative.js';

// Generative synthesis engine (Tone.js FM + brown noise — no files required)
export { GenerativeEngine } from './generative/index.js';
export type { MoodSynthConfig } from './generative/index.js';

// Audio analysis — feature extraction, reference profiles, AI comparison
export { FeatureExtractor, REFERENCE_PROFILES, getReference, compareToReference } from './analysis/index.js';
export type {
  FeatureSnapshot,
  SessionProfile,
  FeatureStats,
  ReferenceProfile,
  ComparisonResult,
  FeatureCheck,
} from './analysis/index.js';

// Markov melody generation
export { generateMarkovMelody, getMoodMarkovConfig, DEFAULT_MARKOV_CONFIG, MOOD_MARKOV_CONFIGS } from './music-gen/markov.js';
export type { MarkovMelodyConfig } from './music-gen/markov.js';

// User preferences
export { PreferenceManager } from './preferences.js';
export type { UserPreferenceProfile, TrackRating, TrackMetadata, LearnedPreferences, GenerationWeights } from './preferences.js';

// Version
export { VERSION } from './version.js';

// Re-export all types
export type {
  Mood,
  MoodConfig,
  SoundscapeCategory,
  BrainwaveBand,
  EntrainmentMethod,
  AudioSourceMode,
  ModulationConfig,
  AffinityEntry,
  SoundscapeVariation,
  SoundscapeParams,
  BandConfig,
  EQBand,
  AccentConfig,
  SoundscapeGraph,
  ModulationGraph,
  EngineState,
  EngineEvents,
  SessionSeed,
} from './types.js';
