# ArgoBeat Web App

Standalone music-first focus, relaxation, and sleep audio application built with Astro.

## Development

```bash
pnpm install
pnpm run dev
```

Visit http://localhost:4321

## Building

```bash
pnpm run build
pnpm run preview
```

## Deployment

Cloudflare Pages (static output):

```bash
pnpm run build
# Deploy dist/ folder to Cloudflare Pages
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with mode showcase and science overview |
| `/app` | Full player with transport controls, visualizer, and settings |
| `/science` | Research citations and methodology |
| `/export` | Record a session to WAV for offline analysis |

## Features

- 5 listening moods (Focus, Deep Work, Relax, Meditate, Sleep)
- Curated music with subtle target-rate modulation
- Curated soundscapes for rain, forest, ocean, cafe, fire, space, stream, wind, and thunder
- Real-time FFT waveform visualizer
- Collapsed Playback Diagnostics panel with 30-second local monitoring notes
- AI handoff JSON for copy/download and localStorage-based support/debug passes
- Optional auto-refresh of the ambience layer when repetition stays high
- localStorage preference persistence
- Static audio assets with client-side Web Audio API processing
- Dark/light theme support
- Mobile-responsive layout
- Privacy-first (no tracking, no accounts, no server-side processing)

## Playback diagnostics and AI handoff

The `/app` player keeps diagnostics collapsed by default so the listening flow stays clean.

Inside `Playback diagnostics` you can:

- inspect the rolling 30-second fit / fatigue / repetition / headroom / pulse summary
- see live source context badges for stream/music blend plus the current entrainment method (Invisible, Binaural, Isochronic)
- verify that stream variations and binaural state land in the machine-readable JSON payload as live playback metadata
- copy or download the current machine-readable JSON payload for an AI assistant or external tool
- enable a conservative auto-refresh mode that only rotates the ambience layer when repetition stays high

Current storage/API surfaces:

- localStorage latest payload: `argobeat-ai-monitor-v1`
- localStorage rolling history: `argobeat-ai-monitor-history-v1`
- localStorage auto-tune toggle: `argobeat-ai-autotune-v1`
- browser helper: `window.__argobeatMonitor.getPayload()`

Important scope note:

- diagnostics are local browser heuristics over the outgoing audio mix
- there are no provider calls or backend inference loops in this surface
- auto-tune is intentionally limited to low-risk reversible actions

## Browser Support

- Chrome/Edge 57+
- Firefox 55+
- Safari 14.1+
- Mobile Safari (iOS 14.5+)

Audio assets are static files. Playback, gain shaping, and modulation run in the browser via the Web Audio API.

## Project Structure

```
src/
  components/
    layout/     Navbar
    player/     ArgoBeatPlayer, ModeSelector, WaveVisualizer, SessionTimer, VolumeControls
    ui/         Card, Button
  layouts/      Base.astro
  pages/        index, app, science, test
  styles/       global.css (design tokens)
```

## License

MIT
