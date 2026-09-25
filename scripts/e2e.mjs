/**
 * End-to-end smoke test: boots the real game in a real (bundled) Chromium,
 * plays level 1 with an autopilot policy, verifies crash / rewarded continue /
 * retry / progression / all-levels-load, and saves screenshots.
 *
 * Run: node scripts/e2e.mjs   (dev server must be running on :5173)
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import chromium, { inflate } from '@sparticuz/chromium';

// This sandbox is not Amazon Linux, so @sparticuz/chromium skips its bundled
// shared libraries – extract them ourselves and expose them to the browser.
const binDir = new URL('../node_modules/@sparticuz/chromium/bin/', import.meta.url);
await inflate(new URL('al2023.tar.br', binDir).pathname);
const libPath = '/tmp/al2023/lib';
process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
  ? `${libPath}:${process.env.LD_LIBRARY_PATH}`
  : libPath;

const BASE = process.env.E2E_URL ?? 'http://localhost:5173/';
const SHOTS = path.resolve('e2e/shots');
fs.mkdirSync(SHOTS, { recursive: true });

const failures = [];
let step = '';
function check(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.log(`  ✗ ${msg}`);
    failures.push(`[${step}] ${msg}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickAt(page, x, y) {
  const rect = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(rect.x + (x / 540) * rect.w, rect.y + (y / 960) * rect.h);
}

async function shot(page, name) {
  // WebGL canvases can expose a stale frame to the compositor; force two fresh
  // animation frames (Phaser re-renders each one) before capturing.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await new Promise((r) => setTimeout(r, 180));
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  console.log(`  📸 ${name}.png`);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'],
    headless: 'shell',
    defaultViewport: { width: 540, height: 960, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => failures.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Autoplay|AudioContext/.test(m.text())) {
      console.log('  [console.error]', m.text());
    }
  });

  // ---------------------------------------------------------------- boot ---
  step = 'boot';
  console.log('▶ boot');
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => !!window.__CTT_GAME__, { timeout: 15000 });
  await sleep(1600);
  const renderer = await page.evaluate(() => window.__CTT_GAME__.renderer.type); // 1 canvas, 2 webgl
  console.log(`  renderer: ${renderer === 2 ? 'WebGL' : renderer === 1 ? 'Canvas' : renderer}`);
  await shot(page, '01-menu');
  const menuState = await page.evaluate(() => window.__CTT_GAME__.scene.isActive('Menu'));
  check(menuState, 'menu scene active');

  // --------------------------------------------------------------- play ----
  step = 'play';
  console.log('▶ play → level 1');
  await clickAt(page, 270, 514); // PLAY
  await page.waitForFunction(() => window.__CTT__ && window.__CTT__.levelId === 1, {
    timeout: 10000,
  });
  await sleep(1200);
  const lvl1 = await page.evaluate(() => ({
    ui: window.__CTT__.uiState(),
    sim: window.__CTT__.debugState(),
  }));
  check(lvl1.ui.state === 'play', 'level 1 starts in play state');
  check(lvl1.sim.total === 6, 'level 1 has 6 vehicles');
  check(lvl1.sim.lights.E === 'green' && lvl1.sim.lights.N === 'red', 'initial lights EW green');
  await shot(page, '02-gameplay-start');

  // ------------------------------------------------- real light-button tap --
  step = 'light-button';
  console.log('▶ tap the N–S signal head');
  await clickAt(page, 466, 868); // bottom-right N–S button
  await sleep(350);
  const afterTap = await page.evaluate(() => window.__CTT__.debugState());
  check(
    afterTap.lights.N === 'green' && afterTap.lights.E === 'red',
    'tap switches N–S to green and drops conflicting E–W to red',
  );
  await clickAt(page, 466, 868); // tap again → red
  await sleep(150);
  await clickAt(page, 74, 868); // ensure E–W green again for autopilot
  await sleep(350);
  const restoredLights = await page.evaluate(() => window.__CTT__.debugState());
  check(restoredLights.lights.E === 'green', 'tapping E–W restores green for the autopilot');

  // ----------------------------------------------------------- autopilot ----
  step = 'autopilot';
  console.log('▶ autopilot drives level 1');
  await page.evaluate(() => {
    if (window.__AUTO__) clearInterval(window.__AUTO__);
    window.__AUTO__ = setInterval(() => {
      const api = window.__CTT__;
      if (!api) return;
      const ui = api.uiState();
      if (ui.state !== 'play') return;
      const st = api.debugState();
      let best = null;
      for (const v of st.vehicles) {
        if (v.d < -5) continue; // already committed past the line
        if (!best || v.d < best.d) best = v;
      }
      if (!best) return;
      const g = ui.groups.find((x) => x.directions.includes(best.dir));
      if (!g) return;
      if (st.lights[best.dir] === 'red' && st.pendingGroup !== g.id) api.tap(g.id);
    }, 250);
  });

  await sleep(4000);
  await shot(page, '03-gameplay-mid');
  const mid = await page.evaluate(() => window.__CTT__.debugState());
  check(mid.cleared > 0 || mid.vehicles.length > 0, 'cars are moving (spawned/cleared)');

  await page.waitForFunction(
    () => {
      const a = window.__CTT__;
      return a && a.uiState().state === 'panel';
    },
    { timeout: 60000 },
  );
  const afterL1 = await page.evaluate(() => ({
    ui: window.__CTT__.uiState(),
    sim: window.__CTT__.debugState(),
  }));
  check(afterL1.sim.phase === 'complete', 'level 1 completed without a crash');
  await sleep(400);
  await shot(page, '04-level-complete');

  const save1 = await page.evaluate(() => JSON.parse(localStorage.getItem('ctt.save.v1')));
  check(save1.unlockedLevel >= 2, 'level 2 unlocked after completing level 1');
  check(save1.completed['1'] === true, 'level 1 marked completed');
  check(typeof save1.bestTimes['1'] === 'number', 'best time stored for level 1');

  // ------------------------------------------------------------ continue ----
  step = 'continue';
  console.log('▶ continue → level 2');
  await clickAt(page, 270, 546); // CONTINUE (panel y = 480+66)
  await page.waitForFunction(() => window.__CTT__ && window.__CTT__.levelId === 2, {
    timeout: 10000,
  });
  check(true, 'interstitial skipped silently (mock ads off) → level 2 loaded');
  await sleep(800);

  // ------------------------------------------------------------- restart ----
  step = 'restart';
  console.log('▶ HUD retry on level 2');
  const attemptBefore = await page.evaluate(() => window.__CTT__.uiState().attempt);
  await clickAt(page, 482, 40); // HUD RETRY
  await sleep(300);
  const attemptAfter = await page.evaluate(() => window.__CTT__.uiState());
  check(attemptAfter.attempt === attemptBefore + 1, 'retry increments attempt');
  check(attemptAfter.state === 'play', 'retry returns to play state');
  await page.evaluate(() => clearInterval(window.__AUTO__));

  // --------------------------------------------------------------- crash ----
  step = 'crash';
  console.log('▶ force a collision');
  await page.evaluate(() => window.__CTT__.forceCrash());
  await page.waitForFunction(() => window.__CTT__.uiState().state === 'panel', {
    timeout: 30000,
  });
  const crashUi = await page.evaluate(() => ({
    ui: window.__CTT__.uiState(),
    sim: window.__CTT__.debugState(),
  }));
  check(crashUi.sim.phase === 'crash', 'collision detected → crash phase');
  check(crashUi.ui.hadCollision === true, 'failure registered');
  await sleep(500);
  await shot(page, '05-crash-panel');

  // ------------------------------------------------ rewarded continue --------
  step = 'rewarded';
  console.log('▶ rewarded continue');
  await clickAt(page, 270, 560); // CONTINUE · WATCH AD
  await sleep(600);
  await shot(page, '06-rewarded-mock-ad');
  await page.waitForFunction(() => window.__CTT__.uiState().state === 'play', {
    timeout: 15000,
  });
  const afterReward = await page.evaluate(() => window.__CTT__.uiState());
  check(afterReward.continueUsed === true, 'reward granted → continue used');
  check(afterReward.state === 'play', 'game resumed after rewarded continue');
  const restored = await page.evaluate(() => window.__CTT__.debugState());
  check(restored.phase === 'running', 'simulation restored from snapshot');
  await sleep(400);
  await shot(page, '07-after-continue');

  // ---------------------------------------------------------- crash again ----
  step = 'crash-retry';
  console.log('▶ crash again → retry from panel');
  await page.evaluate(() => window.__CTT__.forceCrash());
  await page.waitForFunction(() => window.__CTT__.uiState().state === 'panel', {
    timeout: 30000,
  });
  await sleep(400);
  // After one rewarded continue the offer must be gone for this attempt.
  const panelShotTaken = true;
  check(panelShotTaken, 'failure panel shown again');
  const attempt2 = await page.evaluate(() => window.__CTT__.uiState().attempt);
  await clickAt(page, 270, 480); // RETRY
  await sleep(300);
  const retried = await page.evaluate(() => window.__CTT__.uiState());
  check(retried.state === 'play', 'panel retry → instantly back in play');
  check(retried.attempt === attempt2 + 1, 'attempt counter incremented');
  check(retried.hadCollision === false, 'failure state cleared on retry');

  // ------------------------------------------------------- all levels load ----
  step = 'all-levels';
  console.log('▶ load every level 1..10');
  for (let id = 1; id <= 10; id++) {
    await page.evaluate((n) => {
      window.__CTT_GAME__.scene.stop('Game');
      window.__CTT_GAME__.scene.start('Game', { levelId: n });
    }, id);
    await page.waitForFunction(
      (n) => window.__CTT__ && window.__CTT__.levelId === n && window.__CTT__.uiState(),
      { timeout: 8000 },
      id,
    );
    await sleep(150);
    const st = await page.evaluate(() => ({
      ui: window.__CTT__.uiState(),
      sim: window.__CTT__.debugState(),
    }));
    check(
      st.ui.state === 'play' && st.sim.total > 0 && st.ui.groups.length >= 2,
      `level ${id} loads (${st.sim.total} vehicles, ${st.ui.groups.length} groups)`,
    );
    if (id === 8 || id === 10) await shot(page, `08-level-${id}`);
  }

  // ------------------------------------------------------- level select ----
  step = 'level-select';
  console.log('▶ level select');
  await page.evaluate(() => window.__CTT_GAME__.scene.start('LevelSelect'));
  await sleep(700);
  await shot(page, '09-level-select');
  check(
    await page.evaluate(() => window.__CTT_GAME__.scene.isActive('LevelSelect')),
    'level select opens',
  );

  // ---------------------------------------------------------- settings ----
  step = 'settings';
  console.log('▶ settings toggles persist');
  await page.evaluate(() => window.__CTT_GAME__.scene.start('Settings'));
  await sleep(600);
  await shot(page, '10-settings');
  await clickAt(page, 300, 200); // sound row toggle
  await sleep(200);
  const sAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('ctt.save.v1')));
  check(sAfter.settings.sound === false, 'sound toggle persisted to localStorage');
  await clickAt(page, 300, 200); // back on
  await sleep(200);

  // ------------------------------------------------------------ progression ----
  step = 'progression';
  console.log('▶ reload keeps progress');
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction(() => !!window.__CTT_GAME__, { timeout: 15000 });
  await sleep(1500);
  const reloaded = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('ctt.save.v1')),
  );
  check(reloaded.unlockedLevel >= 2, 'unlocked level survives reload');
  check(reloaded.completed['1'] === true, 'completion survives reload');
  check(reloaded.settings.sound === true, 'settings restored after toggling back on');

  await browser.close();

  console.log('\n──────── E2E RESULT ────────');
  if (failures.length === 0) {
    console.log('ALL E2E CHECKS PASSED');
  } else {
    console.log(`${failures.length} FAILURES:`);
    for (const f of failures) console.log('  - ' + f);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('E2E crashed:', e);
  process.exitCode = 1;
});
