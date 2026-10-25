import { PitchDetector } from 'pitchy';
import { describeFrequency, type DetectedNote } from '../music/notes';

/**
 * Turns a stream of mic samples into notes.
 *
 * Samples arrive in chunks of any size. Every `hopSize` samples the tracker
 * looks at the last `windowSize` samples, finds the pitch with pitchy (McLeod
 * method), and reports a frame. A note is "played" once the same note is held
 * for `holdMs`, which filters out pick noise. A new pluck (an onset: a jump in
 * loudness) lets the same note count again.
 */

export interface PitchFrame {
  /** Loudness of the newest samples, 0..1. */
  rms: number;
  /** The note heard in this frame, or null for silence/noise. */
  note: DetectedNote | null;
  clarity: number;
  /** Time of the end of this frame, in seconds (caller's clock). */
  time: number;
}

export interface PlayedNote extends DetectedNote {
  /** When the note started (the pluck), in seconds on the caller's clock. */
  onsetTime: number;
  /** When it was confirmed (onset + hold), in seconds. */
  confirmTime: number;
  /** True when the note began with a pluck, false when a ringing note drifted. */
  attack: boolean;
}

export interface TrackerOptions {
  sampleRate: number;
  windowSize?: number;
  hopSize?: number;
  /** How long a note must hold before it counts. */
  holdMs?: number;
  /** pitchy clarity needed (0..1). */
  minClarity?: number;
  /** Minimum loudness. Lower = more sensitive. */
  minRms?: number;
  minFrequency?: number;
  maxFrequency?: number;
  a4?: number;
}

export type FrameListener = (f: PitchFrame) => void;
export type NoteListener = (n: PlayedNote) => void;

export class PitchTracker {
  readonly sampleRate: number;
  readonly windowSize: number;
  readonly hopSize: number;
  holdMs: number;
  minClarity: number;
  minRms: number;
  minFrequency: number;
  maxFrequency: number;
  a4: number;

  private detector: PitchDetector<Float32Array>;
  private ring: Float32Array;
  private window: Float32Array;
  private writePos = 0;
  private filled = 0;
  private sinceHop = 0;
  /** Total samples pushed; used to time frames when no clock is given. */
  private totalSamples = 0;

  private candidateMidi: number | null = null;
  private candidateStart = 0;
  private candidateFrames = 0;
  private candidateAttack = false;
  private confirmedMidi: number | null = null;
  private lastOnset = -Infinity;
  private silentBefore = true;
  private prevHopRms: number[] = [0, 0, 0];

  private frameListeners = new Set<FrameListener>();
  private noteListeners = new Set<NoteListener>();

  constructor(opts: TrackerOptions) {
    this.sampleRate = opts.sampleRate;
    this.windowSize = opts.windowSize ?? 2048;
    this.hopSize = opts.hopSize ?? 512;
    this.holdMs = opts.holdMs ?? 150;
    this.minClarity = opts.minClarity ?? 0.85;
    this.minRms = opts.minRms ?? 0.01;
    this.minFrequency = opts.minFrequency ?? 70;
    this.maxFrequency = opts.maxFrequency ?? 1400;
    this.a4 = opts.a4 ?? 440;
    this.detector = PitchDetector.forFloat32Array(this.windowSize);
    this.ring = new Float32Array(this.windowSize);
    this.window = new Float32Array(this.windowSize);
  }

  onFrame(l: FrameListener): () => void {
    this.frameListeners.add(l);
    return () => this.frameListeners.delete(l);
  }

  onNote(l: NoteListener): () => void {
    this.noteListeners.add(l);
    return () => this.noteListeners.delete(l);
  }

  reset(): void {
    this.candidateMidi = null;
    this.confirmedMidi = null;
    this.candidateFrames = 0;
  }

