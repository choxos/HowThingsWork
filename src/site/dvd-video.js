// ITU-T H.262 (2000), sections 6.2, 7.2, 7.4 and Tables B.2, B.12–14.
// Deliberately limited MPEG-2 subset: 720×576, 25 Hz, progressive I-pictures,
// 4:2:0, eight-bit DC precision, flat 8×8 blocks, no motion or AC coefficients.
export const DVD_VIDEO_WIDTH = 720;
export const DVD_VIDEO_HEIGHT = 576;
export const DVD_VIDEO_FPS = 25;
export const DVD_VIDEO_FRAMES = 50;
export const DVD_CLIPS = ['Bouncing ball', 'Rocket flight', 'Rising sun'];
const MB_WIDTH = DVD_VIDEO_WIDTH / 16;
const MB_HEIGHT = DVD_VIDEO_HEIGHT / 16;
const DC_LUMA = ['100', '00', '01', '101', '110', '1110', '11110', '111110', '1111110', '11111110', '111111110', '111111111'];
const DC_CHROMA = ['00', '01', '10', '110', '1110', '11110', '111110', '1111110', '11111110', '111111110', '1111111110', '1111111111'];
const clipByte = x => Math.max(0, Math.min(255, Math.round(x)));
const yuv = ([r, g, b]) => [
  clipByte(16 + (65.481 * r + 128.553 * g + 24.966 * b) / 255),
  clipByte(128 + (-37.797 * r - 74.203 * g + 112 * b) / 255),
  clipByte(128 + (112 * r - 93.786 * g - 18.214 * b) / 255),
];
const COLORS = {
  sky: yuv([65, 125, 171]), ground: yuv([39, 74, 62]), dark: yuv([21, 36, 59]),
  cream: yuv([249, 236, 196]), orange: yuv([240, 111, 46]), yellow: yuv([252, 198, 56]),
  blue: yuv([50, 105, 166]), rose: yuv([215, 87, 92]), teal: yuv([60, 173, 163]),
};

class VideoBitsWriter {
  constructor() { this.bytes = []; this.value = 0; this.used = 0; }
  put(value, count) {
    for (let bit = count - 1; bit >= 0; bit--) {
      this.value = (this.value << 1) | ((value >>> bit) & 1);
      if (++this.used === 8) { this.bytes.push(this.value); this.value = 0; this.used = 0; }
    }
  }
  vlc(word) { for (const bit of word) this.put(Number(bit), 1); }
  align() { if (this.used) this.put(0, 8 - this.used); }
  start(code) { this.align(); this.bytes.push(0, 0, 1, code); }
  finish() { this.align(); return Uint8Array.from(this.bytes); }
}

class VideoBitsReader {
  constructor(bytes, start, end) { this.bytes = bytes; this.bit = start * 8; this.end = end * 8; }
  get(count) {
    if (this.bit + count > this.end) throw new Error('Truncated MPEG-2 field');
    let value = 0;
    for (let i = 0; i < count; i++, this.bit++) {
      const byte = this.bytes[this.bit >>> 3];
      if (byte < 0) throw new Error('Missing MPEG-2 byte');
      value = value * 2 + ((byte >>> (7 - (this.bit & 7))) & 1);
    }
    return value;
  }
  expect(value, count) { if (this.get(count) !== value) throw new Error('Unsupported MPEG-2 field'); }
  dc(table) {
    let word = '';
    for (let n = 0; n < 12; n++) {
      word += this.get(1);
      const size = table.indexOf(word);
      if (size >= 0) {
        const value = this.get(size);
        return size === 0 ? 0 : value >= 2 ** (size - 1) ? value : value + 1 - 2 ** size;
      }
    }
    throw new Error('Invalid MPEG-2 DC code');
  }
  padding() { while (this.bit < this.end) this.expect(0, 1); }
}

