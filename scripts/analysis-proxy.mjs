/**
 * ArgoBeat Analysis Proxy
 *
 * Local dev server that proxies /api/audio-analyze requests through
 * the Gemini CLI (uses your Google subscription, no API key needed).
 *
 * Run: node scripts/analysis-proxy.mjs
 * Then open the player at http://localhost:4321/app
 *
 * The player will POST feature JSON here; this calls `gemini` CLI
 * as a subprocess and returns the structured analysis.
 */

import { createServer } from 'http';
import { spawn } from 'child_process';

const PORT = 3001;

const SYSTEM_CONTEXT = `You are an expert in psychoacoustics and functional music design for focus/relaxation apps.
Analyze the acoustic features below vs the reference targets. Be direct and specific.
IMPORTANT: Return ONLY valid JSON, no markdown, no explanation outside the JSON.
SCIENCE NOTE: AM modulation of audio carriers at 12-18Hz has limited peer-reviewed evidence for cognitive effects. Do not overstate the mechanism.`;

async function callGemini(prompt) {
  // Use spawn with arguments array — no shell involvement, no injection risk
  const child = spawn('gemini', ['-p', prompt], {
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  for await (const chunk of child.stdout) stdout += chunk;
  for await (const chunk of child.stderr) stderr += chunk;

  return new Promise((resolve, reject) => {
    child.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `gemini exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function buildPrompt(body) {
  const { features, comparison, mood, source, currentParams } = body;

  const failing = (comparison.checks || [])
    .filter(c => !c.inRange)
    .map(c => `  ${c.feature}: current=${c.value?.toFixed(3)}, target=[${c.target}], score=${c.score?.toFixed(1)}/10`)
    .join('\n') || '  (none — all in range)';

  const passing = (comparison.checks || [])
    .filter(c => c.inRange)
    .map(c => `  ${c.feature}: ${c.value?.toFixed(3)} ✓`)
    .join('\n') || '  (none)';

  const isGenerated = source?.includes('generated');

  return `${SYSTEM_CONTEXT}

MOOD: ${mood} | SOURCE: ${source} | SCORE: ${comparison.overallScore?.toFixed(1)}/10 vs ${comparison.referenceId}

FAILING (outside target):
${failing}

PASSING:
${passing}

${isGenerated && currentParams ? `CURRENT SYNTHESIS PARAMS: ${JSON.stringify(currentParams)}

PARAMETER SUGGESTIONS must stay within these bounds:
  padFilterHz: 120–3000
  padVolume: 0.1–0.9
  textureVolume: 0.01–0.20
  amDepth: 0.01–0.18` : ''}

Respond with this JSON schema:
{
  "description": "Plain English perceptual description",
  "featureInterpretation": "What the numbers mean for the listener",
  "scienceAlignment": "Honest assessment vs evidence-based focus music principles",
  "warnings": ["specific concern 1", "specific concern 2"],
  ${isGenerated ? `"parameterSuggestions": { "padFilterHz": <num>, "padVolume": <num>, "textureVolume": <num>, "amDepth": <num> },` : ''}
  "overallScore": <0-10>,
  "topPriority": "Single most important fix",
  "disclaimer": "Honest statement about scientific limitations"
}`;
}

const server = createServer(async (req, res) => {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/audio-analyze') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body;
  try {
    const raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  console.log(`[analyze] mood=${body.mood} source=${body.source} score=${body.comparison?.overallScore?.toFixed(1)}`);

  try {
    const prompt = buildPrompt(body);
    const raw = await callGemini(prompt);

    // Strip markdown if present
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        description: raw,
        featureInterpretation: '',
        scienceAlignment: '',
        warnings: ['Gemini did not return valid JSON'],
        overallScore: body.comparison?.overallScore ?? 5,
        topPriority: 'Check raw description',
        disclaimer: 'Parse error — raw response in description field',
      };
    }

    // Clamp parameter suggestions (safety)
    if (parsed.parameterSuggestions) {
      const bounds = { padFilterHz:[120,3000], padVolume:[0.1,0.9], textureVolume:[0.01,0.20], amDepth:[0.01,0.18] };
      for (const [k, [lo, hi]] of Object.entries(bounds)) {
        if (parsed.parameterSuggestions[k] !== undefined) {
          parsed.parameterSuggestions[k] = Math.max(lo, Math.min(hi, parsed.parameterSuggestions[k]));
          // Max 20% step from current
          const cur = body.currentParams?.[k];
          if (cur) {
            const max = cur * 1.20, min = cur * 0.80;
            parsed.parameterSuggestions[k] = Math.max(min, Math.min(max, parsed.parameterSuggestions[k]));
          }
          parsed.parameterSuggestions[k] = Math.round(parsed.parameterSuggestions[k] * 1000) / 1000;
        }
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(parsed));
  } catch (err) {
    console.error('[analyze] error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Gemini CLI error: ${err.message}` }));
  }
});

server.listen(PORT, () => {
  console.log(`ArgoBeat Analysis Proxy running at http://localhost:${PORT}`);
  console.log(`Using Gemini CLI (your subscription) — no API key needed`);
  console.log(`Player should be at http://localhost:4321/app`);
});
