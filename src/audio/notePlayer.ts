import { pluck } from '../pitch/guitarSynth';
import { now } from './clock';
import { getAudioContext, outputLatency, resumeAudio } from './context';

/**
 * Plays guitar-like notes (Karplus-Strong synth) so you can hear a note or a
 * whole phrase. `busyUntil()` says until when our own sound is playing, so the
 * mic can ignore it.
 */
const cache = new Map<string, any>();
let busy = 0;
const sources: any[] = [];

function buffer(ctx: any, midi: number, seconds: number) {
  const key = `${midi}:${seconds}:${ctx.sampleRate}`;
  let b = cache.get(key);
  if (!b) {
    const data = pluck(440 * Math.pow(2, (midi - 69) / 12), seconds, ctx.sampleRate, { amplitude: 0.45, brightness: 0.4, decay: 0.997 });
    b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.copyToChannel(data, 0);
    cache.set(key, b);
  }
  return b;
}

/** Play notes `step` seconds apart. Returns the app-clock time the first one is heard. */
export async function playNotes(midis: number[], step = 0.5, ring = 1.0): Promise<number> {
  await resumeAudio().catch(() => {});
  const ctx = getAudioContext() as any;
  stopNotes();
  const start = ctx.currentTime + 0.08;
  midis.forEach((m, i) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer(ctx, m, Math.max(ring, step + 0.2));
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    src.connect(gain);
    gain.connect(ctx.destination);
    const t = start + i * step;
    src.start(t);
    // A new note damps the previous one, like a real string.
    src.stop(t + (i < midis.length - 1 ? step + 0.03 : ring));
    sources.push(src);
  });
  const heard = now() + (start - ctx.currentTime) + outputLatency(ctx);
  busy = heard + (midis.length - 1) * step + ring + 0.15;
  return heard;
}

export function playNote(midi: number) {
  return playNotes([midi], 0.5, 1.0);
}

export function stopNotes() {
  while (sources.length) {
    try {
      sources.pop().stop();
    } catch {}
  }
  busy = Math.min(busy, now() + 0.15);
}

/** App-clock time until which the speaker is playing our own notes. */
export function busyUntil(): number {
  return busy;
}
