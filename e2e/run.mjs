// End-to-end test of the web build in headless Chromium.
//   npm run build:web && npm run e2e
// Part 1 uses Chromium's own fake mic fed from a WAV of guitar plucks (real
// getUserMedia path) and checks the tuner. Part 2 swaps in a synthetic guitar
// (fake-guitar.js) that plays whatever the app asks, and plays real levels.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

// Playwright is not a project dependency; use a global install (npm i -g playwright).
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8081';
const server = serve();
const results = [];
const only = process.argv[2];

function log(...a) {
  console.log(...a);
}
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

// ---- a WAV of the six open strings, each plucked for 1.5 s ----------------
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
  let mean = delay.reduce((a, b) => a + b, 0) / n;
  let max = 0;
  for (let i = 0; i < n; i++) {
    delay[i] -= mean;
    max = Math.max(max, Math.abs(delay[i]));
  }
  for (let i = 0; i < n; i++) delay[i] = (delay[i] / max) * 0.5;
  const out = new Float32Array(Math.floor(seconds * sr));
  let idx = 0, apX = 0, apY = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = delay[idx];
    const avg = 0.997 * 0.5 * (cur + delay[(idx + 1) % n]);
    const y = coef * avg + apX - coef * apY;
    apX = avg;
    apY = y;
    out[i] = cur;
    delay[idx] = y;
    idx = (idx + 1) % n;
  }
  return out;
}
function writeWav(file, samples, sr) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++)
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

async function tunerWithWav() {
  const sr = 48000;
  const midis = [40, 45, 50, 55, 59, 64];
  const parts = midis.map((m) => ks(440 * Math.pow(2, (m - 69) / 12), 1.5, sr));
  const all = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  for (let i = 0; i < all.length; i++) all[i] += (Math.random() - 0.5) * 0.004;
  const wav = path.join(OUT, 'open-strings.wav');
  writeWav(wav, all, sr);
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  page.on('pageerror', (e) => log('pageerror', e.message));
  await page.goto(`${BASE}/tuner`);
  await page.waitForTimeout(800);
  const startBtn = page.locator('[data-testid="start-mic"]');
  if (await startBtn.count()) await startBtn.click();
  const seen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const txt = await page.locator('[data-testid="tuner-note"]').innerText().catch(() => '');
    if (txt && txt !== '–') seen.add(txt.replace(/\s/g, ''));
    if (seen.size === 6) break;
    await page.waitForTimeout(60);
  }
  await page.screenshot({ path: path.join(OUT, 'tuner.png') });
  const want = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
  const got = want.filter((w) => seen.has(w));
  check('Tuner hears all 6 open strings through getUserMedia (WAV fake mic)', got.length === 6, `saw ${[...seen].join(' ')}`);
  await browser.close();
}

// ---- play levels with the synthetic guitar bot ----------------------------
async function newPage() {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  page.on('pageerror', (e) => log('pageerror', e.message));
  await page.addInitScript({ path: path.join(here, 'fake-guitar.js') });
  return { browser, page };
}

async function playLevel(page, id, { wrongPadEvery = 0, timeoutMs = 120000, shot = false, bot = {} } = {}) {
  await page.goto(`${BASE}/level/${id}`);
  await page.waitForSelector('[data-testid="start"]');
  await page.evaluate((b) => Object.assign(window.__bot, { count: 0, wrongEvery: 0, beatLead: 0, delay: 0.6 }, b), bot);
  await page.click('[data-testid="start"]');
  const t0 = Date.now();
  let lastQ = null;
  let n = 0;
  let shotTaken = false;
  while (Date.now() - t0 < timeoutMs) {
    if (await page.locator('[data-testid="result-title"]').count()) break;
    const info = await page.evaluate(() => window.__NT__ && { q: window.__NT__.question, micOn: window.__NT__.micOn });
    const q = info?.q;
    if (q && q.id && q.id !== lastQ) {
      lastQ = q.id;
      n++;
      if (shot && !shotTaken && n === 2) {
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(OUT, `level-${id}.png`) });
        shotTaken = true;
      }
      await page.waitForTimeout(250);
      if (q.input === 'pad') {
        let v = q.correctPad;
        if (wrongPadEvery && n % wrongPadEvery === 0) {
          const wrong = q.padOptions.find((o) => o !== v);
          await page.click(`[data-testid="pad-${wrong}"]`);
          await page.waitForTimeout(300);
        }
        await page.click(`[data-testid="pad-${v}"]`);
      } else if (q.input === 'board' || (q.input === 'mic' && !info.micOn)) {
        const base = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 }[q.string];
        const fret = q.acceptMidis[0] - base;
        await page.locator(`#fret-${q.string}-${fret}`).click({ force: true });
      }
    } else if (shot && !shotTaken && Date.now() - t0 > 6000) {
      await page.screenshot({ path: path.join(OUT, `level-${id}.png`) });
      shotTaken = true;
    }
    await page.waitForTimeout(80);
  }
  const title = await page.locator('[data-testid="result-title"]').innerText().catch(() => 'TIMEOUT');
  const stars = await page.locator('[aria-label$="of 3 stars"]').last().getAttribute('aria-label').catch(() => '?');
  await page.screenshot({ path: path.join(OUT, `level-${id}-result.png`) });
  return { title, stars, seconds: Math.round((Date.now() - t0) / 1000) };
}

