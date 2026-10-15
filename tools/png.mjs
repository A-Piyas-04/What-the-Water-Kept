/**
 * Minimal PNG reader, so the smoke test can judge a screenshot rather than
 * the WebGL back buffer (which is empty after compositing).
 *
 * Supports the 8-bit RGB/RGBA non-interlaced images that Firefox produces.
 */
import { inflateSync } from 'node:zlib';

export const decodePng = (buffer) => {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  // Undo the per-scanline filters.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
};

/**
 * Describes an image: how bright it is, how much variety it has, and whether
 * it is plausibly a rendered game frame rather than a blank fill.
 */
export const imageStats = (buffer) => {
  const { width, height, channels, data } = decodePng(buffer);
  const colours = new Set();
  let sum = 0;
  let min = 255;
  let max = 0;
  const step = 2; // sample every other pixel; plenty for these metrics
  let n = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (r * 299 + g * 587 + b * 114) / 1000;
      sum += lum;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
      // Quantise so JPEG-ish noise does not inflate the count.
      colours.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
      n++;
    }
  }
  const mean = sum / n;
  let variance = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;
      const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      variance += (lum - mean) ** 2;
    }
  }
  return {
    width,
    height,
    mean: Number(mean.toFixed(2)),
    stdDev: Number(Math.sqrt(variance / n).toFixed(2)),
    min: Math.round(min),
    max: Math.round(max),
    distinctColours: colours.size,
  };
};
