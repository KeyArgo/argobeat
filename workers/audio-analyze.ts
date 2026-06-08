/**
 * ArgoBeat Audio Analysis Worker
 *
 * Provider chain — tries each in order, moves to next on quota/error:
 *   1. Groq / LLaMA 3.3 70B  — 500k tokens/day FREE (~250 calls). Primary.
 *   2. Cloudflare Workers AI  — 10k neurons/day FREE (~5-10 calls). No external dep.
 *   3. Gemini 2.0 Flash       — free tier quota limited; last resort.
 *
 * Secrets:
 *   GROQ_API_KEY     — wrangler secret put GROQ_API_KEY
 *   GEMINI_API_KEY   — wrangler secret put GEMINI_API_KEY
 *
 * Bindings (wrangler.toml):
 *   [ai] binding = "AI"  — Cloudflare Workers AI
 */

export interface Env {
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
  AI: {
    run(model: string, options: { messages: Array<{ role: string; content: string }> }): Promise<{ response: string }>;
  };
  DB: any; // D1Database — typed as any to avoid CF Workers types dependency
}

interface AnalyzeRequest {
  features: Record<string, number>;
  sessionProfile?: Record<string, { mean: number; std: number }>;
  comparison: {
    overallScore: number;
    referenceId: string;
    checks: Array<{
      feature: string;
      value: number;
      target: [number, number];
      inRange: boolean;
      score: number;
    }>;
  };
  mood: string;
  source: string;
  currentParams?: Record<string, number>;
  /** Currently playing track slug (from engine state) */
  track?: string;
  /** Currently playing soundscape category */
  soundscape?: string;
  /** How this analysis was triggered */
  triggered?: 'manual' | 'auto-tune';
}

interface AnalyzeResponse {
  description: string;
  featureInterpretation: string;
  scienceAlignment: string;
  warnings: string[];
  /** Only populated when source includes 'generated' */
  parameterSuggestions?: Record<string, number>;
  overallScore: number;
  topPriority: string;
  disclaimer: string;
}

// Safe parameter bounds — AI cannot suggest values outside these
const PARAM_BOUNDS: Record<string, [number, number]> = {
  padFilterHz:    [120, 3000],
  padVolume:      [0.1,  0.9],
  textureVolume:  [0.01, 0.20],
  amDepth:        [0.01, 0.18],
  reverbWet:      [0.1,  0.85],
};

