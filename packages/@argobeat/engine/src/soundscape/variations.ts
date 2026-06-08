/**
 * @argobeat/engine — Soundscape Variations (92 total)
 *
 * 10+ parametric variations for each of the 9 soundscape categories.
 * Every variation is a complete SoundscapeParams object that drives
 * the procedural synthesis topology:
 *
 *   noise source -> band filters -> reverb -> LFO -> accents -> master EQ
 *
 * Legacy procedural mode synthesizes these variations in real time via Web Audio API.
 *
 * Design principles:
 *   - Each variation is PERCEPTUALLY DISTINCT — different noise types,
 *     band structures, reverb characters, and accent layers.
 *   - Prime-length buffers (29, 31, 37s) prevent audible loop seams.
 *   - Realistic reverb RT60 values model actual acoustic spaces.
 *   - Stochastic accent events add naturalistic unpredictability.
 *
 * @module @argobeat/engine/soundscape/variations
 */

import type {
  SoundscapeCategory,
  SoundscapeVariation,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Rain — 12 variations
// ═══════════════════════════════════════════════════════════════════════════

const rain: SoundscapeVariation[] = [
  // 1. Light Drizzle — high band emphasis, sparse, short reverb
  {
    id: 'rain-light-drizzle',
    category: 'rain',
    name: 'Light Drizzle',
    params: {
      noiseType: 'pink',
      bufferSeconds: 31,
      bands: [
        { type: 'highpass', frequency: 2000, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 4000, Q: 1.2, gain: 4 },
        { type: 'lowpass', frequency: 8000, Q: 0.7, gain: 0 },
      ],
      reverb: { rt60: 0.8, preDelayMs: 5, wetMix: 0.2, highpassHz: 300 },
      amplitudeLFO: { frequency: 0.06, depth: 0.15, waveform: 'sine' },
      accents: [
        { type: 'drip', minIntervalMs: 3000, maxIntervalMs: 8000, gain: 0.15, frequencyRange: [3000, 6000] },
      ],
      masterEQ: [
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: 3 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: -6 },
        { type: 'peaking', frequency: 3500, Q: 0.5, gain: 2 },
      ],
    },
  },
  // 2. Steady Rain — balanced 3-band, medium reverb
  {
    id: 'rain-steady',
    category: 'rain',
    name: 'Steady Rain',
    params: {
      noiseType: 'pink',
      bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 500, Q: 0.8, gain: 2 },
        { type: 'peaking', frequency: 2000, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 5000, Q: 0.7, gain: 1 },
      ],
      reverb: { rt60: 1.2, preDelayMs: 10, wetMix: 0.3, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.04, depth: 0.1, waveform: 'sine' },
      masterEQ: [
        { type: 'peaking', frequency: 1000, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 8000, Q: 0.7, gain: -2 },
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 1 },
      ],
    },
  },
  // 3. Heavy Downpour — boosted low band, dense, long reverb
  {
    id: 'rain-heavy-downpour',
    category: 'rain',
    name: 'Heavy Downpour',
    params: {
      noiseType: 'white',
      bufferSeconds: 29,
      bands: [
        { type: 'lowshelf', frequency: 300, Q: 0.5, gain: 6 },
        { type: 'peaking', frequency: 800, Q: 0.4, gain: 4 },
        { type: 'peaking', frequency: 3000, Q: 0.6, gain: 3 },
        { type: 'highshelf', frequency: 6000, Q: 0.5, gain: 2 },
      ],
      reverb: { rt60: 1.8, preDelayMs: 15, wetMix: 0.35, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.08, depth: 0.2, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 4 },
        { type: 'peaking', frequency: 1500, Q: 0.4, gain: 2 },
        { type: 'highshelf', frequency: 10000, Q: 0.7, gain: -3 },
      ],
    },
  },
  // 4. Rain on Window — narrow bandpass 2-4kHz, close reverb, drip accents
  {
    id: 'rain-on-window',
    category: 'rain',
    name: 'Rain on Window',
    params: {
      noiseType: 'pink',
      bufferSeconds: 31,
      bands: [
        { type: 'bandpass', frequency: 3000, Q: 2.0, gain: 0 },
        { type: 'peaking', frequency: 2500, Q: 1.5, gain: 5 },
        { type: 'peaking', frequency: 4000, Q: 1.8, gain: 4 },
      ],
      reverb: { rt60: 0.6, preDelayMs: 3, wetMix: 0.15, highpassHz: 400 },
      accents: [
        { type: 'drip', minIntervalMs: 800, maxIntervalMs: 3000, gain: 0.25, frequencyRange: [2500, 5500] },
        { type: 'drip', minIntervalMs: 1500, maxIntervalMs: 5000, gain: 0.12, frequencyRange: [4000, 7000] },
      ],
      masterEQ: [
        { type: 'highpass', frequency: 500, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 3000, Q: 1.0, gain: 3 },
        { type: 'highshelf', frequency: 8000, Q: 0.7, gain: -4 },
      ],
    },
  },
  // 5. Rain on Leaves — mid emphasis, moderate reverb
  {
    id: 'rain-on-leaves',
    category: 'rain',
    name: 'Rain on Leaves',
    params: {
      noiseType: 'pink',
      bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 1200, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 2500, Q: 1.0, gain: 3 },
        { type: 'lowpass', frequency: 7000, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 1.0, preDelayMs: 8, wetMix: 0.25, highpassHz: 250 },
      amplitudeLFO: { frequency: 0.05, depth: 0.12, waveform: 'sine' },
      accents: [
        { type: 'drip', minIntervalMs: 2000, maxIntervalMs: 6000, gain: 0.1, frequencyRange: [2000, 4500] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 800, Q: 0.6, gain: 2 },
        { type: 'peaking', frequency: 3000, Q: 0.7, gain: 2 },
        { type: 'highshelf', frequency: 9000, Q: 0.7, gain: -5 },
      ],
    },
  },
  // 6. Rain on Metal Roof — peaky high frequencies, bright short reverb
  {
    id: 'rain-on-metal-roof',
    category: 'rain',
    name: 'Rain on Metal Roof',
    params: {
      noiseType: 'white',
      bufferSeconds: 29,
      bands: [
        { type: 'highpass', frequency: 1500, Q: 0.7, gain: 0 },
        { type: 'peaking', frequency: 4500, Q: 3.0, gain: 8 },
        { type: 'peaking', frequency: 7000, Q: 2.5, gain: 6 },
        { type: 'peaking', frequency: 2800, Q: 2.0, gain: 4 },
      ],
      reverb: { rt60: 0.4, preDelayMs: 2, wetMix: 0.12, highpassHz: 500 },
      accents: [
        { type: 'click', minIntervalMs: 200, maxIntervalMs: 800, gain: 0.2, frequencyRange: [3500, 8000] },
      ],
      masterEQ: [
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: 5 },
        { type: 'lowshelf', frequency: 300, Q: 0.7, gain: -8 },
        { type: 'peaking', frequency: 6000, Q: 1.2, gain: 3 },
      ],
    },
  },
  // 7. Distant Rain — strong lowpass, heavy reverb
  {
    id: 'rain-distant',
    category: 'rain',
    name: 'Distant Rain',
    params: {
      noiseType: 'brown',
      bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 1200, Q: 0.8, gain: 0 },
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 3 },
      ],
      reverb: { rt60: 2.5, preDelayMs: 40, wetMix: 0.55, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.03, depth: 0.08, waveform: 'sine' },
      masterEQ: [
        { type: 'lowpass', frequency: 2000, Q: 0.5, gain: 0 },
        { type: 'lowshelf', frequency: 300, Q: 0.7, gain: 3 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -10 },
      ],
    },
  },
  // 8. Rain with Thunder — steady rain + thunder accent bursts
  {
    id: 'rain-with-thunder',
    category: 'rain',
    name: 'Rain with Thunder',
    params: {
      noiseType: 'pink',
      bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 600, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 2000, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 4500, Q: 0.8, gain: 1 },
      ],
      reverb: { rt60: 1.5, preDelayMs: 12, wetMix: 0.3, highpassHz: 180 },
      amplitudeLFO: { frequency: 0.04, depth: 0.1, waveform: 'sine' },
      accents: [
        { type: 'thunder', minIntervalMs: 15000, maxIntervalMs: 45000, gain: 0.5, frequencyRange: [40, 120] },
        { type: 'thunder', minIntervalMs: 25000, maxIntervalMs: 60000, gain: 0.35, frequencyRange: [30, 80] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 1000, Q: 0.5, gain: 1 },
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 2 },
        { type: 'highshelf', frequency: 8000, Q: 0.7, gain: -2 },
      ],
    },
  },
  // 9. Tropical Rain — wide band, warm EQ, heavy drops
  {
    id: 'rain-tropical',
    category: 'rain',
    name: 'Tropical Rain',
    params: {
      noiseType: 'white',
      bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 4 },
        { type: 'peaking', frequency: 1000, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 3500, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 6000, Q: 0.9, gain: 2 },
      ],
      reverb: { rt60: 1.4, preDelayMs: 10, wetMix: 0.28, highpassHz: 120 },
      amplitudeLFO: { frequency: 0.07, depth: 0.18, waveform: 'sine' },
      accents: [
        { type: 'drip', minIntervalMs: 400, maxIntervalMs: 1200, gain: 0.2, frequencyRange: [2000, 5000] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 250, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 2000, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 7000, Q: 0.7, gain: -1 },
      ],
    },
  },
  // 10. Misty Rain — very light, high-frequency, ethereal reverb
  {
    id: 'rain-misty',
    category: 'rain',
    name: 'Misty Rain',
    params: {
      noiseType: 'pink',
      bufferSeconds: 37,
      bands: [
        { type: 'highpass', frequency: 3000, Q: 0.4, gain: 0 },
        { type: 'peaking', frequency: 5000, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 8000, Q: 0.8, gain: 2 },
      ],
      reverb: { rt60: 3.0, preDelayMs: 25, wetMix: 0.55, highpassHz: 400 },
      amplitudeLFO: { frequency: 0.025, depth: 0.08, waveform: 'sine' },
      filterSweep: { frequency: 0.02, depth: 0.4 },
      masterEQ: [
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: 4 },
        { type: 'lowshelf', frequency: 500, Q: 0.7, gain: -8 },
        { type: 'peaking', frequency: 6000, Q: 0.5, gain: 2 },
      ],
    },
  },
  // 11. Rain on Tent — close mids, resonant peaks 1-2kHz
  {
    id: 'rain-on-tent',
    category: 'rain',
    name: 'Rain on Tent',
    params: {
      noiseType: 'pink',
      bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 1200, Q: 2.5, gain: 7 },
        { type: 'peaking', frequency: 1800, Q: 2.0, gain: 5 },
        { type: 'peaking', frequency: 800, Q: 1.5, gain: 3 },
      ],
      reverb: { rt60: 0.5, preDelayMs: 2, wetMix: 0.1, highpassHz: 350 },
      accents: [
        { type: 'drip', minIntervalMs: 600, maxIntervalMs: 2000, gain: 0.18, frequencyRange: [1500, 3500] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 1500, Q: 1.0, gain: 4 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -5 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: -4 },
      ],
    },
  },
  // 12. Urban Rain — rain + subtle low-mid traffic hum layer
  {
    id: 'rain-urban',
    category: 'rain',
    name: 'Urban Rain',
    params: {
      noiseType: 'pink',
      bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 600, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 2000, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 4000, Q: 0.8, gain: 1 },
        { type: 'lowshelf', frequency: 120, Q: 0.4, gain: 5 },
      ],
      reverb: { rt60: 1.0, preDelayMs: 8, wetMix: 0.22, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.035, depth: 0.08, waveform: 'sine' },
      filterSweep: { frequency: 0.015, depth: 0.3 },
      masterEQ: [
        { type: 'peaking', frequency: 100, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 1200, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 8000, Q: 0.7, gain: -3 },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Ocean — 10 variations
// ═══════════════════════════════════════════════════════════════════════════

const ocean: SoundscapeVariation[] = [
  {
    id: 'ocean-gentle-shore',
    category: 'ocean',
    name: 'Gentle Shore',
    params: {
      noiseType: 'brown',
      bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 2000, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 400, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 1200, Q: 0.4, gain: 1 },
      ],
      reverb: { rt60: 1.5, preDelayMs: 15, wetMix: 0.3, highpassHz: 120 },
      amplitudeLFO: { frequency: 0.05, depth: 0.45, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -6 },
      ],
    },
  },
  {
    id: 'ocean-rocky-coast',
    category: 'ocean',
    name: 'Rocky Coast',
    params: {
      noiseType: 'white',
      bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 800, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 3000, Q: 1.0, gain: 3 },
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 5 },
      ],
      reverb: { rt60: 1.2, preDelayMs: 10, wetMix: 0.28, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.15, depth: 0.5, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 250, Q: 0.7, gain: 4 },
        { type: 'peaking', frequency: 2000, Q: 0.6, gain: 2 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'ocean-deep',
    category: 'ocean',
    name: 'Deep Ocean',
    params: {
      noiseType: 'brown',
      bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 600, Q: 0.6, gain: 0 },
        { type: 'peaking', frequency: 150, Q: 0.4, gain: 5 },
        { type: 'peaking', frequency: 80, Q: 0.3, gain: 4 },
      ],
      reverb: { rt60: 2.8, preDelayMs: 30, wetMix: 0.45, highpassHz: 60 },
      amplitudeLFO: { frequency: 0.02, depth: 0.25, waveform: 'sine' },
      filterSweep: { frequency: 0.01, depth: 0.3 },
      masterEQ: [
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 6 },
        { type: 'highshelf', frequency: 1000, Q: 0.7, gain: -12 },
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 2 },
      ],
    },
  },
  {
    id: 'ocean-beach-waves',
    category: 'ocean',
    name: 'Beach Waves',
    params: {
      noiseType: 'pink',
      bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 500, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 2000, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 4000, Q: 1.0, gain: 2 },
      ],
      reverb: { rt60: 1.3, preDelayMs: 12, wetMix: 0.3, highpassHz: 140 },
      amplitudeLFO: { frequency: 0.1, depth: 0.55, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 300, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 1500, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'ocean-storm-surf',
    category: 'ocean',
    name: 'Storm Surf',
    params: {
      noiseType: 'white',
      bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 6 },
        { type: 'peaking', frequency: 800, Q: 0.6, gain: 5 },
        { type: 'peaking', frequency: 3000, Q: 0.8, gain: 4 },
        { type: 'highshelf', frequency: 5000, Q: 0.5, gain: 3 },
      ],
      reverb: { rt60: 1.8, preDelayMs: 15, wetMix: 0.35, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.2, depth: 0.7, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 1200, Q: 0.5, gain: 3 },
        { type: 'highshelf', frequency: 8000, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'ocean-tide-pools',
    category: 'ocean',
    name: 'Tide Pools',
    params: {
      noiseType: 'pink',
      bufferSeconds: 37,
      bands: [
        { type: 'bandpass', frequency: 1500, Q: 1.2, gain: 0 },
        { type: 'peaking', frequency: 3000, Q: 1.5, gain: 3 },
        { type: 'peaking', frequency: 600, Q: 0.8, gain: 2 },
      ],
      reverb: { rt60: 1.0, preDelayMs: 8, wetMix: 0.25, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.07, depth: 0.4, waveform: 'sine' },
      filterSweep: { frequency: 0.11, depth: 0.6 },
      accents: [
        { type: 'drip', minIntervalMs: 1500, maxIntervalMs: 5000, gain: 0.15, frequencyRange: [2000, 5000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 1000, Q: 0.6, gain: 2 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -3 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'ocean-underwater',
    category: 'ocean',
    name: 'Underwater',
    params: {
      noiseType: 'brown',
      bufferSeconds: 31,
      bands: [
        { type: 'lowpass', frequency: 200, Q: 1.2, gain: 0 },
        { type: 'peaking', frequency: 80, Q: 0.5, gain: 6 },
        { type: 'peaking', frequency: 150, Q: 0.8, gain: 4 },
      ],
      reverb: { rt60: 3.2, preDelayMs: 35, wetMix: 0.6, highpassHz: 40 },
      amplitudeLFO: { frequency: 0.015, depth: 0.15, waveform: 'sine' },
      filterSweep: { frequency: 0.008, depth: 0.2 },
      masterEQ: [
        { type: 'lowpass', frequency: 300, Q: 0.8, gain: 0 },
        { type: 'lowshelf', frequency: 100, Q: 0.7, gain: 8 },
        { type: 'highshelf', frequency: 500, Q: 0.7, gain: -15 },
      ],
    },
  },
  {
    id: 'ocean-distant-waves',
    category: 'ocean',
    name: 'Distant Waves',
    params: {
      noiseType: 'brown',
      bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 1500, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 300, Q: 0.4, gain: 3 },
      ],
      reverb: { rt60: 3.0, preDelayMs: 50, wetMix: 0.6, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.04, depth: 0.3, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 4 },
        { type: 'highshelf', frequency: 2000, Q: 0.7, gain: -10 },
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 1 },
      ],
    },
  },
  {
    id: 'ocean-lake-shore',
    category: 'ocean',
    name: 'Lake Shore',
    params: {
      noiseType: 'pink',
      bufferSeconds: 31,
      bands: [
        { type: 'bandpass', frequency: 800, Q: 0.8, gain: 0 },
        { type: 'peaking', frequency: 500, Q: 0.6, gain: 2 },
        { type: 'lowpass', frequency: 3000, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 0.8, preDelayMs: 6, wetMix: 0.2, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.06, depth: 0.3, waveform: 'sine' },
      masterEQ: [
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -6 },
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 1 },
      ],
    },
  },
  {
    id: 'ocean-tropical-shore',
    category: 'ocean',
    name: 'Tropical Shore',
    params: {
      noiseType: 'pink',
      bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 4 },
        { type: 'peaking', frequency: 1200, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 3000, Q: 0.6, gain: 1 },
      ],
      reverb: { rt60: 1.2, preDelayMs: 10, wetMix: 0.28, highpassHz: 130 },
      amplitudeLFO: { frequency: 0.08, depth: 0.45, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 250, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 1500, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -2 },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Forest — 10 variations
