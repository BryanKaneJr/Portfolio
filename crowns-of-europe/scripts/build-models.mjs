/**
 * Renders the map's forts from free CC0 3D models: assets/units/castle.png (a keep with towers) and castle-small.png
 * (a lone tower). (The armies and fleets are the owner's drawings: scripts/build-units.ts.)
 *
 *   node scripts/build-models.mjs                       (npm run models:build)
 *   node scripts/build-models.mjs --only castle         render some sprites only
 *   node scripts/build-models.mjs --sheet [file.png]    also write a contact sheet (default scripts/data/models/)
 *   node scripts/build-models.mjs --out dir             write the sprites somewhere else (to try changes)
 *
 * The models (KayKit by Kay Lousberg, CC0; Kenney's zipped kits can be read too) are fetched once with curl into
 * scripts/data/models (git-ignored); each pack's licence file is checked for CC0. Every sprite is rendered with three.js in headless
 * Chromium (Playwright): an orthographic 3/4 camera, soft light from the upper left, the packs' bright colours muted,
 * 4x supersampled, then inked (a 2px outline round the silhouette and thin lines where one part stands in front of
 * another) over a faint contact shadow, and written as a 192 x 192 transparent PNG. Credits: assets/units/CREDITS.md.
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pngjs from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(root, 'scripts/data/models');
const OUT = path.join(root, 'assets/units');
const THREE_DIR = path.join(root, 'node_modules/three');
const SIZE = 192;

// ---------------------------------------------------------------------------------------------------------------
// Sources, all CC0. KayKit's packs are on GitHub: single files from raw.githubusercontent.com at a fixed commit.
// Kenney's kits are zips whose address changes when a kit is updated, so it is read from the kit's page (`zip` is the
// address it had when this was written).
const KAYKIT = 'https://raw.githubusercontent.com/KayKit-Game-Assets';
const HEX = 'addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/blue';
const KITS = {
  hex: {
    title: 'KayKit Medieval Hexagon Pack 1.0',
    base: `${KAYKIT}/KayKit-Medieval-Hexagon-Pack-1.0/84fa4e91af6a88989be7c99e0891cede11f2ca38`,
    licence: 'LICENSE.txt',
    files: ['building_castle_blue', 'building_tower_A_blue']
      .flatMap(n => [`${HEX}/${n}.gltf`, `${HEX}/${n}.bin`])
      .concat(`${HEX}/hexagons_medieval.png`),
  },
};
const hex = name => `kits/hex/${HEX}/${name}.gltf`;

// ---------------------------------------------------------------------------------------------------------------
// The sprites. Lengths are the models' own. `parts` share one scene: `anim`/`time` pose a
// rigged model, `hide` drops named nodes, `pike` stands a pike in a hand, `pos` places the part. `elevation` is the
// camera's angle down from the horizon and `azimuth` turns it round the scene (0 = facing the models' front).
// `palette` mutes the colour atlas: hue name -> [new hue, saturation factor, lightness] (see muted() in the page code).
const STONE_PALETTE = { sat: 0.75, lift: 0.12, map: { blue: [12, 0.45, 0.42] } }; // blue roofs -> tile
const SPRITES = [
  { name: 'castle', palette: STONE_PALETTE, parts: [{ url: hex('building_castle_blue') }], elevation: 35, azimuth: 30 },
  {
    name: 'castle-small',
    palette: STONE_PALETTE,
    parts: [{ url: hex('building_tower_A_blue') }],
    elevation: 35,
    azimuth: 30,
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Downloads and zips

function curl(url, dest) {
  const tmp = `${dest}.part`;
  execFileSync('curl', ['-sSfL', '--retry', '3', '-o', tmp, url], { stdio: ['ignore', 'ignore', 'inherit'] });
  fs.renameSync(tmp, dest);
}

/** Kenney: the kit's zip, read from its page. Returns the cached zip's path. */
function fetchZip(id) {
  const kit = KITS[id];
  const file = path.join(CACHE, `${id}.zip`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(CACHE, { recursive: true });
  let url = kit.zip;
  try {
    const page = path.join(CACHE, `${id}.html`);
    curl(kit.page, page);
    const found = fs.readFileSync(page, 'utf8').match(/https:\/\/kenney\.nl\/media\/pages\/assets\/[^"'\s]+\.zip/);
    fs.rmSync(page);
    if (found) url = found[0];
  } catch {
    console.warn(`  could not read ${kit.page}; trying the known address`);
  }
  console.log(`  fetching ${kit.title}: ${url}`);
  curl(url, file);
  return file;
}

/** KayKit: single files from GitHub. Returns name -> () => Buffer, like readZip. */
function fetchFiles(id) {
  const kit = KITS[id];
  const entries = new Map();
  for (const name of [kit.licence, ...kit.files]) {
    const file = path.join(CACHE, id, name);
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      console.log(`  fetching ${kit.title}: ${name}`);
      curl(`${kit.base}/${name.split('/').map(encodeURIComponent).join('/')}`, file);
    }
    entries.set(name, () => fs.readFileSync(file));
  }
  return entries;
}

/** A minimal zip reader: name -> () => Buffer (stored or deflated entries). */
function readZip(file) {
  const buf = fs.readFileSync(file);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error(`${file} is not a zip`);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`${file}: bad central directory`);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    entries.set(name, () => {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + csize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`${name}: unsupported zip method ${method}`);
    });
  }
  return entries;
}

