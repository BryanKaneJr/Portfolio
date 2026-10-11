/**
 * Plays the New World in the web build: the uncharted Atlantic, an expedition, discovery, a colony, the
 * Colonies tab, trade goods and an army crossing the ocean. Screenshots go to screens/newworld/.
 * Run after npx expo export --platform web: node scripts/screens-newworld.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';
const out = path.join(process.env.SHOT_OUT ?? 'screens', 'newworld');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const server = await serve(8093);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let n = 0;
const shot = async name => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-${name}.png`) }); };
const tapId = async id => { await page.getByTestId(id).first().click(); };
const has = async id => (await page.getByTestId(id).count()) > 0;
const coe = (fn, arg) => page.evaluate(fn, arg);
const answerCards = async () => {
  for (let i = 0; i < 8; i++) {
    if (await has('choice-0')) { await tapId('choice-0'); continue; }
    if (await has('offer-decline')) { await tapId('offer-decline'); continue; }
    if (await has('report-close')) { await tapId('report-close'); continue; }
    if (await has('hint-ok')) { await tapId('hint-ok'); continue; }
    break;
  }
};
const focus = (region, zoom) => coe(([r, z]) => { const { store, point } = window.__coe; const [x, y] = point(r); store.focusOn(x, y, z); }, [region, zoom]);

await page.goto('http://localhost:8093/');
await page.waitForTimeout(1500);
await tapId('new-campaign');
await page.waitForTimeout(500);
await tapId('nation-POR');
await tapId('begin');
await page.waitForTimeout(1500);
await answerCards();
// The whole Atlantic world, the Americas still uncharted.
await focus('azores', 2600);
await shot('atlantic-uncharted');
await coe(() => window.__coe.store.select({ kind: 'region', id: 'bahia' }));
await shot('uncharted-sheet');
await coe(() => window.__coe.store.select(null));
// Jump to 1475, fund an expedition from the Colonies tab.
// Thirty years on, Portugal's pilots have mastered Ocean Navigation.
await coe(() => { const s = window.__coe.store.state; s.day = 11323; s.nations[s.player].gold = 600; s.nations[s.player].advances.push('ocean_navigation'); window.__coe.store.bump?.(); });
await tapId('menu');
await tapId('tab-colonies');
await shot('colonies-before');
await tapId('menu-expedition');
await shot('expedition-sent');
await page.getByLabel('Close').first().click();
for (let i = 0; i < 14 && !(await coe(() => !!window.__coe.store.state.discovery)); i++) {
  await coe(() => window.__coe.advance(30));
  // advance() stops at an event or offer; answer it or time stands still.
  if (!(await coe(() => !!window.__coe.store.state.discovery))) await answerCards();
}
await shot('discovery-card');
await answerCards();
await focus('bahia', 900);
await shot('new-world-revealed');
// Start a colony in Bahia.
await coe(() => window.__coe.store.select({ kind: 'region', id: 'bahia' }));
await shot('wild-sheet');
await tapId('colonize');
await shot('colony-started');
for (let i = 0; i < 24; i++) {
  await coe(() => window.__coe.advance(30));
  await answerCards();
}
await coe(() => window.__coe.store.select({ kind: 'region', id: 'bahia' }));
await shot('colony-growing');
await coe(() => window.__coe.store.select(null));
await tapId('menu');
await tapId('tab-colonies');
await shot('colonies-tab');
await page.getByLabel('Close').first().click();
// Exports map mode.
await page.getByTestId('mapmode').click();
await page.getByText('Exports', { exact: true }).first().click();
await focus('cuba', 1400);
await shot('map-goods');
await page.getByTestId('mapmode').click();
await page.getByText('Political', { exact: true }).first().click();
// A native nation.
await coe(() => window.__coe.store.select({ kind: 'nation', id: 'AZT' }));
await shot('aztec-sheet');
// Ship an army across the ocean: transports off Lisbon, then march on Pernambuco.
await coe(() => {
  const { store, commands } = window.__coe;
  const s = store.state;
  const a = Object.values(s.armies).find(x => x.owner === s.player);
  const f = Object.values(s.fleets).find(x => x.owner === s.player);
  f.ships.transport = Math.max(f.ships.transport, 5);
  f.sea = 'iberian_atlantic';
  a.node = 'lisbon';
  a.path = [];
  store.select({ kind: 'army', id: a.id });
  store.run(st => commands.moveArmy(st, a.id, 'pernambuco'));
});
await focus('azores', 2200);
await shot('ocean-crossing');
for (let i = 0; i < 3; i++) await coe(() => window.__coe.advance(20));
await answerCards();
await focus('pernambuco', 700);
await shot('landed');
const landed = await coe(() => { const s = window.__coe.store.state; return Object.values(s.armies).find(x => x.owner === s.player && x.node === 'pernambuco') ? 'landed' : 'not landed'; });
console.log(landed);
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
server.close();
