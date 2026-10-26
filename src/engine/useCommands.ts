import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { busyUntil } from '../audio/notePlayer';
import { MicService } from '../pitch/MicService';
import { setDebug } from '../debug';
import { feedCommand, IDLE, type Command, type CommandState } from './commands';

/**
 * The intent bus. Every action the player can take between runs is a Command.
 * Touch, the keyboard (web) and the guitar (open strings) all end up here, so a
 * screen handles each action once.
 *
 * Screens register their handlers with useCommands(); only the screen on top
 * (the last one registered and focused) gets them. While nobody is registered,
 * for example during a run, guitar notes are never treated as commands.
 */

type Handlers = Partial<Record<Command, () => void>>;

interface Layer {
  id: number;
  handlers: React.MutableRefObject<Handlers>;
}

const stack: Layer[] = [];
let nextId = 1;
let enabled = true;
let micAllowed = false;

// ---- what the buttons show: which string is ringing and how far the hold is
interface Hold {
  cmd: Command | null;
  progress: number;
  /** Bumps each time a command fires (for a short flash). */
  fired: number;
  firedCmd: Command | null;
}
let hold: Hold = { cmd: null, progress: 0, fired: 0, firedCmd: null };
const holdListeners = new Set<() => void>();
function setHold(h: Hold) {
  if (h.cmd === hold.cmd && Math.abs(h.progress - hold.progress) < 0.04 && h.fired === hold.fired) return;
  hold = h;
  holdListeners.forEach((l) => l());
}
export function useCommandHold(): Hold {
  return useSyncExternalStore(
    (l) => {
      holdListeners.add(l);
      return () => holdListeners.delete(l);
    },
    () => hold,
    () => hold,
  );
}

/** Run a command on the screen on top, whatever triggered it. */
export function dispatch(cmd: Command): boolean {
  const top = stack[stack.length - 1];
  const fn = top?.handlers.current[cmd];
  if (!fn) return false;
  fn();
  return true;
}

/** Turn guitar commands on or off (Settings > Sound control). */
export function setSoundControl(on: boolean) {
  enabled = on;
}

/** The player said yes to the mic (onboarding or Settings): screens with commands may start it. */
export function setMicAllowed(on: boolean) {
  micAllowed = on;
}

export function soundControlOn() {
  return enabled;
}

/** Which commands the screen on top answers to (for the e2e bot and tests). */
export function activeCommands(): Command[] {
  const top = stack[stack.length - 1];
  return top ? (Object.keys(top.handlers.current) as Command[]).filter((k) => !!top.handlers.current[k]) : [];
}

// ---- the guitar: one listener on the mic for the whole app
let cmdState: CommandState = IDLE;
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  MicService.onFrame((f) => {
    if (!enabled || stack.length === 0) {
      cmdState = IDLE;
      if (hold.cmd) setHold({ ...hold, cmd: null, progress: 0 });
      return;
    }
    // Our own speaker (Demo, Hear) must not trigger commands.
    if (f.time < busyUntil()) {
      cmdState = IDLE;
      if (hold.cmd) setHold({ ...hold, cmd: null, progress: 0 });
      return;
    }
    const top = stack[stack.length - 1];
    const out = feedCommand(cmdState, { midi: f.note?.midi ?? null, cents: f.note?.cents, time: f.time });
    cmdState = out.state;
    const can = out.holding && top.handlers.current[out.holding];
    if (out.fire && top.handlers.current[out.fire]) {
      setHold({ cmd: null, progress: 0, fired: hold.fired + 1, firedCmd: out.fire });
      setDebug({ lastCommand: out.fire });
      top.handlers.current[out.fire]!();
      return;
    }
    setHold({ ...hold, cmd: can ? out.holding : null, progress: can ? out.progress : 0 });
  });
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const map: Record<string, Command> = { Enter: 'ENTER', Escape: 'BACK', a: 'AGAIN', d: 'DEMO', g: 'GUIDE', b: 'BACK' };
      const cmd = map[e.key];
      if (cmd && !e.metaKey && !e.ctrlKey && dispatch(cmd)) e.preventDefault();
    });
  }
}

/**
 * Register what this screen does for each command. Handlers can change on
 * every render; only commands with a handler are live.
 */
export function useCommands(handlers: Handlers, active = true) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    wire();
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      const layer: Layer = { id: nextId++, handlers: ref };
      stack.push(layer);
      cmdState = IDLE;
      // Commands need ears: start the mic if the player allowed it.
      if (enabled && micAllowed) MicService.start().catch(() => {});
      publish();
      return () => {
        const i = stack.indexOf(layer);
        if (i >= 0) stack.splice(i, 1);
        cmdState = IDLE;
        setHold({ ...hold, cmd: null, progress: 0 });
        publish();
      };
    }, [active]),
  );
  // Keep the list for the e2e bot current when handlers change.
  useEffect(() => {
    publish();
  });
}

function publish() {
  setDebug({ commands: activeCommands() });
}