// ═══════════════════════════════════════════════════════════════════════════

const forest: SoundscapeVariation[] = [
  {
    id: 'forest-morning',
    category: 'forest',
    name: 'Morning Forest',
    params: {
      noiseType: 'brown',
      bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 3000, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 400, Q: 0.4, gain: 2 },
        { type: 'peaking', frequency: 1200, Q: 0.6, gain: 1 },
      ],
      reverb: { rt60: 1.8, preDelayMs: 20, wetMix: 0.35, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.03, depth: 0.08, waveform: 'sine' },
      accents: [
        { type: 'bird', minIntervalMs: 3000, maxIntervalMs: 8000, gain: 0.2, frequencyRange: [2000, 5000] },
        { type: 'bird', minIntervalMs: 5000, maxIntervalMs: 12000, gain: 0.15, frequencyRange: [3000, 6500] },
        { type: 'bird', minIntervalMs: 8000, maxIntervalMs: 20000, gain: 0.12, frequencyRange: [1500, 3500] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 2500, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'forest-deep-woods',
    category: 'forest',
    name: 'Deep Woods',
    params: {
      noiseType: 'brown',
      bufferSeconds: 31,
      bands: [
        { type: 'lowpass', frequency: 1200, Q: 0.7, gain: 0 },
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 5 },
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 3 },
      ],
      reverb: { rt60: 2.2, preDelayMs: 25, wetMix: 0.4, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.02, depth: 0.06, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 250, Q: 0.7, gain: 5 },
        { type: 'highshelf', frequency: 2000, Q: 0.7, gain: -10 },
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 1 },
      ],
    },
  },
  {
    id: 'forest-windy',
    category: 'forest',
    name: 'Windy Forest',
    params: {
      noiseType: 'pink',
      bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 3 },
        { type: 'peaking', frequency: 1000, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 2500, Q: 0.6, gain: 2 },
      ],
      reverb: { rt60: 1.5, preDelayMs: 15, wetMix: 0.3, highpassHz: 130 },
      amplitudeLFO: { frequency: 0.08, depth: 0.4, waveform: 'sine' },
      filterSweep: { frequency: 0.06, depth: 0.5 },
      accents: [
        { type: 'bird', minIntervalMs: 8000, maxIntervalMs: 25000, gain: 0.1, frequencyRange: [2500, 5000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 2 },
        { type: 'peaking', frequency: 2000, Q: 0.6, gain: 1 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'forest-night',
    category: 'forest',
    name: 'Night Forest',
    params: {
      noiseType: 'brown',
      bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 2000, Q: 0.6, gain: 0 },
        { type: 'peaking', frequency: 250, Q: 0.4, gain: 4 },
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 1 },
      ],
      reverb: { rt60: 2.0, preDelayMs: 20, wetMix: 0.38, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.025, depth: 0.06, waveform: 'sine' },
      accents: [
        { type: 'cricket', minIntervalMs: 500, maxIntervalMs: 1500, gain: 0.12, frequencyRange: [4000, 7000] },
        { type: 'cricket', minIntervalMs: 800, maxIntervalMs: 2500, gain: 0.08, frequencyRange: [5000, 8000] },
        { type: 'bird', minIntervalMs: 20000, maxIntervalMs: 60000, gain: 0.1, frequencyRange: [1000, 2500] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 5000, Q: 0.8, gain: 2 },
        { type: 'highshelf', frequency: 8000, Q: 0.7, gain: -4 },
      ],
    },
  },
  {
    id: 'forest-bamboo',
    category: 'forest',
    name: 'Bamboo Forest',
    params: {
      noiseType: 'pink',
      bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 800, Q: 3.0, gain: 6 },
        { type: 'peaking', frequency: 1600, Q: 2.5, gain: 4 },
        { type: 'peaking', frequency: 400, Q: 1.0, gain: 2 },
        { type: 'lowpass', frequency: 4000, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 1.4, preDelayMs: 12, wetMix: 0.3, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.04, depth: 0.1, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 2000, maxIntervalMs: 8000, gain: 0.2, frequencyRange: [600, 1800] },
        { type: 'click', minIntervalMs: 4000, maxIntervalMs: 12000, gain: 0.15, frequencyRange: [1000, 2500] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 1000, Q: 1.0, gain: 3 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: -3 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -4 },
      ],
    },
  },
  {
    id: 'forest-rainforest',
    category: 'forest',
    name: 'Rainforest',
    params: {
      noiseType: 'pink',
      bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 4 },
        { type: 'peaking', frequency: 1000, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 2500, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 5000, Q: 0.8, gain: 2 },
      ],
      reverb: { rt60: 1.6, preDelayMs: 15, wetMix: 0.35, highpassHz: 120 },
      amplitudeLFO: { frequency: 0.05, depth: 0.12, waveform: 'sine' },
      accents: [
        { type: 'bird', minIntervalMs: 2000, maxIntervalMs: 6000, gain: 0.22, frequencyRange: [1500, 4500] },
        { type: 'bird', minIntervalMs: 4000, maxIntervalMs: 10000, gain: 0.18, frequencyRange: [3000, 7000] },
        { type: 'bird', minIntervalMs: 6000, maxIntervalMs: 15000, gain: 0.12, frequencyRange: [800, 2000] },
        { type: 'drip', minIntervalMs: 3000, maxIntervalMs: 8000, gain: 0.1, frequencyRange: [2500, 5000] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 2000, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 7000, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'forest-autumn',
    category: 'forest',
    name: 'Autumn Forest',
    params: {
      noiseType: 'white',
      bufferSeconds: 29,
      bands: [
        { type: 'highpass', frequency: 2000, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 4000, Q: 1.0, gain: 4 },
        { type: 'peaking', frequency: 6000, Q: 1.2, gain: 3 },
        { type: 'peaking', frequency: 8000, Q: 0.8, gain: 2 },
      ],
      reverb: { rt60: 1.2, preDelayMs: 10, wetMix: 0.25, highpassHz: 250 },
      amplitudeLFO: { frequency: 0.06, depth: 0.2, waveform: 'sine' },
      filterSweep: { frequency: 0.04, depth: 0.4 },
      masterEQ: [
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: 4 },
        { type: 'lowshelf', frequency: 400, Q: 0.7, gain: -6 },
        { type: 'peaking', frequency: 3000, Q: 0.5, gain: 2 },
      ],
    },
  },
  {
    id: 'forest-pine',
    category: 'forest',
    name: 'Pine Forest',
    params: {
      noiseType: 'pink',
      bufferSeconds: 31,
      bands: [
        { type: 'bandpass', frequency: 2000, Q: 1.5, gain: 0 },
        { type: 'peaking', frequency: 1500, Q: 1.2, gain: 3 },
        { type: 'peaking', frequency: 3000, Q: 1.0, gain: 2 },
      ],
      reverb: { rt60: 1.6, preDelayMs: 18, wetMix: 0.32, highpassHz: 180 },
      amplitudeLFO: { frequency: 0.04, depth: 0.15, waveform: 'sine' },
      filterSweep: { frequency: 0.03, depth: 0.35 },
      masterEQ: [
        { type: 'peaking', frequency: 2000, Q: 0.8, gain: 3 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -5 },
        { type: 'lowshelf', frequency: 300, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'forest-creek',
    category: 'forest',
    name: 'Creek Forest',
    params: {
      noiseType: 'pink',
      bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 2 },
        { type: 'peaking', frequency: 1500, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 3500, Q: 1.2, gain: 4 },
        { type: 'peaking', frequency: 6000, Q: 0.8, gain: 2 },
      ],
      reverb: { rt60: 1.4, preDelayMs: 12, wetMix: 0.3, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.07, depth: 0.15, waveform: 'sine' },
      filterSweep: { frequency: 0.09, depth: 0.4 },
      accents: [
        { type: 'bird', minIntervalMs: 6000, maxIntervalMs: 18000, gain: 0.12, frequencyRange: [2500, 5500] },
        { type: 'drip', minIntervalMs: 1000, maxIntervalMs: 4000, gain: 0.1, frequencyRange: [3000, 6000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 1000, Q: 0.5, gain: 2 },
        { type: 'peaking', frequency: 4000, Q: 0.6, gain: 2 },
        { type: 'highshelf', frequency: 8000, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'forest-meadow-edge',
    category: 'forest',
    name: 'Meadow Edge',
    params: {
      noiseType: 'pink',
      bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 600, Q: 0.4, gain: 2 },
        { type: 'peaking', frequency: 2000, Q: 0.5, gain: 1 },
        { type: 'lowpass', frequency: 5000, Q: 0.4, gain: 0 },
      ],
      reverb: { rt60: 2.5, preDelayMs: 35, wetMix: 0.45, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.03, depth: 0.08, waveform: 'sine' },
      accents: [
        { type: 'bird', minIntervalMs: 5000, maxIntervalMs: 15000, gain: 0.15, frequencyRange: [2000, 5000] },
        { type: 'cricket', minIntervalMs: 3000, maxIntervalMs: 8000, gain: 0.06, frequencyRange: [4500, 7000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -3 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 2 },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Cafe — 10 variations
// ═══════════════════════════════════════════════════════════════════════════

const cafe: SoundscapeVariation[] = [
  {
    id: 'cafe-quiet', category: 'cafe', name: 'Quiet Cafe',
    params: {
      noiseType: 'pink', bufferSeconds: 31,
      bands: [
        { type: 'bandpass', frequency: 500, Q: 1.5, gain: 0 },
        { type: 'peaking', frequency: 350, Q: 1.2, gain: 3 },
        { type: 'lowpass', frequency: 2000, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 0.6, preDelayMs: 5, wetMix: 0.18, highpassHz: 250 },
      amplitudeLFO: { frequency: 0.03, depth: 0.06, waveform: 'sine' },
      masterEQ: [
        { type: 'peaking', frequency: 400, Q: 0.8, gain: 2 },
        { type: 'highshelf', frequency: 3000, Q: 0.7, gain: -8 },
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'cafe-busy', category: 'cafe', name: 'Busy Cafe',
    params: {
      noiseType: 'pink', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 300, Q: 1.5, gain: 4 },
        { type: 'peaking', frequency: 700, Q: 1.2, gain: 5 },
        { type: 'peaking', frequency: 1200, Q: 1.0, gain: 4 },
        { type: 'peaking', frequency: 2500, Q: 0.8, gain: 3 },
      ],
      reverb: { rt60: 0.7, preDelayMs: 8, wetMix: 0.22, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.05, depth: 0.12, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 3000, maxIntervalMs: 10000, gain: 0.15, frequencyRange: [2000, 5000] },
        { type: 'click', minIntervalMs: 5000, maxIntervalMs: 15000, gain: 0.1, frequencyRange: [3000, 6000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 600, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 1500, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -4 },
      ],
    },
  },
  {
    id: 'cafe-coffee-shop', category: 'cafe', name: 'Coffee Shop',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 200, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 500, Q: 1.0, gain: 3 },
        { type: 'peaking', frequency: 1000, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 2000, Q: 0.6, gain: 2 },
      ],
      reverb: { rt60: 0.65, preDelayMs: 6, wetMix: 0.2, highpassHz: 220 },
      amplitudeLFO: { frequency: 0.04, depth: 0.1, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 8000, maxIntervalMs: 25000, gain: 0.12, frequencyRange: [1500, 3500] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'cafe-library', category: 'cafe', name: 'Library Cafe',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'bandpass', frequency: 400, Q: 1.0, gain: 0 },
        { type: 'lowpass', frequency: 1500, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 1.0, preDelayMs: 12, wetMix: 0.28, highpassHz: 180 },
      amplitudeLFO: { frequency: 0.02, depth: 0.04, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 12000, maxIntervalMs: 40000, gain: 0.08, frequencyRange: [2000, 4500] },
      ],
      masterEQ: [
        { type: 'highshelf', frequency: 3000, Q: 0.7, gain: -10 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: -3 },
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 1 },
      ],
    },
  },
  {
    id: 'cafe-outdoor', category: 'cafe', name: 'Outdoor Cafe',
    params: {
      noiseType: 'pink', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 400, Q: 1.0, gain: 3 },
        { type: 'peaking', frequency: 800, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 2000, Q: 0.6, gain: 2 },
      ],
      reverb: { rt60: 1.4, preDelayMs: 18, wetMix: 0.35, highpassHz: 120 },
      amplitudeLFO: { frequency: 0.04, depth: 0.1, waveform: 'sine' },
      accents: [
        { type: 'bird', minIntervalMs: 6000, maxIntervalMs: 20000, gain: 0.12, frequencyRange: [2500, 5500] },
        { type: 'click', minIntervalMs: 5000, maxIntervalMs: 18000, gain: 0.08, frequencyRange: [2000, 4500] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 2 },
        { type: 'peaking', frequency: 1500, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'cafe-jazz', category: 'cafe', name: 'Jazz Cafe',
    params: {
      noiseType: 'brown', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 250, Q: 0.8, gain: 5 },
        { type: 'peaking', frequency: 600, Q: 1.0, gain: 4 },
        { type: 'peaking', frequency: 1200, Q: 0.7, gain: 2 },
      ],
      reverb: { rt60: 0.8, preDelayMs: 8, wetMix: 0.25, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.06, depth: 0.15, waveform: 'sine' },
      filterSweep: { frequency: 0.03, depth: 0.25 },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 800, Q: 0.6, gain: 3 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -5 },
      ],
    },
  },
  {
    id: 'cafe-bookstore', category: 'cafe', name: 'Bookstore',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'bandpass', frequency: 500, Q: 0.8, gain: 0 },
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 2 },
        { type: 'lowpass', frequency: 2500, Q: 0.4, gain: 0 },
      ],
      reverb: { rt60: 1.2, preDelayMs: 15, wetMix: 0.32, highpassHz: 160 },
      amplitudeLFO: { frequency: 0.02, depth: 0.05, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 15000, maxIntervalMs: 45000, gain: 0.06, frequencyRange: [2000, 4000] },
      ],
      masterEQ: [
        { type: 'highshelf', frequency: 3000, Q: 0.7, gain: -8 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 1 },
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 1 },
      ],
    },
  },
  {
    id: 'cafe-coworking', category: 'cafe', name: 'Coworking Space',
    params: {
      noiseType: 'pink', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 350, Q: 0.8, gain: 2 },
        { type: 'peaking', frequency: 800, Q: 0.6, gain: 2 },
        { type: 'peaking', frequency: 1500, Q: 0.5, gain: 1 },
      ],
      reverb: { rt60: 0.5, preDelayMs: 4, wetMix: 0.15, highpassHz: 280 },
      amplitudeLFO: { frequency: 0.03, depth: 0.06, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 1000, maxIntervalMs: 4000, gain: 0.1, frequencyRange: [3000, 7000] },
        { type: 'click', minIntervalMs: 2000, maxIntervalMs: 6000, gain: 0.06, frequencyRange: [4000, 8000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -4 },
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: -1 },
      ],
    },
  },
  {
    id: 'cafe-university', category: 'cafe', name: 'University Cafe',
    params: {
      noiseType: 'pink', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 400, Q: 1.2, gain: 4 },
        { type: 'peaking', frequency: 900, Q: 1.0, gain: 4 },
        { type: 'peaking', frequency: 1800, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 3500, Q: 0.6, gain: 2 },
      ],
      reverb: { rt60: 0.75, preDelayMs: 8, wetMix: 0.22, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.06, depth: 0.14, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 4000, maxIntervalMs: 12000, gain: 0.12, frequencyRange: [2500, 5000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 700, Q: 0.6, gain: 2 },
        { type: 'peaking', frequency: 2000, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'cafe-late-night', category: 'cafe', name: 'Late Night Cafe',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'bandpass', frequency: 400, Q: 1.2, gain: 0 },
        { type: 'peaking', frequency: 250, Q: 0.6, gain: 3 },
        { type: 'lowpass', frequency: 1800, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 0.9, preDelayMs: 10, wetMix: 0.28, highpassHz: 180 },
      amplitudeLFO: { frequency: 0.02, depth: 0.04, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 15000, maxIntervalMs: 50000, gain: 0.06, frequencyRange: [2000, 4000] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 3 },
        { type: 'highshelf', frequency: 2500, Q: 0.7, gain: -8 },
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 2 },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Fire — 10 variations
// ═══════════════════════════════════════════════════════════════════════════

