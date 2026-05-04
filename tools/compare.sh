#!/bin/bash
# ArgoBeat A/B Audio Quality Comparison
# Usage: ./compare.sh hybrid.wav current.wav [mood]
python3 "$(dirname "$0")/analyze_audio.py" --hybrid "$1" --current "$2" --mood "${3:-focus}"
