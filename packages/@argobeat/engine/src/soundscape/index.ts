/**
 * @argobeat/engine — Soundscape Module
 *
 * Re-exports the public API for file-backed music, ambient recordings,
 * and session-level content management with crossfading.
 *
 * @module @argobeat/engine/soundscape
 */

// Manager — dual-instance crossfading for long sessions
export { SoundscapeManager } from './manager.js';
export { FileMusicManager } from './music-manager.js';

// Audio loader — fetch, decode, cache, and loop real audio files
export { loadAudioBuffer, createLoopingSource, preloadAudioFiles, clearAudioCache } from './audio-loader.js';
export type { AudioFileEntry } from './audio-loader.js';

// Audio manifest — track listings and URL helpers
export { SOUNDSCAPE_TRACKS, MUSIC_TRACKS, getSoundscapeUrl, getMusicUrl, getRandomSoundscapeTrack, getRandomMusicTrack, SOUNDSCAPE_BASE_URL, MUSIC_BASE_URL } from './audio-manifest.js';
export type { AudioTrack } from './audio-manifest.js';