export function dvdSourceVideoFrame(clip, frame) {
  if (!Number.isInteger(clip) || clip < 0 || clip >= DVD_CLIPS.length || !Number.isInteger(frame) || frame < 0 || frame >= DVD_VIDEO_FRAMES) throw new RangeError('DVD clip or frame');
  const blocks = new Uint8Array(MB_WIDTH * MB_HEIGHT * 6);
  const t = frame / (DVD_VIDEO_FRAMES - 1);
  const ballX = 6 + 32 * t, ballY = 26 - 16 * Math.abs(Math.sin(t * Math.PI * 2));
  const rocketX = 22, rocketY = 27 - t * 21;
  const sunY = 31 - t * 19;
  for (let row = 0; row < MB_HEIGHT; row++) for (let col = 0; col < MB_WIDTH; col++) {
    let color = row >= 31 ? COLORS.ground : clip === 1 ? COLORS.dark : COLORS.sky;
    if (clip === 0) {
      if ((col - ballX) ** 2 + (row - ballY) ** 2 < 16) color = COLORS.orange;
      if ((col - ballX + 1) ** 2 + (row - ballY + 1) ** 2 < 2) color = COLORS.cream;
    } else if (clip === 1) {
      if (row < 29 && ((col * 17 + row * 31) % 109 === 0)) color = COLORS.cream;
      const dx = Math.abs(col - rocketX), dy = row - rocketY;
      if (dy >= -5 && dy <= 4 && dx <= Math.min(3, (dy + 6) / 2)) color = COLORS.cream;
      if (dy >= 2 && dy <= 5 && dx <= 5) color = COLORS.rose;
      if (dy >= -2 && dy <= 0 && dx <= 1) color = COLORS.blue;
      if (dy > 5 && dy < 9 + (frame % 3) && dx < 2) color = COLORS.orange;
    } else {
      if ((col - 22) ** 2 + (row - sunY) ** 2 < 36 && row < 31) color = COLORS.yellow;
      if (row >= 28 && row >= 34 - Math.abs(col - 15) / 4) color = COLORS.teal;
      if (row >= 32) color = COLORS.ground;
    }
    const offset = (row * MB_WIDTH + col) * 6;
    blocks.fill(color[0], offset, offset + 4);
    blocks[offset + 4] = color[1]; blocks[offset + 5] = color[2];
  }
  return blocks;
}

export function dvdEncodeVideo(clip = 0) {
  const out = new VideoBitsWriter();
  out.start(0xb3);
  out.put(DVD_VIDEO_WIDTH, 12); out.put(DVD_VIDEO_HEIGHT, 12);
  out.put(2, 4); out.put(3, 4); // 4:3 display aspect ratio; 25 frames/s.
  out.put(15000, 18); out.put(1, 1); out.put(112, 10); out.put(0, 3); // 6 Mbit/s upper bound, 224 KiB VBV.
  out.start(0xb5);
  out.put(1, 4); out.put(0x48, 8); out.put(1, 1); out.put(1, 2);
  out.put(0, 4); out.put(0, 12); out.put(1, 1); out.put(0, 8); out.put(1, 1); out.put(0, 7);
  for (let frame = 0; frame < DVD_VIDEO_FRAMES; frame++) {
    out.start(0x00); out.put(frame, 10); out.put(1, 3); out.put(0xffff, 16); out.put(0, 1);
    out.start(0xb5); out.put(8, 4); out.put(0xffff, 16); out.put(0, 2); out.put(3, 2);
    for (const flag of [0, 1, 0, 0, 0, 0, 0, 1, 1, 0]) out.put(flag, 1);
    const blocks = dvdSourceVideoFrame(clip, frame);
    for (let row = 0; row < MB_HEIGHT; row++) {
      out.start(row + 1); out.put(8, 5); out.put(0, 1);
      const predictor = [128, 128, 128];
      for (let col = 0; col < MB_WIDTH; col++) {
        out.put(3, 2); // Address increment 1, intra macroblock without quantizer update.
        for (let block = 0; block < 6; block++) {
          const component = block < 4 ? 0 : block - 3;
          const value = blocks[(row * MB_WIDTH + col) * 6 + block];
          const diff = value - predictor[component]; predictor[component] = value;
          const size = diff === 0 ? 0 : Math.floor(Math.log2(Math.abs(diff))) + 1;
          out.vlc((component === 0 ? DC_LUMA : DC_CHROMA)[size]);
          out.put(diff < 0 ? 2 ** size - 1 + diff : diff, size);
          out.put(2, 2); // Table B.14 end of block: no AC coefficients.
        }
      }
    }
  }
  out.start(0xb7);
  return out.finish();
}

