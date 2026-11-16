// The garden's pests. Three kinds, three behaviours:
//  - Nibbler: slow, wanders at random, the first thing a new player meets.
//  - Snapper: quicker, turns toward the player whenever it can.
//  - Rootwisp: slow and pale, drifts straight through soft hedges (never stone).
// They walk the maze tile by tile and choose a new direction at each tile
// centre, so they never cut a corner a player could not.

import { COLS, ROWS, TILE, MAZE_X, MAZE_Y } from './config.js';
import { emptyCells, isOpen, isSoft, isSolid } from './maze.js';

export const ENEMY_NIBBLER = 'nibbler';
export const ENEMY_SNAPPER = 'snapper';
export const ENEMY_WISP = 'wisp';

export const ENEMY_STATS = {
  [ENEMY_NIBBLER]: { speed: 58, score: 100, size: 38, color: '#ff8c42' },
  [ENEMY_SNAPPER]: { speed: 98, score: 150, size: 40, color: '#ef476f' },
  [ENEMY_WISP]: { speed: 48, score: 200, size: 36, color: '#e0aaff' },
};

export function cellCenter(c, r) {
  return { x: MAZE_X + (c + 0.5) * TILE, y: MAZE_Y + (r + 0.5) * TILE };
}

export function pixelToCell(x, y) {
  return { c: Math.floor((x - MAZE_X) / TILE), r: Math.floor((y - MAZE_Y) / TILE) };
}

export function createEnemy(type, c, r, speedScale) {
  const stats = ENEMY_STATS[type];
  const at = cellCenter(c, r);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const dir = dirs[Math.floor(Math.random() * dirs.length)];
  return {
    type, x: at.x, y: at.y, dir, speed: stats.speed * speedScale,
    size: stats.size, alive: true, wobble: Math.random() * Math.PI * 2,
    stuck: 0,
  };
}

/** Scatter a level's pests on open cells well away from the player's spawn. */
export function spawnEnemies(random, grid, levelDef) {
  const enemies = [];
  const open = emptyCells(grid).filter(
    (cell) => Math.abs(cell.c - 1) + Math.abs(cell.r - 1) > 4,
  );
  const want = [];
  for (let i = 0; i < levelDef.nibblers; i += 1) want.push(ENEMY_NIBBLER);
  for (let i = 0; i < levelDef.snappers; i += 1) want.push(ENEMY_SNAPPER);
  for (let i = 0; i < levelDef.wisps; i += 1) want.push(ENEMY_WISP);
  for (const type of want) {
    if (open.length === 0) break;
    const index = Math.floor(random() * open.length);
    const cell = open.splice(index, 1)[0];
    enemies.push(createEnemy(type, cell.c, cell.r, levelDef.enemySpeed));
  }
  return enemies;
}

function canEnter(enemy, grid, c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
  if (enemy.type === ENEMY_WISP) return !isSolid(grid, c, r) || isSoft(grid, c, r);
  return isOpen(grid, c, r);
}

function openDirections(enemy, grid, cell) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return dirs.filter(([dc, dr]) => canEnter(enemy, grid, cell.c + dc, cell.r + dr));
}

function chooseDirection(enemy, grid, cell, playerCell, random) {
  const options = openDirections(enemy, grid, cell);
  if (options.length === 0) return [0, 0];
  // Never turn straight back unless it is the only way out.
  const forward = options.filter(([dc, dr]) => !(dc === -enemy.dir[0] && dr === -enemy.dir[1]));
  const pool = forward.length > 0 ? forward : options;
  if (enemy.type === ENEMY_SNAPPER && random() < 0.75) {
    let best = pool[0];
    let bestDist = Infinity;
    for (const [dc, dr] of pool) {
      const dist = Math.abs(cell.c + dc - playerCell.c) + Math.abs(cell.r + dr - playerCell.r);
      if (dist < bestDist) {
        bestDist = dist;
        best = [dc, dr];
      }
    }
    return best;
  }
  if (enemy.type === ENEMY_WISP && random() < 0.4) {
    // Wisps drift toward the player through the hedges, slowly.
    let best = pool[0];
    let bestDist = Infinity;
    for (const [dc, dr] of pool) {
      const dist = Math.abs(cell.c + dc - playerCell.c) + Math.abs(cell.r + dr - playerCell.r);
      if (dist < bestDist) {
        bestDist = dist;
        best = [dc, dr];
      }
    }
    return best;
  }
  return random.pick(pool);
}

/**
 * Walk every living pest one step. They pick a direction at tile centres and
 * glide between them; a pest that cannot move waits and tries again.
 */
export function updateEnemies(enemies, dt, grid, playerCell, random) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.wobble += dt * 6;
    const cell = pixelToCell(enemy.x, enemy.y);
    const centre = cellCenter(cell.c, cell.r);
    const atCentre = Math.abs(enemy.x - centre.x) < 2 && Math.abs(enemy.y - centre.y) < 2;
    if (atCentre) {
      enemy.x = centre.x;
      enemy.y = centre.y;
      enemy.dir = chooseDirection(enemy, grid, cell, playerCell, random);
      if (enemy.dir[0] === 0 && enemy.dir[1] === 0) enemy.stuck += dt;
      else enemy.stuck = 0;
    }
    const step = enemy.speed * dt;
    const nx = enemy.x + enemy.dir[0] * step;
    const ny = enemy.y + enemy.dir[1] * step;
    // Stop at the next tile centre rather than sliding past it.
    const nextCentre = cellCenter(cell.c + enemy.dir[0], cell.r + enemy.dir[1]);
    if (enemy.dir[0] > 0) enemy.x = Math.min(nx, nextCentre.x);
    else if (enemy.dir[0] < 0) enemy.x = Math.max(nx, nextCentre.x);
    else if (enemy.dir[1] > 0) enemy.y = Math.min(ny, nextCentre.y);
    else if (enemy.dir[1] < 0) enemy.y = Math.max(ny, nextCentre.y);
    else {
      enemy.x = nx;
      enemy.y = ny;
    }
    // If the way ahead closed (a hedge grew back is impossible; a wall was
    // never open), snap back to the centre and re-choose next step.
    const ahead = pixelToCell(enemy.x + enemy.dir[0] * 4, enemy.y + enemy.dir[1] * 4);
    if ((enemy.dir[0] !== 0 || enemy.dir[1] !== 0) && !canEnter(enemy, grid, ahead.c, ahead.r)) {
      const here = pixelToCell(enemy.x, enemy.y);
      const hereCentre = cellCenter(here.c, here.r);
      enemy.x = hereCentre.x;
      enemy.y = hereCentre.y;
      enemy.dir = [0, 0];
    }
  }
}

export function livingEnemies(enemies) {
  return enemies.filter((e) => e.alive);
}
