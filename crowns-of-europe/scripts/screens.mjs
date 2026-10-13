/**
 * Plays the web build in a phone-sized browser and saves screenshots of each screen.
 * npm run screens   (after npx expo export --platform web). SHOT_OUT, SHOT_W, SHOT_H, NATION override.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';
const out = process.env.SHOT_OUT ?? 'screens';
const W = Number(process.env.SHOT_W ?? 390);
const H = Number(process.env.SHOT_H ?? 844);
const nation = process.env.NATION ?? 'POR';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const server = await serve(8091);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let n = 0;
const shot = async name => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-${name}.png`) }); };
const tapId = async id => { await page.getByTestId(id).first().click(); };
const has = async id => (await page.getByTestId(id).count()) > 0;
const coe = (fn, arg) => page.evaluate(fn, arg);
const answerCards = async () => {
  for (let i = 0; i < 6; i++) {
    if (await has('choice-0')) { await tapId('choice-0'); continue; }
    if (await has('offer-decline')) { await tapId('offer-decline'); continue; }
    if (await has('report-close')) { await tapId('report-close'); continue; }
    break;
  }
};

await page.goto('http://localhost:8091/');
await page.waitForTimeout(1500);
await shot('title');
await tapId('new-campaign');
await page.waitForTimeout(600);
await tapId(`nation-${nation}`);
await shot('nation-picker');
await tapId('begin');
await page.waitForTimeout(1500);
await shot('game-start');
if (await has('hint-ok')) await tapId('hint-ok');
await shot('map');

// Region sheet for the capital.
await coe(() => { const { store } = window.__coe; store.select({ kind: 'region', id: store.state.nations[store.state.player].capital }); });
await shot('region-sheet');
// Army sheet.
await coe(() => { const { store } = window.__coe; const a = Object.values(store.state.armies).find(x => x.owner === store.state.player); store.select({ kind: 'army', id: a.id }); });
await shot('army-sheet');
if (await has('hint-ok')) await tapId('hint-ok');
// Disbanding asks first: the first tap arms the button and says what it will do; the army is still there.
await tapId('disband');
await shot('army-disband-confirm');
if (!(await has('disband-confirm'))) throw new Error('Disband did not ask to be tapped again');
if (!(await coe(() => !!window.__coe.store.state.armies[window.__coe.store.selection?.id]))) throw new Error('The first tap disbanded the army');

// Give a march order the way a player does: tap the army's token, then tap a region of your own (one with no unit
// on it). The map glides so the army sits clear of its sheet; the order must take.
const onScreen = (what, id) => coe(([what, id]) => {
  const { store, point } = window.__coe;
  const cam = store.camera;
  const [x, y] = what === 'army' ? window.__coe.unitPoint(id) : point(id); // a token stands under its region's name
  return [innerWidth / 2 + (x - cam.cx) * cam.k, innerHeight / 2 + (y - cam.cy) * cam.k];
}, [what, id]);
await coe(() => window.__coe.store.select(null));
await page.waitForTimeout(300);
const marcher = await coe(() => { const s = window.__coe.store.state; return Object.values(s.armies).find(x => x.owner === s.player).id; });
const [ax, ay] = await onScreen('army', marcher);
await page.touchscreen.tap(ax, ay + 2);
await page.waitForTimeout(700);
if ((await coe(() => window.__coe.store.selection?.id)) !== marcher) throw new Error('Tapping the army token did not select it');
if (await has('hint-ok')) { await tapId('hint-ok'); await page.waitForTimeout(200); } // the first-time tip about marching
const dest = await coe(id => {
  const { store, point } = window.__coe;
  const s = store.state;
  const cam = store.camera;
  const sc = ([x, y]) => [innerWidth / 2 + (x - cam.cx) * cam.k, innerHeight / 2 + (y - cam.cy) * cam.k];
  const units = Object.values(s.armies).map(a => window.__coe.unitPoint(a.id)).filter(Boolean).map(sc);
  const [ax, ay] = sc(window.__coe.unitPoint(id));
  const sheetTop = innerHeight * 0.55;
  return Object.values(s.regions)
    .filter(r => r.owner === s.player && r.id !== s.armies[id].node)
    .map(r => ({ id: r.id, p: sc(point(r.id)) }))
    .filter(c => c.p[1] > 90 && c.p[1] < sheetTop && c.p[0] > 30 && c.p[0] < innerWidth - 70 && units.every(u => Math.hypot(u[0] - c.p[0], u[1] - c.p[1]) > 30))
    .sort((a, b) => Math.hypot(a.p[0] - ax, a.p[1] - ay) - Math.hypot(b.p[0] - ax, b.p[1] - ay))[0];
}, marcher);
if (!dest) throw new Error('No free region of your own in view to march to');
await page.touchscreen.tap(dest.p[0], dest.p[1]);
await page.waitForTimeout(400);
const marched = await coe(id => window.__coe.store.state.armies[id].path, marcher);
if (!marched.length) throw new Error(`Tapping ${dest.id} with the army selected gave no march order`);
await shot('army-marching');
await coe(id => { const { store, commands } = window.__coe; store.run(st => commands.stopArmy(st, id), { quiet: true }); }, marcher);

// Menu tabs.
await coe(() => window.__coe.store.select(null));
await tapId('menu');
await tapId('tab-military');
await shot('menu-military');
for (const tab of ['diplomacy', 'economy', 'science', 'colonies', 'missions']) {
  await tapId(`tab-${tab}`);
  await shot(`menu-${tab}`);
  if (tab === 'science') {
    await tapId('advance-ocean_navigation');
    await shot('menu-science-picked');
  }
}
await page.getByLabel('Settings').first().click();
await shot('menu-settings');
await page.getByLabel('Close').first().click();

// Diplomacy with a neighbour, then war.
const target = process.env.TARGET ?? (nation === 'POR' ? 'MOR' : nation === 'CAS' ? 'GRA' : 'BUR');
await coe(t => window.__coe.store.select({ kind: 'nation', id: t }), target);
await shot('nation-sheet');
// A crown with historical aims: what it wants and its old friends and enemies.
await coe(() => window.__coe.store.select({ kind: 'nation', id: 'FRA' }));
await page.getByText('What they want', { exact: false }).first().scrollIntoViewIfNeeded();
await shot('nation-aims');
await coe(t => window.__coe.store.select({ kind: 'nation', id: t }), target);
await page.getByText('Declare war…').first().click();
await shot('declare-war');
await tapId('declare-war');
await shot('at-war');
await answerCards();

// March the army on the enemy and let time run.
await coe(t => {
  const { store } = window.__coe;
  const s = store.state;
  const a = Object.values(s.armies).find(x => x.owner === s.player);
  const goal = Object.values(s.regions).find(r => r.owner === t);
  store.select({ kind: 'army', id: a.id });
  window.__lastMove = goal.id;
}, target);
const goal = await coe(() => window.__lastMove);
await coe(g => { const { store, commands, point } = window.__coe; const id = store.selection.id; store.run(st => commands.moveArmy(st, id, g)); store.focusOn(...point(g)); }, goal);
await shot('army-selected');
for (let i = 0; i < 12; i++) {
  await coe(() => window.__coe.advance(30));
  await answerCards();
}
await shot('after-a-year');
await tapId('playpause');
await page.waitForTimeout(3000);
await answerCards(); // an event may have come up (and paused the game) while time ran
if (!(await coe(() => window.__coe.store.paused))) await tapId('playpause');
await shot('after-play');
// Map modes.
await page.getByTestId('mapmode').click();
await shot('mapmode-list');
await page.getByTestId('mode-development').click();
await shot('map-development');
await page.getByTestId('mapmode').click();
await page.getByTestId('mode-political').click();
// Zoomed-out Europe.
await coe(() => { const { store, point } = window.__coe; const [x, y] = point('bohemia'); store.focusOn(x, y, 1400); });
await shot('europe');
// Messages.
await page.getByLabel('Messages').first().click();
await shot('messages');
await coe(() => { window.__coe.store.close(); window.__coe.store.select(null); });
// A century later in the Science map mode: knowledge has spread out from Italy and the West.
const start = await coe(() => window.__coe.store.state.day);
for (let i = 0; i < 600 && (await coe(() => window.__coe.store.state.day)) < start + 365 * 100; i++) {
  await coe(() => window.__coe.advance(365));
  await answerCards();
}
await page.getByTestId('mapmode').click();
await page.getByTestId('mode-science').click();
await coe(() => { const { store, point } = window.__coe; const [x, y] = point('bohemia'); store.focusOn(x, y, 1700); });
await shot('map-science');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
server.close();
