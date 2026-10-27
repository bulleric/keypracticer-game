/**
 * Sound remote: open strings work as buttons. The letter of the string is the
 * first letter of the action, so there is nothing to memorise.
 *
 *   E (low E or high e) Enter · A Again · D Demo · G Guide · B Back
 *
 * Pure logic: feed it pitch frames, it says when a command fires. A string must
 * ring for HOLD_S so a stray strum never jumps screens.
 */

export type Command = 'ENTER' | 'AGAIN' | 'DEMO' | 'GUIDE' | 'BACK';

export const COMMANDS: Record<Command, { letter: string; label: string; midis: number[] }> = {
  ENTER: { letter: 'E', label: 'Enter', midis: [40, 64] },
  AGAIN: { letter: 'A', label: 'Again', midis: [45] },
  DEMO: { letter: 'D', label: 'Demo', midis: [50] },
  GUIDE: { letter: 'G', label: 'Guide', midis: [55] },
  BACK: { letter: 'B', label: 'Back', midis: [59] },
};

export const COMMAND_ORDER: Command[] = ['ENTER', 'AGAIN', 'DEMO', 'GUIDE', 'BACK'];

/** How long the open string has to ring. */
export const HOLD_S = 0.5;
/** Short gaps (a frame or two of no pitch) don't break the hold. */
const GAP_S = 0.12;
/** After a command fires, the same string must stop before it can fire again. */
const REARM_S = 0.25;

const BY_MIDI = new Map<number, Command>();
for (const c of COMMAND_ORDER) for (const m of COMMANDS[c].midis) BY_MIDI.set(m, c);

export function commandForMidi(midi: number): Command | null {
  return BY_MIDI.get(midi) ?? null;
}

export interface CommandState {
  /** The command being held, and since when. */
  cmd: Command | null;
  since: number;
  lastSeen: number;
  /** The command that just fired; it must be released before it fires again. */
  fired: Command | null;
  firedLastSeen: number;
}

export const IDLE: CommandState = { cmd: null, since: 0, lastSeen: 0, fired: null, firedLastSeen: 0 };

export interface Frame {
  midi: number | null;
  /** Cents off the nearest note; open strings more than 35 cents off don't count. */
  cents?: number;
  time: number;
}

/**
 * Next state for one pitch frame. `fire` is set on the frame the hold
 * completes; `progress` (0..1) drives the filling ring on the button.
 */
export function feedCommand(s: CommandState, f: Frame): { state: CommandState; fire: Command | null; progress: number; holding: Command | null } {
  const heard = f.midi !== null && Math.abs(f.cents ?? 0) <= 35 ? commandForMidi(f.midi) : null;
  let st = s;
  // The string that just fired must stop ringing before it can fire again.
  if (st.fired) {
    if (heard === st.fired) return { state: { ...st, cmd: null, firedLastSeen: f.time }, fire: null, progress: 0, holding: null };
    if (f.time - st.firedLastSeen > REARM_S) st = { ...st, fired: null };
  }

  if (!heard) {
    // Keep a hold alive through a short gap.
    if (st.cmd && f.time - st.lastSeen <= GAP_S) {
      return { state: st, fire: null, progress: Math.min(1, (st.lastSeen - st.since) / HOLD_S), holding: st.cmd };
    }
    return { state: { ...st, cmd: null }, fire: null, progress: 0, holding: null };
  }
  if (heard !== st.cmd || f.time - st.lastSeen > GAP_S) st = { ...st, cmd: heard, since: f.time };
  st = { ...st, lastSeen: f.time };
  const held = f.time - st.since;
  if (held >= HOLD_S) {
    return { state: { ...st, cmd: null, fired: heard, firedLastSeen: f.time }, fire: heard, progress: 1, holding: heard };
  }
  return { state: st, fire: null, progress: held / HOLD_S, holding: heard };
}
