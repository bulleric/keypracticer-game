import { multiplier, onHeard, result, speedBonus, startPractice } from '../session';

const hit = (midi: number, time: number) => ({ midi, time, attack: true });

describe('live practice rules', () => {
  it('a right note scores and moves on', () => {
    let s = startPractice([60, 62, 64]);
    s = onHeard(s, hit(60, 1));
    expect(s.index).toBe(1);
    expect(s.score).toBe(100); // first note: no speed bonus
    s = onHeard(s, hit(62, 1.4));
    expect(s.score).toBe(100 + 100 + 50);
    expect(s.combo).toBe(2);
  });

  it('a wrong note keeps the target and resets the combo', () => {
    let s = startPractice([60, 62]);
    s = onHeard(s, hit(60, 1));
    s = onHeard(s, hit(65, 2));
    expect(s.index).toBe(1);
    expect(s.combo).toBe(0);
    expect(s.misses).toBe(1);
    expect(s.last?.kind).toBe('miss');
  });

  it('ignores the previous note ringing on, and notes without a pluck', () => {
    let s = startPractice([60, 62]);
    s = onHeard(s, hit(60, 1));
    s = onHeard(s, hit(60, 1.3));
    s = onHeard(s, { midi: 70, time: 1.5, attack: false });
    expect(s.misses).toBe(0);
    // Long after, playing the old note again is a mistake.
    s = onHeard(s, hit(60, 3));
    expect(s.misses).toBe(1);
  });

  it('the same note twice in a row needs two plucks, and both count', () => {
    let s = startPractice([60, 60]);
    s = onHeard(s, hit(60, 1));
    s = onHeard(s, hit(60, 1.5));
    expect(s.done).toBe(true);
  });

  it('octave forgiveness is optional', () => {
    expect(onHeard(startPractice([60]), hit(72, 1)).index).toBe(0);
    expect(onHeard(startPractice([60]), hit(72, 1), true).index).toBe(1);
  });

  it('combo multiplier and speed bonus', () => {
    expect([0, 7, 8, 16, 32].map(multiplier)).toEqual([1, 1, 2, 3, 4]);
    expect(speedBonus(null)).toBe(0);
    expect(speedBonus(0.3)).toBe(50);
    expect(speedBonus(1.25)).toBe(25);
    expect(speedBonus(3)).toBe(0);
  });

  it('stars and stats', () => {
    let s = startPractice(Array.from({ length: 20 }, (_, i) => 50 + i));
    for (let i = 0; i < 20; i++) s = onHeard(s, hit(50 + i, i * 0.5));
    const r = result(s);
    expect(r.stars).toBe(3);
    expect(r.accuracy).toBe(1);
    expect(r.notesPerMinute).toBeCloseTo(120);
    expect(r.eighthsBpm).toBe(60);

    let t = startPractice([50, 51, 52]);
    t = onHeard(t, hit(50, 0));
    t = onHeard(t, hit(55, 0.5));
    t = onHeard(t, hit(51, 1));
    t = onHeard(t, hit(52, 1.5));
    expect(result(t).stars).toBe(1); // 75% accuracy
    expect(onHeard(t, hit(52, 9))).toBe(t); // finished: nothing changes
  });
});
