// BLASTBLOOM — every tuning number and colour in one place.
// A garden sprite plants blast-seeds in a living maze: the seeds burst in a
// cross, shatter hedge walls, and clear a path to the flower gate.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The maze grid: 17 columns by 11 rows of 56 px tiles, centred under the HUD. */
export const TILE = 56;
export const COLS = 17;
export const ROWS = 11;
export const MAZE_X = 164;
export const MAZE_Y = 84;

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'blastbloom.best';

export const PLAYER = {
  size: 36,
  speed: 195,
  speedPerBoot: 22,
  maxSpeed: 320,
  /** How fast the sprite gets up to speed: 1400 px/s^2 reaches top speed in ~0.14 s — quick, not instant. */
  accel: 1400,
  /** How fast it stops when the stick/keys let go: quicker than accel, so stopping feels crisp. */
  decel: 2100,
  /** Corner assist: how far (px per step) the sprite may slide sideways to slip around a hedge corner while steering diagonally into it. */
  cornerAssist: 1.5,
  invulnerableAfterHit: 2,
  respawnInvulnerable: 2.5,
};

/**
 * Touch controls, in logical coordinates (the same 1280x720 field the rest of
 * the game uses). The sizes here are the classic ones; the renderer lays the
 * controls out dynamically (see render.js `computeTouchLayout`): on a phone
 * held upright they live in the empty letterbox below the field, and in
 * landscape they tuck into the field's side margins, so they never cover a
 * maze cell. A desktop browser never sees them.
 */
export const TOUCH = {
  dpad: { x: 185, y: 565, radius: 95, knob: 38, deadZone: 0.22 },
  bomb: { x: 1100, y: 570, radius: 60 },
};

export const BOMB = {
  fuse: 2.0,
  blastTime: 0.55,
  startCount: 1,
  maxCount: 6,
  startRange: 2,
  maxRange: 6,
};

export const LIVES = 3;

/** Points for everything worth doing. */
export const SCORE = {
  wall: 10,
  powerup: 25,
  nibbler: 100,
  snapper: 150,
  wisp: 200,
  levelClear: 500,
  timeBonusPerSecond: 10,
};

/** One entry per level: hedge density, enemy mix, and the par time. */
export const LEVELS = [
  { name: 'Sprout Meadow', softDensity: 0.55, nibblers: 3, snappers: 0, wisps: 0, timeLimit: 150, enemySpeed: 1.0 },
  { name: 'Bramble Rows', softDensity: 0.62, nibblers: 3, snappers: 2, wisps: 0, timeLimit: 150, enemySpeed: 1.06 },
  { name: 'Thorn Hollow', softDensity: 0.68, nibblers: 4, snappers: 2, wisps: 1, timeLimit: 150, enemySpeed: 1.12 },
  { name: 'Root Warren', softDensity: 0.72, nibblers: 4, snappers: 3, wisps: 2, timeLimit: 150, enemySpeed: 1.18 },
  { name: 'Bloomheart Gate', softDensity: 0.76, nibblers: 5, snappers: 4, wisps: 3, timeLimit: 180, enemySpeed: 1.25 },
];

/** Endless levels past the fifth reuse this shape, a little harder each time. */
export const ENDLESS = { softDensity: 0.78, nibblers: 6, snappers: 5, wisps: 3, timeLimit: 180, enemySpeed: 1.3 };

export const PALETTE = {
  backdrop: '#0e1a12',
  sky: '#14301f',
  grassA: '#1d4a2a',
  grassB: '#1a4225',
  hud: '#0b140e',
  hudLine: '#2c5a38',
  stone: '#5d6b7a',
  stoneDark: '#425062',
  stoneLight: '#7d8ea3',
  hedge: '#2f7d32',
  hedgeDark: '#1f5c24',
  hedgeLight: '#57a75a',
  leaf: '#7ee787',
  text: '#f2f7ee',
  muted: '#a8c3a5',
  gold: '#ffd166',
  orange: '#ff8c42',
  red: '#ef476f',
  pink: '#ff70a6',
  blue: '#4cc9f0',
  purple: '#b388ff',
  player: '#2ec4b6',
  playerDark: '#1a8a80',
  blastCore: '#fff3b0',
  blastMid: '#ffb703',
  blastEdge: '#fb8500',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
