import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setMicAllowed, setSoundControl } from '../engine/useCommands';
import { MicService } from '../pitch/MicService';
import { applyRun, type Badge, type RunSummary } from '../practice/game';
import { addPractice, EMPTY, normalize, type Onboarding, type Progress, type Rungs, type Settings } from './model';

export type { Progress, Settings } from './model';
export { DEFAULT_SETTINGS } from './model';

const KEY = 'keypracticer-game.progress.v2';
const KEY_V1 = 'keypracticer-game.progress.v1';

interface Ctx {
  progress: Progress;
  loaded: boolean;
  /** Saves a Live Practice result; returns true for a new best score. */
  recordPractice(code: string, score: number, stars: number, xp: number): boolean;
  /** Saves a Pentatonic Path run and adds XP and practice time. */
  recordPentaRun(r: RunSummary, xp: number, seconds: number): { newBadges: Badge[]; newBest: boolean; unlocked: number | null };
  /** Adds practice time (Listen mode, theory). */
  addPracticeTime(seconds: number): void;
  setPentaCurrent(levelId: number): void;
  markRung(levelId: number, rung: keyof Rungs): void;
  updateOnboarding(o: Partial<Onboarding>): void;
  /** Where to start after onboarding: "I know box 1" opens world 1, "all five" opens everything up to world 4. */
  placeAt(levelId: number, unlockedTo: number): void;
  updateSettings(s: Partial<Settings>): void;
  /** Replace everything (after merging with the account). */
  replace(p: Progress): void;
  reset(): void;
}

const ProgressContext = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(progress);
  ref.current = progress;

  useEffect(() => {
    (async () => {
      try {
        const raw = (await AsyncStorage.getItem(KEY)) ?? (await AsyncStorage.getItem(KEY_V1));
        if (raw) setProgress(normalize(JSON.parse(raw)));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    MicService.setSensitivity(progress.settings.sensitivity);
  }, [progress.settings.sensitivity]);
  useEffect(() => {
    setSoundControl(progress.settings.soundControl);
  }, [progress.settings.soundControl]);
  useEffect(() => {
    setMicAllowed(progress.onboarding.mic === 'granted');
  }, [progress.onboarding.mic]);

  const save = useCallback((p: Progress, touch = true) => {
    const next = touch ? { ...p, updatedAt: Date.now() } : p;
    ref.current = next;
    setProgress(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
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
      recordPentaRun(r, xp, seconds) {
        const p = ref.current;
        const out = applyRun(p.penta, r);
        save({ ...p, xp: p.xp + xp, penta: out.profile, practiceDays: addPractice(p.practiceDays, seconds) });
        return { newBadges: out.newBadges, newBest: out.newBest, unlocked: out.unlocked };
      },
      addPracticeTime(seconds) {
        const p = ref.current;
        if (seconds > 0) save({ ...p, practiceDays: addPractice(p.practiceDays, seconds) });
      },
      setPentaCurrent(levelId) {
        const p = ref.current;
        if (p.penta.current !== levelId) save({ ...p, penta: { ...p.penta, current: levelId } });
      },
      markRung(levelId, rung) {
        const p = ref.current;
        if (p.rungs[levelId]?.[rung]) return;
        save({ ...p, rungs: { ...p.rungs, [levelId]: { ...p.rungs[levelId], [rung]: true } } });
      },
      updateOnboarding(o) {
        const p = ref.current;
        save({ ...p, onboarding: { ...p.onboarding, ...o } });
      },
      placeAt(levelId, unlockedTo) {
        const p = ref.current;
        save({ ...p, penta: { ...p.penta, current: levelId, unlockedTo: unlockedTo || undefined } });
      },
      updateSettings(s) {
        const p = ref.current;
        save({ ...p, settings: { ...p.settings, ...s } });
      },
      replace(p) {
        save(p, false);
      },
      reset() {
        const p = ref.current;
        save({ ...EMPTY, onboarding: { ...p.onboarding }, settings: p.settings });
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
