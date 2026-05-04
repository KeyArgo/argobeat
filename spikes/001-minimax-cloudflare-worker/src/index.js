export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({
        ok: true,
        service: 'minimax-music-2.6-spike',
        routes: ['POST /generate'],
      });
    }

    if (request.method !== 'POST' || url.pathname !== '/generate') {
      return new Response('Not found', { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return Response.json({ ok: false, error: `invalid json: ${err.message}` }, { status: 400 });
    }

    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      return Response.json({ ok: false, error: 'prompt is required' }, { status: 400 });
    }

    const modelInput = {
      prompt,
      is_instrumental: body.is_instrumental ?? true,
      lyrics_optimizer: body.lyrics_optimizer ?? false,
      format: body.format || 'wav',
      sample_rate: body.sample_rate || 44100,
    };

    if (body.lyrics) {
      modelInput.lyrics = body.lyrics;
    }
    if (body.bitrate) {
      modelInput.bitrate = body.bitrate;
    }

    const modelName = String(body.model || 'minimax/music-2.6').trim();

    try {
      const startedAt = Date.now();
      const options = body.no_gateway ? undefined : { gateway: { id: 'default' } };
      const result = await env.AI.run(modelName, modelInput, options);
      return Response.json({
        ok: true,
        model: modelName,
        elapsed_ms: Date.now() - startedAt,
        input: modelInput,
        options: options || null,
        result,
      });
    } catch (err) {
      return Response.json(
        {
          ok: false,
          model: modelName,
          input: modelInput,
          error: err?.message || String(err),
          stack: err?.stack || null,
        },
        { status: 500 }
      );
    }
  },
};