function videoStarts(bytes) {
  const starts = [];
  for (let i = 0; i + 3 < bytes.length; i++) if (bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 1 && bytes[i + 3] >= 0) {
    starts.push({ offset: i, code: bytes[i + 3] }); i += 3;
  }
  for (let i = 0; i < starts.length; i++) starts[i].end = starts[i + 1]?.offset ?? bytes.length;
  return starts;
}

// Accept received bytes only. A negative byte is an unrecovered erasure.
// Unsupported syntax and damaged pictures are rejected, never concealed with source pixels.
export function dvdDecodeVideo(bytes) {
  if (!bytes || !bytes.length || Array.from(bytes).some(x => !Number.isInteger(x) || x < -1 || x > 255)) throw new TypeError('MPEG-2 bytes');
  const starts = videoStarts(bytes), frames = [], errors = [];
  const result = { width: 0, height: 0, fps: 0, frames, errors, sequenceValid: false, ended: false };
  let sequenceHeader = false, sequenceExtension = false, picture = null, lastReference = -1;
  const finishPicture = () => {
    if (!picture) return;
    picture.valid = picture.valid && picture.coding && picture.rows === MB_HEIGHT;
    if (!picture.valid) picture.blocks = null;
    frames.push(picture); picture = null;
  };
  for (const start of starts) {
    const bits = new VideoBitsReader(bytes, start.offset + 4, start.end);
    try {
      if (start.code === 0xb3) {
        finishPicture(); sequenceHeader = false; sequenceExtension = false;
        bits.expect(DVD_VIDEO_WIDTH, 12); bits.expect(DVD_VIDEO_HEIGHT, 12); bits.expect(2, 4); bits.expect(3, 4);
        if (!bits.get(18)) throw new Error('Invalid bitrate');
        bits.expect(1, 1); if (!bits.get(10)) throw new Error('Invalid VBV buffer');
        bits.expect(0, 3); bits.padding(); sequenceHeader = true;
      } else if (start.code === 0xb5) {
        const type = bits.get(4);
        if (type === 1 && sequenceHeader && !picture) {
          bits.expect(0x48, 8); bits.expect(1, 1); bits.expect(1, 2); bits.expect(0, 4); bits.expect(0, 12);
          bits.expect(1, 1); bits.expect(0, 8); bits.expect(1, 1); bits.expect(0, 7); bits.padding(); sequenceExtension = true;
          result.width = DVD_VIDEO_WIDTH; result.height = DVD_VIDEO_HEIGHT; result.fps = DVD_VIDEO_FPS; result.sequenceValid = true;
        } else if (type === 8 && picture) {
          bits.expect(0xffff, 16); bits.expect(0, 2); bits.expect(3, 2);
          for (const flag of [0, 1, 0, 0, 0, 0, 0, 1, 1, 0]) bits.expect(flag, 1);
          bits.padding(); picture.coding = true;
        } else throw new Error('Unsupported MPEG-2 extension');
      } else if (start.code === 0) {
        finishPicture();
        const reference = bits.get(10);
        if (reference <= lastReference) throw new Error('Invalid picture order');
        lastReference = reference;
        picture = { reference, offset: start.offset, end: start.end, valid: sequenceHeader && sequenceExtension, coding: false, rows: 0, blocks: new Uint8Array(MB_WIDTH * MB_HEIGHT * 6) };
        bits.expect(1, 3); bits.expect(0xffff, 16); bits.expect(0, 1); bits.padding();
      } else if (start.code >= 1 && start.code <= 0xaf) {
        if (!picture || !picture.coding || start.code !== picture.rows + 1 || start.code > MB_HEIGHT) throw new Error('Missing or unsupported MPEG-2 slice');
        if (!bits.get(5)) throw new Error('Invalid slice quantizer');
        bits.expect(0, 1);
        const predictor = [128, 128, 128];
        for (let col = 0; col < MB_WIDTH; col++) {
          bits.expect(3, 2);
          for (let block = 0; block < 6; block++) {
            const component = block < 4 ? 0 : block - 3;
            const value = predictor[component] + bits.dc(component === 0 ? DC_LUMA : DC_CHROMA);
            if (value < 0 || value > 255) throw new Error('Invalid intra DC coefficient');
            predictor[component] = value; bits.expect(2, 2);
            // Inverse quantization gives F[0,0]=8*value; mismatch control gives
            // F[7,7]=1. Its IDCT contribution is at most 0.25, so every rounded
            // sample in this supported DC-only block is exactly value.
            picture.blocks[(picture.rows * MB_WIDTH + col) * 6 + block] = value;
          }
        }
        bits.padding(); picture.rows++; picture.end = start.end;
      } else if (start.code === 0xb7) {
        finishPicture(); result.ended = true; break;
      } else throw new Error('Unsupported MPEG-2 start code');
    } catch (error) {
      if (picture) picture.valid = false;
      if (start.code === 0xb3) { sequenceHeader = false; sequenceExtension = false; }
      errors.push({ offset: start.offset, code: start.code, message: error.message });
    }
  }
  finishPicture();
  return result;
}

