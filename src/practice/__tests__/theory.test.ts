import fixture from './keypracticer-fixture.json';
import { buildExercise, configFromCode, practiceCode, type ExerciseConfig, type ExNote, type Pattern } from '../theory';

// keypracticer-fixture.json is made by Keypracticer's own theory.py (build_plan),
// so these tests prove the port plays the same notes as the videos.
type Row = { mode: 'scale' | 'arpeggio'; key: string; name: string; position: number; pattern: Pattern; title: string; positions: number; notes: string; box: string | null };
const enc = (n: ExNote) => `${n.string}:${n.fret}:${n.name}:${n.interval}`;

describe('theory port matches Keypracticer', () => {
  const rows = fixture as Row[];
  it('has fixture rows', () => expect(rows.length).toBeGreaterThan(500));
  it('same notes, boxes, titles and position counts', () => {
    const bad: string[] = [];
    for (const r of rows) {
      const cfg: ExerciseConfig = { mode: r.mode, key: r.key, name: r.name, position: r.position, pattern: r.pattern };
      const ex = buildExercise(cfg);
      if (ex.notes.map(enc).join(' ') !== r.notes) bad.push(`notes ${JSON.stringify(cfg)}`);
      if (r.box && ex.box.map(enc).join(' ') !== r.box) bad.push(`box ${JSON.stringify(cfg)}`);
      if (ex.title !== r.title) bad.push(`title ${ex.title} != ${r.title}`);
      if (ex.positions !== r.positions) bad.push(`positions ${JSON.stringify(cfg)}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

describe('practice codes', () => {
  it('reads the code from the F major pentatonic video', () => {
    expect(configFromCode('FPS2UD80')).toEqual({ mode: 'scale', key: 'F', name: 'Major Pentatonic', position: 2, pattern: 'Up & down' });
  });
  it('round trips codes with digits in the pattern', () => {
    const cfg: ExerciseConfig = { mode: 'scale', key: 'Bb', name: 'Minor Pentatonic', position: 3, pattern: 'Groups of 3' };
    expect(practiceCode(cfg)).toBe('BfMPS3G3');
    expect(configFromCode('BfMPS3G390')).toEqual(cfg);
    expect(configFromCode('bfmps3g390-2')).toEqual(cfg);
  });
  it('rejects nonsense', () => expect(configFromCode('hello')).toBeNull());
});

describe('codes that fit more than one scale', () => {
  it('Major, Mixolydian and Blues share a code; the name picks one', () => {
    const maj: ExerciseConfig = { mode: 'scale', key: 'A', name: 'Major (Ionian)', position: 1, pattern: 'Up' };
    const mix: ExerciseConfig = { ...maj, name: 'Mixolydian' };
    expect(practiceCode(maj)).toBe(practiceCode(mix));
    expect(configFromCode('AS1U90', 'Mixolydian')).toEqual(mix);
    expect(configFromCode('AS1U90', 'Major (Ionian)')).toEqual(maj);
    expect(configFromCode('AS1U90')?.name).toBe('Blues'); // no name: first in picker order
    expect(buildExercise(maj).id).not.toBe(buildExercise(mix).id);
  });
});
