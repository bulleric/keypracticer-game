/**
 * A tiny plucked-string synth (Karplus-Strong). Used by tests and the
 * developer "fake guitar" so the pitch pipeline can be checked without a
 * real instrument.
 */
export function pluck(
  frequency: number,
  seconds: number,
  sampleRate = 44100,
  opts: { decay?: number; amplitude?: number; seed?: number; brightness?: number } = {},
): Float32Array {
  const { decay = 0.996, amplitude = 0.5, brightness = 0.5 } = opts;
  let seed = opts.seed ?? 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };
  // The two-point average reads one sample ahead, so the loop is n - 0.5 + frac long.
  const period = sampleRate / frequency + 0.5;
  const n = Math.max(2, Math.floor(period));
  const frac = period - n; // fractional part via a first-order allpass
  const coef = (1 - frac) / (1 + frac);
  const delay = new Float32Array(n);
  // Noise burst, softened for a less harsh pick.
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const r = rand();
    prev = brightness * r + (1 - brightness) * prev;
    delay[i] = prev;
  }
  // Remove DC and normalise the burst.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += delay[i] / n;
  for (let i = 0; i < n; i++) delay[i] -= mean;
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(delay[i]));
  for (let i = 0; i < n; i++) delay[i] = (delay[i] / (max || 1)) * amplitude;

  const out = new Float32Array(Math.floor(seconds * sampleRate));
  let idx = 0;
  let apX = 0;
  let apY = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = delay[idx];
    const next = delay[(idx + 1) % n];
    const avg = decay * 0.5 * (cur + next);
    // allpass for the fractional delay
    const y = coef * avg + apX - coef * apY;
    apX = avg;
    apY = y;
    out[i] = cur;
    delay[idx] = y;
    idx = (idx + 1) % n;
  }
  return out;
}

export function addNoise(buf: Float32Array, level: number, seed = 999): Float32Array {
  let s = seed;
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = buf[i] + (s / 0x7fffffff - 0.5) * 2 * level;
  }
  return out;
}

export function silence(seconds: number, sampleRate = 44100): Float32Array {
  return new Float32Array(Math.floor(seconds * sampleRate));
}

export function concat(...parts: Float32Array[]): Float32Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Float32Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
