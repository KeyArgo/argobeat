# ArgoBeat

**Music-first focus, relaxation, and sleep audio — built on the Web Audio API.**

ArgoBeat plays curated music and ambient soundscapes, then applies subtle target-rate modulation to the audio layer. No accounts, no tracking, no server-side processing. Everything runs in the browser.

Live at [argobeat.app](https://argobeat.app)

---

## What It Does

- **5 listening moods** — Focus, Deep Work, Relax, Meditate, Sleep
- **Curated music** — Lo-fi and ambient instrumental tracks, mood-matched and randomized
- **Curated soundscapes** — Rain, ocean, forest, cafe, fire, space, stream, wind, thunder, jungle
- **Target-rate modulation** — Subtle amplitude and spectral modulation applied to the mix
- **Real-time visualizer** — FFT waveform display
- **Playback diagnostics** — Rolling session metrics and exportable JSON payload
- **Privacy-first** — No data leaves your browser

The science page at `/science` summarizes the mixed evidence around auditory-beat research. These are audio design targets, not guaranteed cognitive effects.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 8+

### Install

```bash
git clone https://github.com/keyargo/argobeat.git
cd argobeat
pnpm install
```

### Develop

```bash
pnpm dev
```

Visit `http://localhost:4321`

### Build

```bash
pnpm build
```

Output goes to `apps/web/dist/`. Deploy that folder to any static host (Cloudflare Pages, Netlify, Vercel, S3, etc.).

---

## Repository Structure

```
argobeat/
├── apps/
│   └── web/              # Astro web app (the player UI)
├── packages/
│   └── @argobeat/engine/ # Core audio engine (TypeScript, Web Audio API)
├── tools/                # Audio analysis and catalog tools (Python + shell)
├── docs/                 # Design notes
└── spikes/               # Experimental integrations
```

### Key Packages

| Package | Description |
|---------|-------------|
| `@argobeat/engine` | Audio engine — soundscape management, modulation chain, music player |
| `argobeat-web` | Astro app — UI components, pages, styles |

---

## Audio Engine

The engine lives in `packages/@argobeat/engine` and is written in strict TypeScript with no runtime dependencies beyond the browser's Web Audio API.

```typescript
import { ArgoBeatEngine } from '@argobeat/engine';

const engine = new ArgoBeatEngine();
await engine.initialize();
await engine.play('focus');
```

See [`packages/@argobeat/engine/README.md`](packages/@argobeat/engine/README.md) for full API documentation.

---

## Audio Tools

Python tools for working with the audio catalog:

```bash
# Validate the audio manifest
pnpm audio:validate

# Analyze an exported session
python3 tools/analyze_audio.py --file session.wav --mood focus --target-hz 15

# Export a demo loop from the CLI
pnpm audio:demo
```

Dependencies: `pip install -r tools/requirements.txt`

---

## Audio Assets

The music catalog and soundscapes (~2 GB of MP3 files) are not included in this repository — they are too large for git and are served from a CDN in production.

**To run the app locally with audio:**

1. **Use the hosted CDN** — Point the web app at `https://argobeat.app`. The audio manifest already references `/audio/…` relative paths, so any static host that serves the files alongside the app will work.

2. **Build your own catalog** — If you want to self-host the audio, use `tools/ingest_audio.py` to import your own audio files into the expected directory layout under `apps/web/public/audio/`.

3. **Download from a release** — Future releases will include a CDN URL or a downloadable audio bundle.

The small instrument samples used by the procedural synthesizer (`apps/web/public/audio/samples/`, ~1.5 MB) are included in the repo and deploy automatically.

---

## Optional: AI Music Generation

The engine includes an optional music generation module. Wire it to any HTTP backend that accepts a text prompt and returns audio bytes. See [`packages/@argobeat/engine/src/music/README.md`](packages/@argobeat/engine/src/music/README.md).

Compatible backends include local [MusicGen](https://github.com/facebookresearch/audiocraft) (GPU required), Hugging Face Inference, and Replicate.

---

## Contributing

See [`packages/@argobeat/engine/CONTRIBUTING.md`](packages/@argobeat/engine/CONTRIBUTING.md).

Quick checks before submitting a PR:

```bash
pnpm type-check   # TypeScript — must pass
pnpm build        # Full build — must pass
```

---

## License

MIT — see [`packages/@argobeat/engine/LICENSE`](packages/@argobeat/engine/LICENSE)
