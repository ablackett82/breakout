// The cabinet's rules, checked against the engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Breakout, COLS, ROWS, BRICK_W, BRICK_H, BRICK_TOP, BRICK_BOTTOM, FIELD_L, PADDLE_Y, PADDLE_W, BALL, TOP, H,
} from '../src/game/breakout.js';

/** A one-player game with the ball served and placed at (x, y) moving (dx, dy). */
function game(x, y, dx, dy, opts = {}) {
  const g = new Breakout({ players: 1, seed: 1, ...opts });
  g.serve();
  Object.assign(g.ball, { x, y, dx, dy });
  return g;
}
const colX = (c) => FIELD_L + c * BRICK_W + BRICK_W / 2 - BALL / 2;
const run = (g, n, move = 0) => { for (let i = 0; i < n; i++) g.step(move); };

test('a game waits for Serve, then serves from under the wall going down', () => {
  const g = new Breakout({ players: 1, seed: 7 });
  g.autoServe = 0;
  run(g, 300);
  assert.equal(g.mode, 'serve');
  assert.equal(g.ball, null);
  g.serve();
  assert.equal(g.mode, 'play');
  assert.ok(g.ball.y > BRICK_BOTTOM && g.ball.dy === 1);
});

test('rows score 1, 3, 5 and 7 from the bottom up, one brick per hit', () => {
  for (const [row, pts] of [[7, 1], [5, 3], [3, 5], [1, 7]]) {
    const g = game(colX(5), BRICK_BOTTOM + 2, 0, -1);
    // clear the rows below so the ball reaches this one
    for (let r = row + 1; r < ROWS; r++) g.bricks[r * COLS + 5] = 0;
    let n = 0;
    while (g.player.score === 0 && n++ < 200) g.step();
    assert.equal(g.player.score, pts, `row ${row}`);
    assert.equal(g.bricks[row * COLS + 5], 0);
    assert.equal(g.bricks.reduce((a, b) => a + b), COLS * ROWS - ROWS + row);
    assert.equal(g.ball.dy, 1, 'turns back down');
  }
});

test('speed-ups after 4 and 12 hits and on first reaching orange and red', () => {
  const g = game(colX(0), BRICK_BOTTOM + 2, 0, -1);
  const s = g.speed;
  s.hits = 3; assert.equal(g.speedLevel, 0);
  s.hits = 4; assert.equal(g.speedLevel, 1);
  s.hits = 12; assert.equal(g.speedLevel, 2);
  s.orange = 1; assert.equal(g.speedLevel, 3);
  s.red = 1; assert.equal(g.speedLevel, 4);
  // and hitting an orange brick sets the flag
  const h = game(colX(2), BRICK_TOP + 4 * BRICK_H + 2, 0, -1);
  for (let r = 4; r < ROWS; r++) h.bricks[r * COLS + 2] = 0;
  run(h, 30);
  assert.equal(h.speed.orange, 1);
  assert.equal(h.speed.red, 0);
});

test('breaking through to the top wall halves the paddle (unless the cheat is on)', () => {
  for (const noShrink of [false, true]) {
    const g = game(colX(3), BRICK_TOP - 10, 0, -1);
    g.assist.noShrink = noShrink;
    run(g, 20);
    assert.ok(g.ball.dy === 1 && g.ball.y > TOP);
    assert.equal(g.paddleWidth, noShrink ? PADDLE_W : PADDLE_W / 2);
  }
});

test('the paddle segment sets the angle', () => {
  const g = game(0, PADDLE_Y - BALL - 2, 0, 1);
  g.setPaddle(120);
  g.ball.x = 120 - PADDLE_W / 2 - BALL / 2 + 1; // far left edge
  run(g, 3);
  assert.equal(g.ball.dy, -1);
  assert.ok(g.ball.dx < -1, `steep left, got ${g.ball.dx}`);
  const h = game(0, PADDLE_Y - BALL - 2, 0, 1);
  h.setPaddle(120);
  h.ball.x = 120 + 1 - BALL / 2;   // just right of centre
  run(h, 3);
  assert.ok(h.ball.dx > 0 && h.ball.dx < 0.5, `shallow right, got ${h.ball.dx}`);
});

test('missing the ball loses it; 3 balls then game over', () => {
  const g = new Breakout({ players: 1, seed: 3 });
  for (let ball = 1; ball <= 3; ball++) {
    assert.equal(g.player.ball, ball);
    g.serve();
    g.setPaddle(FIELD_L + 10);
    Object.assign(g.ball, { x: 200, y: PADDLE_Y + 10, dx: 0, dy: 1 });
    run(g, 200);
  }
  assert.equal(g.mode, 'over');
  run(g, 300);
  assert.ok(g.over);
});

test('two players take turns, each with their own wall and score', () => {
  const g = new Breakout({ players: 2, seed: 3 });
  g.serve();
  g.bricks[7 * COLS] = 0;
  g.player.score = 5;
  Object.assign(g.ball, { x: 200, y: H - 5, dx: 0, dy: 1 });
  run(g, 100);
  assert.equal(g.cur, 1);
  assert.equal(g.player.score, 0);
  assert.equal(g.bricks[7 * COLS], 1);
  assert.equal(g.players[0].bricks[7 * COLS], 0);
});

test('a cleared wall is replaced once (two walls a game) unless endless', () => {
  for (const endless of [false, true]) {
    const g = game(colX(0), BRICK_BOTTOM + 2, 0, -1);
    g.assist.endless = endless;
    for (let wall = 1; wall <= 3; wall++) {
      g.skipWall();
      // bounce it off the paddle: the new wall arrives then
      g.setPaddle(colX(0) + BALL / 2);
      Object.assign(g.ball, { x: colX(0), y: PADDLE_Y - BALL - 2, dx: 0, dy: 1 });
      run(g, 3);
    }
    assert.equal(g.bricks.some(Boolean), endless);
    assert.equal(g.player.wall, endless ? 4 : 2);
  }
});

test('the safety net and unlimited balls', () => {
  const g = game(100, H - 30, 0, 1);
  g.assist.net = true;
  run(g, 60);
  assert.equal(g.mode, 'play');
  const h = game(100, H - 5, 0, 1);
  h.assist.unlimited = true;
  for (let i = 0; i < 5; i++) { run(h, 100); h.serve(); Object.assign(h.ball, { y: H - 5, dy: 1 }); }
  assert.notEqual(h.mode, 'over');
  assert.equal(h.player.ball, 1);
});

test('the ball never passes through a brick, and stays inside the walls', () => {
  // a long random game at top speed with a perfect paddle
  const g = new Breakout({ players: 1, seed: 99 });
  g.assist.unlimited = true;
  g.serve();
  g.speed.hits = 12; g.speed.orange = g.speed.red = 1;
  for (let i = 0; i < 20000; i++) {
    if (g.ball) g.setPaddle(g.ball.x + BALL / 2);
    g.step();
    if (g.mode === 'serve') g.serve();
    const b = g.ball;
    if (!b) continue;
    assert.ok(b.x >= FIELD_L - 0.001 && b.x + BALL <= 232.001, `x ${b.x}`);
    assert.ok(b.y >= TOP - 0.001);
    for (const c of g.cellsUnderBall()) assert.ok(!g.bricks[c] || g.ignore.has(c), `inside brick ${c} at frame ${i}`);
  }
  assert.ok(g.player.score > 400, `score ${g.player.score}`);
});

test('the attract mode plays itself forever without scoring', () => {
  const g = new Breakout({ players: 0, seed: 5 });
  run(g, 30000);
  assert.equal(g.mode, 'play');
  assert.equal(g.player.score, 0);
});
