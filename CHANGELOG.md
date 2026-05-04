# Changelog

## v0.1.0 — 2026-05-04

Initial public release.

### What's included

- **Audio engine** (`@argobeat/engine`) — TypeScript, zero runtime dependencies, Web Audio API only
- **5 listening moods** — Focus, Deep Work, Relax, Meditate, Sleep
- **Curated music** — Lo-fi and ambient instrumental tracks with mood-matched playlists
- **Soundscape categories** — Rain, ocean, forest, cafe, fire, space, stream, wind, thunder, jungle
- **Target-rate modulation** — Subtle amplitude and spectral modulation applied to the mix
- **Procedural synthesis** — Fallback generative engine when no audio assets are present
- **Real-time FFT visualizer**
- **Playback diagnostics** — Rolling session metrics, exportable JSON payload
- **User preference learning** — Thumbs up/down feedback with adaptive track weighting
- **Kimi music director** (`workers/kimi`) — Optional Cloudflare Worker for AI-directed session suggestions
- **Audio tools** — Python scripts for normalization, catalog analysis, and batch generation
- **Static Astro web app** — Deployable to any static host or Cloudflare Pages

### Notes

- Audio assets (music and soundscapes, ~2 GB) are not included in the repository. See README for setup options.
- The `workers/kimi` directory requires a Kimi API key and Cloudflare Workers account to deploy.