async function levels() {
  const { browser, page } = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="level-1"]');
  await page.screenshot({ path: path.join(OUT, 'map-start.png') });

  const passed = (r) => r.title === 'Level clear!' || r.title === 'Perfect!';
  const run = async (id, label, opts) => {
    if (only && !only.split(',').includes(String(id))) return;
    const r = await playLevel(page, id, opts);
    check(`Level ${id}: ${label}`, opts?.expectFail ? !passed(r) : passed(r), `${r.title}, ${r.stars}, ${r.seconds}s`);
    return r;
  };

  await run(1, 'string numbers (pad)', { shot: true });
  await run(2, 'open string names: one wrong answer fails a 10/10 level', { wrongPadEvery: 4, expectFail: true });
  await run(2, 'open string names (pad)');
  await run(3, 'mic tuner, all 6 strings (synthetic guitar)', { shot: true });
  await run(4, 'play the open strings (mic)');

  // Practice mode opens the rest of the map.
  await page.goto(`${BASE}/settings`);
  await page.locator('[data-testid="toggle-unlockAll"]').click();
  await page.waitForTimeout(300);

  await run(8, 'play fret 1 on each string (mic)');
  await run(10, 'boss: half tapped, half played', { shot: true });
  await run(11, 'name the note on low E (pad)', { shot: true });
  await run(12, 'play it on low E, 2 wrong notes of 20 still pass at 90% (mic)', { bot: { wrongEvery: 10 } });
  await run(12, '3 wrong notes of 20 fail (85%)', { bot: { wrongEvery: 6 }, expectFail: true });
  await run(20, 'boss: E and A, played under 5 s');
  await run(28, 'one note on all 6 strings in under 20 s (mic)');
  await run(30, 'boss: whole neck played');
  await run(31, 'spoken prompts, tap the fret (board)', { shot: true });
  await run(32, 'spoken prompts, played (mic)');
  await run(34, 'play on the beat at 60 BPM (8 in a row)', { shot: true });
  await run(36, 'Fret Play: prompt every 2 beats', { shot: true });
  await run(37, 'one note, all strings, one per beat');
  await run(38, 'walk the alphabet on the A string, one per beat', { shot: true });
  await run(39, 'Fret Play mode: tempo ramps to 80 BPM', { timeoutMs: 240000, shot: true });
  await run(40, 'boss: Fret Play final, 30 prompts at 70 BPM', { timeoutMs: 120000 });
  // A bot that plays nothing fails the boss.
  await run(40, 'boss fails when nothing is played', { bot: { on: false }, expectFail: true });

  if (!only) {
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="level-1"]');
    await page.screenshot({ path: path.join(OUT, 'map-after.png'), fullPage: true });
    const xp = await page.locator('[data-testid="player-title"]').innerText();
    check('XP and player level grow', !xp.includes('Lv 1'), xp);

    // Tap mode: guitar mode off -> mic levels are answered on the board.
    await page.goto(`${BASE}/settings`);
    await page.locator('[data-testid="toggle-guitarMode"]').click();
    await page.waitForTimeout(300);
    await run(4, 'tap mode fallback: open strings on the board');
    await page.goto(`${BASE}/settings`);
    await page.locator('[data-testid="toggle-guitarMode"]').click();

    // Note Rush, tapped
    await page.goto(`${BASE}/rush`);
    await page.click('[data-testid="start"]');
    const t0 = Date.now();
    let last = null;
    while (Date.now() - t0 < 64000) {
      if (await page.locator('[data-testid="rush-result"]').count()) break;
      const q = await page.evaluate(() => window.__NT__?.question);
      if (q && q.id !== last && q.correctPad) {
        last = q.id;
        await page.click(`[data-testid="pad-${q.correctPad}"]`).catch(() => {});
      }
      await page.waitForTimeout(150);
    }
    const rush = await page.locator('[data-testid="rush-result"]').innerText().catch(() => 'none');
    await page.screenshot({ path: path.join(OUT, 'rush-result.png') });
    check('Note Rush: 60-second round finishes with a score', /\d+ correct/.test(rush) && parseInt(rush) > 20, rush);
  }
  await browser.close();
}

try {
  if (!only) await tunerWithWav();
  await levels();
} catch (e) {
  console.error(e);
  results.push({ name: 'runner crashed', ok: false, detail: String(e) });
} finally {
  server.close();
}
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
