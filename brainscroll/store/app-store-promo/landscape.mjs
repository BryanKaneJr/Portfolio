// The two landscape App Store images (owner, 2026-10-11), in the promo slides' gold, ink and Nunito:
//   landscape/header.png  3840 x 1646  the product page header: Dr. Scroll presenting a planet, the
//                                      Colosseum and a globe beside "Stop scrolling. Start leveling."
//   landscape/search.png  3840 x 2560  the search result image: "Turn scrolling into learning." beside a
//                                      crop of the real Andromeda lesson in a rounded panel (no phone)
// Headline, face and lesson stay inside a 10% safe margin, since Apple crops these per device.
//
//   node store/app-store-promo/landscape.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const nunito = (w) => join(here, `../../node_modules/@expo-google-fonts/nunito/${w}/Nunito_${w}.ttf`);
const images = join(here, '../../app/assets/images');
const GOLD = '#F4B942', INK = '#131F24';
const tmp = join(here, '.landscape');
const out = join(here, 'landscape');

const grain = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
const shell = (w, h, body, css) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Head; src: url('file://${nunito('900Black')}'); }
@font-face { font-family: Sub; src: url('file://${nunito('800ExtraBold')}'); }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
body { background: ${GOLD}; position: relative; color: ${INK}; }
.grain { position: absolute; inset: 0; opacity: 0.22; mix-blend-mode: multiply; background-image: ${grain}; }
.copy { position: absolute; }
h1 { margin: 0; font-family: Head; font-weight: 900; line-height: 1.02; letter-spacing: -3px; }
p { margin: 0; font-family: Sub; font-weight: 800; opacity: 0.82; }
img { position: absolute; display: block; }
${css}
</style></head><body><div class="grain"></div>${body}</body></html>`;

// Art is 512 px; scale it once with lanczos so the browser draws it 1:1.
const art = async (file, size, flip = false) => {
  const path = join(tmp, `${file.replace(/\W/g, '-')}-${size}.png`);
  let s = sharp(join(images, file)).resize(size, size, { kernel: 'lanczos3' });
  if (flip) s = s.flop();
  await s.sharpen({ sigma: 0.6 }).png().toFile(path);
  return `file://${path}`;
};

async function header() {
  const W = 3840, H = 1646;
  const doc = await art('mascot/explaining.webp', 1180);
  const planet = await art('art/astronomy.saturn.webp', 470);
  const globe = await art('art/object.globe.webp', 440);
  const colosseum = await art('art/rome.colosseum.webp', 470);
  return [W, H, shell(W, H, `
<div class="copy" style="left: 384px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center;">
  <h1 style="font-size: 196px;">Stop scrolling.<br>Start leveling.</h1>
  <p style="font-size: 92px; margin-top: 56px;">History, science &amp; more.</p>
</div>
<img src="${planet}" style="left: 2090px; top: 250px; transform: rotate(-8deg);">
<img src="${globe}" style="left: 3070px; top: 220px;">
<img src="${colosseum}" style="left: 3090px; top: 1075px;">
<img src="${doc}" style="left: 2240px; top: 380px;">`, '')];
}

async function search() {
  const W = 3840, H = 2560;
  // The lesson from its progress bar to the end of the fact; the paragraph starts at 1449.
  const crop = { left: 0, top: 165, width: 1320, height: 1255 };
  const SAFE = 384, panelW = 1540, k = panelW / crop.width, pad = Math.round(60 * k);
  const lesson = join(tmp, 'lesson.png');
  await sharp(join(here, 'screens/01-learning-card.png')).extract(crop)
    .resize(panelW, null, { kernel: 'lanczos3' }).png().toFile(lesson);
  const panelH = Math.round(crop.height * k) + 2 * pad;
  return [W, H, shell(W, H, `
<div class="copy" style="left: 384px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center;">
  <h1 style="font-size: 205px;">Turn scrolling<br>into learning.</h1>
  <p style="font-size: 100px; margin-top: 64px;">History, science &amp; more.</p>
</div>
<div class="panel" style="left: ${W - SAFE - panelW}px; top: ${Math.round((H - panelH) / 2)}px; width: ${panelW}px; height: ${panelH}px;">
  <img src="file://${lesson}" style="left: 0; top: ${pad}px;">
</div>`, `
.panel { position: absolute; background: ${INK}; border-radius: 110px; overflow: hidden;
  box-shadow: 0 60px 120px rgba(19, 31, 36, 0.35), 0 12px 28px rgba(19, 31, 36, 0.25), inset 0 0 0 3px rgba(255,255,255,0.06); }`)];
}

mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, make] of [['header', header], ['search', search]]) {
    const [w, h, html] = await make();
    const file = join(tmp, `${name}.html`);
    writeFileSync(file, html);
    const tab = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await tab.goto(`file://${file}`);
    await tab.evaluate(() => document.fonts.ready);
    const png = await tab.screenshot();
    await tab.close();
    // Solid background, no alpha, as App Store Connect asks.
    await sharp(png).removeAlpha().png().toFile(join(out, `${name}.png`));
    console.log(`wrote store/app-store-promo/landscape/${name}.png (${w} x ${h})`);
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
