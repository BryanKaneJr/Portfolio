/**
 * Which map layers cost frames while panning (web export, headless Chromium, iPhone size at 3x): drags at play zoom
 * with Atlas, Illustrated, and Illustrated with its shore band and/or province casing switched off, interleaved so
 * drift hits every setup alike. Prints the share of frames over 20 ms and the worst frame per run.
 *
 * Run after `npx expo export -p web`:  node scripts/dev/pan-layers.mjs [runs per setup, default 6]
 */
import { chromium } from 'playwright';
import { serve } from '../serve.mjs';
const server = await serve(8096);
const browser = await chromium.launch();
const W = 390, H = 844;
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
await page.goto('http://localhost:8096/'); await page.waitForTimeout(1500);
const tap = id => page.getByTestId(id).first().click();
const has = async id => (await page.getByTestId(id).count()) > 0;
await tap('new-campaign'); await tap('nation-HAB'); await tap('begin'); await page.waitForTimeout(1500);
for (let i = 0; i < 4; i++) if (await has('hint-ok')) await tap('hint-ok');
await page.evaluate(() => window.__coe.store.setPaused?.(true));
const orig = await page.evaluate(() => JSON.parse(JSON.stringify({ shore: window.__coe.styles.illustrated.terrain.shore, prov: window.__coe.styles.illustrated.provinceBorder, nation: window.__coe.styles.illustrated.nationBorder })));
const CONFIGS = {
  atlas: null,
  full: {},
  noShore: { shore: [] },
  noProvHalo: { provHalo: false },
  noBoth: { shore: [], provHalo: false },
};
const runs = Number(process.argv[2] ?? 6);
const out = Object.fromEntries(Object.keys(CONFIGS).map(k => [k, []]));
for (let r = 0; r < runs; r++) {
  for (const [name, cfg] of Object.entries(CONFIGS)) {
    await page.evaluate(([cfg, orig]) => {
      const st = window.__coe.styles.illustrated;
      st.terrain.shore = cfg && cfg.shore ? cfg.shore : orig.shore;
      st.provinceBorder = cfg && cfg.provHalo === false ? { ...orig.prov, halo: undefined } : orig.prov;
      window.__coe.store.setMapStyle(cfg === null ? 'atlas' : 'illustrated');
    }, [cfg, orig]);
    const cx = 2070 + (r % 3) * 40, cy = 900 + Math.floor(r / 3) * 30;
    await page.evaluate(([x, y, w]) => window.__coe.store.focusOn(x, y, w), [cx, cy, W / 1.7]);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__frames = []; window.__dragging = true; let last = performance.now();
      const tick = now => { if (!window.__dragging) return; window.__frames.push(now - last); last = now; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await page.mouse.move(W / 2, H / 2); await page.mouse.down();
    for (let i = 0; i < 60; i++) { await page.mouse.move(W / 2 - i * 3, H / 2 - i * 2); await page.waitForTimeout(16); }
    const f = await page.evaluate(() => { window.__dragging = false; return window.__frames.slice(2); });
    await page.mouse.up(); await page.waitForTimeout(1200);
    out[name].push({ over20: f.filter(x => x > 20).length, frames: f.length, max: Math.round(Math.max(...f)) });
  }
}
for (const [k, v] of Object.entries(out)) {
  const share = v.reduce((s, x) => s + x.over20, 0) / v.reduce((s, x) => s + x.frames, 0);
  console.log(k.padEnd(11), 'slow-frame share', (100 * share).toFixed(1) + '%', 'per run over20:', v.map(x => x.over20).join(','), 'max:', v.map(x => x.max).join(','));
}
await browser.close(); server.close();
