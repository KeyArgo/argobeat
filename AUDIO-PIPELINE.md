# ArgoBeat Audio Pipeline

Working document for audio asset preparation. Follow this when adding new soundscapes or music tracks.

---

## Loudness Targets

| Layer | Target | True Peak | Rationale |
|-------|--------|-----------|-----------|
| **Soundscapes** | -18 LUFS | -1.5 dBTP | Clear background, never jarring |
| **Music tracks** | -14 LUFS | -1.0 dBTP | Leads the mix by ~4 dB over ambience |

These targets produce a balanced mix through the engine's gain chain. Do not change them without re-normalizing all files.

**Acceptable tolerance:** ±2 dB from target. Files outside this range should be re-processed.

**Exception — inherently sparse content:** Singing bowls, isolated gong strikes, and crackling fire have long silent gaps between transients. Even with compression these files may land 2–3 dB below target. This is acceptable — do not over-compress to hit the target exactly, as it destroys the natural character. The `--check` tool will flag these as OFF; that is expected.

---

## Adding New Soundscape Files

### 1. Prepare the file

Source files can be WAV, AIFF, FLAC, or MP3. Convert to 44.1 kHz stereo MP3 at 320 kbps.

**Standard file (steady-state audio — rain, ocean, forest, stream, wind):**
```bash
ffmpeg -y -i input.wav \
  -af "loudnorm=I=-18:TP=-1.5:LRA=11:print_format=none" \
  -ar 44100 -ac 2 -codec:a libmp3lame -q:a 2 \
  output.mp3
```

**Dynamic file (fire, thunder, singing bowls, gongs):**
These have loud transients and long quiet gaps. Compress first, then normalize:
```bash
ffmpeg -y -i input.wav \
  -af "acompressor=threshold=-25dB:ratio=4:attack=5:release=300:makeup=6dB,loudnorm=I=-18:TP=-1.5:LRA=11:print_format=none" \
  -ar 44100 -ac 2 -codec:a libmp3lame -q:a 2 \
  output.mp3
```

**Verify after processing:**
```bash
ffmpeg -i output.mp3 -af loudnorm=print_format=json -f null - 2>&1 | grep -E '"input_i"|"input_tp"'
# input_i should be within 1-2 dB of -18.0
# input_tp should be below -1.0
```

### 2. Register in the manifest

Add to `packages/@argobeat/engine/src/soundscape/audio-manifest.ts`:
```ts
{ id: 'category-trackname', name: 'Display Name', file: 'filename.mp3' },
```

If the category is new, also add it to:
- `packages/@argobeat/engine/src/types.ts` — `SoundscapeCategory` union
- `packages/@argobeat/engine/src/soundscape/variations.ts` — `CATEGORY_MAP`
- `packages/@argobeat/engine/src/mood/moods.ts` — affinity weights per mood

### 3. Upload to R2

```bash
wrangler r2 object put "argobeat-audio/soundscapes/CATEGORY/filename.mp3" \
  --file="apps/web/public/audio/soundscapes/CATEGORY/filename.mp3" \
  --content-type="audio/mpeg" \
  --remote
```

---

## Adding New Music Tracks

Music tracks come from MiniMax (AI-generated) or the existing catalog.

### 1. Normalize

```bash
ffmpeg -y -i input.mp3 \
  -af "loudnorm=I=-14:TP=-1:LRA=11:print_format=none" \
  -ar 44100 -ac 2 -codec:a libmp3lame -q:a 2 \
  output.mp3
```

**Verify:**
```bash
ffmpeg -i output.mp3 -af loudnorm=print_format=json -f null - 2>&1 | grep -E '"input_i"|"input_tp"'
# input_i should be within 1-2 dB of -14.0
# input_tp must be below 0.0 (no clipping)
```

### 2. Register in the manifest

Add to `SHARED_MUSIC_LIBRARY` in `audio-manifest.ts`:
```ts
'track-id': { id: 'track-id', name: 'Track Name', file: 'track-id.mp3' },
```

Then add the track ID to the relevant mood playlists in `moodPlaylist(...)` calls.

### 3. Upload to R2

```bash
wrangler r2 object put "argobeat-audio/music/shared/filename.mp3" \
  --file="apps/web/public/audio/music/shared/filename.mp3" \
  --content-type="audio/mpeg" \
  --remote
```

---

## Batch Normalization Script

To re-normalize everything at once (use when importing many files):

```bash
python3 tools/normalize-audio.py
```

The script is at `tools/normalize-audio.py` and handles the standard vs dynamic distinction automatically. It backs up originals before modifying files.

---

## Backup Policy

Pre-normalization originals are kept at:
- **AllShare**: `/mnt/AllShare/Argobeat/sounds-originals-prenorm-YYYYMMDD/`
- Keep at least the most recent backup snapshot before any batch normalization run.

The R2 bucket (`argobeat-audio`) holds only the production-ready normalized files. Do not upload unnormalized files to R2.

---

## File Storage Map

| What | Local path | R2 key |
|------|-----------|--------|
| Soundscapes | `apps/web/public/audio/soundscapes/CATEGORY/file.mp3` | `soundscapes/CATEGORY/file.mp3` |
| Music (shared) | `apps/web/public/audio/music/shared/file.mp3` | `music/shared/file.mp3` |
| Provenance | `apps/web/public/audio/music/provenance/` | `music/provenance/` |

Audio is served via CF Worker at `https://argobeat.app/audio`.

---

## Engine Gain Chain (reference)

The Web Audio graph applies these gains on top of the file's normalized level:

```
Soundscape: file (-18 LUFS) × getSoundscapeBlend(mood) × base_multiplier
Music:      file (-14 LUFS) × getMusicBlend(mood) × base_multiplier
```

Base multipliers (in `engine.ts`):
- Soundscape `both` mode: `0.65 × blend`
- Soundscape `soundscape-only` mode: `0.85 × blend`
- Music `both` mode: `0.82 × blend`

Sprint boost multiplies the soundscape gain by 2× (capped at 0.90).

`NORMALIZATION_TARGET_DB = -18` in `soundscape/manager.ts` should match the file target. The browser-side RMS normalization is a safety net for files that slip through; it is not a substitute for proper file normalization.

---

## History

| Date | What |
|------|------|
| 2026-05-03 | First batch normalization — 55 soundscapes to -18 LUFS, 65 music tracks to -14 LUFS. Compression applied to fire/thunder/gongs/bowls. Originals at `sounds-originals-prenorm-20260503`. |
| 2026-05-03 | Soundscape categories added: `gongs`, `jungle`. |
| 2026-05-03 | 25 MiniMax hero tracks generated (5 per mood) and added to playlists. |
