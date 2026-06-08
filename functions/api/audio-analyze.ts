interface FeatureSnapshot {
  lufsEstimate?: number;
  spectralCentroid?: number;
  amModulationDepth?: number;
  spectralFlatness?: number;
  spectralFlux?: number;
  [key: string]: number | undefined;
}

interface ComparisonEntry {
  target: [number, number];
  inRange: boolean;
  value: number;
}

interface AnalyzeRequest {
  features: FeatureSnapshot;
  comparison: Record<string, ComparisonEntry>;
  mood: string;
  source: string;
  track?: string;
  soundscape?: string;
  triggered: 'manual' | 'auto-tune';
  currentParams?: Record<string, number>;
}

interface AnalyzeResponse {
  description: string;
  topPriority: string;
  disclaimer: string;
  parameterSuggestions?: Record<string, number>;
}

const FEATURE_PRIORITY: Record<string, string> = {
  lufsEstimate: 'loudness',
  spectralCentroid: 'brightness',
  amModulationDepth: 'AM depth',
  spectralFlatness: 'texture balance',
  spectralFlux: 'stability',
};

function clampStep(current: number, suggested: number): number {
  const delta = suggested - current;
  const maxDelta = Math.abs(current) * 0.2 || 0.2;
  if (Math.abs(delta) > maxDelta) {
    return current + Math.sign(delta) * maxDelta;
  }
  return suggested;
}

function makeDescription(req: AnalyzeRequest): string {
  const outOfRange = Object.entries(req.comparison)
    .filter(([, value]) => !value.inRange)
    .sort((a, b) => Math.abs(b[1].value - average(b[1].target)) - Math.abs(a[1].value - average(a[1].target)));

  if (outOfRange.length === 0) {
    return 'The mix is inside the target ranges for the selected mood.';
  }

  const [feature, entry] = outOfRange[0];
  const label = FEATURE_PRIORITY[feature] ?? feature;
  const target = `${entry.target[0].toFixed(2)} to ${entry.target[1].toFixed(2)}`;
  return `The session is closest to target overall, but ${label} is the main outlier right now at ${entry.value.toFixed(2)} against ${target}.`;
}

function buildTopPriority(req: AnalyzeRequest): string {
  const ordered = Object.entries(req.comparison).filter(([, value]) => !value.inRange);
  if (ordered.length === 0) {
    return 'Hold the current mix';
  }

  const [feature] = ordered[0];
  switch (feature) {
    case 'lufsEstimate':
      return 'Bring the mix level back toward target';
    case 'spectralCentroid':
      return 'Reduce the brightness slightly';
    case 'amModulationDepth':
      return 'Trim the modulation depth';
    case 'spectralFlatness':
      return 'Balance tone and noise a bit more';
    case 'spectralFlux':
      return 'Reduce transient movement';
    default:
      return 'Nudge the current mix toward the reference';
  }
}

function buildSuggestions(req: AnalyzeRequest): Record<string, number> | undefined {
  if (!req.currentParams || !req.source.includes('generated')) {
    return undefined;
  }

  const suggestions: Record<string, number> = {};
  const current = req.currentParams;
  const comp = req.comparison;

  if (comp.lufsEstimate && !comp.lufsEstimate.inRange && current.padVolume !== undefined) {
    suggestions.padVolume = clampStep(current.padVolume, current.padVolume * (comp.lufsEstimate.value < comp.lufsEstimate.target[0] ? 1.1 : 0.9));
  }

  if (comp.spectralCentroid && !comp.spectralCentroid.inRange && current.padFilterHz !== undefined) {
    suggestions.padFilterHz = clampStep(current.padFilterHz, current.padFilterHz * (comp.spectralCentroid.value > comp.spectralCentroid.target[1] ? 0.9 : 1.08));
  }

  if (comp.spectralFlatness && !comp.spectralFlatness.inRange && current.textureVolume !== undefined) {
    suggestions.textureVolume = clampStep(current.textureVolume, current.textureVolume * (comp.spectralFlatness.value > comp.spectralFlatness.target[1] ? 0.9 : 1.08));
  }

  if (comp.amModulationDepth && !comp.amModulationDepth.inRange && current.amDepth !== undefined) {
    suggestions.amDepth = clampStep(current.amDepth, current.amDepth * (comp.amModulationDepth.value > comp.amModulationDepth.target[1] ? 0.9 : 1.08));
  }

  return Object.keys(suggestions).length > 0 ? suggestions : undefined;
}

function average(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

export const onRequestPost: PagesFunction = async (context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const req = await context.request.json() as AnalyzeRequest;
    if (!req.features || !req.comparison) {
      return new Response(JSON.stringify({ error: 'features and comparison required' }), { status: 400, headers });
    }

    const description = makeDescription(req);
    const topPriority = buildTopPriority(req);
    const parameterSuggestions = buildSuggestions(req);
    const response: AnalyzeResponse = {
      description,
      topPriority,
      disclaimer: 'Local heuristic analysis only. It highlights mix balance, not medical or cognitive outcomes.',
      parameterSuggestions,
    };

    return new Response(JSON.stringify(response), { status: 200, headers });
  } catch (err) {
    console.error('[audio-analyze]', err);
    const msg = err instanceof Error ? err.message : 'unknown error';
    return new Response(JSON.stringify({ error: `analysis_failed: ${msg}` }), { status: 500, headers });
  }
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
