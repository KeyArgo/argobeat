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
 *   longer creative/engineering routines. Stronger modulation preserves a
 *   measurable marker over 90-min sessions. Higher spectral center keeps the
 *   content from feeling too dull.
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
      amDepth: 0.30,          // 30% in 200-1kHz band — validated by Daly et al. 2024
      spectralDepthDb: 1.5,
      spectralCenterHz: 600,  // center of validated band; sweep stays 350–850 Hz
      panDepth: 0.0,          // disabled — no science supports panning as entrainment
      driftCycleSeconds: 120,
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
      amDepth: 0.35,
      spectralDepthDb: 1.8,
      spectralCenterHz: 650,  // sweep stays 400–900 Hz
      panDepth: 0.0,          // disabled — no science supports panning as entrainment
      driftCycleSeconds: 150,
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
      amDepth: 0.20,
      spectralDepthDb: 1.0,
      spectralCenterHz: 500,  // sweep stays 250–750 Hz
      panDepth: 0.02,         // very light spatial motion at 8-12 Hz is pleasant
      driftCycleSeconds: 140,
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
      amDepth: 0.12,
      spectralDepthDb: 0.6,
      spectralCenterHz: 460,  // 460 ±250 Hz = 210–710 Hz — stays above 200 Hz
      panDepth: 0.015,        // slight spatial movement at 4-7 Hz feels meditative
      driftCycleSeconds: 160,
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
      amDepth: 0.06,
      spectralDepthDb: 0.3,
      spectralCenterHz: 460,  // 460 ±250 Hz = 210–710 Hz — stays above 200 Hz for sleep warmth
      panDepth: 0.0,
      driftCycleSeconds: 200,
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
 * - **Focus/Deep Work:** Stimulating, cognitively-masking beds only. Steady
 *   continuous textures (noise, rain, stream, ocean) that mask distraction
 *   without introducing transients. Birdsong, fire, jungle, and cafe are
 *   opt-in only — their transients interrupt concentration.
 * - **Relax:** Natural, warm environments with pleasant organic movement.
 *   Ocean, forest, birdsong, jungle, fire. No noise (clinical, not relaxing),
 *   no thunder (startling), no cafe.
 * - **Meditate:** Specific resonant textures — gongs/singing bowls first,
 *   then cave and space drones. Everything else is opt-in only.
 * - **Sleep:** Very low stimulation. Continuous, transient-free textures only
 *   (ocean, rain, wind, brown noise). Birds, fire, jungle, thunder all
 *   ineligible — they activate rather than suppress arousal.
 */
export const MOOD_AFFINITIES: Record<Mood, AffinityEntry[]> = {
  focus: [
    { category: 'noise', weight: 0.92 },   // brown/pink noise — best cognitive mask
    { category: 'rain', weight: 0.88 },    // steady, non-distracting
    { category: 'stream', weight: 0.80 },  // flowing, steady
    { category: 'ocean', weight: 0.72 },   // rhythmic, continuous
    { category: 'thunder', weight: 0.58 }, // dynamic but steady backdrop
    { category: 'space', weight: 0.52 },   // immersive drone
    { category: 'forest', weight: 0.30 },  // opt-in — birds can distract
    { category: 'cave', weight: 0.20 },
    { category: 'wind', weight: 0.12 },
    { category: 'fire', weight: 0.08 },    // crackling transients distract
    { category: 'birds', weight: 0.05 },
    { category: 'jungle', weight: 0.05 },
    { category: 'cafe', weight: 0.05 },
    { category: 'gongs', weight: 0.0 },
  ],

  deepWork: [
    { category: 'noise', weight: 0.95 },   // maximum cognitive mask
    { category: 'rain', weight: 0.88 },
    { category: 'stream', weight: 0.82 },
    { category: 'space', weight: 0.78 },   // deep immersive drone
    { category: 'ocean', weight: 0.65 },
    { category: 'cave', weight: 0.55 },    // resonant, isolating
    { category: 'thunder', weight: 0.45 }, // slightly less — deep work needs steadiness
    { category: 'forest', weight: 0.20 },
    { category: 'wind', weight: 0.10 },
    { category: 'fire', weight: 0.08 },
    { category: 'birds', weight: 0.05 },
    { category: 'jungle', weight: 0.05 },
    { category: 'cafe', weight: 0.05 },
    { category: 'gongs', weight: 0.0 },
  ],

  relax: [
    { category: 'ocean', weight: 0.95 },   // waves — archetypal relaxation
    { category: 'forest', weight: 0.90 },  // birds + wind + leaves
    { category: 'birds', weight: 0.88 },   // birdsong — pleasant, warm
    { category: 'jungle', weight: 0.82 },  // lush, immersive nature
    { category: 'stream', weight: 0.78 },  // gentle flow
    { category: 'fire', weight: 0.75 },    // warm, cozy crackle
    { category: 'rain', weight: 0.62 },    // soft rain — still relaxing
    { category: 'gongs', weight: 0.30 },   // opt-in — bridges to meditate
    { category: 'wind', weight: 0.18 },
    { category: 'cave', weight: 0.12 },
    { category: 'space', weight: 0.08 },
    { category: 'noise', weight: 0.0 },    // not relaxing
    { category: 'thunder', weight: 0.0 },  // startling
    { category: 'cafe', weight: 0.0 },
  ],

  meditate: [
    { category: 'space', weight: 0.95 },   // expansive drone — available in current shipped tree
    { category: 'rain', weight: 0.55 },    // soft fallback that exists in current shipped tree
    { category: 'ocean', weight: 0.40 },   // gentle fallback that exists in current shipped tree
    { category: 'wind', weight: 0.28 },    // light air texture
    { category: 'gongs', weight: 0.20 },   // resonant bowls if/when shipped in this deployment
    { category: 'cave', weight: 0.10 },    // resonant void if available
    { category: 'stream', weight: 0.0 },   // missing in current public audio tree
    { category: 'forest', weight: 0.0 },   // missing in current public audio tree
    { category: 'noise', weight: 0.0 },
    { category: 'fire', weight: 0.0 },
    { category: 'birds', weight: 0.0 },    // distracting
    { category: 'jungle', weight: 0.0 },
    { category: 'thunder', weight: 0.0 },
    { category: 'cafe', weight: 0.0 },
  ],

  sleep: [
    { category: 'ocean', weight: 0.95 },   // continuous waves — best sleep onset
    { category: 'rain', weight: 0.92 },    // steady, soporific
    { category: 'noise', weight: 0.88 },   // brown noise — sleep science validated
    { category: 'wind', weight: 0.78 },    // soft, continuous
    { category: 'stream', weight: 0.35 },  // gentle babble — opt-in
    { category: 'gongs', weight: 0.20 },   // singing bowls for sleep transition
    { category: 'space', weight: 0.12 },
    { category: 'cave', weight: 0.08 },
    { category: 'forest', weight: 0.05 },  // birds risk waking
    { category: 'fire', weight: 0.0 },     // crackling transients
    { category: 'birds', weight: 0.0 },    // morning cues — activate arousal
    { category: 'jungle', weight: 0.0 },
    { category: 'thunder', weight: 0.0 },  // startling
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
