/**
 * Audio file manifest — maps categories to available audio files.
 *
 * Files are stored in /audio/soundscapes/{category}/ and /audio/music/{mood}/
 */

import type { SoundscapeCategory, Mood } from '../types.js';

export type SoundscapeTimeOfDay = 'any' | 'dawn' | 'day' | 'dusk' | 'night';
export type SoundscapeStimulation = 'low' | 'medium' | 'high';

export interface AudioTrack {
  id: string;
  name: string;
  file: string;  // filename, relative subpath, or absolute /audio/... path
  description?: string;
  gainMultiplier?: number;
  timeOfDay?: SoundscapeTimeOfDay;
  stimulation?: SoundscapeStimulation;
  excludeMoods?: Mood[];
}

// Soundscape audio files per category
export const SOUNDSCAPE_TRACKS: Record<SoundscapeCategory, AudioTrack[]> = {
  rain: [
    {
      id: 'rain-noise',
      name: 'Steady Rain',
      file: 'rain-noise.mp3',
      description: 'Neutral steady rainfall with consistent masking and low eventfulness.',
      timeOfDay: 'any',
      stimulation: 'low',
    },
    {
      id: 'rain-spectacular',
      name: 'Wide Rain',
      file: 'rain-spectacular.mp3',
      description: 'Broader open-air rain bed with a little more motion and width.',
      timeOfDay: 'any',
      stimulation: 'medium',
    },
    {
      id: 'rain-thunderstorm',
      name: 'Thunderstorm Rain',
      file: 'thunderstorm-rain-loop.mp3',
      description: 'Rain bed with thunder cues and heavier transient energy.',
      timeOfDay: 'night',
      stimulation: 'high',
      excludeMoods: ['focus', 'deepWork'],
    },
    {
      id: 'rain-on-skylight',
      name: 'Rain on Skylight',
      file: 'rain-on-skylight.mp3',
      description: 'Interior rain texture with a glassy overhead quality.',
      timeOfDay: 'any',
      stimulation: 'low',
    },
  ],
  ocean: [
    {
      id: 'ocean-gentle-beach',
      name: 'Gentle Beach Waves',
      file: 'gentle-waves-beach.mp3',
      description: 'Soft shoreline wash with low arousal and minimal sharp detail.',
      gainMultiplier: 1.12,
      timeOfDay: 'day',
      stimulation: 'low',
    },
    {
      id: 'ocean-waves',
      name: 'Ocean Waves',
      file: 'ocean-waves.mp3',
      description: 'Classic rolling surf with moderate rhythmic motion.',
      timeOfDay: 'any',
      stimulation: 'medium',
    },
    {
      id: 'ocean-chill-coast',
      name: 'Chill Coast Birds',
      file: 'chill-coast-birds.mp3',
      description: 'Coastal wave bed with audible birds and brighter daytime detail.',
      gainMultiplier: 0.72,
      timeOfDay: 'day',
      stimulation: 'medium',
    },
    {
      id: 'ocean-zen-waves',
      name: 'Zen Ocean Waves',
      file: 'zen-ocean-waves.mp3',
      description: 'Calm, minimal wave rhythm with reduced transient sharpness.',
      timeOfDay: 'any',
      stimulation: 'low',
    },
  ],
  forest: [
    {
      id: 'forest-night-ambience',
      name: 'Forest Night',
      file: 'forest-night-ambience.mp3',
      description: 'Nocturnal forest bed with darker tone and sleepy night cues.',
      timeOfDay: 'night',
      stimulation: 'low',
      excludeMoods: ['focus', 'deepWork'],
    },
    {
      id: 'forest-birds-branches',
      name: 'Forest Birds',
      file: 'forest-birds-branches.mp3',
      description: 'Daytime woodland ambience with birds and branch detail.',
      gainMultiplier: 1.12,
      timeOfDay: 'day',
      stimulation: 'medium',
    },
    {
      id: 'forest-cicadas',
      name: 'Forest Night Cicadas',
      file: 'forest-night-cicadas.mp3',
      description: 'Explicit nighttime insect bed with persistent cicada texture.',
      timeOfDay: 'night',
      stimulation: 'medium',
      excludeMoods: ['focus', 'deepWork'],
    },
    {
      id: 'forest-night-crickets',
      name: 'Night Crickets',
      file: 'night-crickets.mp3',
      description: 'Focused night-cricket layer with strong nocturnal identity.',
      timeOfDay: 'night',
      stimulation: 'medium',
      excludeMoods: ['focus', 'deepWork'],
    },
    {
      id: 'forest-night-owls',
      name: 'Night Owls',
      file: 'forest-night-owls.mp3',
      description: 'Quiet nighttime forest with distant owl calls.',
      timeOfDay: 'night',
      stimulation: 'low',
      excludeMoods: ['focus', 'deepWork'],
    },
  ],
  cafe: [
    {
      id: 'cafe-ambience',
      name: 'Coffee Shop Ambience',
      file: 'coffee-shop-ambience.mp3',
      description: 'Balanced cafe bed with present but not aggressive social texture.',
      timeOfDay: 'day',
      stimulation: 'medium',
    },
    {
      id: 'cafe-northtown',
      name: 'Coffee Shop',
      file: 'coffee-shop-northtown.mp3',
      description: 'General cafe chatter and room tone with moderate stimulation.',
      timeOfDay: 'day',
      stimulation: 'medium',
    },
    {
      id: 'cafe-six-people',
      name: 'Small Cafe',
      file: 'coffee-shop-6people.mp3',
      description: 'Smaller room with lighter conversational density.',
      timeOfDay: 'day',
      stimulation: 'low',
    },
    {
      id: 'cafe-coffeehouse',
      name: 'Coffeehouse',
      file: 'coffeehouse-ambience.mp3',
      description: 'Broader coffeehouse atmosphere with more room energy than the small cafe layer.',
      timeOfDay: 'day',
      stimulation: 'medium',
    },
  ],
  fire: [
    {
      id: 'fire-fireplace',
      name: 'Inside Fireplace',
      file: 'inside-fireplace.mp3',
      description: 'Warm indoor fireplace bed, soft and low movement.',
      timeOfDay: 'night',
      stimulation: 'low',
    },
    {
      id: 'fire-crackling',
      name: 'Crackling Fire',
      file: 'crackling-fire.mp3',
      description: 'More active crackle texture with sharper transient pops.',
      timeOfDay: 'night',
      stimulation: 'medium',
    },
    {
      id: 'fire-crackling-wood',
      name: 'Fire Crackling Wood',
      file: 'fire-crackling-wood.mp3',
      description: 'Dense wood-fire sound with heavier crackle density.',
      timeOfDay: 'night',
      stimulation: 'medium',
    },
  ],
  space: [
    {
      id: 'space-cosmic-loop',
      name: 'Cosmic Ambient',
      file: 'cosmic-ambient-loop.mp3',
      description: 'Steady spacious sci-fi bed with restrained movement.',
      timeOfDay: 'night',
      stimulation: 'low',
    },
    {
      id: 'space-ambience',
      name: 'Space Ambience',
      file: 'space-ambience.mp3',
      description: 'Neutral synthetic drone with low-motion atmospheric wash.',
      timeOfDay: 'any',
      stimulation: 'low',
    },
    {
      id: 'space-dark-ambience',
      name: 'Dark Ambience',
      file: 'dark-ambience.mp3',
      description: 'Deeper, darker ambient texture for meditate and sleep moods.',
      timeOfDay: 'night',
      stimulation: 'low',
      excludeMoods: ['focus', 'deepWork'],
    },
    {
      id: 'space-deep-kyrie',
      name: 'Deep Space Kyrie',
      file: 'deep-space-kyrie.mp3',
      description: 'Choir-textured drone blended into a deep space atmosphere.',
      timeOfDay: 'any',
      stimulation: 'low',
    },
  ],
  stream: [
    {
      id: 'stream-gentle',
      name: 'Gentle Stream',
      file: 'gentle-stream.mp3',
      description: 'Soft steady water layer with low stimulation and good masking.',
      gainMultiplier: 1.08,
      timeOfDay: 'day',
      stimulation: 'low',
    },
    {
      id: 'stream-trickling',
      name: 'Trickling Stream',
      file: 'trickling-stream.mp3',
      description: 'Lighter higher-detail water texture with mild sparkle.',
      gainMultiplier: 0.82,
      timeOfDay: 'day',
      stimulation: 'medium',
    },
    {
      id: 'stream-moving',
      name: 'Moving Stream',
      file: 'moving-stream.mp3',
      description: 'Steady moving stream bed with broad, even water noise.',
      gainMultiplier: 1.02,
      timeOfDay: 'day',
      stimulation: 'low',
    },
    {
      id: 'stream-close',
      name: 'Stream Up Close',
      file: 'stream-up-close.mp3',
      description: 'Close-mic water presence with stronger detail and more attentional pull.',
      gainMultiplier: 1.22,
      timeOfDay: 'day',
      stimulation: 'medium',
    },
    {
      id: 'stream-creek',
      name: 'Creek',
      file: 'creek-loop.mp3',
      description: 'Outdoor creek loop with natural variation and light background detail.',
      timeOfDay: 'day',
      stimulation: 'low',
    },
  ],
  wind: [
    {
      id: 'wind-gentle',
      name: 'Gentle Breeze',
      file: 'gentle-breeze.mp3',
      description: 'Light outdoor breeze with low movement and no sharp gusts.',
      timeOfDay: 'day',
      stimulation: 'low',
    },
    {
      id: 'wind-soft',
      name: 'Soft Wind',
      file: 'soft-wind.mp3',
      description: 'Very mild wind layer suitable as a background texture.',
      timeOfDay: 'any',
      stimulation: 'low',
    },
    {
      id: 'wind-noise',
      name: 'Wind Noise',
      file: 'wind-noise.mp3',
      description: 'Raw wind noise with broadband masking character.',
      timeOfDay: 'any',
      stimulation: 'medium',
    },
    {
      id: 'wind-howling',
      name: 'Howling Wind',
      file: 'howling-wind.mp3',
      description: 'Stronger gusting wind with clear directional sweeps.',
      timeOfDay: 'night',
      stimulation: 'high',
      excludeMoods: ['focus', 'deepWork', 'meditate'],
    },
  ],
  thunder: [
    {
      id: 'thunder-straget',
      name: 'Thunder',
      file: 'thunder-straget.mp3',
      description: 'Explicit thunder event layer with strong transient stimulation.',
      timeOfDay: 'night',
      stimulation: 'high',
      excludeMoods: ['focus', 'deepWork'],
    },
    {
      id: 'thunder-rain',
      name: 'Thunder & Rain',
      file: 'thunder-rain.mp3',
      description: 'Combined thunder and rain bed for immersive storm atmosphere.',
      timeOfDay: 'night',
      stimulation: 'high',
      excludeMoods: ['focus', 'deepWork'],
    },
  ],
  gongs: [
    {
      id: 'gongs-garden',
      name: 'Gong Garden',
      file: 'gong-garden.mp3',
      description: 'Layered gong resonances with long decay and meditative spacing.',
      timeOfDay: 'any',
      stimulation: 'low',
      excludeMoods: ['focus', 'deepWork'],
    },
    {
      id: 'gongs-bowl-deep',
      name: 'Deep Singing Bowl',
      file: 'singing-bowl-deep.mp3',
      description: 'Low-frequency singing bowl strike with rich harmonic tail.',
      timeOfDay: 'any',
      stimulation: 'low',
      excludeMoods: ['focus', 'deepWork'],
    },
    {
      id: 'gongs-bowl-tibetan',
      name: 'Tibetan Singing Bowl',
      file: 'singing-bowl-tibetan.mp3',
      description: 'Classic Tibetan bowl with mid-frequency strike and clean resonance.',
      timeOfDay: 'any',
      stimulation: 'low',
      excludeMoods: ['focus', 'deepWork'],
    },
  ],
  jungle: [
    {
      id: 'jungle-frog-forest',
      name: 'Frog Forest',
      file: 'frog-forest.mp3',
      description: 'Lush tropical frog chorus with dense overlapping calls.',
      timeOfDay: 'night',
      stimulation: 'medium',
      excludeMoods: ['focus', 'deepWork'],
    },
    {
      id: 'jungle-night',
      name: 'Jungle Night',
      file: 'jungle-night.mp3',
      description: 'Rich nighttime jungle soundscape with layered insect and wildlife texture.',
      timeOfDay: 'night',
      stimulation: 'medium',
      excludeMoods: ['focus', 'deepWork'],
    },
  ],
};