function loadKits(ids) {
  const kits = {};
  for (const id of ids) {
    const kit = KITS[id];
    const entries = kit.zip ? readZip(fetchZip(id)) : fetchFiles(id);
    const licence = entries.get(kit.licence);
    if (!licence || !/Creative Commons Zero|CC0/.test(licence().toString('utf8'))) {
      throw new Error(`${kit.title}: ${kit.licence} does not say CC0; check the licence before using it`);
    }
    kits[id] = entries;
  }
  return kits;
}

// ---------------------------------------------------------------------------------------------------------------
// The page: three.js renders, then the canvas work (outline, shadow, downsampling) happens in the page as well.

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body style="margin:0;background:transparent"><script type="module" src="/render.js"></script></body></html>`;

const RENDER_JS = String.raw`
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const loaded = new Map();
const load = (url) => {
  if (!loaded.has(url)) loaded.set(url, loader.loadAsync('/' + url.split('/').map(encodeURIComponent).join('/')));
  return loaded.get(url);
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext();

// --- colour: the kits' atlases are bright; each sprite mutes them towards ink, wood, stone and cloth.
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
// Mute everything and turn the loud hues (team reds, blues...) into earth, tile or grey. map: hue name -> [new hue,
// saturation factor, new lightness (optional)]; sat scales all saturation; lift brightens towards white (0..1).
function muted({ sat = 0.55, warm = 0.06, lift = 0, map = {} } = {}) {
  return (r, g, b) => {
    let [h, s, l] = rgbToHsl(r, g, b);
    for (const [name, [h0, h1]] of Object.entries(HUES)) {
      const inRange = h0 <= h1 ? h >= h0 && h < h1 : h >= h0 || h < h1;
      if (inRange && s > 0.2 && map[name]) { const t = map[name]; h = t[0]; s = t[1] * s; l = t[2] === undefined ? l : t[2] + (l - 0.5) * 0.6; break; }
    }
    s *= sat;
    l += lift * (1 - l);
    const [R, G, B] = hslToRgb(h, s, l);
    return [R + warm * 128, G + warm * 51, B - warm * 102];
  };
}
const HUES = { red: [345, 15], orange: [15, 40], yellow: [40, 70], green: [70, 170], blue: [170, 255], purple: [255, 345] };

/** A copy of the texture with fn applied to every pixel. */
function recolour(texture, fn) {
  const img = texture.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const [r, g, b] = fn(d.data[i], d.data[i + 1], d.data[i + 2]);
    d.data[i] = r; d.data[i + 1] = g; d.data[i + 2] = b;
  }
  ctx.putImageData(d, 0, 0);
  const t = texture.clone();
  t.image = c;
  t.needsUpdate = true;
  return t;
}

const rad = (d) => (d * Math.PI) / 180;

// Plain materials for the props drawn here (pikes): flat-shaded like the kits.
const PROP = {
  wood: new THREE.MeshStandardMaterial({ color: 0x6e5238, roughness: 0.9, flatShading: true }),
  steel: new THREE.MeshStandardMaterial({ color: 0xb9bcbe, roughness: 0.45, metalness: 0.3, flatShading: true }),
};

