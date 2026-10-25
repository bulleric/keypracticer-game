/**
 * Colours and helpers from Keypracticer's reel design (light theme), ported from
 * keypracticer-content-gen remotion/src/versions/v4 (theme/global.css,
 * utils/intervals.ts, utils/staffPositions.ts, utils/geometry.ts).
 */

export const K = {
  bg: '#F5F5F0',
  panel: '#E8E8E2',
  line: '#B9B9B2',
  fret: '#C9C9C2',
  inlay: '#D4D4CD',
  text: '#16181D',
  muted: '#73767E',
  root: '#E8452C',
  good: '#1E9E6A',
  bad: '#E8452C',
};

const NOTE_COLORS: Record<string, string> = {
  root: '#E8452C',
  '2': '#D23F7A',
  '3': '#C99200',
  '4': '#1E9E6A',
  '5': '#2B6FD6',
  '6': '#0F96A6',
  '7': '#8B4FD6',
};

const FAMILY: Record<string, string> = {
  R: 'root', '1': 'root',
  b2: '2', '2': '2', '#2': '2',
  b3: '3', '3': '3',
  '4': '4',
  '#4': '5', b5: '5', '5': '5',
  '#5': '6', b6: '6', '6': '6', bb7: '6',
  b7: '7', '7': '7',
};

export function intervalColor(interval: string): string {
  return NOTE_COLORS[FAMILY[interval] ?? 'root'];
}

/** Strip layout: left and right edge of the lanes, the playhead, one note per 100 px. */
export const SAFE_X0 = 80;
export const SAFE_X1 = 880;
export const PLAY_X = 320;
export const CELL = 100;

// ---- staff
const IS_ACCIDENTAL = [false, true, false, true, false, false, true, false, true, false, true, false];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** Diatonic staff step of a sounding guitar pitch (written an octave up). E4 = 30 = bottom line. */
export function staffPos(midi: number): { step: number; isAccidental: boolean } {
  const written = midi + 12;
  const octave = Math.floor(written / 12) - 1;
  const semi = written % 12;
  return { step: LETTER_INDEX[NAMES[semi][0]] + octave * 7, isAccidental: IS_ACCIDENTAL[semi] };
}

export const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34];
export const FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31];
const MAJOR_KEY_SIGS: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 5: -1, 10: -2, 3: -3, 8: -4, 1: -5 };

export function keySigAccidentals(rootPc: number, minor: boolean): { count: number; type: 'sharp' | 'flat' } {
  const majorPc = minor ? (rootPc + 3) % 12 : rootPc;
  const n = MAJOR_KEY_SIGS[majorPc] ?? 0;
  return { count: Math.abs(n), type: n >= 0 ? 'sharp' : 'flat' };
}

const SHARP_ORDER_PC = [5, 0, 7, 2, 9, 4, 11];
const FLAT_ORDER_PC = [11, 4, 9, 2, 7, 0, 5];

/** Pitch classes the key signature already covers (no accidental needed). */
export function keySigPitchClasses(rootPc: number, minor: boolean): Set<number> {
  const { count, type } = keySigAccidentals(rootPc, minor);
  const order = type === 'sharp' ? SHARP_ORDER_PC : FLAT_ORDER_PC;
  const delta = type === 'sharp' ? 1 : -1;
  return new Set(order.slice(0, count).map((pc) => (pc + delta + 12) % 12));
}
