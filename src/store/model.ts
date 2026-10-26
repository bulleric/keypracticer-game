/**
 * The saved profile (version 2) and pure helpers: migration from version 1,
 * daily practice time, lesson steps, and merging two copies (device and
 * account) when someone signs in.
 */
import { dayKey, EMPTY_PROFILE, type PentaProfile } from '../practice/game';

export interface Settings {
  /** Mic sensitivity 0..1. */
  sensitivity: number;
  /** Accept the right note one octave off (mic octave errors). */
  forgiveOctave: boolean;
  /** Added to played-note times before judging the beat, in ms. */
  latencyMs: number;
  /** Open strings work as buttons between runs. */
  soundControl: boolean;
}

export type Experience = 'new' | 'box1' | 'all';
export type MicChoice = 'unknown' | 'granted' | 'denied';

export interface Onboarding {
  done: boolean;
  /** Screen to come back to if the app closes half way. */
  step: number;
  experience: Experience | null;
  /** Daily goal in minutes. */
  goalMin: 5 | 10 | 20;
  mic: MicChoice;
  /** How often we asked to sign up and the player said "Later". */
  signupLater: number;
}

/** Lesson steps done besides the run itself. */
export interface Rungs {
  learn?: boolean;
  listen?: boolean;
}

export interface Progress {
  version: 2;
  xp: number;
  /** Live Practice best results by practice code. */
  practiceBest: Record<string, { score: number; stars: number }>;
  /** Pentatonic Path: levels, badges, streak. */
  penta: PentaProfile;
  rungs: Record<number, Rungs>;
  onboarding: Onboarding;
  /** Seconds practised per day (yyyy-mm-dd), last 14 days. */
  practiceDays: Record<string, number>;
  settings: Settings;
  /** ms since epoch of the last change, used when syncing. */
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 0.5,
  forgiveOctave: true,
  latencyMs: 0,
  soundControl: true,
};

export const DEFAULT_ONBOARDING: Onboarding = { done: false, step: 0, experience: null, goalMin: 10, mic: 'unknown', signupLater: 0 };

export const EMPTY: Progress = {
  version: 2,
  xp: 0,
  practiceBest: {},
  penta: EMPTY_PROFILE,
  rungs: {},
  onboarding: DEFAULT_ONBOARDING,
  practiceDays: {},
  settings: DEFAULT_SETTINGS,
  updatedAt: 0,
};

/** Fill in anything missing. Version 1 saves came from players who already use the game, so they skip onboarding. */
export function normalize(raw: any): Progress {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const v1 = raw.version !== 2;
  return {
    ...EMPTY,
    ...raw,
    version: 2,
    penta: { ...EMPTY_PROFILE, ...(raw.penta ?? {}) },
    rungs: raw.rungs ?? {},
    onboarding: { ...DEFAULT_ONBOARDING, ...(raw.onboarding ?? {}), ...(v1 ? { done: true, mic: 'granted' as MicChoice } : {}) },
    practiceDays: raw.practiceDays ?? {},
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    updatedAt: raw.updatedAt ?? 0,
  };
}

/** Adds practice time to today, keeping two weeks. */
export function addPractice(days: Record<string, number>, seconds: number, today = new Date()): Record<string, number> {
  const k = dayKey(today);
  const out: Record<string, number> = { ...days, [k]: (days[k] ?? 0) + Math.max(0, Math.round(seconds)) };
  const keys = Object.keys(out).sort();
  while (keys.length > 14) delete out[keys.shift()!];
  return out;
}

export function todaySeconds(p: Progress, today = new Date()): number {
  return p.practiceDays[dayKey(today)] ?? 0;
}

/**
 * Merge the copy on this device with the copy in the account. Nothing earned is
 * ever lost: best stars and scores per level, all badges, the longer streak.
 * Settings and onboarding come from the newer copy.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const newer = b.updatedAt > a.updatedAt ? b : a;
  const older = newer === a ? b : a;
  const levels: PentaProfile['levels'] = { ...older.penta.levels };
  for (const [id, r] of Object.entries(newer.penta.levels)) {
    const o = levels[+id];
    levels[+id] = o ? { stars: Math.max(o.stars, r.stars), best: Math.max(o.best, r.best) } : r;
  }
  const practiceBest = { ...older.practiceBest };
  for (const [k, r] of Object.entries(newer.practiceBest)) {
    const o = practiceBest[k];
    practiceBest[k] = o ? { score: Math.max(o.score, r.score), stars: Math.max(o.stars, r.stars) } : r;
  }
  const rungs: Record<number, Rungs> = { ...older.rungs };
  for (const [id, r] of Object.entries(newer.rungs)) {
    const o = rungs[+id] ?? {};
    rungs[+id] = { learn: !!(o.learn || r.learn), listen: !!(o.listen || r.listen) };
  }
  const practiceDays: Record<string, number> = { ...older.practiceDays };
  for (const [d, sec] of Object.entries(newer.practiceDays)) practiceDays[d] = Math.max(practiceDays[d] ?? 0, sec);
  const streak =
    (a.penta.streak.last ?? '') === (b.penta.streak.last ?? '')
      ? { last: a.penta.streak.last, count: Math.max(a.penta.streak.count, b.penta.streak.count) }
      : (a.penta.streak.last ?? '') > (b.penta.streak.last ?? '')
        ? a.penta.streak
        : b.penta.streak;
  return {
    ...newer,
    xp: Math.max(a.xp, b.xp),
    practiceBest,
    rungs,
    practiceDays,
    onboarding: { ...newer.onboarding, done: a.onboarding.done || b.onboarding.done },
    penta: {
      ...newer.penta,
      levels,
      badges: [...new Set([...older.penta.badges, ...newer.penta.badges])],
      boxes: [...new Set([...older.penta.boxes, ...newer.penta.boxes])].sort(),
      runs: Math.max(a.penta.runs, b.penta.runs),
      streak,
      unlockedTo: Math.max(a.penta.unlockedTo ?? 0, b.penta.unlockedTo ?? 0) || undefined,
    },
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}
