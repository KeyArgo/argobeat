# Contributing to @argobeat/engine

Thank you for your interest in contributing to ArgoBeat's audio engine.

## Getting Started

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   pnpm install
   ```

2. **Type-check**
   ```bash
   pnpm type-check
   ```

## Project Structure

```
src/
├── engine.ts              # Core orchestrator (public API)
├── types.ts               # All type definitions
├── index.ts               # Barrel exports
├── preferences.ts         # User preference learning (thumbs up/down)
├── version.ts             # Version constant
├── modulation/            # Amplitude and spectral modulation chain
│   ├── chain.ts
│   └── index.ts
├── mood/                  # Mood definitions and session randomizer
│   ├── moods.ts
│   └── randomizer.ts
├── music-gen/             # Procedural synthesis engine
│   ├── generative.ts
│   ├── markov.ts
│   ├── patterns.ts
│   ├── rng.ts
│   ├── scales.ts
│   ├── synthesis.ts
│   └── types.ts
├── soundscape/            # Soundscape and music management
│   ├── audio-loader.ts
│   ├── audio-manifest.ts  # Track catalog and URL helpers
│   ├── manager.ts         # Soundscape playback manager
│   ├── music-manager.ts   # Music track playback manager
│   ├── variations.ts      # Variation selection logic
│   └── index.ts
├── music/                 # Optional AI music generation (see music/README.md)
└── worklet/
    └── pink-noise.worklet.js
```

## Code Style

- **TypeScript strict mode** — all code must pass `tsc --strict`
- **JSDoc on public exports** — every public function/class gets a doc comment
- **No external runtime dependencies** — the engine must work with zero `npm install`
- **Web Audio API only** — no audio libraries (Tone.js, Howler, etc.)

## Adding a Soundscape Category

1. Add the new category name to `SoundscapeCategory` in `types.ts`
2. Add an entry to `SOUNDSCAPE_TRACKS` in `soundscape/audio-manifest.ts`
3. Add the audio files to `apps/web/public/audio/soundscapes/<category>/`

## Adding Music Tracks

1. Add track entries to `SHARED_MUSIC_LIBRARY` in `soundscape/audio-manifest.ts`
2. Add track IDs to the relevant mood playlists in `MUSIC_TRACKS`
3. Add audio files to `apps/web/public/audio/music/<mood>/`

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/description`
2. Make your changes
3. Run `pnpm type-check` — must pass
4. Submit a PR with a clear description

## Testing

Currently tested via type-checking and manual browser testing.

```bash
# Type-check
pnpm type-check
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
