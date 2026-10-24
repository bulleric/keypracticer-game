// Injected into the page before the app loads (Playwright addInitScript).
// Replaces the microphone with a synthetic guitar, and adds a small bot that
// "plays" whatever the app asks for. The app's own pitch pipeline (Web Audio
// -> pitchy tracker) is what gets tested.
(() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let dest = null;
  let current = null;
  function ensure() {
    if (ctx) return;
    ctx = new AC();
    dest = ctx.createMediaStreamDestination();
    // Room noise
    const len = ctx.sampleRate * 2;
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() - 0.5) * 0.004;
    const ns = ctx.createBufferSource();
    ns.buffer = nb;
    ns.loop = true;
    ns.connect(dest);
    ns.start();
  }
  function ks(freq, seconds, sr) {
    const period = sr / freq + 0.5;
    const n = Math.floor(period);
    const frac = period - n;
    const coef = (1 - frac) / (1 + frac);
    const delay = new Float32Array(n);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      prev = 0.5 * (Math.random() - 0.5) + 0.5 * prev;
      delay[i] = prev;
    }
    let mean = 0;
    for (let i = 0; i < n; i++) mean += delay[i] / n;
    let max = 0;
    for (let i = 0; i < n; i++) {
      delay[i] -= mean;
      max = Math.max(max, Math.abs(delay[i]));
    }
    for (let i = 0; i < n; i++) delay[i] = (delay[i] / max) * 0.4;
    const out = new Float32Array(Math.floor(seconds * sr));
    let idx = 0, apX = 0, apY = 0;
    for (let i = 0; i < out.length; i++) {
      const cur = delay[idx];
      const nxt = delay[(idx + 1) % n];
      const avg = 0.996 * 0.5 * (cur + nxt);
      const y = coef * avg + apX - coef * apY;
      apX = avg;
      apY = y;
      out[i] = cur;
      delay[idx] = y;
      idx = (idx + 1) % n;
    }
    return out;
  }
  window.__plucks = [];
  window.__pluck = (midi, seconds = 1.2) => {
    ensure();
    if (ctx.state !== 'running') ctx.resume();
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const data = ks(freq, seconds, ctx.sampleRate);
    const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.copyToChannel(data, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(dest);
    // A new pluck damps the string that was ringing.
    if (current) try { current.stop(ctx.currentTime + 0.005); } catch (e) {}
    src.start();
    current = src;
    window.__plucks.push({ midi, at: performance.now() / 1000 });
  };
  navigator.mediaDevices.getUserMedia = async () => {
    ensure();
    await ctx.resume();
    return dest.stream;
  };

  // ---- bot -------------------------------------------------------------
  window.__bot = { on: true, wrongEvery: 0, count: 0, delay: 0.6, beatLead: 0 };
  let last = null;
  let store;
  const timers = [];
  function act(info) {
    const bot = window.__bot;
    if (!bot.on || !info || !info.question || !info.micOn) return;
    const q = info.question;
    if (q === last) return;
    last = q;
    if (!q.acceptMidis || !q.acceptMidis.length) return;
    // A pad question with mic on is answered with the pad by the test driver.
    if (q.input === 'pad') return;
    bot.count++;
    let midi = q.acceptMidis[0];
    if (bot.wrongEvery && bot.count % bot.wrongEvery === 0) midi += 2;
    let wait = bot.delay;
    if (info.rhythm && info.rhythm.promptTime) wait = 0.35;
    if (info.rhythm && info.rhythm.beatTime) {
      // Beat drills: aim at this beat (the callback fires at the click).
      wait = Math.max(0, info.rhythm.beatTime - performance.now() / 1000 - bot.beatLead);
    }
    timers.push(setTimeout(() => window.__pluck(midi), wait * 1000));
    lastPluck = performance.now() / 1000 + wait;
  }
  // If the app still waits on the same question (after a wrong note), play the right one.
  let lastPluck = 0;
  setInterval(() => {
    const info = store;
    if (!window.__bot.on || !info || !info.question || !info.micOn || info.rhythm) return;
    const q = info.question;
    if (q !== last || !q.acceptMidis || q.input === 'pad') return;
    if (performance.now() / 1000 - lastPluck > 1.6) {
      lastPluck = performance.now() / 1000;
      window.__pluck(q.acceptMidis[0]);
    }
  }, 200);
  Object.defineProperty(window, '__NT__', {
    configurable: true,
    get() { return store; },
    set(v) { store = v; try { act(v); } catch (e) { console.error(e); } },
  });
})();