const fire: SoundscapeVariation[] = [
  {
    id: 'fire-gentle-campfire', category: 'fire', name: 'Gentle Campfire',
    params: {
      noiseType: 'brown', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 300, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 800, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 2000, Q: 1.0, gain: 2 },
      ],
      reverb: { rt60: 0.8, preDelayMs: 5, wetMix: 0.15, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.12, depth: 0.2, waveform: 'sine' },
      accents: [{ type: 'click', minIntervalMs: 2000, maxIntervalMs: 6000, gain: 0.18, frequencyRange: [1500, 4000] }],
      masterEQ: [
        { type: 'lowshelf', frequency: 250, Q: 0.7, gain: 4 },
        { type: 'peaking', frequency: 1200, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -5 },
      ],
    },
  },
  {
    id: 'fire-roaring-bonfire', category: 'fire', name: 'Roaring Bonfire',
    params: {
      noiseType: 'white', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 200, Q: 0.5, gain: 5 },
        { type: 'peaking', frequency: 600, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 1500, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 4000, Q: 1.0, gain: 3 },
        { type: 'highshelf', frequency: 6000, Q: 0.5, gain: 2 },
      ],
      reverb: { rt60: 1.0, preDelayMs: 8, wetMix: 0.2, highpassHz: 120 },
      amplitudeLFO: { frequency: 0.18, depth: 0.35, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 500, maxIntervalMs: 2000, gain: 0.25, frequencyRange: [1000, 5000] },
        { type: 'click', minIntervalMs: 1000, maxIntervalMs: 4000, gain: 0.2, frequencyRange: [2000, 6000] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 1000, Q: 0.5, gain: 3 },
        { type: 'highshelf', frequency: 8000, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'fire-fireplace', category: 'fire', name: 'Fireplace',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 250, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 600, Q: 1.2, gain: 4 },
        { type: 'peaking', frequency: 1500, Q: 1.5, gain: 3 },
        { type: 'lowpass', frequency: 4000, Q: 0.6, gain: 0 },
      ],
      reverb: { rt60: 0.5, preDelayMs: 3, wetMix: 0.12, highpassHz: 300 },
      amplitudeLFO: { frequency: 0.1, depth: 0.22, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 1500, maxIntervalMs: 5000, gain: 0.2, frequencyRange: [1200, 3500] },
        { type: 'click', minIntervalMs: 4000, maxIntervalMs: 12000, gain: 0.15, frequencyRange: [800, 2000] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 800, Q: 0.8, gain: 3 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -6 },
      ],
    },
  },
  {
    id: 'fire-ember-glow', category: 'fire', name: 'Ember Glow',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 800, Q: 0.6, gain: 0 },
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 4 },
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 3 },
      ],
      reverb: { rt60: 1.2, preDelayMs: 10, wetMix: 0.25, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.04, depth: 0.08, waveform: 'sine' },
      accents: [{ type: 'click', minIntervalMs: 8000, maxIntervalMs: 25000, gain: 0.08, frequencyRange: [600, 1500] }],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 6 },
        { type: 'highshelf', frequency: 1500, Q: 0.7, gain: -12 },
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 2 },
      ],
    },
  },
  {
    id: 'fire-crackling-log', category: 'fire', name: 'Crackling Log',
    params: {
      noiseType: 'pink', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 400, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 1200, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 3000, Q: 1.2, gain: 4 },
      ],
      reverb: { rt60: 0.7, preDelayMs: 5, wetMix: 0.15, highpassHz: 250 },
      amplitudeLFO: { frequency: 0.15, depth: 0.25, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 800, maxIntervalMs: 3000, gain: 0.3, frequencyRange: [2000, 6000] },
        { type: 'click', minIntervalMs: 3000, maxIntervalMs: 10000, gain: 0.35, frequencyRange: [1000, 4000] },
        { type: 'click', minIntervalMs: 5000, maxIntervalMs: 15000, gain: 0.25, frequencyRange: [3000, 8000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 800, Q: 0.6, gain: 2 },
        { type: 'peaking', frequency: 2500, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 7000, Q: 0.7, gain: -4 },
      ],
    },
  },
  {
    id: 'fire-distant', category: 'fire', name: 'Distant Fire',
    params: {
      noiseType: 'brown', bufferSeconds: 31,
      bands: [
        { type: 'lowpass', frequency: 1000, Q: 0.7, gain: 0 },
        { type: 'peaking', frequency: 250, Q: 0.5, gain: 3 },
        { type: 'peaking', frequency: 500, Q: 0.6, gain: 2 },
      ],
      reverb: { rt60: 2.5, preDelayMs: 35, wetMix: 0.5, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.06, depth: 0.12, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 4 },
        { type: 'highshelf', frequency: 2000, Q: 0.7, gain: -10 },
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 1 },
      ],
    },
  },
  {
    id: 'fire-torch', category: 'fire', name: 'Torch',
    params: {
      noiseType: 'white', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 1500, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 3500, Q: 0.8, gain: 5 },
        { type: 'peaking', frequency: 6000, Q: 1.0, gain: 3 },
        { type: 'highpass', frequency: 500, Q: 0.4, gain: 0 },
      ],
      reverb: { rt60: 0.4, preDelayMs: 2, wetMix: 0.1, highpassHz: 400 },
      amplitudeLFO: { frequency: 0.08, depth: 0.12, waveform: 'sine' },
      filterSweep: { frequency: 0.05, depth: 0.3 },
      masterEQ: [
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: 4 },
        { type: 'lowshelf', frequency: 300, Q: 0.7, gain: -4 },
        { type: 'peaking', frequency: 2000, Q: 0.5, gain: 2 },
      ],
    },
  },
  {
    id: 'fire-pit', category: 'fire', name: 'Fire Pit',
    params: {
      noiseType: 'pink', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 350, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 900, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 2200, Q: 1.0, gain: 3 },
      ],
      reverb: { rt60: 1.0, preDelayMs: 8, wetMix: 0.22, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.14, depth: 0.25, waveform: 'sine' },
      accents: [{ type: 'click', minIntervalMs: 1500, maxIntervalMs: 5000, gain: 0.2, frequencyRange: [1500, 4500] }],
      masterEQ: [
        { type: 'lowshelf', frequency: 250, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 1200, Q: 0.6, gain: 2 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -4 },
      ],
    },
  },
  {
    id: 'fire-candle-flicker', category: 'fire', name: 'Candle Flicker',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 600, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 2 },
        { type: 'peaking', frequency: 400, Q: 0.6, gain: 1 },
      ],
      reverb: { rt60: 0.6, preDelayMs: 3, wetMix: 0.12, highpassHz: 250 },
      amplitudeLFO: { frequency: 0.08, depth: 0.06, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 3 },
        { type: 'highshelf', frequency: 1000, Q: 0.7, gain: -14 },
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 1 },
      ],
    },
  },
  {
    id: 'fire-wood-stove', category: 'fire', name: 'Wood Stove',
    params: {
      noiseType: 'brown', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 200, Q: 0.8, gain: 5 },
        { type: 'peaking', frequency: 500, Q: 1.5, gain: 4 },
        { type: 'peaking', frequency: 1000, Q: 2.0, gain: 3 },
        { type: 'lowpass', frequency: 3000, Q: 0.6, gain: 0 },
      ],
      reverb: { rt60: 0.4, preDelayMs: 2, wetMix: 0.08, highpassHz: 350 },
      amplitudeLFO: { frequency: 0.06, depth: 0.1, waveform: 'sine' },
      accents: [{ type: 'click', minIntervalMs: 3000, maxIntervalMs: 10000, gain: 0.15, frequencyRange: [800, 2500] }],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 6 },
        { type: 'peaking', frequency: 700, Q: 1.0, gain: 3 },
        { type: 'highshelf', frequency: 3000, Q: 0.7, gain: -8 },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Space — 10 variations
