/**
 * Simplex-noise Modulation System
 *
 * Provides smooth, organic, non-repeating parameter drift for synthesis.
 * Ported from FocusMusic (MIT) with minor adaptations for ArgoBeat.
 */

// Minimal seeded simplex noise (no external dep).
// Sufficient for slow-moving audio parameter modulation.
function createNoise2D(random: () => number = Math.random) {
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  const G2 = (3 - Math.sqrt(3)) / 6;
  const F2 = 0.5 * (Math.sqrt(3) - 1);

  function dot(g: [number, number], x: number, y: number) {
    return g[0] * x + g[1] * y;
  }
  const grad3: [number, number][] = [
    [1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],
    [0,1],[0,-1],[0,1],[0,-1],
  ];

  return function noise(xin: number, yin: number): number {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0*t0*dot(grad3[gi0], x0, y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1*t1*dot(grad3[gi1], x1, y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2*t2*dot(grad3[gi2], x2, y2); }
    return 70 * (n0 + n1 + n2);
  };
}

export interface ModulatorConfig {
  base: number;
  range: number;
  /** Cycles per second */
  speed: number;
  seed?: number;
}

export class Modulator {
  private noise: ReturnType<typeof createNoise2D>;
  private config: ModulatorConfig;
  private offset: number;

  constructor(config: ModulatorConfig) {
    this.config = { ...config };
    this.noise = createNoise2D(config.seed !== undefined
      ? (() => { let s = config.seed!; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })()
      : Math.random);
    this.offset = Math.random() * 1000;
  }

  getValue(time: number): number {
    const n = this.noise(time * this.config.speed, this.offset);
    return this.config.base + n * this.config.range;
  }

  getNormalized(time: number): number {
    return (this.getValue(time) - (this.config.base - this.config.range)) /
           (2 * this.config.range);
  }

  setBase(base: number) { this.config.base = base; }
  setRange(range: number) { this.config.range = range; }
}

export const ModPresets = {
  /** ~100s cycle — chord roots, key drift */
  glacial: (base: number, range: number): ModulatorConfig => ({ base, range, speed: 0.01 }),
  /** ~20s cycle — filter sweeps */
  slow:    (base: number, range: number): ModulatorConfig => ({ base, range, speed: 0.05 }),
  /** ~5s cycle — velocity, expression */
  medium:  (base: number, range: number): ModulatorConfig => ({ base, range, speed: 0.2 }),
  /** ~1.25s cycle — subtle vibrato */
  fast:    (base: number, range: number): ModulatorConfig => ({ base, range, speed: 0.8 }),
};
