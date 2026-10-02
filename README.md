# Breakout

A browser reimplementation of Atari's 1976 arcade game, built to run
fullscreen on an iPad as a home-screen app. Plain HTML/JS, no build step.

The original has no CPU and no program: it is about 44 TTL logic chips
driving a black-and-white monitor on its side, with strips of coloured film
over the glass. So unlike Space Invaders there is no code to trace; this
follows the cabinet's documented rules instead:

- 8 rows of 14 bricks; from the bottom, two rows each of yellow (1 point),
  green (3), orange (5) and red (7)
- the ball speeds up after 4 hits, after 12 hits, and the first time it
  reaches the orange rows and the red rows
- the paddle is split into 8 segments, and where the ball lands sets its angle
- the paddle shrinks to half when the ball breaks through to the top wall
- a game is two walls of bricks (896 is a perfect game; after that the field
  stays empty until the balls run out, as on the cabinet)
- 3 balls a game (5 as an operator option); two players take turns, each with
  their own wall
- the picture is white, coloured only by the film, so the ball changes colour
  as it passes through the bands, as on the real thing

Exact pixel geometry, speeds and the sound tones are close stand-ins, not
measurements of the hardware. The title screen is an attract mode with the
computer playing.

## Play

Open the site, then on iPad: Share → **Add to Home Screen**. Tap to start.

Touch, three ways to move the paddle (settings, the cog):

- **Follow my finger** (default): the paddle sits under your finger, left to
  right. The cabinet's paddle was a knob that put the paddle wherever you
  turned it, so this is the closest match. In portrait there's a strip under
  the picture to slide along, so your finger doesn't hide the ball.
- **Slide anywhere**: like a trackpad; the paddle moves as far as your finger
  does (times the slide speed), wherever you put it down.
- **Left/right buttons**: hold the left or right half of the screen; the
  paddle speeds up the longer you hold.

The ball serves itself after a moment; turn that off and a touch (or Space)
serves, like the cabinet's Serve button. The pause button beside the cog has
Resume / Restart game / Quit to title.

Keyboard: arrows / A D to move, Space to serve; Space / Enter / 1 starts a
one-player game, 2 a two-player game; P pause, M mute, F fullscreen, Esc back
to the title. Gamepad: d-pad or stick, any face button serves, Start starts.
With a mouse, the paddle follows the pointer.

Cheats, in the settings or from the keyboard. Only games with no cheats set
the high score:

- Ball speed (C): Normal, Slow (80%), Very slow (60%), Super slow (45%)
- Paddle size (B): Normal, Wide, Extra wide, Huge
- Ball never speeds up (U)
- Paddle never shrinks (H)
- Unlimited balls (L)
- Safety net (N): the ball bounces off the bottom
- Endless walls (E): a new wall every time, not just two
- Skip this wall (K)

## Develop

```
npm run dev     # http://localhost:8080/
npm test
```

`node tools/icons.mjs` redraws the home-screen icons;
`node tools/shot.mjs out.png [frames] [play|demo|2p]` renders a frame to PNG.
Bump `VERSION` in `sw.js` when anything changes so installed copies update.
