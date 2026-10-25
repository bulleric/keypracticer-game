import { getAudioContext, outputLatency, resumeAudio } from './context';
import { now } from './clock';

export interface Beat {
  index: number;
  /** When the click is heard, on the app clock (seconds). */
  time: number;
}

/**
 * Click track on the shared AudioContext. Clicks are scheduled ahead on the
 * audio clock so they stay steady; `onBeat` fires on the JS side close to
 * each click with its exact time on the app clock (see clock.ts).
 */
export class Metronome {
  bpm: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeatCtx = 0;
  private index = 0;
  private listeners = new Set<(b: Beat) => void>();
  private pending: ReturnType<typeof setTimeout>[] = [];
  /** Beats whose index is a multiple of this get the high click. */
  accentEvery = 4;
  muted = false;

  constructor(bpm: number) {
    this.bpm = bpm;
  }

  onBeat(l: (b: Beat) => void) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  get secondsPerBeat() {
    return 60 / this.bpm;
  }

  async start(delaySeconds = 0.3): Promise<void> {
    await resumeAudio();
    const ctx = getAudioContext();
    this.stop();
    this.index = 0;
    this.nextBeatCtx = ctx.currentTime + delaySeconds;
    const tick = () => {
      const c = getAudioContext();
      while (this.nextBeatCtx < c.currentTime + 0.15) {
        this.schedule(this.index, this.nextBeatCtx);
        this.index++;
        this.nextBeatCtx += 60 / this.bpm;
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.pending.forEach(clearTimeout);
    this.pending = [];
  }

  private schedule(index: number, ctxTime: number) {
    const ctx = getAudioContext() as any;
    if (!this.muted) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = index % this.accentEvery === 0 ? 1500 : 1000;
      gain.gain.setValueAtTime(0.0001, ctxTime);
      gain.gain.linearRampToValueAtTime(0.6, ctxTime + 0.002);
      gain.gain.linearRampToValueAtTime(0.0001, ctxTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctxTime);
      osc.stop(ctxTime + 0.06);
    }
    // Map the audio clock to the app clock.
    const heardAt = now() + (ctxTime - ctx.currentTime) + outputLatency(ctx);
    const wait = Math.max(0, (heardAt - now()) * 1000);
    const t = setTimeout(() => {
      this.pending = this.pending.filter((p) => p !== t);
      this.listeners.forEach((l) => l({ index, time: heardAt }));
    }, wait);
    this.pending.push(t);
  }
}

/** How far a played note is from the nearest beat, in seconds (+ = late). */
export function beatOffset(noteTime: number, beatTime: number, secondsPerBeat: number): number {
  let d = noteTime - beatTime;
  d = ((d % secondsPerBeat) + secondsPerBeat) % secondsPerBeat;
  if (d > secondsPerBeat / 2) d -= secondsPerBeat;
  return d;
}

export type Timing = 'early' | 'on time' | 'late';

export function judgeTiming(offset: number, window = 0.12): Timing {
  if (offset < -window) return 'early';
  if (offset > window) return 'late';
  return 'on time';
}
