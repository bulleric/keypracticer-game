import { PitchTracker, type PlayedNote } from '../tracker';
import { pluck, addNoise, silence, concat } from '../guitarSynth';
import { midiAt, midiToFrequency, STRINGS_LOW_TO_HIGH, noteLabel } from '../../music/notes';

const SR = 44100;

function run(signal: Float32Array, sampleRate = SR, chunk = 1024) {
  const t = new PitchTracker({ sampleRate });
  const notes: PlayedNote[] = [];
  t.onNote((n) => notes.push(n));
  for (let i = 0; i < signal.length; i += chunk) t.push(signal.subarray(i, i + chunk));
  return notes;
}

describe('PitchTracker on synthesized guitar plucks', () => {
  for (const s of STRINGS_LOW_TO_HIGH) {
    it(`detects every fret 0-12 on string ${s}`, () => {
      for (let fret = 0; fret <= 12; fret++) {
        const midi = midiAt(s, fret);
        const sig = concat(silence(0.1), pluck(midiToFrequency(midi), 0.6, SR, { seed: midi * 7 }));
        const notes = run(sig);
        expect(notes.map((n) => noteLabel(n.midi))).toEqual([noteLabel(midi)]);
        expect(Math.abs(notes[0].cents)).toBeLessThan(20);
      }
    });
  }

  it('works at 48 kHz with background noise', () => {
    const sr = 48000;
    for (const midi of [40, 45, 50, 55, 59, 64, 76]) {
      const sig = addNoise(concat(silence(0.1, sr), pluck(midiToFrequency(midi), 0.6, sr, { amplitude: 0.3 })), 0.01);
      const notes = run(sig, sr);
      expect(notes.map((n) => n.midi)).toEqual([midi]);
    }
  });

  it('confirms within ~250 ms of the pluck and reports the onset time', () => {
    const sig = concat(silence(0.5), pluck(midiToFrequency(45), 0.8));
    const notes = run(sig);
    expect(notes).toHaveLength(1);
    expect(notes[0].onsetTime).toBeGreaterThan(0.47);
    expect(notes[0].onsetTime).toBeLessThan(0.53);
    expect(notes[0].confirmTime - 0.5).toBeLessThan(0.3);
  });

  it('counts a re-plucked note again (beat drill)', () => {
    const p = () => pluck(midiToFrequency(40), 1.0, SR, { decay: 0.994 });
    const sig = concat(silence(0.2), p(), p(), p(), p());
    const notes = run(sig);
    expect(notes.map((n) => n.midi)).toEqual([40, 40, 40, 40]);
    const gaps = notes.slice(1).map((n, i) => n.onsetTime - notes[i].onsetTime);
    gaps.forEach((g) => expect(Math.abs(g - 1.0)).toBeLessThan(0.05));
  });

  it('follows a melody of different notes', () => {
    const melody = [45, 47, 48, 50, 52, 53, 55];
    const sig = concat(silence(0.1), ...melody.map((m) => pluck(midiToFrequency(m), 0.5)));
    expect(run(sig).map((n) => n.midi)).toEqual(melody);
  });

  it('ignores silence and quiet noise', () => {
    expect(run(addNoise(silence(1), 0.005))).toEqual([]);
  });
});

describe('PitchTracker robustness', () => {
  it('handles a DC offset from cheap mics', () => {
    const sig = concat(silence(0.1), pluck(midiToFrequency(52), 0.6));
    for (let i = 0; i < sig.length; i++) sig[i] += 0.05;
    const t = new PitchTracker({ sampleRate: SR, minRms: 0.01 });
    const notes: number[] = [];
    t.onNote((n) => notes.push(n.midi));
    for (let i = 0; i < sig.length; i += 1024) t.push(sig.subarray(i, i + 1024));
    expect(notes).toEqual([52]);
  });

  it('marks plucked notes as attacks', () => {
    const sig = concat(silence(0.2), pluck(midiToFrequency(57), 0.6));
    expect(run(sig).map((n) => n.attack)).toEqual([true]);
  });
});
