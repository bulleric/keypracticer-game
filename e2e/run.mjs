// End-to-end test of the web build in headless Chromium.
//   npm run build:web && npm run e2e
// A synthetic guitar (fake-guitar.js) plays whatever the game asks for, so
// whole runs are played in Play and Beat mode, and the onboarding is walked
// through, including the sound remote (a ringing open string).
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

async function waitFor(page, fn, ms = 15000, arg) {
  return page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
}

async function onboarding(page) {
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="ob-welcome"]', { timeout: 20000 });
  check('A new player starts with onboarding', true);
  await page.screenshot({ path: path.join(OUT, 'ob-1-welcome.png') });
  await page.click('[data-testid="ob-start"]');
  await page.waitForSelector('[data-testid="ob-level"]');
  await page.click('[data-testid="ob-exp-new"]');
  await page.screenshot({ path: path.join(OUT, 'ob-2-level.png') });
  await page.click('[data-testid="ob-next"]');
  await page.waitForSelector('[data-testid="ob-goal"]');
  await page.click('[data-testid="ob-goal-10"]');
  await page.screenshot({ path: path.join(OUT, 'ob-3-goal.png') });
  await page.click('[data-testid="ob-next"]');
  await page.waitForSelector('[data-testid="ob-mic"]');
  await page.screenshot({ path: path.join(OUT, 'ob-4-mic-ask.png') });
  await page.click('[data-testid="ob-mic-on"]');
  await page.waitForSelector('[data-testid="ob-tuner"]');
  // The bot plucks the open low E: the tuner shows it in tune.
  const tuned = await page.waitForSelector('text=In tune ✓', { timeout: 10000 }).then(() => true).catch(() => false);
  await page.screenshot({ path: path.join(OUT, 'ob-4-mic-tuner.png') });
  check('Mic step hears the low E and says it is in tune', tuned);
  await page.click('[data-testid="ob-mic-next"]');
  await page.waitForSelector('[data-testid="ob-remote"]');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'ob-5-remote.png') });
  // The bot lets the low E ring: the sound remote fires Enter and moves on.
  const remote = await page.waitForSelector('[data-testid="ob-firstWin"]', { timeout: 12000 }).then(() => true).catch(() => false);
  const cmd = await page.evaluate(() => window.__NT__?.lastCommand);
  check('Sound remote: a ringing low E presses Enter', remote && cmd === 'ENTER', `lastCommand ${cmd}`);
  await page.screenshot({ path: path.join(OUT, 'ob-6-first-notes.png') });
  const first = await page.waitForSelector('[data-testid="ob-first-next"]', { timeout: 20000 }).then(() => true).catch(() => false);
  await page.screenshot({ path: path.join(OUT, 'ob-6-first-win.png') });
  check('First win: the three notes are played and heard', first);
  await page.click('[data-testid="ob-first-next"]');
  await page.waitForSelector('[data-testid="ob-signup"]');
  await page.screenshot({ path: path.join(OUT, 'ob-7-signup.png') });
  const off = await page.locator('[data-testid="accounts-off"]').count();
  check('Sign-up screen works without a Supabase project (guest mode)', off === 1);
  await page.click('[data-testid="ob-later"]');
  const home = await page.waitForSelector('[data-testid="lesson-title"]', { timeout: 10000 }).then(() => true).catch(() => false);
  const title = home ? await page.locator('[data-testid="lesson-title"]').innerText() : '';
  check('Onboarding ends on lesson 1', title === 'First climb', title);
  await page.screenshot({ path: path.join(OUT, 'home.png') });
}

