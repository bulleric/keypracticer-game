import type { NoteName, StringNumber } from '../music/notes';

export type StringStyle = 'name' | 'number' | 'mixed';

/** How a question is answered. */
export type InputKind = 'pad' | 'board' | 'mic';

export interface BoardMark {
  string: StringNumber;
  fret: number;
  label?: string;
  tone?: 'target' | 'hint' | 'good' | 'bad';
}

export interface Question {
  id: string;
  /** Short text on screen. */
  prompt: string;
  /** Second line, e.g. "Tap its number". */
  sub?: string;
  /** Text for the voice (TTS). */
  speak?: string;
  input: InputKind;
  /** Pad answers. */
  padOptions?: string[];
  correctPad?: string;
  /** Board/mic answers: these exact pitches count (string + fret -> midi for taps). */
  acceptMidis?: number[];
  /** Board taps must be on this string (if set). */
  string?: StringNumber;
  /** What to light up on the board. */
  highlightString?: StringNumber;
  highlightFret?: { string?: StringNumber; fret: number };
  /** Show the tuner gauge while answering (step 3). */
  tuner?: boolean;
  /** The note name the learner is looking for, for feedback and hints. */
  target?: NoteName;
  /** Text revealed after the answer, e.g. "Fret 1 on low E is F". */
  reveal?: string;
  /** Hint text shown after 2 misses. */
  hint?: string;
  /** Board mark shown as a hint after 2 misses. */
  hintMark?: BoardMark;
}

export type PassRule =
  | { kind: 'accuracy'; min: number; avgSecondsMax?: number; totalSecondsMax?: number }
  | { kind: 'streak'; count: number }
  | { kind: 'reachBpm'; bpm: number };

export type DrillKind =
  | 'stringNumber'
  | 'openStringName'
  | 'tuner'
  | 'playOpen'
  | 'fretNumber'
  | 'alphabet'
  | 'halfStep'
  | 'playFret'
  | 'nameFret'
  | 'playNote'
  | 'oneNoteAllStrings'
  | 'spokenTap'
  | 'mixed'
  | 'onBeat'
  | 'fretPlay'
  | 'beatSequence';

export interface Range {
  strings: StringNumber[];
  minFret: number;
  maxFret: number;
}

export interface Level {
  id: number;
  world: number;
  title: string;
  drill: DrillKind;
  /** One-line description from the curriculum. */
  description: string;
  questions: number;
  pass: PassRule;
  boss?: boolean;
  range?: Range;
  /** playFret: which fret on each string. */
  fret?: number;
  /** mixed: kinds to alternate between. */
  mix?: DrillKind[];
  /** Voice prompts. */
  voice?: boolean;
  stringStyle?: StringStyle;
  /** Rhythm levels. */
  bpm?: number;
  beatsPerPrompt?: number;
  /** fretPlay ramp: +bpm per clean round, round length. */
  rampBpm?: number;
  roundLength?: number;
  /** beatSequence: fixed sequence of notes to play, one per beat. */
  sequence?: 'alphabet' | 'allStrings';
  /** Wrong mic notes do not count as mistakes (tuner). */
  forgiving?: boolean;
  /** Seconds a "fast" answer takes, for the 2nd star. */
  timeGoal?: number;
  /** Does the level use the mic at all? */
  usesMic: boolean;
}
