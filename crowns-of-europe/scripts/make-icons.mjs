/** Renders the app icon, adaptive icon, splash mark and favicon from SVG with Playwright. node scripts/make-icons.mjs */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const crown = (color, stroke) => `<path d="M300 640 L240 360 L380 480 L512 300 L644 480 L784 360 L724 640 Z" fill="${color}" stroke="${stroke}" stroke-width="18" stroke-linejoin="round"/>
<rect x="300" y="660" width="424" height="56" rx="10" fill="${color}" stroke="${stroke}" stroke-width="18"/>
<circle cx="240" cy="345" r="30" fill="${color}" stroke="${stroke}" stroke-width="14"/><circle cx="512" cy="285" r="34" fill="${color}" stroke="${stroke}" stroke-width="14"/><circle cx="784" cy="345" r="30" fill="${color}" stroke="${stroke}" stroke-width="14"/>
<circle cx="512" cy="560" r="26" fill="#a8382a"/><circle cx="410" cy="580" r="18" fill="#2f5f8a"/><circle cx="614" cy="580" r="18" fill="#2f5f8a"/>`;
const full = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><radialGradient id="g" cx="50%" cy="42%" r="65%"><stop offset="0" stop-color="#3a2a1a"/><stop offset="1" stop-color="#140d07"/></radialGradient></defs>
<rect width="1024" height="1024" fill="url(#g)"/>
<circle cx="512" cy="512" r="420" fill="none" stroke="#d9a441" stroke-width="10" opacity="0.8"/>
<circle cx="512" cy="512" r="395" fill="none" stroke="#d9a441" stroke-width="3" opacity="0.6"/>
${crown('#d9a441', '#7a5418')}
</svg>`;
const fg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="translate(102 102) scale(0.8)">${crown('#d9a441', '#7a5418')}</g></svg>`;
const browser = await chromium.launch();
const page = await browser.newPage();
async function shot(svg, file, size, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}"></body></html>`);
  await page.screenshot({ path: path.join(root, 'assets/images', file), omitBackground: transparent });
}
await shot(full, 'icon.png', 1024, false);
await shot(fg, 'adaptive-icon.png', 1024, true);
await shot(fg, 'splash-icon.png', 512, true);
await shot(full, 'favicon.png', 48, false);
await browser.close();
console.log('icons written');
