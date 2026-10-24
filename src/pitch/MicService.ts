import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { openMic, MicError, type MicHandle } from './mic';
import { PitchTracker, type PitchFrame, type PlayedNote } from './tracker';

export type MicStatus = 'off' | 'starting' | 'on' | 'error';

interface MicState {
  status: MicStatus;
  error: string | null;
  errorCode: string | null;
}

/**
 * One mic for the whole app. Screens subscribe to frames (for the tuner and
 * level meter) and to notes (answers).
 */
class MicServiceImpl {
  private handle: MicHandle | null = null;
  private tracker: PitchTracker | null = null;
  private state: MicState = { status: 'off', error: null, errorCode: null };
  private stateListeners = new Set<() => void>();
  private frameListeners = new Set<(f: PitchFrame) => void>();
  private noteListeners = new Set<(n: PlayedNote) => void>();
  private minRms = 0.01;
  private starting: Promise<void> | null = null;

  getState = () => this.state;

  subscribe = (l: () => void) => {
    this.stateListeners.add(l);
    return () => {
      this.stateListeners.delete(l);
    };
  };

  private setState(s: Partial<MicState>) {
    this.state = { ...this.state, ...s };
    this.stateListeners.forEach((l) => l());
  }

  /** 0 (deaf) .. 1 (very sensitive). */
  setSensitivity(v: number) {
    this.minRms = 0.03 * Math.pow(0.05, v); // 0.03 .. 0.0015
    if (this.tracker) this.tracker.minRms = this.minRms;
  }

  onFrame(l: (f: PitchFrame) => void) {
    this.frameListeners.add(l);
    return () => {
      this.frameListeners.delete(l);
    };
  }

  onNote(l: (n: PlayedNote) => void) {
    this.noteListeners.add(l);
    return () => {
      this.noteListeners.delete(l);
    };
  }

  /** Forget the note that is ringing, e.g. when a new question starts. */
  resetNote() {
    this.tracker?.reset();
  }

  async start(): Promise<void> {
    if (this.state.status === 'on') return;
    if (this.starting) return this.starting;
    this.setState({ status: 'starting', error: null, errorCode: null });
    this.starting = (async () => {
      try {
        this.handle = await openMic((samples, endTime, sampleRate) => {
          if (!this.tracker || this.tracker.sampleRate !== sampleRate) this.makeTracker(sampleRate);
          this.tracker!.push(samples, endTime);
        });
        this.setState({ status: 'on' });
      } catch (e: any) {
        const code = e instanceof MicError ? e.code : 'unavailable';
        this.setState({ status: 'error', error: e?.message ?? String(e), errorCode: code });
      } finally {
        this.starting = null;
      }
    })();
    return this.starting;
  }

  async stop(): Promise<void> {
    const h = this.handle;
    this.handle = null;
    this.tracker = null;
    if (h) await h.stop();
    this.setState({ status: 'off' });
  }

  private makeTracker(sampleRate: number) {
    const t = new PitchTracker({ sampleRate, minRms: this.minRms, hopSize: Math.round(sampleRate / 86) });
    t.onFrame((f) => this.frameListeners.forEach((l) => l(f)));
    t.onNote((n) => this.noteListeners.forEach((l) => l(n)));
    this.tracker = t;
  }
}

export const MicService = new MicServiceImpl();

export function useMicState(): MicState {
  return useSyncExternalStore(MicService.subscribe, MicService.getState, MicService.getState);
}

/** Latest frame, throttled for drawing (tuner, level meter). */
export function useMicFrame(fps = 20): PitchFrame | null {
  const [frame, setFrame] = useState<PitchFrame | null>(null);
  const last = useRef(0);
  const lastNote = useRef<PitchFrame | null>(null);
  useEffect(() => {
    return MicService.onFrame((f) => {
      // Hold the last heard note a little so the tuner doesn't flicker.
      if (f.note) lastNote.current = f;
      const t = f.time;
      if (t - last.current < 1 / fps) return;
      last.current = t;
      const held = !f.note && lastNote.current && t - lastNote.current.time < 0.3 ? { ...f, note: lastNote.current.note } : f;
      setFrame(held);
    });
  }, [fps]);
  return frame;
}

/** Call `cb` for every confirmed played note. */
export function useMicNotes(cb: (n: PlayedNote) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => MicService.onNote((n) => ref.current(n)), []);
}
