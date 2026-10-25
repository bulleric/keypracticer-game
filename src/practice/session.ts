/**
 * Live Practice game rules. Pure functions, no mic or UI, so they are easy to test.
 *
 * The target note waits until it is played. A right note scores and moves on,
 * a wrong note resets the combo. There is no tempo; the clock is only used for
 * the speed bonus and the stats at the end.
 */

export const POINTS_PER_NOTE = 100;
export const MAX_SPEED_BONUS = 50;
/** A ringing previous note is ignored for this long after it was hit. */
const RING_GRACE = 0.8;

export interface PracticeState {
  /** Target pitches in order (MIDI). */
  targets: number[];
  index: number;
  score: number;
  combo: number;
  bestCombo: number;
  hits: number;
  misses: number;
  firstHitAt: number | null;
  lastHitAt: number | null;
  /** Longest pause between two right notes, in seconds. */
  maxGap: number;
  done: boolean;
  last: { kind: 'hit' | 'miss'; midi: number; index: number; time: number; points: number } | null;
}

export interface Heard {
  midi: number;
  /** Seconds, any clock. */
  time: number;
  /** True when the note started with a pluck. */
  attack: boolean;
}

export function startPractice(targets: number[]): PracticeState {
  return {
    targets,
    index: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    firstHitAt: null,
    lastHitAt: null,
    maxGap: 0,
    done: targets.length === 0,
    last: null,
  };
}

/** x1, then x2 after 8 right notes in a row, x3 after 16, x4 after 32. */
export function multiplier(combo: number): number {
  return combo >= 32 ? 4 : combo >= 16 ? 3 : combo >= 8 ? 2 : 1;
}

/** Full bonus within 0.5 s of the previous note, none after 2 s. */
export function speedBonus(gap: number | null): number {
  if (gap === null) return 0;
  if (gap <= 0.5) return MAX_SPEED_BONUS;
  return Math.max(0, Math.round(MAX_SPEED_BONUS * (1 - (gap - 0.5) / 1.5)));
}

function matches(midi: number, target: number, forgiveOctave: boolean) {
  return midi === target || (forgiveOctave && Math.abs(midi - target) === 12);
}

export function onHeard(s: PracticeState, n: Heard, forgiveOctave = false): PracticeState {
  if (s.done) return s;
  const target = s.targets[s.index];
  if (matches(n.midi, target, forgiveOctave)) {
    const gap = s.lastHitAt === null ? null : Math.max(0, n.time - s.lastHitAt);
    const points = POINTS_PER_NOTE * multiplier(s.combo) + speedBonus(gap);
    const combo = s.combo + 1;
    const index = s.index + 1;
    return {
      ...s,
      index,
      score: s.score + points,
      combo,
      bestCombo: Math.max(s.bestCombo, combo),
      hits: s.hits + 1,
      firstHitAt: s.firstHitAt ?? n.time,
      lastHitAt: n.time,
      maxGap: gap === null ? s.maxGap : Math.max(s.maxGap, gap),
      done: index >= s.targets.length,
      last: { kind: 'hit', midi: n.midi, index: s.index, time: n.time, points },
    };
  }
  // The note just played still ringing, or a note that drifted in without a pluck: not a mistake.
  const prev = s.index > 0 ? s.targets[s.index - 1] : null;
  if (prev !== null && matches(n.midi, prev, forgiveOctave) && s.lastHitAt !== null && n.time - s.lastHitAt < RING_GRACE) return s;
  if (!n.attack) return s;
  return { ...s, combo: 0, misses: s.misses + 1, last: { kind: 'miss', midi: n.midi, index: s.index, time: n.time, points: 0 } };
}

export interface PracticeResult {
  score: number;
  accuracy: number;
  bestCombo: number;
  seconds: number;
  notesPerMinute: number;
  /** Tempo if the notes were eighths. */
  eighthsBpm: number;
  stars: number;
}

export function result(s: PracticeState): PracticeResult {
  const played = s.hits + s.misses;
  const accuracy = played ? s.hits / played : 0;
  const seconds = s.firstHitAt !== null && s.lastHitAt !== null ? s.lastHitAt - s.firstHitAt : 0;
  const notesPerMinute = seconds > 0 ? ((s.hits - 1) / seconds) * 60 : 0;
  let stars = s.done ? 1 : 0;
  if (s.done && accuracy >= 0.9) stars = 2;
  if (s.done && accuracy >= 0.95 && s.maxGap <= 2) stars = 3;
  return {
    score: s.score,
    accuracy,
    bestCombo: s.bestCombo,
    seconds,
    notesPerMinute,
    eighthsBpm: Math.round(notesPerMinute / 2),
    stars,
  };
}
