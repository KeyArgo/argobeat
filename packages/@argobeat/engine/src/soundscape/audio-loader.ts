/**
 * Audio file loader and cache for ArgoBeat soundscapes.
 *
 * Loads MP3 files, decodes them, caches the AudioBuffers,
 * and creates looping BufferSourceNodes for playback.
 */

/** Audio file manifest entry */
export interface AudioFileEntry {
  id: string;
  category: string;     // 'rain', 'ocean', 'forest', etc.
  name: string;         // display name
  url: string;          // relative URL to the MP3 file
  durationMs?: number;  // optional known duration
}

/** Decoded audio buffer cache (in-memory) */
const bufferCache = new Map<string, AudioBuffer>();
const MIN_LOOP_SECONDS = 1.0;

/**
 * Load and decode an audio file, returning cached result if available.
 */
export async function loadAudioBuffer(
  ctx: AudioContext,
  url: string,
): Promise<AudioBuffer> {
  if (bufferCache.has(url)) return bufferCache.get(url)!;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load audio: ${url} (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  bufferCache.set(url, audioBuffer);
  return audioBuffer;
}

interface SourceOptions {
  loop?: boolean;
  startOffset?: number;
}

/**
 * Create and start an AudioBufferSourceNode from a loaded buffer.
 * Returns the source node (started but not connected — caller wires it).
 */
export function createAudioSource(
  ctx: AudioContext,
  buffer: AudioBuffer,
  options: SourceOptions = {},
): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = options.loop ?? true;
  const loopRegion = source.loop ? findAudibleLoopRegion(buffer) : { start: 0, end: buffer.duration };
  source.loopStart = loopRegion.start;
  source.loopEnd = loopRegion.end;

  const offset = options.startOffset ?? (
    source.loop
      ? loopRegion.start + Math.random() * Math.max(loopRegion.end - loopRegion.start, MIN_LOOP_SECONDS)
      : 0
  );
  source.start(0, offset);
  return source;
}

/**
 * Estimate a stable per-file gain from RMS loudness.
 *
 * This is intentionally simpler than LUFS mastering, but it prevents wildly
 * loud catalog files from dominating quieter soundscapes in the browser engine.
 */
export function calculateRmsGain(
  buffer: AudioBuffer,
  targetDb: number,
  minGain = 0.2,
  maxGain = 1.6,
): number {
  const samples = buffer.getChannelData(0);
  if (!samples.length) return 1;

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  if (!Number.isFinite(rms) || rms <= 0) return 1;

  const currentDb = 20 * Math.log10(rms);
  const rawGain = 10 ** ((targetDb - currentDb) / 20);
  return Math.max(minGain, Math.min(maxGain, rawGain));
}

/**
 * Create a looping AudioBufferSourceNode from a loaded buffer.
 */
export function createLoopingSource(
  ctx: AudioContext,
  buffer: AudioBuffer,
  startOffset?: number,
): AudioBufferSourceNode {
  return createAudioSource(ctx, buffer, { loop: true, startOffset });
}

/**
 * Create a non-looping source. Soundscape playback uses this and crossfades
 * before the buffer end so MP3 loop seams do not become audible.
 */
export function createOneShotSource(
  ctx: AudioContext,
  buffer: AudioBuffer,
  startOffset = 0,
): AudioBufferSourceNode {
  return createAudioSource(ctx, buffer, { loop: false, startOffset });
}

function findAudibleLoopRegion(buffer: AudioBuffer): { start: number; end: number } {
  const samples = buffer.getChannelData(0);
  if (!samples.length) return { start: 0, end: buffer.duration };

  const sampleRate = buffer.sampleRate;
  const frameSize = Math.max(256, Math.floor(sampleRate * 0.05));
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }

  const threshold = Math.max(0.001, peak * 0.01);
  let first = 0;
  let last = samples.length - 1;

  for (let i = 0; i < samples.length; i += frameSize) {
    if (framePeak(samples, i, Math.min(samples.length, i + frameSize)) >= threshold) {
      first = i;
      break;
    }
  }

  for (let i = samples.length; i > 0; i -= frameSize) {
    const start = Math.max(0, i - frameSize);
    if (framePeak(samples, start, i) >= threshold) {
      last = i - 1;
      break;
    }
  }

  const pad = Math.floor(sampleRate * 0.08);
  first = Math.max(0, first - pad);
  last = Math.min(samples.length - 1, last + pad);

  if ((last - first) / sampleRate < MIN_LOOP_SECONDS) {
    return { start: 0, end: buffer.duration };
  }

  return {
    start: first / sampleRate,
    end: Math.max((last + 1) / sampleRate, first / sampleRate + MIN_LOOP_SECONDS),
  };
}

function framePeak(samples: Float32Array, start: number, end: number): number {
  let peak = 0;
  for (let i = start; i < end; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  return peak;
}

/**
 * Preload multiple audio files in parallel.
 */
export async function preloadAudioFiles(
  ctx: AudioContext,
  urls: string[],
): Promise<Map<string, AudioBuffer>> {
  const results = new Map<string, AudioBuffer>();
  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const buf = await loadAudioBuffer(ctx, url);
        results.set(url, buf);
      } catch (e) {
        console.warn(`[ArgoBeat] Failed to preload: ${url}`, e);
      }
    })
  );
  return results;
}

/** Clear the buffer cache (for memory management) */
export function clearAudioCache(): void {
  bufferCache.clear();
}
