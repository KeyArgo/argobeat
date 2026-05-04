/**
 * ArgoBeat Kimi — AI music director worker.
 *
 * Calls Kimi AI (api.moonshot.cn) to generate real music direction advice
 * with structured action buttons the player can render and execute directly.
 * Deployed as: argobeat-kimi
 */

interface Env {
  KIMI_API_KEY: string;        // OpenRouter API key
}

interface SuggestPayload {
  mood?: string;
  soundscape?: string;
  elapsed_minutes?: number;
  current_track?: string;
  brightness?: number;
  rms?: number;
  bass_share?: number;
  high_band_share?: number;
  dynamic_spread?: number;
  modulation_percent?: number;
  sprint_boost_active?: boolean;
  thumbs_up_count?: number;
  thumbs_down_count?: number;
}

// Action button the player can render and execute directly
interface ActionButton {
  label: string;           // Button text shown to user
  action: string;          // 'soundscape' | 'music' | 'boost_on' | 'boost_off' | 'modulation' | 'scene'
  params?: Record<string, string | number | boolean>;
}

interface KimiResponse {
  suggestion: string;
  buttons: ActionButton[];
  auto_apply?: boolean;    // If true, player should apply first button automatically in auto mode
  orchestrated_by: string;
  model?: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `You are Kimi, an AI music director for ArgoBeat — a focus, relaxation, and sleep audio platform.

You receive live session data including real audio measurements and must return specific, actionable guidance.

ALWAYS respond in exactly this JSON format (no markdown, no extra text):
{
  "read": "<one sentence describing what you're hearing — use the audio measurements provided>",
  "suggestion": "<one to two sentences explaining what to change and why, in plain conversational English>",
  "buttons": [
    { "label": "<short button label>", "action": "<action_code>", "params": { <optional params> } }
  ],
  "auto_apply": <true if the change is gentle and non-disruptive, false if it changes the scene significantly>
}

Available action codes:
- "soundscape" with params { "category": "rain|ocean|forest|stream|wind|fire|space|cafe|gongs|jungle" }
- "music" — skip to next track (crossfade, no interruption)
- "boost_on" — engage sprint boost (live gain ramp, no restart)
- "boost_off" — ease sprint boost (live gain ramp, no restart)
- "modulation" with params { "percent": 0-20 }

Rules:
- Always return 1 to 3 buttons. The FIRST button MUST be the action you recommend in your suggestion text. If your suggestion says "rain would help", the first button must be soundscape:rain. Never put a music skip first if you recommended a soundscape change.
- For soundscape, boost, and modulation changes: set auto_apply true (they're gentle, no interruption).
- For music skips: set auto_apply false (user must choose — track changes are personal).
- Label buttons with short plain verbs matching what you suggested: "Switch to Rain", "Try Gongs", "Ease Boost", "Fresh Track".
- Secondary buttons can offer an alternative — e.g., if you suggest rain, a secondary button could be "Fresh Track" as a different option.
- Never suggest a track skip as your primary action unless the track is the specific problem you identified.
- Never suggest dramatic changes. One small targeted move at a time.
- Base your read on the actual audio measurements — mention specific values when relevant.`;

function buildPrompt(p: SuggestPayload): string {
  const lines = [
    `Mood: ${p.mood ?? 'focus'}`,
    `Soundscape: ${p.soundscape ?? 'auto'}`,
    `Elapsed: ${Math.round(p.elapsed_minutes ?? 0)} minutes`,
  ];
  if (p.current_track) lines.push(`Track: ${p.current_track.replace(/-/g, ' ')}`);
  if (p.brightness != null) lines.push(`Brightness: ${(p.brightness * 100).toFixed(0)}% (0=dark, 100=bright/harsh)`);
  if (p.rms != null) lines.push(`Loudness (RMS): ${(p.rms * 100).toFixed(0)}%`);
  if (p.bass_share != null) lines.push(`Bass share: ${(p.bass_share * 100).toFixed(0)}%`);
  if (p.high_band_share != null) lines.push(`High-frequency share: ${(p.high_band_share * 100).toFixed(0)}%`);
  if (p.dynamic_spread != null) lines.push(`Dynamic spread: ${(p.dynamic_spread * 100).toFixed(0)}% (0=compressed, 100=punchy)`);
  if (p.modulation_percent != null) lines.push(`Ambience modulation: ${p.modulation_percent}%`);
  if (p.sprint_boost_active) lines.push('Sprint boost: active');
  if (p.thumbs_up_count) lines.push(`Thumbs up given: ${p.thumbs_up_count}`);
  if (p.thumbs_down_count) lines.push(`Thumbs down given: ${p.thumbs_down_count}`);
  return lines.join('\n');
}

const FALLBACK_BUTTONS: Record<string, KimiResponse> = {
  focus: {
    suggestion: 'The session has momentum. A stream soundscape would add clean masking without competing with the track.',
    buttons: [
      { label: 'Switch to Stream', action: 'soundscape', params: { category: 'stream' } },
      { label: 'Fresh Track', action: 'music' },
    ],
    auto_apply: true,
    orchestrated_by: 'kimi-fallback',
  },
  deepWork: {
    suggestion: 'Deep work sessions hold best with low-stimulation masking. Rain keeps the background steady without pulling attention.',
    buttons: [
      { label: 'Switch to Rain', action: 'soundscape', params: { category: 'rain' } },
      { label: 'Engage Boost', action: 'boost_on' },
    ],
    auto_apply: true,
    orchestrated_by: 'kimi-fallback',
  },
  relax: {
    suggestion: 'Ocean backgrounds tend to open relax sessions up. Worth switching if the current background feels busy.',
    buttons: [
      { label: 'Switch to Ocean', action: 'soundscape', params: { category: 'ocean' } },
      { label: 'Fresh Track', action: 'music' },
    ],
    auto_apply: false,
    orchestrated_by: 'kimi-fallback',
  },
  meditate: {
    suggestion: 'Gongs and singing bowls deepen meditation sessions. Let the scene settle before making any changes.',
    buttons: [
      { label: 'Switch to Gongs', action: 'soundscape', params: { category: 'gongs' } },
    ],
    auto_apply: false,
    orchestrated_by: 'kimi-fallback',
  },
  sleep: {
    suggestion: 'Low arousal is working. Rain keeps the signal steady and consistent for sleep onset.',
    buttons: [
      { label: 'Switch to Rain', action: 'soundscape', params: { category: 'rain' } },
    ],
    auto_apply: true,
    orchestrated_by: 'kimi-fallback',
  },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', worker: 'argobeat-kimi', model: 'moonshotai/kimi-k2-0905', route: 'openrouter' }, { headers: CORS });
    }