/** A pike standing on the ground at (x, z), leaning by lean degrees towards dir, length long. */
function pike({ x, z, length, lean = 6, dir = 0, radius }) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.15, length, 6), PROP.wood);
  shaft.position.y = length / 2;
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(radius * 3, 0), PROP.steel);
  head.scale.set(0.8, 3.2, 0.5);
  head.position.y = length + radius * 7;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.5, radius * 1.5, radius * 3, 6), PROP.steel);
  collar.position.y = length;
  g.add(shaft, head, collar);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); // a shaft this thin only gets acne from shadows
  g.position.set(x, 0, z);
  g.rotation.set(0, rad(dir), 0, 'YXZ');
  g.rotateX(rad(lean));
  return g;
}

async function buildPart(part, palette) {
  const gltf = await load(part.url);
  const obj = SkeletonUtils.clone(gltf.scene);
  palette = part.palette || palette;
  // remove what the model carries but this sprite doesn't want (removed, not hidden, so it can't widen the frame)
  for (const name of part.hide || []) { const n = obj.getObjectByName(name); if (n) n.removeFromParent(); }
  obj.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      if (o.material.map) {
        // one recoloured atlas per (kit file, palette)
        const key = part.url + '|' + JSON.stringify(palette || null);
        if (!buildPart.maps.has(key)) buildPart.maps.set(key, palette ? recolour(o.material.map, muted(palette)) : o.material.map);
        o.material.map = buildPart.maps.get(key);
      }
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  if (part.anim) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, part.anim);
    if (!clip) throw new Error(part.url + ': no animation ' + part.anim + ' (has ' + gltf.animations.map((a) => a.name).join(', ') + ')');
    const mixer = new THREE.AnimationMixer(obj);
    mixer.clipAction(clip).play();
    mixer.setTime(part.time || 0);
  }
  obj.updateMatrixWorld(true);
  obj.userData.foot = new THREE.Box3().setFromObject(obj, true); // the footprint, before props and placement
  if (part.pike) {
    // stand a pike on the ground right under the hand, so it passes through the fist whatever the pose
    const hand = obj.getObjectByName(part.pike.hand);
    if (!hand) throw new Error(part.url + ': no bone ' + part.pike.hand);
    const p = hand.getWorldPosition(new THREE.Vector3());
    const size = new THREE.Box3().setFromObject(obj, true).getSize(new THREE.Vector3());
    obj.add(pike({ x: p.x, z: p.z, length: size.y * (part.pike.length || 1.4), lean: part.pike.lean, dir: part.pike.dir, radius: size.y * 0.022 }));
  }
  if (part.pos) obj.position.set(...part.pos);
  obj.updateMatrixWorld(true);
  obj.userData.foot.applyMatrix4(obj.matrixWorld);
  return obj;
}
buildPart.maps = new Map();

// Soft round blob texture for the contact shadow.
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function readPixels(w, h) {
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  // flip rows: WebGL reads bottom-up
  const out = new Uint8Array(w * h * 4), row = w * 4;
  for (let y = 0; y < h; y++) out.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  return out; // premultiplied RGBA, top-down
}

function alphaBox(px, w, h, min) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > min) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** Max filter of the W x W alpha a over a disc of radius r (antialiased rim). */
function dilate(a, W, r) {
  const offs = [];
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const k = Math.max(0, Math.min(1, r + 0.5 - Math.hypot(dx, dy)));
    if (k > 0) offs.push([dx, dy, k]);
  }
  offs.sort((p, q) => q[2] - p[2]);
  const out = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    let m = a[y * W + x];
    if (m >= 1) { out[y * W + x] = 1; continue; }
    for (const [dx, dy, k] of offs) {
      if (k <= m) break;
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
      const v = a[Y * W + X] * k;
      if (v > m) m = v;
    }
    out[y * W + x] = m;
  }
  return out;
}

