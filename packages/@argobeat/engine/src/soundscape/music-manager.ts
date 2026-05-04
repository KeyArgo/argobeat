/**
 * File-backed music manager for ArgoBeat.
 *
 * This is the primary listening layer: curated MP3 tracks are loaded,
 * played as one-shot sources, and crossfaded into the next queue item before
 * the file boundary. The engine applies target-rate modulation after this layer.
 */

import { loadAudioBuffer, createOneShotSource, calculateRmsGain } from './audio-loader.js';
import { MUSIC_TRACKS, getMusicUrl, type AudioTrack } from './audio-manifest.js';
import type { Mood } from '../types.js';

interface PlayingInstance {
  source: AudioBufferSourceNode;
  gain: GainNode;
  track: AudioTrack;
  durationSeconds: number;
  targetGain: number;
}

// Match the soundscape normalization target so music and ambience sit at the same perceived level.
const MUSIC_TARGET_DB = -10;
const MUSIC_MIN_GAIN = 0.25;
const MUSIC_MAX_GAIN = 2.0;

const CROSSFADE_S = 10;
const LOOP_GUARD_S = 1.5;
const MIN_CROSSFADE_DELAY_MS = 12 * 1000;
const SHORT_TRACK_MAX_S = 5 * 60;
const MEDIUM_TRACK_MAX_S = 9 * 60;

export class FileMusicManager {
  private ctx: AudioContext;
  private outputGain: GainNode;
  private activeInstance: PlayingInstance | null = null;
  private fadingInstance: PlayingInstance | null = null;
  private currentMood: Mood | null = null;
  private currentTrackId: string | null = null;
  private remainingTrackIds: string[] = [];
  private fadeCleanupTimer: number | null = null;
  private crossfadeTimer: number | null = null;
  private onTrackChange: ((from: string | null, to: string) => void) | null = null;
  private onAutoAdvance: ((from: string, to: string) => void) | null = null;
  private currentTrackPass = 1;
  private currentTrackTargetPasses = 1;
  private transitionInFlight = false;

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

  setOnAutoAdvance(cb: (from: string, to: string) => void): void {
    this.onAutoAdvance = cb;
  }

  async start(mood: Mood): Promise<AudioTrack | null> {
    const onTrackChange = this.onTrackChange;
    const onAutoAdvance = this.onAutoAdvance;
    this.destroy();
    this.onTrackChange = onTrackChange;
    this.onAutoAdvance = onAutoAdvance;
    this.currentMood = mood;
    this.resetRemainingIds(mood, null);

    const track = await this.loadPlayableTrack(mood, null);
    if (!track) {
      console.warn(`[ArgoBeat] No playable curated music tracks for ${mood}`);
      return null;
    }

    const instance = await this.createInstance(mood, track, 0);
    instance.gain.gain.linearRampToValueAtTime(instance.targetGain, this.ctx.currentTime + 4);

    this.activeInstance = instance;
    this.currentTrackId = track.id;
    this.currentTrackPass = 1;
    this.currentTrackTargetPasses = getTargetPassCount(instance.durationSeconds);
    this.scheduleCrossfade(instance.durationSeconds);
    this.onTrackChange?.(null, track.id);
    return track;
  }

  async crossfadeNow(): Promise<AudioTrack | null> {
    if (!this.currentMood || !this.activeInstance) return null;
    this.transitionInFlight = true;

    const track = await this.loadPlayableTrack(this.currentMood, this.currentTrackId);
    if (!track) {
      this.transitionInFlight = false;
      return null;
    }

    const next = await this.transitionToTrack(track);
    this.transitionInFlight = false;
    return next;
  }

  async advanceAfterSegment(): Promise<AudioTrack | null> {
    if (!this.currentMood || !this.activeInstance || this.transitionInFlight) return null;

    this.transitionInFlight = true;

    if (this.currentTrackPass < this.currentTrackTargetPasses) {
      this.currentTrackPass += 1;
      const repeated = await this.transitionToTrack(this.activeInstance.track, { emitTrackChange: false });
      this.transitionInFlight = false;
      return repeated;
    }

    const previousTrackId = this.currentTrackId;
    const track = await this.loadPlayableTrack(this.currentMood, this.currentTrackId);
    if (!track) {
      this.transitionInFlight = false;
      return null;
    }

    const next = await this.transitionToTrack(track);
    if (previousTrackId && track.id !== previousTrackId) {
      this.onAutoAdvance?.(previousTrackId, track.id);
    }
    this.transitionInFlight = false;
    return next;
  }

