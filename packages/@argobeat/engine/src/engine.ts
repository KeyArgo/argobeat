/**
 * @argobeat/engine — Core Engine
 *
 * The orchestrator that wires moods, soundscapes, modulation, and
 * session management into a cohesive public API.
 *
 * Web Audio Graph:
 *
 *   SoundscapeManager (dual A/B instances)
 *     -> soundscapeGain
 *       -> ModulationChain (spectral -> AM -> panner)
 *         -> masterGain
 *           -> compressor
 *             -> analyser
 *               -> destination
 *
 * Design principles:
 * - Users interact with moods, not frequencies
 * - Target-rate modulation is applied to content instead of audible tones
 * - Every session is unique (randomized Hz, variation, drift phase)
 * - Dual-instance crossfading prevents auditory fatigue
 * - Complete lifecycle management (init -> play -> pause/resume -> stop -> destroy)
 *
 * @module @argobeat/engine
 * @packageDocumentation
 */

import type {
  Mood,
  EngineState,
  EngineEvents,
  SessionSeed,
  ModulationGraph,
  SoundscapeCategory,
  MoodConfig,
  AudioSourceMode,
} from './types.js';
import { MOODS, getMood } from './mood/moods.js';
import { generateSessionSeed } from './mood/randomizer.js';
import { SoundscapeManager } from './soundscape/manager.js';
import { FileMusicManager } from './soundscape/music-manager.js';
import { buildModulationChain, destroyModulationChain, updateModulationDepths, accelerateHabituationDrift } from './modulation/chain.js';
import { GenerativeMusicEngine } from './music-gen/generative.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default compressor settings — gentle limiting to prevent clipping
 * when modulation, soundscape, and transient accents overlap.
 */
const COMPRESSOR_THRESHOLD = -12;  // dB
const COMPRESSOR_KNEE = 10;        // dB
const COMPRESSOR_RATIO = 4;
const COMPRESSOR_ATTACK = 0.080;   // 80ms — slower than one 16 Hz AM cycle (62.5ms) so compressor doesn't fight the entrainment envelope
const COMPRESSOR_RELEASE = 0.400;  // seconds

/** Analyser FFT size for visualization. */
const ANALYSER_FFT_SIZE = 2048;

