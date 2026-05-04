# Ambient Selection

ArgoBeat now treats the ambient layer as a stable bed under each music track rather than a constantly rotating texture.

## Current behavior

- One ambient variation is selected when a music track begins.
- That ambient variation loops for the duration of the current music track.
- When the music track changes, the ambient layer crossfades to a new variation in the same category.
- Manual `Next ambience` still forces an immediate ambient swap.
- Mood filtering also uses ambient stimulation, so `relax`, `meditate`, and `sleep` stay limited to low-intensity beds.

## Why

Continuous mid-track ambience rotation made the listening bed feel less grounded and could introduce unnecessary attention shifts during focus sessions. Tying ambience refresh to track changes keeps the space stable while still preventing the broader session from feeling static.

## Scope

This note documents the runtime behavior only:

- stable ambient looping during the current song
- ambient refresh on music-track change
- manual ambient skip still available

Broader soundscape classification and tagging work can build on top of this behavior later without changing the core expectation that ambience stays stable within a song.

## Intensity qualification

- Ambient assets are tagged by stimulation level as `low`, `medium`, or `high`.
- `focus` and `deepWork` can use `low` or `medium` stimulation beds.
- `relax`, `meditate`, and `sleep` are capped at `low` stimulation.
- Higher-energy beds such as thunder, busier rain, or more attention-grabbing textures should not qualify for `relax`.
