# ArgoBeat

Music-first focus, relaxation, meditation, and sleep audio built on the Web Audio API.

ArgoBeat plays curated music with subtle target-rate modulation for different mental states. No medical claims — just measurable audio markers and a pleasant listening layer.

## Features

- **Four mood modes** — Focus, Relax, Meditate, Sleep with distinct modulation profiles
- **Curated audio** — Mood-specific track ordering with randomized start points
- **Shuffle bag engine** — Intelligent rotation with preference overlays and cooldowns
- **Version switching** — Toggle between v0.1.0 (legacy) and v0.2.0
- **Session tracking** — Export session data with user-selected state and audio-category metadata
- **Audio analysis** — Catalog analysis and category-mismatch detection

## Quick Start

```bash
pnpm install
pnpm run dev
```

Visit http://localhost:4321

## Build

```bash
pnpm run build
pnpm run preview
```

## Audio Pipeline

See [AUDIO-PIPELINE.md](AUDIO-PIPELINE.md) for the full audio pipeline documentation.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions.

## Project Structure

```
apps/web/          Astro web application
packages/engine/   Core audio engine with modulation, mood config, and music gen
tools/             Analysis scripts, music profile generators, audio tools
workers/           Cloudflare Workers (audio analyze API)
functions/api/     API functions
scripts/           Build and deployment scripts
docs/              Documentation
```

## License

See [LICENSE](packages/@argobeat/engine/LICENSE) for licensing information.
