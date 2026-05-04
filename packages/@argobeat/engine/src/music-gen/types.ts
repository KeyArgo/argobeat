/**
 * @module types
 * @description Core interfaces for the ArgoBeat generative music system.
 *
 * These types define the contract between the high-level session controller
 * and the low-level voice/pattern generators. They are intentionally kept
 * free of Web Audio API references so they can be used in workers, tests,
 * and server-side rendering contexts.
 */

import type { ScaleType, ChordVoicing, MoodMusicConfig } from './scales.js';

// =============================================================================
// Session configuration
// =============================================================================

/**
 * Top-level configuration for a generative music session.
 *
 * This is the single object the UI passes to the engine when the user
 * presses play. Everything else is derived from these values.
 */
export interface GenerativeMusicConfig {
  /** The mood/mode to generate for (e.g. 'focus', 'sleep', 'meditate'). */
  mood: string;

  /**
   * Integer seed for the PRNG. Same seed + same mood = identical session.
   * Use `Date.now()` or `Math.random() * 0x7fffffff | 0` for variety.
   */
  seed: number;

  /**
   * Target modulation frequency in Hz.
   * Typical values: 15 Hz (focus), 10 Hz (relax), 6 Hz (meditate), 2 Hz (sleep).
   */
  entrainmentHz: number;

  /**
   * Total session duration in seconds.
   * The evolution curve is normalised to this length.
   */
  sessionDurationSeconds: number;

  /**
   * Master gain for generative music relative to the soundscape layer (0-1).
   * At 0 only the soundscape is audible; at 1 music is at full level.
   */
  blendGain: number;
}

// =============================================================================
// Session evolution
// =============================================================================

/**
 * A single point on the session evolution curve.
 *
 * The engine interpolates between these points over the session duration
 * to create gradual shifts in texture, density, and brightness. This is
 * what makes a 60-minute session feel alive rather than static.
 *
 * Typical sessions define 4-8 evolution points (intro, build, plateau,
 * wind-down, outro).
 */
export interface EvolutionPoint {
  /**
   * Position in the session as a ratio (0 = start, 1 = end).
   * Points must be in ascending order.
   */
  timeRatio: number;

  /**
   * Low-pass filter cutoff in Hz at this point.
   * Lower values = darker/warmer; higher = brighter/more present.
   */
  filterCutoff: number;

  /**
   * Master volume multiplier at this point (0-1).
   * Used for fade-in at the start and fade-out at the end.
   */
  volume: number;

  /**
   * Event density: how many note events to schedule per phrase.
   * Higher density = more melodic activity. Range depends on mood
   * (sleep might use 1-3; focus might use 4-8).
   */
  density: number;

  /**
   * Pitch detune in cents applied to oscillators.
   * Small values (2-8) add warmth/chorus; larger values (10-25)
   * create a more unsettled, evolving character.
   */
  detuneCents: number;

  /**
   * Probability (0-1) that a pattern variation is introduced on a given phrase.
   * 0 = perfectly repetitive; 1 = every phrase is different.
   */
  variationProb: number;
}

// =============================================================================
// Voice envelope
// =============================================================================

/**
 * Standard ADSR envelope parameters for a synthesised voice.
 *
 * All times are in seconds. Used by both pad and melody voices.
 *
 * ```
 *   1.0 |    /\
 *       |   /  \________
 *   S   |  /            \
 *       | /              \
 *   0.0 +--A--D----S----R--
 * ```
 */
export interface VoiceEnvelope {
  /** Attack time (seconds). How long to ramp from 0 to peak. */
  attack: number;

  /** Decay time (seconds). How long to ramp from peak to sustain level. */
  decay: number;

  /** Sustain level (0-1). Held while the note is active. */
  sustain: number;

  /** Release time (seconds). How long to ramp from sustain to 0 after note-off. */
  release: number;
}

// =============================================================================
// Pattern note
// =============================================================================

/**
 * A single scheduled note event within a pattern.
 *
 * Pattern notes are pre-computed by the pattern generator and then handed
 * to the voice scheduler, which creates the actual Web Audio nodes.
 *
 * Times are in AudioContext time (seconds since context creation), not
 * relative to the pattern start. The pattern generator is responsible for
 * converting phrase-relative offsets to absolute AudioContext times.
 */
export interface PatternNote {
  /** Frequency of the note in Hz. */
  freq: number;

  /** Absolute AudioContext time at which the note should begin (seconds). */
  time: number;

  /** Duration of the note in seconds (attack + sustain portion). */
  duration: number;

  /** Velocity / loudness of this note (0-1). Maps to gain. */
  velocity: number;
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

// Re-export scale-related types so consumers can import everything from types
export type { ScaleType, ChordVoicing, MoodMusicConfig };