window.renderSprite = async function renderSprite(spec) {
  const size = spec.size, ss = spec.ss || 4, W = size * ss;
  const scene = new THREE.Scene();
  const model = new THREE.Group();
  const parts = [];
  for (const part of spec.parts) { const o = await buildPart(part, spec.palette); parts.push(o); model.add(o); }
  scene.add(model);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model, true);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const centre = sphere.center.clone();
  const R = sphere.radius;

  // camera: orthographic, looking down at spec.elevation degrees
  const el = rad(spec.elevation ?? 40), az = rad(spec.azimuth ?? 0);
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const cam = new THREE.OrthographicCamera(-R, R, R, -R, R * 4.8, R * 7.2);
  cam.position.copy(centre).addScaledVector(dir, R * 6);
  cam.lookAt(centre);
  cam.updateMatrixWorld(true);

  // light: from the upper left of the picture, a little towards the viewer, fairly high so shadows stay short
  const right = new THREE.Vector3(1, 0, 0).transformDirection(cam.matrixWorld).setY(0).normalize();
  const back = dir.clone().setY(0).normalize();
  const [lx, lz, lel] = spec.light || [-1, 0.45, 58];
  const lightDir = right.clone().multiplyScalar(lx).addScaledVector(back, lz).normalize().multiplyScalar(Math.cos(rad(lel)));
  lightDir.y = Math.sin(rad(lel));
  const sun = new THREE.DirectionalLight(0xfff2dc, spec.sun ?? 2.6);
  sun.position.copy(centre).addScaledVector(lightDir, R * 4);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -R * 1.5, right: R * 1.5, top: R * 1.5, bottom: -R * 1.5, near: 0.01, far: R * 10 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = R * 0.004;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xf4ecdc, 0x8a7860, spec.sky ?? 2.0));
  const fill = new THREE.DirectionalLight(0xe2e8f0, spec.fill ?? 0.7);
  fill.position.copy(centre).addScaledVector(right.clone().addScaledVector(back, 0.6).setY(0.35).normalize(), R * 4);
  fill.target.position.copy(centre);
  scene.add(fill, fill.target);

  // shadow pass only: a soft blob under each part's footprint
  const groundY = box.min.y;
  const shadowLayer = new THREE.Group();
  const blobMap = blobTexture();
  parts.forEach((o, i) => {
    const b = o.userData.foot;
    if (!b || spec.parts[i].blob === false) return;
    const k = spec.blobScale ?? 1.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry((b.max.x - b.min.x) * k, (b.max.z - b.min.z) * k), new THREE.MeshBasicMaterial({ map: blobMap, transparent: true, opacity: spec.blob ?? 0.3, depthWrite: false, color: 0x000000 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((b.min.x + b.max.x) / 2, groundY + R * 0.002 * (i + 1), (b.min.z + b.max.z) / 2);
    shadowLayer.add(m);
  });
  scene.add(shadowLayer);

  const materials = [];
  model.traverse((o) => { if (o.isMesh) materials.push(o.material); });
  const depthMaterial = new THREE.MeshDepthMaterial();
  function pass(which, w, h) {
    renderer.setSize(w, h, false);
    shadowLayer.visible = which === 'shadow';
    scene.overrideMaterial = which === 'depth' ? depthMaterial : null;
    renderer.setClearColor(0x000000, which === 'depth' ? 1 : 0);
    for (const m of materials) { m.colorWrite = which !== 'shadow'; m.depthWrite = which !== 'shadow'; }
    renderer.render(scene, cam);
    return readPixels(w, h);
  }

  // 1. fit: render small with a loose frame, find the drawn box, then frame it exactly (orthographic: linear)
  const FW = 256;
  const fm = pass('model', FW, FW), fs = pass('shadow', FW, FW);
  const mb = alphaBox(fm, FW, FW, 2), sb = alphaBox(fs, FW, FW, 4) || mb;
  const toView = (px, py) => [cam.left + (px / FW) * (cam.right - cam.left), cam.top - (py / FW) * (cam.top - cam.bottom)];
  const [mx0, my1] = toView(mb.x0, mb.y0), [mx1, my0] = toView(mb.x1, mb.y1);
  const [sx0, sy1] = toView(sb.x0, sb.y0), [sx1, sy0] = toView(sb.x1, sb.y1);
  const pad = Object.assign({ side: 7, top: 6, bottom: 6 }, spec.pad);
  const cx = (mx0 + mx1) / 2;
  const half = Math.max(cx - Math.min(mx0, sx0), Math.max(mx1, sx1) - cx);
  const bottom = Math.min(my0, sy0), top = Math.max(my1, sy1);
  const scale = Math.min((size - 2 * pad.side) / (2 * half), (size - pad.top - pad.bottom) / (top - bottom)); // px per unit
  cam.left = cx - size / 2 / scale; cam.right = cx + size / 2 / scale;
  cam.bottom = bottom - pad.bottom / scale; cam.top = cam.bottom + size / scale;
  cam.updateProjectionMatrix();

  // 2. render big: colour, shadow, depth
  const M = pass('model', W, W), S = pass('shadow', W, W), Z = pass('depth', W, W);
  const A = new Float32Array(W * W);
  for (let i = 0; i < W * W; i++) A[i] = M[i * 4 + 3] / 255;

  // 3. ink: the silhouette (alpha dilated), and inner lines where a part stands well in front of another
  const ol = Object.assign({ width: 2, color: [40, 28, 18], alpha: 0.85 }, spec.outline);
  const D = dilate(A, W, ol.width * ss);
  const inner = Object.assign({ width: 1, alpha: 0.7, depth: 0.08 }, spec.inner);
  const E = new Float32Array(W * W);
  if (inner.alpha > 0) {
    // near-side pixels of a depth step bigger than inner.depth (in units of the model's radius)
    const T = (inner.depth * R) / (cam.far - cam.near) * 255;
    const r = inner.width * ss, Ri = Math.ceil(r);
    const offs = [];
    for (let dy = -Ri; dy <= Ri; dy++) for (let dx = -Ri; dx <= Ri; dx++) {
      const k = Math.max(0, Math.min(1, r + 0.5 - Math.hypot(dx, dy)));
      if (k > 0) offs.push([dx, dy, k]);
    }
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (A[i] < 0.99) continue; // only fully covered pixels: at the rim, antialiasing blends depth with the background
      const z = Z[i * 4];
      let m = 0;
      for (const [dx, dy, k] of offs) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
        const j = Y * W + X;
        if (A[j] >= 0.99 && z - Z[j * 4] > T && k > m) { m = k; if (m >= 1) break; }
      }
      E[i] = m * inner.alpha;
    }
  }

  // 4. compose, premultiplied: shadow, then the ink outline, then the model with its inner lines
  const [ir, ig, ib] = ol.color.map((c) => c / 255), ia = ol.alpha;
  const sh = (spec.shadowColor || [40, 28, 18]).map((c) => c / 255);
  const C = new Float32Array(W * W * 4);
  for (let i = 0; i < W * W; i++) {
    const sa = S[i * 4 + 3] / 255;
    let r0 = sh[0] * sa, g0 = sh[1] * sa, b0 = sh[2] * sa, a0 = sa;
    const oa = D[i] * ia;
    r0 = ir * oa + r0 * (1 - oa); g0 = ig * oa + g0 * (1 - oa); b0 = ib * oa + b0 * (1 - oa); a0 = oa + a0 * (1 - oa);
    const ma = A[i], e = E[i];
    const mr = (M[i * 4] / 255) * (1 - e) + ir * ma * e, mg = (M[i * 4 + 1] / 255) * (1 - e) + ig * ma * e, mbl = (M[i * 4 + 2] / 255) * (1 - e) + ib * ma * e;
    C[i * 4] = mr + r0 * (1 - ma);
    C[i * 4 + 1] = mg + g0 * (1 - ma);
    C[i * 4 + 2] = mbl + b0 * (1 - ma);
    C[i * 4 + 3] = ma + a0 * (1 - ma);
  }

  // 5. box filter down to the sprite size and un-premultiply
  const out = new ImageData(size, size);
  const n = ss * ss;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let R0 = 0, G0 = 0, B0 = 0, A0 = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const k = ((y * ss + j) * W + x * ss + i) * 4;
      R0 += C[k]; G0 += C[k + 1]; B0 += C[k + 2]; A0 += C[k + 3];
    }
    const a = A0 / n, o = (y * size + x) * 4;
    if (a < 1 / 512) continue;
    out.data[o] = Math.round(Math.min(1, R0 / n / a) * 255);
    out.data[o + 1] = Math.round(Math.min(1, G0 / n / a) * 255);
    out.data[o + 2] = Math.round(Math.min(1, B0 / n / a) * 255);
    out.data[o + 3] = Math.round(a * 255);
  }
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').putImageData(out, 0, 0);
  return c.toDataURL('image/png');
};

