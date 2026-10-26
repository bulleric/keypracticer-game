/**
 * Everything you practice becomes a timeline of notes. Scales come from the
 * Keypracticer theory port today; licks and solos (tabs) and backing tracks
 * plug in as other sources later, and every mode (Listen, Play, Beat) runs on
 * the same timeline.
 */
import { toExercise, type RunSetup } from '../practice/game';
import { buildExercise, type ExNote, type Exercise } from '../practice/theory';

export interface NoteEvent {
  /** Start, in beats from the first note. */
  beat: number;
  /** Length in beats. */
  dur: number;
  midi: number;
  string: number;
  fret: number;
  /** Interval from the root: 'R', 'b3', ... (drives colours and theory). */
  degree: string;
  name: string;
  /** For licks later: bends, slides, hammer-ons. */
  tech?: 'bend' | 'slide' | 'hammer' | 'pull' | 'vibrato';
}

export interface Timeline {
  id: string;
  title: string;
  key: string;
  scale: string | null;
  /** Beats per minute. */
  tempo: number;
  notes: NoteEvent[];
  /** The Keypracticer exercise the reel draws. */
  exercise: Exercise;
}

export type Source = { kind: 'scale'; setup: RunSetup };
// Later: | { kind: 'tab'; tab: TabJson } | { kind: 'remix'; seed: string }

export function fromSource(src: Source): Timeline {
  const { setup } = src;
  const exercise = buildExercise(toExercise(setup));
  const per = setup.perBeat;
  return {
    id: exercise.id,
    title: exercise.title,
    key: setup.key,
    scale: exercise.scale,
    tempo: setup.bpm,
    exercise,
    notes: exercise.notes.map((n: ExNote, i) => ({ beat: i / per, dur: 1 / per, midi: n.midi, string: n.string, fret: n.fret, degree: n.interval, name: n.name })),
  };
}

/** Seconds between notes at a tempo, for Listen mode and the metronome. */
export function secondsPerNote(bpm: number, perBeat: number): number {
  return 60 / bpm / perBeat;
}

/** The lowest fret of the box (0 for open position), for finger hints. */
export function boxLowFret(t: Timeline): number {
  return Math.min(...t.exercise.box.map((n) => n.fret));
}
