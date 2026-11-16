// The maze: a grid of hard stone (never breaks), soft hedge (a blast shatters
// it) and open path. Generation keeps the spawn corner clear and guarantees
// enough open ground that every level is winnable; some hedges hide power-ups.

import { COLS, ROWS } from './config.js';

export const TILE_EMPTY = 0;
export const TILE_HARD = 1;
export const TILE_SOFT = 2;

export const SPAWN_CELL = { c: 1, r: 1 };

export function cellKey(c, r) {
  return `${c},${r}`;
}

export function inBounds(c, r) {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

export function cellAt(grid, c, r) {
  return inBounds(c, r) ? grid[r][c] : TILE_HARD;
}

export function isHard(grid, c, r) {
  return cellAt(grid, c, r) === TILE_HARD;
}

export function isSoft(grid, c, r) {
  return cellAt(grid, c, r) === TILE_SOFT;
}

/** A tile anything walks through: empty only. Blasts and wisps have their own rules. */
export function isOpen(grid, c, r) {
  return cellAt(grid, c, r) === TILE_EMPTY;
}

export function isSolid(grid, c, r) {
  return cellAt(grid, c, r) !== TILE_EMPTY;
}

export function emptyCells(grid) {
  const cells = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (grid[r][c] === TILE_EMPTY) cells.push({ c, r });
    }
  }
  return cells;
}

function clearAround(grid, c, r) {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (inBounds(c + dc, r + dr)) grid[r + dr][c + dc] = TILE_EMPTY;
    }
  }
}

/**
 * Build one level's maze. `hidden` is a Map from cellKey to the power-up type
 * a hedge hides; `guaranteed` types are planted under random hedges so every
 * level holds at least one extra seed and one longer vine.
 */
export function createMaze(random, levelDef, guaranteed) {
  const grid = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = [];
    for (let c = 0; c < COLS; c += 1) {
      if (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1) row.push(TILE_HARD);
      else if (c % 2 === 0 && r % 2 === 0) row.push(TILE_HARD);
      else row.push(random() < levelDef.softDensity ? TILE_SOFT : TILE_EMPTY);
    }
    grid.push(row);
  }
  clearAround(grid, SPAWN_CELL.c, SPAWN_CELL.r);

  const hidden = new Map();
  const hedges = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (grid[r][c] === TILE_SOFT) hedges.push({ c, r });
    }
  }
  // Shuffle the hedges, then hide the guaranteed power-ups under the first few.
  for (let i = hedges.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [hedges[i], hedges[j]] = [hedges[j], hedges[i]];
  }
  for (let i = 0; i < guaranteed.length && i < hedges.length; i += 1) {
    hidden.set(cellKey(hedges[i].c, hedges[i].r), guaranteed[i]);
  }
  return { grid, hidden };
}

/**
 * Shatter a hedge. Returns the power-up type it was hiding, or null.
 * Only soft tiles break; stone and empty tiles answer null.
 */
export function destroySoft(maze, c, r) {
  if (!isSoft(maze.grid, c, r)) return null;
  maze.grid[r][c] = TILE_EMPTY;
  const key = cellKey(c, r);
  const type = maze.hidden.get(key) ?? null;
  if (type !== null) maze.hidden.delete(key);
  return type;
}

/** The empty cell farthest (in grid steps) from `from`: where the gate opens. */
export function farthestEmptyCell(grid, from) {
  let best = null;
  let bestDist = -1;
  for (const cell of emptyCells(grid)) {
    const dist = Math.abs(cell.c - from.c) + Math.abs(cell.r - from.r);
    if (dist > bestDist) {
      bestDist = dist;
      best = cell;
    }
  }
  return best ?? { c: COLS - 2, r: ROWS - 2 };
}
