#!/usr/bin/env node
// Renders a frame of the game to a PNG: node tools/shot.mjs out.png [frames] [demo]
import fs from 'node:fs';
import { Breakout } from '../src/game/breakout.js';
import { Screen, SCREEN_W, SCREEN_H } from '../src/render/screen.js';
import { Raster } from './png.js';

const [out = 'shot.png', frames = '300', kind = 'play'] = process.argv.slice(2);
const g = new Breakout({ players: kind === 'demo' ? 0 : kind === '2p' ? 2 : 1, seed: 42 });
for (let i = 0; i < Number(frames); i++) {
  if (!g.demo && g.ball) g.setPaddle(g.ball.x + 2 + 5);
  g.step();
}
const s = new Screen();
const rgba = s.draw(g, { text: (sc) => { if (g.demo) { sc.centred(150, 'BREAKOUT', 2); sc.centred(204, 'TAP TO START'); } } });
fs.writeFileSync(out, new Raster(SCREEN_W, SCREEN_H).fromRGBA(rgba).encode(3));
console.log(`${out}: mode ${g.mode}, score ${g.player.score}, ball ${g.player.ball}`);
