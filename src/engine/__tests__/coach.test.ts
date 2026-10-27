import { describeMiss, tuningAdvice, whereIs } from '../coach';

const G = { midi: 55, string: 4, fret: 5 }; // G on the D string, fret 5

describe('coach', () => {
  test('a wrong note says how far off it was', () => {
    expect(describeMiss(G, 56)).toBe('You played G#: one fret too high. Go to fret 5.');
    expect(describeMiss(G, 53)).toBe('You played F: 2 frets too low. Go to fret 5.');
  });
  test('octave mistakes are named', () => {
    expect(describeMiss(G, 67)).toContain('one octave too high');
  });
  test('far misses point to the string and fret', () => {
    expect(describeMiss(G, 62)).toBe('You played D. Look for the D string, fret 5.');
  });
  test('where a note is, with the finger', () => {
    expect(whereIs(G, 5)).toBe('D string, fret 5, index finger');
    expect(whereIs({ midi: 48, string: 6, fret: 8 }, 5)).toBe('Low E string, fret 8, pinky finger');
    expect(whereIs({ midi: 40, string: 6, fret: 0 }, 0)).toBe('Open low E string');
  });
  test('tuning advice', () => {
    expect(tuningAdvice(4).ok).toBe(true);
    expect(tuningAdvice(-30).text).toContain('flat');
    expect(tuningAdvice(30).text).toContain('sharp');
  });
});
