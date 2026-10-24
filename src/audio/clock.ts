/** One clock for the mic, the metronome and the UI, in seconds. */
export function now(): number {
  return (globalThis.performance?.now?.() ?? Date.now()) / 1000;
}
