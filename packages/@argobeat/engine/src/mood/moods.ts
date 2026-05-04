/**
 * @argobeat/engine — Mood definitions and affinity matrix
 *
 * Defines all 5 moods with their complete configs (target-rate audio ranges,
 * modulation parameters, session defaults, UI colors) and the soundscape
 * affinity matrix that controls which ambient environments pair well
 * with each mood.
 *
 * Psychoacoustic reasoning for each mood:
 *
 * - **Focus (beta 12–18 Hz):** Mid-beta for sustained attention without
 *   anxiety. Slightly below high-beta to avoid restlessness. Moderate
 *   modulation keeps the audio marker present. 25-min Pomodoro default.
 *
 * - **Deep Work (beta 16–20 Hz):** Upper-beta-inspired target range for
 *   complex creative/engineering routines. Stronger modulation preserves a
 *   measurable marker over 25-minute sessions. Higher spectral center keeps
 *   the content from feeling too dull.
 *
 * - **Relax (alpha 8–12 Hz):** Classic alpha for calm alertness. Gentle
 *   modulation — too strong disrupts the relaxation response. Lower
 *   spectral center, wider drift for organic feel.
 *
 * - **Meditate (theta 4–7 Hz):** Theta-inspired range for mindfulness routines.
 *   Minimal modulation — meditation works best with subtle guidance,
 *   not forceful pulsing. Longest drift cycles for stability.
 *
 * - **Sleep (delta 0.5–3.5 Hz):** Deep delta for sleep onset. Lightest
 *   possible modulation — anything perceptible keeps the user awake.
 *   Long fade-out so the audio gently disappears as sleep arrives.
 */

import type {
  Mood,
  MoodConfig,
  SoundscapeCategory,
  AffinityEntry,
} from '../types.js';

// ---------------------------------------------------------------------------
// Mood Configs
// ---------------------------------------------------------------------------

/**
 * Complete configuration for all 5 moods.
 *
 * Access by mood ID: `MOODS.focus`, `MOODS.sleep`, etc.
 * All values are production-tuned defaults. Users can override
 * `sessionMinutes` and the engine can randomize `defaultHz` within
 * `hzRange` per session.
 */
