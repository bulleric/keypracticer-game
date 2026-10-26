import { EMPTY_PROFILE, LEVELS, isLevelOpen, toExercise } from '../game';
import { hearNotes, nextRung, rungsFor, theoryFor } from '../lessons';
import { buildExercise } from '../theory';

describe('lessons', () => {
  test.each(LEVELS.map((l) => [l.id, l] as const))('lesson %i has theory with something to hear', (_id, level) => {
    const cards = theoryFor(level.id);
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards.length).toBeLessThanOrEqual(2);
    const ex = buildExercise(toExercise(level.setup));
    for (const c of cards) {
      expect(c.body.length).toBeGreaterThan(40);
      expect(c.listenFor.length).toBeGreaterThan(5);
      const h = hearNotes(c.hear, ex);
      expect(h.midis.length).toBeGreaterThan(0);
      expect(h.midis.every((m) => m >= 40 && m <= 90)).toBe(true);
      // Emphasised intervals exist in the box.
      for (const e of c.emphasize) expect(ex.box.some((n) => n.interval === e)).toBe(true);
    }
  });

  test('the first time walks up the ladder; after a star the button plays', () => {
    const l = LEVELS[0];
    expect(nextRung(l, undefined, EMPTY_PROFILE)).toBe('learn');
    expect(nextRung(l, { learn: true }, EMPTY_PROFILE)).toBe('listen');
    expect(nextRung(l, { learn: true, listen: true }, EMPTY_PROFILE)).toBe('run');
    const starred = { ...EMPTY_PROFILE, levels: { 1: { stars: 1, best: 10 } } };
    expect(nextRung(l, undefined, starred)).toBe('run');
    expect(rungsFor(LEVELS[2], undefined, EMPTY_PROFILE).map((r) => r.label)).toEqual(['Learn', 'Listen', 'On the beat']);
  });

  test('placement opens earlier lessons', () => {
    const p = { ...EMPTY_PROFILE, unlockedTo: 6 };
    expect(isLevelOpen(p, 6)).toBe(true);
    expect(isLevelOpen(p, 7)).toBe(false);
  });

  test('hearing a degree plays the root, then the degree', () => {
    const ex = buildExercise(toExercise(LEVELS[6].setup)); // A minor box 2
    const h = hearNotes({ kind: 'degree', degree: 'b3' }, ex);
    expect((h.midis[1] - h.midis[0] + 12) % 12).toBe(3);
  });
});
