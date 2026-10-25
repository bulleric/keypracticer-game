import type { Level, Question } from './types';

/** Notes the learner played (or tapped) are checked here. */
export function checkMidi(q: Question, midi: number, forgiveOctave: boolean): boolean {
  const acc = q.acceptMidis ?? [];
  if (acc.includes(midi)) return true;
  if (forgiveOctave) return acc.some((m) => m === midi + 12 || m === midi - 12);
  return false;
}

export function checkPad(q: Question, value: string): boolean {
  return q.correctPad === value;
}

export const COMBO_STEP = 3;
export const MAX_MULTIPLIER = 4;
export const BOSS_HEARTS = 3;
/** Wrong tries on one question before the answer is shown and the round moves on. */
export const MAX_TRIES = 3;
/** Misses on one question before a hint appears. */
export const HINT_AFTER = 2;

export function multiplierFor(streak: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(streak / COMBO_STEP));
}

export interface RoundState {
  index: number;
  total: number;
  correct: number;
  /** Questions answered wrong at least once. */
  missedQuestions: number;
  mistakes: number;
  streak: number;
  bestStreak: number;
  points: number;
  hearts: number | null;
  hintsUsed: number;
  triesOnCurrent: number;
  times: number[];
  finished: boolean;
  failed: boolean;
}

export function newRound(level: Level): RoundState {
  return {
    index: 0,
    total: level.questions,
    correct: 0,
    missedQuestions: 0,
    mistakes: 0,
    streak: 0,
    bestStreak: 0,
    points: 0,
    hearts: level.boss ? BOSS_HEARTS : null,
    hintsUsed: 0,
    triesOnCurrent: 0,
    times: [],
    finished: false,
    failed: false,
  };
}

export type AnswerOutcome = 'correct' | 'retry' | 'reveal';

export interface AnswerResult {
  state: RoundState;
  outcome: AnswerOutcome;
  /** Points just earned. */
  gained: number;
  multiplier: number;
}

/**
 * Apply one answer. A correct first try scores points times the combo. A
 * miss resets the combo and lets the learner try again, up to MAX_TRIES;
 * then the answer is shown and the round moves on.
 */
export function applyAnswer(
  s: RoundState,
  correct: boolean,
  seconds: number,
  opts: { timeGoal: number; countMistake?: boolean } = { timeGoal: 4 },
): AnswerResult {
  const st = { ...s, times: [...s.times] };
  const countMistake = opts.countMistake ?? true;
  if (correct) {
    const firstTry = st.triesOnCurrent === 0;
    let gained = 0;
    let mult = 1;
    if (firstTry) {
      st.correct++;
      st.streak++;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
      mult = multiplierFor(st.streak);
      const speedBonus = seconds <= opts.timeGoal / 2 ? 5 : 0;
      gained = (10 + speedBonus) * mult;
    } else {
      gained = 2;
    }
    st.points += gained;
    st.times.push(seconds);
    advance(st);
    return { state: st, outcome: 'correct', gained, multiplier: mult };
  }
  if (!countMistake) return { state: st, outcome: 'retry', gained: 0, multiplier: 1 };
  st.mistakes++;
  st.streak = 0;
  if (st.triesOnCurrent === 0) st.missedQuestions++;
  st.triesOnCurrent++;
  if (st.hearts !== null) {
    st.hearts--;
    if (st.hearts <= 0) {
      st.failed = true;
      st.finished = true;
      return { state: st, outcome: 'reveal', gained: 0, multiplier: 1 };
    }
  }
  if (st.triesOnCurrent >= MAX_TRIES) {
    st.times.push(seconds);
    advance(st);
    return { state: st, outcome: 'reveal', gained: 0, multiplier: 1 };
  }
  return { state: st, outcome: 'retry', gained: 0, multiplier: 1 };
}

/** Time ran out (boss levels): one miss, then the next question. */
export function applyTimeout(s: RoundState, seconds: number): RoundState {
  const st = { ...s, times: [...s.times] };
  st.mistakes++;
  st.streak = 0;
  if (st.triesOnCurrent === 0) st.missedQuestions++;
  if (st.hearts !== null) {
    st.hearts--;
    if (st.hearts <= 0) {
      st.failed = true;
      st.finished = true;
      return st;
    }
  }
  st.times.push(seconds);
  advance(st);
  return st;
}

export function markHintUsed(s: RoundState): RoundState {
  return { ...s, hintsUsed: s.hintsUsed + 1 };
}

function advance(st: RoundState) {
  st.index++;
  st.triesOnCurrent = 0;
  if (st.index >= st.total) st.finished = true;
}

/** Time per question for boss levels: starts at 10 s and speeds up to 4 s. */
export function bossTimeLimit(index: number, total: number): number {
  const t = 10 - (6 * index) / Math.max(1, total - 1);
  return Math.round(t * 10) / 10;
}

export interface RoundSummary {
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  accuracy: number;
  avgSeconds: number;
  totalSeconds: number;
  points: number;
  bestStreak: number;
  reason?: string;
}

export function defaultTimeGoal(level: Level): number {
  if (level.timeGoal) return level.timeGoal;
  return level.usesMic ? 5 : 4;
}

export function summarize(level: Level, s: RoundState, extra: { reachedBpm?: number; bestOnBeatStreak?: number } = {}): RoundSummary {
  const answered = Math.max(1, s.index);
  const accuracy = s.correct / Math.max(1, s.total);
  const totalSeconds = s.times.reduce((a, b) => a + b, 0);
  const avgSeconds = s.times.length ? totalSeconds / s.times.length : 0;
  let passed = !s.failed;
  let reason: string | undefined = s.failed ? 'Out of hearts' : undefined;
  const rule = level.pass;
  if (passed && rule.kind === 'accuracy') {
    if (accuracy + 1e-9 < rule.min) {
      passed = false;
      reason = `Need ${Math.round(rule.min * 100)}% correct`;
    } else if (rule.avgSecondsMax && avgSeconds > rule.avgSecondsMax) {
      passed = false;
      reason = `Average answer must be under ${rule.avgSecondsMax} s`;
    } else if (rule.totalSecondsMax && totalSeconds > rule.totalSecondsMax) {
      passed = false;
      reason = `Finish in under ${rule.totalSecondsMax} s`;
    }
  } else if (passed && rule.kind === 'streak') {
    if ((extra.bestOnBeatStreak ?? 0) < rule.count) {
      passed = false;
      reason = `Need ${rule.count} in a row on time`;
    }
  } else if (passed && rule.kind === 'reachBpm') {
    if ((extra.reachedBpm ?? 0) < rule.bpm) {
      passed = false;
      reason = `Reach ${rule.bpm} BPM`;
    }
  }
  void answered;
  let stars: RoundSummary['stars'] = 0;
  if (passed) {
    stars = 1;
    const fast = level.drill === 'onBeat' || level.drill === 'fretPlay' || level.drill === 'beatSequence'
      ? s.mistakes <= 2
      : avgSeconds <= defaultTimeGoal(level);
    if (fast) stars = 2;
    if (fast && s.mistakes === 0 && s.hintsUsed === 0) stars = 3;
  }
  return { passed, stars, accuracy, avgSeconds, totalSeconds, points: s.points, bestStreak: s.bestStreak, reason };
}
