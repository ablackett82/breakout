// The game. Atari's 1976 Breakout has no CPU and no program: it is about 44
// TTL chips wired to a black-and-white monitor turned on its side, with strips
// of coloured film over the glass. So there is nothing to trace instruction by
// instruction; this follows the cabinet's documented rules instead:
//
//   - 8 rows of 14 bricks; from the bottom, two rows each of yellow (1
//     point), green (3), orange (5) and red (7)
//   - the ball speeds up four times: after 4 hits, after 12 hits, and the
//     first time it reaches the orange rows and the red rows
//   - where the ball lands on the paddle (8 segments) sets its angle
//   - when the ball breaks through to the top wall the paddle shrinks to half
//   - a game is two walls of bricks (896 points is a perfect game); clear the
//     first and a new wall appears
//   - 3 balls a game (5 by an operator switch); two players take turns, each
//     with their own wall
//   - the ball is served from below the wall when the player presses Serve
//
// Pure and deterministic (a seeded random number generator), stepped at 60 Hz.

export const W = 240, H = 320;
export const FIELD_L = 8, FIELD_R = 232, TOP = 8;    // inside edges of the walls
export const COLS = 14, ROWS = 8, BRICK_W = 16, BRICK_H = 8, BRICK_TOP = 48;
export const BRICK_BOTTOM = BRICK_TOP + ROWS * BRICK_H;
export const PADDLE_Y = 288, PADDLE_H = 4, PADDLE_W = 24;
export const BALL = 4;
export const NET_Y = H - 8;                           // the safety-net cheat
export const ROW_POINTS = [7, 7, 5, 5, 3, 3, 1, 1];  // top row first

const BASE = 1.75;                          // vertical px per frame before any speed-up
const SPEEDS = [1, 1.2, 1.4, 1.65, 1.9];    // after 0..4 speed-ups
const ANGLES = [-1.5, -1, -0.6, -0.3, 0.3, 0.6, 1, 1.5]; // across per down, by paddle segment
const SERVE_ANGLES = [-1, -0.6, -0.3, 0.3, 0.6, 1];
const LOST_FRAMES = 75, OVER_FRAMES = 240;
const PADDLE_V0 = 2.5, PADDLE_VMAX = 6, PADDLE_ACCEL = 0.18; // buttons/keys

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fullWall = () => new Uint8Array(COLS * ROWS).fill(1);

export const DEFAULT_ASSIST = {
  speed: 1,          // ball speed multiplier
  noSpeedUp: false,
  paddleScale: 1,
  noShrink: false,
  unlimited: false,
  net: false,
  endless: false,
};

export class Breakout {
  /**
   * @param {object} o
   * @param {number} [o.players] 0 for the attract mode, else 1 or 2
   * @param {number} [o.balls] balls per player
   * @param {number} [o.seed]
   */
  constructor({ players = 0, balls = 3, seed = Date.now() } = {}) {
    this.rand = rng(seed);
    this.demo = players === 0;
    this.balls = balls;
    this.assist = { ...DEFAULT_ASSIST };
    this.autoServe = 90;   // frames before the ball is served by itself (0: wait for Serve)
    this.players = [];
    for (let i = 0; i < Math.max(1, players); i++) this.players.push({ score: 0, ball: 1, wall: 1, bricks: fullWall(), refill: false });
    this.cur = 0;
    this.paddleX = (FIELD_L + FIELD_R) / 2;
    this.paddleV = 0;
    this.aim = 0;          // the attract mode's paddle offset from the ball
    this.events = [];      // sounds for the front end: 'brick' | 'paddle' | 'wall' | 'lost'
    this.frameNo = 0;
    this.newBall();
    if (this.demo) this.launch();
  }

  get player() { return this.players[this.cur]; }
  get bricks() { return this.player.bricks; }
  get over() { return this.mode === 'over' && this.timer <= 0; }

