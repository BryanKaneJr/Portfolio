/**
 * The illustrated terrain prototype in the real game (web export in headless Chromium, iPhone-sized, 3x): before/after
 * screenshots at several zooms, a province tap inside the terrain region, and measurements (re-render time after a
 * camera change, frame times while panning, the tiles drawn and their decoded memory, the JS heap), unthrottled and
 * with the CPU slowed 4x as a rough stand-in for a mid-range phone. A browser is not a phone: these numbers are a
 * proxy, to be confirmed on devices.
 *
 * Run after `npx expo export -p web`:  node scripts/screens-terrain.mjs   → docs/terrain/screens/, docs/terrain/perf.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const OUT = path.resolve('docs/terrain/screens');
fs.mkdirSync(OUT, { recursive: true });
const W = 390;
const H = 844;
const server = await serve(8091);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
const tap = id => page.getByTestId(id).first().click();
const has = async id => (await page.getByTestId(id).count()) > 0;
const settle = (ms = 700) => page.waitForTimeout(ms);

await page.goto('http://localhost:8091/');
await settle(1500);
await tap('new-campaign');
await tap('nation-HAB');
await tap('begin');
await settle(1500);
for (let i = 0; i < 4; i++) if (await has('hint-ok')) await tap('hint-ok');
// Pause the clock so the map holds still.
await page.evaluate(() => window.__coe.store.setPaused?.(true));

/** Point the camera: centre (map units) and zoom k (screen points per map unit). */
const look = async (x, y, k) => {
  await page.evaluate(([x, y, w]) => window.__coe.store.focusOn(x, y, w), [x, y, W / k]);
  await settle(900);
};
const style = async id => {
  await page.evaluate(id => window.__coe.store.setMapStyle(id), id);
  await settle(900);
};

const VIEWS = [
  ['europe', 2080, 830, 0.45],
  ['region', 2060, 850, 0.9],
  ['alps-play', 1925, 855, 1.7],
  ['carpathians-play', 2200, 860, 1.7],
  ['danube-play', 2070, 900, 1.7],
  ['alps-close', 1915, 860, 3.2],
  ['alps-max', 1910, 862, 5],
  // The prototype's edge (x = 1792, about 3°E): illustrated to the east, Atlas to the west.
  ['region-edge-west', 1792, 800, 1.7],
];

// Before (the current Atlas style) and after (Illustrated), same views.
for (const [name, x, y, k] of VIEWS) {
  for (const s of ['atlas', 'illustrated']) {
    await style(s);
    await look(x, y, k);
    await page.screenshot({ path: path.join(OUT, `${name}-${s === 'atlas' ? 'before' : 'after'}.png`) });
  }
}

// A province tap inside the region still selects it (Bavaria's label point), and its sheet opens.
await style('illustrated');
await look(1960, 790, 1.7);
const target = await page.evaluate(() => {
  const [x, y] = window.__coe.point('bavaria');
  const cam = window.__coe.store.camera;
  return { x, y, cam };
});
// Map point → screen point with the camera as it is, just above the region's name (army figures stand below it).
const sx = W / 2 + (target.x - target.cam.cx) * target.cam.k;
const sy = H / 2 + (target.y - target.cam.cy) * target.cam.k - 22;
await page.mouse.click(sx, sy);
await settle(900);
const selected = await page.evaluate(() => window.__coe.store.selection);
await page.screenshot({ path: path.join(OUT, 'tap-bavaria-selected.png') });

// Measurements.
const cdp = await page.context().newCDPSession(page);
const perf = {};
for (const throttle of [1, 4]) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const rows = [];
  for (const [name, x, y, k] of VIEWS) {
    for (const s of ['atlas', 'illustrated']) {
      await style(s);
      await look(x + 30, y + 20, k); // somewhere else first, so the next move re-renders
      const ms = await page.evaluate(
        ([x, y, w]) =>
          new Promise(resolve => {
            const t0 = performance.now();
            window.__coe.store.focusOn(x, y, w);
            // Two frames after the state change: React has rendered and the browser has painted.
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
          }),
        [x, y, W / k],
      );
      await settle(600);
      const t = s === 'illustrated' ? await page.evaluate(() => window.__coe.terrain()) : null;
      const heap = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
      rows.push({ view: name, k, style: s, rerender_ms: Math.round(ms), tiles: t?.tiles ?? 0, tile_level: t?.level ?? null, decoded_mb: t ? +(t.decodedBytes / 1048576).toFixed(1) : 0, js_heap_mb: heap ? +(heap / 1048576).toFixed(1) : null });
    }
  }
  // Panning: a one-second drag across the map at play zoom, frame times sampled with requestAnimationFrame.
  const pans = {};
  for (const s of ['atlas', 'illustrated']) {
    await style(s);
    await look(2070, 900, 1.7);
    await page.evaluate(() => {
      window.__frames = [];
      let last = performance.now();
      const tick = now => {
        window.__frames.push(now - last);
        last = now;
        if (window.__frames.length < 400) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.mouse.move(W / 2, H / 2);
    await page.mouse.down();
    for (let i = 0; i < 60; i++) {
      await page.mouse.move(W / 2 - i * 3, H / 2 - i * 2);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await settle(1200);
    const frames = await page.evaluate(() => window.__frames.slice(2));
    const sorted = [...frames].sort((a, b) => a - b);
    const p = q => +sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(1);
    pans[s] = { frames: frames.length, median_ms: p(0.5), p95_ms: p(0.95), max_ms: +Math.max(...frames).toFixed(1), over_33ms: frames.filter(f => f > 33.4).length };
  }
  perf[`cpu_x${throttle}`] = { views: rows, pan_at_play_zoom: pans };
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

const report = { viewport: `${W}x${H} @3x`, selected_after_tap: selected, perf, errors };
fs.writeFileSync('docs/terrain/perf.json', JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({ selected, errors }, null, 1));
await browser.close();
server.close();