const SHARED_MUSIC_LIBRARY: Record<string, AudioTrack> = {
  // Lo-fi / indie instrumental catalog
  'a-little-shade': { id: 'a-little-shade', name: 'A Little Shade', file: 'a-little-shade.mp3' },
  'all-the-way-sad': { id: 'all-the-way-sad', name: 'All the Way Sad', file: 'all-the-way-sad.mp3' },
  'autumn': { id: 'autumn', name: 'Autumn', file: 'autumn.mp3' },
  'busted-jazz': { id: 'busted-jazz', name: 'Busted Jazz', file: 'busted-jazz.mp3' },
  'cellar-door': { id: 'cellar-door', name: 'Cellar Door', file: 'cellar-door.mp3' },
  'clouds': { id: 'clouds', name: 'Clouds', file: 'clouds.mp3' },
  'creature-comforts': { id: 'creature-comforts', name: 'Creature Comforts', file: 'creature-comforts.mp3' },
  'everything-you-ever-dreamed': { id: 'everything-you-ever-dreamed', name: 'Everything You Ever Dreamed', file: 'everything-you-ever-dreamed.mp3' },
  'foggy-headed': { id: 'foggy-headed', name: 'Foggy Headed', file: 'foggy-headed.mp3' },
  'ghosts': { id: 'ghosts', name: 'Ghosts', file: 'ghosts.mp3' },
  'glad-stuck-inside': { id: 'glad-stuck-inside', name: 'Glad Stuck Inside', file: 'glad-stuck-inside.mp3' },
  'happy-little-off': { id: 'happy-little-off', name: 'Happy Little Off', file: 'happy-little-off.mp3' },
  'letting-go': { id: 'letting-go', name: 'Letting Go', file: 'letting-go.mp3' },
  'mixed-signals': { id: 'mixed-signals', name: 'Mixed Signals', file: 'mixed-signals.mp3' },
  'morning-coffee': { id: 'morning-coffee', name: 'Morning Coffee', file: 'morning-coffee.mp3' },
  'mundane': { id: 'mundane', name: 'Mundane', file: 'mundane.mp3' },
  'new-shoes': { id: 'new-shoes', name: 'New Shoes', file: 'new-shoes.mp3' },
  'not-it': { id: 'not-it', name: 'Not It', file: 'not-it.mp3' },
  'plants': { id: 'plants', name: 'Plants', file: 'plants.mp3' },
  'pretty-little-lies': { id: 'pretty-little-lies', name: 'Pretty Little Lies', file: 'pretty-little-lies.mp3' },
  'puppy-love': { id: 'puppy-love', name: 'Puppy Love', file: 'puppy-love.mp3' },
  'ramen': { id: 'ramen', name: 'Ramen', file: 'ramen.mp3' },
  'seasons-change': { id: 'seasons-change', name: 'Seasons Change', file: 'seasons-change.mp3' },
  'shut-up-or-shut-in': { id: 'shut-up-or-shut-in', name: 'Shut Up or Shut In', file: 'shut-up-or-shut-in.mp3' },
  'small-towns': { id: 'small-towns', name: 'Small Towns', file: 'small-towns.mp3' },
  'something-in-the-air': { id: 'something-in-the-air', name: 'Something in the Air', file: 'something-in-the-air.mp3' },
  'vintage': { id: 'vintage', name: 'Vintage', file: 'vintage.mp3' },
  'whatever': { id: 'whatever', name: 'Whatever', file: 'whatever.mp3' },
  'yesterday': { id: 'yesterday', name: 'Yesterday', file: 'yesterday.mp3' },
  'you-loved-me-once': { id: 'you-loved-me-once', name: 'You Loved Me Once', file: 'you-loved-me-once.mp3' },
  // Meditate / cosmic
  'agoraphobia': { id: 'agoraphobia', name: 'Agoraphobia', file: 'agoraphobia.mp3' },
  'anxiety': { id: 'anxiety', name: 'Anxiety', file: 'anxiety.mp3' },
  'boredom': { id: 'boredom', name: 'Boredom', file: 'boredom.mp3' },
  'deja-vu': { id: 'deja-vu', name: 'Déjà Vu', file: 'deja-vu.mp3' },
  'dreams': { id: 'dreams', name: 'Dreams', file: 'dreams.mp3' },
  'love': { id: 'love', name: 'Love', file: 'love.mp3' },
  'old-age': { id: 'old-age', name: 'Old Age', file: 'old-age.mp3' },
};

