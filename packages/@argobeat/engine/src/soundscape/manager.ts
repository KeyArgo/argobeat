/**
 * @argobeat/engine — Soundscape Manager
 *
 * Loads and plays real audio files with crossfading.
 *
 * Instead of procedural noise synthesis, this manager:
 * 1. Picks a random track from the category's manifest
 * 2. Loads the MP3 via fetch + decodeAudioData (cached)
 * 3. Creates a looping AudioBufferSourceNode
 * 4. Keeps that ambience stable until the app explicitly changes it, or
 *    until an optional long-hold autopilot crossfade is enabled
 *
 * The output connects to the engine's modulation chain.
 * The modulation chain (AM + spectral + stereo) is wired by the engine,
 * not the manager. The manager just outputs audio to a gain node.
 *
 * Architecture:
 * ```
 *   Active source  -> activeGain  ──┐
 *                                    ├─> outputGain -> [external bus]
 *   Fading source  -> fadingGain  ──┘
 * ```
 *
 * @module @argobeat/engine/soundscape/manager
 */

import { loadAudioBuffer, createLoopingSource, calculateRmsGain } from './audio-loader.js';
import { SOUNDSCAPE_TRACKS, getSoundscapeUrl, type AudioTrack } from './audio-manifest.js';
import type { SoundscapeCategory } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single playing audio instance (source + gain). */
interface PlayingInstance {
  source: AudioBufferSourceNode;
  gain: GainNode;
  track: AudioTrack;
  durationSeconds: number;
}

const CROSSFADE_S = 8;
const MIN_AUTOPILOT_HOLD_MS = 5 * 60 * 1000;
const NORMALIZATION_TARGET_DB = -16;
const MIN_NORMALIZATION_GAIN = 0.2;
const MAX_NORMALIZATION_GAIN = 2.0;

// ---------------------------------------------------------------------------
// SoundscapeManager
// ---------------------------------------------------------------------------

/**
 * Audio-file-based soundscape manager with crossfading.
 *
 * Loads MP3 files from the manifest and crossfades between them
 * at seam-safe configurable intervals. Much simpler
 * than the old procedural synthesis approach — no noise generation,
 * no band filters, no convolution reverb, no accent scheduling.
 *
 * @example
 * ```ts
 * const mgr = new SoundscapeManager(audioContext);
 * mgr.getOutput().connect(nextNodeInChain);
 *
 * await mgr.start('rain');
 *
 * // Later — trigger manual crossfade:
 * await mgr.crossfadeNow();
 *
 * // Cleanup:
 * mgr.destroy();
 * ```
 */
export class SoundscapeManager {
  private ctx: AudioContext;
  private outputGain: GainNode;

  // Dual instances for crossfading
  private activeInstance: PlayingInstance | null = null;
  private fadingInstance: PlayingInstance | null = null;

  // Current state
  private currentCategory: SoundscapeCategory | null = null;
  private currentTrackId: string | null = null;

  // Auto-crossfade timer
  private crossfadeTimer: number | null = null;
  private crossfadeIntervalMs: number = 5 * 60 * 1000;
  private fadeCleanupTimer: number | null = null;

