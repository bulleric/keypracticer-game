import { LEVELS } from '../levels';
import { applyAnswer, applyTimeout, checkMidi, multiplierFor, newRound, summarize, MAX_TRIES } from '../round';

const nameIt = LEVELS[10]; // level 11, 20 questions, 90%
const boss = LEVELS[19]; // level 20

describe('round scoring', () => {
  it('combo multiplier climbs x2, x3, x4', () => {
    expect([0, 1, 2, 3, 6, 9, 30].map(multiplierFor)).toEqual([1, 1, 1, 2, 3, 4, 4]);
  });

  it('a perfect fast round gets 3 stars', () => {
    let s = newRound(nameIt);
    for (let i = 0; i < 20; i++) s = applyAnswer(s, true, 1.5).state;
    const sum = summarize(nameIt, s);
    expect(sum.passed).toBe(true);
    expect(sum.stars).toBe(3);
    expect(sum.accuracy).toBe(1);
  });

  it('one miss keeps 2 stars, slow answers give 1', () => {
    let s = newRound(nameIt);
    s = applyAnswer(s, false, 1).state;
    for (let i = 0; i < 20; i++) s = applyAnswer(s, true, 2).state;
    expect(summarize(nameIt, s).stars).toBe(2);
    let slow = newRound(nameIt);
    for (let i = 0; i < 20; i++) slow = applyAnswer(slow, true, 9).state;
    expect(summarize(nameIt, slow).stars).toBe(1);
  });

  it('fails under 90% and moves on after 3 wrong tries', () => {
    let s = newRound(nameIt);
    for (let i = 0; i < 3; i++) {
      for (let t = 0; t < MAX_TRIES; t++) s = applyAnswer(s, false, 1).state;
    }
    expect(s.index).toBe(3);
    while (!s.finished) s = applyAnswer(s, true, 1).state;
    const sum = summarize(nameIt, s);
    expect(sum.accuracy).toBeCloseTo(17 / 20);
    expect(sum.passed).toBe(false);
  });

  it('boss: 3 hearts, then retry', () => {
    let s = newRound(boss);
    expect(s.hearts).toBe(3);
    s = applyAnswer(s, false, 1).state;
    s = applyTimeout(s, 5);
    expect(s.hearts).toBe(1);
    s = applyAnswer(s, false, 1).state;
    expect(s.failed).toBe(true);
    expect(summarize(boss, s).passed).toBe(false);
  });

  it('boss: average time limit', () => {
    let s = newRound(boss);
    for (let i = 0; i < 20; i++) s = applyAnswer(s, true, 6).state;
    expect(summarize(boss, s).passed).toBe(false);
  });

  it('forgives octave jumps only when asked', () => {
    const q = { id: 'x', prompt: '', input: 'mic' as const, acceptMidis: [43] };
    expect(checkMidi(q, 55, false)).toBe(false);
    expect(checkMidi(q, 55, true)).toBe(true);
    expect(checkMidi(q, 44, true)).toBe(false);
  });
});