  /** Speed-ups so far (0 to 4). */
  get speedLevel() {
    const s = this.speed;
    return (s.hits >= 4) + (s.hits >= 12) + s.orange + s.red;
  }

  get paddleWidth() {
    const w = PADDLE_W * this.assist.paddleScale * (this.shrunk ? 0.5 : 1);
    return Math.min(w, FIELD_R - FIELD_L);
  }

  /** Put the paddle's centre at x (the knob, or a finger). */
  setPaddle(x) {
    const h = this.paddleWidth / 2;
    this.paddleX = Math.max(FIELD_L + h, Math.min(FIELD_R - h, x));
  }

  /** Ready the next ball: waiting to be served, speed and paddle back to normal. */
  newBall() {
    this.mode = this.demo ? 'play' : 'serve';
    this.timer = 0;
    this.ball = null;
    this.shrunk = false;
    this.speed = { hits: 0, orange: 0, red: 0 };
    this.ignore = new Set();
    this.setPaddle(this.paddleX);
  }

  /** The Serve button. */
  serve() {
    if (this.mode === 'serve') this.launch();
  }

  launch() {
    const x = FIELD_L + 8 + this.rand() * (FIELD_R - FIELD_L - 16 - BALL);
    this.ball = { x, y: BRICK_BOTTOM + 24, dx: SERVE_ANGLES[Math.floor(this.rand() * SERVE_ANGLES.length)], dy: 1 };
    this.mode = 'play';
  }

  /** Clear the wall (the skip cheat): no points, and the next wall follows as usual. */
  skipWall() {
    if (this.demo || this.mode === 'over') return;
    this.bricks.fill(0);
    this.wallCleared();
  }

  wallCleared() {
    const p = this.player;
    if (this.demo || p.wall < 2 || this.assist.endless) p.refill = true;
  }

  /** One 60 Hz frame. move: -1, 0 or 1 from buttons or keys. */
  step(move = 0) {
    this.frameNo++;
    this.events.length = 0;
    this.movePaddle(move);
    switch (this.mode) {
      case 'serve':
        if (this.autoServe && ++this.timer >= this.autoServe) this.launch();
        break;
      case 'play':
        this.moveBall();
        break;
      case 'lost':
        if (--this.timer <= 0) this.nextTurn();
        break;
      case 'over':
        if (this.timer > 0) this.timer--;
        break;
    }
  }

  movePaddle(move) {
    if (this.demo && this.ball) {
      this.setPaddle(this.ball.x + BALL / 2 + this.aim);
      return;
    }
    if (!move) { this.paddleV = 0; return; }
    this.paddleV = Math.min(PADDLE_VMAX, this.paddleV ? this.paddleV + PADDLE_ACCEL : PADDLE_V0);
    this.setPaddle(this.paddleX + move * this.paddleV);
  }

  moveBall() {
    const b = this.ball, a = this.assist;
    const v = BASE * (a.noSpeedUp ? 1 : SPEEDS[this.speedLevel]) * a.speed;
    const n = Math.max(1, Math.ceil(v * Math.max(1, Math.abs(b.dx))));
    for (let i = 0; i < n && this.mode === 'play'; i++) {
      b.x += b.dx * v / n;
      b.y += b.dy * v / n;
      this.collide();
    }
  }

