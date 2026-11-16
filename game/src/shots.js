// The screenshot scenes behind ?shot=start|play|clear|over|win. Each one sets
// the real world to a fixed, readable moment — a fresh title, a mid-burst
// fight on level 2, a level clear, a game over and the win screen — and the
// page paints it twice, then sets window.__shotReady for the screenshot.

import { STEP } from './config.js';
import { cellCenter } from './enemies.js';
import { plantBomb } from './bombs.js';
import { createPowerup, POWER_RANGE } from './powerups.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Set `world` to the named scene and return the screen to draw and the best score to show. */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    world.startGame();
    world.resetLevel(1);
    state.score = 1250;
    state.timeLeft = 132;
    // Pip, mid-maze, facing the burst.
    const at = cellCenter(3, 3);
    state.player.x = at.x;
    state.player.y = at.y;
    state.player.faceX = 1;
    state.player.faceY = 0;
    state.player.bombsMax = 2;
    state.player.range = 3;
    // A seed mid-burst, frozen in the frame, and one still ticking.
    world.forceBurstAt(6, 5);
    const ticking = plantBomb(state.bombs, 9, 5, state.player.range);
    if (ticking !== null) ticking.fuse = 1.2;
    // A treat on open ground, and three pests placed for the camera.
    state.powerups.push(createPowerup(POWER_RANGE, 12, 5));
    const spots = [{ c: 8, r: 3 }, { c: 10, r: 7 }, { c: 5, r: 7 }];
    state.enemies.forEach((enemy, i) => {
      if (i < spots.length) {
        const spot = cellCenter(spots[i].c, spots[i].r);
        enemy.x = spot.x;
        enemy.y = spot.y;
        enemy.alive = true;
      }
    });
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'clear') {
    world.startGame();
    world.resetLevel(1);
    state.score = 2480;
    state.stats.levelBonus = 640;
    state.stats.wallsBroken = 23;
    state.stats.enemiesDown = 5;
    for (const enemy of state.enemies) enemy.alive = false;
    state.gate.active = true;
    state.screen = SCREEN_CLEAR;
    return { screen: SCREEN_CLEAR, best: 2480 };
  }
  if (name === 'over') {
    world.startGame();
    world.resetLevel(2);
    state.score = 2450;
    state.player.lives = 0;
    state.timeLeft = 41;
    const at = cellCenter(3, 3);
    state.player.x = at.x;
    state.player.y = at.y;
    const spots = [{ c: 5, r: 3 }, { c: 7, r: 5 }];
    state.enemies.forEach((enemy, i) => {
      if (i < spots.length) {
        const spot = cellCenter(spots[i].c, spots[i].r);
        enemy.x = spot.x;
        enemy.y = spot.y;
        enemy.alive = true;
      }
    });
    state.screen = SCREEN_OVER;
    return { screen: SCREEN_OVER, best: 3120 };
  }
  if (name === 'win') {
    world.startGame();
    world.resetLevel(4);
    state.score = 6850;
    state.stats.wallsBroken = 87;
    state.stats.enemiesDown = 41;
    state.stats.levelBonus = 1240;
    state.timeLeft = 64;
    for (const enemy of state.enemies) enemy.alive = false;
    state.screen = SCREEN_WIN;
    return { screen: SCREEN_WIN, best: 6850 };
  }
  // start (and any unknown name): the title over a living maze.
  world.toTitle();
  for (let i = 0; i < (5 / STEP); i += 1) world.step(STEP, { x: 0, y: 0 });
  return { screen: SCREEN_TITLE, best: 0 };
}