  // Variation change callback
  private onVariationChange: ((from: string | null, to: string) => void) | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1.0;
  }

  // ═══════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════

  /**
   * Get the output node to connect to the next stage in the audio graph.
   */
  getOutput(): GainNode {
    return this.outputGain;
  }

  /**
   * Get the currently playing track ID.
   */
  getCurrentVariation(): string | null {
    return this.currentTrackId;
  }

  /**
   * Get the current soundscape category.
   */
  getCurrentCategory(): SoundscapeCategory | null {
    return this.currentCategory;
  }

  /**
   * Whether a track is currently playing.
   */
  isPlaying(): boolean {
    return this.activeInstance !== null;
  }

  /**
   * Set the callback for variation change events.
   */
  setOnVariationChange(cb: (from: string | null, to: string) => void): void {
    this.onVariationChange = cb;
  }

  /**
   * Start playing a random track from the given category.
   * Loads the audio file, creates a looping source, fades in.
   *
   * @param category - The soundscape category to play.
   * @param crossfadeIntervalMs - Interval between auto-crossfades.
   */
  async start(
    category: SoundscapeCategory,
    crossfadeIntervalMs?: number,
  ): Promise<void> {
    // Clean up any existing playback
    const onVariationChange = this.onVariationChange;
    this.destroy();
    this.onVariationChange = onVariationChange;

    this.currentCategory = category;
    if (crossfadeIntervalMs !== undefined) {
      this.crossfadeIntervalMs = crossfadeIntervalMs;
    }

    const playable = await this.loadPlayableTrack(category, null);
    if (!playable) {
      console.warn(`[ArgoBeat] No tracks for category: ${category} — running music-only`);
      return;
    }

    const { track, buffer } = playable;

    // Create gain node for this instance
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.connect(this.outputGain);

    // Loop the chosen ambience bed so the scene stays stable instead of
    // rotating every time the file reaches its end.
    const source = createLoopingSource(this.ctx, buffer);
    source.connect(gain);

    // Fade in over 2 seconds
    const targetGain = getNormalizedGain(buffer);
    gain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 2);

    this.activeInstance = { source, gain, track, durationSeconds: buffer.duration };
    this.currentTrackId = track.id;

    // Notify
    if (this.onVariationChange) {
      this.onVariationChange(null, track.id);
    }

    // By default we keep one ambience bed steady until the app explicitly
    // requests a change. Optional timers can still be enabled by callers.
    this.scheduleCrossfade();
  }

  /**
   * Crossfade to a new random track in the same category.
   * Excludes the currently playing track.
   */
  async crossfadeNow(): Promise<AudioTrack | null> {
    if (!this.currentCategory || !this.activeInstance) return null;

    const playable = await this.loadPlayableTrack(this.currentCategory, this.currentTrackId);
    if (!playable) return null;

    await this.performCrossfade(playable.track);
    return playable.track;
  }

  /** Live crossfade to a different soundscape category — music keeps running. */
  async crossfadeToCategory(category: SoundscapeCategory): Promise<AudioTrack | null> {
    if (!this.activeInstance) return null;
    const playable = await this.loadPlayableTrack(category, null);
    if (!playable) return null;
    this.currentCategory = category;
    await this.performCrossfade(playable.track);
    return playable.track;
  }

  /**
   * Stop all playback and clean up.
   */
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

    this.currentCategory = null;
    this.currentTrackId = null;
    this.onVariationChange = null;
  }

  // ═══════════════════════════════════════════════════
  // Internal
  // ═══════════════════════════════════════════════════

  private async loadPlayableTrack(
    category: SoundscapeCategory,
    excludeId: string | null,
  ): Promise<{ track: AudioTrack; buffer: AudioBuffer } | null> {
    const tracks = SOUNDSCAPE_TRACKS[category] ?? [];
    const candidates = getOrderedCandidates(tracks, excludeId);

    for (const track of candidates) {
      try {
        const buffer = await loadAudioBuffer(this.ctx, getSoundscapeUrl(category, track.file));
        return { track, buffer };
      } catch (err) {
        console.warn(`[ArgoBeat] Skipping unavailable soundscape track ${track.id}:`, err);
      }
    }

    return null;
  }

  /**
   * Perform a crossfade from the active instance to a new track.
   */
  private async performCrossfade(track: AudioTrack): Promise<void> {
    if (!this.currentCategory) return;

    const now = this.ctx.currentTime;

    // Load the new track's audio
    const url = getSoundscapeUrl(this.currentCategory, track.file);
    const buffer = await loadAudioBuffer(this.ctx, url);

    // Destroy any still-fading instance
    if (this.fadingInstance) {
      this.destroyInstance(this.fadingInstance);
      this.fadingInstance = null;
    }

    // Move active to fading
    this.fadingInstance = this.activeInstance;

    // Fade out old instance
    if (this.fadingInstance) {
      this.fadingInstance.gain.gain.setValueAtTime(
        this.fadingInstance.gain.gain.value,
        now,
      );
      this.fadingInstance.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_S);

      // Schedule destruction after crossfade completes
      const fadingRef = this.fadingInstance;
      if (this.fadeCleanupTimer !== null) {
        clearTimeout(this.fadeCleanupTimer);
      }
      this.fadeCleanupTimer = window.setTimeout(() => {
        this.fadeCleanupTimer = null;
        if (this.fadingInstance === fadingRef) {
          this.destroyInstance(fadingRef);
          this.fadingInstance = null;
        }
      }, (CROSSFADE_S + 0.5) * 1000);
    }

    // Create and fade in new instance
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.connect(this.outputGain);

    const source = createLoopingSource(this.ctx, buffer);
    source.connect(gain);
    const targetGain = getNormalizedGain(buffer);
    gain.gain.linearRampToValueAtTime(targetGain, now + CROSSFADE_S);

    const oldTrackId = this.currentTrackId;
    this.activeInstance = { source, gain, track, durationSeconds: buffer.duration };
    this.currentTrackId = track.id;

    // Notify
    if (this.onVariationChange) {
      this.onVariationChange(oldTrackId, track.id);
    }

    this.scheduleCrossfade();
  }

  /**
   * Schedule the next automatic crossfade.
   * Adds +/- 30% jitter to prevent predictability.
   */
  private scheduleCrossfade(_durationSeconds?: number): void {
    this.clearCrossfadeTimer();

    if (this.crossfadeIntervalMs <= 0) {
      return;
    }

    const jitter = 0.7 + Math.random() * 0.6;
    const configuredInterval = this.crossfadeIntervalMs * jitter;
    const interval = Math.max(MIN_AUTOPILOT_HOLD_MS, configuredInterval);

    this.crossfadeTimer = window.setTimeout(() => {
      this.crossfadeNow();
    }, interval);
  }

  /**
   * Clear the auto-crossfade timer.
   */
  private clearCrossfadeTimer(): void {
    if (this.crossfadeTimer !== null) {
      clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
  }

  /**
   * Destroy a single playing instance (stop source, disconnect nodes).
   */
  private destroyInstance(inst: PlayingInstance): void {
    try { inst.source.stop(); } catch { /* already stopped */ }
    try { inst.source.disconnect(); } catch { /* already disconnected */ }
    try { inst.gain.disconnect(); } catch { /* already disconnected */ }
  }
}

function getOrderedCandidates(tracks: AudioTrack[], excludeId: string | null): AudioTrack[] {
  const pool = excludeId
    ? tracks.filter((track) => track.id !== excludeId)
    : [...tracks];
  const result = pool.length > 0 ? pool : [...tracks];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getNormalizedGain(buffer: AudioBuffer): number {
  return calculateRmsGain(
    buffer,
    NORMALIZATION_TARGET_DB,
    MIN_NORMALIZATION_GAIN,
    MAX_NORMALIZATION_GAIN,
  );
}
