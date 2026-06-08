/**
 * File-backed music manager for ArgoBeat.
 *
 * Tracks play once then auto-crossfade to the next track in the mood playlist.
 */

import { loadAudioBuffer, createOneShotSource, calculateRmsGain } from './audio-loader.js';
import { MUSIC_TRACKS, getMusicUrl, type AudioTrack } from './audio-manifest.js';
import type { Mood } from '../types.js';

interface PlayingInstance {
  source: AudioBufferSourceNode;
  gain: GainNode;
  track: AudioTrack;
}

interface PlayableTrack {
  track: AudioTrack;
  buffer: AudioBuffer;
}

const MANUAL_SKIP_CROSSFADE_S = 3;
const MUSIC_NORMALIZATION_TARGET_DB = -18;  // -18 LUFS — background music sits behind cognitive work
const MUSIC_MIN_NORMALIZATION_GAIN = 0.25;  // allow quieter tracks to stay quiet
const MUSIC_MAX_NORMALIZATION_GAIN = 1.60;  // tighter ceiling to prevent loud tracks dominating

export class FileMusicManager {
  private ctx: AudioContext;
  private outputGain: GainNode;
  private activeInstance: PlayingInstance | null = null;
  private fadingInstance: PlayingInstance | null = null;
  private currentMood: Mood | null = null;
  private currentTrackId: string | null = null;
  private currentBag: AudioTrack[] = [];
  private bagCursor = 0;
  private fadeCleanupTimer: number | null = null;
  private onTrackChange: ((from: string | null, to: string) => void) | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;
  }

  getOutput(): GainNode {
    return this.outputGain;
  }

  getCurrentTrack(): string | null {
    return this.currentTrackId;
  }

  isPlaying(): boolean {
    return this.activeInstance !== null;
  }

  setOnTrackChange(cb: (from: string | null, to: string) => void): void {
    this.onTrackChange = cb;
  }

  async start(mood: Mood): Promise<AudioTrack | null> {
    const onTrackChange = this.onTrackChange;
    this.destroy();
    this.onTrackChange = onTrackChange;
    this.currentMood = mood;
    this.resetBag(mood, null);

    const playable = await this.loadPlayableTrack(mood, null);
    if (!playable) {
      console.warn(`[ArgoBeat] No playable curated music tracks for ${mood}`);
      return null;
    }

    const instance = await this.createInstance(playable.track, playable.buffer, 0);
    const targetGain = getNormalizedMusicGain(playable.buffer);
    instance.gain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 4);

    this.activeInstance = instance;
    this.currentTrackId = playable.track.id;
    this.onTrackChange?.(null, playable.track.id);
    return playable.track;
  }

  async crossfadeNow(): Promise<AudioTrack | null> {
    if (!this.currentMood || !this.activeInstance) return null;

    const playable = await this.loadPlayableTrack(this.currentMood, this.currentTrackId);
    if (!playable) return null;

    const CROSSFADE_S = MANUAL_SKIP_CROSSFADE_S;
    const now = this.ctx.currentTime;

    if (this.fadingInstance) {
      this.destroyInstance(this.fadingInstance);
      this.fadingInstance = null;
    }

    this.fadingInstance = this.activeInstance;
    // Null out onended immediately so a late-firing buffer-end event on the
    // outgoing source cannot trigger a second crossfadeNow() after the
    // timer-based crossfade has already taken effect.
    this.fadingInstance.source.onended = null;
    this.fadingInstance.gain.gain.setValueAtTime(this.fadingInstance.gain.gain.value, now);
    this.fadingInstance.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_S);

    const fadingRef = this.fadingInstance;
    if (this.fadeCleanupTimer !== null) clearTimeout(this.fadeCleanupTimer);
    this.fadeCleanupTimer = window.setTimeout(() => {
      this.fadeCleanupTimer = null;
      if (this.fadingInstance === fadingRef) {
        this.destroyInstance(fadingRef);
        this.fadingInstance = null;
      }
    }, (CROSSFADE_S + 0.5) * 1000);

    const next = await this.createInstance(playable.track, playable.buffer, 0);
    const targetGain = getNormalizedMusicGain(playable.buffer);
    next.gain.gain.linearRampToValueAtTime(targetGain, now + CROSSFADE_S);

    const previousId = this.currentTrackId;
    this.activeInstance = next;
    this.currentTrackId = playable.track.id;
    this.onTrackChange?.(previousId, playable.track.id);
    return playable.track;
  }

  destroy(): void {
    if (this.fadeCleanupTimer !== null) {
      clearTimeout(this.fadeCleanupTimer);
      this.fadeCleanupTimer = null;
    }

    if (this.activeInstance) {
      this.destroyInstance(this.activeInstance);
      this.activeInstance = null;
    }

    if (this.fadingInstance) {
      this.destroyInstance(this.fadingInstance);
      this.fadingInstance = null;
    }

    this.currentMood = null;
    this.currentTrackId = null;
    this.currentBag = [];
    this.bagCursor = 0;
    this.onTrackChange = null;
  }

  private async loadPlayableTrack(mood: Mood, excludeId: string | null): Promise<PlayableTrack | null> {
    const maxAttempts = Math.max((MUSIC_TRACKS[mood] ?? []).length, 1) * 2;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const track = this.nextBagTrack(mood, excludeId);
      if (!track) return null;
      attempts += 1;
      try {
        const buffer = await loadAudioBuffer(this.ctx, getMusicUrl(mood, track.file));
        return { track, buffer };
      } catch (err) {
        console.warn(`[ArgoBeat] Skipping unavailable music track ${track.id}:`, err);
      }
    }

    return null;
  }

  private async createInstance(track: AudioTrack, buffer: AudioBuffer, initialGain: number): Promise<PlayingInstance> {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(initialGain, this.ctx.currentTime);
    gain.connect(this.outputGain);

    const source = createOneShotSource(this.ctx, buffer);
    source.connect(gain);

    // Auto-advance to next track when this one finishes naturally
    source.onended = () => {
      if (this.activeInstance?.source === source) {
        this.crossfadeNow().catch(() => {/* no more tracks */});
      }
    };

    return { source, gain, track };
  }

  private destroyInstance(inst: PlayingInstance): void {
    try { inst.source.stop(); } catch { /* already stopped */ }
    try { inst.source.disconnect(); } catch { /* already disconnected */ }
    try { inst.gain.disconnect(); } catch { /* already disconnected */ }
  }

  private nextBagTrack(mood: Mood, excludeId: string | null): AudioTrack | null {
    const tracks = MUSIC_TRACKS[mood] ?? [];
    if (tracks.length === 0) return null;

    if (this.currentMood !== mood || this.currentBag.length === 0 || this.bagCursor >= this.currentBag.length) {
      this.resetBag(mood, excludeId);
    }

    while (this.bagCursor < this.currentBag.length) {
      const track = this.currentBag[this.bagCursor++];
      if (!excludeId || track.id !== excludeId) {
        return track;
      }
    }

    this.resetBag(mood, excludeId);
    return this.bagCursor < this.currentBag.length ? this.currentBag[this.bagCursor++] : null;
  }

  private resetBag(mood: Mood, excludeId: string | null): void {
    this.currentMood = mood;
    this.currentBag = shuffleTracks(MUSIC_TRACKS[mood] ?? [], excludeId);
    this.bagCursor = 0;
  }
}

function shuffleTracks(tracks: AudioTrack[], excludeId: string | null): AudioTrack[] {
  const bag = [...tracks];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  if (excludeId && bag.length > 1 && bag[0]?.id === excludeId) {
    const swapIndex = bag.findIndex((track) => track.id !== excludeId);
    if (swapIndex > 0) {
      [bag[0], bag[swapIndex]] = [bag[swapIndex], bag[0]];
    }
  }

  return excludeId ? bag.filter((track) => track.id !== excludeId || bag.length === 1) : bag;
}

function getNormalizedMusicGain(buffer: AudioBuffer): number {
  return calculateRmsGain(
    buffer,
    MUSIC_NORMALIZATION_TARGET_DB,
    MUSIC_MIN_NORMALIZATION_GAIN,
    MUSIC_MAX_NORMALIZATION_GAIN,
  );
}