    if (url.pathname !== '/suggest' || request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    let payload: SuggestPayload = {};
    try { payload = await request.json(); } catch { /* empty payload ok */ }

    const mood = (payload.mood ?? 'focus') as string;
    const fallback = FALLBACK_BUTTONS[mood] ?? FALLBACK_BUTTONS.focus;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.KIMI_API_KEY}`,
          'HTTP-Referer': 'https://argobeat.app',
          'X-Title': 'ArgoBeat Kimi Director',
        },
        body: JSON.stringify({
          model: 'moonshotai/kimi-k2-0905',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildPrompt(payload) },
          ],
          max_tokens: 300,
          temperature: 0.6,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[kimi] API error ${res.status}: ${errBody}`);
        throw new Error(`kimi_api_${res.status}`);
      }

      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      const raw = (data.choices?.[0]?.message?.content ?? '').trim();
      console.log(`[kimi] raw response: ${raw.slice(0, 200)}`);
      let parsed: { read?: string; suggestion?: string; buttons?: ActionButton[]; auto_apply?: boolean };
      try {
        // Try JSON parse first; fall back to extracting JSON block if model wraps it in markdown
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      } catch (parseErr) {
        console.error(`[kimi] JSON parse failed: ${parseErr}`);
        throw new Error('kimi_parse_failed');
      }
      const suggestion = [parsed.read, parsed.suggestion].filter(Boolean).join(' ');
      let buttons: ActionButton[] = Array.isArray(parsed.buttons) && parsed.buttons.length > 0
        ? parsed.buttons.slice(0, 3)
        : fallback.buttons;

      // Validate: if suggestion mentions a specific soundscape, ensure first button matches.
      // This catches cases where the model recommends rain but puts music skip first.
      const SOUNDSCAPE_CATS = ['rain','ocean','forest','stream','wind','fire','space','cafe','gongs','jungle'];
      const mentionedCat = SOUNDSCAPE_CATS.find(cat =>
        suggestion.toLowerCase().includes(cat)
      );
      if (mentionedCat && buttons.length > 0 && buttons[0].action !== 'soundscape') {
        // Check if a soundscape button exists further down — move it to front
        const scIdx = buttons.findIndex(b => b.action === 'soundscape');
        if (scIdx > 0) {
          const [sc] = buttons.splice(scIdx, 1);
          buttons.unshift(sc);
          console.log(`[kimi] reordered: moved soundscape:${(sc.params as any)?.category} to front`);
        } else {
          // No soundscape button at all — inject one matching the mentioned category
          buttons.unshift({
            label: `Switch to ${mentionedCat.charAt(0).toUpperCase() + mentionedCat.slice(1)}`,
            action: 'soundscape',
            params: { category: mentionedCat },
          });
          buttons = buttons.slice(0, 3);
          console.log(`[kimi] injected missing soundscape:${mentionedCat} button`);
        }
      }

      return Response.json({
        suggestion: suggestion || fallback.suggestion,
        buttons,
        auto_apply: parsed.auto_apply ?? false,
        orchestrated_by: 'kimi',
        model: 'moonshot-v1-8k',
      } satisfies KimiResponse, { headers: CORS });

    } catch (err) {
      console.error('[kimi] failed:', err);
      return Response.json({ ...fallback, orchestrated_by: 'kimi-fallback' } satisfies KimiResponse, { headers: CORS });
    }
  },
};
