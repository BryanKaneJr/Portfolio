// The App Store promo screenshots (owner, 2026-10-11, after listings they liked): a bold colour,
// a big headline, and a real screenshot in a phone (light metal rim, black bezel, side buttons,
// Dynamic Island, soft shadow) running off the bottom. Three sets, each for an App Store Connect slot
// that refuses the others' sizes:
//   <name>.png          1320 x 2868, iPhone 6.9"
//   6.3/<name>.png      1206 x 2622, iPhone 6.1" / 6.3" (the 6.9" slides, scaled down)
//   duo/<name>-duo.png  2007 x 2853, the wide slot, laid out again for its shape
//
//   node store/app-store-promo/build.mjs                 # every slide
//   node store/app-store-promo/build.mjs 07-weekly-quest # just these
//
// Each slide's phone screenshot is screens/<name>.png, 1320 x 2868: from an iPhone, or (07) the web build at
// 440 x 901 pt @3x with the status bar band added;
// its status bar is replaced by the screen's own top edge, where the island sits.
// The profile screenshot's username was repainted as @curious_mind (the owner's own stays private).
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const FONT = join(here, '../../node_modules/@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf');
const SW = 1320, SH = 2868, INK = '#131F24', STATUS = 165;
const SMALL = { dir: '6.3', width: 1206, height: 2622 };

// Where the headline and phone sit on each canvas. The phone's parts scale with its width.
const LAYOUTS = [
  { file: (n) => `${n}.png`, w: 1320, h: 2868, headTop: 150, headSize: 136, phoneTop: 630, phoneWidth: 1090 },
  { file: (n) => `duo/${n}-duo.png`, w: 2007, h: 2853, headTop: 160, headSize: 160, phoneTop: 680, phoneWidth: 1220 },
];

const SLIDES = [
  { name: '01-learning-card', bg: '#F4B942', text: 'Turn scrolling<br>into learning.' },
  { name: '02-home', bg: '#4DA3FF', text: '26 skills. Follow<br>your curiosity.' },
  { name: '03-skill-map', bg: '#2DD4BF', text: 'From curious<br>to Level 100' },
  { name: '04-level-complete', bg: '#A98BFF', text: 'Level up<br>what you know' },
  { name: '05-practice', bg: '#F0714F', text: 'Review it.<br>Build on it.' },
  { name: '06-take-another-look', bg: '#F472B6', text: 'Get it wrong.<br>Learn why.' },
  { name: '07-weekly-quest', bg: '#4DA3FF', text: 'A new quest<br>every week' },
  { name: '08-leagues', bg: '#9BE15D', text: 'A little friendly<br>competition' },
  { name: '09-profile', bg: '#C4B5FD', text: 'Watch your<br>knowledge grow' },
  { name: '10-social', bg: '#F4B942', text: 'Cheer on<br>your friends' },
];

const grain = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
const page = (s, L, screen) => {
  const k = L.phoneWidth / 1090;
  const px = (n) => `${Math.round(n * k)}px`;
  const RIM = 9 * k, BEZEL = 24 * k, R = 156 * k;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Head; src: url('file://${FONT}'); }
html, body { margin: 0; width: ${L.w}px; height: ${L.h}px; overflow: hidden; }
body { background: ${s.bg}; position: relative; font-family: Head; }
.grain { position: absolute; inset: 0; opacity: 0.22; mix-blend-mode: multiply; background-image: ${grain}; }
h1 { position: absolute; top: ${L.headTop}px; left: 90px; right: 90px; margin: 0; text-align: center; color: ${INK};
  font-size: ${L.headSize}px; line-height: 1.02; letter-spacing: -2px; font-weight: 900; }
.phone { position: absolute; left: 50%; transform: translateX(-50%); top: ${L.phoneTop}px; width: ${L.phoneWidth}px; height: ${px(2600)};
  border-radius: ${R}px; padding: ${RIM}px; box-sizing: border-box;
  background: linear-gradient(135deg, #F4F6F8 0%, #B9C0C8 22%, #E9ECEF 48%, #9AA3AC 78%, #D8DDE2 100%);
  box-shadow: 0 ${px(40)} ${px(80)} rgba(19, 31, 36, 0.35), 0 ${px(8)} ${px(18)} rgba(19, 31, 36, 0.25); }
.bezel { width: 100%; height: 100%; box-sizing: border-box; border-radius: ${R - RIM}px; padding: ${BEZEL}px; background: #06090B;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.08); }
.screen { position: relative; width: 100%; height: 100%; border-radius: ${R - RIM - BEZEL}px; overflow: hidden; background: ${INK}; }
.screen img { display: block; width: 100%; }
.island { position: absolute; top: ${px(30)}; left: 50%; transform: translateX(-50%); width: ${px(296)}; height: ${px(86)}; border-radius: ${px(43)}; background: #000; }
.btn { position: absolute; width: ${px(9)}; border-radius: ${px(4)}; background: linear-gradient(90deg, #8E969F, #D9DEE3); }
.btn.l { left: ${px(-7)}; } .btn.r { right: ${px(-7)}; background: linear-gradient(90deg, #D9DEE3, #8E969F); }
</style></head><body><div class="grain"></div><h1>${s.text}</h1>
<div class="phone">
  <div class="btn l" style="top: ${px(330)}; height: ${px(96)}"></div>
  <div class="btn l" style="top: ${px(500)}; height: ${px(170)}"></div>
  <div class="btn l" style="top: ${px(700)}; height: ${px(170)}"></div>
  <div class="btn r" style="top: ${px(560)}; height: ${px(260)}"></div>
  <div class="bezel"><div class="screen"><img src="file://${screen}"><div class="island"></div></div></div>
</div></body></html>`;
};

const wanted = process.argv.slice(2);
const tmp = join(here, '.build');
mkdirSync(tmp, { recursive: true });
for (const dir of [SMALL.dir, 'duo']) mkdirSync(join(here, dir), { recursive: true });
const browser = await chromium.launch();
try {
  for (const s of SLIDES.filter((x) => !wanted.length || wanted.includes(x.name))) {
    const source = join(here, 'screens', `${s.name}.png`);
    if (!existsSync(source)) {
      console.log(`skipped ${s.name}: no screens/${s.name}.png yet`);
      continue;
    }
    const screen = join(tmp, `${s.name}.png`);
    await sharp(source)
      .extract({ left: 0, top: STATUS, width: SW, height: SH - STATUS })
      .extend({ top: STATUS, extendWith: 'copy' })
      .png()
      .toFile(screen);
    for (const L of LAYOUTS) {
      const tab = await browser.newPage({ viewport: { width: L.w, height: L.h }, deviceScaleFactor: 1 });
      const html = join(tmp, `${s.name}-${L.w}.html`);
      writeFileSync(html, page(s, L, screen));
      await tab.goto(`file://${html}`);
      await tab.evaluate(() => document.fonts.ready);
      await tab.screenshot({ path: join(here, L.file(s.name)) });
      await tab.close();
    }
    await sharp(join(here, `${s.name}.png`))
      .resize(SMALL.width, SMALL.height, { fit: 'cover', position: 'top', kernel: 'lanczos3' })
      .removeAlpha()
      .png()
      .toFile(join(here, SMALL.dir, `${s.name}.png`));
    console.log(`wrote ${s.name}: ${LAYOUTS.map((L) => L.file(s.name)).join(', ')} and ${SMALL.dir}/${s.name}.png`);
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