async function practice() {
  const { browser, page } = await newPage();
  await onboarding(page);

  // Reload: onboarding is saved, the app opens on the lesson.
  await page.reload();
  const stays = await page.waitForSelector('[data-testid="lesson-title"]', { timeout: 15000 }).then(() => true).catch(() => false);
  check('Onboarding is not shown again after a reload', stays);

  // Learn: two theory cards, then Listen.
  await page.click('[data-testid="lesson-go"]');
  await page.waitForSelector('[data-testid="learn-title"]');
  await page.screenshot({ path: path.join(OUT, 'learn.png') });
  await page.click('[data-testid="learn-next"]');
  await page.waitForTimeout(200);
  await page.click('[data-testid="learn-next"]');
  const listen = await page.waitForSelector('[data-testid="listen-controls"]', { timeout: 10000 }).then(() => true).catch(() => false);
  check('Learn leads to Listen', listen);
  await page.click('[data-testid="listen-play"]');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, 'listen.png') });
  const played = await page.waitForSelector('text=Play it for me', { timeout: 30000 }).then(() => true).catch(() => false);
  check('Listen mode plays the whole exercise', played);

  // Play mode: the bot plays, with a wrong note now and then.
  await page.click('[data-testid="listen-ready"]');
  await page.waitForSelector('[data-testid="practice-message"]');
  await page.evaluate(() => Object.assign(window.__bot, { on: true, count: 0, wrongEvery: 6, wrongStep: 1, beatLead: 0, delay: 0.45 }));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'practice-detect.png') });
  const coach = await page.waitForSelector('[data-testid="coach"]', { timeout: 30000 }).then(() => true).catch(() => false);
  const coachText = coach ? await page.locator('[data-testid="coach"]').innerText().catch(() => '') : '';
  await page.screenshot({ path: path.join(OUT, 'practice-coach.png') });
  check('The coach explains a wrong note', /fret/.test(coachText), coachText);
  const okDetect = await waitDone(page, 60000);
  const p = await page.evaluate(() => window.__NT__?.practice);
  await page.screenshot({ path: path.join(OUT, 'practice-detect-done.png') });
  check('Lesson 1 is played to the end in Play mode', okDetect && p?.hits === 13, JSON.stringify(p));
  check('Play mode: wrong notes are counted and do not move on', p?.misses === 2, `misses ${p?.misses}`);
  const badge = await page.locator('[data-testid="badge-new"]').count();
  check('First run earns a badge', badge >= 1, `${badge} new badges`);
  const next = await page.locator('[data-testid="next-level"]').count();
  check('Lesson 2 unlocks', next === 1);
  const goal = await page.locator('[data-testid="today-goal"]').count();
  check('Results show today\'s practice goal', goal === 1);

  // Results answer to the guitar: a ringing low E goes to the next lesson.
  await page.evaluate(() => (window.__bot.on = false));
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__pluck(40, 1.6));
  // (The lesson screen underneath has the same title, so look in the game's top bar.)
  const nextByE = await waitFor(page, () => document.querySelector('[data-testid="open-levels"]')?.textContent?.includes('Up and back down') && !document.querySelector('[data-testid="practice-done"]'), 6000);
  const cmd = await page.evaluate(() => window.__NT__?.lastCommand);
  if (!nextByE) {
    await page.screenshot({ path: path.join(OUT, 'fail-results-enter.png') });
    log('debug', JSON.stringify(await page.evaluate(() => ({ c: window.__NT__?.commands, mic: window.__NT__?.micOn, view: window.__NT__?.view }))));
  }
  check('Results: low E (Enter) opens the next lesson', nextByE && cmd === 'ENTER', `lastCommand ${cmd}`);

  // Pause by silence, and continue with the low E.
  await page.waitForTimeout(1500);
  await page.evaluate(() => Object.assign(window.__bot, { on: true, count: 0, wrongEvery: 0, delay: 0.3 }));
  await waitFor(page, () => (window.__NT__?.practice?.hits ?? 0) >= 2, 15000);
  await page.evaluate(() => (window.__bot.on = false));
  const paused = await page.waitForSelector('[data-testid="paused"]', { timeout: 16000 }).then(() => true).catch(() => false);
  await page.screenshot({ path: path.join(OUT, 'practice-paused.png') });
  check('Play mode pauses when the player stops playing', paused);
  await page.evaluate(() => window.__pluck(40, 1.6));
  const resumed = await waitFor(page, () => window.__NT__?.paused === false, 6000);
  check('Paused: low E (Enter) continues', resumed);

  // Metronome mode on the same exercise: the bot plays on the beat.
  await page.click('[data-testid="mode-metronome"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => Object.assign(window.__bot, { on: true, count: 0, wrongEvery: 0, beatLead: 0 }));
  await page.click('[data-testid="metro-start"]');
  await page.waitForTimeout(6500);
  await page.screenshot({ path: path.join(OUT, 'practice-metronome.png') });
  const okMetro = await waitDone(page, 50000);
  const m = await page.evaluate(() => window.__NT__?.practice);
  await page.screenshot({ path: path.join(OUT, 'practice-metronome-done.png') });
  const g = m?.grades ?? {};
  const good = (g.perfect ?? 0) + (g.great ?? 0) + (g.good ?? 0);
  check('Beat mode: notes on the beat are graded', okMetro && good >= 20, JSON.stringify(g));

  // Panels
  await page.click('[data-testid="practice-again"]');
  await page.evaluate(() => (window.__bot.on = false));
  await page.click('[data-testid="tab-theory"]');
  await page.waitForSelector('[data-testid="theory-panel"]');
  await page.screenshot({ path: path.join(OUT, 'practice-theory.png') });
  await page.click('[data-testid="sheet-close"]');
  await page.click('[data-testid="tab-levels"]');
  await page.waitForSelector('[data-testid="plevel-2"]');
  await page.screenshot({ path: path.join(OUT, 'practice-levels.png') });
  await page.click('[data-testid="plevel-2"]');
  const title = await waitFor(page, () => document.querySelector('[data-testid="open-levels"]')?.textContent?.includes('Up and back down'), 3000);
  check('Path panel loads lesson 2', title);

  // Lesson home answers to the guitar: D (Demo) opens Listen.
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="lesson-title"]');
  await page.screenshot({ path: path.join(OUT, 'home-lesson2.png') });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__pluck(50, 1.6));
  const demo = await page.waitForSelector('[data-testid="listen-controls"]', { timeout: 8000 }).then(() => true).catch(() => false);
  check('Lesson home: D string (Demo) opens Listen', demo);

  // The path
  await page.goto(`${BASE}/path`);
  const path_ = await page.waitForSelector('[data-testid="plevel-3"]', { timeout: 10000 }).then(() => true).catch(() => false);
  check('The path lists the lessons', path_);

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
  const remote = await page.locator('text=Guitar as a remote').count();
  check('Settings: mic and sound control', mic >= 1 && remote >= 1);
  await page.screenshot({ path: path.join(OUT, 'settings.png'), fullPage: true });

  // Account screen in guest mode
  await page.goto(`${BASE}/account`);
  const acct = await page.waitForSelector('[data-testid="accounts-off"]', { timeout: 10000 }).then(() => true).catch(() => false);
  check('Account screen works in guest mode', acct);
  await browser.close();
}

/** A player who says no to the mic still gets through, and lands in Listen-first lessons. */
async function noMic() {
  const { browser, page } = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="ob-welcome"]', { timeout: 20000 });
  await page.click('[data-testid="ob-start"]');
  await page.click('[data-testid="ob-exp-box1"]');
  await page.click('[data-testid="ob-next"]');
  await page.click('[data-testid="ob-next"]');
  await page.waitForSelector('[data-testid="ob-mic"]');
  await page.click('[data-testid="ob-mic-skip"]');
  const first = await page.waitForSelector('[data-testid="ob-firstWin"]', { timeout: 8000 }).then(() => true).catch(() => false);
  check('No mic: the sound remote step is skipped', first);
  await page.click('[data-testid="ob-first-skip"]');
  await page.click('[data-testid="ob-later"]');
  await page.waitForSelector('[data-testid="lesson-title"]');
  const title = await page.locator('[data-testid="lesson-title"]').innerText();
  check('"I know box 1" starts at box 2', title === 'Box 2', title);
  await browser.close();
}

try {
  await practice();
  await noMic();
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
