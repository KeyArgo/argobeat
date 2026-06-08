/**
 * Mood → synthesis parameter mapping.
 *
 * These values control how the generative engine sounds for each mood.
 * All ranges are [min, max]; the engine picks a random value at session
 * start and drifts it slowly via Perlin modulation.
 */

import type { Mood } from '../types.js';
import type { ScaleName } from './scales.js';

export interface MoodSynthConfig {
  /** BPM range [min, max], or null for non-rhythmic modes */
  bpm: [number, number] | null;
  /** Preferred scales (one is chosen at session start) */
  scales: ScaleName[];
  /** Pad filter cutoff range Hz [min, max] — used for noise texture layer */
  padFilter: [number, number];
  /** Pad volume 0–1 */
  padVolume: number;
  /** Arp present probability 0–1 */
  arpPresence: number;
  /** Arp note density (notes per beat) */
  arpDensity: number;
  /** Beat/kick present probability 0–1; 0 = never */
  beatPresence: number;
  /** Brown noise texture volume */
  textureVolume: number;
  /** Master reverb wet/dry 0–1 */
  reverbWet: number;
  /** Attack time for pads (seconds) */
  padAttack: number;
  /** Release time for pads (seconds) */
  padRelease: number;
}

export const MOOD_SYNTH_CONFIGS: Record<Mood, MoodSynthConfig> = {
  focus: {
    bpm:           [80, 92],
    scales:        ['dorian', 'phrygian', 'minor'],
    padFilter:     [550, 950],
    padVolume:     0.55,
    arpPresence:   0.65,
    arpDensity:    0.5,
    beatPresence:  0.3,
    textureVolume: 0.35,
    reverbWet:     0.45,
    padAttack:     3.5,
    padRelease:    5.0,
  },

  deepWork: {
    bpm:           [84, 96],
    scales:        ['phrygian', 'minor', 'dorian'],
    padFilter:     [400, 800],
    padVolume:     0.60,
    arpPresence:   0.40,
    arpDensity:    0.4,
    beatPresence:  0.5,
    textureVolume: 0.50,
    reverbWet:     0.35,
    padAttack:     4.0,
    padRelease:    6.0,
  },

  relax: {
    bpm:           [66, 80],
    scales:        ['lydian', 'major', 'pentatonic'],
    padFilter:     [700, 1400],
    padVolume:     0.50,
    arpPresence:   0.75,
    arpDensity:    0.6,
    beatPresence:  0.0,
    textureVolume: 0.25,
    reverbWet:     0.55,
    padAttack:     3.0,
    padRelease:    5.0,
  },

  meditate: {
    bpm:           null,
    scales:        ['pentatonic', 'dorian'],
    padFilter:     [300, 650],
    padVolume:     0.65,
    arpPresence:   0.0,
    arpDensity:    0,
    beatPresence:  0.0,
    textureVolume: 0.60,
    reverbWet:     0.70,
    padAttack:     6.0,
    padRelease:    10.0,
  },

  sleep: {
    bpm:           null,
    scales:        ['pentatonic', 'lydian'],
    padFilter:     [180, 420],
    padVolume:     0.45,
    arpPresence:   0.0,
    arpDensity:    0,
    beatPresence:  0.0,
    textureVolume: 0.75,
    reverbWet:     0.80,
    padAttack:     8.0,
    padRelease:    14.0,
  },
};
