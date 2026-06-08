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
| `/test` | Engine integration test page |

## Features

- 5 listening moods (Focus, Deep Work, Relax, Meditate, Sleep)
- Curated music with subtle target-rate modulation
- Curated soundscapes for rain, forest, ocean, cafe, fire, space, stream, wind, and thunder
- Real-time FFT waveform visualizer
- localStorage preference persistence
- Static audio assets with client-side Web Audio API processing
- Dark/light theme support
- Mobile-responsive layout
- Privacy-first (no tracking, no accounts, no server-side processing)

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
