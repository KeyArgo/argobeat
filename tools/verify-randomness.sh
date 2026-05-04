#!/bin/bash
#
# Verify ArgoBeat export randomness — proves different seeds produce different audio.
#
# Generates multiple samples per mood, compares checksums, and shows
# spectral variation to confirm genuine randomness.
#
# Usage: ./tools/verify-randomness.sh [output_dir]
#

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="${1:-$HOME/tmp/argobeat-randomness-test}"

mkdir -p "$OUT_DIR"
cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════════"
echo "  ArgoBeat Randomness Verification"
echo "  Output: $OUT_DIR"
echo "═══════════════════════════════════════════════════"
echo ""

MOODS="focus deepWork relax meditate sleep"
SAMPLES_PER_MOOD=3
DURATION=15

# ── Step 1: Generate samples ──
echo "Step 1: Generating ${SAMPLES_PER_MOOD} samples × 5 moods = $((SAMPLES_PER_MOOD * 5)) files..."
echo ""

for mood in $MOODS; do
  for i in $(seq 1 $SAMPLES_PER_MOOD); do
    seed=$((i * 7919 + RANDOM))  # Different seed each time
    file="$OUT_DIR/${mood}-${i}-seed${seed}.wav"
    echo -n "  Generating $mood #$i (seed=$seed)..."
    npx tsx "$SCRIPT_DIR/cli-export.ts" \
      --output "$file" --mood "$mood" --duration "$DURATION" --seed "$seed" \
      2>/dev/null | grep -oP "BPM:\s+\K\d+"
    echo " done ($(du -h "$file" | cut -f1))"
  done
done

echo ""

# ── Step 2: Verify checksums are all different ──
echo "Step 2: Checksum verification (all must be DIFFERENT)..."
echo ""

all_unique=true
for mood in $MOODS; do
  checksums=$(md5sum "$OUT_DIR/${mood}"-*.wav | awk '{print $1}')
  unique_count=$(echo "$checksums" | sort -u | wc -l)
  total_count=$(echo "$checksums" | wc -l)

  if [ "$unique_count" -eq "$total_count" ]; then
    echo "  ✅ $mood: $unique_count/$total_count unique checksums"
  else
    echo "  ❌ $mood: Only $unique_count/$total_count unique! RANDOMNESS FAILURE"
    all_unique=false
  fi
done

echo ""

# ── Step 3: Show spectral variation ──
echo "Step 3: Spectral variation across seeds (should differ)..."
echo ""

if command -v python3 &>/dev/null && python3 -c "import librosa" 2>/dev/null; then
  for mood in $MOODS; do
    echo "  $mood:"
    for f in "$OUT_DIR/${mood}"-*.wav; do
      metrics=$(python3 -c "
import librosa, numpy as np, sys
y, sr = librosa.load('$f', sr=44100)
centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)[0])
tempo = librosa.beat.beat_track(y=y, sr=sr)[0]
tempo_val = float(np.atleast_1d(tempo)[0])
rms = 20 * np.log10(np.sqrt(np.mean(y**2)) + 1e-10)
print(f'centroid={centroid:.0f}Hz tempo={tempo_val:.0f}BPM rms={rms:.1f}dB')
" 2>/dev/null || echo "analysis failed")
      echo "    $(basename "$f"): $metrics"
    done
    echo ""
  done
else
  echo "  (Skipping spectral analysis — install librosa: pip install librosa)"
  echo ""
  echo "  File size comparison (different sizes = different content):"
  for mood in $MOODS; do
    echo "  $mood:"
    ls -lh "$OUT_DIR/${mood}"-*.wav | awk '{print "    " $NF ": " $5}'
  done
fi

echo ""

# ── Summary ──
echo "═══════════════════════════════════════════════════"
if $all_unique; then
  echo "  ✅ ALL CHECKSUMS UNIQUE — Randomness verified!"
else
  echo "  ❌ SOME DUPLICATES — Check seed generation"
fi
echo ""
echo "  Files: $OUT_DIR/"
echo "  Total: $(ls "$OUT_DIR"/*.wav 2>/dev/null | wc -l) WAV files"
echo "  Size:  $(du -sh "$OUT_DIR" | cut -f1)"
echo ""
echo "  Next: Upload WAVs to GPT-4o for quality analysis"
echo "  Or:   python tools/analyze_audio.py --file <file> --mood <mood>"
echo "═══════════════════════════════════════════════════"