const CURATED_MUSIC_LIBRARY: Record<string, AudioTrack> = {
  ...SHARED_MUSIC_LIBRARY,
};

function moodPlaylist(trackIds: string[]): AudioTrack[] {
  return trackIds.map((id) => {
    const track = CURATED_MUSIC_LIBRARY[id];
    if (!track) throw new Error(`Unknown ArgoBeat music track: ${id}`);
    return track;
  });
}

// Music tracks organized by mood.
// focus: forward-motion lo-fi instrumentals
// deepWork: sustained-flow tracks with minimal distraction
// relax: softer tracks with emotional/natural energy
// meditate: minimal, drifting instrumentals
// sleep: low-arousal instrumental drift
export const MUSIC_TRACKS: Record<string, AudioTrack[]> = {
  focus: moodPlaylist([
    'morning-coffee', 'something-in-the-air', 'new-shoes', 'ramen',
    'small-towns', 'happy-little-off', 'mixed-signals', 'mundane',
    'seasons-change', 'yesterday', 'busted-jazz', 'puppy-love',
    'glad-stuck-inside', 'deja-vu', 'cellar-door', 'letting-go',
    'ghosts', 'love', 'clouds', 'foggy-headed',
  ]),
  deepWork: moodPlaylist([
    'mundane', 'mixed-signals', 'cellar-door', 'shut-up-or-shut-in',
    'ramen', 'something-in-the-air', 'glad-stuck-inside', 'anxiety',
    'busted-jazz', 'small-towns', 'ghosts', 'new-shoes',
    'morning-coffee', 'yesterday', 'seasons-change', 'deja-vu',
    'letting-go', 'happy-little-off', 'dreams', 'love', 'puppy-love',
  ]),
  relax: moodPlaylist([
    'seasons-change', 'letting-go', 'happy-little-off', 'puppy-love',
    'love', 'ghosts', 'morning-coffee', 'small-towns',
    'yesterday', 'deja-vu', 'dreams', 'new-shoes',
    'something-in-the-air', 'ramen', 'mundane', 'glad-stuck-inside',
    'busted-jazz', 'mixed-signals', 'cellar-door', 'anxiety',
    'all-the-way-sad', 'autumn', 'clouds', 'plants',
  ]),
  meditate: moodPlaylist([
    'agoraphobia', 'boredom', 'old-age', 'anxiety', 'dreams', 'love',
  ]),
  sleep: moodPlaylist([
    'agoraphobia', 'dreams', 'old-age', 'love', 'boredom',
    'all-the-way-sad', 'letting-go', 'something-in-the-air',
  ]),
};