// Contact sheet: every sprite at full size, then at map size standing on discs in a few nations' colours, once on
// parchment and once on green.
window.contactSheet = async function contactSheet(items) {
  const imgs = await Promise.all(items.map(async (it) => { const im = new Image(); im.src = it.url; await im.decode(); return { ...it, im }; }));
  const discs = [[60, '#3b5f8f'], [48, '#9b3a2e'], [40, '#c39a3c'], [32, '#4d7a45']];
  const cell = 300, rowH = 230;
  const c = document.createElement('canvas');
  c.width = imgs.length * cell + 20; c.height = rowH * 2;
  const ctx = c.getContext('2d');
  ['#e9dcc0', '#6f8a4e'].forEach((bg, row) => {
    const y0 = row * rowH;
    ctx.fillStyle = bg; ctx.fillRect(0, y0, c.width, rowH);
    imgs.forEach((it, i) => {
      const x0 = 10 + i * cell;
      ctx.drawImage(it.im, x0, y0 + 8, 192, 192);
      ctx.fillStyle = row ? '#f4ecdc' : '#3a2a1a'; ctx.font = '13px sans-serif'; ctx.fillText(it.name, x0 + 6, y0 + 220);
      let y = y0 + 10;
      for (const [s, col] of discs) {
        const cx = x0 + 192 + 50, r = s * 0.42, cy = y + s - r * 0.55;
        ctx.fillStyle = col; ctx.strokeStyle = 'rgba(40,28,18,0.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.drawImage(it.im, cx - s / 2, y, s, s);
        y += s + 2;
      }
    });
  });
  return c.toDataURL('image/png');
};
window.ready = true;
`;

// ---------------------------------------------------------------------------------------------------------------

const TYPES = {
  '.js': 'text/javascript',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

async function main() {
  const args = process.argv.slice(2);
  const opt = name => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
  };
  const only = opt('--only');
  const outDir = typeof opt('--out') === 'string' ? path.resolve(opt('--out')) : OUT;
  const sheet = opt('--sheet');
  const sprites = SPRITES.filter(s => typeof only !== 'string' || only.split(',').includes(s.name));
  if (!sprites.length) throw new Error('no sprites to render');

  const kitIds = [
    ...new Set(
      JSON.stringify(sprites)
        .match(/kits\/(\w+)\//g)
        .map(m => m.split('/')[1]),
    ),
  ];
  const kits = loadKits(kitIds);

  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('console', m => {
    if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GroupMarkerNotSet/.test(m.text()))
      console.log(`  [page] ${m.text()}`);
  });
  page.on('pageerror', e => console.log(`  [page error] ${e.message}`));
  await page.route('https://units.local/**', route => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    const type = TYPES[path.extname(p)] || 'application/octet-stream';
    if (p === '/' || p === '/index.html') return route.fulfill({ contentType: 'text/html', body: PAGE });
    if (p === '/render.js') return route.fulfill({ contentType: type, body: RENDER_JS });
    if (p.startsWith('/three/')) {
      const f = path.join(THREE_DIR, p.slice('/three/'.length));
      if (f.startsWith(THREE_DIR) && fs.existsSync(f))
        return route.fulfill({ contentType: type, body: fs.readFileSync(f) });
    }
    const m = p.match(/^\/kits\/(\w+)\/(.+)$/);
    const entry = m && kits[m[1]] && kits[m[1]].get(m[2]);
    if (entry) return route.fulfill({ contentType: type, body: entry() });
    return route.fulfill({ status: 404, body: 'not found' });
  });
  await page.goto('https://units.local/');
  await page.waitForFunction(() => window.ready === true);

  fs.mkdirSync(outDir, { recursive: true });
  const done = [];
  for (const spec of sprites) {
    const url = await page.evaluate(s => window.renderSprite(s), { size: SIZE, ...spec });
    // Chromium's encoder is quick, not small: re-deflate
    const png = pngjs.PNG.sync.write(pngjs.PNG.sync.read(Buffer.from(url.split(',')[1], 'base64')), {
      deflateLevel: 9,
    });
    const file = path.join(outDir, `${spec.name}.png`);
    fs.writeFileSync(file, png);
    done.push({ name: spec.name, url });
    console.log(`  ${path.relative(root, file)}  ${(png.length / 1024).toFixed(1)} KB`);
  }
  if (sheet) {
    const file = typeof sheet === 'string' ? path.resolve(sheet) : path.join(CACHE, 'units-sheet.png');
    const url = await page.evaluate(items => window.contactSheet(items), done);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`  contact sheet: ${file}`);
  }
  await browser.close();
}

await main();
