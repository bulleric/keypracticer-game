/**
 * The theory behind every practice: one idea per lesson (two at most), with
 * something to hear and one thing to listen for while you play. And the
 * lesson ladder: Learn, Listen, then the run (Play or Beat).
 */
import type { Rungs } from '../store/model';
import { getLevel, type Level, type PentaProfile } from './game';
import type { Exercise } from './theory';

export type Hear =
  | { kind: 'box' }
  | { kind: 'roots' }
  | { kind: 'degree'; degree: string }
  | { kind: 'exercise'; notes?: number }
  | { kind: 'click'; bpm: number; perBeat: 1 | 2 };

export interface TheoryCard {
  title: string;
  body: string;
  listenFor: string;
  hear: Hear;
  hearLabel: string;
  /** Intervals to draw bigger on the neck. Empty = the whole box evenly. */
  emphasize: string[];
}

const T = (title: string, body: string, listenFor: string, hear: Hear, hearLabel: string, emphasize: string[] = []): TheoryCard => ({
  title,
  body,
  listenFor,
  hear,
  hearLabel,
  emphasize,
});

export const THEORY: Record<number, TheoryCard[]> = {
  1: [
    T(
      'A scale is a family of notes',
      'A scale is a set of notes that sound good together. The first one, the root, is home: melodies like to start and end there. The minor pentatonic has five notes: A C D E G in the key of A.',
      'How the root A sounds like "home".',
      { kind: 'box' },
      'Hear box 1',
      ['R'],
    ),
    T(
      'Every note has a number',
      'The numbers say how far a note is from the root: R b3 4 5 b7. They are the same in every key, so learn the numbers and you can play in any key. Each number has its own colour.',
      'The colours: red is always the root.',
      { kind: 'exercise', notes: 5 },
      'Hear R b3 4 5 b7',
    ),
  ],
  2: [
    T(
      'Octaves: the root comes back',
      'An octave is the same note, higher. In box 1 the root A is on the low E string (fret 5), the D string (fret 7) and the high e string (fret 5). Box 1 holds two full octaves.',
      'The high A sounds the same as the low A, only brighter.',
      { kind: 'roots' },
      'Hear the three A notes',
      ['R'],
    ),
  ],
  3: [
    T(
      'Beat and tempo',
      'The beat is the pulse you tap your foot to. Tempo is how fast it goes, in beats per minute (BPM). Here you play one note per click: those are quarter notes.',
      'Land on the click, not after it.',
      { kind: 'click', bpm: 60, perBeat: 1 },
      'Hear 60 BPM',
    ),
  ],
  4: [
    T(
      'Sequences build licks',
      'A sequence is a short shape repeated up the scale: three notes forward, one step back. Most guitar licks are built this way, and it trains your fingers to move freely in the box.',
      'The same three-note shape, moving up.',
      { kind: 'exercise', notes: 9 },
      'Hear the sequence',
    ),
  ],
  5: [
    T(
      'Two notes per click',
      'Eighth notes split each beat in two. Count "1 and 2 and": one note on the number, one on the "and". Same tempo as before, twice the notes.',
      'Even spacing between the two notes.',
      { kind: 'click', bpm: 60, perBeat: 2 },
      'Hear eighths at 60',
    ),
  ],
  6: [
    T(
      'Boxes overlap',
      'Box 2 starts where box 1 ends: the top notes of box 1 are the bottom notes of box 2. Learn the shared notes and you can slide from one box into the next.',
      'Same five notes, a little higher on the neck.',
      { kind: 'box' },
      'Hear box 2',
    ),
  ],
  7: [
    T(
      'The b3 makes it minor',
      'The flat third (b3) is three frets above the root. It gives the minor pentatonic its sad, bluesy sound. Swap it for a normal 3 and the music turns happy.',
      'The b3 (yellow) right after the root.',
      { kind: 'degree', degree: 'b3' },
      'Hear R then b3',
      ['R', 'b3'],
    ),
  ],
  8: [
    T(
      'Find roots with octave shapes',
      'Box 3 has its roots on the A string (fret 12) and the B string (fret 10). Octave shapes help you find them: from a root on the low E or A string, two strings up and two frets up is the same note, one octave higher.',
      'The two roots, one octave apart.',
      { kind: 'roots' },
      'Hear the roots',
      ['R'],
    ),
  ],
  9: [
    T(
      'The 5: strong and stable',
      'The fifth is seven frets above the root. Root and fifth together are a power chord. Ending a phrase on the 5 sounds solid, almost finished.',
      'How the 5 (blue) feels like a safe landing.',
      { kind: 'degree', degree: '5' },
      'Hear R then 5',
      ['R', '5'],
    ),
  ],
  10: [
    T(
      'Thirds turn a scale into a melody',
      'Playing in thirds means skipping one note each time: 1 to 3, 2 to 4, and so on. The jumps sound like a tune instead of a staircase.',
      'The melody hiding in the skips.',
      { kind: 'exercise', notes: 8 },
      'Hear thirds',
    ),
  ],
  11: [
    T(
      'Open strings and the 12th fret',
      'Box 4 sits at the nut and uses open strings. Everything on the guitar repeats 12 frets higher, so this box comes back at frets 12 to 15.',
      'Open strings ring longer than fretted notes.',
      { kind: 'box' },
      'Hear box 4',
    ),
  ],
  12: [
    T(
      'Clean notes need muting',
      'Open strings keep ringing and blur into the next note. Lift the finger or touch the string with your palm to stop it. Clean playing is as much about silence as about notes.',
      'Silence between the notes.',
      { kind: 'exercise', notes: 6 },
      'Hear clean notes',
    ),
  ],
  13: [
    T(
      'Five boxes, one map',
      'Box 5 joins box 4 and box 1. Now the five boxes cover the whole neck. After box 5 the cycle starts again 12 frets higher.',
      'Box 5 leading back into box 1.',
      { kind: 'box' },
      'Hear box 5',
    ),
  ],
  14: [
    T(
      'The b7 pulls home',
      'The flat seventh sits two frets below the root. It creates a little tension that wants to resolve to the root. Blues and rock solos use that pull all the time.',
      'The pull from b7 (purple) back to R.',
      { kind: 'degree', degree: 'b7' },
      'Hear b7 then R',
      ['b7', 'R'],
    ),
  ],
  15: [
    T(
      'Groups of three over two',
      'Groups of three notes played as eighths (two per click) do not line up with the beat. The accent moves every time, which sounds exciting. Count the clicks, not the groups.',
      'The accent shifting across the beat.',
      { kind: 'exercise', notes: 12 },
      'Hear it',
    ),
  ],
  16: [
    T(
      'Relative major and minor',
      'C major pentatonic and A minor pentatonic use the same five notes. Only home moves: the root is now C. Every box you learned counts twice.',
      'C sounding like the new home.',
      { kind: 'box' },
      'Hear C major, box 5',
      ['R'],
    ),
  ],
  17: [
    T(
      'Move the shape, change the key',
      'The fret of the root on the low E string names the key. Move box 1 so the root sits on the open low E and you are in E minor.',
      'Same melody, lower.',
      { kind: 'box' },
      'Hear E minor, box 1',
      ['R'],
    ),
  ],
  18: [
    T(
      'The major pentatonic',
      'Major pentatonic: R 2 3 5 6. No b3 and no b7, so it sounds bright and open. Think country, pop and southern rock.',
      'The happy 3 (yellow).',
      { kind: 'degree', degree: '3' },
      'Hear R then 3',
      ['R', '3'],
    ),
  ],
  19: [
    T(
      'Any key on the neck',
      'To play in any key, find its root on the low E string and put box 1 there. D is at fret 10, so D minor box 1 starts at fret 10.',
      'The new root at fret 10.',
      { kind: 'roots' },
      'Hear the D roots',
      ['R'],
    ),
  ],
  20: [
    T(
      'Scales fit chords',
      'A pentatonic sounds good over the chords of its key, which is why it works for solos. F major pentatonic over an F chord: every note fits. This is the exercise from the Keypracticer video.',
      'Which notes sound best at the end of a run.',
      { kind: 'box' },
      'Hear F major, box 2',
      ['R'],
    ),
  ],
};

