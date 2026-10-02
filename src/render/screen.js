// Draws the game as the cabinet shows it: a white picture on a black-and-white
// monitor, with strips of coloured film over the glass. Everything is drawn
// in white into a mask, then each lit pixel takes the colour of the film in
// front of it, so the ball changes colour as it flies through the bands, as
// it does on the real thing.
import {
  W, H, FIELD_L, FIELD_R, TOP, COLS, ROWS, BRICK_W, BRICK_H, BRICK_TOP, PADDLE_Y, PADDLE_H, BALL, NET_Y,
} from '../game/breakout.js';
import { FONT, DIGITS } from './font.js';

export const RED = [255, 48, 48], ORANGE = [255, 150, 30], GREEN = [40, 230, 70], YELLOW = [255, 235, 50];
export const BLUE = [50, 140, 255], WHITE = [255, 255, 255];

/** The film colour at picture row y. */
export function overlay(y) {
  const r = (y - BRICK_TOP) / BRICK_H;
  if (r >= 0 && r < 2) return RED;
  if (r >= 2 && r < 4) return ORANGE;
  if (r >= 4 && r < 6) return GREEN;
  if (r >= 6 && r < 8) return YELLOW;
  if (y >= PADDLE_Y - 12 && y < PADDLE_Y + 16) return BLUE;
  return WHITE;
}

export class Screen {
  constructor() {
    this.mask = new Uint8Array(W * H);
    this.rgba = new Uint8ClampedArray(W * H * 4);
    this.ink = new Uint8Array(H * 3);
    for (let y = 0; y < H; y++) this.ink.set(overlay(y), y * 3);
  }

  rect(x, y, w, h) {
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
    for (let j = y0; j < y1; j++) this.mask.fill(1, j * W + x0, j * W + x1);
  }

  /** Text in the small font (5x7), scale 1 or 2. */
  text(x, y, s, scale = 1) {
    for (let i = 0; i < s.length; i++) {
      const g = FONT[s[i]];
      if (!g) continue;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if ((g[r] >> (4 - c)) & 1) this.rect(x + (i * 6 + c) * scale, y + r * scale, scale, scale);
      }
    }
  }

  centred(y, s, scale = 1) { this.text(Math.round((W - (s.length * 6 - 1) * scale) / 2), y, s, scale); }

  /** A score in the big blocky digits (each a 3x5 grid of 4px blocks), right-aligned at x. */
  number(right, y, n, minDigits = 3) {
    const s = String(n).padStart(minDigits, '0');
    let x = right - s.length * 16 + 4;
    for (const ch of s) {
      const g = DIGITS[ch];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if ((g[r] >> (2 - c)) & 1) this.rect(x + c * 4, y + r * 4, 4, 4);
      x += 16;
    }
  }

  /** @param {import('../game/breakout.js').Breakout} g */
  draw(g, extra) {
    this.mask.fill(0);
    // the walls
    this.rect(0, 0, W, TOP);
    this.rect(0, 0, FIELD_L, H);
    this.rect(FIELD_R, 0, W - FIELD_R, H);
    // the scores and the ball number
    if (!g.demo || extra?.showScores) {
      const two = g.players.length === 2;
      const flash = g.mode === 'serve' && g.frameNo & 16;
      if (!(flash && g.cur === 0)) this.number(76, 16, g.players[0].score);
      if (two && !(flash && g.cur === 1)) this.number(FIELD_R - 8, 16, g.players[1].score);
      this.number(two ? 136 : FIELD_R - 8, 16, Math.min(9, g.player.ball), 1);
    }
    // the bricks
    const b = g.bricks;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (b[r * COLS + c]) this.rect(FIELD_L + c * BRICK_W, BRICK_TOP + r * BRICK_H + 1, BRICK_W - 1, BRICK_H - 2);
    }
    // the paddle, the ball, the net
    if (g.mode !== 'over') {
      const w = g.paddleWidth;
      this.rect(g.paddleX - w / 2, PADDLE_Y, w, PADDLE_H);
    }
    if (g.ball) this.rect(Math.floor(g.ball.x), Math.floor(g.ball.y), BALL, BALL);
    if (g.assist.net && !g.demo) for (let x = FIELD_L; x < FIELD_R; x += 8) this.rect(x, NET_Y, 5, 2);
    extra?.text?.(this);
    // through the film
    const { mask, rgba, ink } = this;
    for (let y = 0, p = 0; y < H; y++) {
      const r = ink[y * 3], gg = ink[y * 3 + 1], bb = ink[y * 3 + 2];
      for (let x = 0; x < W; x++, p++) {
        const o = p * 4;
        if (mask[p]) { rgba[o] = r; rgba[o + 1] = gg; rgba[o + 2] = bb; } else { rgba[o] = rgba[o + 1] = rgba[o + 2] = 0; }
        rgba[o + 3] = 255;
      }
    }
    return rgba;
  }
}

export { W as SCREEN_W, H as SCREEN_H };
