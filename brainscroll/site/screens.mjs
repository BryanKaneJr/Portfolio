// The website's phone screens (site/src/img/screens/*.webp), made from the App Store promo set's iPhone
// screenshots (store/app-store-promo/screens/). Each keeps the whole screen, with its status bar replaced
// by the screen's own top edge, where the phone frame's island sits: the profile's purple runs up to the
// top as it does on a phone, and the frame never shows a bar of a different colour above or below.
//
//   node site/screens.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '../store/app-store-promo/screens');
const to = join(here, 'src/img/screens');
const SW = 1320, SH = 2868, STATUS = 165, WIDTH = 1170;

const SCREENS = {
  home: '02-home',
  lesson: '01-learning-card',
  question: '06-take-another-look',
  complete: '04-level-complete',
  'skill-map': '03-skill-map',
  league: '08-leagues',
  profile: '09-profile',
};

for (const [name, source] of Object.entries(SCREENS)) {
  const file = join(from, `${source}.png`);
  const { width, height } = await sharp(file).metadata();
  if (width !== SW || height !== SH) throw new Error(`${source}.png is ${width} x ${height}, not ${SW} x ${SH}`);
  const screen = await sharp(file)
    .removeAlpha()
    .extract({ left: 0, top: STATUS, width: SW, height: SH - STATUS })
    .extend({ top: STATUS, extendWith: 'copy' })
    .toBuffer();
  const out = await sharp(screen).resize(WIDTH).webp({ quality: 82, effort: 6 }).toFile(join(to, `${name}.webp`));
  console.log(`${name}.webp  ${out.width} x ${out.height}  ${Math.round(out.size / 1024)} KB`);
}
