/** Second walkthrough: real taps and zoom on the map, event cards, battle reports, the peace screen. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';
const out = process.env.SHOT_OUT ?? 'screens/war';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const server = await serve(8092);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let n = 0;
const shot = async name => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-${name}.png`) }); };
const has = async id => (await page.getByTestId(id).count()) > 0;
const tapId = async id => page.getByTestId(id).first().click();
const coe = (fn, arg) => page.evaluate(fn, arg);
const seen = new Set();
async function cards() {
  for (let i = 0; i < 8; i++) {
    for (const [id, name] of [['choice-0', 'event'], ['offer-accept', 'offer'], ['report-close', 'report']]) {
      if (await has(id)) {
        if (!seen.has(name)) { seen.add(name); await shot(`card-${name}`); }
        await tapId(name === 'offer' ? 'offer-decline' : id);
      }
    }
    if (!(await has('choice-0')) && !(await has('offer-accept')) && !(await has('report-close'))) return;
  }
}
async function tapRegion(id) {
  await coe(r => window.__coe.store.focusOn(...window.__coe.point(r)), id);
  await page.waitForTimeout(300);
  const box = await page.getByTestId('map').boundingBox();
  const [lx, ly] = await coe(r => window.__coe.point(r), id);
  const cam = await coe(() => window.__coe.store.camera);
  const x = box.x + box.width / 2 + (lx - cam.cx) * cam.k;
  const y = box.y + box.height / 2 + (ly - cam.cy) * cam.k;
  await page.mouse.click(x, y);
}
await page.goto('http://localhost:8092/');
await page.waitForTimeout(1200);
await tapId('new-campaign');
await tapId('nation-CAS');
await tapId('begin');
await page.waitForTimeout(1200);
if (await has('hint-ok')) await tapId('hint-ok');
// Zoom in with the wheel to show region names.
const box = await page.getByTestId('map').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -250); await page.waitForTimeout(150); }
await shot('zoomed');
// Tap Granada on the map.
await tapRegion('granada');
await shot('tap-granada');
// Select our army by tapping its chip, then tap a destination region.
const army = await coe(() => { const s = window.__coe.store.state; const a = Object.values(s.armies).find(x => x.owner === s.player); return a.node; });
await tapRegion(army);
await shot('tap-army');
if (await has('hint-ok')) await tapId('hint-ok');
await coe(() => { const { store, commands } = window.__coe; store.run(s => commands.playerDeclareWar(s, 'GRA', 0)); });
await cards();
// Re-select the army (cards may have cleared it), then tap Granada to march.
await tapRegion(army);
await tapRegion('granada');
await shot('marching');
for (let i = 0; i < 16; i++) { await coe(() => window.__coe.advance(20)); await cards(); }
await shot('after-war');
// The peace screen from the war chip.
const wars = await coe(() => Object.keys(window.__coe.store.state.wars));
if (wars.length) {
  await coe(w => window.__coe.store.open({ kind: 'peace', war: w }), wars[0]);
  await shot('peace');
  if (await has('peace-granada')) { await tapId('peace-granada'); await shot('peace-picked'); }
  if (await has('send-peace')) { await tapId('send-peace'); await shot('peace-sent'); }
}
// Run several years for events.
for (let i = 0; i < 30; i++) { await coe(() => window.__coe.advance(30)); await cards(); }
await shot('years-later');
await coe(() => window.__coe.store.open({ kind: 'breakdown', what: 'gold' }));
await shot('gold-breakdown');
await coe(() => window.__coe.store.open({ kind: 'help' }));
await shot('help');
console.log(errors.length ? errors.join('\n') : 'no errors', [...seen]);
await browser.close();
server.close();
