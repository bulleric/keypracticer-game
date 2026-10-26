/** Exposes game state on globalThis.__NT__ for the e2e bot. */
export function setDebug(info: Record<string, unknown>) {
  (globalThis as any).__NT__ = { ...((globalThis as any).__NT__ ?? {}), ...info };
}
