// Generates the self-made app icons (no third-party artwork, no image dependency).
// The motif is the figure Conjunctio (2112) drawn as sand-coloured dots.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = [0x72, 0x50, 0x21], DOT = [0xf4, 0xeb, 0xdc];
const ROWS = [2, 1, 1, 2];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

/** scale: fraction of the canvas used by the motif (maskable icons keep to the safe zone). */
function render(size, scale) {
  const centres = [];
  const span = size * scale, top = (size - span) / 2, step = span / 4, r = step * 0.3;
  ROWS.forEach((n, row) => {
    const y = top + step * (row + 0.5);
    if (n === 1) centres.push([size / 2, y]);
    else centres.push([size / 2 - step * 0.55, y], [size / 2 + step * 0.55, y]);
  });
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const line = y * (size * 3 + 1);
    raw[line] = 0;
    for (let x = 0; x < size; x++) {
      let a = 0;
      for (const [cx, cy] of centres) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        a = Math.max(a, Math.min(1, Math.max(0, r - d + 0.5)));
      }
      for (let c = 0; c < 3; c++) raw[line + 1 + x * 3 + c] = Math.round(BG[c] + (DOT[c] - BG[c]) * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), render(192, 0.62));
writeFileSync(new URL('icon-512.png', out), render(512, 0.62));
writeFileSync(new URL('maskable-512.png', out), render(512, 0.46));

const dots = ROWS.flatMap((n, row) => {
  const y = 14 + row * 12;
  return n === 1 ? [[32, y]] : [[25, y], [39, y]];
}).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('');
writeFileSync(new URL('../public/favicon.svg', import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#725021"/><g fill="#F4EBDC">${dots}</g></svg>\n`);
console.log('icons written');
