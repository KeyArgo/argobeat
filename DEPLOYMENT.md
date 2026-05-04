# ArgoBeat Deployment Checklist

## Pre-Launch Verification

- [ ] Engine builds without errors: `cd packages/@argobeat/engine && pnpm build`
- [ ] Standalone site builds: `cd apps/web && pnpm build`
- [ ] All modes play without errors (Focus, Deep Work, Relax, Meditate, Sleep)
- [ ] Soundscapes load properly (no audio glitches)
- [ ] AudioContext cleanup works (no dangling resources)
- [ ] Mobile tested on iOS Safari (AudioContext.resume)
- [ ] Volume controls respond smoothly
- [ ] LocalStorage persistence works (reload page, settings intact)

## Deployment Steps

### Standalone Site (argobeat.app)

1. **Build**
   ```bash
   cd apps/web
   pnpm build
   ```

2. **Deploy to Cloudflare Pages**

   Upload `apps/web/dist/` in the Cloudflare Pages dashboard, or connect the repo for auto-deploy on push.

3. **Verify**
   - Visit https://argobeat.app
   - Test all modes: Focus, Work, Sleep
   - Check landing page loads
   - Science page accessible at /science

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 2.5s |
| Cumulative Layout Shift | < 0.1 |
| Console errors | None |
| AudioContext latency | < 100ms |

## Known Limitations

- **AudioWorklet support**: Pink noise generation requires AudioWorklet. Older browsers fall back to ScriptProcessorNode (lower performance).
- **User gesture required**: First session requires a click/tap (browser security policy). Subsequent sessions work freely.
- **Mobile sample rate**: Mobile devices may limit AudioContext sample rate (varies by device).
- **Pause/resume**: Paused sessions require oscillator rebuild. AudioContext.suspend()/resume() preserves node state but some browsers may garbage-collect suspended contexts.
- **Binaural beats require headphones**: The stereo separation effect only works with headphones. Isochronic tones work on speakers.

## Build Verification

Run the complete verification:

```bash
# From repo root
cd packages/@argobeat/engine && pnpm build && cd ../..
cd apps/web && pnpm build && cd ../..
echo "All builds passed"
```

## AI Music Generation Backend (Optional)

ArgoBeat supports optional AI music generation via an HTTP backend.

### Quick Setup (Mock Server for Testing)

```bash
pip install fastapi uvicorn
# Create a simple mock server that returns audio bytes
uvicorn mock_musicgen:app --port 8000
```

### Production Setup (MusicGen)

```bash
pip install audiocraft fastapi uvicorn torch
# Requires CUDA-capable GPU for reasonable generation times
# See: https://github.com/facebookresearch/audiocraft
```

### Verification

- [ ] Backend responds to GET `/api/generate` with 200 or 405
- [ ] Backend accepts POST with `{ prompt, duration, format }` body
- [ ] Backend returns valid WAV or MP3 audio bytes
- [ ] Engine connects: `await engine.checkMusicBackend()` returns true
- [ ] Music generates for Focus mode without errors
- [ ] Crossfade from soundscape to music works smoothly
- [ ] Cache stores generated track in IndexedDB

### Configuration

```typescript
const engine = new ArgoBeatEngine({
  music: {
    enabled: true,
    generator: {
      endpoint: 'http://localhost:8000/api/generate',
      timeoutMs: 120000,
      format: 'wav'
    },
    cacheEnabled: true,
    musicVolume: 0.5,
    soundscapeDuckLevel: 0.15,
    crossfadeSeconds: 3
  }
});
```

## Future Enhancements

- [ ] Session history and analytics
- [ ] Custom frequency input
- [ ] AI prompt provider integration
- [ ] User preference learning
- [ ] PWA support (offline playback)
- [ ] Keyboard shortcuts (space = play/pause)
- [ ] Additional AI backends (Stable Audio, Replicate)
