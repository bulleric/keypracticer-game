import { LEVELS } from '../levels';
import { beatSequenceTargets, makeQuestion } from '../generate';
import { isRhythmLevel } from '../levels';
import { midiAt, noteAt } from '../../music/notes';

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('curriculum levels 1-40', () => {
  it('has 40 levels in 4 worlds with a boss at the end of each', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(LEVELS.filter((l) => l.boss).map((l) => l.id)).toEqual([10, 20, 30, 40]);
  });

  it('about half the levels use the mic', () => {
    const mic = LEVELS.filter((l) => l.usesMic).length;
    expect(mic).toBeGreaterThanOrEqual(20);
  });

  for (const level of LEVELS.filter((l) => !isRhythmLevel(l))) {
    it(`level ${level.id} (${level.title}) makes valid questions`, () => {
      const rng = seeded(level.id * 101);
      const seq = {};
      let prev;
      for (let i = 0; i < level.questions; i++) {
        const q = makeQuestion({ level, index: i, rng, prev, seq, stringStyle: 'mixed' });
        prev = q;
        expect(q.prompt.length).toBeGreaterThan(0);
        if (q.input === 'pad') {
          expect(q.padOptions).toContain(q.correctPad);
        } else {
          expect(q.acceptMidis?.length).toBeGreaterThan(0);
        }
        if (q.acceptMidis && q.string) {
          // every accepted pitch sits on the asked string inside frets 0-12
          for (const m of q.acceptMidis) {
            const fret = m - midiAt(q.string, 0);
            expect(fret).toBeGreaterThanOrEqual(0);
            expect(fret).toBeLessThanOrEqual(12);
          }
        }
        if (q.highlightFret?.string && q.correctPad && level.drill === 'nameFret') {
          expect(noteAt(q.highlightFret.string, q.highlightFret.fret)).toBe(q.correctPad);
          const r = level.range!;
          expect(q.highlightFret.fret).toBeGreaterThanOrEqual(r.minFret);
          expect(q.highlightFret.fret).toBeLessThanOrEqual(r.maxFret);
        }
      }
    });
  }

  it('step 3 tuner goes through all six open strings low to high', () => {
    const level = LEVELS[2];
    const qs = Array.from({ length: 6 }, (_, i) => makeQuestion({ level, index: i, rng: Math.random, seq: {}, stringStyle: 'name' }));
    expect(qs.map((q) => q.acceptMidis![0])).toEqual([40, 45, 50, 55, 59, 64]);
  });

  it('step 28 keeps one note across all six strings', () => {
    const level = LEVELS[27];
    const seq = {};
    const qs = Array.from({ length: 6 }, (_, i) => makeQuestion({ level, index: i, rng: seeded(5), seq, stringStyle: 'name' }));
    expect(new Set(qs.map((q) => q.target)).size).toBe(1);
    expect(qs.map((q) => q.string)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('step 38 walks A B C D E F G on the A string', () => {
    const t = beatSequenceTargets(LEVELS[37], Math.random);
    expect(t.map((x) => x.label)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(t.map((x) => x.midis)).toEqual([[45], [47], [48], [50], [52], [53], [55]]);
  });
});
