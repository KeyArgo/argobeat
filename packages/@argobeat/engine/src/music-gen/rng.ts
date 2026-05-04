/**
 * @module rng
 * @description Seeded deterministic PRNG using the Mulberry32 algorithm.
 *
 * Every random decision in the generative music system flows from a single
 * integer seed. Given the same seed, the identical sequence of random values
 * is produced, which means:
 *   - Same seed  =>  same session (deterministic replay)
 *   - Different seed  =>  different session
 *
 * Mulberry32 is a fast 32-bit generator with excellent statistical properties
 * for non-cryptographic use. Period: 2^32.
 */

/**
 * A seedable, deterministic pseudo-random number generator.
 *
 * @example
 * ```ts
 * const rng = new SeededRNG(42);
 * rng.next();           // always the same float for seed 42
 * rng.intRange(1, 6);   // deterministic die roll
 * rng.pick(['A', 'B']); // deterministic pick
 * ```
 */
export class SeededRNG {
  /** Internal 32-bit state (Mulberry32). */
  private state: number;

  /**
   * Create a new PRNG instance.
   * @param seed - Any integer. Truncated to 32 bits via `| 0`.
   */
  constructor(seed: number) {
    this.state = seed | 0;
  }

  // ---------------------------------------------------------------------------
  // Core generator
  // ---------------------------------------------------------------------------

  /**
   * Return the next pseudo-random float in [0, 1).
   *
   * This is the primitive all other helpers build on. The Mulberry32 mixing
   * steps ensure good avalanche properties even for sequential seeds.
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------------------
  // Convenience helpers
  // ---------------------------------------------------------------------------

  /**
   * Return a random integer in [min, max] (inclusive on both ends).
   * @param min - Lower bound (integer).
   * @param max - Upper bound (integer).
   */
  intRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * Return a random float in [min, max).
   * @param min - Lower bound.
   * @param max - Upper bound (exclusive).
   */
  floatRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Pick a uniformly random element from an array.
   * @param arr - Non-empty array of items.
   * @returns A single element chosen at random.
   */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * Pick an element from `items` using a parallel `weights` array.
   *
   * Higher weight = higher probability. Weights do **not** need to sum to 1;
   * they are normalised internally.
   *
   * @param items   - Array of candidates.
   * @param weights - Parallel array of non-negative weights.
   * @returns The chosen item.
   *
   * @example
   * ```ts
   * // 'A' is 3x more likely than 'B'
   * rng.pickWeighted(['A', 'B'], [3, 1]);
   * ```
   */
  pickWeighted<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /**
   * Return a Gaussian-distributed random integer in [min, max].
   * Uses Box-Muller transform. The distribution peaks at the center of the range.
   * @param min - Lower bound (integer).
   * @param max - Upper bound (integer).
   */
  gaussian(min: number, max: number): number {
    const mean = (min + max) / 2;
    const sigma = (max - min) / 6; // 3σ covers full range
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const value = mean + z * sigma;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  /**
   * Create a new independent PRNG derived from this one.
   *
   * Useful for isolating subsystems (e.g. melody vs rhythm) so that changes
   * in one stream don't shift the other.
   */
  fork(): SeededRNG {
    return new SeededRNG(this.intRange(0, 0x7fffffff));
  }

  /**
   * Shuffle an array **in-place** using the Fisher-Yates algorithm.
   *
   * Returns the same array reference for convenience chaining.
   *
   * @param arr - The array to shuffle.
   * @returns The shuffled array (same reference).
   */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
