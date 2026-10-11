// The App Store promo screenshots (owner, 2026-10-11, after listings they liked): a bold colour,
// a big headline, and a real screenshot in a phone (light metal rim, black bezel, side buttons,
// Dynamic Island, soft shadow) running off the bottom. 1320 x 2868, the 6.9" size.
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
const W = 1320, H = 2868, INK = '#131F24', STATUS = 165;

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

const PW = 1090, RIM = 9, BEZEL = 24, R = 156;
const grain = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
const page = (s, screen) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Head; src: url('file://${FONT}'); }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
body { background: ${s.bg}; position: relative; font-family: Head; }
.grain { position: absolute; inset: 0; opacity: 0.22; mix-blend-mode: multiply; background-image: ${grain}; }
h1 { position: absolute; top: 150px; left: 90px; right: 90px; margin: 0; text-align: center; color: ${INK};
  font-size: 136px; line-height: 1.02; letter-spacing: -2px; font-weight: 900; }
.phone { position: absolute; left: 50%; transform: translateX(-50%); top: 630px; width: ${PW}px; height: 2600px;
  border-radius: ${R}px; padding: ${RIM}px; box-sizing: border-box;
  background: linear-gradient(135deg, #F4F6F8 0%, #B9C0C8 22%, #E9ECEF 48%, #9AA3AC 78%, #D8DDE2 100%);
  box-shadow: 0 40px 80px rgba(19, 31, 36, 0.35), 0 8px 18px rgba(19, 31, 36, 0.25); }
.bezel { width: 100%; height: 100%; box-sizing: border-box; border-radius: ${R - RIM}px; padding: ${BEZEL}px; background: #06090B;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.08); }
.screen { position: relative; width: 100%; height: 100%; border-radius: ${R - RIM - BEZEL}px; overflow: hidden; background: ${INK}; }
.screen img { display: block; width: 100%; }
.island { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); width: 296px; height: 86px; border-radius: 43px; background: #000; }
.btn { position: absolute; width: 9px; border-radius: 4px; background: linear-gradient(90deg, #8E969F, #D9DEE3); }
.btn.l { left: -7px; } .btn.r { right: -7px; background: linear-gradient(90deg, #D9DEE3, #8E969F); }
</style></head><body><div class="grain"></div><h1>${s.text}</h1>
<div class="phone">
  <div class="btn l" style="top: 330px; height: 96px"></div>
  <div class="btn l" style="top: 500px; height: 170px"></div>
  <div class="btn l" style="top: 700px; height: 170px"></div>
  <div class="btn r" style="top: 560px; height: 260px"></div>
  <div class="bezel"><div class="screen"><img src="file://${screen}"><div class="island"></div></div></div>
</div></body></html>`;

const wanted = process.argv.slice(2);
const tmp = join(here, '.build');
mkdirSync(tmp, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
try {
  for (const s of SLIDES.filter((x) => !wanted.length || wanted.includes(x.name))) {
    const source = join(here, 'screens', `${s.name}.png`);
    if (!existsSync(source)) {
      console.log(`skipped ${s.name}: no screens/${s.name}.png yet`);
      continue;
    }
    const screen = join(tmp, `${s.name}.png`);
    await sharp(source)
      .extract({ left: 0, top: STATUS, width: W, height: H - STATUS })
      .extend({ top: STATUS, extendWith: 'copy' })
      .png()
      .toFile(screen);
    const html = join(tmp, `${s.name}.html`);
    writeFileSync(html, page(s, screen));
    await tab.goto(`file://${html}`);
    await tab.evaluate(() => document.fonts.ready);
    await tab.screenshot({ path: join(here, `${s.name}.png`) });
    console.log(`wrote store/app-store-promo/${s.name}.png`);
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
