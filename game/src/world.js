// The game's rules and state, with no drawing and no browser in it: the
// player, the maze, the seeds, the pests, the gate and the score. step()
// advances one fixed step and returns what happened as bit flags, so the
// caller can play the right sound without the world knowing about screens.

import { BOMB, COLS, ENDLESS, LEVELS, LIVES, MAZE_X, MAZE_Y, PLAYER, ROWS, SCORE, STEP, TILE } from './config.js';
import { createMaze, destroySoft, farthestEmptyCell, isSolid, SPAWN_CELL, TILE_EMPTY, TILE_SOFT } from './maze.js';
import { blastCovers, clearBombs, createBombs, plantBomb, triggerBomb, updateBombs } from './bombs.js';
import { livingEnemies, pixelToCell, spawnEnemies, updateEnemies } from './enemies.js';
import { applyPowerup, createPowerup, POWER_BOMB, POWER_RANGE, rollHiddenPowerup } from './powerups.js';
import { addShake, burst, clearEffects, createEffects, petalBurst, popup, updateEffects } from './particles.js';
import { cellCenter } from './enemies.js';

export const EVENT_NONE = 0;
export const EVENT_PLANT = 1;
export const EVENT_EXPLOSION = 2;
export const EVENT_WALL = 4;
export const EVENT_ENEMY_DOWN = 8;
export const EVENT_PICKUP = 16;
export const EVENT_HURT = 32;
export const EVENT_SHIELD = 64;
export const EVENT_GATE = 128;
export const EVENT_LEVEL_CLEAR = 256;
export const EVENT_GAME_OVER = 512;
export const EVENT_WIN = 1024;
export const EVENT_TIMEOUT = 2048;

export function levelDefFor(index) {
  if (index < LEVELS.length) return { ...LEVELS[index] };
  const extra = index - LEVELS.length;
  return {
    name: `Endless ${extra + 1}`,
    softDensity: Math.min(0.82, ENDLESS.softDensity + extra * 0.01),
    nibblers: Math.min(9, ENDLESS.nibblers + extra),
    snappers: Math.min(8, ENDLESS.snappers + extra),
    wisps: Math.min(6, ENDLESS.wisps + extra),
    timeLimit: ENDLESS.timeLimit,
    enemySpeed: ENDLESS.enemySpeed + extra * 0.05,
  };
}

function spawnPoint() {
  const at = cellCenter(SPAWN_CELL.c, SPAWN_CELL.r);
  return { x: at.x, y: at.y };
}

