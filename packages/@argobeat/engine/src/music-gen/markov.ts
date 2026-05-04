/**
 * @module markov
 * 2nd-order Markov chain melody generator for ArgoBeat.
 *
 * Generates musically coherent melodies using hand-crafted transition weights
 * based on music theory. No external training data required.
 */

import { SeededRNG } from './rng.js';

// =============================================================================
// Configuration
// =============================================================================

export interface MarkovMelodyConfig {
  stepwiseBias: number;
  chordToneBoost: number;
  rangeCenteringStrength: number;
  maxInterval: number;
  restProbability: number;
  repeatProbability: number;
  resolutionWindow: number;
  resolutionStrength: number;
}

export const DEFAULT_MARKOV_CONFIG: Readonly<MarkovMelodyConfig> = {
  stepwiseBias: 0.65,
  chordToneBoost: 2.5,
  rangeCenteringStrength: 0.4,
  maxInterval: 5,
  restProbability: 0.1,
  repeatProbability: 0.08,
  resolutionWindow: 2,
  resolutionStrength: 4.0,
};

// =============================================================================
// Transition weights (hand-crafted from music theory)
// =============================================================================

interface IntervalWeight {
  interval: number;
  weight: number;
}

const BASE_INTERVAL_WEIGHTS: readonly IntervalWeight[] = [
  { interval: 0, weight: 0.10 },
  { interval: 1, weight: 0.28 },
  { interval: -1, weight: 0.26 },
  { interval: 2, weight: 0.10 },
  { interval: -2, weight: 0.09 },
  { interval: 3, weight: 0.05 },
  { interval: -3, weight: 0.04 },
  { interval: 4, weight: 0.03 },
  { interval: -4, weight: 0.03 },
  { interval: 5, weight: 0.01 },
  { interval: -5, weight: 0.01 },
];

// 2nd-order context modifiers (Narmour implication-realization)
const CONTEXT_MODIFIERS: ReadonlyArray<{ prevInterval: number; modifiers: Map<number, number> }> = [
  { prevInterval: 1, modifiers: new Map([[1, 1.4], [2, 1.2], [-1, 0.7], [0, 0.8]]) },
  { prevInterval: -1, modifiers: new Map([[-1, 1.4], [-2, 1.2], [1, 0.7], [0, 0.8]]) },
  { prevInterval: 2, modifiers: new Map([[-1, 1.8], [-2, 1.3], [1, 0.6], [2, 0.4]]) },
  { prevInterval: -2, modifiers: new Map([[1, 1.8], [2, 1.3], [-1, 0.6], [-2, 0.4]]) },
  { prevInterval: 3, modifiers: new Map([[-1, 2.2], [-2, 1.5], [0, 1.3], [1, 0.4], [3, 0.15]]) },
  { prevInterval: -3, modifiers: new Map([[1, 2.2], [2, 1.5], [0, 1.3], [-1, 0.4], [-3, 0.15]]) },
  { prevInterval: 4, modifiers: new Map([[-1, 2.8], [-2, 1.8], [0, 1.5], [1, 0.2], [4, 0.05]]) },
  { prevInterval: -4, modifiers: new Map([[1, 2.8], [2, 1.8], [0, 1.5], [-1, 0.2], [-4, 0.05]]) },
  { prevInterval: 0, modifiers: new Map([[0, 0.5], [1, 1.3], [-1, 1.3]]) },
];

const CONTEXT_LOOKUP = new Map(CONTEXT_MODIFIERS.map((cm) => [cm.prevInterval, cm.modifiers]));

// =============================================================================
// Helpers
// =============================================================================

function gaussianCenterWeight(index: number, scaleLen: number, strength: number): number {
  if (strength <= 0 || scaleLen <= 1) return 1.0;
  const center = (scaleLen - 1) / 2;
  const sigma = (scaleLen / 6) / strength;
  const z = (index - center) / sigma;
  return Math.exp(-0.5 * z * z);
}

function getBaseWeight(interval: number): number {
  for (const entry of BASE_INTERVAL_WEIGHTS) {
    if (entry.interval === interval) return entry.weight;
  }
  return 0.005;
}

function clampIndex(index: number, scaleLen: number): number {
  return Math.max(0, Math.min(scaleLen - 1, index));
}

function findPreviousContext(melody: number[]): { prev1: number; prev2: number } {
  let prev1 = -1;
  let prev2 = -1;
  for (let i = melody.length - 1; i >= 0; i--) {
    if (melody[i] !== -1) {
      if (prev1 === -1) prev1 = melody[i];
      else { prev2 = melody[i]; break; }
    }
  }
  return { prev1, prev2 };
}

