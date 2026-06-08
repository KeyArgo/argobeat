/**
 * @module samples
 * @description Sample loader and manager for ArgoBeat drum and key samples.
 *
 * Loads CC0 audio samples from /audio/samples/ and caches them in memory.
 * Provides typed access to drum and key samples.
 */

/** Sample category */
export type SampleCategory = 'kick' | 'snare' | 'hihat' | 'piano' | 'epiano' | 'bass' | 'texture';

/** Loading state for a sample group */
export type SampleLoadState = 'idle' | 'loading' | 'loaded' | 'failed';

/** Sample file entry */
export interface SampleEntry {
  id: string;
  category: SampleCategory;
  name: string;
  path: string;
}

/** Drum samples (9 total) */
export const DRUM_SAMPLES: SampleEntry[] = [
  { id: 'kick-1', category: 'kick', name: 'Kick 1', path: '/audio/samples/kick-1.mp3' },
  { id: 'kick-2', category: 'kick', name: 'Kick 2', path: '/audio/samples/kick-2.mp3' },
  { id: 'kick-deep', category: 'kick', name: 'Kick Deep', path: '/audio/samples/kick-deep.mp3' },
  { id: 'snare-1', category: 'snare', name: 'Snare 1', path: '/audio/samples/snare-1.mp3' },
  { id: 'snare-2', category: 'snare', name: 'Snare 2', path: '/audio/samples/snare-2.mp3' },
  { id: 'snare-3', category: 'snare', name: 'Snare 3', path: '/audio/samples/snare-3.mp3' },
  { id: 'hihat-closed', category: 'hihat', name: 'Closed Hi-Hat', path: '/audio/samples/hihat-closed.mp3' },
  { id: 'hihat-open', category: 'hihat', name: 'Open Hi-Hat', path: '/audio/samples/hihat-open.mp3' },
];

/** Key samples (6 total) */
export const KEY_SAMPLES: SampleEntry[] = [
  { id: 'piano-c4', category: 'piano', name: 'Piano C4', path: '/audio/samples/piano-c4.mp3' },
  { id: 'piano-c5', category: 'piano', name: 'Piano C5', path: '/audio/samples/piano-c5.mp3' },
  { id: 'piano-bell-c3', category: 'piano', name: 'Piano Bell C3', path: '/audio/samples/piano-bell-c3.mp3' },
  { id: 'epiano-d', category: 'epiano', name: 'E-Piano D', path: '/audio/samples/epiano-d.mp3' },
  { id: 'bass-synth-c', category: 'bass', name: 'Bass Synth C', path: '/audio/samples/bass-synth-c.mp3' },
  { id: 'piano-ambient', category: 'piano', name: 'Piano Ambient', path: '/audio/samples/piano-ambient.mp3' },
];

/** Texture samples (vinyl, tape — for lo-fi atmosphere) */
export const TEXTURE_SAMPLES: SampleEntry[] = [
  { id: 'vinyl-crackle-1', category: 'texture', name: 'Vinyl Crackle 1', path: '/audio/samples/vinyl-crackle-1.mp3' },
  { id: 'vinyl-crackle-2', category: 'texture', name: 'Vinyl Crackle 2', path: '/audio/samples/vinyl-crackle-2.mp3' },
  { id: 'tape-noise', category: 'texture', name: 'Tape Noise', path: '/audio/samples/tape-noise.mp3' },
  { id: 'piano-lofi-stab', category: 'piano', name: 'Piano Lo-fi Stab', path: '/audio/samples/piano-lofi-stab.mp3' },
];

/** All samples */
export const ALL_SAMPLES = [...DRUM_SAMPLES, ...KEY_SAMPLES, ...TEXTURE_SAMPLES];

/** In-memory buffer cache */
let bufferCache = new Map<string, AudioBuffer>();

/** Load state tracking */
let _drumLoadState: SampleLoadState = 'idle';
let _textureLoadState: SampleLoadState = 'idle';

export function getDrumLoadState(): SampleLoadState { return _drumLoadState; }
export function getTextureLoadState(): SampleLoadState { return _textureLoadState; }

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

/**
 * Load a single audio buffer with retry logic.
 * Retries up to 3 times with exponential backoff.
 */