/** Minimum volume clamp to prevent exponentialRamp from hitting zero. */
const GAIN_EPSILON = 0.0001;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class ArgoBeatEngine {
  // ── Audio context ───────────────────────────────────────────────────
  private ctx: AudioContext | null = null;

  // ── Audio graph nodes ───────────────────────────────────────────────
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private soundscapeGain: GainNode | null = null;
  private soundscapeDryGain: GainNode | null = null;  // direct to master (natural)
  private soundscapeWetGain: GainNode | null = null;  // through modulation chain
  private soundscapeModDepth: number = 0;             // 0 = fully dry, 1 = fully wet

  // ── Subsystems ──────────────────────────────────────────────────────
  private modulationGraph: ModulationGraph | null = null;
  private modulationInput: AudioNode | null = null;
  private modulationOutput: AudioNode | null = null;
  private soundscapeManager: SoundscapeManager | null = null;
  private fileMusicManager: FileMusicManager | null = null;
  private musicEngine: GenerativeMusicEngine | null = null;
  private musicGain: GainNode | null = null;
  private musicEntrainmentOsc: OscillatorNode | null = null;
  private musicEntrainmentDepth: GainNode | null = null;
  private _musicEntrainmentNodes: AudioNode[] = [];

  // ── Session state ───────────────────────────────────────────────────
  private state: EngineState;
  private seed: SessionSeed | null = null;
  private activeMoodConfig: MoodConfig | null = null;
  private timerHandle: number | null = null;
  private pendingStopTimer: number | null = null;
  private stimulationBoost: boolean = false;
  private sessionCompleteEmitted: boolean = false;

  // ── Events ──────────────────────────────────────────────────────────
  private listeners: Map<keyof EngineEvents, Set<Function>> = new Map();

  // ══════════════════════════════════════════════════════════════════════
  //  Constructor
  // ══════════════════════════════════════════════════════════════════════

  constructor() {
    this.state = {
      mood: null,
      isPlaying: false,
      isPaused: false,
      entrainmentMethod: 'invisible',
      audioSource: 'music',
      soundscapeCategory: null,
      currentVariation: null,
      currentMusicTrack: null,
      masterVolume: 0.8,
      elapsedSeconds: 0,
      sessionSeconds: 0,
      sessionHz: null,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Public API
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Initialize the AudioContext.
   *
   * Must be called from a user gesture (click/touch) on iOS/Safari.
   * Safe to call multiple times — subsequent calls are no-ops if the
   * context is already running.
   *
   * @throws If the browser does not support the Web Audio API.
   */
  async initialize(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'closed') return;

    try {
      // Safari still ships webkitAudioContext as of 2025
      const AudioCtx =
        globalThis.AudioContext ??
        (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser');
      }

      this.ctx = new AudioCtx();
    } catch (err) {
      const error = err instanceof Error
        ? err
        : new Error(`Failed to initialize AudioContext: ${err}`);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start a session with the given mood.
   *
   * Randomizes Hz, soundscape category/variation, drift phase, and crossfade
   * interval. If a session is already playing, it is stopped first.
   *
   * @param mood - The mood to play.
   * @param options - Optional overrides.
   * @param options.category - Force a specific soundscape category.
   * @param options.source - Choose music, soundscape, or both.
   * @param options.durationMinutes - Override the mood's default session length.
   * @throws If the mood is unknown or audio construction fails.
   */
  async play(
    mood: Mood,
    options?: {
      category?: SoundscapeCategory;
      source?: AudioSourceMode;
      stimulationBoost?: boolean;
      durationMinutes?: number;
    },
  ): Promise<void> {
    // Ensure AudioContext exists
    if (!this.ctx || this.ctx.state === 'closed') {
      await this.initialize();
    }

    // Resume suspended context (required on iOS after page load)
    if (this.ctx!.state === 'suspended') {
      await this.ctx!.resume();
    }

    const ctx = this.ctx!;

    // Validate mood
    const moodConfig = getMood(mood);
    if (!moodConfig) {
      throw new Error(`Unknown mood: "${mood}"`);
    }

    const hadPendingStop = this.cancelPendingStop(true);

    // If something is currently playing, tear it down cleanly
    if (!hadPendingStop && (this.state.isPlaying || this.state.isPaused)) {
      this.teardownGraph();
    }

    try {
      // 1. Generate session seed
      this.seed = generateSessionSeed(mood, options?.category);
      this.activeMoodConfig = moodConfig;
      this.sessionCompleteEmitted = false;

      const sessionMinutes = options?.durationMinutes ?? moodConfig.sessionMinutes;
      const sessionSeconds = sessionMinutes * 60;
      const requestedSource = this.resolveSourceForMood(
        mood,
        options?.source ?? this.state.audioSource ?? 'both',
      );
      const stimulationBoost = Boolean(options?.stimulationBoost) && this.supportsStimulationBoost(mood, requestedSource);
      this.stimulationBoost = stimulationBoost;
      this.state.currentMusicTrack = null;
      this.state.currentVariation = null;

      // 2. Build master audio graph
      //    soundscapeGain -> modulationChain -> masterGain -> compressor -> analyser -> destination

      // Master gain
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = GAIN_EPSILON; // start silent, will fade in

      // Compressor
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = COMPRESSOR_THRESHOLD;
      this.compressor.knee.value = COMPRESSOR_KNEE;
      this.compressor.ratio.value = COMPRESSOR_RATIO;
      this.compressor.attack.value = COMPRESSOR_ATTACK;
      this.compressor.release.value = COMPRESSOR_RELEASE;

      // Analyser
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = ANALYSER_FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.8;

      // Wire: masterGain -> compressor -> analyser -> destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      // Build modulation chain
      const { graph, input, output } = buildModulationChain(
        ctx,
        this.seed.hz,
        moodConfig.modulation,
        this.seed.driftPhase,
      );
      this.modulationGraph = graph;
      this.modulationInput = input;
      this.modulationOutput = output;

      // Wire modulation output -> masterGain
      output.connect(this.masterGain);

      // Soundscape uses a wet/dry split so modulation depth is user-controlled.
      // Dry path (natural) → masterGain directly.
      // Wet path (modulated) → modulation chain input.
      // Default is fully dry (soundscapeModDepth = 0).
      this.soundscapeGain = ctx.createGain();
      this.soundscapeGain.gain.value = this.getEffectiveSoundscapeGain(requestedSource, mood, stimulationBoost);

      this.soundscapeDryGain = ctx.createGain();
      this.soundscapeDryGain.gain.value = 1 - this.soundscapeModDepth;

      this.soundscapeWetGain = ctx.createGain();
      this.soundscapeWetGain.gain.value = this.soundscapeModDepth;

      this.soundscapeGain.connect(this.soundscapeDryGain);
      this.soundscapeGain.connect(this.soundscapeWetGain);
      this.soundscapeDryGain.connect(this.masterGain);
      this.soundscapeWetGain.connect(this.modulationInput as AudioNode);

      let soundscapeStarted = false;
      let musicStarted = false;
      let effectiveSource: AudioSourceMode = requestedSource;

      // 3. Start real soundscape audio only when requested.
      if (requestedSource !== 'music') {
        this.soundscapeManager = new SoundscapeManager(ctx);
        this.soundscapeManager.getOutput().connect(this.soundscapeGain);

        this.soundscapeManager.setOnVariationChange((from, to) => {
          this.state.currentVariation = to;
          this.emit('variationChange', from, to);
          this.emitStateChange();
        });

        await this.soundscapeManager.start(
          this.seed.category,
          this.seed.crossfadeIntervalMs,
        );
        soundscapeStarted = this.soundscapeManager.isPlaying();
      }

      // 3b. Start curated music tracks as the primary content layer.
      // Music stays mostly clean; full-chain modulation is too destructive for
      // full-range tracks and was the reason the app still felt noisy.
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.getEffectiveMusicGain(requestedSource, mood, stimulationBoost);
      this.startMusicEntrainment(ctx, this.seed.hz, moodConfig.modulation.amDepth, stimulationBoost);
      this.musicGain.connect(this.masterGain);

      // Start music playback if requested, or as fallback if soundscape failed
      if (requestedSource !== 'soundscape' || !soundscapeStarted) {
        this.fileMusicManager = new FileMusicManager(ctx);
        this.fileMusicManager.getOutput().connect(this.musicGain);
        this.fileMusicManager.setOnTrackChange((from, to) => {
          this.state.currentMusicTrack = to;
          if (from && this.soundscapeManager?.isPlaying()) {
            void this.soundscapeManager.crossfadeNow();
          }
          this.emit('musicTrackChange', from, to);
          this.emitStateChange();
        });

        const track = await this.fileMusicManager.start(mood);
        musicStarted = Boolean(track);
        if (requestedSource === 'soundscape' && !soundscapeStarted) {
          effectiveSource = 'music';
        }
      }

      if (requestedSource === 'both' && !soundscapeStarted && musicStarted) {
        effectiveSource = 'music';
      }

      // If a session asked for music and curated tracks are unavailable, keep
      // the session musical instead of silently degrading to ambience-only.
      if (requestedSource !== 'soundscape' && !musicStarted) {
        this.musicEngine = new GenerativeMusicEngine(ctx);
        this.musicEngine.getOutput().connect(this.musicGain);
        const musicSeed = Math.floor(Math.random() * 0x7fffffff);
        this.musicEngine.start({
          mood,
          seed: musicSeed,
          entrainmentHz: this.seed.hz,
          sessionDurationSeconds: moodConfig.sessionMinutes * 60,
          blendGain: Math.min(this.getMusicBlend(mood), 0.28),
        });
        this.state.currentMusicTrack = 'procedural-fallback';
        musicStarted = true;
        if (requestedSource === 'music' || !soundscapeStarted) {
          effectiveSource = 'music';
        }
      }

      // 4. Fade in masterGain
      const now = ctx.currentTime;
      this.masterGain.gain.setValueAtTime(GAIN_EPSILON, now);
      this.masterGain.gain.linearRampToValueAtTime(
        this.state.masterVolume,
        now + moodConfig.fadeInMs / 1000,
      );

      // 5. Update state
      this.state.mood = mood;
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.state.audioSource = effectiveSource;
      this.state.soundscapeCategory = soundscapeStarted ? this.seed.category : null;
      this.state.currentVariation = soundscapeStarted ? this.soundscapeManager?.getCurrentVariation() ?? this.seed.variationId : null;
      this.state.currentMusicTrack = this.fileMusicManager?.getCurrentTrack() ?? this.state.currentMusicTrack ?? null;
      this.state.sessionHz = this.seed.hz;
      this.state.sessionSeconds = sessionSeconds;
      this.state.elapsedSeconds = 0;

      // 6. Start session timer
      this.startTimer(sessionSeconds);

      // 7. Emit state change
      this.emitStateChange();
    } catch (err) {
      // Roll back on failure
      this.teardownGraph();
      this.state.isPlaying = false;
      this.state.isPaused = false;
      this.state.mood = null;
      this.state.sessionSeconds = 0;
      this.state.sessionHz = null;

      const error = err instanceof Error
        ? err
        : new Error(`Failed to start session "${mood}": ${err}`);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Pause playback by suspending the AudioContext.
   *
   * The session timer is also paused. Call {@link resume} to continue.
   * No-op if not currently playing or already paused.
   */
  pause(): void {
    if (!this.ctx || !this.state.isPlaying || this.state.isPaused) return;

    this.ctx.suspend();
    this.stopTimer();

    this.state.isPaused = true;
    this.state.isPlaying = false;
    this.emitStateChange();
  }

  /**
   * Resume from pause.
   *
   * Resumes the AudioContext and restarts the session timer from where
   * it left off. No-op if not paused.
   */
  resume(): void {
    if (!this.ctx || !this.state.isPaused) return;

    // Resume the AudioContext — may reject on iOS Safari if called
    // outside a user gesture; catch and discard.
    this.ctx.resume().catch(() => {});

    this.state.isPaused = false;
    this.state.isPlaying = true;

    // Compute remaining session time and reset timer so tick events
    // and the completion check use the correct duration
    const remaining = Math.max(0, this.state.sessionSeconds - this.state.elapsedSeconds);
    if (remaining > 0) {
      this.state.sessionSeconds = remaining;
      this.state.elapsedSeconds = 0;
      this.startTimer(remaining);
    }

    this.emitStateChange();
  }

  /**
   * Stop playback with a fade-out.
   *
   * The fade-out duration is determined by the active mood's `fadeOutMs`.
   * After the fade completes, all audio nodes are torn down.
   * No-op if not playing or paused.
   */
  stop(): void {
    if (!this.ctx || (!this.state.isPlaying && !this.state.isPaused)) return;

    const fadeOutMs = this.activeMoodConfig?.fadeOutMs ?? 2000;
    const fadeOutS = fadeOutMs / 1000;
    const now = this.ctx.currentTime;

    // Stop the timer immediately
    this.stopTimer();

    // If paused, resume the context briefly to allow fade-out
    if (this.state.isPaused) {
      this.ctx.resume().catch(() => {});
    }

    // Fade out master gain
    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(GAIN_EPSILON, now + fadeOutS);
    }

    this.cancelPendingStop();

    // Schedule teardown after fade completes
    this.pendingStopTimer = window.setTimeout(() => {
      this.pendingStopTimer = null;
      this.teardownGraph();

      this.state.mood = null;
      this.state.isPlaying = false;
      this.state.isPaused = false;
      this.state.soundscapeCategory = null;
      this.state.currentVariation = null;
      this.state.currentMusicTrack = null;
      this.state.sessionHz = null;
      this.state.elapsedSeconds = 0;
      this.state.sessionSeconds = 0;
      this.stimulationBoost = false;
      this.seed = null;
      this.activeMoodConfig = null;

      this.emitStateChange();
    }, (fadeOutS + 0.1) * 1000);

    // Update state immediately to reflect stopping
    this.state.isPlaying = false;
    this.emitStateChange();
  }

  /**
   * Skip to the next music track within the current session.
   *
   * Crossfades the curated music layer while keeping the soundscape and
   * modulation chain running. If the engine is using the procedural fallback,
   * it restarts that fallback with a new seed.
   *
   * No-op if not currently playing.
   */
  async skipMusic(): Promise<boolean> {
    if (!this.ctx || !this.state.isPlaying || !this.activeMoodConfig) {
      return false;
    }

    if (this.fileMusicManager?.isPlaying()) {
      const track = await this.fileMusicManager.crossfadeNow();
      if (track) {
        this.emit('musicSkip');
        return true;
      }
      return false;
    }

    if (!this.musicEngine) return false;

    // Stop the current music engine (includes fade-out of music blend)
    this.musicEngine.stop();

    // Generate new music seed and restart
    const newMusicSeed = Math.floor(Math.random() * 0x7fffffff);
    const mood = this.state.mood!;
    this.musicEngine.start({
      mood,
      seed: newMusicSeed,
      entrainmentHz: this.seed!.hz,
      sessionDurationSeconds: this.activeMoodConfig.sessionMinutes * 60,
      blendGain: this.getMusicBlend(mood),
    });

    // Emit skip event
    this.emit('musicSkip');
    return true;
  }

  /**
   * Scale the music AM modulation depth live (0 = off, 1 = mood default, 1.5 = 150%).
   * Uses sideDepth = amDepth * 0.5 * scale, consistent with startMusicEntrainment.
   */
  setMusicModulationScale(scale: number): void {
    if (!this.musicEntrainmentDepth || !this.activeMoodConfig || !this.ctx) return;
    const baseDepth = this.activeMoodConfig.modulation.amDepth;
    const sideDepth = Math.max(0, Math.min(0.25, baseDepth * 0.5 * scale));
    this.musicEntrainmentDepth.gain.setTargetAtTime(sideDepth, this.ctx.currentTime, 0.1);
  }

  /**
   * Set soundscape modulation depth (0–1).
   * 0 = fully natural (dry path only).
   * 1 = fully modulated (wet path only).
   * Intermediate values blend both paths — applies instantly without restart.
   */
  setModulateSoundscape(depth: number): void {
    this.soundscapeModDepth = Math.max(0, Math.min(1, depth));
    const wetMix = Math.pow(this.soundscapeModDepth, 0.75) * 0.85;
    const dryMix = 1 - wetMix;

    if (this.soundscapeDryGain) {
      this.soundscapeDryGain.gain.setTargetAtTime(dryMix, this.ctx?.currentTime ?? 0, 0.05);
    }
    if (this.soundscapeWetGain) {
      this.soundscapeWetGain.gain.setTargetAtTime(wetMix, this.ctx?.currentTime ?? 0, 0.05);
    }

    if (this.modulationGraph && this.ctx && this.activeMoodConfig) {
      const base = this.activeMoodConfig.modulation;
      const modConfig = {
        ...base,
        amDepth: Math.min(base.amDepth * (0.8 + this.soundscapeModDepth * 2.4), 0.45),  // soundscape tolerates higher AM than music
        spectralDepthDb: Math.min(base.spectralDepthDb * (0.85 + this.soundscapeModDepth * 1.65), 3.0),
        panDepth: Math.min(base.panDepth * (0.8 + this.soundscapeModDepth * 1.4), 0.12),
      };
      updateModulationDepths(this.modulationGraph, this.ctx, modConfig, 0.35);
    }
  }

  /**
   * Toggle sprint boost live without restarting the current track.
   */
  setStimulationBoost(enabled: boolean): void {
    const mood = this.state.mood;
    const source = this.state.audioSource;
    if (!mood || !source) {
      this.stimulationBoost = enabled;
      return;
    }

    const allowed = this.supportsStimulationBoost(mood, source);
    this.stimulationBoost = allowed ? enabled : false;

    const now = this.ctx?.currentTime ?? 0;
    const nextMusicGain = this.getEffectiveMusicGain(source, mood, this.stimulationBoost);
    const nextSoundscapeGain = this.getEffectiveSoundscapeGain(source, mood, this.stimulationBoost);

    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(nextMusicGain, now + 0.35);
    }

    if (this.soundscapeGain) {
      this.soundscapeGain.gain.cancelScheduledValues(now);
      this.soundscapeGain.gain.setValueAtTime(this.soundscapeGain.gain.value, now);
      this.soundscapeGain.gain.linearRampToValueAtTime(nextSoundscapeGain, now + 0.35);
    }

    if (this.musicEntrainmentDepth && this.activeMoodConfig) {
      const moodDepth = this.activeMoodConfig.modulation.amDepth;
      // sideDepth = half of moodDepth (music gets gentler AM than soundscape)
      const sideDepth = this.stimulationBoost
        ? Math.min(moodDepth * 0.65, 0.25)
        : moodDepth * 0.50;
      this.musicEntrainmentDepth.gain.cancelScheduledValues(now);
      this.musicEntrainmentDepth.gain.setValueAtTime(this.musicEntrainmentDepth.gain.value, now);
      this.musicEntrainmentDepth.gain.linearRampToValueAtTime(sideDepth, now + 0.6);
    }

    this.emitStateChange();
  }

  /**
   * Skip to the next soundscape track within the current category.
   *
   * Crossfades the ambient layer while keeping music and modulation running.
   * No-op if the current source mode does not include soundscapes.
   */
  async skipSoundscape(): Promise<boolean> {
    if (!this.ctx || !this.state.isPlaying || !this.soundscapeManager?.isPlaying()) {
      return false;
    }

    const track = await this.soundscapeManager.crossfadeNow();
    return Boolean(track);
  }

  /** Live crossfade to a different soundscape category — music and session keep running. */
  async changeSoundscapeCategory(category: SoundscapeCategory): Promise<boolean> {
    if (!this.ctx || !this.state.isPlaying || !this.soundscapeManager?.isPlaying()) {
      return false;
    }
    const track = await this.soundscapeManager.crossfadeToCategory(category);
    if (track) this.state.soundscapeCategory = category;
    return Boolean(track);
  }

  /**
   * Set the master volume (0-1).
   *
   * Applies immediately with a short 50ms ramp to avoid clicks.
   * The value is persisted across sessions.
   *
   * @param volume - Target volume, clamped to [0, 1].
   */
  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.state.masterVolume = clamped;

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(
        Math.max(clamped, GAIN_EPSILON),
        now + 0.05,
      );
    }

    this.emitStateChange();
  }

  /**
   * Get the AnalyserNode for visualizers.
   *
   * Returns `null` if no session is active. The analyser is connected
   * post-compressor, so it reflects the final mixed output.
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Get the active AudioContext for diagnostics and recording tools.
   */
  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Get a snapshot of the current engine state.
   *
   * Returns a shallow copy — safe to store and compare.
   */
  getState(): EngineState {
    return { ...this.state };
  }

  /**
   * Get all mood configurations (for UI rendering).
   *
   * This is a static method — it doesn't require an engine instance.
   */
  static getMoods(): Record<Mood, MoodConfig> {
    return MOODS;
  }

  /**
   * Subscribe to an engine event.
   *
   * @param event - The event name.
   * @param callback - The callback function.
   */
  on<K extends keyof EngineEvents>(event: K, callback: EngineEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from an engine event.
   *
   * @param event - The event name.
   * @param callback - The callback to remove.
   */
  off<K extends keyof EngineEvents>(event: K, callback: EngineEvents[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  /**
   * Destroy the engine completely.
   *
   * Tears down all audio nodes, closes the AudioContext, and removes
   * all event listeners. After calling destroy(), the engine instance
   * cannot be reused — create a new one instead.
   */
  async destroy(): Promise<void> {
    this.cancelPendingStop();
    this.stopTimer();
    this.teardownGraph();

    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        await this.ctx.close();
      } catch {
        // Context may already be closed — safe to ignore
      }
    }
    this.ctx = null;

    // Reset all state
    this.state = {
      mood: null,
      isPlaying: false,
      isPaused: false,
      entrainmentMethod: 'invisible',
      audioSource: 'music',
      soundscapeCategory: null,
      currentVariation: null,
      currentMusicTrack: null,
      masterVolume: this.state.masterVolume, // preserve volume preference
      elapsedSeconds: 0,
      sessionSeconds: 0,
      sessionHz: null,
    };

    this.seed = null;
    this.activeMoodConfig = null;
    this.stimulationBoost = false;

    // Clear all listeners
    this.listeners.clear();
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Internal: Events
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Emit an event to all registered listeners.
   */
  private emit<K extends keyof EngineEvents>(
    event: K,
    ...args: Parameters<EngineEvents[K]>
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;

    for (const cb of set) {
      try {
        (cb as Function)(...args);
      } catch (err) {
        // Don't let a broken listener crash the engine
        console.error(`[ArgoBeatEngine] Error in ${event} listener:`, err);
      }
    }
  }

  /**
   * Convenience: emit a stateChange event with the current snapshot.
   */
  private emitStateChange(): void {
    this.emit('stateChange', this.getState());
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Internal: Session Timer
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Start the session timer.
   *
   * Ticks every second, emits `tick` events, and checks for session
   * completion. On completion: emits `sessionComplete`. Sleep sessions skip
   * audible completion cues so the end state remains low-arousal.
   *
   * @param sessionSeconds - Total session duration in seconds.
   */
  private startTimer(sessionSeconds: number): void {
    this.stopTimer();

    this.timerHandle = window.setInterval(() => {
      if (!this.state.isPlaying) return;

      this.state.elapsedSeconds++;

      // Emit tick
      this.emit('tick', this.state.elapsedSeconds, this.state.sessionSeconds);

      // Accelerate drift every 15 minutes to counteract habituation
      if (this.state.elapsedSeconds % 900 === 0 && this.modulationGraph && this.ctx) {
        const baseCycle = this.activeMoodConfig?.modulation.driftCycleSeconds ?? 120;
        accelerateHabituationDrift(
          this.modulationGraph,
          this.ctx,
          this.state.elapsedSeconds / 60,
          baseCycle,
        );
      }

      // Check for session completion
      if (
        this.state.elapsedSeconds >= this.state.sessionSeconds &&
        !this.sessionCompleteEmitted
      ) {
        this.sessionCompleteEmitted = true;

        if (this.state.mood !== 'sleep') {
          this.playCompletionChime();
        }

        // Emit session complete
        // The engine continues playing — UI decides whether to stop
        this.emit(
          'sessionComplete',
          this.state.mood!,
          this.state.elapsedSeconds,
        );
      }

      this.emitStateChange();
    }, 1000);
  }

  /**
   * Stop the session timer.
   */
  private stopTimer(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Internal: Completion Chime
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Play a gentle C major chord (C5, E5, G5) as a session completion signal.
   *
   * The chord has staggered onset (30ms apart) and exponential decay.
   * It connects directly to the compressor, bypassing masterGain, so it
   * remains audible even during the post-completion fade-out.
   */
  private playCompletionChime(): void {
    if (!this.ctx || !this.compressor) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // C5 = 523.25 Hz, E5 = 659.25 Hz, G5 = 783.99 Hz
    const frequencies = [523.25, 659.25, 783.99];
    const chimeGain = 0.15; // gentle volume
    const decaySeconds = 2.5;

    // Create a dedicated gain node for the chime, bypass masterGain
    const chimeOutput = ctx.createGain();
    chimeOutput.gain.value = chimeGain;
    chimeOutput.connect(this.compressor);

    frequencies.forEach((freq, i) => {
      const onset = now + i * 0.03; // 30ms stagger

      // Fundamental + quiet octave harmonic for warmth (avoids bare sine clinical tone)
      ([{ f: freq, level: 1.0 }, { f: freq * 2, level: 0.22 }] as { f: number; level: number }[]).forEach(({ f, level }) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;

        const env = ctx.createGain();
        env.gain.setValueAtTime(0, onset);
        env.gain.linearRampToValueAtTime(level, onset + 0.01);
        env.gain.exponentialRampToValueAtTime(GAIN_EPSILON, onset + decaySeconds);

        osc.connect(env);
        env.connect(chimeOutput);
        osc.start(onset);
        osc.stop(onset + decaySeconds + 0.1);

        osc.onended = () => {
          try { osc.disconnect(); } catch { /* ok */ }
          try { env.disconnect(); } catch { /* ok */ }
        };
      });
    });

    // Clean up chime output after all tones decay
    setTimeout(() => {
      try { chimeOutput.disconnect(); } catch { /* ok */ }
    }, (decaySeconds + 0.5) * 1000);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Internal: Music Blend
  // ══════════════════════════════════════════════════════════════════════

  private getMusicBlend(mood: string): number {
    switch (mood) {
      case 'focus': return 0.9;
      case 'deepWork': return 0.9;
      case 'relax': return 0.8;
      case 'meditate': return 0.65;
      case 'sleep': return 0.45;
      default: return 0.85;
    }
  }

  private resolveSourceForMood(mood: string, source: AudioSourceMode): AudioSourceMode {
    if (mood === 'sleep') return 'soundscape';
    return source;
  }

  private getSoundscapeBlend(mood: string): number {
    switch (mood) {
      case 'focus': return 0.85;
      case 'deepWork': return 0.85;
      case 'relax': return 0.75;
      case 'meditate': return 0.55;
      case 'sleep': return 0.38;
      default: return 0.75;
    }
  }

  private supportsStimulationBoost(mood: string, source: AudioSourceMode): boolean {
    return source !== 'soundscape' && (mood === 'focus' || mood === 'deepWork');
  }

  private getEffectiveMusicGain(source: AudioSourceMode, mood: string, stimulationBoost: boolean): number {
    // Reference: -27 LUFS, true peak -13.8 dBFS — lots of headroom, not loud
    // Keep music quiet enough that ambience can sit alongside without fighting
    const base = (source === 'both' ? 0.68 : 0.80) * this.getMusicBlend(mood);
    if (!stimulationBoost) return base;
    return Math.min(base * 1.10, 0.85); // Sprint boost: modest lift, never aggressive
  }

  private getSoundscapeCategoryTrim(category: SoundscapeCategory | null, source: AudioSourceMode): number {
    if (source !== 'both' || !category) return 1;

    switch (category) {
      case 'thunder': return 0.62;
      case 'jungle': return 0.72;
      case 'ocean': return 0.8;
      case 'cafe': return 0.76;
      case 'fire': return 0.84;
      case 'space': return 0.82;
      default: return 1;
    }
  }

  private getEffectiveSoundscapeGain(source: AudioSourceMode, mood: string, stimulationBoost: boolean): number {
    const base = (source === 'both' ? 0.40 : 0.85) * this.getSoundscapeBlend(mood);
    const trimmed = base * this.getSoundscapeCategoryTrim(this.seed?.category ?? null, source);
    if (!stimulationBoost) return trimmed;
    return Math.min(trimmed * 1.35, source === 'both' ? 0.58 : 0.90);
  }

  /**
   * Apply band-limited additive amplitude modulation to the music layer.
   *
   * Uses an additive sidechain approach to avoid gain doubling:
   *   1. Full music passes through to masterGain unmodified (dry, full range).
   *   2. A bandpass-extracted mid-band (200–1 kHz) is routed through a
   *      sidechain gain whose mean is zero. The LFO oscillates it ±sideDepth,
   *      adding subtle boosts and cuts to the mids without any DC energy addition.
   *
   * This prevents the mid-band emphasis (gain doubling) that would occur if the
   * bandpass signal were simply summed with the dry signal at unity gain.
   *
   * Music depth is set to half of the mood's amDepth config so the perceptual
   * effect is "shimmer" not "tremolo" — the soundscape chain handles higher
   * depths on noise/ambience content which tolerates it better.
   *
   * Signal path:
   *   musicGain ──────────────────────────────────────────────── masterGain (dry)
   *   musicGain → hp(200Hz) → lp(1kHz) → sideGain(LFO ±depth) → masterGain (sidechain)
   */
  private startMusicEntrainment(ctx: AudioContext, hz: number, moodDepth: number, stimulationBoost: boolean = false): void {
    if (!this.musicGain || !this.masterGain) return;

    const now = ctx.currentTime;

    // Music gets half the mood's amDepth — avoids audible tremolo on polyphonic tracks.
    // Soundscape chain uses the full amDepth (noise/ambience tolerates higher depth).
    const sideDepth = stimulationBoost
      ? Math.min(moodDepth * 0.65, 0.25)
      : moodDepth * 0.50;

    // Bandpass isolating the validated 200 Hz – 1 kHz band
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 200;
    hp.Q.value = 0.707; // Butterworth — flat passband

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1000;
    lp.Q.value = 0.707;

    // Sidechain gain — mean is zero; LFO drives it ±sideDepth
    // This adds/subtracts mid-band energy around the already-present dry signal.
    // No DC offset means no permanent mid-boost.
    const sideGain = ctx.createGain();
    sideGain.gain.value = 0;

    // Sine LFO at target frequency
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, now);

    // depthGain scales LFO [-1,+1] → [-sideDepth, +sideDepth]
    const depthGain = ctx.createGain();
    depthGain.gain.setValueAtTime(0, now);
    depthGain.gain.linearRampToValueAtTime(sideDepth, now + (stimulationBoost ? 1.4 : 2.4));

    // Wire LFO → sidechain gain parameter (no bias — centered at 0)
    osc.connect(depthGain);
    depthGain.connect(sideGain.gain);

    // Dry path: full music unmodified → masterGain
    this.musicGain.connect(this.masterGain);

    // Sidechain path: bandpass mid → sideGain (oscillates ±sideDepth) → masterGain
    this.musicGain.connect(hp);
    hp.connect(lp);
    lp.connect(sideGain);
    sideGain.connect(this.masterGain);

    osc.start(now);

    this.musicEntrainmentOsc = osc;
    this.musicEntrainmentDepth = depthGain;
    // hp, lp, sideGain tracked for teardown (depthGain is via musicEntrainmentDepth)
    this._musicEntrainmentNodes = [hp, lp, sideGain];
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Internal: Audio Graph Teardown
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Tear down the entire audio graph.
   *
   * Destroys modulation chain, soundscape manager, and disconnects all
   * master bus nodes. Safe to call when no graph exists (no-op).
   */
  private teardownGraph(): void {
    // Destroy soundscape manager
    if (this.soundscapeManager) {
      this.soundscapeManager.destroy();
      this.soundscapeManager = null;
    }

    // Destroy music engine
    if (this.fileMusicManager) {
      this.fileMusicManager.destroy();
      this.fileMusicManager = null;
    }
    if (this.musicEngine) { this.musicEngine.destroy(); this.musicEngine = null; }
    if (this.musicEntrainmentOsc) {
      try { this.musicEntrainmentOsc.stop(); } catch { /* ok */ }
      try { this.musicEntrainmentOsc.disconnect(); } catch { /* ok */ }
      this.musicEntrainmentOsc = null;
    }
    if (this.musicEntrainmentDepth) {
      try { this.musicEntrainmentDepth.disconnect(); } catch { /* ok */ }
      this.musicEntrainmentDepth = null;
    }
    for (const node of this._musicEntrainmentNodes) {
      if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
        try { (node as OscillatorNode).stop(); } catch { /* ok */ }
      }
      try { node.disconnect(); } catch { /* ok */ }
    }
    this._musicEntrainmentNodes = [];
    if (this.musicGain) { try { this.musicGain.disconnect(); } catch {} this.musicGain = null; }

    // Destroy modulation chain
    if (this.modulationGraph) {
      destroyModulationChain(this.modulationGraph);
      this.modulationGraph = null;
      this.modulationInput = null;
      this.modulationOutput = null;
    }

    // Disconnect soundscape gain
    if (this.soundscapeGain) {
      try { this.soundscapeGain.disconnect(); } catch { /* ok */ }
      this.soundscapeGain = null;
    }

    // Disconnect master bus
    if (this.masterGain) {
      try { this.masterGain.disconnect(); } catch { /* ok */ }
      this.masterGain = null;
    }

    if (this.compressor) {
      try { this.compressor.disconnect(); } catch { /* ok */ }
      this.compressor = null;
    }

    if (this.analyser) {
      try { this.analyser.disconnect(); } catch { /* ok */ }
      this.analyser = null;
    }

    // Stop the timer
    this.stopTimer();
  }

  private cancelPendingStop(teardownGraph: boolean = false): boolean {
    if (this.pendingStopTimer === null) return false;

    clearTimeout(this.pendingStopTimer);
    this.pendingStopTimer = null;

    if (teardownGraph) {
      this.teardownGraph();
    }

    return true;
  }
}

export default ArgoBeatEngine;