function weightedPick(rng: SeededRNG, candidates: number[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// =============================================================================
// Core generator
// =============================================================================

/**
 * Generate a melody as scale-degree indices using a 2nd-order Markov chain.
 * Returns indices into scaleFreqs, or -1 for rests.
 */
export function generateMarkovMelody(
  rng: SeededRNG,
  scaleFreqs: number[],
  chordToneIndices: number[],
  phraseLength: number,
  config: MarkovMelodyConfig,
): number[] {
  const scaleLen = scaleFreqs.length;
  if (scaleLen === 0 || phraseLength <= 0) return [];
  if (scaleLen === 1) return new Array(phraseLength).fill(0);

  const chordToneSet = new Set(chordToneIndices);

  const centerWeights = new Array<number>(scaleLen);
  for (let i = 0; i < scaleLen; i++) {
    centerWeights[i] = gaussianCenterWeight(i, scaleLen, config.rangeCenteringStrength);
  }

  const melody: number[] = [];

  // Seed: first note (center + chord biased)
  const initWeights = new Array<number>(scaleLen);
  const initIndices = new Array<number>(scaleLen);
  for (let i = 0; i < scaleLen; i++) {
    let w = centerWeights[i];
    if (chordToneSet.has(i)) w *= config.chordToneBoost;
    initWeights[i] = w;
    initIndices[i] = i;
  }
  melody.push(weightedPick(rng, initIndices, initWeights));
  if (phraseLength === 1) return melody;

  // Second note: step from first
  const secondCandidates: number[] = [];
  const secondWeights: number[] = [];
  for (let i = 0; i < scaleLen; i++) {
    const interval = Math.abs(i - melody[0]);
    if (interval > config.maxInterval) continue;
    let w = getBaseWeight(i - melody[0]) * centerWeights[i];
    if (chordToneSet.has(i)) w *= config.chordToneBoost;
    if (interval <= 1 && interval > 0) w *= 1.0 + config.stepwiseBias;
    secondCandidates.push(i);
    secondWeights.push(Math.max(w, 0.001));
  }
  melody.push(secondCandidates.length > 0
    ? weightedPick(rng, secondCandidates, secondWeights)
    : clampIndex(melody[0] + (rng.next() > 0.5 ? 1 : -1), scaleLen));
  if (phraseLength === 2) return melody;

  // Generate remaining notes
  for (let pos = 2; pos < phraseLength; pos++) {
    // Rest check
    if (config.restProbability > 0 && rng.next() < config.restProbability) {
      melody.push(-1);
      continue;
    }

    const { prev1, prev2 } = findPreviousContext(melody);
    if (prev1 === -1) { melody.push(weightedPick(rng, initIndices, initWeights)); continue; }

    // Repeat check
    if (config.repeatProbability > 0 && rng.next() < config.repeatProbability) {
      melody.push(prev1);
      continue;
    }

    const prevInterval = prev2 !== -1 ? prev1 - prev2 : 0;
    const candidates: number[] = [];
    const weights: number[] = [];
    const inResolution = pos >= phraseLength - config.resolutionWindow;

    for (let i = 0; i < scaleLen; i++) {
      const interval = i - prev1;
      const absInterval = Math.abs(interval);
      if (absInterval > config.maxInterval) continue;

      let w = getBaseWeight(interval);
      if (absInterval <= 1 && absInterval > 0) w *= 1.0 + config.stepwiseBias;

      const contextMods = CONTEXT_LOOKUP.get(prevInterval);
      if (contextMods) {
        const mod = contextMods.get(interval);
        if (mod !== undefined) w *= mod;
      }

      w *= centerWeights[i];
      if (chordToneSet.has(i)) w *= config.chordToneBoost;

      if (inResolution && chordToneIndices.length > 0) {
        const posFromEnd = phraseLength - 1 - pos;
        const factor = 1.0 + (config.resolutionStrength - 1.0) * (1.0 - posFromEnd / config.resolutionWindow);
        if (i === chordToneIndices[0]) w *= factor;
        else if (chordToneSet.has(i) && absInterval <= 2) w *= 1.0 + (factor - 1.0) * 0.4;
      }

      candidates.push(i);
      weights.push(Math.max(w, 0.001));
    }

    melody.push(candidates.length > 0
      ? weightedPick(rng, candidates, weights)
      : clampIndex(prev1 + (rng.next() > 0.5 ? 1 : -1), scaleLen));
  }

  return melody;
}

// =============================================================================
// Mood presets
// =============================================================================

export const MOOD_MARKOV_CONFIGS: Readonly<Record<string, Partial<MarkovMelodyConfig>>> = {
  focus: { stepwiseBias: 0.60, chordToneBoost: 2.5, restProbability: 0.08, repeatProbability: 0.05, maxInterval: 4 },
  deepWork: { stepwiseBias: 0.55, chordToneBoost: 2.0, restProbability: 0.12, repeatProbability: 0.10, maxInterval: 5, rangeCenteringStrength: 0.35 },
  relax: { stepwiseBias: 0.75, chordToneBoost: 2.8, restProbability: 0.06, repeatProbability: 0.04, maxInterval: 3, rangeCenteringStrength: 0.50 },
  meditate: { stepwiseBias: 0.70, chordToneBoost: 3.0, restProbability: 0.25, repeatProbability: 0.15, maxInterval: 3, rangeCenteringStrength: 0.55, resolutionStrength: 5.0 },
  sleep: { stepwiseBias: 0.85, chordToneBoost: 3.5, restProbability: 0.30, repeatProbability: 0.20, maxInterval: 2, rangeCenteringStrength: 0.65, resolutionStrength: 5.0, resolutionWindow: 3 },
};

export function getMoodMarkovConfig(mood: string): MarkovMelodyConfig {
  const overrides = MOOD_MARKOV_CONFIGS[mood] ?? {};
  return { ...DEFAULT_MARKOV_CONFIG, ...overrides };
}
