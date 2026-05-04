# @argobeat/engine/music

Optional AI music generation module for ArgoBeat. Generates unique, professional-quality music for each session using pluggable backends (MusicGen, Stable Audio, etc.).

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    PromptProvider                           │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │ StaticPromptProv  │  │  CustomPromptProvider (opt.)   │  │
│  │ (zero deps)       │  │  (implement PromptProvider)    │  │
│  └────────┬─────────┘  └──────────────┬─────────────────┘  │
│           └──────────┬─────────────────┘                    │
│                      ▼                                      │
│              MusicGenerator                                 │
│    (calls HTTP endpoint with text prompt)                   │
│                      │                                      │
│                      ▼                                      │
│               MusicPlayer                                   │
│    (Web Audio graph: BufferSource → GainNode)               │
│                      │                                      │
│                      ▼                                      │
│            ArgoBeatEngine.musicGain                          │
│                      │                                      │
│                      ▼                                      │
│              masterGain → compressor → destination           │
└────────────────────────────────────────────────────────────┘
```

## Quick Start

### Basic (static prompts, local backend)

```typescript
import { ArgoBeatEngine } from '@argobeat/engine';

const engine = new ArgoBeatEngine({
  music: { enabled: true }
});

await engine.initialize();
await engine.play('focus');
// Soundscape plays immediately, music crossfades in when generated
```

### With a Custom Prompt Provider

```typescript
import { ArgoBeatEngine } from '@argobeat/engine';
import type { PromptProvider, SessionContext } from '@argobeat/engine';
import type { SessionMode } from '@argobeat/engine';

class MyProvider implements PromptProvider {
  readonly id = 'my-provider';

  async generatePrompt(mode: SessionMode, context?: SessionContext): Promise<string> {
    return `Generate ${mode} instrumental music, calm and focused.`;
  }
}

const engine = new ArgoBeatEngine({
  music: {
    enabled: true,
    promptProvider: new MyProvider(),
    generator: { endpoint: 'https://my-musicgen-api.com/generate' }
  }
});
```

### Custom Backend

```typescript
const engine = new ArgoBeatEngine({
  music: {
    enabled: true,
    generator: {
      endpoint: 'https://api.replicate.com/v1/predictions',
      headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` },
      timeoutMs: 180000,
      format: 'mp3'
    }
  }
});
```

## Backend API Contract

The music generator calls an HTTP endpoint that must accept:

**Request:**
```http
POST /api/generate
Content-Type: application/json

{
  "prompt": "Calm focused instrumental music, 72 BPM, soft piano...",
  "duration": 1500,
  "format": "wav"
}
```

**Response:**
```http
Content-Type: audio/wav
Body: <raw audio bytes>
```

### Compatible Backends

| Backend | Local | Free Tier | Notes |
|---------|-------|-----------|-------|
| [audiocraft](https://github.com/facebookresearch/audiocraft) (MusicGen) | Yes | N/A | Best quality, requires GPU |
| [Hugging Face Inference](https://huggingface.co/docs/api-inference) | No | Yes | Rate limited |
| [Replicate](https://replicate.com) | No | Credits | Pay-per-use |
| [Stable Audio](https://stableaudio.com) | No | Credits | Alternative model |

### Setting Up a Local MusicGen Server

```bash
# Install audiocraft
pip install audiocraft

# Run the API server (example using FastAPI)
pip install fastapi uvicorn

# See examples/musicgen-server.py for a ready-to-use server
uvicorn musicgen_server:app --host 0.0.0.0 --port 8000
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable music generation |
| `promptProvider` | `PromptProvider` | `StaticPromptProvider` | Text prompt generator |
| `generator.endpoint` | `string` | `http://localhost:8000/api/generate` | Backend URL |
| `generator.timeoutMs` | `number` | `120000` | Request timeout |
| `generator.format` | `'wav' \| 'mp3'` | `'wav'` | Audio format |
| `generator.headers` | `Record<string, string>` | `{}` | Auth headers |
| `cacheEnabled` | `boolean` | `true` | Cache tracks in IndexedDB |
| `maxCachedTracks` | `number` | `20` | Max cached tracks |
| `musicVolume` | `number` | `0.5` | Music layer volume (0-1) |
| `soundscapeDuckLevel` | `number` | `0.15` | Soundscape vol when music plays |
| `crossfadeSeconds` | `number` | `3` | Crossfade duration |

## Custom Prompt Provider

Implement the `PromptProvider` interface:

```typescript
import type { PromptProvider, SessionContext } from '@argobeat/engine';
import type { SessionMode } from '@argobeat/engine';

class MyCustomProvider implements PromptProvider {
  readonly id = 'custom';

  async generatePrompt(mode: SessionMode, context?: SessionContext): Promise<string> {
    // Your logic here — call an API, use templates, etc.
    return `Generate ${mode} music at ${context?.timeOfDay ?? 12}:00`;
  }
}
```

## How It Works

1. User clicks "Focus" → engine starts immediately with soundscape
2. In background: PromptProvider generates text description
3. MusicGenerator POSTs prompt to backend, receives audio bytes
4. Audio decoded to AudioBuffer via Web Audio API
5. MusicPlayer crossfades from soundscape to music (configurable duration)
6. If generation fails, soundscape continues uninterrupted

## License

MIT
