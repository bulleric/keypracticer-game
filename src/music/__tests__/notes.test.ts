import { describeFrequency, fretsForNote, midiAt, nextNatural, nextSemitone, noteAt, noteLabel } from '../notes';

describe('note math', () => {
  it('knows the open strings', () => {
    expect([6, 5, 4, 3, 2, 1].map((s) => noteLabel(midiAt(s as any, 0)))).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });
  it('fret 1 is one half step up (step 8)', () => {
    expect([6, 5, 4, 3, 2, 1].map((s) => noteAt(s as any, 1))).toEqual(['F', 'A#', 'D#', 'G#', 'C', 'F']);
  });
  it('fret 12 is the open string an octave up (step 9)', () => {
    for (const s of [6, 5, 4, 3, 2, 1] as const) expect(midiAt(s, 12)).toBe(midiAt(s, 0) + 12);
  });
  it('finds frets for a note', () => {
    expect(fretsForNote(6, 'G')).toEqual([3]);
    expect(fretsForNote(6, 'E')).toEqual([0, 12]);
    expect(fretsForNote(5, 'D', 0, 5)).toEqual([5]);
  });
  it('turns frequencies into notes and cents', () => {
    const a = describeFrequency(440);
    expect([a.name, a.octave, a.cents]).toEqual(['A', 4, 0]);
    const e = describeFrequency(82.41 * Math.pow(2, 10 / 1200));
    expect([e.name, e.octave, e.cents]).toEqual(['E', 2, 10]);
  });
  it('walks the alphabet and half steps', () => {
    expect(nextNatural('G')).toBe('A');
    expect(nextNatural('C', -1)).toBe('B');
    expect(nextSemitone('B')).toBe('C');
    expect(nextSemitone('E')).toBe('F');
    expect(nextSemitone('F')).toBe('F#');
  });
});
