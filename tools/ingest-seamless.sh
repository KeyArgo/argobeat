#!/usr/bin/env bash
#
# ingest-seamless.sh — transcode + upload the 30-minute seamless ArgoBeat assets to R2.
#
# The browser engine downloads each track in full and decodes it into an in-memory
# AudioBuffer (see audio-loader.ts -> decodeAudioData). Raw PCM WAV/FLAC at 30 min is
# far too large to ship to a browser this way, and several source files are mono at
# 48/96/192 kHz. So this script normalizes everything to 44.1 kHz / stereo / 192 kbps
# MP3 before upload.
#
# Output naming (served by the argobeat-audio.argobox.workers.dev R2 worker):
#   soundscapes/<category>/seamless-30min.mp3
#   music/seamless/<mood>-30min.mp3
#
# Usage:
#   tools/ingest-seamless.sh transcode                 # produce MP3s in $OUT_DIR
#   tools/ingest-seamless.sh upload <r2-bucket-name>   # wrangler r2 put the MP3s
#   tools/ingest-seamless.sh all <r2-bucket-name>      # transcode then upload
#
# Env overrides:
#   SRC_AMBIENTS  (default /mnt/AllShare/Argobeat/generated-2026-06-01/ambients)
#   SRC_MUSIC     (default /mnt/AllShare/Argobeat/generated-2026-06-01/music)
#   OUT_DIR       (default $REPO/.seamless-mp3)
#   MP3_BITRATE   (default 192k)
#
# NOTE: `wrangler r2 object put` requires an API token with R2 write scope. The
# OAuth token currently logged in for this repo does NOT have R2 scope — set
# CLOUDFLARE_API_TOKEN to an R2-enabled token (or `wrangler login` with R2) first.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_AMBIENTS="${SRC_AMBIENTS:-/mnt/AllShare/Argobeat/generated-2026-06-01/ambients}"
SRC_MUSIC="${SRC_MUSIC:-/mnt/AllShare/Argobeat/generated-2026-06-01/music}"
OUT_DIR="${OUT_DIR:-$REPO/.seamless-mp3}"
MP3_BITRATE="${MP3_BITRATE:-192k}"

# Map source ambient WAV basename -> engine SoundscapeCategory.
# Source files on the left, the 14 manifest categories on the right.
# Files with no matching category are skipped (logged).
declare -A AMBIENT_CATEGORY=(
  ["rain"]="rain"
  ["ocean"]="ocean"
  ["night"]="forest"            # forest/night ambience
  ["work"]="cafe"              # workspace/cafe-style room tone
  ["fire"]="fire"
  ["space"]="space"
  ["stream-river"]="stream"
  ["outside"]="wind"           # outdoor/open-air bed
  ["rain and thunder"]="thunder"
  ["gongs"]="gongs"
  ["singing-bowls"]="gongs"    # second gongs option; rename on upload below
  ["jungle"]="jungle"
  ["noise"]="noise"
  ["birds"]="birds"
  ["cave"]="cave"
  ["meditation-drone"]="space" # extra drone; goes to space as alt
)

MOODS=(focus deepWork relax meditate sleep)

die() { echo "Error: $*" >&2; exit 1; }

transcode() {
  command -v ffmpeg >/dev/null || die "ffmpeg not found"
  mkdir -p "$OUT_DIR/soundscapes" "$OUT_DIR/music"

  echo "== Transcoding ambients (-> 44.1kHz stereo ${MP3_BITRATE} MP3) =="
  for base in "${!AMBIENT_CATEGORY[@]}"; do
    local src="$SRC_AMBIENTS/$base.wav"
    [[ -f "$src" ]] || { echo "  skip (missing): $base.wav"; continue; }
    local cat="${AMBIENT_CATEGORY[$base]}"
    # disambiguate the two gongs / two space sources by slugged filename
    local slug
    slug="$(echo "$base" | tr ' ' '-')"
    local out="$OUT_DIR/soundscapes/${cat}__${slug}.mp3"
    echo "  $base.wav -> soundscapes/$cat/seamless-${slug}.mp3"
    ffmpeg -y -loglevel error -i "$src" -ac 2 -ar 44100 -b:a "$MP3_BITRATE" "$out"
  done

  echo "== Transcoding music (FLAC -> MP3) =="
  for mood in "${MOODS[@]}"; do
    local src="$SRC_MUSIC/${mood}-30min.flac"
    [[ -f "$src" ]] || { echo "  skip (not yet rendered): ${mood}-30min.flac"; continue; }
    local out="$OUT_DIR/music/${mood}-30min.mp3"
    echo "  ${mood}-30min.flac -> music/seamless/${mood}-30min.mp3"
    ffmpeg -y -loglevel error -i "$src" -ac 2 -ar 44100 -b:a "$MP3_BITRATE" "$out"
  done

  echo "Done. Transcoded files in: $OUT_DIR"
  du -sh "$OUT_DIR"/* 2>/dev/null || true
}

upload() {
  local bucket="${1:-}"
  [[ -n "$bucket" ]] || die "upload requires an R2 bucket name: tools/ingest-seamless.sh upload <bucket>"
  command -v wrangler >/dev/null || die "wrangler not found"
  [[ -d "$OUT_DIR" ]] || die "no transcoded files; run 'transcode' first"

  echo "== Uploading soundscapes to r2://$bucket =="
  for f in "$OUT_DIR"/soundscapes/*.mp3; do
    [[ -e "$f" ]] || continue
    local name; name="$(basename "$f" .mp3)"
    local cat="${name%%__*}"
    local slug="${name#*__}"
    local key="soundscapes/${cat}/seamless-${slug}.mp3"
    echo "  put $key"
    wrangler r2 object put "${bucket}/${key}" --file "$f" --content-type audio/mpeg --remote
  done

  echo "== Uploading music to r2://$bucket =="
  for f in "$OUT_DIR"/music/*.mp3; do
    [[ -e "$f" ]] || continue
    local name; name="$(basename "$f")"
    local key="music/seamless/${name}"
    echo "  put $key"
    wrangler r2 object put "${bucket}/${key}" --file "$f" --content-type audio/mpeg --remote
  done

  echo "Upload complete."
}

cmd="${1:-}"; shift || true
case "$cmd" in
  transcode) transcode ;;
  upload)    upload "${1:-}" ;;
  all)       transcode; upload "${1:-}" ;;
  *) die "usage: tools/ingest-seamless.sh {transcode|upload <bucket>|all <bucket>}" ;;
esac