export function theoryFor(levelId: number): TheoryCard[] {
  return THEORY[levelId] ?? [];
}

export type Rung = 'learn' | 'listen' | 'run';

export interface RungInfo {
  id: Rung;
  label: string;
  done: boolean;
}

/** The lesson ladder. The run is "Play" (each note waits) or "On the beat" (metronome). */
export function rungsFor(level: Level, rungs: Rungs | undefined, profile: PentaProfile): RungInfo[] {
  const stars = profile.levels[level.id]?.stars ?? 0;
  return [
    { id: 'learn', label: 'Learn', done: !!rungs?.learn },
    { id: 'listen', label: 'Listen', done: !!rungs?.listen },
    { id: 'run', label: level.setup.mode === 'metronome' ? 'On the beat' : 'Play', done: stars >= 1 },
  ];
}

/** The rung the big button starts. First time: walk up the ladder. After that: play. */
export function nextRung(level: Level, rungs: Rungs | undefined, profile: PentaProfile): Rung {
  const stars = profile.levels[level.id]?.stars ?? 0;
  if (stars >= 1) return 'run';
  if (!rungs?.learn) return 'learn';
  if (!rungs?.listen) return 'listen';
  return 'run';
}

export function lessonLabel(id: number): string {
  const l = getLevel(id);
  return l ? `World ${l.world} · Lesson ${l.id}` : '';
}

/** The notes (and spacing) for a theory card's Hear button. */
export function hearNotes(h: Hear, ex: Exercise): { midis: number[]; step: number } {
  const up = [...ex.box].sort((a, b) => a.midi - b.midi);
  const root = up.find((n) => n.interval === 'R')?.midi ?? up[0].midi;
  switch (h.kind) {
    case 'box':
      return { midis: up.map((n) => n.midi), step: 0.32 };
    case 'roots':
      return { midis: up.filter((n) => n.interval === 'R').map((n) => n.midi), step: 0.7 };
    case 'degree': {
      const d = up.find((n) => n.interval === h.degree && n.midi > root)?.midi ?? up.find((n) => n.interval === h.degree)?.midi ?? root;
      // b7 resolves up to the root; the others go root first.
      return h.degree === 'b7' ? { midis: [d, d + 2, d, d + 2], step: 0.6 } : { midis: [root, d, root, d], step: 0.6 };
    }
    case 'exercise':
      return { midis: ex.notes.slice(0, h.notes ?? ex.notes.length).map((n) => n.midi), step: 0.36 };
    case 'click':
      return { midis: Array.from({ length: 4 * h.perBeat }, () => root), step: 60 / h.bpm / h.perBeat };
  }
}
