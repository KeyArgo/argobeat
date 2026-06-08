# @argobeat/engine

Music-first audio engine with subtle target-rate modulation for focus, relaxation, meditation, and sleep sessions.

ArgoBeat plays curated local music and ambient recordings, then applies lightweight Web Audio modulation to the content layer. Procedural synthesis remains available as a fallback, but the primary experience is static audio assets plus browser-side processing.

## Installation

```bash
npm install @argobeat/engine
```

## Overview

ArgoBeat builds a randomized session from a mood, a target modulation range, a music playlist, and compatible soundscapes. It does not claim medical or cognitive effects; it exposes measurable audio markers and keeps the listening layer pleasant.

### How It Works

1. **Curated music** - Mood-specific track ordering with randomized start points and skip support.

2. **Curated soundscapes** - Rain/weather, rivers and streams, ocean/coast, forest birds and night-insect beds, cafe, fire, space, wind, and thunder recordings selected by mood affinity.

3. **Target-rate modulation** - Subtle amplitude, spectral, and spatial modulation applied to content audio. The verifier checks audio markers, not health outcomes.

## Session Modes

Five core moods target different modulation ranges:

| Mood | Band | Target Hz | Typical use |
|------|------|-----------|-------------|
| `focus` | beta | 12-18 Hz | Reading, coding, detail work |
| `deepWork` | beta | 16-20 Hz | Long engineering or creative sessions |
| `relax` | alpha | 8-12 Hz | Unwinding, casual reading |
| `meditate` | theta | 4-7 Hz | Mindfulness and breathwork |
| `sleep` | delta | 0.5-3.5 Hz | Sleep onset and quiet rest |

The science page summarizes the mixed evidence around auditory-beat and modulation studies. Treat these as audio design targets, not guaranteed brain-state changes.

## Soundscapes

Soundscape categories:

- **Rain** - Soft rain and rain noise
- **Forest** - Birds, branches, night ambience, cicadas, and crickets
- **Ocean** - Beach, wave, and coast-bird recordings
- **Cafe** - Coffee shop ambience
- **Fire** - Fireplace and crackle recordings
- **Space** - Drone and ambient textures
- **Stream** - Creek, river, and trickling-water recordings
- **Wind** - Gentle breeze, tree movement, and wind noise
- **Thunder** - Opt-in thunder ambience

## Usage

### Starting Playback

```typescript
import { ArgoBeatEngine } from '@argobeat/engine';

const engine = new ArgoBeatEngine();
await engine.initialize();
await engine.play('focus', { source: 'both' });
```

### Importing Types

```typescript
import type { Mood, EngineState, SoundscapeCategory } from '@argobeat/engine';
```

## TypeScript

Written in strict TypeScript. Full type definitions are shipped with the package — no `@types/` package needed.

All interfaces and type aliases are exported and documented with JSDoc comments.

## Browser Compatibility

Requires a modern browser with:

- **Web Audio API** — Chrome 35+, Firefox 25+, Safari 14.1+, Edge 79+
- **AudioWorklet** — Chrome 66+, Firefox 76+, Safari 14.1+, Edge 79+
- **ES2020** — All evergreen browsers

Mobile browsers require a user gesture (click/tap) before AudioContext can start playback. The engine handles this via AudioContext.resume() on first interaction.

## Audio Node Graph

```
[Music or Soundscape Audio] -> Gain -> Modulation Chain -> Master -> Compressor -> destination
[Analyser] read-only tap off master bus
```

## License

MIT
