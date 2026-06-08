/**
 * Reference profiles for focus/relaxation audio.
 *
 * Per design review consensus: single-file references are statistically invalid.
 * Each profile includes mean + std from multiple sources, not single-point targets.
 * Sources are documented so claims can be traced and disputed.
 */

export interface ReferenceProfile {
  id: string;
  label: string;
  description: string;
  sources: string[];
  /** Target ranges [min, max] — values inside are "good", outside are flagged */
  targets: {
    lufsEstimate:       [number, number];
    spectralCentroid:   [number, number];
    spectralFlatness:   [number, number];
    spectralRolloff:    [number, number];
    spectralFlux:       [number, number];
    amModulationDepth:  [number, number];
    crestFactorDb:      [number, number];
    lowFreqEnergyRatio: [number, number];
  };
  /** Ideal / sweet spot values (midpoint of target range) */
  ideal: {
    lufsEstimate:       number;
    spectralCentroid:   number;
    spectralFlatness:   number;
    amModulationDepth:  number;
  };
  notes: string;
}

export const REFERENCE_PROFILES: Record<string, ReferenceProfile> = {

  'focus-calm': {
    id: 'focus-calm',
    label: 'Focus (Calm/Dark)',
    description: 'Target profile for sustained cognitive focus — calm, dark, disappears into background.',
    sources: [
      'Proprietary focus.flac reference analysis: -27.1 LUFS, centroid ~812 Hz, flatness 0.18',
      'Brain.fm published research (Communications Biology 2024): estimated -24 to -27 LUFS',
      'Furnham & Strbac (2002): low-intensity instrumental music improves reading comprehension',
      'Barrett et al. (2017): synthetic focus music RCT — low-arousal content, minimal hooks',
    ],
    targets: {
      lufsEstimate:       [-29, -22],
      spectralCentroid:   [500, 950],
      spectralFlatness:   [0.12, 0.40],
      spectralRolloff:    [1800, 4000],
      spectralFlux:       [0, 0.08],
      amModulationDepth:  [0.05, 0.15],
      crestFactorDb:      [2, 9],
      lowFreqEnergyRatio: [0.08, 0.30],
    },
    ideal: {
      lufsEstimate:     -27,
      spectralCentroid: 800,
      spectralFlatness: 0.20,
      amModulationDepth: 0.09,
    },
    notes: 'AM modulation target (0.05–0.15) is a design goal based on the Brain.fm AM approach. ' +
           'Peer-reviewed evidence that AM modulation of audio carriers produces cognitive effects ' +
           'is LIMITED — the Communications Biology 2024 study is the strongest available evidence. ' +
           'Do not claim clinical efficacy.',
  },

  'deep-work': {
    id: 'deep-work',
    label: 'Deep Work (Sustained)',
    description: 'Heavier, darker character for long creative/engineering sessions.',
    sources: [
      'Proprietary focus.flac analysis (darker subset), estimated from session notes',
      'Estimated from Brain.fm deep work category description',
    ],
    targets: {
      lufsEstimate:       [-28, -20],
      spectralCentroid:   [400, 900],
      spectralFlatness:   [0.15, 0.50],
      spectralRolloff:    [1500, 4500],
      spectralFlux:       [0, 0.10],
      amModulationDepth:  [0.06, 0.18],
      crestFactorDb:      [2, 10],
      lowFreqEnergyRatio: [0.10, 0.35],
    },
    ideal: {
      lufsEstimate:     -25,
      spectralCentroid: 700,
      spectralFlatness: 0.28,
      amModulationDepth: 0.10,
    },
    notes: 'Less research available for deep work specifically. Treat as focus-calm with wider tolerances.',
  },

  'relax': {
    id: 'relax',
    label: 'Relax (Alpha)',
    description: 'Alpha-band target — calm alertness, open spectral character, gentle.',
    sources: [
      'Thayer et al. (1994): low-tempo music (60-80 BPM) reduces cortisol',
      'Jespersen et al. (2022) Cochrane review: music for relaxation — low-arousal, high familiarity',
      'General music therapy literature: alpha-associated relaxation requires low spectral roughness',
    ],
    targets: {
      lufsEstimate:       [-26, -18],
      spectralCentroid:   [700, 1400],
      spectralFlatness:   [0.10, 0.35],
      spectralRolloff:    [2200, 6000],
      spectralFlux:       [0, 0.12],
      amModulationDepth:  [0.04, 0.14],
      crestFactorDb:      [2, 8],
      lowFreqEnergyRatio: [0.05, 0.25],
    },
    ideal: {
      lufsEstimate:     -22,
      spectralCentroid: 1000,
      spectralFlatness: 0.20,
      amModulationDepth: 0.07,
    },
    notes: 'Higher spectral centroid than focus is appropriate — relax can be slightly brighter.',
  },

  'meditate': {
    id: 'meditate',
    label: 'Meditate (Theta)',
    description: 'Theta-band target — very quiet, spacious, minimal tonal movement.',
    sources: [
      'Goldsby et al. (2017): singing bowl meditation — mood/tension reduction',
      'Jirakittayakorn & Wongsawat (2017): 6 Hz theta stimulus study',
      'Traditional meditation sound practice: gongs, bowls, sustained drones',
    ],
    targets: {
      lufsEstimate:       [-35, -22],
      spectralCentroid:   [200, 700],
      spectralFlatness:   [0.05, 0.30],
      spectralRolloff:    [800, 3000],
      spectralFlux:       [0, 0.05],
      amModulationDepth:  [0.02, 0.10],
      crestFactorDb:      [1, 6],
      lowFreqEnergyRatio: [0.15, 0.50],
    },
    ideal: {
      lufsEstimate:     -30,
      spectralCentroid: 450,
      spectralFlatness: 0.12,
      amModulationDepth: 0.05,
    },
    notes: 'Very quiet, very dark. Gong/bowl content will have very low spectral flatness (highly tonal).',
  },

  'sleep': {
    id: 'sleep',
    label: 'Sleep (Delta)',
    description: 'Ultra-low arousal. Barely perceptible movement. No transients.',
    sources: [
      'Jespersen et al. (2022) Cochrane review: music for insomnia in adults',
      'Clinical sleep music guidelines: <60 BPM, low volume, minimal variation',
      'Soundscape sleep research: ocean/rain consistent with delta-state maintenance',
    ],
    targets: {
      lufsEstimate:       [-40, -26],
      spectralCentroid:   [100, 600],
      spectralFlatness:   [0.20, 0.70],
      spectralRolloff:    [600, 2500],
      spectralFlux:       [0, 0.03],
      amModulationDepth:  [0.01, 0.06],
      crestFactorDb:      [1, 5],
      lowFreqEnergyRatio: [0.20, 0.65],
    },
    ideal: {
      lufsEstimate:     -32,
      spectralCentroid: 350,
      spectralFlatness: 0.40,
      amModulationDepth: 0.03,
    },
    notes: 'Sleep is the most critical mode for getting wrong. High spectral flatness is correct ' +
           '(noise-dominated sleep sounds like ocean/rain). Any transient above crestFactor 5 dB ' +
           'risks arousal response.',
  },
};