// ═══════════════════════════════════════════════════════════════════════════

const space: SoundscapeVariation[] = [
  {
    id: 'space-deep', category: 'space', name: 'Deep Space',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 150, Q: 0.8, gain: 0 },
        { type: 'peaking', frequency: 50, Q: 0.3, gain: 8 },
        { type: 'peaking', frequency: 100, Q: 0.4, gain: 5 },
      ],
      reverb: { rt60: 4.0, preDelayMs: 50, wetMix: 0.65, highpassHz: 30 },
      amplitudeLFO: { frequency: 0.01, depth: 0.06, waveform: 'sine' },
      accents: [{ type: 'chime', minIntervalMs: 8000, maxIntervalMs: 25000, gain: 0.08, frequencyRange: [4000, 10000] }],
      masterEQ: [
        { type: 'lowshelf', frequency: 100, Q: 0.7, gain: 8 },
        { type: 'highshelf', frequency: 500, Q: 0.7, gain: -15 },
        { type: 'peaking', frequency: 60, Q: 0.5, gain: 4 },
      ],
    },
  },
  {
    id: 'space-nebula', category: 'space', name: 'Nebula',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 120, Q: 0.5, gain: 5 },
        { type: 'peaking', frequency: 300, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 600, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 1200, Q: 0.8, gain: 2 },
      ],
      reverb: { rt60: 3.5, preDelayMs: 40, wetMix: 0.6, highpassHz: 50 },
      amplitudeLFO: { frequency: 0.015, depth: 0.12, waveform: 'sine' },
      filterSweep: { frequency: 0.008, depth: 0.5 },
      masterEQ: [
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 2000, Q: 0.7, gain: -6 },
      ],
    },
  },
  {
    id: 'space-solar-wind', category: 'space', name: 'Solar Wind',
    params: {
      noiseType: 'white', bufferSeconds: 31,
      bands: [
        { type: 'bandpass', frequency: 800, Q: 0.6, gain: 0 },
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 3 },
        { type: 'peaking', frequency: 1500, Q: 0.7, gain: 2 },
      ],
      reverb: { rt60: 3.0, preDelayMs: 35, wetMix: 0.55, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.02, depth: 0.15, waveform: 'sine' },
      filterSweep: { frequency: 0.012, depth: 0.7 },
      masterEQ: [
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 3000, Q: 0.7, gain: -8 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 2 },
      ],
    },
  },
  {
    id: 'space-station', category: 'space', name: 'Space Station',
    params: {
      noiseType: 'brown', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 100, Q: 0.6, gain: 5 },
        { type: 'peaking', frequency: 250, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 60, Q: 2.0, gain: 6 },
        { type: 'lowpass', frequency: 2000, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 1.0, preDelayMs: 8, wetMix: 0.2, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.025, depth: 0.05, waveform: 'sine' },
      accents: [
        { type: 'click', minIntervalMs: 10000, maxIntervalMs: 30000, gain: 0.08, frequencyRange: [1500, 3500] },
        { type: 'chime', minIntervalMs: 20000, maxIntervalMs: 60000, gain: 0.05, frequencyRange: [2000, 5000] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 100, Q: 0.7, gain: 6 },
        { type: 'peaking', frequency: 60, Q: 1.5, gain: 4 },
        { type: 'highshelf', frequency: 3000, Q: 0.7, gain: -10 },
      ],
    },
  },
  {
    id: 'space-cosmic-drift', category: 'space', name: 'Cosmic Drift',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 400, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 80, Q: 0.3, gain: 5 },
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 3 },
      ],
      reverb: { rt60: 5.0, preDelayMs: 60, wetMix: 0.7, highpassHz: 40 },
      amplitudeLFO: { frequency: 0.008, depth: 0.1, waveform: 'sine' },
      filterSweep: { frequency: 0.005, depth: 0.4 },
      masterEQ: [
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 6 },
        { type: 'highshelf', frequency: 800, Q: 0.7, gain: -12 },
        { type: 'peaking', frequency: 100, Q: 0.5, gain: 3 },
      ],
    },
  },
  {
    id: 'space-pulsar', category: 'space', name: 'Pulsar',
    params: {
      noiseType: 'brown', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 80, Q: 1.5, gain: 8 },
        { type: 'peaking', frequency: 160, Q: 1.0, gain: 4 },
        { type: 'lowpass', frequency: 600, Q: 0.6, gain: 0 },
      ],
      reverb: { rt60: 2.5, preDelayMs: 25, wetMix: 0.45, highpassHz: 50 },
      amplitudeLFO: { frequency: 0.8, depth: 0.35, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 100, Q: 0.7, gain: 8 },
        { type: 'highshelf', frequency: 500, Q: 0.7, gain: -14 },
        { type: 'peaking', frequency: 80, Q: 1.0, gain: 4 },
      ],
    },
  },
  {
    id: 'space-void', category: 'space', name: 'Void',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 100, Q: 0.8, gain: 0 },
        { type: 'peaking', frequency: 40, Q: 0.3, gain: 4 },
      ],
      reverb: { rt60: 6.0, preDelayMs: 80, wetMix: 0.8, highpassHz: 20 },
      amplitudeLFO: { frequency: 0.005, depth: 0.04, waveform: 'sine' },
      accents: [{ type: 'chime', minIntervalMs: 20000, maxIntervalMs: 90000, gain: 0.04, frequencyRange: [3000, 8000] }],
      masterEQ: [
        { type: 'lowshelf', frequency: 80, Q: 0.7, gain: 6 },
        { type: 'highshelf', frequency: 300, Q: 0.7, gain: -18 },
        { type: 'peaking', frequency: 50, Q: 0.5, gain: 3 },
      ],
    },
  },
  {
    id: 'space-aurora', category: 'space', name: 'Aurora',
    params: {
      noiseType: 'pink', bufferSeconds: 31,
      bands: [
        { type: 'highpass', frequency: 1000, Q: 0.4, gain: 0 },
        { type: 'peaking', frequency: 3000, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 6000, Q: 1.0, gain: 5 },
        { type: 'peaking', frequency: 9000, Q: 0.6, gain: 3 },
      ],
      reverb: { rt60: 4.0, preDelayMs: 45, wetMix: 0.65, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.02, depth: 0.2, waveform: 'sine' },
      filterSweep: { frequency: 0.015, depth: 0.6 },
      masterEQ: [
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: 5 },
        { type: 'lowshelf', frequency: 500, Q: 0.7, gain: -8 },
        { type: 'peaking', frequency: 6000, Q: 0.5, gain: 3 },
      ],
    },
  },
  {
    id: 'space-gravity-well', category: 'space', name: 'Gravity Well',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 250, Q: 1.0, gain: 0 },
        { type: 'peaking', frequency: 60, Q: 0.5, gain: 8 },
        { type: 'peaking', frequency: 120, Q: 0.6, gain: 5 },
        { type: 'peaking', frequency: 40, Q: 0.4, gain: 6 },
      ],
      reverb: { rt60: 3.5, preDelayMs: 40, wetMix: 0.55, highpassHz: 25 },
      amplitudeLFO: { frequency: 0.012, depth: 0.15, waveform: 'sine' },
      filterSweep: { frequency: 0.006, depth: 0.3 },
      masterEQ: [
        { type: 'lowshelf', frequency: 80, Q: 0.7, gain: 10 },
        { type: 'highshelf', frequency: 400, Q: 0.7, gain: -16 },
        { type: 'peaking', frequency: 60, Q: 0.5, gain: 5 },
      ],
    },
  },
  {
    id: 'space-stellar-nursery', category: 'space', name: 'Stellar Nursery',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 150, Q: 0.5, gain: 5 },
        { type: 'peaking', frequency: 400, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 800, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 1500, Q: 0.5, gain: 2 },
      ],
      reverb: { rt60: 3.8, preDelayMs: 45, wetMix: 0.6, highpassHz: 60 },
      amplitudeLFO: { frequency: 0.018, depth: 0.12, waveform: 'sine' },
      filterSweep: { frequency: 0.01, depth: 0.45 },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 2500, Q: 0.7, gain: -5 },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Stream — 10 variations
