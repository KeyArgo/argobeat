# ArgoBeat Music Generation System — Updated

## Quick Reference

**Location:** `/mnt/homes/galileo/argo/Development/argobeat/tools/music-profiles/`

**Generated samples:** `/mnt/AllShare/Argobeat/generated/{profile}/`

## How to Generate Music

### Generated Music (Focus/Sleep)
```bash
cd /mnt/homes/galileo/argo/Development/argobeat/tools/music-profiles

# Focus track
python3 generate.py --profile focus --instrument guitar-swells --bpm 120 --seed 42

# Sleep track
python3 generate.py --profile sleep --instrument bass-drone --bpm 45 --seed 456

# Batch generation
python3 generate.py --profile focus --instrument guitar-swells --bpm 120 --batch 5
```

### Nature Sounds (Ambient/Meditation)
```bash
# Use existing nature sounds directly (no generation needed)
vlc /mnt/AllShare/Argobeat/cloudflare-backup-2026-06-01/audio/soundscapes/rain/rain-noise.mp3
vlc /mnt/AllShare/Argobeat/cloudflare-backup-2026-06-01/audio/soundscapes/stream/gentle-stream.mp3

# Mix nature sounds with generated drone
python3 ambient-mixer.py --sound rain --drone --drone-instrument synth-pad --duration 300
python3 ambient-mixer.py --sound stream --drone --duration 600
python3 ambient-mixer.py --sound wind --drone --drone-bpm 50 --duration 1800
```

## Profiles

| Profile | Type | BPM | Volume | Source |
|---------|------|-----|--------|--------|
| **focus** | Generated | 100-130 | -20 dB | ACE-Step |
| **sleep** | Generated | 40-50 | -23 dB | ACE-Step |
| **ambient** | Real recordings | 0 | -19 to -23 dB | Nature sounds |

## Instruments (for generated music)

| Name | Description | Best For |
|------|-------------|----------|
| guitar-swells | Electric guitar, volume pedal, long reverb | Focus |
| guitar-strings | Guitar + strings | Focus |
| strings-synth | Strings + synth pad | Focus |
| synth-pad | Analog synth, warm analog | Focus, Sleep |
| felt-piano | Soft keys, sustained chords | Focus, Sleep |
| strings-drone | Orchestral strings, sustained bowing | Focus, Sleep |
| chimes-bells | Chimes, bells, mallets | Meditation |
| piano-chimes | Piano + chimes/bells | Meditation |
| bass-drone | Sub bass, deep bass | Sleep |

## Nature Sounds (for ambient)

| Category | Tracks | Best For |
|----------|--------|----------|
| **rain** | 5 tracks | Meditation, Sleep |
| **stream** | 11 tracks | Meditation, Relaxation |
| **wind** | 18 tracks | Meditation, Sleep |
| **ocean** | 8 tracks | Relaxation, Sleep |
| **birds** | 2 tracks | Meditation, Focus |
| **fire** | 5 tracks | Relaxation |
| **gongs** | 1 track | Meditation |

## Tips

1. **Same seed = same track** — use different seeds for variety
2. **BPM affects energy** — higher = more focus, lower = more calm
3. **Nature sounds are better for meditation** — no generation needed
4. **Mix approach** — nature sounds + drone = organic meditation
5. **Volume normalization** — always check with `volumedetect`

## File Locations

- **Profiles:** `/mnt/homes/galileo/argo/Development/argobeat/tools/music-profiles/`
- **Generated:** `/mnt/AllShare/Argobeat/generated/{profile}/`
- **Nature sounds:** `/mnt/AllShare/Argobeat/cloudflare-backup-2026-06-01/audio/soundscapes/`
- **Reference:** `/mnt/AllShare/Argobeat/trimmed/` (brain.fm samples)

## Updating Profiles

To add a new instrument or profile:
1. Edit the profile markdown file
2. Update the INSTRUMENT_MAP in generate.py
3. Test with: `python3 generate.py --profile focus --instrument new-instrument --bpm 120`
