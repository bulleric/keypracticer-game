import { applyRun, bumpStreak, EMPTY_PROFILE, isLevelOpen, LEVELS, startLevel, toExercise, type RunSummary } from '../game';
import { buildExercise } from '../theory';

const run = (levelId: number, stars: number, extra: Partial<RunSummary> = {}): RunSummary => ({
  levelId, setup: LEVELS[levelId - 1].setup, score: 1000, stars, accuracy: 0.9, bestCombo: 10, perfectRun: 0, ...extra,
});

describe('Pentatonic Path', () => {
  it('every level builds a playable exercise', () => {
    for (const l of LEVELS) expect(buildExercise(toExercise(l.setup)).notes.length).toBeGreaterThan(8);
  });

  it('level 16 (C major box 5) is the A minor box 1 shape', () => {
    const am = buildExercise(toExercise(LEVELS[0].setup)).box.map((n) => `${n.string}:${n.fret}`).sort();
    const c = buildExercise(toExercise(LEVELS[15].setup)).box.map((n) => `${n.string}:${n.fret}`).sort();
    expect(c).toEqual(am);
  });

  it('stars unlock the next level and the game opens on it', () => {
    let p = EMPTY_PROFILE;
    expect(startLevel(p)).toBe(1);
    expect(isLevelOpen(p, 2)).toBe(false);
    const r = applyRun(p, run(1, 2));
    p = r.profile;
    expect(r.unlocked).toBe(2);
    expect(r.newBest).toBe(true);
    expect(startLevel({ ...p, current: 1 })).toBe(2);
    expect(applyRun(p, run(1, 0)).unlocked).toBeNull();
  });

  it('badges are earned once', () => {
    const a = applyRun(EMPTY_PROFILE, run(5, 3, { bestCombo: 30 }));
    expect(a.newBadges.map((b) => b.id).sort()).toEqual(['boss', 'combo25', 'first', 'flawless', 'tempo90']); // level 5: 60 BPM eighths = 120 notes a minute
    const b = applyRun(a.profile, run(5, 3, { bestCombo: 30 }));
    expect(b.newBadges).toEqual([]);
  });

  it('daily streak', () => {
    const d = (s: string) => new Date(`${s}T12:00:00`);
    let s = bumpStreak({ count: 0, last: null }, d('2026-10-20'));
    s = bumpStreak(s, d('2026-10-21'));
    s = bumpStreak(s, d('2026-10-21'));
    expect(s.count).toBe(2);
    expect(bumpStreak(s, d('2026-10-25')).count).toBe(1);
  });
});
