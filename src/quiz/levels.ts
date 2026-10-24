import type { Level, Range } from './types';
import type { StringNumber } from '../music/notes';

const ALL: StringNumber[] = [6, 5, 4, 3, 2, 1];
const r = (strings: StringNumber[], minFret: number, maxFret: number): Range => ({ strings, minFret, maxFret });
const acc = (min = 0.9, extra: { avgSecondsMax?: number; totalSecondsMax?: number } = {}) => ({
  kind: 'accuracy' as const,
  min,
  ...extra,
});
const all = acc(1);

/** Steps 1-40 of the curriculum, as data. Each step is one level. */
export const LEVELS: Level[] = [
  // World 1: Orientation and mic setup
  { id: 1, world: 1, title: 'String numbers', drill: 'stringNumber', description: 'A string lights up. Tap its number (1 to 6).', questions: 10, pass: all, usesMic: false },
  { id: 2, world: 1, title: 'Open string names', drill: 'openStringName', description: 'A string lights up. Pick its name. Eddie Ate Dynamite, Good Bye Eddie.', questions: 10, pass: all, usesMic: false },
  { id: 3, world: 1, title: 'Mic setup and tuner', drill: 'tuner', description: 'Play each open string. The app shows the note it hears and how many cents off it is.', questions: 6, pass: all, forgiving: true, usesMic: true, timeGoal: 8 },
  { id: 4, world: 1, title: 'Play the open strings', drill: 'playOpen', description: 'The app names a string. Play it.', questions: 10, pass: all, usesMic: true },
  { id: 5, world: 1, title: 'Fret numbers and dots', drill: 'fretNumber', description: 'A fret lights up. Tap its number. The dots are at 3, 5, 7, 9 and 12.', questions: 20, pass: acc(), usesMic: false },
  { id: 6, world: 1, title: 'The musical alphabet', drill: 'alphabet', description: 'Which letter comes after G? After B? Before C?', questions: 20, pass: acc(), usesMic: false },
  { id: 7, world: 1, title: 'Half steps: B-C and E-F', drill: 'halfStep', description: 'Pick the next note up. Only B-C and E-F have no note between them.', questions: 20, pass: acc(), usesMic: false },
  { id: 8, world: 1, title: 'One fret = one half step', drill: 'playFret', fret: 1, description: 'Play fret 1 on each string. The app shows what you played.', questions: 6, pass: all, usesMic: true, timeGoal: 6 },
  { id: 9, world: 1, title: 'Fret 12 = open string', drill: 'playFret', fret: 12, description: 'Play fret 12 on each string. Same name, one octave up.', questions: 6, pass: all, usesMic: true, timeGoal: 6 },
  { id: 10, world: 1, title: 'Boss: Stage 1 check', drill: 'mixed', mix: ['openStringName', 'playOpen', 'fretNumber', 'playFret', 'alphabet', 'playOpen'], description: '20 mixed questions, half tapped and half played.', questions: 20, pass: acc(), boss: true, usesMic: true },

  // World 2: Natural notes on low E and A
  { id: 11, world: 2, title: 'Low E, frets 0-5: name it', drill: 'nameFret', range: r([6], 0, 5), description: 'A fret lights up. Pick the note (E F G A).', questions: 20, pass: acc(), usesMic: false },
  { id: 12, world: 2, title: 'Low E, frets 0-5: play it', drill: 'playNote', range: r([6], 0, 5), description: 'The app names a note. Play it on low E.', questions: 20, pass: acc(), usesMic: true },
  { id: 13, world: 2, title: 'Low E, frets 5-12: name it', drill: 'nameFret', range: r([6], 5, 12), description: 'Same drill, higher frets (A B C D E).', questions: 20, pass: acc(), usesMic: false },
  { id: 14, world: 2, title: 'Low E, whole string: play it', drill: 'playNote', range: r([6], 0, 12), description: 'Any natural note, played on low E.', questions: 20, pass: acc(), usesMic: true },
  { id: 15, world: 2, title: 'A string, frets 0-5: name it', drill: 'nameFret', range: r([5], 0, 5), description: 'A fret lights up. Pick the note (A B C D).', questions: 20, pass: acc(), usesMic: false },
  { id: 16, world: 2, title: 'A string, frets 0-5: play it', drill: 'playNote', range: r([5], 0, 5), description: 'The app names a note. Play it on A.', questions: 20, pass: acc(), usesMic: true },
  { id: 17, world: 2, title: 'A string, frets 5-12: name it', drill: 'nameFret', range: r([5], 5, 12), description: 'Same drill, higher frets (D E F G A).', questions: 20, pass: acc(), usesMic: false },
  { id: 18, world: 2, title: 'A string, whole string: play it', drill: 'playNote', range: r([5], 0, 12), description: 'Any natural note, played on A.', questions: 20, pass: acc(), usesMic: true },
  { id: 19, world: 2, title: 'E or A: play it', drill: 'playNote', range: r([6, 5], 0, 12), description: 'The app names a note and a string. Play it.', questions: 20, pass: acc(), usesMic: true },
  { id: 20, world: 2, title: 'Boss: Stage 2 check', drill: 'playNote', range: r([6, 5], 0, 12), description: '20 played prompts on E and A, under 5 seconds each.', questions: 20, pass: acc(0.9, { avgSecondsMax: 5 }), boss: true, usesMic: true },

  // World 3: D, G, B and high e
  { id: 21, world: 3, title: 'High e = low E', drill: 'playNote', range: r([1], 0, 12), description: 'String 1 has the same notes as string 6. Play 10 notes on high e.', questions: 10, pass: acc(), usesMic: true },
  { id: 22, world: 3, title: 'D string: name it', drill: 'nameFret', range: r([4], 0, 12), description: 'A fret lights up on D. Pick the note.', questions: 20, pass: acc(), usesMic: false },
  { id: 23, world: 3, title: 'D string: play it', drill: 'playNote', range: r([4], 0, 12), description: 'The app names a note. Play it on D.', questions: 20, pass: acc(), usesMic: true },
  { id: 24, world: 3, title: 'G string: name it', drill: 'nameFret', range: r([3], 0, 12), description: 'A fret lights up on G. Pick the note.', questions: 20, pass: acc(), usesMic: false },
  { id: 25, world: 3, title: 'G string: play it', drill: 'playNote', range: r([3], 0, 12), description: 'The app names a note. Play it on G.', questions: 20, pass: acc(), usesMic: true },
  { id: 26, world: 3, title: 'B string: name it', drill: 'nameFret', range: r([2], 0, 12), description: 'A fret lights up on B. Pick the note.', questions: 20, pass: acc(), usesMic: false },
  { id: 27, world: 3, title: 'B string: play it', drill: 'playNote', range: r([2], 0, 12), description: 'The app names a note. Play it on B.', questions: 20, pass: acc(), usesMic: true },
  { id: 28, world: 3, title: 'One note, every string', drill: 'oneNoteAllStrings', range: r(ALL, 0, 12), description: 'The app names a note. Play it on all 6 strings, low to high.', questions: 6, pass: acc(1, { totalSecondsMax: 20 }), usesMic: true },
  { id: 29, world: 3, title: 'All naturals, all strings', drill: 'playNote', range: r(ALL, 0, 12), description: 'Random note and string. Play it.', questions: 20, pass: acc(), usesMic: true },
  { id: 30, world: 3, title: 'Boss: Stage 3 check', drill: 'playNote', range: r(ALL, 0, 12), description: '20 played prompts across the whole neck, frets 0 to 12.', questions: 20, pass: acc(0.9, { avgSecondsMax: 4 }), boss: true, usesMic: true },

  // World 4: Fret Play, the exercise from the video
  { id: 31, world: 4, title: 'Spoken prompts', drill: 'spokenTap', range: r(ALL, 0, 12), voice: true, stringStyle: 'name', description: 'The app says "G on the D string" out loud. Tap the fret.', questions: 20, pass: acc(), usesMic: false },
  { id: 32, world: 4, title: 'Spoken prompts, played', drill: 'playNote', range: r(ALL, 0, 12), voice: true, stringStyle: 'name', description: 'Same prompts. Play the note on the guitar.', questions: 20, pass: acc(), usesMic: true },
  { id: 33, world: 4, title: 'String name or number', drill: 'playNote', range: r(ALL, 0, 12), voice: true, stringStyle: 'mixed', description: 'Prompts switch between "the A string" and "string 5".', questions: 20, pass: acc(), usesMic: true },
  { id: 34, world: 4, title: 'Play on the beat', drill: 'onBeat', bpm: 60, description: 'Play open low E on every click at 60 BPM. The app shows early or late.', questions: 24, pass: { kind: 'streak', count: 8 }, usesMic: true },
  { id: 35, world: 4, title: 'Prompts every 4 beats', drill: 'fretPlay', range: r(ALL, 0, 12), bpm: 60, beatsPerPrompt: 4, voice: true, stringStyle: 'name', description: 'A spoken prompt, then play it before the next one.', questions: 20, pass: acc(), usesMic: true },
  { id: 36, world: 4, title: 'Prompts every 2 beats', drill: 'fretPlay', range: r(ALL, 0, 12), bpm: 60, beatsPerPrompt: 2, voice: true, stringStyle: 'name', description: 'Same, with half the time.', questions: 20, pass: acc(), usesMic: true },
  { id: 37, world: 4, title: 'One note, all strings, in time', drill: 'beatSequence', sequence: 'allStrings', range: r(ALL, 0, 12), bpm: 60, voice: true, description: 'Play the note on strings 6, 5, 4, 3, 2, 1, one per beat.', questions: 6, pass: all, usesMic: true },
  { id: 38, world: 4, title: 'Walk the alphabet', drill: 'beatSequence', sequence: 'alphabet', range: r([5], 0, 12), bpm: 60, description: 'Play A B C D E F G on the A string, one per beat.', questions: 7, pass: all, usesMic: true },
  { id: 39, world: 4, title: 'Fret Play mode', drill: 'fretPlay', range: r(ALL, 0, 12), bpm: 60, beatsPerPrompt: 2, rampBpm: 5, roundLength: 8, voice: true, stringStyle: 'mixed', description: 'The full exercise. The tempo rises 5 BPM per clean round.', questions: 80, pass: { kind: 'reachBpm', bpm: 80 }, usesMic: true },
  { id: 40, world: 4, title: 'Boss: Fret Play final', drill: 'fretPlay', range: r(ALL, 0, 12), bpm: 70, beatsPerPrompt: 2, voice: true, stringStyle: 'mixed', description: '30 spoken prompts at 70 BPM, played on the guitar.', questions: 30, pass: acc(), boss: true, usesMic: true },
];

export const WORLDS = [
  { id: 1, name: 'Orientation', subtitle: 'Strings, frets and mic setup' },
  { id: 2, name: 'Low E and A', subtitle: 'Natural notes on the bass strings' },
  { id: 3, name: 'The whole neck', subtitle: 'D, G, B and high e' },
  { id: 4, name: 'Fret Play', subtitle: 'Voice, metronome and your guitar' },
  { id: 5, name: 'Sharps and flats', subtitle: 'Coming soon' },
  { id: 6, name: 'Octave shapes', subtitle: 'Coming soon' },
  { id: 7, name: 'Speed', subtitle: 'Coming soon' },
  { id: 8, name: '24 frets', subtitle: 'Coming soon' },
  { id: 9, name: 'Notes to music', subtitle: 'Coming soon' },
  { id: 10, name: 'Mastery', subtitle: 'Coming soon' },
];

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function isRhythmLevel(l: Level): boolean {
  return l.drill === 'onBeat' || l.drill === 'fretPlay' || l.drill === 'beatSequence';
}
