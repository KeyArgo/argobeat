# Contributing to @argobeat/engine

Thank you for your interest in contributing to ArgoBeat's audio engine.

## Getting Started

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd packages/@argobeat/engine
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Type-check**
   ```bash
   npx tsc --noEmit
   ```

4. **Build**
   ```bash
   pnpm build
   ```

## Project Structure

```
src/
├── engine.ts              # Core orchestrator (public API)
├── types.ts               # All type definitions
├── presets.ts             # 8 session mode presets
├── index.ts               # Barrel exports
├── entrainment/           # Binaural + isochronic tone synthesis
│   ├── binaural.ts
│   └── isochronic.ts
├── soundscape/            # Procedural ambient soundscapes
│   ├── layered.ts         # Rain, ocean, forest, cafe, fire, space
│   └── noise.ts           # White, pink, brown noise generators
└── music/                 # AI music generation (optional)
    ├── types.ts           # Music-specific interfaces
    ├── prompts.ts         # Static + Claude prompt providers
    ├── generator.ts       # HTTP client for music backends
    ├── player.ts          # Web Audio playback + crossfade
    ├── cache.ts           # IndexedDB track cache
    └── index.ts           # Music module exports
```

## Code Style

- **TypeScript strict mode** — all code must pass `tsc --strict`
- **JSDoc on public exports** — every public function/class gets a doc comment
- **No external runtime dependencies** — the engine must work with zero `npm install`
- **Web Audio API only** — no audio libraries (Tone.js, Howler, etc.)
- **Frequency/algorithm comments** — explain the math behind audio processing

## Adding a Prompt Provider

Implement the `PromptProvider` interface:

```typescript
import type { PromptProvider, SessionContext } from './music/types.js';
import type { SessionMode } from './types.js';

export class MyProvider implements PromptProvider {
  readonly id = 'my-provider';

  async generatePrompt(mode: SessionMode, context?: SessionContext): Promise<string> {
    return `Generate ${mode} music...`;
  }
}
```

## Adding a Soundscape

1. Add the type to `SoundscapeType` in `types.ts`
2. Create a builder function in `soundscape/layered.ts`
3. Add the case to `_buildSoundscape()` in `engine.ts`

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/description`
2. Make your changes
3. Run `npx tsc --noEmit` — must pass
4. Submit a PR with a clear description

## Testing

Currently tested via type-checking and manual browser testing. See `Vaults/argobox/testing/argobeat/` for test matrices.

```bash
# Type-check
npx tsc --noEmit

# Build
pnpm build
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
