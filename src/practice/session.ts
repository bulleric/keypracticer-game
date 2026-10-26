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
  /** Notes skipped with the skip button. */
  skips: number;
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
    skips: 0,
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

/** Skip the target: no points, the combo resets, it counts against accuracy. */
export function skip(s: PracticeState): PracticeState {
  if (s.done) return s;
  const index = s.index + 1;
  return { ...s, index, combo: 0, skips: s.skips + 1, done: index >= s.targets.length, last: null };
}

/** Step back one note to try it again. Nothing is taken off the score. */
export function back(s: PracticeState): PracticeState {
  if (s.index === 0) return s;
  return { ...s, index: s.index - 1, done: false, last: null };
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
  const played = s.hits + s.misses + s.skips;
  const accuracy = played ? s.hits / played : 0;
  const seconds = s.firstHitAt !== null && s.lastHitAt !== null ? s.lastHitAt - s.firstHitAt : 0;
  const notesPerMinute = seconds > 0 ? ((s.hits - 1) / seconds) * 60 : 0;
  let stars = s.done && accuracy >= 0.7 ? 1 : 0;
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

// ======================================================================
// Metronome mode: the notes run on the beat, the mic grades each one.
// ======================================================================

export type Grade = 'perfect' | 'great' | 'good' | 'wrong' | 'miss';

/** Points and accuracy weight per grade. */
export const GRADE: Record<Grade, { points: number; weight: number; label: string }> = {
  perfect: { points: 100, weight: 1, label: 'PERFECT' },
  great: { points: 75, weight: 0.8, label: 'GREAT' },
  good: { points: 50, weight: 0.5, label: 'GOOD' },
  wrong: { points: 0, weight: 0, label: 'WRONG NOTE' },
  miss: { points: 0, weight: 0, label: 'MISS' },
};

export interface MetroState {
  targets: number[];
  /** App clock time of note 0, seconds. */
  t0: number;
  /** Seconds between notes. */
  step: number;
  grades: (Grade | null)[];
  score: number;
  combo: number;
  bestCombo: number;
  /** Perfects in a row. */
  perfectRun: number;
  done: boolean;
  last: { grade: Grade; index: number; points: number; offset: number; midi?: number } | null;
}

export function startMetro(targets: number[], t0: number, step: number): MetroState {
  return {
    targets, t0, step, grades: targets.map(() => null), score: 0, combo: 0, bestCombo: 0, perfectRun: 0,
    done: targets.length === 0, last: null,
  };
}

/** How far off a note may be and still count for its slot. */
export function metroWindow(step: number) {
  return Math.min(0.22, step * 0.45);
}

export function gradeFor(offset: number): Grade {
  const a = Math.abs(offset);
  return a <= 0.05 ? 'perfect' : a <= 0.1 ? 'great' : 'good';
}

function judge(s: MetroState, index: number, grade: Grade, offset: number, midi?: number): MetroState {
  const grades = s.grades.slice();
  grades[index] = grade;
  const ok = grade === 'perfect' || grade === 'great' || grade === 'good';
  const points = ok ? GRADE[grade].points * multiplier(s.combo) : 0;
  const combo = ok ? s.combo + 1 : 0;
  return {
    ...s,
    grades,
    score: s.score + points,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
    perfectRun: grade === 'perfect' ? s.perfectRun + 1 : 0,
    done: grades.every((g) => g !== null),
    last: { grade, index, points, offset, midi },
  };
}

/** A note heard at `n.time` (app clock, latency already added). */
export function metroHeard(s: MetroState, n: Heard, forgiveOctave = false): MetroState {
  if (s.done) return s;
  const win = metroWindow(s.step);
  const near = Math.round((n.time - s.t0) / s.step);
  // The right pitch in the nearest open slot, or one next to it.
  for (const j of [near, near - 1, near + 1]) {
    if (j < 0 || j >= s.targets.length || s.grades[j] !== null) continue;
    const off = n.time - (s.t0 + j * s.step);
    if (Math.abs(off) <= win && matches(n.midi, s.targets[j], forgiveOctave)) return judge(s, j, gradeFor(off), off, n.midi);
  }
  // A plucked wrong note on an open slot.
  if (n.attack && near >= 0 && near < s.targets.length && s.grades[near] === null) {
    const off = n.time - (s.t0 + near * s.step);
    const prev = near > 0 ? s.targets[near - 1] : null;
    const ringing = prev !== null && matches(n.midi, prev, forgiveOctave);
    if (Math.abs(off) <= win && !ringing) return judge(s, near, 'wrong', off, n.midi);
  }
  return s;
}

/** Marks slots whose window has passed as missed. Call often. */
export function metroTick(s: MetroState, now: number): MetroState {
  if (s.done) return s;
  const win = metroWindow(s.step);
  let next = s;
  for (let j = 0; j < s.targets.length; j++) {
    if (next.grades[j] !== null) continue;
    if (now > s.t0 + j * s.step + win) next = judge(next, j, 'miss', 0);
    else break;
  }
  return next;
}

export function metroResult(s: MetroState): PracticeResult {
  const n = s.targets.length || 1;
  const accuracy = s.grades.reduce((a, g) => a + (g ? GRADE[g].weight : 0), 0) / n;
  const stars = !s.done ? 0 : accuracy >= 0.95 ? 3 : accuracy >= 0.85 ? 2 : accuracy >= 0.7 ? 1 : 0;
  const seconds = s.step * n;
  return {
    score: s.score,
    accuracy,
    bestCombo: s.bestCombo,
    seconds,
    notesPerMinute: 60 / s.step,
    eighthsBpm: Math.round(30 / s.step),
    stars,
  };
}

export function gradeCounts(s: MetroState): Record<Grade, number> {
  const c: Record<Grade, number> = { perfect: 0, great: 0, good: 0, wrong: 0, miss: 0 };
  for (const g of s.grades) if (g) c[g]++;
  return c;
}
