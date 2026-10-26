/**
 * Every place the player can be, with its one main action, its sound
 * commands, how to get out, and the one line that says what to do.
 * A test checks that no state is a dead end.
 */
import type { Command } from './commands';

export interface FlowState {
  title: string;
  /** The big button: a command, 'NOTE' when the app waits for a played note, or 'TAP' for a screen-only choice (sign in). */
  primary: Command | 'NOTE' | 'TAP';
  /** Commands that work here, with the label on the button. */
  commands: Partial<Record<Command, string>>;
  /** How to leave: a command, or a tap target named in words. */
  escape: Command | string;
  /** What to do now, in one line. */
  hint: string;
}

export const FLOW = {
  welcome: {
    title: 'Welcome',
    primary: 'ENTER',
    commands: { ENTER: "Let's go" },
    escape: 'I already have an account',
    hint: 'Takes about two minutes. You can change everything later.',
  },
  level: {
    title: 'Your level',
    primary: 'ENTER',
    commands: { ENTER: 'Continue', BACK: 'Back' },
    escape: 'BACK',
    hint: 'Pick the closest one. You can open any lesson later.',
  },
  goal: {
    title: 'Practice spot',
    primary: 'ENTER',
    commands: { ENTER: 'Done', BACK: 'Back' },
    escape: 'BACK',
    hint: 'Short, focused practice beats long, distracted practice.',
  },
  mic: {
    title: 'Mic and tuning',
    primary: 'ENTER',
    commands: { ENTER: 'Sounds good', BACK: 'Back' },
    escape: 'Continue without the mic',
    hint: 'Pluck the thickest string, open.',
  },
  remote: {
    title: 'Sound remote',
    primary: 'ENTER',
    commands: { ENTER: 'Continue', BACK: 'Back' },
    escape: "Skip, I'll tap the screen",
    hint: 'Let the open low E ring for half a second.',
  },
  firstWin: {
    title: 'First notes',
    primary: 'NOTE',
    commands: {},
    escape: 'Skip',
    hint: 'Play the note that glows. It waits for you.',
  },
  signup: {
    title: 'Save your progress',
    primary: 'TAP',
    commands: { BACK: 'Later' },
    escape: 'BACK',
    hint: 'Keep your stars and streak on every device.',
  },
  lessonHome: {
    title: 'Lesson',
    primary: 'ENTER',
    commands: { ENTER: 'Next step', DEMO: 'Listen', GUIDE: 'Theory', BACK: 'Path' },
    escape: 'BACK',
    hint: 'Play the open low E to start, or tap the button.',
  },
  learn: {
    title: 'Theory',
    primary: 'ENTER',
    commands: { ENTER: 'Got it', DEMO: 'Hear it', BACK: 'Back' },
    escape: 'BACK',
    hint: 'One idea, then you play it.',
  },
  listen: {
    title: 'Listen',
    primary: 'ENTER',
    commands: { ENTER: "I'm ready to play", DEMO: 'Play again', BACK: 'Lesson' },
    escape: 'BACK',
    hint: 'Just listen. Follow the dot on the neck.',
  },
  run: {
    title: 'Play',
    primary: 'NOTE',
    commands: {},
    escape: 'Stop playing for a few seconds to pause',
    hint: 'Play the note that glows.',
  },
  runReady: {
    title: 'Ready',
    primary: 'ENTER',
    commands: { ENTER: 'Start', DEMO: 'Listen first', BACK: 'Lesson' },
    escape: 'BACK',
    hint: 'Four clicks count you in.',
  },
  paused: {
    title: 'Paused',
    primary: 'ENTER',
    commands: { ENTER: 'Continue', AGAIN: 'Restart', DEMO: 'Hear the note', BACK: 'Lesson' },
    escape: 'BACK',
    hint: 'Take a breath. Play the open low E to go on.',
  },
  results: {
    title: 'Results',
    primary: 'ENTER',
    commands: { ENTER: 'Next', AGAIN: 'Play again', BACK: 'Lesson' },
    escape: 'BACK',
    hint: 'Low E for the next lesson, A to play again.',
  },
  path: {
    title: 'Path',
    primary: 'ENTER',
    commands: { ENTER: 'Play current lesson', BACK: 'Back' },
    escape: 'BACK',
    hint: 'Pick any open lesson.',
  },
  account: {
    title: 'Account',
    primary: 'BACK',
    commands: { BACK: 'Back' },
    escape: 'BACK',
    hint: 'Sign in to keep your progress on every device.',
  },
} satisfies Record<string, FlowState>;

export type FlowId = keyof typeof FLOW;
