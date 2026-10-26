import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LEVELS } from '../quiz/levels';
import type { RoundSummary } from '../quiz/round';
import type { StringStyle } from '../quiz/types';
import { STARS_TO_UNLOCK_WORLD } from '../game/xp';
import { MicService } from '../pitch/MicService';
import { setVoiceEnabled } from '../audio/speech';
import { applyRun, EMPTY_PROFILE, type Badge, type PentaProfile, type RunSummary } from '../practice/game';

export interface Settings {
  /** Answer play-it questions on a real guitar through the mic. Off = tap the board. */
  guitarMode: boolean;
  voice: boolean;
  stringStyle: StringStyle;
  /** Mic sensitivity 0..1. */
  sensitivity: number;
  /** Accept the right note one octave off (mic octave errors). */
  forgiveOctave: boolean;
  /** Added to played-note times before judging the beat, in ms. */
  latencyMs: number;
  /** Practice mode: every level is open. */
  unlockAll: boolean;
}

export interface LevelProgress {
  stars: number;
  passed: boolean;
  bestPoints: number;
  plays: number;
}

export interface Progress {
  levels: Record<number, LevelProgress>;
  xp: number;
  rushBest: { tap: number; play: number };
  /** Live Practice best results by practice code. */
  practiceBest: Record<string, { score: number; stars: number }>;
  /** Pentatonic Path: levels, badges, streak. */
  penta: PentaProfile;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  guitarMode: true,
  voice: true,
  stringStyle: 'name',
  sensitivity: 0.5,
  forgiveOctave: true,
  latencyMs: 0,
  unlockAll: false,
};

const EMPTY: Progress = { levels: {}, xp: 0, rushBest: { tap: 0, play: 0 }, practiceBest: {}, penta: EMPTY_PROFILE, settings: DEFAULT_SETTINGS };
const KEY = 'notetrainer.progress.v1';

export function worldStars(p: Progress, world: number): number {
  return LEVELS.filter((l) => l.world === world).reduce((a, l) => a + (p.levels[l.id]?.stars ?? 0), 0);
}

export function isUnlocked(p: Progress, id: number): boolean {
  if (p.settings.unlockAll) return LEVELS.some((l) => l.id === id);
  if (id === 1) return true;
  const level = LEVELS.find((l) => l.id === id);
  if (!level) return false;
  if (!p.levels[id - 1]?.passed) return false;
  const firstOfWorld = LEVELS.find((l) => l.world === level.world)?.id === id;
  if (firstOfWorld) return worldStars(p, level.world - 1) >= STARS_TO_UNLOCK_WORLD;
  return true;
}

export function totalStars(p: Progress): number {
  return Object.values(p.levels).reduce((a, l) => a + l.stars, 0);
}

interface Ctx {
  progress: Progress;
  loaded: boolean;
  recordRound(levelId: number, s: RoundSummary): { newBest: boolean; unlockedNext: boolean };
  recordRush(mode: 'tap' | 'play', score: number, xp: number): boolean;
  /** Saves a Live Practice result; returns true for a new best score. */
  recordPractice(code: string, score: number, stars: number, xp: number): boolean;
  /** Saves a Pentatonic Path run and adds XP. */
  recordPentaRun(r: RunSummary, xp: number): { newBadges: Badge[]; newBest: boolean; unlocked: number | null };
  setPentaCurrent(levelId: number): void;
  updateSettings(s: Partial<Settings>): void;
  reset(): void;
}

const ProgressContext = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(progress);
  ref.current = progress;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const p = JSON.parse(raw) as Progress;
          setProgress({ ...EMPTY, ...p, penta: { ...EMPTY_PROFILE, ...p.penta }, settings: { ...DEFAULT_SETTINGS, ...p.settings } });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    MicService.setSensitivity(progress.settings.sensitivity);
    setVoiceEnabled(progress.settings.voice);
  }, [progress.settings.sensitivity, progress.settings.voice]);

  const save = useCallback((p: Progress) => {
    ref.current = p;
    setProgress(p);
    AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      progress,
      loaded,
      recordRound(levelId, s) {
        const p = ref.current;
        const prev = p.levels[levelId] ?? { stars: 0, passed: false, bestPoints: 0, plays: 0 };
        const wasNextUnlocked = isUnlocked(p, levelId + 1);
        const next: LevelProgress = {
          stars: Math.max(prev.stars, s.stars),
          passed: prev.passed || s.passed,
          bestPoints: Math.max(prev.bestPoints, s.points),
          plays: prev.plays + 1,
        };
        const np = { ...p, xp: p.xp + s.points, levels: { ...p.levels, [levelId]: next } };
        save(np);
        return { newBest: s.points > prev.bestPoints, unlockedNext: !wasNextUnlocked && isUnlocked(np, levelId + 1) };
      },
      recordRush(mode, score, xp) {
        const p = ref.current;
        const best = score > p.rushBest[mode];
        save({ ...p, xp: p.xp + xp, rushBest: { ...p.rushBest, [mode]: Math.max(score, p.rushBest[mode]) } });
        return best;
      },
      recordPractice(code, score, stars, xp) {
        const p = ref.current;
        const prev = p.practiceBest[code] ?? { score: 0, stars: 0 };
        save({
          ...p,
          xp: p.xp + xp,
          practiceBest: { ...p.practiceBest, [code]: { score: Math.max(prev.score, score), stars: Math.max(prev.stars, stars) } },
        });
        return score > prev.score;
      },
      recordPentaRun(r, xp) {
        const p = ref.current;
        const out = applyRun(p.penta, r);
        save({ ...p, xp: p.xp + xp, penta: out.profile });
        return { newBadges: out.newBadges, newBest: out.newBest, unlocked: out.unlocked };
      },
      setPentaCurrent(levelId) {
        const p = ref.current;
        if (p.penta.current !== levelId) save({ ...p, penta: { ...p.penta, current: levelId } });
      },
      updateSettings(s) {
        const p = ref.current;
        save({ ...p, settings: { ...p.settings, ...s } });
      },
      reset() {
        save({ ...EMPTY, settings: ref.current.settings });
      },
    }),
    [progress, loaded, save],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): Ctx {
  const c = useContext(ProgressContext);
  if (!c) throw new Error('useProgress outside ProgressProvider');
  return c;
}
