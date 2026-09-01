const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function readGeneratedPng(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (pos < bytes.length) {
    const len = bytes.readUInt32BE(pos);
    const type = bytes.subarray(pos + 4, pos + 8).toString();
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = [];
  const stride = width * 4 + 1;
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * stride], 0, 'generated PNG rows must use filter 0');
    for (let x = 0; x < width; x++) {
      const i = y * stride + 1 + x * 4;
      pixels.push([raw[i], raw[i + 1], raw[i + 2], raw[i + 3]]);
    }
  }
  return { width, height, pixels };
}

test('application icon contains the warm study color and mint rhythm accent', () => {
  const icon = readGeneratedPng(path.join(__dirname, '..', 'assets', 'icon.png'));
  assert.equal(icon.width, 512);
  assert.equal(icon.height, 512);
  assert.ok(icon.pixels.some(([r, g, b, a]) => a > 220 && r > 190 && g > 80 && g < 180 && b < 120));
  assert.ok(icon.pixels.some(([r, g, b, a]) => a > 220 && r < 120 && g > 120 && b > 70));
});

test('tray templates remain monochrome alpha masks at 1x and 2x', () => {
  for (const [name, size] of [['trayTemplate.png', 16], ['trayTemplate@2x.png', 32]]) {
    const icon = readGeneratedPng(path.join(__dirname, '..', 'assets', name));
    assert.equal(icon.width, size);
    assert.equal(icon.height, size);
    assert.ok(icon.pixels.some((pixel) => pixel[3] === 0));
    assert.ok(icon.pixels.some((pixel) => pixel[3] > 200));
    assert.ok(icon.pixels.every(([r, g, b]) => r === 0 && g === 0 && b === 0));
  }
});
