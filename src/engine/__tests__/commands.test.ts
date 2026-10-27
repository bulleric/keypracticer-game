import { commandForMidi, feedCommand, HOLD_S, IDLE, type CommandState } from '../commands';

function run(frames: { midi: number | null; time: number; cents?: number }[]) {
  let st: CommandState = IDLE;
  const fired: { cmd: string; time: number }[] = [];
  for (const f of frames) {
    const out = feedCommand(st, f);
    st = out.state;
    if (out.fire) fired.push({ cmd: out.fire, time: f.time });
  }
  return fired;
}

/** Frames every 12 ms, like the tracker at 86 hops a second. */
function ring(midi: number | null, from: number, seconds: number, cents = 0) {
  const out = [];
  for (let t = from; t < from + seconds; t += 0.012) out.push({ midi, time: t, cents });
  return out;
}

describe('sound commands', () => {
  test('open strings map to the actions with the same letter', () => {
    expect(commandForMidi(40)).toBe('ENTER');
    expect(commandForMidi(64)).toBe('ENTER');
    expect(commandForMidi(45)).toBe('AGAIN');
    expect(commandForMidi(50)).toBe('DEMO');
    expect(commandForMidi(55)).toBe('GUIDE');
    expect(commandForMidi(59)).toBe('BACK');
    expect(commandForMidi(48)).toBeNull();
  });

  test('a string must ring for half a second', () => {
    expect(run(ring(40, 0, HOLD_S - 0.1))).toEqual([]);
    const f = run(ring(40, 0, HOLD_S + 0.1));
    expect(f).toHaveLength(1);
    expect(f[0].cmd).toBe('ENTER');
    expect(f[0].time).toBeGreaterThanOrEqual(HOLD_S - 0.01);
  });

  test('a long ring fires once; a new pluck after a pause fires again', () => {
    expect(run(ring(40, 0, 2))).toHaveLength(1);
    expect(run([...ring(40, 0, 0.8), ...ring(null, 0.8, 0.4), ...ring(40, 1.2, 0.8)])).toHaveLength(2);
  });

  test('short gaps in the pitch do not break the hold', () => {
    const frames = [...ring(45, 0, 0.25), ...ring(null, 0.25, 0.05), ...ring(45, 0.3, 0.3)];
    expect(run(frames).map((f) => f.cmd)).toEqual(['AGAIN']);
  });

  test('a long gap restarts the hold', () => {
    const frames = [...ring(45, 0, 0.3), ...ring(null, 0.3, 0.3), ...ring(45, 0.6, 0.3)];
    expect(run(frames)).toEqual([]);
  });

  test('scale notes and badly out-of-tune strings are not commands', () => {
    expect(run(ring(48, 0, 1))).toEqual([]);
    expect(run(ring(40, 0, 1, 45))).toEqual([]);
  });

  test('switching strings restarts the hold', () => {
    const f = run([...ring(50, 0, 0.3), ...ring(55, 0.3, 0.6)]);
    expect(f.map((x) => x.cmd)).toEqual(['GUIDE']);
  });
});
