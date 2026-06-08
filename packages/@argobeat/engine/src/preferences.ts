/**
 * @module preferences
 * User preference system for ArgoBeat — thumbs up/down feedback with
 * adaptive generation weights.
 *
 * Key rules:
 * - Learning threshold: 10 thumbs UP before preferences influence generation
 * - Never eliminate categories: weights range 0.5x to 2.0x (never 0x)
 * - localStorage-based, no server required
 */

// =============================================================================
// Types
// =============================================================================

export interface UserPreferenceProfile {
  version: string;
  createdAt: number;
  updatedAt: number;
  feedbackCount: { thumbsUp: number; thumbsDown: number };
  trackRatings: TrackRating[];
  preferences?: LearnedPreferences;
}

export interface TrackRating {
  id: string;
  mood: string;
  rating: 'up' | 'down';
  timestamp: number;
  metadata?: TrackMetadata;
}

export interface TrackMetadata {
  tempo: number;
  chordProgression: string;
  seed: number;
}

export interface LearnedPreferences {
  learningThresholdMet: boolean;
  moodWeights: Record<string, number>;
  tempoPreference: number;
  timbralWarmth: number;
}

export interface GenerationWeights {
  moodWeights: Record<string, number>;
  tempoPreference: number;
  timbralWarmth: number;
}

// =============================================================================
// PreferenceManager
// =============================================================================

export class PreferenceManager {
  private static readonly STORAGE_KEY = 'argobeat-user-preferences';
  private static readonly LEARNING_THRESHOLD = 10;
  private static readonly VERSION = '2.0';

  loadProfile(): UserPreferenceProfile {
    if (typeof localStorage === 'undefined') return this.createBlank();
    const stored = localStorage.getItem(PreferenceManager.STORAGE_KEY);
    if (!stored) return this.createBlank();
    try {
      return JSON.parse(stored) as UserPreferenceProfile;
    } catch {
      return this.createBlank();
    }
  }

  saveProfile(profile: UserPreferenceProfile): void {
    if (typeof localStorage === 'undefined') return;
    profile.updatedAt = Date.now();
    localStorage.setItem(PreferenceManager.STORAGE_KEY, JSON.stringify(profile));
  }

  addRating(trackId: string, mood: string, rating: 'up' | 'down', metadata?: TrackMetadata): void {
    const profile = this.loadProfile();
    profile.trackRatings.push({
      id: trackId,
      mood,
      rating,
      timestamp: Date.now(),
      metadata,
    });

    if (rating === 'up') profile.feedbackCount.thumbsUp++;
    else profile.feedbackCount.thumbsDown++;

    // Recalculate preferences if threshold met
    if (profile.feedbackCount.thumbsUp >= PreferenceManager.LEARNING_THRESHOLD) {
      profile.preferences = this.calculatePreferences(profile);
    }

    this.saveProfile(profile);
  }

  getLearningProgress(): { current: number; target: number; thresholdMet: boolean } {
    const profile = this.loadProfile();
    return {
      current: profile.feedbackCount.thumbsUp,
      target: PreferenceManager.LEARNING_THRESHOLD,
      thresholdMet: profile.feedbackCount.thumbsUp >= PreferenceManager.LEARNING_THRESHOLD,
    };
  }

  getGenerationWeights(): GenerationWeights | null {
    const profile = this.loadProfile();
    if (!profile.preferences?.learningThresholdMet) return null;
    return {
      moodWeights: profile.preferences.moodWeights,
      tempoPreference: profile.preferences.tempoPreference,
      timbralWarmth: profile.preferences.timbralWarmth,
    };
  }

  reset(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(PreferenceManager.STORAGE_KEY);
  }

  private createBlank(): UserPreferenceProfile {
    return {
      version: PreferenceManager.VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      feedbackCount: { thumbsUp: 0, thumbsDown: 0 },
      trackRatings: [],
    };
  }

  private calculatePreferences(profile: UserPreferenceProfile): LearnedPreferences {
    const upRatings = profile.trackRatings.filter(r => r.rating === 'up');

    // Mood weights (0.5 to 2.0, never 0)
    const moodCounts: Record<string, number> = {};
    for (const r of upRatings) {
      moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1;
    }
    const moodKeys = Object.keys(moodCounts);
    const avgCount = moodKeys.length > 0
      ? moodKeys.reduce((sum, k) => sum + moodCounts[k], 0) / moodKeys.length
      : 1;

    const moodWeights: Record<string, number> = {};
    for (const [mood, count] of Object.entries(moodCounts)) {
      moodWeights[mood] = Math.max(0.5, Math.min(2.0, 0.5 + (count / avgCount) * 0.75));
    }

    // Tempo preference from metadata
    const tempos = upRatings
      .filter(r => r.metadata?.tempo)
      .map(r => r.metadata!.tempo);
    const avgTempo = tempos.length > 0
      ? tempos.reduce((a, b) => a + b, 0) / tempos.length
      : 75;
    const tempoPreference = Math.max(-2, Math.min(2, (avgTempo - 75) / 15));

    return {
      learningThresholdMet: true,
      moodWeights,
      tempoPreference,
      timbralWarmth: 0, // Refined as more metadata is collected
    };
  }
}
