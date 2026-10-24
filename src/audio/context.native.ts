import { AudioContext } from 'react-native-audio-api';

/** iOS/Android: react-native-audio-api implements the Web Audio API. */
export type SharedAudioContext = AudioContext;

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export async function resumeAudio(): Promise<void> {
  const c = getAudioContext();
  if (c.state !== 'running') await c.resume();
}

export function outputLatency(_c: AudioContext): number {
  return 0.02;
}
