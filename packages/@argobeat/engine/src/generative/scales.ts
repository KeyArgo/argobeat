/** Musical scale definitions and MIDI helpers */

export const SCALES = {
  dorian:      [0,2,3,5,7,9,10],
  pentatonic:  [0,2,4,7,9],
  minor:       [0,2,3,5,7,8,10],
  major:       [0,2,4,5,7,9,11],
  lydian:      [0,2,4,6,7,9,11],
  phrygian:    [0,1,3,5,7,8,10],
} as const;

export type ScaleName = keyof typeof SCALES;

export function getScaleNotes(root: number, scale: readonly number[], octaves = 2): number[] {
  const notes: number[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const interval of scale) {
      notes.push(root + oct * 12 + interval);
    }
  }
  return notes;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Pick a mood-appropriate root note (MIDI, octave 3–4) */
export function randomRoot(random: () => number = Math.random): number {
  const roots = [48, 50, 51, 53, 55, 56, 58, 60];
  return roots[Math.floor(random() * roots.length)];
}