export const MOODS: Record<Mood, MoodConfig> = {
  focus: {
    id: 'focus',
    label: 'Focus',
    description: 'Sharp concentration for reading, coding, and detail work',
    band: 'beta',
    hzRange: [12, 18],
    defaultHz: 15,
    driftRange: 1.5,
    sessionMinutes: 25,
    fadeInMs: 2500,
    fadeOutMs: 2000,
    modulation: {
      amDepth: 0.10,
      spectralDepthDb: 3.0,
      spectralCenterHz: 1200,
      panDepth: 0.15,
      driftCycleSeconds: 90,
    },
    color: {
      primary: '#3b82f6',
      glow: 'rgba(59,130,246,0.3)',
      gradient: ['#3b82f6', '#1d4ed8'],
    },
  },

  deepWork: {
    id: 'deepWork',
    label: 'Deep Work',
    description: 'Sustained flow for complex creative and engineering sessions',
    band: 'beta',
    hzRange: [16, 20],
    defaultHz: 18,
    driftRange: 1.0,
    sessionMinutes: 25,
    fadeInMs: 3000,
    fadeOutMs: 2500,
    modulation: {
      amDepth: 0.12,
      spectralDepthDb: 3.5,
      spectralCenterHz: 1100,
      panDepth: 0.18,
      driftCycleSeconds: 90,
    },
    color: {
      primary: '#6366f1',
      glow: 'rgba(99,102,241,0.3)',
      gradient: ['#6366f1', '#4338ca'],
    },
  },

  relax: {
    id: 'relax',
    label: 'Relax',
    description: 'Gentle calm for unwinding, casual reading, and decompression',
    band: 'alpha',
    hzRange: [8, 12],
    defaultHz: 10,
    driftRange: 1.5,
    sessionMinutes: 20,
    fadeInMs: 3500,
    fadeOutMs: 3000,
    modulation: {
      amDepth: 0.07,
      spectralDepthDb: 2.0,
      spectralCenterHz: 800,
      panDepth: 0.10,
      driftCycleSeconds: 120,
    },
    color: {
      primary: '#10b981',
      glow: 'rgba(16,185,129,0.3)',
      gradient: ['#10b981', '#059669'],
    },
  },

  meditate: {
    id: 'meditate',
    label: 'Meditate',
    description: 'Mindful stillness for breathwork, body scans, and sitting practice',
    band: 'theta',
    hzRange: [4, 7],
    defaultHz: 6,
    driftRange: 1.0,
    sessionMinutes: 20,
    fadeInMs: 4000,
    fadeOutMs: 3500,
    modulation: {
      amDepth: 0.045,
      spectralDepthDb: 1.0,
      spectralCenterHz: 560,
      panDepth: 0.05,
      driftCycleSeconds: 150,
    },
    color: {
      primary: '#a855f7',
      glow: 'rgba(168,85,247,0.3)',
      gradient: ['#a855f7', '#7e22ce'],
    },
  },

  sleep: {
    id: 'sleep',
    label: 'Sleep',
    description: 'Low-arousal audio for sleep onset and quiet rest',
    band: 'delta',
    hzRange: [0.5, 3.5],
    defaultHz: 2,
    driftRange: 0.5,
    sessionMinutes: 30,
    fadeInMs: 5000,
    fadeOutMs: 8000,
    modulation: {
      amDepth: 0.035,
      spectralDepthDb: 0.8,
      spectralCenterHz: 420,
      panDepth: 0.04,
      driftCycleSeconds: 180,
    },
    color: {
      primary: '#475569',
      glow: 'rgba(71,85,105,0.25)',
      gradient: ['#475569', '#1e293b'],
    },
  },
};

// ---------------------------------------------------------------------------
// Affinity Matrix
// ---------------------------------------------------------------------------

/**
 * Soundscape affinity matrix for all moods.
 *
 * Each mood lists all 9 soundscape categories with a weight (0.0–1.0).
 * Categories with `weight >= 0.5` are eligible for automatic selection.
 * Higher weights increase selection probability via weighted random sampling.
 *
 * Design rationale:
 * - **Focus/Deep Work:** Steady, non-distracting nature beds score highest
 *   (rain, rivers/streams, soft forest, coast, and wind through trees).
 *   Busy or transient beds remain opt-in only.
 * - **Relax:** Natural environments with gentle movement (ocean, stream, forest).
 * - **Meditate:** Minimal, spacious textures (wind and resonant drones).
 *   Busy environments (cafe) are contraindicated.
 * - **Sleep:** Low-frequency, continuous textures (ocean, rain, wind).
 *   Anything with sharp transients (cafe, thunder, crackly fire) is opt-in only.
 */
