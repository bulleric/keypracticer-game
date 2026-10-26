import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MicService } from '../pitch/MicService';
import { applyRun, EMPTY_PROFILE, type Badge, type PentaProfile, type RunSummary } from '../practice/game';

export interface Settings {
  /** Mic sensitivity 0..1. */
  sensitivity: number;
  /** Accept the right note one octave off (mic octave errors). */
  forgiveOctave: boolean;
  /** Added to played-note times before judging the beat, in ms. */
  latencyMs: number;
}

export interface Progress {
  xp: number;
  /** Live Practice best results by practice code. */
  practiceBest: Record<string, { score: number; stars: number }>;
  /** Pentatonic Path: levels, badges, streak. */
  penta: PentaProfile;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 0.5,
  forgiveOctave: true,
  latencyMs: 0,
};

const EMPTY: Progress = { xp: 0, practiceBest: {}, penta: EMPTY_PROFILE, settings: DEFAULT_SETTINGS };
const KEY = 'keypracticer-game.progress.v1';

interface Ctx {
  progress: Progress;
  loaded: boolean;
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
  }, [progress.settings.sensitivity]);

  const save = useCallback((p: Progress) => {
    ref.current = p;
    setProgress(p);
    AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      progress,
      loaded,
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