export function dvdVideoYuv(frame) {
  if (!frame?.valid || !frame.blocks) return null;
  const planeSize = DVD_VIDEO_WIDTH * DVD_VIDEO_HEIGHT;
  const pixels = new Uint8Array(planeSize * 1.5);
  for (let row = 0; row < MB_HEIGHT; row++) for (let col = 0; col < MB_WIDTH; col++) {
    const base = (row * MB_WIDTH + col) * 6;
    for (let block = 0; block < 6; block++) {
      const width = block < 4 ? DVD_VIDEO_WIDTH : DVD_VIDEO_WIDTH / 2;
      const offset = block < 4 ? 0 : planeSize + (block - 4) * planeSize / 4;
      const x = block < 4 ? col * 16 + (block % 2) * 8 : col * 8;
      const y = block < 4 ? row * 16 + Math.floor(block / 2) * 8 : row * 8;
      for (let dy = 0; dy < 8; dy++) pixels.fill(frame.blocks[base + block], offset + (y + dy) * width + x, offset + (y + dy) * width + x + 8);
    }
  }
  return pixels;
}

// BT.601 limited-range YCbCr to display RGB, nearest-neighbor chroma expansion.
export function dvdVideoRgba(frame) {
  if (!frame?.valid || !frame.blocks) return null;
  const pixels = new Uint8ClampedArray(DVD_VIDEO_WIDTH * DVD_VIDEO_HEIGHT * 4);
  for (let y = 0; y < DVD_VIDEO_HEIGHT; y++) for (let x = 0; x < DVD_VIDEO_WIDTH; x++) {
    const base = (Math.floor(y / 16) * MB_WIDTH + Math.floor(x / 16)) * 6;
    const luma = frame.blocks[base + Math.floor((y % 16) / 8) * 2 + Math.floor((x % 16) / 8)] - 16;
    const cb = frame.blocks[base + 4] - 128, cr = frame.blocks[base + 5] - 128;
    const offset = (y * DVD_VIDEO_WIDTH + x) * 4;
    pixels[offset] = clipByte(1.164383 * luma + 1.596027 * cr);
    pixels[offset + 1] = clipByte(1.164383 * luma - 0.391762 * cb - 0.812968 * cr);
    pixels[offset + 2] = clipByte(1.164383 * luma + 2.017232 * cb); pixels[offset + 3] = 255;
  }
  return pixels;
}
