/**
 * Feature types for acoustic analysis.
 * Extraction itself happens in AnalysisPanel.astro via raw Web Audio API.
 * Meyda removed — caused 394KB bundle overhead in production.
 */

export interface FeatureSnapshot {
  timestamp: number;
  lufsEstimate: number;
  spectralCentroid: number;
  spectralFlatness: number;
  spectralRolloff: number;
  spectralFlux: number;
  amModulationDepth: number;
  amModulationRateHz: number;
  crestFactorDb: number;
  lowFreqEnergyRatio: number;
  isStereo: boolean;
  rms: number;
}

export interface FeatureStats {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface SessionProfile {
  sampleCount: number;
  durationSeconds: number;
  lufsEstimate: FeatureStats;
  spectralCentroid: FeatureStats;
  spectralFlatness: FeatureStats;
  spectralRolloff: FeatureStats;
  spectralFlux: FeatureStats;
  amModulationDepth: FeatureStats;
  amModulationRateHz: FeatureStats;
  crestFactorDb: FeatureStats;
  lowFreqEnergyRatio: FeatureStats;
}

/** Stub — extraction happens inline in AnalysisPanel.astro */
export class FeatureExtractor {
  constructor(_analyser: AnalyserNode) {}
  setOnSnapshot(_cb: (s: FeatureSnapshot) => void) {}
  start() {}
  stop() {}
  getLastSnapshot(): FeatureSnapshot | null { return null; }
  getSessionProfile(): SessionProfile | null { return null; }
  clearHistory() {}
}
