# ArgoBeat Music Generation Profiles

## Categories (v0.2.0)

| Category | BPM | Sound Target | Description |
|----------|-----|-------------|-------------|
| **Focus** | 100-130 | Dark, warm, motivating, low harshness | Minimal rhythm, not zero. Enough motion to feel like music. |
| **Deep Work** | 80-100 | Dark, warm, subdued, low event density | Very minimal rhythm. More subdued than Focus. |
| **Relax** | 50-80 | Calm, pleasant, nature-first, subdued drone | No rhythm. Nature sounds + soft drone. Non-task-specific calm. |
| **Meditate** | 30-50 | Trance-like, sparse gongs/bowls, long decay | No rhythm, very sparse events. Ritual calm, not busy. |
| **Sleep** | 20-40 | Almost nothing happening, soft hum, no surprises | Near-static noise/hum. Safe to leave on while falling asleep. |

## Usage

```bash
# Generate a focus track
python3 generate.py --profile focus --instrument guitar-swells --bpm 120 --seed 42

# Generate a deep work track
python3 generate.py --profile deep-work --instrument strings-drone --bpm 90 --seed 42

# Generate a relax track (nature + drone)
python3 ambient-gen.py --type relax --layers rain,stream --drone --duration 300

# Generate a meditate track with gongs
python3 ambient-gen.py --type meditate --layers rain --drone --gongs --gong-interval 300 --duration 600

# Generate a sleep track (near-static)
python3 generate.py --profile sleep --instrument bass-drone --bpm 30 --seed 42

# Generate with custom parameters
python3 generate.py --profile focus --instrument piano-strings --bpm 115 --duration 60 --steps 80
```

## Profiles

### Focus (100-130 BPM)
- Minimal rhythm, not zero
- Dark/warm, motivating, low harshness
- Multiple layers working together
- Lowpass: 1500Hz
- Volume: -16 LUFS

### Deep Work (80-100 BPM)
- Very minimal rhythm
- Dark/warm, subdued, low event density
- More subdued than Focus
- Lowpass: 1400Hz
- Volume: -18 LUFS

### Relax (50-80 BPM)
- No rhythm
- Calm, pleasant, nature-first, subdued drone
- Rain, stream, wind, ocean + soft pad
- Lowpass: 1200Hz
- Volume: -17 LUFS

### Meditate (30-50 BPM)
- No rhythm, very sparse events
- Trance-like, sparse gongs/bowls, long decay
- Ritual calm, not busy
- Lowpass: 1000Hz
- Volume: -20 LUFS

### Sleep (20-40 BPM)
- No rhythm, no changes, near-static
- Almost nothing happening, soft hum, no surprises
- Safe to leave on while falling asleep
- Lowpass: 800Hz
- Volume: -22 LUFS

## Instruments

| Instrument | Description | Best For |
|------------|-------------|----------|
| guitar-swells | Electric guitar, volume pedal, long reverb | Focus |
| felt-piano | Soft keys, sustained chords | Focus, Deep Work, Relax |
| strings-drone | Orchestral strings, sustained bowing | Deep Work |
| synth-pad | Analog synth, warm analog | Focus, Meditate |
| chimes-bells | Chimes, bells, mallets | Meditate |
| bass-drone | Sub bass, deep bass | Sleep, Deep Work |
| piano-chimes | Piano + chimes/bells | Meditate |
| strings-synth | Strings + synth pad | Focus |
| guitar-strings | Guitar + strings | Focus |

## Generation Parameters

### ACE-Step Settings
- guidance_scale: 12.0 (balanced variation)
- infer_step: 60 (quality vs speed)
- audio_duration: 30.0 (standard clip length)
- cfg_type: "apg" (attention-guided)

### Post-Processing Chain
1. Normalize to -6 dB (headroom for limiting)
2. Lowpass filter (800-1500Hz per category)
3. Compressor (even out dynamics)
4. Brickwall limit (prevent clipping)
5. Final normalize to target LUFS

## Loudness Rule

- **50-75% volume** should feel comfortable and right
- **100% volume** should be too loud but still clean, not clipped
- If you have to run at 100% to enjoy it, the source level is too low

## Recipe Manifest

Every generated track gets a `.json` recipe file alongside it. The recipe captures:
- Category and generation parameters
- ACE-Step settings (prompt, seed, BPM, etc.)
- FFmpeg post-processing chain
- Human listening QA results

See `recipe-schema.json` for the full schema and `recipes/` for examples.

## Tips

1. **Seed matters** — same seed = same track. Use different seeds for variety.
2. **BPM affects energy** — higher BPM = more focus energy, lower = more calm.
3. **Instrument choice matters** — guitar = more musical, synth = more ambient.
4. **Duration** — 30s is standard, 60s for more variation, 90s for longer loops.
5. **Steps** — 60 is good balance, 80+ for higher quality but slower.