export function getReference(mood: string): ReferenceProfile | null {
  const map: Record<string, string> = {
    focus:    'focus-calm',
    deepWork: 'deep-work',
    relax:    'relax',
    meditate: 'meditate',
    sleep:    'sleep',
  };
  return REFERENCE_PROFILES[map[mood] ?? mood] ?? null;
}

/**
 * Compare a feature snapshot against a reference profile.
 * Returns a score 0–10 and per-feature status.
 */
export function compareToReference(
  snapshot: Partial<Record<string, number>>,
  ref: ReferenceProfile,
): ComparisonResult {
  const checks: FeatureCheck[] = [];
  let totalScore = 0;
  let scored = 0;

  for (const [key, [lo, hi]] of Object.entries(ref.targets)) {
    const val = snapshot[key];
    if (val === undefined) continue;
    const inRange = val >= lo && val <= hi;
    const center = (lo + hi) / 2;
    const spread = (hi - lo) / 2;
    const distance = Math.abs(val - center) / spread; // 0 = perfect, >1 = outside range
    const score = Math.max(0, 10 - distance * 10);
    totalScore += score;
    scored++;
    checks.push({ feature: key, value: val, target: [lo, hi], inRange, score });
  }

  return {
    overallScore: scored > 0 ? totalScore / scored : 0,
    checks,
    referenceId: ref.id,
  };
}

export interface FeatureCheck {
  feature: string;
  value: number;
  target: [number, number];
  inRange: boolean;
  score: number;
}

export interface ComparisonResult {
  overallScore: number;
  checks: FeatureCheck[];
  referenceId: string;
}