  private async transitionToTrack(
    track: AudioTrack,
    options?: { emitTrackChange?: boolean },
  ): Promise<AudioTrack> {
    if (!this.currentMood || !this.activeInstance) {
      throw new Error('Cannot transition tracks without an active music session');
    }

    const now = this.ctx.currentTime;

    this.clearCrossfadeTimer();

    if (this.fadingInstance) {
      this.destroyInstance(this.fadingInstance);
      this.fadingInstance = null;
    }

    this.fadingInstance = this.activeInstance;
    // Null out onended immediately so a late-firing buffer-end event on the
    // outgoing source cannot trigger a second advanceAfterSegment() after the
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

    const next = await this.createInstance(this.currentMood, track, 0);
    next.gain.gain.linearRampToValueAtTime(next.targetGain, now + CROSSFADE_S);

    const previousId = this.currentTrackId;
    this.activeInstance = next;
    this.currentTrackId = track.id;
    this.currentTrackPass = track.id === previousId ? this.currentTrackPass : 1;
    this.currentTrackTargetPasses = getTargetPassCount(next.durationSeconds);
    this.scheduleCrossfade(next.durationSeconds);
    if (options?.emitTrackChange !== false) {
      this.onTrackChange?.(previousId, track.id);
    }
    return track;
  }

  destroy(): void {
    this.clearCrossfadeTimer();

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
    this.remainingTrackIds = [];
    this.currentTrackPass = 1;
    this.currentTrackTargetPasses = 1;
    this.transitionInFlight = false;
    this.onTrackChange = null;
    this.onAutoAdvance = null;
  }

  private async loadPlayableTrack(mood: Mood, excludeId: string | null): Promise<AudioTrack | null> {
    const tracks = MUSIC_TRACKS[mood] ?? [];
    const candidates = this.getOrderedCandidates(tracks, excludeId);

    for (const track of candidates) {
      try {
        await loadAudioBuffer(this.ctx, getMusicUrl(mood, track.file));
        return track;
      } catch (err) {
        console.warn(`[ArgoBeat] Skipping unavailable music track ${track.id}:`, err);
      }
    }

    return null;
  }

  private getOrderedCandidates(tracks: AudioTrack[], excludeId: string | null): AudioTrack[] {
    if (tracks.length === 0) return [];

    const candidates = tracks.filter((track) => track.id !== excludeId);
    if (candidates.length === 0) {
      this.remainingTrackIds = [];
      return tracks;
    }

    const byId = new Map(candidates.map((track) => [track.id, track]));
    let queue = this.remainingTrackIds
      .map((id) => byId.get(id))
      .filter((track): track is AudioTrack => Boolean(track));

    if (queue.length === 0) {
      queue = refillShuffleBag(candidates, excludeId);
    }

    this.remainingTrackIds = queue.slice(1).map((track) => track.id);
    return queue;
  }

  private async createInstance(mood: Mood, track: AudioTrack, initialGain: number): Promise<PlayingInstance> {
    const buffer = await loadAudioBuffer(this.ctx, getMusicUrl(mood, track.file));
    const targetGain = calculateRmsGain(buffer, MUSIC_TARGET_DB, MUSIC_MIN_GAIN, MUSIC_MAX_GAIN);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(initialGain, this.ctx.currentTime);
    gain.connect(this.outputGain);

    const source = createOneShotSource(this.ctx, buffer);
    source.onended = () => {
      if (this.activeInstance?.source === source && !this.transitionInFlight) {
        void this.advanceAfterSegment();
      }
    };
    source.connect(gain);

    return { source, gain, track, durationSeconds: buffer.duration, targetGain };
  }

  private scheduleCrossfade(durationSeconds: number): void {
    this.clearCrossfadeTimer();

    const intervalMs = Math.max(
      MIN_CROSSFADE_DELAY_MS,
      (durationSeconds - CROSSFADE_S - LOOP_GUARD_S) * 1000,
    );

    this.crossfadeTimer = window.setTimeout(() => {
      void this.advanceAfterSegment();
    }, intervalMs);
  }

  private clearCrossfadeTimer(): void {
    if (this.crossfadeTimer !== null) {
      clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
  }

  private destroyInstance(inst: PlayingInstance): void {
    try { inst.source.stop(); } catch { /* already stopped */ }
    try { inst.source.disconnect(); } catch { /* already disconnected */ }
    try { inst.gain.disconnect(); } catch { /* already disconnected */ }
  }

  private resetRemainingIds(mood: Mood, excludeId: string | null): void {
    const tracks = MUSIC_TRACKS[mood] ?? [];
    const candidates = excludeId ? tracks.filter((t) => t.id !== excludeId) : tracks;
    this.remainingTrackIds = refillShuffleBag(candidates, excludeId).map((t) => t.id);
  }
}

function refillShuffleBag(tracks: AudioTrack[], avoidFirstId: string | null): AudioTrack[] {
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  if (avoidFirstId && shuffled.length > 1 && shuffled[0]?.id === avoidFirstId) {
    const swapIndex = 1 + Math.floor(Math.random() * (shuffled.length - 1));
    [shuffled[0], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[0]];
  }

  return shuffled;
}

function getTargetPassCount(durationSeconds: number): number {
  if (durationSeconds <= SHORT_TRACK_MAX_S) return 3;
  if (durationSeconds <= MEDIUM_TRACK_MAX_S) return 2;
  return 1;
}