const SYSTEM_PROMPT = `You are an expert in psychoacoustics and functional music design for focus and relaxation applications.

You will be given extracted acoustic features from a playing audio session, a comparison against a validated reference profile, and context about the synthesis engine. Your job is to interpret what the numbers mean perceptually and scientifically, and suggest specific improvements.

SCIENCE CONTEXT (with accuracy notes):
- Focus background music target: -24 to -27 LUFS. This is based on subjective loudness research and streaming normalization guidelines. Higher = more arousing, harder to ignore.
- Spectral centroid target for focus: 500–950 Hz (dark/warm). High centroid = brighter = more attention-grabbing. The 800 Hz target is derived from analysis of a focus reference recording.
- Spectral flatness 0.15–0.40 for focus: too low = overly tonal/harsh; too high = noise-only, unmusical.
- Spectral flux target: low (< 0.08). High flux = transients and changes = distracting.
- AM modulation depth 0.05–0.15: the app applies amplitude modulation at the mood's target Hz (e.g., 15 Hz for focus). IMPORTANT DISCLAIMER: peer-reviewed evidence that AM modulation of audio carriers at these frequencies produces measurable cognitive effects is LIMITED. The strongest available evidence is one 2024 Communications Biology study. Do not overstate the mechanism. Below 0.05 depth is measurable in the audio file but likely subliminal.
- Low frequency energy ratio < 0.30 for focus: too much bass adds fatigue.
- Crest factor < 9 dB: high crest = jarring transients.

CRITICAL: The AnalyserNode in the current implementation is mono-summed post-compressor. Any stereo/binaural content is destroyed before measurement. Flag this prominently if relevant.

WHAT GOOD FOCUS AUDIO SOUNDS LIKE: It disappears. After 90 seconds you stop noticing it. It does not have melodic hooks, emotional arcs, or sections that resolve. The best test is whether a listener can describe the melody after 5 minutes — they should not be able to.

WHAT BAD FOCUS AUDIO SOUNDS LIKE: You find yourself listening to it. The music makes you feel something. You notice it changing. This is the failure mode of most "focus" playlists.

Output valid JSON only. No markdown, no explanation outside the JSON.`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // ── GET /history — query saved evaluations ───────────────────────
    if (request.method === 'GET' && url.pathname === '/history') {
      return handleHistory(request, env, url);
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body: AnalyzeRequest;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    const { features, comparison, mood, source, currentParams, sessionProfile } = body;
    if (!features || !comparison || !mood) {
      return jsonError('Missing required fields: features, comparison, mood', 400);
    }

    const prompt = buildPrompt(body);

    // Provider chain: Groq (250/day free) → CF Workers AI (10/day free) → Gemini (limited)
    let aiResponse: string;
    let usedProvider = '';

    try {
      aiResponse = await callGroq(prompt, env.GROQ_API_KEY);
      usedProvider = 'groq';
    } catch (groqErr: any) {
      try {
        aiResponse = await callCfAI(prompt, env.AI);
        usedProvider = 'cf-ai';
      } catch (cfErr: any) {
        try {
          aiResponse = await callGemini(prompt, env.GEMINI_API_KEY);
          usedProvider = 'gemini';
        } catch (geminiErr: any) {
          return jsonError(
            `All providers failed. Groq: ${groqErr.message} | CF AI: ${cfErr.message} | Gemini: ${geminiErr.message}`,
            502,
          );
        }
      }
    }

    const geminiResponse = aiResponse;

    let parsed: AnalyzeResponse;
    try {
      // Gemini sometimes wraps in markdown code blocks
      const clean = geminiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // If JSON parse fails, return the raw text wrapped in a structure
      parsed = {
        description: geminiResponse,
        featureInterpretation: '',
        scienceAlignment: '',
        warnings: ['Response was not valid JSON — raw text returned in description'],
        overallScore: comparison.overallScore,
        topPriority: 'Review raw description',
        disclaimer: 'See science context in system prompt.',
      };
    }

    // Enforce parameter bounds
    if (parsed.parameterSuggestions && source.includes('generated')) {
      parsed.parameterSuggestions = clampParams(parsed.parameterSuggestions, currentParams);
    } else {
      delete parsed.parameterSuggestions;
    }

    // ── Persist to D1 (fire-and-forget, never block the response) ────
    if (env.DB) {
      const f = body.features ?? {};
      env.DB.prepare(`
        INSERT INTO evaluations
          (ts, mood, source, track, soundscape,
           lufs, centroid, flatness, flux, am_depth, am_rate,
           score, ai_desc, ai_priority, ai_provider, triggered,
           params_before, params_after)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        Date.now(), mood, source,
        body.track ?? null, body.soundscape ?? null,
        f.lufsEstimate ?? null, f.spectralCentroid ?? null,
        f.spectralFlatness ?? null, f.spectralFlux ?? null,
        f.amModulationDepth ?? null, f.amModulationRateHz ?? null,
        comparison.overallScore,
        parsed.description ?? null, parsed.topPriority ?? null,
        usedProvider, body.triggered ?? 'manual',
        currentParams ? JSON.stringify(currentParams) : null,
        parsed.parameterSuggestions ? JSON.stringify(parsed.parameterSuggestions) : null,
      ).run().catch(() => {}); // never fail the response
    }

    return new Response(JSON.stringify({ ...parsed, _provider: usedProvider }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

// ── History endpoint ──────────────────────────────────────────────────────

async function handleHistory(_request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return jsonError('DB not configured', 503);
  try {

  const mood     = url.searchParams.get('mood');
  const limit    = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);
  const minScore = url.searchParams.get('minScore');
  const maxScore = url.searchParams.get('maxScore');
  const track    = url.searchParams.get('track');
  const since    = url.searchParams.get('since'); // ISO or unix ms

  let sql = 'SELECT * FROM evaluations WHERE 1=1';
  const params: (string | number)[] = [];

  if (mood)     { sql += ' AND mood = ?';          params.push(mood); }
  if (track)    { sql += ' AND track = ?';          params.push(track); }
  if (minScore) { sql += ' AND score >= ?';         params.push(parseFloat(minScore)); }
  if (maxScore) { sql += ' AND score <= ?';         params.push(parseFloat(maxScore)); }
  if (since)    { sql += ' AND ts >= ?';            params.push(Number.isNaN(Date.parse(since)) ? parseInt(since,10) : Date.parse(since)); }

  sql += ' ORDER BY ts DESC LIMIT ?';
  params.push(limit);

  const result = await env.DB.prepare(sql).bind(...params).all();

  return new Response(JSON.stringify({
    count: result.results.length,
    evaluations: result.results,
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
  } catch (err: any) {
    return jsonError(`DB error: ${err.message}`, 500);
  }
}

function buildPrompt(body: AnalyzeRequest): string {
  const { features, comparison, mood, source, currentParams, sessionProfile } = body;

  const failingFeatures = comparison.checks
    .filter(c => !c.inRange)
    .map(c => `  ${c.feature}: current=${c.value.toFixed(3)}, target=[${c.target[0]}, ${c.target[1]}], score=${c.score.toFixed(1)}/10`)
    .join('\n');

  const passingFeatures = comparison.checks
    .filter(c => c.inRange)
    .map(c => `  ${c.feature}: ${c.value.toFixed(3)} ✓`)
    .join('\n');

  const sourceIsGenerated = source.includes('generated');

  return `${SYSTEM_PROMPT}

---
CURRENT SESSION DATA:
Mood: ${mood}
Source mode: ${source}
Overall score vs reference: ${comparison.overallScore.toFixed(1)}/10
Reference: ${comparison.referenceId}

FAILING FEATURES (outside target range):
${failingFeatures || '  (none — all in range)'}

PASSING FEATURES:
${passingFeatures}

${sessionProfile ? `SESSION AVERAGE (last 30s):
${JSON.stringify(sessionProfile, null, 2)}` : ''}

${currentParams && sourceIsGenerated ? `CURRENT SYNTHESIS PARAMETERS (generated mode):
${JSON.stringify(currentParams, null, 2)}

PARAMETER BOUNDS (you must stay within these):
${JSON.stringify(PARAM_BOUNDS, null, 2)}` : ''}

---
Respond with valid JSON in this exact schema:
{
  "description": "Plain English description of what this audio sounds like perceptually",
  "featureInterpretation": "What the specific feature values mean for the listener experience",
  "scienceAlignment": "How well this aligns with evidence-based focus/relaxation audio principles. Be honest about what is and isn't proven.",
  "warnings": ["Array of specific concerns — list each on its own"],
  ${sourceIsGenerated ? `"parameterSuggestions": {
    "padFilterHz": <number within ${PARAM_BOUNDS.padFilterHz}>,
    "padVolume": <number within ${PARAM_BOUNDS.padVolume}>,
    "textureVolume": <number within ${PARAM_BOUNDS.textureVolume}>,
    "amDepth": <number within ${PARAM_BOUNDS.amDepth}>
  },` : ''}
  "overallScore": <number 0-10>,
  "topPriority": "Single most important thing to fix",
  "disclaimer": "Honest statement about the scientific limitations of this analysis"
}`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callCfAI(prompt: string, ai: Env['AI']): Promise<string> {
  const result = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [{ role: 'user', content: prompt }],
  });
  if (!result?.response) throw new Error('CF AI returned empty response');
  return result.response;
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}

function clampParams(
  suggested: Record<string, number>,
  current: Record<string, number> | undefined,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(suggested)) {
    const bounds = PARAM_BOUNDS[key];
    if (!bounds) continue;
    const [lo, hi] = bounds;
    let clamped = Math.max(lo, Math.min(hi, val));

    // Step clamp: max 40% change from current per iteration.
    // Skip if current is near zero (would clamp to zero — unhelpful).
    const cur = current?.[key];
    if (cur !== undefined && cur > 0.01) {
      const maxDelta = cur * 0.40;
      clamped = Math.max(cur - maxDelta, Math.min(cur + maxDelta, clamped));
    }

    result[key] = Math.round(clamped * 1000) / 1000;
  }
  return result;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
