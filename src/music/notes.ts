/** Note math: strings, frets, MIDI numbers, names and frequencies. */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NoteName = (typeof NOTE_NAMES)[number];

export const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Natural = (typeof NATURALS)[number];

/** The musical alphabet as guitarists learn it, starting on A. */
export const ALPHABET: Natural[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** String number (1 = high e, 6 = low E) to open-string MIDI note in standard tuning. */
export const STANDARD_TUNING: Record<StringNumber, number> = {
  6: 40, // E2
  5: 45, // A2
  4: 50, // D3
  3: 55, // G3
  2: 59, // B3
  1: 64, // E4
};

export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;
export const STRINGS_LOW_TO_HIGH: StringNumber[] = [6, 5, 4, 3, 2, 1];

export const STRING_NAMES: Record<StringNumber, string> = {
  6: 'low E',
  5: 'A',
  4: 'D',
  3: 'G',
  2: 'B',
  1: 'high e',
};

export const MAX_FRET = 12;
export const DOT_FRETS = [3, 5, 7, 9, 12];

export function midiAt(string: StringNumber, fret: number): number {
  return STANDARD_TUNING[string] + fret;
}

export function noteName(midi: number): NoteName {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

export function octave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** "G3", "C#4" */
export function noteLabel(midi: number): string {
  return `${noteName(midi)}${octave(midi)}`;
}

export function noteAt(string: StringNumber, fret: number): NoteName {
  return noteName(midiAt(string, fret));
}

export function isNatural(name: string): name is Natural {
  return (NATURALS as readonly string[]).includes(name);
}

export function pitchClass(name: NoteName): number {
  return NOTE_NAMES.indexOf(name);
}

/** All frets on a string (inside the range) that sound the given note name. */
export function fretsForNote(
  string: StringNumber,
  name: NoteName,
  minFret = 0,
  maxFret = MAX_FRET,
): number[] {
  const out: number[] = [];
  for (let f = minFret; f <= maxFret; f++) if (noteAt(string, f) === name) out.push(f);
  return out;
}

export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Fractional MIDI number for a frequency. */
export function frequencyToMidiFloat(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export interface DetectedNote {
  midi: number;
  name: NoteName;
  octave: number;
  /** -50..50 cents away from the nearest note. */
  cents: number;
  frequency: number;
}

export function describeFrequency(freq: number, a4 = 440): DetectedNote {
  const f = frequencyToMidiFloat(freq, a4);
  const midi = Math.round(f);
  return {
    midi,
    name: noteName(midi),
    octave: octave(midi),
    cents: Math.round((f - midi) * 100),
    frequency: freq,
  };
}

export function nextNatural(n: Natural, step = 1): Natural {
  const i = ALPHABET.indexOf(n);
  return ALPHABET[(((i + step) % 7) + 7) % 7];
}

/** Next chromatic note up (B -> C, E -> F, F -> F#). */
export function nextSemitone(n: NoteName, step = 1): NoteName {
  return NOTE_NAMES[(((pitchClass(n) + step) % 12) + 12) % 12];
}

export function stringLabel(s: StringNumber, style: 'name' | 'number'): string {
  if (style === 'number') return `string ${s}`;
  return `the ${STRING_NAMES[s]} string`;
}

/** Spoken form: "C sharp" instead of "C#". */
export function spokenNote(n: NoteName): string {
  return n.length === 2 ? `${n[0]} sharp` : n;
}
