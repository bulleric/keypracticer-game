import { EMPTY_PROFILE } from '../../practice/game';
import { addPractice, EMPTY, mergeProgress, normalize, type Progress } from '../model';

describe('profile v2', () => {
  test('version 1 saves skip onboarding and keep their stars', () => {
    const v1 = { xp: 300, practiceBest: {}, penta: { ...EMPTY_PROFILE, levels: { 1: { stars: 2, best: 900 } } }, settings: { sensitivity: 0.8 } };
    const p = normalize(v1);
    expect(p.version).toBe(2);
    expect(p.onboarding.done).toBe(true);
    expect(p.penta.levels[1].stars).toBe(2);
    expect(p.settings.sensitivity).toBe(0.8);
    expect(p.settings.soundControl).toBe(true);
  });
  test('a new player starts with onboarding', () => {
    expect(normalize(null).onboarding.done).toBe(false);
    expect(normalize({ version: 2 }).onboarding.done).toBe(false);
  });
  test('practice time adds up per day and keeps two weeks', () => {
    let d: Record<string, number> = {};
    for (let i = 1; i <= 20; i++) d = addPractice(d, 60, new Date(2026, 9, i));
    d = addPractice(d, 30, new Date(2026, 9, 20));
    expect(Object.keys(d)).toHaveLength(14);
    expect(d['2026-10-20']).toBe(90);
  });
});

describe('merging device and account', () => {
  const base = (over: Partial<Progress>): Progress => ({ ...EMPTY, ...over });
  test('nothing earned is lost', () => {
    const device = base({
      updatedAt: 200,
      xp: 500,
      penta: { ...EMPTY_PROFILE, levels: { 1: { stars: 3, best: 1000 }, 2: { stars: 1, best: 400 } }, badges: ['first'], runs: 4, boxes: [1], streak: { count: 2, last: '2026-10-26' } },
      rungs: { 1: { learn: true } },
    });
    const account = base({
      updatedAt: 100,
      xp: 800,
      penta: { ...EMPTY_PROFILE, levels: { 1: { stars: 1, best: 1200 }, 3: { stars: 2, best: 700 } }, badges: ['combo25'], runs: 9, boxes: [2], streak: { count: 5, last: '2026-10-25' } },
      rungs: { 1: { listen: true } },
      onboarding: { ...EMPTY.onboarding, done: true },
    });
    const m = mergeProgress(device, account);
    expect(m.penta.levels[1]).toEqual({ stars: 3, best: 1200 });
    expect(m.penta.levels[2].stars).toBe(1);
    expect(m.penta.levels[3].stars).toBe(2);
    expect(m.penta.badges.sort()).toEqual(['combo25', 'first']);
    expect(m.penta.boxes).toEqual([1, 2]);
    expect(m.penta.runs).toBe(9);
    expect(m.xp).toBe(800);
    expect(m.rungs[1]).toEqual({ learn: true, listen: true });
    expect(m.onboarding.done).toBe(true);
    // The streak that was practised most recently wins.
    expect(m.penta.streak).toEqual({ count: 2, last: '2026-10-26' });
    expect(m.updatedAt).toBe(200);
  });
  test('settings come from the newer copy', () => {
    const a = base({ updatedAt: 1, settings: { ...EMPTY.settings, sensitivity: 0.2 } });
    const b = base({ updatedAt: 2, settings: { ...EMPTY.settings, sensitivity: 0.8 } });
    expect(mergeProgress(a, b).settings.sensitivity).toBe(0.8);
    expect(mergeProgress(b, a).settings.sensitivity).toBe(0.8);
  });
});
