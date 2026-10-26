/**
 * The coach: one sentence and one fix for the moments people get stuck.
 * Pure functions so they are easy to test.
 */
import { noteName } from '../music/notes';

const STRING: Record<number, string> = { 1: 'high e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'low E' };
const FINGER = ['index', 'middle', 'ring', 'pinky'];

export interface Target {
  midi: number;
  string: number;
  fret: number;
}

export function stringName(s: number): string {
  return STRING[s] ?? `string ${s}`;
}

/** Where the target is, and which finger to use if we know the box's lowest fret. */
export function whereIs(t: Target, boxLowFret?: number): string {
  const base = t.fret === 0 ? `Open ${stringName(t.string)} string` : `${cap(stringName(t.string))} string, fret ${t.fret}`;
  if (boxLowFret === undefined || t.fret === 0) return base;
  const f = Math.max(0, Math.min(3, t.fret - Math.max(1, boxLowFret)));
  return `${base}, ${FINGER[f]} finger`;
}

/** What went wrong with a wrong note, and how to fix it. Assumes the player was on the right string. */
export function describeMiss(t: Target, played: number): string {
  const diff = played - t.midi;
  if (diff === 0) return '';
  if (diff % 12 === 0) return `Right note, ${diff > 0 ? 'one octave too high' : 'one octave too low'}. Try the ${stringName(t.string)} string, fret ${t.fret}.`;
  const n = Math.abs(diff);
  if (n <= 4) {
    return `You played ${noteName(played)}: ${n === 1 ? 'one fret' : `${n} frets`} too ${diff > 0 ? 'high' : 'low'}. Go to fret ${t.fret}.`;
  }
  return `You played ${noteName(played)}. Look for the ${stringName(t.string)} string, fret ${t.fret}.`;
}

/** Tuning advice for an open string heard `cents` away from the right pitch. */
export function tuningAdvice(cents: number): { ok: boolean; text: string } {
  if (Math.abs(cents) <= 12) return { ok: true, text: 'In tune' };
  return { ok: false, text: cents < 0 ? 'A bit flat: tighten the string a little' : 'A bit sharp: loosen the string a little' };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
