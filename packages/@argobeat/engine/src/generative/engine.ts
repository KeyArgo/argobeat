/**
 * GenerativeEngine — infinite browser-based synthesis for ArgoBeat.
 *
 * Replaces static MP3 tracks with a layered synthesis engine:
 *   - FM pad (Tone.js PolySynth/FMSynth) — rich detuned chords
 *   - Arp (Tone.js PolySynth/AMSynth) — melodic patterns, mood-dependent
 *   - Texture (brown noise, pure Web Audio) — tonal floor
 *   - Optional beat (Tone.js MembraneSynth) — for focus/deepWork only
 *
 * All parameters drift via Simplex-noise modulation so the result
 * never loops or repeats exactly. Designed to "disappear" as background
 * music rather than demand foreground attention.
 *
 * Usage:
 *   const gen = new GenerativeEngine(audioContext);
 *   gen.getOutput().connect(musicGainNode);
 *   await gen.start('focus');
 *   // ... later:
 *   gen.stop();
 *   gen.destroy();
 */

import * as Tone from 'tone';
import { Modulator, ModPresets } from './modulation.js';
import { SCALES, getScaleNotes, midiToFreq, randomRoot } from './scales.js';
import { MOOD_SYNTH_CONFIGS } from './mood-config.js';
import type { Mood } from '../types.js';

// Chord changes every 256 beats (~3 min at 85 BPM) — long enough to be
// imperceptible as a cycle, short enough to keep sessions evolving.
const CHORD_CHANGE_BEATS = 256;
const CHORD_CROSSFADE_S  = 6;    // overlap between outgoing and incoming chord
const TICK_INTERVAL_MS   = 100;

interface NoteScheduler {
  pattern: (number | null)[];
  beatIndex: number;
  bpm: number;
  lastBeat: number;
}

export class GenerativeEngine {
  // ── Audio context + shared output ─────────────────────────────────
  private ctx: AudioContext;
  private outputGain: GainNode;

  // ── Tone.js instruments ──────────────────────────────────────────
  // Dual pad synths for crossfading — one fades out while other fades in.
  private padSynth: Tone.PolySynth | null = null;
  private padSynthB: Tone.PolySynth | null = null;
  private arpSynth: Tone.PolySynth | null = null;
  private beatSynth: Tone.MembraneSynth | null = null;
  private toneCtx: Tone.Context | null = null;

  // ── Texture (pure Web Audio brown noise) ─────────────────────────
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;

  // ── Pad filter (breathes with Perlin noise) ───────────────────────
  private padFilter: Tone.Filter | null = null;

  // ── Reverb (ConvolverNode) ────────────────────────────────────────
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;

  // ── Modulation ───────────────────────────────────────────────────
  private padFilterMod: Modulator | null = null;
  private noiseFilterMod: Modulator | null = null;
  private arpVelocityMod: Modulator | null = null;