  collide() {
    const b = this.ball;
    // the walls
    if (b.x < FIELD_L) { b.x = 2 * FIELD_L - b.x; b.dx = Math.abs(b.dx); this.events.push('wall'); }
    if (b.x + BALL > FIELD_R) { b.x = 2 * (FIELD_R - BALL) - b.x; b.dx = -Math.abs(b.dx); this.events.push('wall'); }
    if (b.y < TOP) {
      b.y = 2 * TOP - b.y; b.dy = 1;
      this.events.push('wall');
      // broken through: the paddle halves
      if (!this.demo && !this.assist.noShrink && !this.shrunk) { this.shrunk = true; this.setPaddle(this.paddleX); }
    }
    this.hitBricks();
    // the paddle (only from above, and only on its top few lines)
    const bottom = b.y + BALL;
    if (b.dy > 0 && bottom >= PADDLE_Y && bottom < PADDLE_Y + PADDLE_H) {
      const w = this.paddleWidth, left = this.paddleX - w / 2;
      if (b.x + BALL > left && b.x < left + w) {
        const seg = Math.max(0, Math.min(7, Math.floor((b.x + BALL / 2 - left) / w * 8)));
        b.dx = ANGLES[seg];
        b.dy = -1;
        b.y = PADDLE_Y - BALL;
        this.events.push('paddle');
        if (this.demo) this.aim = (this.rand() - 0.5) * w * 0.9;
        const p = this.player;
        if (p.refill) { p.refill = false; p.bricks = fullWall(); if (!this.demo) p.wall++; this.ignore.clear(); }
        return;
      }
    }
    if (this.assist.net && !this.demo && b.dy > 0 && bottom >= NET_Y) {
      b.y = NET_Y - BALL; b.dy = -1;
      this.events.push('wall');
      return;
    }
    if (b.y > H) this.lose();
  }

  /** The brick cells the ball overlaps, as indexes. */
  cellsUnderBall() {
    const b = this.ball, out = [];
    const r0 = Math.floor((b.y - BRICK_TOP) / BRICK_H), r1 = Math.floor((b.y + BALL - 0.001 - BRICK_TOP) / BRICK_H);
    if (r1 < 0 || r0 >= ROWS) return out;
    const c0 = Math.floor((b.x - FIELD_L) / BRICK_W), c1 = Math.floor((b.x + BALL - 0.001 - FIELD_L) / BRICK_W);
    for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) out.push(r * COLS + c);
    }
    return out;
  }

  /** One brick per hit; the ball turns back vertically, whichever face it struck. */
  hitBricks() {
    const cells = this.cellsUnderBall();
    // a brick the ball was already touching when it last bounced can't be hit
    // again until the ball has left it (stops a ball straddling two bricks
    // taking both and carrying on)
    for (const i of this.ignore) if (!cells.includes(i)) this.ignore.delete(i);
    const bricks = this.bricks;
    const live = cells.filter((i) => bricks[i] && !this.ignore.has(i));
    if (!live.length) return;
    const b = this.ball, cx = b.x + BALL / 2, cy = b.y + BALL / 2;
    // the one under the middle of the ball, or failing that the nearest
    const dist = (i) => Math.hypot(FIELD_L + (i % COLS + 0.5) * BRICK_W - cx, BRICK_TOP + (Math.floor(i / COLS) + 0.5) * BRICK_H - cy);
    const hit = live.reduce((best, i) => (dist(i) < dist(best) ? i : best));
    bricks[hit] = 0;
    for (const i of cells) this.ignore.add(i);
    b.dy = -b.dy;
    this.events.push('brick');
    if (this.demo) { if (!bricks.some(Boolean)) this.wallCleared(); return; }
    const row = Math.floor(hit / COLS);
    this.player.score += ROW_POINTS[row];
    const s = this.speed;
    s.hits++;
    if (row <= 1) s.red = 1;
    else if (row <= 3) s.orange = 1;
    if (!bricks.some(Boolean)) this.wallCleared();
  }

  lose() {
    if (this.demo) { this.launch(); return; }
    this.events.push('lost');
    this.ball = null;
    this.mode = 'lost';
    this.timer = LOST_FRAMES;
  }

  /** After a lost ball: the other player's turn if they have balls left, else this player's, else game over. */
  nextTurn() {
    const p = this.player;
    if (!this.assist.unlimited) p.ball++;
    const left = (q) => q.ball <= this.balls;
    const other = this.players[(this.cur + 1) % this.players.length];
    if (other !== p && left(other)) this.cur = this.players.indexOf(other);
    else if (!left(p)) { this.mode = 'over'; this.timer = OVER_FRAMES; return; }
    this.newBall();
  }
}
