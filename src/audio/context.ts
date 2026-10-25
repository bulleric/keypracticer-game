/**
 * Web: one shared AudioContext for the mic and the metronome.
 * (Native uses context.native.ts.)
 */
export type SharedAudioContext = AudioContext;

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor: typeof AudioContext =
      (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    ctx = new Ctor({ latencyHint: 'interactive' });
  }
  return ctx;
}

/** Browsers start audio suspended until a tap. Call from a press handler. */
export async function resumeAudio(): Promise<void> {
  const c = getAudioContext();
  if (c.state !== 'running') await c.resume();
}

/** Seconds between scheduling a sound and hearing it. */
export function outputLatency(c: AudioContext): number {
  return (c.outputLatency || 0) + (c.baseLatency || 0);
}