  // ── Session state ────────────────────────────────────────────────
  private mood: Mood | null = null;
  private scaleNotes: number[] = [];
  private chordNotes: string[] = [];
  private scheduler: NoteScheduler | null = null;
  private tickHandle: number | null = null;
  private isRunning = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.8;
  }

  getOutput(): AudioNode {
    return this.outputGain;
  }

  /** Current synthesis parameter snapshot for AI analysis context. */
  getParams(): Record<string, number> {
    const cfg = this.mood ? MOOD_SYNTH_CONFIGS[this.mood] : null;
    return {
      padFilterHz:   (this.padFilter?.frequency.value as unknown as number) ?? cfg?.padFilter[0] ?? 600,
      padVolume:     cfg?.padVolume ?? 0.5,
      textureVolume: cfg?.textureVolume ?? 0.04,
      amDepth:       cfg ? MOOD_SYNTH_CONFIGS[this.mood!]?.padVolume ?? 0.12 : 0.12,
    };
  }

  /**
   * Live parameter update — called by AI suggestion apply.
   * Changes take effect immediately without restarting the session.
   * Bounds are enforced server-side; this method trusts the caller.
   */
  setParam(key: string, value: number): void {
    const now = this.ctx.currentTime;
    switch (key) {
      case 'padFilterHz':
        if (this.padFilter) {
          this.padFilter.frequency.setTargetAtTime(value, Tone.now(), 0.5);
        }
        break;
      case 'padVolume': {
        const db = 20 * Math.log10(Math.max(0.001, value));
        if (this.padSynth)  this.padSynth.volume.rampTo(db, 0.5);
        if (this.padSynthB) this.padSynthB.volume.rampTo(db, 0.5);
        break;
      }
      case 'textureVolume':
        if (this.noiseGain) {
          this.noiseGain.gain.setTargetAtTime(value * 0.06, now, 0.3);
        }
        break;
      case 'amDepth':
        // amDepth is applied via the musicEntrainment oscillator in the parent engine
        // Dispatch to parent engine via custom event
        window.dispatchEvent(new CustomEvent('argobeat:setAmDepth', { detail: value }));
        break;
    }
  }

  async start(mood: Mood): Promise<void> {
    if (this.isRunning) this.teardown();

    this.mood = mood;
    const cfg = MOOD_SYNTH_CONFIGS[mood];
    const now = this.ctx.currentTime;

    // Wire Tone.js to use ArgoBeat's AudioContext
    this.toneCtx = new Tone.Context(this.ctx);
    Tone.setContext(this.toneCtx);

    // ── Reverb impulse ────────────────────────────────────────────
    const { reverbNode, reverbGain, dryGain } = this.buildReverb(cfg.reverbWet);
    this.reverbNode = reverbNode;
    this.reverbGain = reverbGain;
    this.dryGain    = dryGain;
    reverbGain.connect(this.outputGain);
    dryGain.connect(this.outputGain);

    const wetBus = reverbNode;    // connect instruments here to get reverb
    const dryBus = this.dryGain;

    // ── Scale / chord setup ───────────────────────────────────────
    const scaleName = cfg.scales[Math.floor(Math.random() * cfg.scales.length)];
    const scale     = SCALES[scaleName];
    const root      = randomRoot();
    this.scaleNotes = getScaleNotes(root, scale, 3);
    this.chordNotes = this.buildChord(root, scale);

    // ── Pad — fat sine oscillator (3 detuned sines, lush not harsh) ──
    // Dual instances (A+B) enable smooth crossfades without any silent gap.
    // Attack is short (1s) so the pad feels continuous, not event-like.
    const padOptions = {
      oscillator: { type: 'fatsine' as any, spread: 18, count: 3 },
      envelope: { attack: 1.2, decay: 0.5, sustain: 0.85, release: CHORD_CROSSFADE_S },
    };
    const padVol = Tone.gainToDb(cfg.padVolume * 0.7);

    // Lowpass filter on the pad — Perlin-modulated so timbre breathes slowly.
    // Start dark, let it open and close over minutes. This is what makes the
    // pad feel alive rather than static.
    const [filterLo, filterHi] = cfg.padFilter;
    this.padFilter = new Tone.Filter(filterLo + 100, 'lowpass');
    this.padFilter.rolloff = -24;
    this.padFilter.Q.value = 0.8;
    this.padFilter.disconnect();
    (this.padFilter as any).connect(dryBus);
    (this.padFilter as any).connect(wetBus);

    this.padSynth  = new Tone.PolySynth(Tone.Synth, padOptions);
    this.padSynthB = new Tone.PolySynth(Tone.Synth, padOptions);
    for (const p of [this.padSynth, this.padSynthB]) {
      p.volume.value = padVol;
      p.disconnect();
      // Route through pad filter instead of directly to buses
      (p as any).connect(this.padFilter);
    }

    // Trigger chord on A; B waits until first crossfade
    this.padSynth.triggerAttack(this.chordNotes, Tone.now());

    // ── Pad filter modulation — very slow, like breathing ────────────
    this.padFilterMod = new Modulator({
      base:  (filterLo + filterHi) / 2,
      range: (filterHi - filterLo) / 2,
      speed: 0.008, // ~125s cycle — imperceptibly slow, just drifts
    });
    // Noise filter uses a separate modulator so they drift independently
    this.noiseFilterMod = new Modulator(ModPresets.glacial(
      (cfg.padFilter[0] + cfg.padFilter[1]) / 2,
      (cfg.padFilter[1] - cfg.padFilter[0]) / 2,
    ));

    // ── Arp — soft sine pluck, barely audible, never annoying ────
    if (Math.random() < cfg.arpPresence && cfg.bpm !== null) {
      this.arpSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.04, decay: 1.2, sustain: 0, release: 1.8 },
      });
      this.arpSynth.volume.value = -26;  // very quiet — texture only
      this.arpSynth.disconnect();
      (this.arpSynth as any).connect(dryBus);
      (this.arpSynth as any).connect(wetBus);
      this.arpVelocityMod = new Modulator(ModPresets.medium(0.5, 0.2));

      const bpm = cfg.bpm[0] + Math.random() * (cfg.bpm[1] - cfg.bpm[0]);
      const pattern = this.buildArpPattern(this.scaleNotes, cfg.arpDensity);
      this.scheduler = { pattern, beatIndex: 0, bpm, lastBeat: now };
    }

    // ── Beat ──────────────────────────────────────────────────────
    if (Math.random() < cfg.beatPresence && cfg.bpm !== null) {
      this.beatSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
      });
      this.beatSynth.volume.value = -28;
      this.beatSynth.disconnect();
      (this.beatSynth as any).connect(dryBus);
    }

    // ── Texture (brown noise) ─────────────────────────────────────
    this.noiseGain   = this.ctx.createGain();
    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type      = 'bandpass';
    this.noiseFilter.frequency.value = (cfg.padFilter[0] + cfg.padFilter[1]) / 2;
    this.noiseFilter.Q.value   = 0.4;

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = this.buildBrownNoise();
    this.noiseSource.loop   = true;
    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(dryBus);
    this.noiseSource.start(now);

    // Fade in
    this.noiseGain.gain.setValueAtTime(0, now);
    this.noiseGain.gain.linearRampToValueAtTime(cfg.textureVolume * 0.06, now + 6);

    this.isRunning = true;
    this.startTick();
  }

  stop(fadeMs = 3000): void {
    if (!this.isRunning) return;
    this.stopTick();
    const now = this.ctx.currentTime;
    const fadeS = fadeMs / 1000;

    this.outputGain.gain.cancelScheduledValues(now);
    this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
    this.outputGain.gain.linearRampToValueAtTime(0.0001, now + fadeS);

    if (this.padSynth)  this.padSynth.releaseAll(Tone.now());
    if (this.padSynthB) this.padSynthB.releaseAll(Tone.now());

    setTimeout(() => this.teardown(), fadeMs + 200);
    this.isRunning = false;
  }

  destroy(): void {
    this.teardown();
  }

  // ── Private ──────────────────────────────────────────────────────

  private startTick(): void {
    this.tickHandle = window.setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private stopTick(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tick(): void {
    if (!this.isRunning || !this.mood) return;
    const time = this.ctx.currentTime;

    // Drift pad lowpass filter — very slow Perlin sweep
    if (this.padFilterMod && this.padFilter) {
      const f = Math.max(120, this.padFilterMod.getValue(time));
      this.padFilter.frequency.setTargetAtTime(f, Tone.now(), 0.5);
    }

    // Drift noise texture filter independently
    if (this.noiseFilterMod && this.noiseFilter) {
      const f = Math.max(80, this.noiseFilterMod.getValue(time));
      this.noiseFilter.frequency.setTargetAtTime(f, time, 0.3);
    }

    // Advance arp scheduler
    if (this.scheduler && this.arpSynth) {
      this.advanceArp(time);
    }
  }

  private advanceArp(time: number): void {
    const s = this.scheduler!;
    const beatDuration = 60 / s.bpm;
    const velocity = this.arpVelocityMod?.getNormalized(time) ?? 0.6;

    while (time >= s.lastBeat + beatDuration) {
      s.lastBeat += beatDuration;
      const note = s.pattern[s.beatIndex % s.pattern.length];
      s.beatIndex++;

      if (note !== null) {
        const toneNote = Tone.Frequency(note, 'midi').toNote();
        this.arpSynth!.triggerAttackRelease(toneNote, '8n', Tone.now(), velocity);
      }

      // Chord change every N beats
      if (s.beatIndex % CHORD_CHANGE_BEATS === 0 && this.padSynth && this.mood) {
        this.cycleChord();
      }

      // Kick every 4 beats (four-on-floor variant)
      if (this.beatSynth && s.beatIndex % 4 === 0) {
        this.beatSynth.triggerAttackRelease('C1', '8n', Tone.now());
      }
    }
  }

  // Which pad synth is currently the active (foreground) one
  private padActive: 'A' | 'B' = 'A';

  private cycleChord(): void {
    if (!this.mood || !this.padSynth || !this.padSynthB || !this.isRunning) return;
    const cfg = MOOD_SYNTH_CONFIGS[this.mood];
    const scaleName = cfg.scales[Math.floor(Math.random() * cfg.scales.length)];
    const scale     = SCALES[scaleName];
    const root      = randomRoot();
    this.scaleNotes = getScaleNotes(root, scale, 3);
    this.chordNotes = this.buildChord(root, scale);

    // The inactive synth becomes the new chord; the active one releases.
    // Both play simultaneously during the crossfade window — no silent gap.
    const incoming = this.padActive === 'A' ? this.padSynthB : this.padSynth;
    const outgoing = this.padActive === 'A' ? this.padSynth  : this.padSynthB;

    incoming.triggerAttack(this.chordNotes, Tone.now());
    outgoing.releaseAll(Tone.now());

    this.padActive = this.padActive === 'A' ? 'B' : 'A';
  }

  private buildChord(root: number, scale: readonly number[]): string[] {
    // Pass MIDI note numbers directly — avoids freq↔note rounding errors
    const midi = [
      root,
      root + scale[Math.min(2, scale.length - 1)],
      root + scale[Math.min(4, scale.length - 1)],
      root + 12,
    ];
    return midi.map(n => Tone.Frequency(n, 'midi').toNote());
  }

  private buildArpPattern(scaleNotes: number[], density: number): (number | null)[] {
    const len = 16;
    const pattern: (number | null)[] = new Array(len).fill(null);
    const steps = Math.round(len * density);
    const positions = Array.from({ length: len }, (_, i) => i)
      .sort(() => Math.random() - 0.5)
      .slice(0, steps);
    for (const pos of positions) {
      pattern[pos] = scaleNotes[Math.floor(Math.random() * Math.min(8, scaleNotes.length))];
    }
    return pattern;
  }

  private buildBrownNoise(): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length     = sampleRate * 12; // 12s loop, prime-ish
    const buffer     = this.ctx.createBuffer(2, length, sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buffer.getChannelData(c);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buffer;
  }

  private buildReverb(wetMix: number): {
    reverbNode: ConvolverNode;
    reverbGain: GainNode;
    dryGain: GainNode;
  } {
    // Synthetic IR: exponentially-decaying white noise
    const sr  = this.ctx.sampleRate;
    const dur = 2.8;
    const ir  = this.ctx.createBuffer(2, Math.floor(sr * dur), sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      }
    }

    const reverbNode = this.ctx.createConvolver();
    reverbNode.buffer = ir;

    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = wetMix;
    reverbNode.connect(reverbGain);

    const dryGain = this.ctx.createGain();
    dryGain.gain.value = 1 - wetMix * 0.5;

    return { reverbNode, reverbGain, dryGain };
  }

  private teardown(): void {
    this.stopTick();

    if (this.padSynth)  { try { this.padSynth.dispose();  } catch {} this.padSynth  = null; }
    if (this.padSynthB) { try { this.padSynthB.dispose(); } catch {} this.padSynthB = null; }
    if (this.padFilter) { try { this.padFilter.dispose(); } catch {} this.padFilter  = null; }
    if (this.arpSynth)  { try { this.arpSynth.dispose();  } catch {} this.arpSynth  = null; }
    if (this.beatSynth) { try { this.beatSynth.dispose(); } catch {} this.beatSynth = null; }
    if (this.toneCtx)   { try { this.toneCtx.dispose();   } catch {} this.toneCtx   = null; }

    try { this.noiseSource?.stop(); } catch {}
    try { this.noiseSource?.disconnect(); } catch {}
    try { this.noiseFilter?.disconnect(); } catch {}
    try { this.noiseGain?.disconnect();   } catch {}
    try { this.reverbNode?.disconnect();  } catch {}
    try { this.reverbGain?.disconnect();  } catch {}
    try { this.dryGain?.disconnect();     } catch {}

    this.noiseSource = this.noiseFilter = this.noiseGain = null;
    this.reverbNode = this.reverbGain = this.dryGain = null;
    this.scheduler = null;
    this.isRunning = false;
  }
}