  /**
   * Feed samples. `endTime` is the time (seconds) of the last sample in the
   * chunk; if omitted, time is counted from the samples pushed so far.
   */
  push(chunk: Float32Array, endTime?: number): void {
    const n = chunk.length;
    const chunkEnd = endTime ?? (this.totalSamples + n) / this.sampleRate;
    for (let i = 0; i < n; i++) {
      this.ring[this.writePos] = chunk[i];
      this.writePos = (this.writePos + 1) % this.windowSize;
      if (this.filled < this.windowSize) this.filled++;
      this.sinceHop++;
      if (this.sinceHop >= this.hopSize && this.filled === this.windowSize) {
        this.sinceHop = 0;
        const t = chunkEnd - (n - 1 - i) / this.sampleRate;
        this.analyze(t);
      }
    }
    this.totalSamples += n;
  }

  private analyze(time: number): void {
    // Unroll the ring buffer into a straight window (oldest first).
    const w = this.window;
    const size = this.windowSize;
    let mean = 0;
    for (let i = 0; i < size; i++) {
      w[i] = this.ring[(this.writePos + i) % size];
      mean += w[i];
    }
    // Remove any DC offset; it confuses the autocorrelation.
    mean /= size;
    if (Math.abs(mean) > 1e-6) for (let i = 0; i < size; i++) w[i] -= mean;

    // Loudness of the newest hop, for onsets, and of the whole window.
    let hopSum = 0;
    for (let i = size - this.hopSize; i < size; i++) hopSum += w[i] * w[i];
    const hopRms = Math.sqrt(hopSum / this.hopSize);

    // Onset: the newest hop is much louder than the recent past.
    const recent = Math.max(...this.prevHopRms);
    const isOnset =
      hopRms > this.minRms * 1.5 &&
      hopRms > recent * 1.8 &&
      time - this.lastOnset > 0.09;
    this.prevHopRms.shift();
    this.prevHopRms.push(hopRms);
    if (isOnset) {
      // Place the onset inside the newest hop, where the energy jumped.
      let peakIdx = size - this.hopSize;
      const thresh = Math.max(recent * 1.8, this.minRms);
      for (let i = size - this.hopSize; i < size; i++) {
        if (Math.abs(w[i]) > thresh) {
          peakIdx = i;
          break;
        }
      }
      this.lastOnset = time - (size - 1 - peakIdx) / this.sampleRate;
      // A new pluck: the same note may count again.
      this.confirmedMidi = null;
      this.candidateMidi = null;
      this.candidateFrames = 0;
    }

    let note: DetectedNote | null = null;
    let clarity = 0;
    if (hopRms >= this.minRms) {
      const [freq, c] = this.detector.findPitch(w, this.sampleRate);
      clarity = c;
      if (c >= this.minClarity && freq >= this.minFrequency && freq <= this.maxFrequency) {
        note = describeFrequency(freq, this.a4);
      }
    } else {
      // Silence: the next sound counts as a new note.
      this.confirmedMidi = null;
    }
    const wasSilent = this.silentBefore;
    if (hopRms < this.minRms) this.silentBefore = true;
    else if (note) this.silentBefore = false;

    this.emitFrame({ rms: hopRms, note, clarity, time });

    if (!note) {
      this.candidateMidi = null;
      this.candidateFrames = 0;
      return;
    }
    if (note.midi !== this.candidateMidi) {
      this.candidateMidi = note.midi;
      // The note started at the onset if one just happened, else now.
      this.candidateAttack = time - this.lastOnset < 0.25 || wasSilent;
      this.candidateStart =
        time - this.lastOnset < 0.25 ? this.lastOnset : time - this.hopSize / this.sampleRate;
      this.candidateFrames = 1;
      return;
    }
    this.candidateFrames++;
    const heldMs = (time - this.candidateStart) * 1000;
    if (
      this.candidateFrames >= 2 &&
      heldMs >= this.holdMs &&
      this.confirmedMidi !== note.midi
    ) {
      this.confirmedMidi = note.midi;
      this.emitNote({ ...note, onsetTime: this.candidateStart, confirmTime: time, attack: this.candidateAttack });
    }
  }

  private emitFrame(f: PitchFrame) {
    this.frameListeners.forEach((l) => l(f));
  }

  private emitNote(n: PlayedNote) {
    this.noteListeners.forEach((l) => l(n));
  }
}