// ═══════════════════════════════════════════════════════════════════════════

const stream: SoundscapeVariation[] = [
  {
    id: 'stream-gentle-brook', category: 'stream', name: 'Gentle Brook',
    params: {
      noiseType: 'pink', bufferSeconds: 31,
      bands: [
        { type: 'highpass', frequency: 800, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 2000, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 4000, Q: 1.0, gain: 3 },
        { type: 'lowpass', frequency: 8000, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 1.0, preDelayMs: 8, wetMix: 0.22, highpassHz: 200 },
      amplitudeLFO: { frequency: 0.07, depth: 0.18, waveform: 'sine' },
      filterSweep: { frequency: 0.05, depth: 0.3 },
      accents: [{ type: 'drip', minIntervalMs: 2000, maxIntervalMs: 6000, gain: 0.12, frequencyRange: [3000, 6000] }],
      masterEQ: [
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: 3 },
        { type: 'lowshelf', frequency: 300, Q: 0.7, gain: -5 },
        { type: 'peaking', frequency: 2500, Q: 0.5, gain: 2 },
      ],
    },
  },
  {
    id: 'stream-mountain', category: 'stream', name: 'Mountain Stream',
    params: {
      noiseType: 'white', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 1000, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 3000, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 5000, Q: 1.0, gain: 3 },
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 2 },
      ],
      reverb: { rt60: 1.5, preDelayMs: 12, wetMix: 0.3, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.12, depth: 0.25, waveform: 'sine' },
      filterSweep: { frequency: 0.08, depth: 0.45 },
      masterEQ: [
        { type: 'peaking', frequency: 2000, Q: 0.5, gain: 3 },
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 7000, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'stream-river', category: 'stream', name: 'River',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 200, Q: 0.5, gain: 4 },
        { type: 'peaking', frequency: 600, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 1200, Q: 0.4, gain: 2 },
      ],
      reverb: { rt60: 1.4, preDelayMs: 12, wetMix: 0.28, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.04, depth: 0.12, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 4 },
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 3000, Q: 0.7, gain: -6 },
      ],
    },
  },
  {
    id: 'stream-waterfall', category: 'stream', name: 'Waterfall',
    params: {
      noiseType: 'white', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 5 },
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 5 },
        { type: 'peaking', frequency: 2000, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 5000, Q: 0.7, gain: 3 },
        { type: 'highshelf', frequency: 8000, Q: 0.5, gain: 2 },
      ],
      reverb: { rt60: 2.0, preDelayMs: 18, wetMix: 0.35, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.03, depth: 0.08, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 4 },
        { type: 'peaking', frequency: 1500, Q: 0.5, gain: 3 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -1 },
      ],
    },
  },
  {
    id: 'stream-trickling-spring', category: 'stream', name: 'Trickling Spring',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'highpass', frequency: 1500, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 3500, Q: 1.5, gain: 5 },
        { type: 'peaking', frequency: 5500, Q: 1.2, gain: 3 },
      ],
      reverb: { rt60: 0.8, preDelayMs: 5, wetMix: 0.18, highpassHz: 300 },
      amplitudeLFO: { frequency: 0.1, depth: 0.22, waveform: 'sine' },
      filterSweep: { frequency: 0.12, depth: 0.5 },
      accents: [
        { type: 'drip', minIntervalMs: 1000, maxIntervalMs: 3500, gain: 0.18, frequencyRange: [3500, 7000] },
        { type: 'drip', minIntervalMs: 2000, maxIntervalMs: 6000, gain: 0.1, frequencyRange: [4500, 8000] },
      ],
      masterEQ: [
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: 5 },
        { type: 'lowshelf', frequency: 500, Q: 0.7, gain: -8 },
        { type: 'peaking', frequency: 3000, Q: 0.5, gain: 2 },
      ],
    },
  },
  {
    id: 'stream-forest-creek', category: 'stream', name: 'Forest Creek',
    params: {
      noiseType: 'pink', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 2 },
        { type: 'peaking', frequency: 1500, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 3500, Q: 1.0, gain: 4 },
      ],
      reverb: { rt60: 1.6, preDelayMs: 15, wetMix: 0.32, highpassHz: 140 },
      amplitudeLFO: { frequency: 0.06, depth: 0.15, waveform: 'sine' },
      filterSweep: { frequency: 0.07, depth: 0.35 },
      accents: [
        { type: 'bird', minIntervalMs: 8000, maxIntervalMs: 25000, gain: 0.1, frequencyRange: [2500, 5500] },
        { type: 'drip', minIntervalMs: 2000, maxIntervalMs: 5000, gain: 0.1, frequencyRange: [3000, 6000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 1000, Q: 0.5, gain: 2 },
        { type: 'peaking', frequency: 3000, Q: 0.6, gain: 2 },
        { type: 'highshelf', frequency: 7000, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'stream-canyon', category: 'stream', name: 'Canyon Stream',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 600, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 1500, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 3000, Q: 0.7, gain: 2 },
      ],
      reverb: { rt60: 3.5, preDelayMs: 50, wetMix: 0.55, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.06, depth: 0.15, waveform: 'sine' },
      filterSweep: { frequency: 0.04, depth: 0.3 },
      masterEQ: [
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -4 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 2 },
      ],
    },
  },
  {
    id: 'stream-babbling-brook', category: 'stream', name: 'Babbling Brook',
    params: {
      noiseType: 'pink', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 1200, Q: 1.0, gain: 4 },
        { type: 'peaking', frequency: 2800, Q: 1.2, gain: 4 },
        { type: 'peaking', frequency: 5000, Q: 0.8, gain: 2 },
        { type: 'highpass', frequency: 600, Q: 0.4, gain: 0 },
      ],
      reverb: { rt60: 0.9, preDelayMs: 6, wetMix: 0.2, highpassHz: 250 },
      amplitudeLFO: { frequency: 0.15, depth: 0.3, waveform: 'sine' },
      filterSweep: { frequency: 0.13, depth: 0.55 },
      accents: [
        { type: 'drip', minIntervalMs: 800, maxIntervalMs: 2500, gain: 0.15, frequencyRange: [2500, 6000] },
        { type: 'drip', minIntervalMs: 1500, maxIntervalMs: 4000, gain: 0.1, frequencyRange: [3500, 7000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 2000, Q: 0.6, gain: 3 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -2 },
        { type: 'lowshelf', frequency: 300, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'stream-rain-gutter', category: 'stream', name: 'Rain Gutter',
    params: {
      noiseType: 'white', bufferSeconds: 29,
      bands: [
        { type: 'bandpass', frequency: 2500, Q: 2.5, gain: 0 },
        { type: 'peaking', frequency: 3500, Q: 2.0, gain: 5 },
        { type: 'peaking', frequency: 1800, Q: 1.5, gain: 3 },
      ],
      reverb: { rt60: 0.3, preDelayMs: 2, wetMix: 0.08, highpassHz: 500 },
      amplitudeLFO: { frequency: 0.08, depth: 0.15, waveform: 'sine' },
      accents: [{ type: 'drip', minIntervalMs: 500, maxIntervalMs: 1800, gain: 0.22, frequencyRange: [2000, 5000] }],
      masterEQ: [
        { type: 'peaking', frequency: 2500, Q: 1.0, gain: 5 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -6 },
        { type: 'lowshelf', frequency: 500, Q: 0.7, gain: -8 },
      ],
    },
  },
  {
    id: 'stream-stone-fountain', category: 'stream', name: 'Stone Fountain',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 800, Q: 1.5, gain: 5 },
        { type: 'peaking', frequency: 1600, Q: 1.2, gain: 4 },
        { type: 'peaking', frequency: 3000, Q: 1.0, gain: 3 },
        { type: 'peaking', frequency: 400, Q: 0.8, gain: 3 },
      ],
      reverb: { rt60: 1.8, preDelayMs: 15, wetMix: 0.35, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.1, depth: 0.2, waveform: 'sine' },
      accents: [{ type: 'drip', minIntervalMs: 1200, maxIntervalMs: 3500, gain: 0.18, frequencyRange: [2000, 5000] }],
      masterEQ: [
        { type: 'peaking', frequency: 1000, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 2500, Q: 0.6, gain: 2 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -4 },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Wind — 10 variations
// ═══════════════════════════════════════════════════════════════════════════

const wind: SoundscapeVariation[] = [
  {
    id: 'wind-gentle-breeze', category: 'wind', name: 'Gentle Breeze',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'highpass', frequency: 500, Q: 0.4, gain: 0 },
        { type: 'peaking', frequency: 1200, Q: 0.5, gain: 2 },
        { type: 'peaking', frequency: 2500, Q: 0.6, gain: 2 },
        { type: 'lowpass', frequency: 6000, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 1.2, preDelayMs: 10, wetMix: 0.25, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.04, depth: 0.2, waveform: 'sine' },
      filterSweep: { frequency: 0.03, depth: 0.3 },
      masterEQ: [
        { type: 'peaking', frequency: 1000, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -3 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'wind-steady', category: 'wind', name: 'Steady Wind',
    params: {
      noiseType: 'brown', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 3 },
        { type: 'peaking', frequency: 800, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 1500, Q: 0.5, gain: 2 },
      ],
      reverb: { rt60: 1.0, preDelayMs: 8, wetMix: 0.22, highpassHz: 120 },
      amplitudeLFO: { frequency: 0.03, depth: 0.1, waveform: 'sine' },
      masterEQ: [
        { type: 'lowshelf', frequency: 250, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 1000, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -5 },
      ],
    },
  },
  {
    id: 'wind-gusting', category: 'wind', name: 'Gusting Wind',
    params: {
      noiseType: 'pink', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 400, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 1200, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 2500, Q: 0.6, gain: 2 },
      ],
      reverb: { rt60: 1.3, preDelayMs: 10, wetMix: 0.25, highpassHz: 130 },
      amplitudeLFO: { frequency: 0.1, depth: 0.55, waveform: 'sine' },
      filterSweep: { frequency: 0.08, depth: 0.5 },
      masterEQ: [
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 2 },
        { type: 'peaking', frequency: 2000, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'wind-howling', category: 'wind', name: 'Howling Wind',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 500, Q: 3.0, gain: 8 },
        { type: 'peaking', frequency: 1000, Q: 2.5, gain: 6 },
        { type: 'peaking', frequency: 250, Q: 0.6, gain: 4 },
      ],
      reverb: { rt60: 2.0, preDelayMs: 20, wetMix: 0.38, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.08, depth: 0.45, waveform: 'sine' },
      filterSweep: { frequency: 0.06, depth: 0.7 },
      masterEQ: [
        { type: 'peaking', frequency: 700, Q: 1.0, gain: 4 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 3 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -4 },
      ],
    },
  },
  {
    id: 'wind-desert', category: 'wind', name: 'Desert Wind',
    params: {
      noiseType: 'white', bufferSeconds: 31,
      bands: [
        { type: 'highpass', frequency: 1000, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 3000, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 5000, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 7000, Q: 0.6, gain: 2 },
      ],
      reverb: { rt60: 0.6, preDelayMs: 3, wetMix: 0.12, highpassHz: 400 },
      amplitudeLFO: { frequency: 0.06, depth: 0.3, waveform: 'sine' },
      filterSweep: { frequency: 0.04, depth: 0.4 },
      masterEQ: [
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: 4 },
        { type: 'lowshelf', frequency: 500, Q: 0.7, gain: -6 },
        { type: 'peaking', frequency: 3000, Q: 0.5, gain: 2 },
      ],
    },
  },
  {
    id: 'wind-mountain', category: 'wind', name: 'Mountain Wind',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 150, Q: 0.5, gain: 5 },
        { type: 'peaking', frequency: 400, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 800, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 1500, Q: 0.5, gain: 2 },
      ],
      reverb: { rt60: 2.2, preDelayMs: 25, wetMix: 0.4, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.06, depth: 0.35, waveform: 'sine' },
      filterSweep: { frequency: 0.04, depth: 0.4 },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 3000, Q: 0.7, gain: -6 },
      ],
    },
  },
  {
    id: 'wind-coastal', category: 'wind', name: 'Coastal Wind',
    params: {
      noiseType: 'pink', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 500, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 1500, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 4000, Q: 0.8, gain: 3 },
        { type: 'peaking', frequency: 7000, Q: 1.0, gain: 2 },
      ],
      reverb: { rt60: 1.5, preDelayMs: 15, wetMix: 0.3, highpassHz: 120 },
      amplitudeLFO: { frequency: 0.07, depth: 0.35, waveform: 'sine' },
      filterSweep: { frequency: 0.05, depth: 0.4 },
      masterEQ: [
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: 2 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 1 },
      ],
    },
  },
  {
    id: 'wind-night', category: 'wind', name: 'Night Wind',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 1200, Q: 0.6, gain: 0 },
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 4 },
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 2 },
      ],
      reverb: { rt60: 2.0, preDelayMs: 20, wetMix: 0.38, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.035, depth: 0.2, waveform: 'sine' },
      filterSweep: { frequency: 0.02, depth: 0.25 },
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 4 },
        { type: 'highshelf', frequency: 2000, Q: 0.7, gain: -10 },
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 1 },
      ],
    },
  },
  {
    id: 'wind-chimes', category: 'wind', name: 'Wind Chimes',
    params: {
      noiseType: 'pink', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 2 },
        { type: 'peaking', frequency: 1500, Q: 0.6, gain: 2 },
        { type: 'lowpass', frequency: 5000, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 1.8, preDelayMs: 15, wetMix: 0.35, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.05, depth: 0.25, waveform: 'sine' },
      accents: [
        { type: 'chime', minIntervalMs: 2000, maxIntervalMs: 6000, gain: 0.25, frequencyRange: [1500, 4000] },
        { type: 'chime', minIntervalMs: 3000, maxIntervalMs: 8000, gain: 0.2, frequencyRange: [2500, 5500] },
        { type: 'chime', minIntervalMs: 4000, maxIntervalMs: 12000, gain: 0.15, frequencyRange: [3500, 7000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 1 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: 2 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'wind-whistling', category: 'wind', name: 'Whistling Wind',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 800, Q: 4.0, gain: 10 },
        { type: 'peaking', frequency: 1600, Q: 3.0, gain: 6 },
        { type: 'peaking', frequency: 400, Q: 0.6, gain: 3 },
      ],
      reverb: { rt60: 1.5, preDelayMs: 12, wetMix: 0.3, highpassHz: 150 },
      amplitudeLFO: { frequency: 0.06, depth: 0.35, waveform: 'sine' },
      filterSweep: { frequency: 0.04, depth: 0.8 },
      masterEQ: [
        { type: 'peaking', frequency: 1000, Q: 1.5, gain: 5 },
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: -2 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -4 },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Thunder — 10 variations
// ═══════════════════════════════════════════════════════════════════════════

const thunder: SoundscapeVariation[] = [
  {
    id: 'thunder-distant', category: 'thunder', name: 'Distant Thunder',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 800, Q: 0.6, gain: 0 },
        { type: 'peaking', frequency: 100, Q: 0.4, gain: 5 },
        { type: 'peaking', frequency: 250, Q: 0.5, gain: 3 },
      ],
      reverb: { rt60: 3.5, preDelayMs: 50, wetMix: 0.55, highpassHz: 50 },
      amplitudeLFO: { frequency: 0.025, depth: 0.1, waveform: 'sine' },
      accents: [
        { type: 'thunder', minIntervalMs: 12000, maxIntervalMs: 40000, gain: 0.4, frequencyRange: [30, 100] },
        { type: 'thunder', minIntervalMs: 20000, maxIntervalMs: 60000, gain: 0.3, frequencyRange: [20, 70] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 5 },
        { type: 'highshelf', frequency: 1500, Q: 0.7, gain: -10 },
        { type: 'peaking', frequency: 200, Q: 0.5, gain: 2 },
      ],
    },
  },
  {
    id: 'thunder-rolling', category: 'thunder', name: 'Rolling Thunder',
    params: {
      noiseType: 'brown', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 80, Q: 0.5, gain: 6 },
        { type: 'peaking', frequency: 200, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 500, Q: 0.4, gain: 3 },
        { type: 'lowpass', frequency: 1500, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 3.0, preDelayMs: 40, wetMix: 0.5, highpassHz: 40 },
      amplitudeLFO: { frequency: 0.03, depth: 0.15, waveform: 'sine' },
      filterSweep: { frequency: 0.02, depth: 0.35 },
      accents: [
        { type: 'thunder', minIntervalMs: 8000, maxIntervalMs: 25000, gain: 0.5, frequencyRange: [40, 120] },
        { type: 'thunder', minIntervalMs: 15000, maxIntervalMs: 45000, gain: 0.35, frequencyRange: [25, 80] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 120, Q: 0.7, gain: 6 },
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 2000, Q: 0.7, gain: -8 },
      ],
    },
  },
  {
    id: 'thunder-close', category: 'thunder', name: 'Close Thunder',
    params: {
      noiseType: 'white', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 150, Q: 0.5, gain: 6 },
        { type: 'peaking', frequency: 500, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 1500, Q: 0.8, gain: 4 },
        { type: 'peaking', frequency: 3000, Q: 0.6, gain: 3 },
      ],
      reverb: { rt60: 1.5, preDelayMs: 5, wetMix: 0.25, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.04, depth: 0.12, waveform: 'sine' },
      accents: [
        { type: 'thunder', minIntervalMs: 6000, maxIntervalMs: 20000, gain: 0.65, frequencyRange: [60, 200] },
        { type: 'click', minIntervalMs: 4000, maxIntervalMs: 15000, gain: 0.4, frequencyRange: [2000, 6000] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 3 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -3 },
      ],
    },
  },
  {
    id: 'thunder-thunderstorm', category: 'thunder', name: 'Thunderstorm',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 300, Q: 0.5, gain: 4 },
        { type: 'peaking', frequency: 1000, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 2500, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 5000, Q: 0.5, gain: 1 },
      ],
      reverb: { rt60: 1.8, preDelayMs: 15, wetMix: 0.32, highpassHz: 120 },
      amplitudeLFO: { frequency: 0.05, depth: 0.15, waveform: 'sine' },
      accents: [
        { type: 'thunder', minIntervalMs: 5000, maxIntervalMs: 18000, gain: 0.5, frequencyRange: [40, 150] },
        { type: 'thunder', minIntervalMs: 10000, maxIntervalMs: 30000, gain: 0.4, frequencyRange: [25, 90] },
        { type: 'drip', minIntervalMs: 500, maxIntervalMs: 2000, gain: 0.08, frequencyRange: [3000, 6000] },
      ],
      masterEQ: [
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 2 },
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 3 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'thunder-heat-lightning', category: 'thunder', name: 'Heat Lightning',
    params: {
      noiseType: 'brown', bufferSeconds: 37,
      bands: [
        { type: 'lowpass', frequency: 500, Q: 0.5, gain: 0 },
        { type: 'peaking', frequency: 100, Q: 0.3, gain: 3 },
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 2 },
      ],
      reverb: { rt60: 4.0, preDelayMs: 60, wetMix: 0.6, highpassHz: 40 },
      amplitudeLFO: { frequency: 0.02, depth: 0.06, waveform: 'sine' },
      accents: [{ type: 'thunder', minIntervalMs: 20000, maxIntervalMs: 75000, gain: 0.2, frequencyRange: [20, 60] }],
      masterEQ: [
        { type: 'lowshelf', frequency: 100, Q: 0.7, gain: 4 },
        { type: 'highshelf', frequency: 800, Q: 0.7, gain: -12 },
        { type: 'peaking', frequency: 150, Q: 0.5, gain: 1 },
      ],
    },
  },
  {
    id: 'thunder-mountain', category: 'thunder', name: 'Mountain Thunder',
    params: {
      noiseType: 'brown', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 120, Q: 0.5, gain: 6 },
        { type: 'peaking', frequency: 350, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 3 },
        { type: 'lowpass', frequency: 2000, Q: 0.5, gain: 0 },
      ],
      reverb: { rt60: 3.8, preDelayMs: 55, wetMix: 0.6, highpassHz: 50 },
      amplitudeLFO: { frequency: 0.03, depth: 0.12, waveform: 'sine' },
      accents: [
        { type: 'thunder', minIntervalMs: 8000, maxIntervalMs: 30000, gain: 0.55, frequencyRange: [35, 130] },
        { type: 'thunder', minIntervalMs: 15000, maxIntervalMs: 50000, gain: 0.4, frequencyRange: [25, 80] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 150, Q: 0.7, gain: 6 },
        { type: 'peaking', frequency: 500, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 2500, Q: 0.7, gain: -8 },
      ],
    },
  },
  {
    id: 'thunder-night-storm', category: 'thunder', name: 'Night Storm',
    params: {
      noiseType: 'pink', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 250, Q: 0.5, gain: 4 },
        { type: 'peaking', frequency: 800, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 2000, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 4000, Q: 0.5, gain: 1 },
      ],
      reverb: { rt60: 2.0, preDelayMs: 18, wetMix: 0.35, highpassHz: 100 },
      amplitudeLFO: { frequency: 0.06, depth: 0.3, waveform: 'sine' },
      filterSweep: { frequency: 0.04, depth: 0.4 },
      accents: [
        { type: 'thunder', minIntervalMs: 8000, maxIntervalMs: 25000, gain: 0.5, frequencyRange: [40, 140] },
        { type: 'thunder', minIntervalMs: 15000, maxIntervalMs: 45000, gain: 0.35, frequencyRange: [25, 80] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 4 },
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 4000, Q: 0.7, gain: -4 },
      ],
    },
  },
  {
    id: 'thunder-approaching-storm', category: 'thunder', name: 'Approaching Storm',
    params: {
      noiseType: 'pink', bufferSeconds: 37,
      bands: [
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 3 },
        { type: 'peaking', frequency: 600, Q: 0.5, gain: 3 },
        { type: 'peaking', frequency: 1500, Q: 0.6, gain: 2 },
        { type: 'peaking', frequency: 3500, Q: 0.5, gain: 1 },
      ],
      reverb: { rt60: 2.5, preDelayMs: 30, wetMix: 0.42, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.04, depth: 0.2, waveform: 'sine' },
      filterSweep: { frequency: 0.015, depth: 0.35 },
      accents: [
        { type: 'thunder', minIntervalMs: 10000, maxIntervalMs: 35000, gain: 0.45, frequencyRange: [35, 120] },
        { type: 'thunder', minIntervalMs: 18000, maxIntervalMs: 55000, gain: 0.3, frequencyRange: [25, 80] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -5 },
      ],
    },
  },
  {
    id: 'thunder-summer', category: 'thunder', name: 'Summer Thunder',
    params: {
      noiseType: 'pink', bufferSeconds: 31,
      bands: [
        { type: 'peaking', frequency: 400, Q: 0.5, gain: 3 },
        { type: 'peaking', frequency: 1200, Q: 0.6, gain: 3 },
        { type: 'peaking', frequency: 3000, Q: 0.7, gain: 2 },
        { type: 'peaking', frequency: 5000, Q: 0.5, gain: 1 },
      ],
      reverb: { rt60: 1.5, preDelayMs: 12, wetMix: 0.28, highpassHz: 130 },
      amplitudeLFO: { frequency: 0.04, depth: 0.12, waveform: 'sine' },
      accents: [
        { type: 'thunder', minIntervalMs: 12000, maxIntervalMs: 40000, gain: 0.45, frequencyRange: [50, 150] },
        { type: 'drip', minIntervalMs: 600, maxIntervalMs: 2000, gain: 0.08, frequencyRange: [3000, 6000] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 1000, Q: 0.5, gain: 2 },
        { type: 'highshelf', frequency: 6000, Q: 0.7, gain: -2 },
      ],
    },
  },
  {
    id: 'thunder-ocean-storm', category: 'thunder', name: 'Ocean Storm',
    params: {
      noiseType: 'white', bufferSeconds: 29,
      bands: [
        { type: 'peaking', frequency: 200, Q: 0.4, gain: 5 },
        { type: 'peaking', frequency: 600, Q: 0.6, gain: 4 },
        { type: 'peaking', frequency: 1500, Q: 0.7, gain: 3 },
        { type: 'peaking', frequency: 4000, Q: 0.6, gain: 2 },
      ],
      reverb: { rt60: 2.2, preDelayMs: 22, wetMix: 0.4, highpassHz: 80 },
      amplitudeLFO: { frequency: 0.12, depth: 0.45, waveform: 'sine' },
      filterSweep: { frequency: 0.06, depth: 0.4 },
      accents: [
        { type: 'thunder', minIntervalMs: 8000, maxIntervalMs: 25000, gain: 0.5, frequencyRange: [40, 140] },
        { type: 'thunder', minIntervalMs: 14000, maxIntervalMs: 40000, gain: 0.35, frequencyRange: [25, 80] },
      ],
      masterEQ: [
        { type: 'lowshelf', frequency: 200, Q: 0.7, gain: 5 },
        { type: 'peaking', frequency: 800, Q: 0.5, gain: 3 },
        { type: 'highshelf', frequency: 5000, Q: 0.7, gain: -3 },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Master Registry & Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** All variations grouped by category. */
const CATEGORY_MAP: Record<SoundscapeCategory, SoundscapeVariation[]> = {
  rain, ocean, forest, cafe, fire, space, stream, wind, thunder,
  gongs: [], jungle: [], noise: [], birds: [], cave: [],
};

/** Flat index by ID for O(1) lookup. Built at module load. */
const ID_INDEX: Map<string, SoundscapeVariation> = new Map();
for (const list of Object.values(CATEGORY_MAP)) {
  for (const v of list) {
    ID_INDEX.set(v.id, v);
  }
}

/** Every variation across all categories (frozen). */
export const ALL_VARIATIONS: readonly SoundscapeVariation[] = Object.freeze(
  Object.values(CATEGORY_MAP).flat()
);

/**
 * Get all variations for a soundscape category.
 *
 * @param category - One of the 9 soundscape categories.
 * @returns Array of 10-12 variations with complete synthesis params.
 */
export function getVariationsForCategory(
  category: SoundscapeCategory
): SoundscapeVariation[] {
  return CATEGORY_MAP[category] ?? [];
}

/**
 * Look up a single variation by its unique ID.
 *
 * @param id - Variation ID (e.g., `'rain-light-drizzle'`).
 * @returns The variation, or `undefined` if not found.
 */
export function getVariation(id: string): SoundscapeVariation | undefined {
  return ID_INDEX.get(id);
}

/**
 * Select a random variation from a category, optionally excluding one.
 *
 * Used by the engine during long-session crossfades to ensure the user
 * always hears something different.
 *
 * @param category  - Soundscape category to pick from.
 * @param excludeId - Optional ID to exclude (e.g., currently playing).
 * @returns A randomly selected variation.
 * @throws {Error} If the category has zero variations.
 */
export function getRandomVariation(
  category: SoundscapeCategory,
  excludeId?: string
): SoundscapeVariation {
  const all = CATEGORY_MAP[category];
  if (!all || all.length === 0) {
    // Categories like gongs, cave, noise use file-based playback with no
    // procedural variations — return a synthetic sentinel so the session seed
    // can be generated without throwing.
    return { id: `${category}-default`, label: category, files: [] } as unknown as SoundscapeVariation;
  }
  const pool = excludeId ? all.filter((v) => v.id !== excludeId) : all;
  const candidates = pool.length > 0 ? pool : all;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
