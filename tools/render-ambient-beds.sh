#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/../apps/web/public/audio/soundscapes"

mkdir -p "$ROOT/rain" "$ROOT/ocean" "$ROOT/space" "$ROOT/wind"

ffmpeg -y \
  -stream_loop -1 -i "$ROOT/rain/rain-spectacular.mp3" \
  -stream_loop -1 -i "$ROOT/cafe/coffeehouse-ambience.mp3" \
  -stream_loop -1 -i "$ROOT/wind/gentle-breeze.mp3" \
  -filter_complex "
[0:a]atrim=0:480,asetpts=N/SR/TB,volume=0.92,highpass=f=120,lowpass=f=4200[a0];
[1:a]atrim=0:480,asetpts=N/SR/TB,volume=0.10,highpass=f=180,lowpass=f=1800[a1];
[2:a]atrim=0:480,asetpts=N/SR/TB,volume=0.18,highpass=f=150,lowpass=f=2400[a2];
[a0][a1][a2]amix=inputs=3:normalize=0,
acompressor=threshold=-24dB:ratio=2:attack=30:release=220,
alimiter=limit=0.90,
afade=t=in:st=0:d=8,
afade=t=out:st=472:d=8
" \
  -c:a libmp3lame -b:a 192k "$ROOT/rain/focus-study-rain.mp3"

ffmpeg -y \
  -stream_loop -1 -i "$ROOT/ocean/gentle-waves-beach.mp3" \
  -stream_loop -1 -i "$ROOT/wind/gentle-breeze.mp3" \
  -stream_loop -1 -i "$ROOT/space/space-ambience.mp3" \
  -filter_complex "
[0:a]atrim=0:480,asetpts=N/SR/TB,volume=0.88,highpass=f=90,lowpass=f=3400[a0];
[1:a]atrim=0:480,asetpts=N/SR/TB,volume=0.14,highpass=f=120,lowpass=f=2200[a1];
[2:a]atrim=0:480,asetpts=N/SR/TB,volume=0.10,highpass=f=80,lowpass=f=1600[a2];
[a0][a1][a2]amix=inputs=3:normalize=0,
acompressor=threshold=-26dB:ratio=1.8:attack=40:release=240,
alimiter=limit=0.88,
afade=t=in:st=0:d=10,
afade=t=out:st=470:d=10
" \
  -c:a libmp3lame -b:a 192k "$ROOT/ocean/relax-tidal-drift.mp3"

ffmpeg -y \
  -stream_loop -1 -i "$ROOT/space/glass-aquaphone-drone.mp3" \
  -stream_loop -1 -i "$ROOT/space/space-ambience.mp3" \
  -stream_loop -1 -i "$ROOT/wind/gentle-breeze.mp3" \
  -filter_complex "
[0:a]atrim=0:540,asetpts=N/SR/TB,volume=0.74,highpass=f=70,lowpass=f=2600[a0];
[1:a]atrim=0:540,asetpts=N/SR/TB,volume=0.24,highpass=f=60,lowpass=f=1500[a1];
[2:a]atrim=0:540,asetpts=N/SR/TB,volume=0.08,highpass=f=140,lowpass=f=1800[a2];
[a0][a1][a2]amix=inputs=3:normalize=0,
acompressor=threshold=-28dB:ratio=1.6:attack=50:release=260,
alimiter=limit=0.86,
afade=t=in:st=0:d=12,
afade=t=out:st=528:d=12
" \
  -c:a libmp3lame -b:a 192k "$ROOT/space/meditate-glass-drift.mp3"

ffmpeg -y \
  -stream_loop -1 -i "$ROOT/wind/wind-noise.mp3" \
  -stream_loop -1 -i "$ROOT/space/space-ambience.mp3" \
  -filter_complex "
[0:a]atrim=0:600,asetpts=N/SR/TB,volume=0.86,highpass=f=50,lowpass=f=1400[a0];
[1:a]atrim=0:600,asetpts=N/SR/TB,volume=0.14,highpass=f=40,lowpass=f=900[a1];
[a0][a1]amix=inputs=2:normalize=0,
acompressor=threshold=-30dB:ratio=1.5:attack=60:release=300,
alimiter=limit=0.84,
afade=t=in:st=0:d=15,
afade=t=out:st=585:d=15
" \
  -c:a libmp3lame -b:a 192k "$ROOT/wind/sleep-wind-blanket.mp3"

echo "Rendered ambient beds into $ROOT"