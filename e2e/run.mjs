// End-to-end test of the web build in headless Chromium.
//   npm run build:web && npm run e2e
// A synthetic guitar (fake-guitar.js) plays whatever the game asks for, so
// whole runs are played in Detect and Metronome mode.
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

function log(...a) {
  console.log(...a);
}
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

// ---- a WAV of the six open strings, each plucked for 1.5 s ----------------
async function newPage() {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  page.on('pageerror', (e) => log('pageerror', e.message));
  await page.addInitScript({ path: path.join(here, 'fake-guitar.js') });
  return { browser, page };
}

async function waitDone(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.locator('[data-testid="practice-done"]').count()) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

async function practice() {
  const { browser, page } = await newPage();
  // Opens straight into level 1, armed: no setup screen.
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="reel"]');
  await page.evaluate(() => Object.assign(window.__bot, { on: true, count: 0, wrongEvery: 6, wrongStep: 1, beatLead: 0, delay: 0.45 }));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'practice-detect.png') });
  const okDetect = await waitDone(page, 60000);
  const p = await page.evaluate(() => window.__NT__?.practice);
  await page.screenshot({ path: path.join(OUT, 'practice-detect-done.png') });
  check('The game opens on level 1 and the bot finishes it in Detect mode', okDetect && p?.hits === 13, JSON.stringify(p));
  check('Detect mode: wrong notes are counted and do not move on', p?.misses === 2, `misses ${p?.misses}`);
  const badge = await page.locator('[data-testid="badge-new"]').count();
  check('First run earns a badge', badge >= 1, `${badge} new badges`);
  const next = await page.locator('[data-testid="next-level"]').count();
  check('Level 2 unlocks', next === 1);

  // Metronome mode on the same exercise: the bot plays on the beat.
  await page.click('[data-testid="practice-again"]');
  await page.evaluate(() => Object.assign(window.__bot, { count: 0, wrongEvery: 0, beatLead: 0 }));
  await page.click('[data-testid="mode-metronome"]');
  await page.waitForTimeout(300);
  await page.click('[data-testid="metro-start"]');
  await page.waitForTimeout(6500);
  await page.screenshot({ path: path.join(OUT, 'practice-metronome.png') });
  const okMetro = await waitDone(page, 40000);
  const m = await page.evaluate(() => window.__NT__?.practice);
  await page.screenshot({ path: path.join(OUT, 'practice-metronome-done.png') });
  const g = m?.grades ?? {};
  const good = (g.perfect ?? 0) + (g.great ?? 0) + (g.good ?? 0);
  check('Metronome mode: notes on the beat are graded', okMetro && good >= 11, JSON.stringify(g));

  // Panels
  await page.click('[data-testid="practice-again"]');
  await page.click('[data-testid="tab-theory"]');
  await page.waitForSelector('[data-testid="theory-panel"]');
  await page.screenshot({ path: path.join(OUT, 'practice-theory.png') });
  await page.click('[data-testid="sheet-close"]');
  await page.click('[data-testid="tab-levels"]');
  await page.waitForSelector('[data-testid="plevel-2"]');
  await page.screenshot({ path: path.join(OUT, 'practice-levels.png') });
  await page.click('[data-testid="plevel-2"]');
  await page.waitForTimeout(300);
  const title = await page.locator('text=Up and back down').count();
  check('Levels panel loads level 2', title >= 1);

  // Free play from a Keypracticer video code
  await page.goto(`${BASE}/FPS2UD80`);
  await page.waitForSelector('[data-testid="reel"]');
  const free = await page.locator('text=FREE PLAY').count();
  check('A video code opens free play (F major pentatonic box 2)', free >= 1);
  await page.screenshot({ path: path.join(OUT, 'practice-code.png') });

  // App settings screen
  await page.goto(`${BASE}/settings`);
  await page.waitForSelector('text=Sensitivity', { timeout: 10000 }).catch(() => {});
  const mic = await page.locator('text=Sensitivity').count();
  check('Settings screen shows mic settings', mic >= 1);
  await browser.close();
}

try {
  await practice();
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