export const MOOD_AFFINITIES: Record<Mood, AffinityEntry[]> = {
  focus: [
    { category: 'rain', weight: 0.90 },
    { category: 'forest', weight: 0.82 },
    { category: 'stream', weight: 0.75 },
    { category: 'ocean', weight: 0.65 },
    { category: 'thunder', weight: 0.55 },
    { category: 'cafe', weight: 0.30 },
    { category: 'space', weight: 0.22 },
    { category: 'fire', weight: 0.18 },
    { category: 'jungle', weight: 0.15 },
    { category: 'wind', weight: 0.10 },
    { category: 'gongs', weight: 0.0 },
  ],

  deepWork: [
    { category: 'rain', weight: 0.88 },
    { category: 'stream', weight: 0.78 },
    { category: 'space', weight: 0.72 },
    { category: 'forest', weight: 0.68 },
    { category: 'ocean', weight: 0.58 },
    { category: 'thunder', weight: 0.52 },
    { category: 'fire', weight: 0.22 },
    { category: 'cafe', weight: 0.18 },
    { category: 'jungle', weight: 0.12 },
    { category: 'wind', weight: 0.10 },
    { category: 'gongs', weight: 0.0 },
  ],

  relax: [
    { category: 'ocean', weight: 0.92 },
    { category: 'forest', weight: 0.88 },
    { category: 'jungle', weight: 0.82 },
    { category: 'stream', weight: 0.80 },
    { category: 'fire', weight: 0.72 },
    { category: 'rain', weight: 0.65 },
    { category: 'gongs', weight: 0.35 },
    { category: 'space', weight: 0.25 },
    { category: 'cafe', weight: 0.22 },
    { category: 'wind', weight: 0.10 },
    { category: 'thunder', weight: 0.05 },
  ],

  meditate: [
    { category: 'gongs', weight: 0.95 },
    { category: 'stream', weight: 0.45 },
    { category: 'ocean', weight: 0.30 },
    { category: 'forest', weight: 0.25 },
    { category: 'rain', weight: 0.15 },
    { category: 'fire', weight: 0.10 },
    { category: 'jungle', weight: 0.08 },
    { category: 'space', weight: 0.05 },
    { category: 'wind', weight: 0.0 },
    { category: 'thunder', weight: 0.0 },
    { category: 'cafe', weight: 0.0 },
  ],

  sleep: [
    { category: 'ocean', weight: 0.95 },
    { category: 'rain', weight: 0.88 },
    { category: 'gongs', weight: 0.35 },
    { category: 'stream', weight: 0.28 },
    { category: 'forest', weight: 0.20 },
    { category: 'space', weight: 0.12 },
    { category: 'fire', weight: 0.10 },
    { category: 'jungle', weight: 0.05 },
    { category: 'wind', weight: 0.0 },
    { category: 'thunder', weight: 0.0 },
    { category: 'cafe', weight: 0.0 },
  ],
};

// ---------------------------------------------------------------------------
// Lookup Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the full configuration for a mood.
 *
 * @param id - The mood to look up
 * @returns The complete {@link MoodConfig} for the given mood
 *
 * @example
 * ```ts
 * const config = getMood('focus');
 * console.log(config.hzRange); // [12, 18]
 * ```
 */
export function getMood(id: Mood): MoodConfig {
  return MOODS[id];
}

/**
 * Returns the full affinity list for a mood (all 9 categories).
 *
 * Includes all categories regardless of weight, sorted by weight descending.
 * Use {@link getEligibleSoundscapes} if you only want categories above
 * the eligibility threshold.
 *
 * @param mood - The mood to look up affinities for
 * @returns Array of all {@link AffinityEntry} values, sorted by weight descending
 *
 * @example
 * ```ts
 * const all = getMoodAffinities('sleep');
 * console.log(all[0]); // { category: 'ocean', weight: 0.9 }
 * ```
 */
export function getMoodAffinities(mood: Mood): AffinityEntry[] {
  return [...MOOD_AFFINITIES[mood]].sort((a, b) => b.weight - a.weight);
}

/**
 * Returns only the soundscape categories eligible for automatic selection
 * (weight >= 0.5), sorted by weight descending.
 *
 * The engine uses this to build the candidate pool for weighted random
 * selection when starting a new session.
 *
 * @param mood - The mood to filter eligible soundscapes for
 * @returns Array of {@link AffinityEntry} values with weight >= 0.5
 *
 * @example
 * ```ts
 * const eligible = getEligibleSoundscapes('meditate');
 * // Returns the current automatic pool, sorted by affinity weight.
 * ```
 */
export function getEligibleSoundscapes(mood: Mood): AffinityEntry[] {
  return MOOD_AFFINITIES[mood]
    .filter((entry) => entry.weight >= 0.5)
    .sort((a, b) => b.weight - a.weight);
}
