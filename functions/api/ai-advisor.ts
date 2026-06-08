interface AdvisorRequest {
  mood: string;
  soundscape: string;
  elapsedMin: number;
  trackName?: string;
}

interface AdvisorResponse {
  suggestion: string;
  action?: { type: 'soundscape'; category: string } | { type: 'music' };
}

function buildAdvisorResponse(req: AdvisorRequest): AdvisorResponse {
  const mood = req.mood || 'focus';
  const track = req.trackName?.trim() || '';
  const soundscape = req.soundscape || 'auto';
  const elapsed = Number.isFinite(req.elapsedMin) ? req.elapsedMin : 0;

  if (!track && soundscape !== 'soundscape') {
    return {
      suggestion: 'The music layer is not settled yet. Start with a fresh track before changing the rest of the scene.',
      action: { type: 'music' },
    };
  }

  if ((mood === 'focus' || mood === 'deepWork') && soundscape === 'thunder') {
    return {
      suggestion: 'Thunder is too aggressive for sustained work. Forest is a safer masking bed.',
      action: { type: 'soundscape', category: 'forest' },
    };
  }

  if (mood === 'relax') {
    return {
      suggestion: 'Keep the scene gentle. Ocean is the cleanest small shift if you want to soften the mix.',
      action: soundscape === 'auto' ? { type: 'soundscape', category: 'ocean' } : undefined,
    };
  }

  if (elapsed >= 8) {
    return {
      suggestion: `${track || 'The current scene'} has done its job. Refresh the track if you want a small reset.`,
      action: { type: 'music' },
    };
  }

  return {
    suggestion: `${track || 'The current scene'} is stable enough for now. Leave it alone unless it starts pulling attention.`,
  };
}

export const onRequestPost: PagesFunction = async (context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const req = await context.request.json() as AdvisorRequest;
    if (!req.mood) {
      return new Response(JSON.stringify({ error: 'mood required' }), { status: 400, headers });
    }

    const response = buildAdvisorResponse(req);
    return new Response(JSON.stringify(response), { status: 200, headers });
  } catch (err) {
    console.error('[ai-advisor]', err);
    const msg = err instanceof Error ? err.message : 'unknown error';
    return new Response(JSON.stringify({ error: `advisor_failed: ${msg}` }), { status: 500, headers });
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
