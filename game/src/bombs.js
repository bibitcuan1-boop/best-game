// Blast-seeds: the bombs. A planted seed ticks down, then bursts in a cross
// (+): the flames run until stone stops them, and a hedge in the way shatters
// and stops them too. A flame that touches another seed sets it off at once,
// so a chain of seeds clears a whole row. No drawing here — only timers,
// cells and the events the world turns into points, rubble and kills.

import { BOMB } from './config.js';
import { cellAt, cellKey, isHard, isSoft, TILE_HARD } from './maze.js';

/** The cells a burst from (c, r) with this range reaches, in firing order. */
export function blastCells(grid, c, r, range) {
  const cells = [{ c, r }];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dc, dr] of dirs) {
    for (let step = 1; step <= range; step += 1) {
      const nc = c + dc * step;
      const nr = r + dr * step;
      const tile = cellAt(grid, nc, nr);
      if (tile === TILE_HARD) break;
      cells.push({ c: nc, r: nr });
      if (tile === TILE_HARD || isSoft(grid, nc, nr)) break;
    }
  }
  return cells;
}

export function createBombs() {
  return { planted: [], blasts: [] };
}

export function bombAt(bombs, c, r) {
  return bombs.planted.find((b) => b.c === c && b.r === r) ?? null;
}

export function blastCovers(bombs, c, r) {
  for (const blast of bombs.blasts) {
    if (blast.cells.has(cellKey(c, r))) return true;
  }
  return false;
}

/**
 * Plant a seed on a cell. Returns the bomb, or null when a seed is already
 * there. The caller checks the player's seed count before calling.
 */
export function plantBomb(bombs, c, r, range) {
  if (bombAt(bombs, c, r) !== null) return null;
  const bomb = { c, r, range, fuse: BOMB.fuse, pulse: 0 };
  bombs.planted.push(bomb);
  return bomb;
}

/** Light a planted seed's fuse now (a flame touched it): it pops almost at once. */
export function triggerBomb(bombs, c, r) {
  const bomb = bombAt(bombs, c, r);
  if (bomb !== null && bomb.fuse > 0.05) bomb.fuse = 0.05;
}

/**
 * Advance all fuses and flames one step. Returns every burst that went off
 * this step, each with its cells and the hedges it shattered, so the world can
 * score them, reveal what they hid, and kill what stood in them.
 */
export function updateBombs(bombs, dt, grid) {
  const bursts = [];
  for (let i = bombs.planted.length - 1; i >= 0; i -= 1) {
    const bomb = bombs.planted[i];
    bomb.fuse -= dt;
    bomb.pulse += dt;
    if (bomb.fuse > 0) continue;
    bombs.planted.splice(i, 1);
    const cells = blastCells(grid, bomb.c, bomb.r, bomb.range);
    const cellSet = new Set(cells.map((cell) => cellKey(cell.c, cell.r)));
    bombs.blasts.push({ cells: cellSet, list: cells, timer: BOMB.blastTime });
    bursts.push({ cells, center: { c: bomb.c, r: bomb.r } });
  }
  for (let i = bombs.blasts.length - 1; i >= 0; i -= 1) {
    bombs.blasts[i].timer -= dt;
    if (bombs.blasts[i].timer <= 0) bombs.blasts.splice(i, 1);
  }
  return bursts;
}

export function clearBombs(bombs) {
  bombs.planted.length = 0;
  bombs.blasts.length = 0;
}

export { isHard };
