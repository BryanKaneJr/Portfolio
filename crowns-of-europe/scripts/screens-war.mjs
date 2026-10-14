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
const once = async name => { if (!seen.has(name)) { seen.add(name); await shot(name); } };
/**
 * Answer what is waiting, as a player would. Event cards (and an offer the settings pause for, like an ultimatum)
 * come up on their own. Other offers and battle results only drop in as notices: tap one the first time, then
 * answer the rest from the messages under the bell (offers at the top, battles under their tab).
 */
async function cards() {
  for (let i = 0; i < 12; i++) {
    if (await has('choice-0')) { await once('card-event'); await tapId('choice-0'); continue; }
    if (await has('offer-accept')) { await once('card-offer'); await tapId('offer-decline'); continue; }
    if (await has('report-close')) { await once('card-report'); await tapId('report-close'); continue; }
    if (await has('moment-close')) { await once('card-moment'); await tapId('moment-close'); continue; }
    if (await has('panel-close')) { await tapId('panel-close'); continue; }
    if (!seen.has('toast') && (await has('toast-open'))) { await once('toast'); await tapId('toast-open'); continue; }
    const waiting = await coe(() => { const s = window.__coe.store.state; return { offers: s.offers.length, reports: s.unseenReports.length }; });
    if (!waiting.offers && !(waiting.reports && !seen.has('card-report'))) return;
    await tapId('messages');
    await once('messages-waiting');
    if (await has('message-offer')) { await tapId('message-offer'); continue; }
    await tapId('messages-battles');
    if (await has('message-report-unseen')) await tapId('message-report-unseen');
  }
}
/** Centre the map on an army's region and tap its token (it stands under the region's name). */
async function tapArmy(armyId) {
  await coe(id => window.__coe.store.focusOn(...window.__coe.point(window.__coe.store.state.armies[id].node)), armyId);
  await page.waitForTimeout(300);
  const box = await page.getByTestId('map').boundingBox();
  const [ux, uy] = await coe(id => window.__coe.unitPoint(id), armyId);
  const cam = await coe(() => window.__coe.store.camera);
  await page.mouse.click(box.x + box.width / 2 + (ux - cam.cx) * cam.k, box.y + box.height / 2 + (uy - cam.cy) * cam.k);
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
// Select our army by tapping its token, then tap a destination region.
const armyId = await coe(() => { const s = window.__coe.store.state; return Object.values(s.armies).find(x => x.owner === s.player).id; });
await coe(() => window.__coe.store.select(null)); // close Granada's sheet first, as a player would
await page.waitForTimeout(300);
await tapArmy(armyId);
if ((await coe(() => window.__coe.store.selection?.id)) !== armyId) throw new Error('Tapping our army did not select it');
await shot('tap-army');
if (await has('hint-ok')) await tapId('hint-ok');
await coe(() => { const { store, commands } = window.__coe; store.run(s => commands.playerDeclareWar(s, 'GRA', 0)); });
await cards();
// Re-select the army (cards may have cleared it), then tap Granada to march.
if ((await coe(() => window.__coe.store.selection?.id)) !== armyId) {
  await coe(() => window.__coe.store.select(null));
  await tapArmy(armyId);
}
await tapRegion('granada');
if (!(await coe(id => window.__coe.store.state.armies[id].path.length, armyId))) throw new Error('Tapping Granada with the army selected gave no march order');
await shot('marching');
for (let i = 0; i < 16; i++) { await coe(() => window.__coe.advance(20)); await cards(); }
await shot('after-war');
// The war screen, from the enemy's burning arms down the left of the map.
const wars = await coe(() => { const s = window.__coe.store.state; return Object.values(s.wars).filter(w => w.attackers.includes(s.player) || w.defenders.includes(s.player)).map(w => w.id); });
if (wars.length) {
  await tapId(`war-${wars[0]}`);
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
await coe(() => window.__coe.store.close());
// Two crowns at peace with us, to send test offers.
const senders = await coe(() => {
  const s = window.__coe.store.state;
  const foe = n => Object.values(s.wars).some(w => (w.attackers.includes(s.player) && w.defenders.includes(n)) || (w.defenders.includes(s.player) && w.attackers.includes(n)));
  return Object.values(s.nations).filter(n => n.alive && n.id !== s.player && !foe(n.id)).slice(0, 2).map(n => n.id);
});
// A notice goes when its offer does (answered from the messages, withdrawn); one tapped too late only says so.
const stale = await coe(([a]) => {
  const { store } = window.__coe;
  const s = store.state;
  s.settings.autoPause.offer = false;
  s.offers.push({ id: 'oStale', kind: 'alliance', from: a, day: s.day });
  store.notify();
  const t = store.toasts.find(x => x.offer === 'oStale');
  s.offers = s.offers.filter(o => o.id !== 'oStale');
  store.notify();
  const kept = store.toasts.some(x => x.offer === 'oStale');
  t?.action?.();
  return { announced: !!t, kept, overlay: store.overlay, said: store.toasts.at(-1)?.text };
}, senders);
if (!stale.announced || stale.kept || stale.overlay) throw new Error('A notice outlived its offer: ' + JSON.stringify(stale));
await shot('notice-too-late');
// Two offers that stop the clock at once: the second comes up when the first is set aside.
await coe(([a, b]) => {
  const { store } = window.__coe;
  const s = store.state;
  s.settings.autoPause.offer = true;
  s.offers.push({ id: 'oQ1', kind: 'alliance', from: a, day: s.day }, { id: 'oQ2', kind: 'marriage', from: b, day: s.day });
  store.notify();
  store.emit();
}, senders);
if ((await coe(() => window.__coe.store.overlay?.id)) !== 'oQ1') throw new Error('The first offer that pauses did not open its card');
await tapId('offer-later');
if ((await coe(() => window.__coe.store.overlay?.id)) !== 'oQ2') throw new Error('The second offer did not come up after the first');
await shot('offer-next-in-turn');
await tapId('offer-decline');
if (await coe(() => window.__coe.store.overlay)) throw new Error('A card stayed up after the last offer was answered');
await coe(() => {
  const { store } = window.__coe;
  store.state.offers = store.state.offers.filter(o => o.id !== 'oQ1');
  store.state.settings.autoPause.offer = false;
  store.notify();
  store.emit();
});
console.log(errors.length ? errors.join('\n') : 'no errors', [...seen]);
await browser.close();
server.close();
