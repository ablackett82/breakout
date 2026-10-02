#!/usr/bin/env node
// Renders the home-screen icons: icons/icon-180.png (iOS), icon-192.png,
// icon-512.png. Four rows of bricks in the overlay colours with a gap knocked
// out, the ball, and the blue paddle, on black with square pixels. Everything
// sits inside the middle 80% so the maskable crop is safe.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster } from './png.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROWS = [[255, 48, 48], [255, 150, 30], [40, 230, 70], [255, 235, 50]];
const BLUE = [50, 140, 255], WHITE = [255, 255, 255], BLACK = [0, 0, 0];
const GONE = new Set(['3,4', '2,4', '3,3', '3,5', '2,5']); // row,col knocked out

function icon(size) {
  const r = new Raster(size, size);
  r.fill(0, 0, size, size, BLACK);
  const u = size / 32;                 // a 32x32 grid, drawn within 4..28
  const box = (x, y, w, h, c) => r.fill(Math.round(x * u), Math.round(y * u), Math.round((x + w) * u) - Math.round(x * u), Math.round((y + h) * u) - Math.round(y * u), c);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
    if (!GONE.has(`${row},${col}`)) box(4 + col * 4, 6 + row * 2.5, 3.5, 2, ROWS[row]);
  }
  box(18, 18, 2, 2, WHITE);
  box(11, 25, 8, 1.5, BLUE);
  return r.encode(1);
}

fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
for (const size of [180, 192, 512]) fs.writeFileSync(path.join(ROOT, `icons/icon-${size}.png`), icon(size));
console.log('wrote icons/icon-{180,192,512}.png');
