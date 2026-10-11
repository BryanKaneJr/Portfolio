/**
 * Draws the launch screen art (owner, 2026-10-11, replacing the clay-effect
 * wordmark that "looks cheap and outdated"): a flat, lowercase "brainscroll"
 * in Nunito ExtraBold, "brain" in the deep plum of the old logo's outline and
 * "scroll" in white, above crowned Dr. Scroll (splash-mark.png), on a
 * transparent 1024 × 1260 canvas. It writes both copies the app uses:
 * splash-brand.png (the native splash, app.json) and splash-brand.webp
 * (BrandSplash, the same art in fewer bytes).
 *
 *   npx tsx scripts/splash-art.ts
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const images = join(root, 'app/assets/images');
const font = join(root, 'node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf');

const W = 1024, H = 1260;
/** The wordmark's band above Dr. Scroll, and how wide the word is drawn in it. */
const BAND = 200, MARK_TOP = 236, WORD_WIDTH = 820;
const DEEP_PLUM = '#481868';

const tmp = mkdtempSync(join(tmpdir(), 'splash-'));
try {
  const html = join(tmp, 'word.html');
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Word; src: url('file://${font}'); }
html, body { margin: 0; width: ${W}px; height: ${BAND}px; background: transparent; }
body { display: flex; align-items: center; justify-content: center; }
#w { font-family: Word; font-weight: 800; font-size: 170px; line-height: 1; letter-spacing: -0.03em; color: #fff; white-space: nowrap; }
</style></head><body><div id="w"><span style="color: ${DEEP_PLUM}">brain</span>scroll</div></body></html>`);
  const browser = await chromium.launch();
  let word: Buffer;
  try {
    const tab = await browser.newPage({ viewport: { width: W, height: BAND } });
    await tab.goto(`file://${html}`);
    await tab.evaluate(() => document.fonts.ready);
    await tab.evaluate((width) => {
      const w = document.getElementById('w')!;
      w.style.fontSize = `${(170 * width) / w.getBoundingClientRect().width}px`;
    }, WORD_WIDTH);
    word = await tab.screenshot({ omitBackground: true });
  } finally {
    await browser.close();
  }

  const art = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: word, left: 0, top: 0 },
      { input: join(images, 'splash-mark.png'), left: 0, top: MARK_TOP },
    ])
    .png()
    .toBuffer();
  await sharp(art).png({ compressionLevel: 9 }).toFile(join(images, 'splash-brand.png'));
  await sharp(art).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(join(images, 'splash-brand.webp'));
  console.log('wrote app/assets/images/splash-brand.png and splash-brand.webp');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
