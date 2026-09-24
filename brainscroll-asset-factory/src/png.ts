// Minimal PNG reader (dimensions + real transparency check) and a tiny encoder for mock mode.
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface PngInfo {
  width: number;
  height: number;
  transparent: boolean;
}

/**
 * An image counts as transparent when at least 1% of its pixels are not fully opaque.
 * That filters out PNGs that merely carry an alpha channel filled with 255.
 */
export function inspectPng(buf: Buffer): PngInfo {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG file');

  let width = 0, height = 0, bitDepth = 8, colorType = 0, interlace = 0;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];

  for (let p = 8; p + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }

  const hasAlphaChannel = colorType === 4 || colorType === 6;
  if (!hasAlphaChannel) {
    // Palette or color-key transparency. Rare for generated art; treat any non-opaque entry as transparent.
    const transparent = !!trns && (colorType !== 3 || trns.some((a) => a < 255));
    return { width, height, transparent };
  }
  if (interlace) return { width, height, transparent: true };

  const channels = colorType === 6 ? 4 : 2;
  const bpp = (channels * bitDepth) / 8;
  const alphaOffset = (channels - 1) * (bitDepth / 8);
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));

  let prev = Buffer.alloc(stride);
  let cur = Buffer.alloc(stride);
  let notOpaque = 0;
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    raw.copy(cur, 0, rowStart + 1, rowStart + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) if (cur[x * bpp + alphaOffset] < 250) notOpaque++;
    [prev, cur] = [cur, prev];
  }
  return { width, height, transparent: notOpaque / (width * height) >= 0.01 };
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Placeholder art for MOCK_OPENAI=1: a colored disc on a transparent canvas. */
export function mockPng(seed: string, size = 512): Buffer {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [r, g, b] = [80 + (h % 160), 80 + ((h >> 8) % 160), 80 + ((h >> 16) % 160)];
  const rows: Buffer[] = [];
  const c = size / 2, radius = size * 0.36;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > radius) continue;
      const edge = d > radius - size * 0.02;
      const shade = 1 - (0.35 * (x + y)) / (2 * size);
      const o = 1 + x * 4;
      row[o] = edge ? 20 : Math.round(r * shade);
      row[o + 1] = edge ? 24 : Math.round(g * shade);
      row[o + 2] = edge ? 40 : Math.round(b * shade);
      row[o + 3] = 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
