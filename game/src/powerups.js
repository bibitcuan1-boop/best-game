// Power-ups: the treats hidden under hedges. Shatter a hedge and one may pop
// out; walk over it to take it. Each one changes how the next minute plays:
// more seeds at once, longer flames, faster feet, one free hit, or a life back.

import { BOMB, PLAYER } from './config.js';
import { cellCenter } from './enemies.js';

export const POWER_BOMB = 'bomb';
export const POWER_RANGE = 'range';
export const POWER_SPEED = 'speed';
export const POWER_SHIELD = 'shield';
export const POWER_HEART = 'heart';

export const POWERUP_INFO = {
  [POWER_BOMB]: { label: 'Extra Seed', detail: '+1 seed at once', color: '#8d5a2b' },
  [POWER_RANGE]: { label: 'Long Vine', detail: 'flames reach +1', color: '#ff8c42' },
  [POWER_SPEED]: { label: 'Swift Boots', detail: 'run faster', color: '#4cc9f0' },
  [POWER_SHIELD]: { label: 'Thorn Shield', detail: 'survive one hit', color: '#b388ff' },
  [POWER_HEART]: { label: 'Bloom Heart', detail: '+1 life', color: '#ff70a6' },
};

/** Weighted roll for a hedge that hides something (about 1 hedge in 3). */
export function rollHiddenPowerup(random) {
  const roll = random();
  if (roll < 0.28) return POWER_BOMB;
  if (roll < 0.52) return POWER_RANGE;
  if (roll < 0.72) return POWER_SPEED;
  if (roll < 0.88) return POWER_SHIELD;
  return POWER_HEART;
}

export function createPowerup(type, c, r) {
  const at = cellCenter(c, r);
  return { type, c, r, x: at.x, y: at.y, bob: Math.random() * Math.PI * 2, taken: false };
}

/**
 * Give the player a power-up's effect. Returns the short line the HUD shows
 * for a moment ("Long Vine! Flames reach +1").
 */
export function applyPowerup(player, type) {
  const info = POWERUP_INFO[type];
  if (type === POWER_BOMB) {
    player.bombsMax = Math.min(BOMB.maxCount, player.bombsMax + 1);
  } else if (type === POWER_RANGE) {
    player.range = Math.min(BOMB.maxRange, player.range + 1);
  } else if (type === POWER_SPEED) {
    player.speed = Math.min(PLAYER.maxSpeed, player.speed + PLAYER.speedPerBoot);
  } else if (type === POWER_SHIELD) {
    player.shield = true;
  } else if (type === POWER_HEART) {
    player.lives = Math.min(5, player.lives + 1);
  }
  return `${info.label}! ${info.detail}`;
}
