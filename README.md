[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/bibitcuan1-boop/best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/bibitcuan1-boop/best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# BLASTBLOOM

A garden maze game for the [make.fun](https://make.fun/bounty/best-game-01)
bounty **"Make the best game"**
([best-game-01](https://make.fun/bounty/best-game-01)).

You are Pip, a little garden sprite. The maze is overgrown with hedges and
crawling with pests. Plant blast-seeds: they burst in a cross, shatter hedges,
and clear a path — but the flames bite you too, so plant, run, and hide.
Shattered hedges sometimes hide treats: extra seeds, longer flames, swift
boots, a thorn shield, or a bloom heart. Beat every pest on the level and the
flower gate opens; step through it to the next garden. Clear all five
gardens and the garden blooms — then keep going in endless mode and see how
far it grows.

## How to play

- **WASD / arrow keys** — run through the maze
- **SPACE** — plant a blast-seed (it bursts after ~2 seconds, in a cross)
- **P / Esc** — pause · **M** — mute · **Enter / click** — menus and buttons

Seeds burst in a cross until stone stops them; a hedge in the way shatters
and stops them too. A flame that touches another seed sets it off at once,
so chains clear whole rows. You have 3 lives; a blast or a pest's touch costs
one (a thorn shield absorbs one hit). Each level has a timer — run out and
the maze regrows, costing a life.

## Layout

- `game/index.html` — the page; everything else is a file under `game/`
- `game/src/config.js` — every tuning number, colour and level definition
- `game/src/random.js` — the seeded RNG that makes mazes repeatable
- `game/src/maze.js` — maze generation, hard stone, breakable hedges, the gate
- `game/src/bombs.js` — blast-seeds: fuses, cross bursts, chain reactions
- `game/src/enemies.js` — the three pests: wandering Nibbler, chasing Snapper, hedge-phasing Rootwisp
- `game/src/powerups.js` — the treats hidden under hedges and what each does
- `game/src/particles.js` — bursts, petals, floating scores, screen shake
- `game/src/audio.js` — procedural WebAudio effects and the music loop
- `game/src/input.js` — keyboard and pointer input, held keys and one-shot actions
- `game/src/render.js` — all drawing: maze, sprites, HUD, menus (no image files)
- `game/src/world.js` — the rules: movement, scoring, lives, timer, levels, the gate
- `game/src/shots.js` — deterministic scenes for `?shot=start|play|clear|over|win`
- `game/src/main.js` — boot, the fixed-step loop, screens, sounds, best score
- `main.ts` — hands the game in: copies `game/` + `screenshots/`, writes `dossier.json`
- `serve.ts` — `node serve.ts` serves `game/` on http://localhost:8080

No libraries, no build step, no network: every sprite and sound is drawn or
synthesised in code. Play it with `node serve.ts` and open
http://localhost:8080 in a desktop browser.
