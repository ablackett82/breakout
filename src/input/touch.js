// Touch controls for iPad, and the settings and pause menus. Every finger is
// tracked on its own (Pointer Events). Three ways to move the paddle:
//
//   follow  - the paddle sits under your finger (left to right; the finger
//             can be anywhere up and down, so in portrait it can slide along
//             the empty strip under the picture). Closest to the cabinet's
//             knob, which put the paddle wherever you turned it.
//   slide   - drag anywhere, like a trackpad: the paddle moves as far as your
//             finger does (times the slide speed), wherever you put it down.
//   buttons - hold the left or right half of the screen; the paddle speeds up
//             the longer you hold.
//
// A new finger on the screen also presses Serve. A quick tap starts a game.
// With a mouse, the paddle follows the pointer.

import { W } from '../game/breakout.js';

const STORE_KEY = 'breakout.touch';
const DEFAULTS = { mode: 'follow', sens: 1.5, size: 1, opacity: 0.35, autoServe: true };

export class Touch {
  constructor(el, canvas) {
    this.el = el;
    this.canvas = canvas;
    this.settings = { ...DEFAULTS, ...load() };
    this.pointers = new Map(); // id -> { x, t }
    this.lastId = null;        // the finger that moved most recently (follow mode)
    this.absX = null;          // follow mode / mouse: where the paddle should be, in picture px
    this.relDX = 0;            // slide mode: how far it should move, in picture px
    this.served = false;
    this.startTapped = false;
    this.seenTouch = false;
    this.state = { left: false, right: false };
    this.buildOverlay();
    this.bindEvents();
    this.applySettings();
    window.addEventListener('resize', () => this.layout());
  }

  get active() { return this.seenTouch; }

  /** Picture x for a window x. */
  toField(clientX) {
    const r = this.canvas.getBoundingClientRect();
    return (clientX - r.left) / r.width * W;
  }

  /** What the fingers want this frame: {absX, relDX, left, right, serve}. */
  take() {
    let absX = null;
    if (this.settings.mode === 'follow' && this.lastId !== null && this.pointers.has(this.lastId)) absX = this.toField(this.pointers.get(this.lastId).x);
    else if (this.hoverX !== null && this.pointers.size === 0) absX = this.toField(this.hoverX);
    const out = { absX, relDX: this.relDX, left: this.state.left, right: this.state.right, serve: this.served };
    this.relDX = 0;
    this.served = false;
    return out;
  }

  /** Let go of everything (a new game, a menu opening). */
  release() { this.pointers.clear(); this.lastId = null; this.relDX = 0; this.served = false; this.recompute(); }

  /** True once per tap (used for "tap to start"). */
  consumeStart() {
    const t = this.startTapped; this.startTapped = false; return t;
  }