export function createWorld(random) {
  const state = {
    screen: 'title',
    levelIndex: 0,
    levelName: LEVELS[0].name,
    endless: false,
    score: 0,
    timeLeft: LEVELS[0].timeLimit,
    maze: null,
    gate: null,
    player: null,
    enemies: [],
    bombs: createBombs(),
    powerups: [],
    effects: createEffects(),
    message: '',
    messageTimer: 0,
    stats: { wallsBroken: 0, enemiesDown: 0, levelBonus: 0 },
  };

  function freshPlayer(prev) {
    const at = spawnPoint();
    return {
      x: at.x, y: at.y, size: PLAYER.size,
      speed: prev ? prev.speed : PLAYER.speed,
      bombsMax: prev ? prev.bombsMax : BOMB.startCount,
      range: prev ? prev.range : BOMB.startRange,
      shield: prev ? prev.shield : false,
      lives: prev ? prev.lives : LIVES,
      invulnerable: PLAYER.respawnInvulnerable,
      faceX: 0, faceY: 1, moving: false,
    };
  }

  function resetLevel(index) {
    const def = levelDefFor(index);
    const prev = state.player;
    state.levelIndex = index;
    state.levelName = def.name;
    state.timeLeft = def.timeLimit;
    state.maze = createMaze(random, def, [POWER_BOMB, POWER_RANGE]);
    state.gate = { c: COLS - 2, r: ROWS - 2, active: false };
    // Power-ups, seeds and lives carry across levels; only the maze regrows.
    state.player = freshPlayer(prev);
    state.enemies = spawnEnemies(random, state.maze.grid, def);
    state.powerups = [];
    clearBombs(state.bombs);
    clearEffects(state.effects);
    state.message = '';
    state.messageTimer = 0;
  }

  function showMessage(text, seconds = 2.2) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function respawnPlayer() {
    const at = spawnPoint();
    state.player.x = at.x;
    state.player.y = at.y;
    state.player.invulnerable = PLAYER.respawnInvulnerable;
  }

  function gameOver() {
    state.screen = 'over';
    return EVENT_GAME_OVER;
  }

  /** Lose one life to a blast, a pest or the clock. Returns the event. */
  function loseLife(cause) {
    const p = state.player;
    if (p.shield) {
      p.shield = false;
      p.invulnerable = PLAYER.invulnerableAfterHit;
      showMessage('Thorn Shield saved you!');
      burst(state.effects, p.x, p.y, '#b388ff', 18, 160);
      return EVENT_SHIELD;
    }
    p.lives -= 1;
    burst(state.effects, p.x, p.y, '#ef476f', 22, 200);
    addShake(state.effects, 8);
    if (p.lives <= 0) return gameOver();
    respawnPlayer();
    showMessage(cause === 'time' ? 'Out of time! One life lost.' : 'Ouch! One life lost.');
    return EVENT_HURT;
  }

  function collides(x, y) {
    const half = 16;
    const corners = [
      [x - half, y - half], [x + half, y - half],
      [x - half, y + half], [x + half, y + half],
    ];
    for (const [cx, cy] of corners) {
      const cell = pixelToCell(cx, cy);
      if (isSolid(state.maze.grid, cell.c, cell.r)) return true;
    }
    return false;
  }

  function movePlayer(dt, dir) {
    const p = state.player;
    const len = Math.hypot(dir.x, dir.y);
    p.moving = len > 0;
    if (len === 0) return;
    const nx = dir.x / len;
    const ny = dir.y / len;
    p.faceX = nx;
    p.faceY = ny;
    const step = p.speed * dt;
    if (!collides(p.x + nx * step, p.y)) p.x += nx * step;
    if (!collides(p.x, p.y + ny * step)) p.y += ny * step;
    // Keep the sprite inside the maze bounds.
    p.x = Math.max(MAZE_X + 20, Math.min(MAZE_X + COLS * TILE - 20, p.x));
    p.y = Math.max(MAZE_Y + 20, Math.min(MAZE_Y + ROWS * TILE - 20, p.y));
  }

  function plantSeed() {
    const p = state.player;
    if (state.bombs.planted.length >= p.bombsMax) {
      showMessage('No seeds ready — wait for one to burst!', 1.2);
      return EVENT_NONE;
    }
    const cell = pixelToCell(p.x, p.y);
    if (state.maze.grid[cell.r] === undefined || state.maze.grid[cell.r][cell.c] !== TILE_EMPTY) return EVENT_NONE;
    const bomb = plantBomb(state.bombs, cell.c, cell.r, p.range);
    if (bomb === null) return EVENT_NONE;
    return EVENT_PLANT;
  }

  /** A burst's hedge-breaking, with the hidden-treat roll, done in one pass. */
  function applyBurst(burstInfo) {
    let events = EVENT_EXPLOSION;
    for (const cell of burstInfo.cells) {
      const wasSoft = state.maze.grid[cell.r][cell.c] === TILE_SOFT;
      const hidden = destroySoft(state.maze, cell.c, cell.r);
      if (wasSoft) {
        state.score += SCORE.wall;
        state.stats.wallsBroken += 1;
        events |= EVENT_WALL;
        const type = hidden ?? (random() < 0.3 ? rollHiddenPowerup(random) : null);
        if (type !== null) state.powerups.push(createPowerup(type, cell.c, cell.r));
        const at = cellCenter(cell.c, cell.r);
        burst(state.effects, at.x, at.y, '#57a75a', 8, 120, 0.5, 4);
        popup(state.effects, `+${SCORE.wall}`, at.x, at.y - 10, '#a8c3a5');
      }
      triggerBomb(state.bombs, cell.c, cell.r);
    }
    const centre = cellCenter(burstInfo.center.c, burstInfo.center.r);
    burst(state.effects, centre.x, centre.y, '#ffb703', 20, 260, 0.5, 6);
    burst(state.effects, centre.x, centre.y, '#fb8500', 12, 180, 0.4, 5);
    addShake(state.effects, 7);
    return events;
  }

  function checkBlastHits() {
    let events = EVENT_NONE;
    const p = state.player;
    const pCell = pixelToCell(p.x, p.y);
    if (p.invulnerable <= 0 && blastCovers(state.bombs, pCell.c, pCell.r)) {
      events |= loseLife('blast');
    }
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const cell = pixelToCell(enemy.x, enemy.y);
      if (blastCovers(state.bombs, cell.c, cell.r)) {
        enemy.alive = false;
        const stats = { nibbler: SCORE.nibbler, snapper: SCORE.snapper, wisp: SCORE.wisp };
        const points = stats[enemy.type] ?? SCORE.nibbler;
        state.score += points;
        state.stats.enemiesDown += 1;
        events |= EVENT_ENEMY_DOWN;
        burst(state.effects, enemy.x, enemy.y, '#ffd166', 16, 200);
        petalBurst(state.effects, enemy.x, enemy.y, 8);
        popup(state.effects, `+${points}`, enemy.x, enemy.y - 14);
      }
    }
    return events;
  }

  function checkTouches() {
    let events = EVENT_NONE;
    const p = state.player;
    // Pests: a touch hurts, unless the player is briefly untouchable.
    if (p.invulnerable <= 0) {
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        if (Math.abs(enemy.x - p.x) < 30 && Math.abs(enemy.y - p.y) < 30) {
          events |= loseLife('touch');
          break;
        }
      }
    }
    // Treats: walk over one to take it.
    for (const powerup of state.powerups) {
      if (powerup.taken) continue;
      if (Math.abs(powerup.x - p.x) < 28 && Math.abs(powerup.y - p.y) < 28) {
        powerup.taken = true;
        const line = applyPowerup(p, powerup.type);
        state.score += SCORE.powerup;
        events |= EVENT_PICKUP;
        showMessage(line);
        burst(state.effects, powerup.x, powerup.y, '#ffd166', 14, 150);
        popup(state.effects, `+${SCORE.powerup}`, powerup.x, powerup.y - 16);
      }
    }
    state.powerups = state.powerups.filter((powerup) => !powerup.taken);
    // The gate: step on it once it has opened.
    if (state.gate.active) {
      const pCell = pixelToCell(p.x, p.y);
      if (pCell.c === state.gate.c && pCell.r === state.gate.r) {
        const bonus = SCORE.levelClear + Math.floor(state.timeLeft) * SCORE.timeBonusPerSecond;
        state.score += bonus;
        state.stats.levelBonus = bonus;
        state.screen = 'clear';
        petalBurst(state.effects, p.x, p.y, 26);
        return events | EVENT_LEVEL_CLEAR;
      }
    }
    return events;
  }

  function openGateIfCleared() {
    if (state.gate.active) return EVENT_NONE;
    if (livingEnemies(state.enemies).length > 0) return EVENT_NONE;
    const pCell = pixelToCell(state.player.x, state.player.y);
    const cell = farthestEmptyCell(state.maze.grid, pCell);
    state.gate = { c: cell.c, r: cell.r, active: true };
    showMessage('The flower gate opened — run to it!');
    return EVENT_GATE;
  }

  function stepPlay(dt, dir) {
    let events = EVENT_NONE;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      if (state.player.lives > 1) {
        state.player.lives -= 1;
        resetLevel(state.levelIndex);
        showMessage('Out of time! The maze regrew — one life lost.');
        return EVENT_TIMEOUT | EVENT_HURT;
      }
      state.player.lives = 0;
      return gameOver();
    }
    if (state.player.invulnerable > 0) state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);
    movePlayer(dt, dir);
    const pCell = pixelToCell(state.player.x, state.player.y);
    updateEnemies(state.enemies, dt, state.maze.grid, pCell, random);
    const bursts = updateBombs(state.bombs, dt, state.maze.grid);
    for (const burstInfo of bursts) events |= applyBurst(burstInfo);
    events |= checkBlastHits();
    if (state.screen !== 'play') return events;
    events |= checkTouches();
    if (state.screen !== 'play') return events;
    events |= openGateIfCleared();
    if (state.messageTimer > 0) state.messageTimer = Math.max(0, state.messageTimer - dt);
    updateEffects(state.effects, dt);
    return events;
  }

  function stepTitle(dt) {
    if (state.player.invulnerable > 0) state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);
    const pCell = pixelToCell(state.player.x, state.player.y);
    updateEnemies(state.enemies, dt, state.maze.grid, pCell, random);
    updateEffects(state.effects, dt);
    return EVENT_NONE;
  }

  resetLevel(0);

  return {
    state,
    resetLevel,
    startGame() {
      state.score = 0;
      state.stats = { wallsBroken: 0, enemiesDown: 0, levelBonus: 0 };
      state.endless = false;
      state.player = null; // A new run starts with a fresh sprite, no carry-over.
      resetLevel(0);
      state.screen = 'play';
    },
    toTitle() {
      resetLevel(0);
      state.screen = 'title';
    },
    nextLevel() {
      const next = state.levelIndex + 1;
      if (next >= LEVELS.length && !state.endless) {
        state.screen = 'win';
        return EVENT_WIN;
      }
      resetLevel(next);
      state.screen = 'play';
      return EVENT_NONE;
    },
    continueEndless() {
      state.endless = true;
      resetLevel(LEVELS.length);
      state.screen = 'play';
      return EVENT_NONE;
    },
    plantSeed,
    /** One fixed step. `dir` is the movement direction; returns event flags. */
    step(dt, dir) {
      if (state.screen === 'title') return stepTitle(dt);
      if (state.screen !== 'play') {
        updateEffects(state.effects, dt);
        return EVENT_NONE;
      }
      return stepPlay(dt, dir);
    },
    /** For the screenshot scenes: burst the seed on this cell right now. */
    forceBurstAt(c, r) {
      const bomb = plantBomb(state.bombs, c, r, state.player.range);
      if (bomb === null) return;
      bomb.fuse = 0;
      const bursts = updateBombs(state.bombs, STEP, state.maze.grid);
      for (const burstInfo of bursts) applyBurst(burstInfo);
    },
  };
}
