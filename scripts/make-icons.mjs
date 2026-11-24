// Generates the extension's PNG icons (a rounded blue square with a white "pulse" dot)
// without any image dependencies. Run with `npm run icons`.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function icon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = size * 0.22; // corner radius
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      const dx = Math.max(r - px, px - (size - r), 0);
      const dy = Math.max(r - py, py - (size - r), 0);
      const inside = Math.hypot(dx, dy) <= r;
      const d = Math.hypot(px - c, py - c);
      let rgba = [0, 0, 0, 0];
      if (inside) rgba = [37, 99, 235, 255];
      if (inside && d <= size * 0.34 && d >= size * 0.26) rgba = [191, 219, 254, 255];
      if (d <= size * 0.16) rgba = [255, 255, 255, 255];
      raw.set(rgba, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(new URL(`../static/icons/icon${size}.png`, import.meta.url), icon(size));
}
console.log("Icons written to static/icons/");
