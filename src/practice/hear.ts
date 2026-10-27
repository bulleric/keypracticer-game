import { playNotes } from '../audio/notePlayer';
import { hearNotes, type Hear } from './lessons';
import type { Exercise } from './theory';

export function playHear(h: Hear, ex: Exercise) {
  const { midis, step } = hearNotes(h, ex);
  return playNotes(midis, step, 1.0);
}