/** Base URL for soundscape audio files (relative to web root) */
export const SOUNDSCAPE_BASE_URL = '/audio/soundscapes';

/** Base URL for music audio files (relative to web root) */
export const MUSIC_BASE_URL = '/audio/music';

/** Get the full URL for a soundscape track */
export function getSoundscapeUrl(category: SoundscapeCategory, filename: string): string {
  return `${SOUNDSCAPE_BASE_URL}/${category}/${filename}`;
}

/** Get the full URL for a music track */
export function getMusicUrl(mood: string, filename: string): string {
  if (filename.startsWith('/')) {
    return filename;
  }
  if (filename.includes('/')) {
    return `${MUSIC_BASE_URL}/${filename}`;
  }
  return `${MUSIC_BASE_URL}/${mood}/${filename}`;
}

/** Get a random soundscape track for a category */
export function getRandomSoundscapeTrack(category: SoundscapeCategory): AudioTrack | null {
  const tracks = SOUNDSCAPE_TRACKS[category];
  if (!tracks || tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)];
}

export function getSoundscapeTracksForMood(category: SoundscapeCategory, mood: Mood | null): AudioTrack[] {
  const tracks = SOUNDSCAPE_TRACKS[category] ?? [];
  if (!mood) return tracks;

  const filtered = tracks.filter((track) => !track.excludeMoods?.includes(mood));
  return filtered.length > 0 ? filtered : tracks;
}

