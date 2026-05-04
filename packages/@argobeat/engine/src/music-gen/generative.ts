/**
 * GenerativeMusicEngine — procedural music generation for ArgoBeat.
 *
 * Creates unique musical sessions per mood using Web Audio synthesis.
 * No audio files — all sounds generated from oscillators, envelopes, and filters.
 *
 * Usage:
 *   const music = new GenerativeMusicEngine(audioContext);
 *   music.start(outputNode, { mood: 'focus', seed: 12345, entrainmentHz: 15, sessionDurationS: 1500, blendGain: 0.35 });
 *   // ... later ...
 *   music.stop();
 */

import type { GenerativeMusicConfig } from './types.js';
import { startMusicPattern, type ActivePattern } from './patterns.js';

export class GenerativeMusicEngine {
  private ctx: AudioContext;
  private outputGain: GainNode;
  private masterFilter: BiquadFilterNode;
  private activePattern: ActivePattern | null = null;
  private config: GenerativeMusicConfig | null = null;
  private evolutionInterval: number | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    // Output chain: pattern voices -> masterFilter -> outputGain
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0;

    this.masterFilter = ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 2000; // warm master filter
    this.masterFilter.Q.value = 0.5;
    this.masterFilter.connect(this.outputGain);
  }

  getOutput(): GainNode { return this.outputGain; }

  start(config: GenerativeMusicConfig): void {
    this.stop(); // clean up any existing
    this.config = config;

    // Fade in
    const now = this.ctx.currentTime;
    this.outputGain.gain.setValueAtTime(0, now);
    this.outputGain.gain.linearRampToValueAtTime(config.blendGain, now + 3);

    // Set initial filter based on mood
    // (evolution will adjust this over time)
    this.masterFilter.frequency.value = this.getInitialFilterHz(config.mood);

    // Start the mood-appropriate pattern
    this.activePattern = startMusicPattern(this.ctx, this.masterFilter, {
      mood: config.mood,
      seed: config.seed,
      entrainmentHz: config.entrainmentHz,
      sessionDurationS: config.sessionDurationSeconds,
    });

    // Start evolution tick (every 5 seconds)
    this.startEvolution(config);
  }

  stop(): void {
    if (this.activePattern) {
      this.activePattern.stop();
      this.activePattern = null;
    }
    if (this.evolutionInterval !== null) {
      clearInterval(this.evolutionInterval);
      this.evolutionInterval = null;
    }
    // Fade out
    const now = this.ctx.currentTime;
    this.outputGain.gain.cancelScheduledValues(now);
    this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
    this.outputGain.gain.linearRampToValueAtTime(0, now + 2);
    this.config = null;
  }

  destroy(): void {
    this.stop();
    try { this.masterFilter.disconnect(); } catch {}
    try { this.outputGain.disconnect(); } catch {}
  }

  private getInitialFilterHz(mood: string): number {
    switch (mood) {
      case 'focus': return 1600;
      case 'deepWork': return 1400;
      case 'relax': return 1000;
      case 'meditate': return 800;
      case 'sleep': return 500;
      default: return 1200;
    }
  }

  private startEvolution(config: GenerativeMusicConfig): void {
    const startTime = this.ctx.currentTime;

    this.evolutionInterval = window.setInterval(() => {
      if (!this.config) return;

      const elapsed = this.ctx.currentTime - startTime;
      const ratio = Math.min(elapsed / config.sessionDurationSeconds, 1);

      // Fade in during first 10%, fade out during last 10%
      let volumeMultiplier = 1.0;
      if (ratio < 0.1) volumeMultiplier = ratio / 0.1;
      else if (ratio > 0.9) volumeMultiplier = (1 - ratio) / 0.1;

      const targetGain = config.blendGain * volumeMultiplier;
      this.outputGain.gain.linearRampToValueAtTime(
        targetGain, this.ctx.currentTime + 5
      );

      // Sleep mode: progressive filter closing and volume reduction
      if (config.mood === 'sleep') {
        const sleepFilter = this.getSleepFilterHz(ratio);
        const sleepVolume = this.getSleepVolume(ratio) * config.blendGain;
        this.masterFilter.frequency.linearRampToValueAtTime(sleepFilter, this.ctx.currentTime + 5);
        this.outputGain.gain.linearRampToValueAtTime(sleepVolume, this.ctx.currentTime + 5);
      }

      // Focus/DeepWork: slight filter opening mid-session
      if (config.mood === 'focus' || config.mood === 'deepWork') {
        const baseFilter = this.getInitialFilterHz(config.mood);
        const midBoost = Math.sin(ratio * Math.PI) * 200; // peaks at 50%
        this.masterFilter.frequency.linearRampToValueAtTime(
          baseFilter + midBoost, this.ctx.currentTime + 5
        );
      }
    }, 5000);
  }

  private getSleepFilterHz(ratio: number): number {
    if (ratio < 0.2) return 400;
    if (ratio < 0.5) return 400 - ((ratio - 0.2) / 0.3) * 200;
    if (ratio < 0.8) return 200 - ((ratio - 0.5) / 0.3) * 120;
    return 80;
  }

  private getSleepVolume(ratio: number): number {
    if (ratio < 0.2) return 1.0;
    if (ratio < 0.5) return 1.0 - ((ratio - 0.2) / 0.3) * 0.5;
    if (ratio < 0.8) return 0.5 - ((ratio - 0.5) / 0.3) * 0.45;
    return 0.05;
  }
}
