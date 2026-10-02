// Entry point: runs the game at 60 Hz and draws it. The title screen is an
// attract mode (the computer playing); a tap or Space starts a game. The
// options, cheats, saved high score and pausing live here, outside the game.
import { Breakout, DEFAULT_ASSIST } from './game/breakout.js';
import { Screen, SCREEN_W, SCREEN_H } from './render/screen.js';
import { Sound } from './render/audio.js';
import { Keyboard } from './input/keyboard.js';
import { Gamepad } from './input/gamepad.js';
import { Touch } from './input/touch.js';

const STEP = 1 / 60;
const MAX_CATCHUP = 0.1;
const STORE = 'breakout.';
const CHEATS = Object.keys(DEFAULT_ASSIST);
const SPEEDS = [1, 0.8, 0.6, 0.45];
const PADDLES = [1, 1.5, 2, 3];

const store = {
  get(k, d) { try { return localStorage.getItem(STORE + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(STORE + k, String(v)); } catch { /* storage blocked */ } },
};

function main() {
  const canvas = document.getElementById('screen');
  canvas.width = SCREEN_W; canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const image = ctx.createImageData(SCREEN_W, SCREEN_H);
  const screen = new Screen();
  const sound = new Sound();
  const keyboard = new Keyboard();
  const gamepad = new Gamepad();
  const touch = new Touch(document.getElementById('touch'), canvas);

  // the options: players and balls are the arcade's own; the rest are cheats
  const opts = { players: Number(store.get('players', 1)) === 2 ? 2 : 1, balls: Number(store.get('balls', 3)) === 5 ? 5 : 3 };
  for (const c of CHEATS) {
    const d = DEFAULT_ASSIST[c], v = store.get(c, null);
    opts[c] = typeof d === 'boolean' ? v === '1' : (v !== null && Number(v)) || d;
  }
  let highScore = Number(store.get('highscore', 0)) || 0;
  let paused = false, settingsOpen = false, assisted = false;
  let acc = 0, last = performance.now(), frameNo = 0;
  let g = attract();

  touch.setOptions(opts);
  touch.onPanelToggle = (open) => { settingsOpen = open; };
  touch.onOption = (name, v) => setOption(name, v);
  touch.onPause = (on) => { paused = on && inGame(); };
  touch.onRestart = () => { const n = g.demo ? opts.players : g.players.length; quit(); start(n); };
  touch.onQuit = () => quit();
  touch.onSkip = () => skipWall();

  function attract() { return new Breakout({ players: 0 }); }

  const inGame = () => !g.demo;
  const isAssisted = () => CHEATS.some((c) => opts[c] !== DEFAULT_ASSIST[c]);

  function applyOptions() {
    for (const c of CHEATS) g.assist[c] = opts[c];
    g.setPaddle(g.paddleX); // a new paddle size
  }
  applyOptions();

  function setOption(name, v) {
    opts[name] = v;
    store.set(name, typeof v === 'boolean' ? (v ? 1 : 0) : v);
    touch.setOptions(opts);
    if (inGame()) assisted ||= isAssisted();
    applyOptions();
  }

  function cycle(name, list) {
    setOption(name, list[(list.indexOf(opts[name]) + 1) % list.length]);
  }

  function skipWall() {
    if (!inGame() || g.mode === 'over') return;
    assisted = true;
    g.skipWall();
  }

  function start(players) {
    if (inGame()) return;
    g = new Breakout({ players, balls: opts.balls });
    assisted = isAssisted();
    applyOptions();
    touch.release();
    sound.unlock();
  }

  function gameOver() {
    const best = Math.max(...g.players.map((p) => p.score));
    if (!assisted && best > highScore) { highScore = best; store.set('highscore', highScore); }
  }

  function quit() {
    if (inGame()) gameOver();
    g = attract();
    applyOptions();
    paused = false;
  }

  window.__bo = { get g() { return g; }, sound, touch }; // debug handle

  // ---- input ----
  const input = { left: false, right: false, serve: false };
  function readInput() {
    for (const k in input) input[k] = false;
    keyboard.read(input);
    gamepad.read(input);
    const t = touch.take();
    if (t.left) input.left = true;
    if (t.right) input.right = true;
    if (t.serve) input.serve = true;
    if (!g.demo && !paused) {
      if (t.absX !== null) g.setPaddle(t.absX);
      if (t.relDX) g.setPaddle(g.paddleX + t.relDX);
    }
    return (input.right ? 1 : 0) - (input.left ? 1 : 0);
  }

  // ---- messages over the picture ----
  function messages(s) {
    if (g.demo) {
      if (highScore) s.centred(178, `HIGH SCORE ${highScore}`);
      s.centred(150, 'BREAKOUT', 2);
      if (frameNo & 32) s.centred(204, touch.active ? (opts.players === 2 ? 'TAP FOR 2 PLAYERS' : 'TAP TO START') : 'PRESS SPACE TO START');
      return;
    }
    // the cheats in force, under the scores
    const tags = [];
    const sp = SPEEDS.indexOf(opts.speed);
    if (sp > 0) tags.push(['', 'SLOW', 'V.SLOW', 'S.SLOW'][sp]);
    if (opts.paddleScale > 1) tags.push(`PADx${opts.paddleScale}`);
    if (opts.noSpeedUp) tags.push('STEADY');
    if (opts.noShrink) tags.push('NOSHRINK');
    if (opts.unlimited) tags.push('INF');
    if (opts.net) tags.push('NET');
    if (opts.endless) tags.push('ENDLESS');
    if (tags.length) s.centred(38, tags.join(' '));
    if (g.mode === 'serve') {
      if (g.players.length === 2) s.centred(170, `PLAYER ${g.cur + 1}`);
      if (!g.autoServe && frameNo & 32) s.centred(190, touch.active ? 'TOUCH TO SERVE' : 'PRESS SPACE TO SERVE');
    }
    if (g.mode === 'over') s.centred(180, 'GAME OVER', 2);
  }

  // ---- layout ----
  function fit() {
    const stage = document.getElementById('stage');
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const portrait = vh > vw;
    const reserved = touch.reserved;
    const availH = portrait && reserved ? Math.max(vh * 0.6, vh - reserved) : vh;
    const scale = Math.min(vw / SCREEN_W, availH / SCREEN_H);
    const s = scale >= 1 ? Math.floor(scale * 4) / 4 : scale;
    canvas.style.width = `${Math.round(SCREEN_W * s)}px`;
    canvas.style.height = `${Math.round(SCREEN_H * s)}px`;
    stage.classList.toggle('top', portrait && reserved > 0);
  }
  window.addEventListener('resize', fit);
  touch.onLayout = fit;
  fit();

  function frame(now) {
    const dt = Math.min(MAX_CATCHUP, (now - last) / 1000);
    last = now;
    const move = readInput();

    if (keyboard.consume('KeyF')) toggleFullscreen();
    if (keyboard.consume('KeyM')) sound.setMuted(!sound.muted);
    if (keyboard.consume('KeyC')) cycle('speed', SPEEDS);
    if (keyboard.consume('KeyB')) cycle('paddleScale', PADDLES);
    if (keyboard.consume('KeyU')) setOption('noSpeedUp', !opts.noSpeedUp);
    if (keyboard.consume('KeyH')) setOption('noShrink', !opts.noShrink);
    if (keyboard.consume('KeyL')) setOption('unlimited', !opts.unlimited);
    if (keyboard.consume('KeyN')) setOption('net', !opts.net);
    if (keyboard.consume('KeyE')) setOption('endless', !opts.endless);
    if (keyboard.consume('KeyK')) skipWall();
    if (keyboard.consume('Escape')) quit();
    if (keyboard.consume('KeyP') && inGame()) paused = !paused;
    const start1 = keyboard.consume('Space', 'Enter', 'Digit1');
    const start2 = keyboard.consume('Digit2');
    const tap = touch.consumeStart() || gamepad.startPressed;
    if (!inGame() && !settingsOpen) {
      if (start2) start(2);
      else if (tap) start(opts.players);
      else if (start1) start(1);
    } else if (input.serve && !paused) g.serve();

    if (inGame() && g.over) quit();
    g.autoServe = touch.settings.autoServe ? 90 : 0;
    touch.setPlayState(inGame(), paused);
    if (!paused && !settingsOpen) {
      acc += dt;
      const events = [];
      while (acc >= STEP) { g.step(move); events.push(...g.events); acc -= STEP; frameNo++; }
      sound.play(g.demo ? [] : events);
    }
    image.data.set(screen.draw(g, { text: messages }));
    ctx.putImageData(image, 0, 0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // audio can only start from a user gesture on iOS (touchend and click are the
  // ones a home-screen app reliably counts)
  for (const ev of ['keydown', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) window.addEventListener(ev, () => sound.unlock(), { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && inGame()) paused = true;
    if (!document.hidden) sound.unlock();
  });
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) el.requestFullscreen?.();
  else document.exitFullscreen?.();
}

try { main(); } catch (err) {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f55;padding:1em">${err.stack || err}</pre>`);
}