function getCurrentTimeOfDay(date = new Date()): SoundscapeTimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

function stimulationRank(level: SoundscapeStimulation): number {
  switch (level) {
    case 'low':
      return 0;
    case 'medium':
      return 1;
    case 'high':
      return 2;
  }
}

function getMoodStimulationCeiling(mood: Mood | null): SoundscapeStimulation | null {
  switch (mood) {
    case 'focus':
      return 'medium';
    case 'deepWork':
      return 'medium';
    case 'relax':
      return 'low';
    case 'meditate':
      return 'low';
    case 'sleep':
      return 'low';
    default:
      return null;
  }
}

function getPreferredTimesForMood(mood: Mood | null): SoundscapeTimeOfDay[] | null {
  switch (mood) {
    case 'focus':
      return ['day', 'dawn', 'any'];
    case 'deepWork':
      return ['day', 'dawn', 'dusk', 'any'];
    case 'relax':
      return ['dusk', 'day', 'night', 'any'];
    case 'meditate':
      return ['dawn', 'dusk', 'night', 'any'];
    case 'sleep':
      return ['night', 'dusk', 'any'];
    default:
      return null;
  }
}

export function getSoundscapeTracksForContext(
  category: SoundscapeCategory,
  mood: Mood | null,
  date = new Date(),
): AudioTrack[] {
  const moodFiltered = getSoundscapeTracksForMood(category, mood);
  const timeOfDay = getCurrentTimeOfDay(date);
  const preferredTimes = getPreferredTimesForMood(mood);
  const stimulationCeiling = getMoodStimulationCeiling(mood);

  const timeMatched = preferredTimes
    ? moodFiltered.filter((track) => preferredTimes.includes(track.timeOfDay ?? 'any'))
    : moodFiltered;

  const contextMatched = timeMatched.filter((track) => {
    const trackTime = track.timeOfDay ?? 'any';
    const trackStimulation = track.stimulation ?? 'medium';
    const withinTime = trackTime === 'any' || trackTime === timeOfDay;
    const withinStimulus = stimulationCeiling
      ? stimulationRank(trackStimulation) <= stimulationRank(stimulationCeiling)
      : true;
    return withinTime && withinStimulus;
  });

  if (contextMatched.length > 0) return contextMatched;

  const stimulusMatched = timeMatched.filter((track) => {
    const trackStimulation = track.stimulation ?? 'medium';
    return stimulationCeiling
      ? stimulationRank(trackStimulation) <= stimulationRank(stimulationCeiling)
      : true;
  });

  if (stimulusMatched.length > 0) return stimulusMatched;
  if (timeMatched.length > 0) return timeMatched;
  return moodFiltered;
}

/** Get a random music track for a mood */
export function getRandomMusicTrack(mood: string): AudioTrack | null {
  const tracks = MUSIC_TRACKS[mood];
  if (!tracks || tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)];
}
