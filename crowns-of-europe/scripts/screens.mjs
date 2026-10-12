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
await page.getByText('Crowns follow their history', { exact: false }).first().scrollIntoViewIfNeeded();
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
await tapId('playpause');
await answerCards();
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