export async function loadSampleBuffer(
  ctx: AudioContext,
  sample: SampleEntry,
): Promise<AudioBuffer> {
  const key = sample.id;
  if (bufferCache.has(key)) {
    return bufferCache.get(key)!;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(sample.path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${sample.path}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      bufferCache.set(key, audioBuffer);
      return audioBuffer;
    } catch (err) {
      lastError = err as Error;
      console.warn(`[ArgoBeat] Sample ${sample.id} load attempt ${attempt}/${MAX_RETRIES} failed:`, (err as Error).message);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }

  console.error(`[ArgoBeat] FAILED to load sample ${sample.id} after ${MAX_RETRIES} attempts:`, lastError);
  throw lastError ?? new Error(`Failed to load ${sample.id}`);
}

/**
 * Preload all drum and key samples in parallel.
 * Returns a map of sample ID -> AudioBuffer.
 */
export async function preloadAllSamples(
  ctx: AudioContext,
): Promise<Map<string, AudioBuffer>> {
  const results = new Map<string, AudioBuffer>();

  await Promise.allSettled(
    ALL_SAMPLES.map(async (sample) => {
      try {
        const buffer = await loadSampleBuffer(ctx, sample);
        results.set(sample.id, buffer);
      } catch (err) {
        console.warn(`[ArgoBeat] Failed to preload sample ${sample.id}`);
      }
    }),
  );

  return results;
}

/**
 * Preload only drum samples (faster startup for patterns).
 * Now includes explicit state tracking and detailed logging.
 */
export async function preloadDrumSamples(
  ctx: AudioContext,
): Promise<Map<string, AudioBuffer>> {
  _drumLoadState = 'loading';
  const results = new Map<string, AudioBuffer>();
  let failures = 0;

  await Promise.allSettled(
    DRUM_SAMPLES.map(async (sample) => {
      try {
        const buffer = await loadSampleBuffer(ctx, sample);
        results.set(sample.id, buffer);
      } catch {
        failures++;
      }
    }),
  );

  if (results.size === 0) {
    _drumLoadState = 'failed';
    console.error(`[ArgoBeat] ⚠ ALL drum samples failed to load (${failures} failures). Drums will not play.`);
  } else {
    _drumLoadState = 'loaded';
    console.log(`[ArgoBeat] ✓ Loaded ${results.size}/${DRUM_SAMPLES.length} drum samples`);
    if (failures > 0) {
      console.warn(`[ArgoBeat] ${failures} drum sample(s) failed but others loaded OK`);
    }
  }

  return results;
}

/**
 * Preload texture samples (vinyl crackle, tape noise).
 */
export async function preloadTextureSamples(
  ctx: AudioContext,
): Promise<Map<string, AudioBuffer>> {
  _textureLoadState = 'loading';
  const results = new Map<string, AudioBuffer>();

  await Promise.allSettled(
    TEXTURE_SAMPLES.map(async (sample) => {
      try {
        const buffer = await loadSampleBuffer(ctx, sample);
        results.set(sample.id, buffer);
      } catch {
        // non-critical — vinyl/tape are atmosphere only
      }
    }),
  );

  _textureLoadState = results.size > 0 ? 'loaded' : 'failed';
  if (results.size > 0) {
    console.log(`[ArgoBeat] ✓ Loaded ${results.size}/${TEXTURE_SAMPLES.length} texture samples`);
  }

  return results;
}

/**
 * Get a random texture sample entry.
 */
export function getRandomTextureSample(): SampleEntry {
  return TEXTURE_SAMPLES[Math.floor(Math.random() * TEXTURE_SAMPLES.length)];
}

/**
 * Clear the buffer cache (for memory cleanup).
 */
export function clearSampleCache(): void {
  bufferCache.clear();
}

/**
 * Get a drum sample by category and a random variant.
 * Returns the sample entry (not the buffer).
 */
export function getRandomDrumSample(category: 'kick' | 'snare' | 'hihat'): SampleEntry {
  const samples = DRUM_SAMPLES.filter((s) => s.category === category);
  if (samples.length === 0) {
    throw new Error(`No samples found for category: ${category}`);
  }
  return samples[Math.floor(Math.random() * samples.length)];
}

/**
 * Get a closed hi-hat sample (filters out open hats).
 */
export function getRandomClosedHihat(): SampleEntry {
  const closedHats = DRUM_SAMPLES.filter((s) => s.category === 'hihat' && s.id.includes('closed'));
  if (closedHats.length === 0) {
    // Fallback to any hihat if no closed variant exists
    return getRandomDrumSample('hihat');
  }
  return closedHats[Math.floor(Math.random() * closedHats.length)];
}

/**
 * Get an open hi-hat sample (filters out closed hats).
 */
export function getRandomOpenHihat(): SampleEntry {
  const openHats = DRUM_SAMPLES.filter((s) => s.category === 'hihat' && s.id.includes('open'));
  if (openHats.length === 0) {
    // Fallback to any hihat if no open variant exists
    return getRandomDrumSample('hihat');
  }
  return openHats[Math.floor(Math.random() * openHats.length)];
}

/**
 * Get a key sample by category and a random variant.
 * Returns the sample entry (not the buffer).
 */
export function getRandomKeySample(category: 'piano' | 'epiano' | 'bass'): SampleEntry {
  const samples = KEY_SAMPLES.filter((s) => s.category === category);
  if (samples.length === 0) {
    throw new Error(`No samples found for category: ${category}`);
  }
  return samples[Math.floor(Math.random() * samples.length)];
}