  bindEvents() {
    const el = this.el;
    const opts = { passive: false };
    this.hoverX = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (e.pointerType !== 'mouse' && !this.seenTouch) { this.seenTouch = true; this.applySettings(); }
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
      this.pointers.set(e.pointerId, { x: e.clientX, t: performance.now() });
      this.lastId = e.pointerId;
      this.served = true;
      this.recompute();
    }, opts);
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this.hoverX = e.clientX;
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      e.preventDefault();
      if (this.settings.mode === 'slide') this.relDX += (e.clientX - p.x) / this.canvas.getBoundingClientRect().width * W * this.settings.sens;
      p.x = e.clientX;
      this.lastId = e.pointerId;
      this.recompute();
    }, opts);
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hoverX = null; });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      el.addEventListener(ev, (e) => {
        const p = this.pointers.get(e.pointerId);
        if (!p) return;
        this.pointers.delete(e.pointerId);
        if (ev === 'pointerup' && performance.now() - p.t < 400) this.startTapped = true;
        if (this.lastId === e.pointerId) this.lastId = [...this.pointers.keys()].pop() ?? null;
        this.recompute();
      }, opts);
    }
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => this.release());
  }

  /** Buttons mode: left / right from every live finger. */
  recompute() {
    const s = this.state;
    s.left = s.right = false;
    if (this.settings.mode === 'buttons') {
      const mid = window.innerWidth / 2;
      for (const p of this.pointers.values()) {
        if (p.x < mid) s.left = true; else s.right = true;
      }
      if (s.left && s.right) s.left = s.right = false;
    }
    this.paint();
  }

  // ---- visual side ----------------------------------------------------------

  buildOverlay() {
    const el = this.el;
    el.innerHTML = `
      <div class="tc-btn tc-l">&#9664;</div><div class="tc-btn tc-r">&#9654;</div>
      <div class="tc-strip">slide your finger here</div>
      <button class="tc-gear" type="button" aria-label="Settings"><svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true"><path d="M4 0h2v1h-2zM1 1h1v1h-1zM3 1h4v1h-4zM8 1h1v1h-1zM0 2h10v1h-10zM1 3h3v1h-3zM6 3h3v1h-3zM0 4h3v2h-3zM7 4h3v2h-3zM1 6h3v1h-3zM6 6h3v1h-3zM0 7h10v1h-10zM1 8h1v1h-1zM3 8h4v1h-4zM8 8h1v1h-1zM4 9h2v1h-2z"/></svg></button>
      <button class="tc-pause" type="button" aria-label="Pause"><svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="1" width="2" height="8"/><rect x="6" y="1" width="2" height="8"/></svg></button>
      <div class="tc-panel tc-menu" hidden>
        <h2>Paused</h2>
        <button class="tc-resume" type="button">Resume</button>
        <button class="tc-restart" type="button">Restart game</button>
        <button class="tc-quit" type="button">Quit to title</button>
      </div>
      <div class="tc-panel tc-settings" hidden>
        <h2>Settings</h2>
        <label>Players <select class="tc-opt" data-opt="players"><option value="1">1 player</option><option value="2">2 players (take turns)</option></select></label>
        <label>Balls per game <select class="tc-opt" data-opt="balls"><option value="3">3 (arcade)</option><option value="5">5 (arcade option)</option></select></label>
        <h3>Cheats</h3>
        <label>Ball speed <select class="tc-opt" data-opt="speed"><option value="1">Normal (arcade)</option><option value="0.8">Slow</option><option value="0.6">Very slow</option><option value="0.45">Super slow</option></select></label>
        <label>Paddle size <select class="tc-opt" data-opt="paddleScale"><option value="1">Normal (arcade)</option><option value="1.5">Wide</option><option value="2">Extra wide</option><option value="3">Huge</option></select></label>
        <label><input class="tc-opt" data-opt="noSpeedUp" type="checkbox"> Ball never speeds up</label>
        <label><input class="tc-opt" data-opt="noShrink" type="checkbox"> Paddle never shrinks</label>
        <label><input class="tc-opt" data-opt="unlimited" type="checkbox"> Unlimited balls</label>
        <label><input class="tc-opt" data-opt="net" type="checkbox"> Safety net (can't lose the ball)</label>
        <label><input class="tc-opt" data-opt="endless" type="checkbox"> Endless walls (not just two)</label>
        <button class="tc-skip" type="button">Skip this wall</button>
        <p class="tc-note">Only games with no cheats set the high score.</p>
        <h3>Controls</h3>
        <label>Move paddle with <select name="mode"><option value="follow">Follow my finger</option><option value="slide">Slide anywhere</option><option value="buttons">Left/right buttons</option></select></label>
        <label class="tc-sens">Slide speed <input name="sens" type="range" min="0.5" max="3" step="0.25"></label>
        <label><input name="autoServe" type="checkbox"> Serve the ball by itself</label>
        <label class="tc-size">Button size <input name="size" type="range" min="0.6" max="1.6" step="0.1"></label>
        <label>Opacity <input name="opacity" type="range" min="0.1" max="0.9" step="0.05"></label>
        <p class="tc-note">Touch the screen (or press Space) to serve.</p>
        <button class="tc-close" type="button">Done</button>
      </div>`;
    this.btns = { left: el.querySelector('.tc-l'), right: el.querySelector('.tc-r') };
    this.strip = el.querySelector('.tc-strip');
    this.panel = el.querySelector('.tc-settings');
    this.menu = el.querySelector('.tc-menu');
    this.gear = el.querySelector('.tc-gear');
    this.pauseBtn = el.querySelector('.tc-pause');
    // main.js hooks these
    this.onPanelToggle = null;
    this.onOption = null;
    this.onSkip = null;
    this.onPause = null;
    this.onRestart = null;
    this.onQuit = null;
    this.onLayout = null;
    this.optBoxes = [...el.querySelectorAll('.tc-opt')];
    for (const b of this.optBoxes) b.addEventListener('change', () => this.onOption?.(b.dataset.opt, b.type === 'checkbox' ? b.checked : Number(b.value)));
    el.querySelector('.tc-skip').addEventListener('click', () => { this.onSkip?.(); this.openPanel(false); });
    const stop = (e) => e.stopPropagation();
    for (const n of [this.gear, this.panel, this.pauseBtn, this.menu]) for (const ev of ['pointerdown', 'pointerup', 'pointermove']) n.addEventListener(ev, stop);
    this.gear.addEventListener('click', () => this.openPanel(true));
    this.pauseBtn.addEventListener('click', () => this.onPause?.(true));
    el.querySelector('.tc-resume').addEventListener('click', () => this.onPause?.(false));
    el.querySelector('.tc-restart').addEventListener('click', () => this.onRestart?.());
    el.querySelector('.tc-quit').addEventListener('click', () => this.onQuit?.());
    el.querySelector('.tc-close').addEventListener('click', () => this.openPanel(false));
    this.panel.addEventListener('input', (e) => {
      const f = e.target;
      if (!f.name) return; // the game options and cheats go to main.js
      this.settings[f.name] = f.type === 'checkbox' ? f.checked : f.type === 'range' ? Number(f.value) : f.value;
      save(this.settings);
      this.release();
      this.applySettings();
    });
  }

  /** Show the game options and cheats as main.js has them. */
  setOptions(o) {
    for (const b of this.optBoxes) {
      const v = o[b.dataset.opt];
      if (b.type === 'checkbox') b.checked = !!v; else b.value = String(v);
    }
  }

  /** Main loop: whether a game is on (shows the pause button) and whether it's paused (shows the menu). */
  setPlayState(playing, paused) {
    this.el.classList.toggle('tc-playing', playing);
    const show = playing && paused && this.panel.hidden;
    if (this.menu.hidden === show) { this.menu.hidden = !show; this.release(); }
  }

  openPanel(open) {
    this.panel.hidden = !open;
    this.release();
    this.onPanelToggle?.(open);
  }

  applySettings() {
    const s = this.settings, el = this.el;
    for (const f of this.panel.querySelectorAll('[name]')) {
      if (f.type === 'checkbox') f.checked = !!s[f.name]; else f.value = String(s[f.name]);
    }
    el.style.setProperty('--tc-opacity', s.opacity);
    el.classList.toggle('tc-visible', this.active);
    el.dataset.mode = s.mode;
    this.layout();
    this.onLayout?.();
  }

  get portrait() { return window.innerHeight > window.innerWidth; }

  /** Geometry in window pixels. */
  layout() {
    const Wd = window.innerWidth, Hd = window.innerHeight;
    const cs = getComputedStyle(document.documentElement);
    const inset = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
    const sb = inset('--sat-b'), sl = inset('--sat-l'), sr = inset('--sat-r');
    const u = this.settings.size * Math.min(Wd, Hd) * 0.1;
    const bw = 1.9 * u, bh = 1.6 * u;
    const by = Hd - sb - bh - u * 0.5;
    this.geom = { u, bw, bh, by };
    const place = (n, x) => { const s = n.style; s.left = `${x}px`; s.top = `${by}px`; s.width = `${bw}px`; s.height = `${bh}px`; s.fontSize = `${u * 0.6}px`; };
    place(this.btns.left, sl + u * 0.5);
    place(this.btns.right, Wd - sr - u * 0.5 - bw);
    const sh = this.stripHeight;
    const st = this.strip.style;
    st.left = `${sl + 16}px`; st.right = `${sr + 16}px`; st.bottom = `${sb + 12}px`; st.height = `${Math.max(0, sh - 24)}px`;
    st.fontSize = `${Math.max(13, Math.min(Wd, Hd) * 0.022)}px`;
    this.el.classList.toggle('tc-portrait', this.portrait);
    this.paint();
  }

  get stripHeight() { return Math.max(110, window.innerHeight * 0.15); }

  paint() {
    const s = this.state;
    this.btns.left.classList.toggle('on', s.left);
    this.btns.right.classList.toggle('on', s.right);
  }

  /** The height at the bottom of the screen the controls take up (for portrait layout). */
  get reserved() {
    if (!this.active || !this.portrait) return 0;
    if (this.settings.mode === 'buttons') return window.innerHeight - (this.geom.by - this.geom.u * 0.3);
    return this.stripHeight;
  }
}

function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function save(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* private mode / quota */ } }
