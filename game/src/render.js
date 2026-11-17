// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Every sprite is drawn in code — circles, petals
// and polygons — so the game needs no image files at all.

import { COLS, FIELD, FONT, MAZE_X, MAZE_Y, PALETTE, ROWS, TILE, TOUCH } from './config.js';
import { TILE_HARD, TILE_SOFT } from './maze.js';
import { ENEMY_NIBBLER, ENEMY_SNAPPER, ENEMY_WISP } from './enemies.js';
import { POWER_BOMB, POWER_HEART, POWER_RANGE, POWER_SHIELD, POWER_SPEED, POWERUP_INFO } from './powerups.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** Clickable buttons, in logical coordinates; main.js tests pointer taps here. */
export const BUTTONS = {
  start: { x: 490, y: 548, w: 300, h: 62 },
  again: { x: 490, y: 548, w: 300, h: 62 },
  endless: { x: 490, y: 470, w: 300, h: 62 },
  againWin: { x: 340, y: 548, w: 280, h: 62 },
  endlessWin: { x: 660, y: 548, w: 280, h: 62 },
  resume: { x: 490, y: 430, w: 300, h: 62 },
  mute: { x: 1224, y: 14, w: 42, h: 42 },
  pause: { x: 1172, y: 14, w: 42, h: 42 },
};

function inRect(x, y, rect, pad = 0) {
  return x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
}

/**
 * Which button a tap lands on, or null. On touch devices every button's hit
 * area grows by 18 logical pixels, so a thumb lands it even where the game is
 * scaled small on a phone.
 */
export function buttonAt(screen, x, y, touch = false) {
  const pad = touch ? 18 : 0;
  if (screen === SCREEN_TITLE && inRect(x, y, BUTTONS.start, pad)) return 'start';
  if (screen === SCREEN_OVER && inRect(x, y, BUTTONS.again, pad)) return 'again';
  if (screen === SCREEN_CLEAR && inRect(x, y, BUTTONS.again, pad)) return 'continue';
  if (screen === SCREEN_PAUSED && inRect(x, y, BUTTONS.resume, pad)) return 'resume';
  if (screen === SCREEN_WIN) {
    if (inRect(x, y, BUTTONS.againWin, pad)) return 'again';
    if (inRect(x, y, BUTTONS.endlessWin, pad)) return 'endless';
  }
  if (screen === SCREEN_PLAY) {
    if (inRect(x, y, BUTTONS.pause, pad)) return 'pause';
    if (inRect(x, y, BUTTONS.mute, pad)) return 'mute';
  }
  return null;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, cssScale: 1, cssX: 0, cssY: 0 };
  const fonts = new Map();
  // The vignette, built once: a soft darkening toward the field's edges.
  // It is painted in logical coordinates, so one gradient serves every size.
  let vignette = null;

  // Where the touch controls live, in logical coordinates, recomputed on
  // every resize. The maze spans x MAZE_X..MAZE_X+COLS*TILE; the field's
  // side margins (82 logical px each) are empty sky, and a portrait phone
  // has a tall empty letterbox below the field.
  let layout = { portrait: false, dpad: { ...TOUCH.dpad }, bomb: { ...TOUCH.bomb }, hintY: 84 };

  /**
   * Portrait phone: the D-pad and BOMB move into the empty letterbox below
   * the field, sized in CSS pixels so they stay thumb-sized on any phone
   * (a 95-logical pad would be a 53 CSS px dot at 0.56x). The rotate hint
   * moves into the empty letterbox above the field, where nothing overlaps
   * it. Landscape (or a squarish window): the controls tuck into the
   * field's side margins, clear of every maze cell — the D-pad can no
   * longer hide the bottom-left corner and BOMB can no longer sit on the
   * gate's home cell (15, 9).
   */
  function computeTouchLayout() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const scale = view.cssScale;
    const fieldBottomCss = view.cssY + FIELD.height * scale;
    const bottomBarCss = cssH - fieldBottomCss;
    if (cssH > cssW && bottomBarCss >= 260) {
      const dpadRadius = 110 / scale;
      const bombRadius = 72 / scale;
      const cyCss = (fieldBottomCss + cssH) / 2;
      return {
        portrait: true,
        dpad: {
          x: (cssW * 0.25 - view.cssX) / scale,
          y: (cyCss - view.cssY) / scale,
          radius: dpadRadius,
          knob: dpadRadius * 0.4,
        },
        bomb: {
          x: (cssW * 0.75 - view.cssX) / scale,
          y: (cyCss - view.cssY) / scale,
          radius: bombRadius,
        },
        hintY: (view.cssY / 2 - view.cssY) / scale,
      };
    }
    const margin = (FIELD.width - (MAZE_X + COLS * TILE)) / 2;
    const dpadRadius = Math.min(TOUCH.dpad.radius, margin - 4);
    return {
      portrait: false,
      dpad: { x: MAZE_X / 2, y: 565, radius: dpadRadius, knob: dpadRadius * 0.4 },
      bomb: { x: FIELD.width - margin, y: 565, radius: TOUCH.bomb.radius },
      hintY: 84,
    };
  }

  function resize() {
    // Cap the pixel ratio at 2: on phones with a DPR of 3 the canvas would
    // be 3x the CSS size for no visible gain, and the fill rate triples.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.width = Math.round(cssW * ratio);
    canvas.height = Math.round(cssH * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
    view.cssScale = Math.min(cssW / FIELD.width, cssH / FIELD.height);
    view.cssX = (cssW - FIELD.width * view.cssScale) / 2;
    view.cssY = (cssH - FIELD.height * view.cssScale) / 2;
    layout = computeTouchLayout();
  }

  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  /** A soft contact shadow under a sprite, so it sits on the grass. */
  function drawShadow(x, y, rx) {
    context.save();
    context.globalAlpha = 0.28;
    context.fillStyle = '#04120a';
    context.beginPath();
    context.ellipse(x, y, rx, rx * 0.32, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  /**
   * Ambient pollen and fireflies drifting over the maze: pure functions of
   * the clock, so they need no state and sit still in a screenshot (t is
   * fixed there). Drawn late, over the maze, under the HUD.
   */
  function drawMotes(t) {
    const colors = ['#ffd166', '#7ee787', '#f2f7ee', '#ff70a6'];
    for (let i = 0; i < 26; i += 1) {
      const drift = t * (6 + (i % 5) * 3);
      const x = (i * 173.3 + Math.sin(t * 0.4 + i * 1.7) * 26 + drift * 0.4) % FIELD.width;
      const y = 84 + ((i * 97.7 + drift) % (FIELD.height - 120));
      const twinkle = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 2.3));
      context.save();
      context.globalAlpha = twinkle;
      circle(x, y, 2 + (i % 3) * 0.7, colors[i % colors.length]);
      context.restore();
    }
  }

  /** A subtle darkening toward the field's edges, for depth. */
  function drawVignette() {
    if (vignette === null) {
      vignette = context.createRadialGradient(640, 320, 280, 640, 360, 780);
      vignette.addColorStop(0, 'rgba(4, 10, 6, 0)');
      vignette.addColorStop(1, 'rgba(4, 10, 6, 0.24)');
    }
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawFloor(state) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const x = MAZE_X + c * TILE;
        const y = MAZE_Y + r * TILE;
        context.fillStyle = (c + r) % 2 === 0 ? PALETTE.grassA : PALETTE.grassB;
        context.fillRect(x, y, TILE, TILE);
      }
    }
  }

  function drawStone(x, y) {
    context.fillStyle = PALETTE.stoneDark;
    roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 8);
    context.fill();
    context.fillStyle = PALETTE.stone;
    roundRect(x + 5, y + 5, TILE - 10, TILE - 10, 6);
    context.fill();
    context.fillStyle = PALETTE.stoneLight;
    context.fillRect(x + 10, y + 10, TILE - 20, 5);
    context.fillStyle = PALETTE.hedgeDark;
    circle(x + TILE - 14, y + TILE - 12, 5, PALETTE.hedgeDark);
    circle(x + 14, y + TILE - 13, 4, PALETTE.hedgeDark);
  }

  function drawHedge(x, y, t) {
    const sway = Math.sin(t * 1.4 + x * 0.05 + y * 0.03) * 1.5;
    context.fillStyle = PALETTE.hedgeDark;
    roundRect(x + 3, y + 3, TILE - 6, TILE - 6, 12);
    context.fill();
    circle(x + 16 + sway, y + 18, 12, PALETTE.hedge);
    circle(x + 38 - sway, y + 16, 13, PALETTE.hedgeLight);
    circle(x + 28, y + 36, 13, PALETTE.hedge);
    circle(x + 15, y + 40, 9, PALETTE.hedgeLight);
    circle(x + 42, y + 40, 8, PALETTE.hedge);
    circle(x + 22, y + 26, 4, '#ffd166');
    circle(x + 36, y + 30, 3, '#ff70a6');
  }

  function drawMaze(state, t) {
    drawFloor(state);
    const grid = state.maze.grid;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const x = MAZE_X + c * TILE;
        const y = MAZE_Y + r * TILE;
        if (grid[r][c] === TILE_HARD) drawStone(x, y);
        else if (grid[r][c] === TILE_SOFT) drawHedge(x, y, t);
      }
    }
  }

  function drawGate(state, t) {
    const gate = state.gate;
    if (!gate || !gate.active) return;
    const x = MAZE_X + (gate.c + 0.5) * TILE;
    const y = MAZE_Y + (gate.r + 0.5) * TILE;
    const pulse = 1 + Math.sin(t * 4) * 0.08;
    // A wide halo, then the bright core: the open gate should be findable
    // at a glance from anywhere in the maze.
    context.save();
    context.globalAlpha = 0.16 + Math.sin(t * 4) * 0.04;
    circle(x, y, 52 * pulse, PALETTE.gold);
    context.restore();
    context.save();
    context.globalAlpha = 0.35 + Math.sin(t * 4) * 0.1;
    circle(x, y, 30 * pulse, PALETTE.gold);
    context.restore();
    // Three sparkles orbiting the door.
    for (let i = 0; i < 3; i += 1) {
      const a = t * 2.2 + (i * Math.PI * 2) / 3;
      const sx = x + Math.cos(a) * 26;
      const sy = y + Math.sin(a) * 26;
      context.save();
      context.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5 + i * 2);
      circle(sx, sy, 3, '#fff3b0');
      context.restore();
    }
    context.fillStyle = '#3a2b12';
    roundRect(x - 18, y - 22, 36, 44, 10);
    context.fill();
    context.fillStyle = PALETTE.gold;
    roundRect(x - 13, y - 17, 26, 34, 7);
    context.fill();
    // A little flower on the door.
    circle(x, y - 2, 7, '#ff70a6');
    circle(x - 6, y + 4, 5, '#fff3b0');
    circle(x + 6, y + 4, 5, '#fff3b0');
    circle(x, y + 2, 4, '#ffd166');
  }

  function drawPowerupIcon(p, t) {
    const bob = Math.sin(t * 3 + p.bob) * 3;
    const x = p.x;
    const y = p.y + bob;
    drawShadow(p.x, p.y + 15, 15);
    context.save();
    context.globalAlpha = 0.3;
    circle(x, y, 20, POWERUP_INFO[p.type].color);
    context.restore();
    if (p.type === POWER_BOMB) {
      circle(x, y + 4, 11, '#8d5a2b');
      context.strokeStyle = '#7ee787';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, y - 4);
      context.quadraticCurveTo(x + 2, y - 14, x + 8, y - 16);
      context.stroke();
      circle(x + 10, y - 16, 4, '#7ee787');
    } else if (p.type === POWER_RANGE) {
      context.strokeStyle = '#ff8c42';
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(x - 12, y);
      context.lineTo(x + 12, y);
      context.moveTo(x, y - 12);
      context.lineTo(x, y + 12);
      context.stroke();
      circle(x, y, 5, '#ffd166');
    } else if (p.type === POWER_SPEED) {
      context.fillStyle = '#4cc9f0';
      roundRect(x - 11, y - 8, 16, 18, 5);
      context.fill();
      context.fillRect(x - 11, y + 6, 22, 6);
      context.fillStyle = '#f2f7ee';
      context.beginPath();
      context.moveTo(x + 8, y - 12);
      context.lineTo(x + 16, y - 4);
      context.lineTo(x + 8, y - 2);
      context.closePath();
      context.fill();
    } else if (p.type === POWER_SHIELD) {
      context.fillStyle = '#b388ff';
      context.beginPath();
      context.moveTo(x, y - 14);
      context.lineTo(x + 12, y - 8);
      context.lineTo(x + 10, y + 6);
      context.quadraticCurveTo(x, y + 16, x - 10, y + 6);
      context.lineTo(x - 12, y - 8);
      context.closePath();
      context.fill();
      context.fillStyle = '#f2f7ee';
      text('✦', x, y + 7, 14, '#f2f7ee', 'center');
    } else if (p.type === POWER_HEART) {
      context.fillStyle = '#ff70a6';
      circle(x - 6, y - 3, 7, '#ff70a6');
      circle(x + 6, y - 3, 7, '#ff70a6');
      context.beginPath();
      context.moveTo(x - 12, y - 1);
      context.lineTo(x + 12, y - 1);
      context.lineTo(x, y + 13);
      context.closePath();
      context.fill();
    }
  }

  function drawBomb(bomb) {
    const urgency = Math.max(0, 1 - bomb.fuse / 2);
    const scale = 1 + Math.sin(bomb.pulse * (6 + urgency * 14)) * 0.05 + urgency * 0.08;
    const x = MAZE_X + (bomb.c + 0.5) * TILE;
    const y = MAZE_Y + (bomb.r + 0.5) * TILE;
    drawShadow(x, y + 15, 16);
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    circle(0, 2, 17, '#14532d');
    circle(0, 0, 15, '#22c55e');
    circle(-5, -5, 5, '#86efac');
    context.strokeStyle = '#14532d';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, -14);
    context.quadraticCurveTo(4, -24, 12, -24);
    context.stroke();
    circle(13, -25, 4, '#7ee787');
    if (urgency > 0.5) {
      context.fillStyle = Math.floor(bomb.pulse * 12) % 2 === 0 ? '#fff3b0' : '#fb8500';
      circle(13, -25, 6, context.fillStyle);
    }
    context.restore();
  }

  function drawBlasts(state) {
    for (const blast of state.bombs.blasts) {
      const alpha = Math.min(1, blast.timer / 0.55);
      // The first ~0.1 s of a burst is a white-gold flash over every flame
      // cell, so the explosion pops instead of just appearing.
      const age = 0.55 - blast.timer;
      const flash = age < 0.1 ? (1 - age / 0.1) * 0.85 : 0;
      for (const cell of blast.list) {
        const x = MAZE_X + cell.c * TILE;
        const y = MAZE_Y + cell.r * TILE;
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        // A soft glow halo behind the flame cell.
        context.save();
        context.globalAlpha = alpha * 0.35;
        circle(cx, cy, 30, PALETTE.blastMid);
        context.restore();
        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = PALETTE.blastEdge;
        roundRect(x + 4, y + 4, TILE - 8, TILE - 8, 10);
        context.fill();
        context.fillStyle = PALETTE.blastMid;
        roundRect(x + 10, y + 10, TILE - 20, TILE - 20, 8);
        context.fill();
        context.fillStyle = PALETTE.blastCore;
        circle(x + TILE / 2, y + TILE / 2, 9, PALETTE.blastCore);
        context.restore();
        if (flash > 0) {
          context.save();
          context.globalAlpha = flash;
          circle(cx, cy, 24, '#fffbe6');
          context.restore();
        }
      }
    }
  }

  function drawEnemy(e, t) {
    const wobble = Math.sin(e.wobble) * 2;
    const x = e.x;
    const y = e.y + wobble;
    drawShadow(x, e.y + 16, 17);
    if (e.type === ENEMY_NIBBLER) {
      circle(x, y, 19, '#c25e1e');
      circle(x, y, 17, '#ff8c42');
      circle(x - 6, y - 6, 3.5, '#1b1b1b');
      circle(x + 6, y - 6, 3.5, '#1b1b1b');
      context.fillStyle = '#7c2d12';
      context.beginPath();
      context.ellipse(x, y + 6, 9, 6, 0, 0, Math.PI);
      context.fill();
      context.fillStyle = '#f2f7ee';
      context.fillRect(x - 7, y + 2, 4, 4);
      context.fillRect(x + 3, y + 2, 4, 4);
    } else if (e.type === ENEMY_SNAPPER) {
      context.fillStyle = '#ef476f';
      context.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + t * 0.5;
        const r1 = i % 2 === 0 ? 24 : 16;
        const px = x + Math.cos(a) * r1;
        const py = y + Math.sin(a) * r1;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      circle(x, y, 14, '#d90429');
      context.fillStyle = '#f2f7ee';
      context.beginPath();
      context.moveTo(x - 10, y - 4);
      context.lineTo(x - 2, y - 2);
      context.lineTo(x - 10, y + 1);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(x + 10, y - 4);
      context.lineTo(x + 2, y - 2);
      context.lineTo(x + 10, y + 1);
      context.closePath();
      context.fill();
    } else if (e.type === ENEMY_WISP) {
      context.save();
      context.globalAlpha = 0.85;
      circle(x, y, 17, '#e0aaff');
      context.fillStyle = '#c77dff';
      context.beginPath();
      context.moveTo(x - 17, y + 6);
      context.quadraticCurveTo(x - 8, y + 22, x, y + 8);
      context.quadraticCurveTo(x + 8, y + 22, x + 17, y + 6);
      context.closePath();
      context.fill();
      context.fillStyle = '#3c096c';
      context.beginPath();
      context.ellipse(x - 6, y - 2, 2.5, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.ellipse(x + 6, y - 2, 2.5, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawPlayer(state, t) {
    const p = state.player;
    // The contact shadow and the hurt ring stay visible even while the
    // invulnerability blink hides the body itself.
    drawShadow(p.x, p.y + 17, 17);
    if (p.hurtFlash > 0) {
      const flashAlpha = p.hurtFlash / 0.4;
      context.save();
      context.globalAlpha = flashAlpha * 0.85;
      context.strokeStyle = PALETTE.red;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(p.x, p.y, 26, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    if (p.invulnerable > 0 && Math.floor(t * 10) % 2 === 0) return;
    const bob = p.moving ? Math.sin(t * 14) * 2 : Math.sin(t * 3) * 1.5;
    // Squash & stretch along the direction of travel, plus a slight lean
    // into the run: the sprite feels weighted instead of sliding like a puck.
    const speedRatio = Math.min(Math.hypot(p.vx, p.vy) / p.speed, 1);
    const stretch = 1 + 0.10 * speedRatio;
    const squash = 1 - 0.07 * speedRatio;
    const horizontal = Math.abs(p.vx) >= Math.abs(p.vy);
    const lean = Math.max(-1, Math.min(1, p.vx / p.speed)) * 0.09;
    context.save();
    context.translate(p.x, p.y + bob);
    context.rotate(lean);
    context.scale(horizontal ? stretch : squash, horizontal ? squash : stretch);
    if (p.shield) {
      context.save();
      context.globalAlpha = 0.4;
      circle(0, 0, 28, '#b388ff');
      context.restore();
    }
    circle(0, 2, 19, '#1a8a80');
    circle(0, 0, 18, '#2ec4b6');
    circle(0, 5, 11, '#a7f3d0');
    // Leaf hat.
    context.fillStyle = '#57a75a';
    context.beginPath();
    context.ellipse(0, -17, 12, 5, -0.3, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(4, -20, 9, 4, 0.5, 0, Math.PI * 2);
    context.fill();
    const lookX = p.faceX * 2.5;
    const lookY = p.faceY * 2.5;
    circle(-7 + lookX, -4 + lookY, 4.5, '#0b140e');
    circle(7 + lookX, -4 + lookY, 4.5, '#0b140e');
    circle(-5.5 + lookX, -5.5 + lookY, 1.5, '#f2f7ee');
    circle(8.5 + lookX, -5.5 + lookY, 1.5, '#f2f7ee');
    context.strokeStyle = '#0b140e';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(lookX, 6 + lookY, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
    context.restore();
    // A white flash over the body right after a hit lands.
    if (p.hurtFlash > 0) {
      context.save();
      context.globalAlpha = (p.hurtFlash / 0.4) * 0.3;
      circle(p.x, p.y + bob, 18, '#ffffff');
      context.restore();
    }
  }

  function drawEffects(state) {
    const effects = state.effects;
    for (const p of effects.particles) {
      context.save();
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      circle(p.x, p.y, p.size, p.color);
      context.restore();
    }
    for (const p of effects.popups) {
      context.save();
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      text(p.text, p.x, p.y, 20, p.color, 'center', '700 ');
      context.restore();
    }
  }

  function drawHud(state, best, muted) {
    context.fillStyle = PALETTE.hud;
    context.fillRect(0, 0, FIELD.width, 72);
    context.fillStyle = PALETTE.hudLine;
    context.fillRect(0, 70, FIELD.width, 2);
    text(`SCORE ${state.score}`, 24, 32, 26, PALETTE.text, 'left', '700 ');
    text(`BEST ${Math.max(best, state.score)}`, 24, 58, 15, PALETTE.muted, 'left');
    text(`LEVEL ${state.levelIndex + 1} · ${state.levelName}`, FIELD.width / 2, 32, 24, PALETTE.gold, 'center', '700 ');
    const mm = Math.floor(Math.max(0, state.timeLeft) / 60);
    const ss = String(Math.floor(Math.max(0, state.timeLeft) % 60)).padStart(2, '0');
    const timeColor = state.timeLeft < 30 ? PALETTE.red : PALETTE.text;
    text(`${mm}:${ss}`, FIELD.width / 2, 58, 16, timeColor, 'center');
    // Lives as little leaves.
    let lx = 1010;
    text('LIVES', lx - 12, 32, 15, PALETTE.muted, 'right');
    for (let i = 0; i < 5; i += 1) {
      const x = lx + i * 26;
      context.fillStyle = i < state.player.lives ? PALETTE.leaf : '#243b2a';
      context.beginPath();
      context.ellipse(x + 8, 26, 9, 6, -0.5, 0, Math.PI * 2);
      context.fill();
    }
    // Seeds, range, boots, shield.
    text(`💣 ${state.player.bombsMax - state.bombs.planted.length}/${state.player.bombsMax}`, 1010, 58, 15, PALETTE.text, 'left');
    text(`✦ ${state.player.range}`, 1090, 58, 15, PALETTE.text, 'left');
    if (state.player.shield) text('🛡', 1140, 58, 15, PALETTE.purple, 'left');
    // Pause and mute buttons.
    context.fillStyle = '#1d4a2a';
    roundRect(BUTTONS.pause.x, BUTTONS.pause.y, BUTTONS.pause.w, BUTTONS.pause.h, 8);
    context.fill();
    text('II', BUTTONS.pause.x + 21, BUTTONS.pause.y + 28, 16, PALETTE.text, 'center', '700 ');
    context.fillStyle = muted ? '#5d2b2b' : '#1d4a2a';
    roundRect(BUTTONS.mute.x, BUTTONS.mute.y, BUTTONS.mute.w, BUTTONS.mute.h, 8);
    context.fill();
    text(muted ? '✕' : '♪', BUTTONS.mute.x + 21, BUTTONS.mute.y + 28, 16, PALETTE.text, 'center', '700 ');
    if (state.messageTimer > 0) {
      context.save();
      context.globalAlpha = Math.min(1, state.messageTimer);
      text(state.message, FIELD.width / 2, 108, 22, PALETTE.gold, 'center', '700 ');
      context.restore();
    }
  }

  function drawButton(rect, label, enabled = true) {
    context.fillStyle = enabled ? PALETTE.gold : '#3a4a3a';
    roundRect(rect.x, rect.y, rect.w, rect.h, 12);
    context.fill();
    text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 8, 24, '#1b2b17', 'center', '700 ');
  }

  function drawPanel(title, lines, prompt, buttonLabel, buttonRect) {
    context.save();
    context.globalAlpha = 0.55;
    context.fillStyle = '#060d08';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.restore();
    const w = 640;
    const h = 150 + lines.length * 34 + 120;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    context.fillStyle = '#12261a';
    roundRect(x, y, w, h, 18);
    context.fill();
    context.strokeStyle = PALETTE.hudLine;
    context.lineWidth = 2;
    roundRect(x, y, w, h, 18);
    context.stroke();
    text(title, FIELD.width / 2, y + 74, 46, PALETTE.text, 'center', '800 ');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 122 + i * 34, 20, PALETTE.muted, 'center');
    }
    if (buttonLabel) drawButton(buttonRect, buttonLabel);
    text(prompt, FIELD.width / 2, y + h - 26, 18, PALETTE.gold, 'center');
  }

  function drawTitle(state, best, t) {
    // Dim the living maze behind the title so the words read at a glance.
    context.fillStyle = 'rgba(6, 13, 8, 0.55)';
    context.fillRect(0, 72, FIELD.width, FIELD.height - 72);
    // Petals drifting down over the dimmed maze, behind the words.
    const petalColors = ['#7ee787', '#ff70a6', '#ffd166', '#f2f7ee'];
    for (let i = 0; i < 12; i += 1) {
      const px = (i * 211 + t * 14) % FIELD.width;
      const py = 80 + ((i * 131 + t * 26) % (FIELD.height - 160));
      context.save();
      context.translate(px, py);
      context.rotate(Math.sin(t * 0.8 + i * 1.3) * 0.9);
      context.globalAlpha = 0.55;
      context.fillStyle = petalColors[i % petalColors.length];
      context.beginPath();
      context.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // The title breathes gently: a slow scale pulse around its centre.
    const pulse = 1 + Math.sin(t * 2) * 0.015;
    context.save();
    context.translate(FIELD.width / 2, 132);
    context.scale(pulse, pulse);
    text('BLASTBLOOM', 0, 0, 72, PALETTE.text, 'center', '800 ');
    context.restore();
    text('Plant blast-seeds. Shatter the hedges. Free the garden.', FIELD.width / 2, 172, 22, PALETTE.leaf, 'center');
    const lines = [
      'WASD / arrows — run through the maze    SPACE — plant a seed',
      'Seeds burst in a cross and break hedges — hide from your own blast!',
      'Grab power-ups under the hedges. Beat every pest, then step on the gate.',
      `BEST ${Math.max(best, state.score)}`,
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, 218 + i * 30, 19, PALETTE.muted, 'center');
    }
    drawButton(BUTTONS.start, '▶  START GARDEN');
    text('or press SPACE — click the buttons, or M to mute', FIELD.width / 2, 648, 16, PALETTE.muted, 'center');
  }

  /** The touch controls, drawn only on touch devices: a joystick and a big
   * seed button, at the spots `computeTouchLayout` picked — the letterbox
   * below the field in portrait, the field's side margins in landscape —
   * so they never cover a maze cell. Semi-transparent; the knob follows
   * the thumb and both controls brighten and squash a touch while pressed.
   * Chevrons, knob travel and strokes scale with the pad size, so the
   * controls read the same at the portrait letterbox size as at the
   * classic in-field size. */
  function drawTouchControls(touch) {
    const dpad = layout.dpad;
    const bomb = layout.bomb;
    // Strokes are in logical units: divide by the CSS scale so a 3px ring
    // stays 3 CSS px on screen instead of shrinking to ~1.7px in portrait.
    const u = 1 / view.cssScale;
    const move = touch.move;
    context.save();
    context.globalAlpha = move !== null ? 0.55 : 0.34;
    circle(dpad.x, dpad.y, dpad.radius, '#0b140e');
    context.globalAlpha = move !== null ? 0.9 : 0.55;
    context.strokeStyle = PALETTE.leaf;
    context.lineWidth = 3 * u;
    context.beginPath();
    context.arc(dpad.x, dpad.y, dpad.radius, 0, Math.PI * 2);
    context.stroke();
    // Direction chevrons, placed proportionally so they fit any pad size.
    context.fillStyle = PALETTE.leaf;
    const chev = dpad.radius * 0.61;
    const s = dpad.radius * 0.105;
    const triangles = [
      [dpad.x, dpad.y - chev, 0, -1], [dpad.x, dpad.y + chev, 0, 1],
      [dpad.x - chev, dpad.y, -1, 0], [dpad.x + chev, dpad.y, 1, 0],
    ];
    for (const [tx, ty, dx, dy] of triangles) {
      context.beginPath();
      context.moveTo(tx + dx * s, ty + dy * s);
      context.lineTo(tx - dy * s - dx * s * 0.4, ty + dx * s - dy * s * 0.4);
      context.lineTo(tx + dy * s - dx * s * 0.4, ty - dx * s - dy * s * 0.4);
      context.closePath();
      context.fill();
    }
    // The knob follows the thumb; at rest it sits in the middle.
    const travel = dpad.radius * 0.46;
    const kx = dpad.x + (move !== null ? move.dx * travel : 0);
    const ky = dpad.y + (move !== null ? move.dy * travel : 0);
    context.globalAlpha = move !== null ? 0.95 : 0.7;
    circle(kx, ky, dpad.knob, move !== null ? PALETTE.leaf : '#2c5a38');
    context.globalAlpha = 0.9;
    context.strokeStyle = PALETTE.leaf;
    context.lineWidth = 2 * u;
    context.beginPath();
    context.arc(kx, ky, dpad.knob, 0, Math.PI * 2);
    context.stroke();

    // The BOMB button: a thumb-sized seed that squashes while held.
    const pressed = touch.bomb !== null;
    const radius = pressed ? bomb.radius - 7 * u : bomb.radius;
    const k = radius / TOUCH.bomb.radius;
    context.globalAlpha = pressed ? 0.95 : 0.6;
    circle(bomb.x, bomb.y, radius + 6 * u, '#7c2d12');
    circle(bomb.x, bomb.y, radius, pressed ? '#ffb703' : '#ff8c42');
    circle(bomb.x - 6 * k, bomb.y - 6 * k, radius * 0.32, '#ffd166');
    context.strokeStyle = '#14532d';
    context.lineWidth = 3 * u;
    context.beginPath();
    context.moveTo(bomb.x, bomb.y - radius * 0.55);
    context.quadraticCurveTo(bomb.x + 4 * k, bomb.y - radius - 8 * k, bomb.x + 14 * k, bomb.y - radius - 10 * k);
    context.stroke();
    circle(bomb.x + 16 * k, bomb.y - radius - 10 * k, 5 * u, '#7ee787');
    text('BOMB', bomb.x, bomb.y + radius * 0.62, Math.round(radius * 0.28), '#3a2b12', 'center', '800 ');
    context.restore();
  }

  /** On a phone held upright, a gentle nudge to turn it sideways. In
   * portrait it lives in the empty letterbox above the field, rendered at
   * a readable size, so it can never hide behind the title or cover the
   * maze's top row (both of which the old in-field spot did). */
  function drawRotateHint() {
    if (window.innerWidth >= window.innerHeight) return;
    const message = '📱  Putar HP ke landscape — maze-nya lebih lega';
    context.save();
    context.globalAlpha = 0.85;
    if (layout.portrait) {
      const size = Math.round(20 / view.cssScale);
      context.font = `${size}px ${FONT}`;
      const w = context.measureText(message).width + size * 2.4;
      const h = size * 2.4;
      const x = (FIELD.width - w) / 2;
      const y = layout.hintY - h / 2;
      context.fillStyle = '#12261a';
      roundRect(x, y, w, h, 12 / view.cssScale);
      context.fill();
      context.strokeStyle = PALETTE.hudLine;
      context.lineWidth = 2 / view.cssScale;
      roundRect(x, y, w, h, 12 / view.cssScale);
      context.stroke();
      text(message, FIELD.width / 2, layout.hintY + size * 0.35, size, PALETTE.leaf, 'center');
    } else {
      const w = 560;
      const x = (FIELD.width - w) / 2;
      context.fillStyle = '#12261a';
      roundRect(x, 84, w, 44, 12);
      context.fill();
      context.strokeStyle = PALETTE.hudLine;
      context.lineWidth = 2;
      roundRect(x, 84, w, 44, 12);
      context.stroke();
      text(message, FIELD.width / 2, 113, 19, PALETTE.leaf, 'center');
    }
    context.restore();
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen. */
  function draw(state, screen, best, muted, t, touch = null) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + state.effects.shakeX * view.scale, view.y + state.effects.shakeY * view.scale);
    context.fillStyle = PALETTE.sky;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    drawMaze(state, t);
    drawGate(state, t);
    for (const p of state.powerups) if (!p.taken) drawPowerupIcon(p, t);
    for (const bomb of state.bombs.planted) drawBomb(bomb);
    drawBlasts(state);
    for (const e of state.enemies) if (e.alive) drawEnemy(e, t);
    if (screen !== SCREEN_TITLE) drawPlayer(state, t);
    else drawPlayer(state, t);
    drawEffects(state);
    drawMotes(t);
    drawVignette();
    if (touch !== null && touch.supported) {
      // The controls and the hint sit outside the maze: keep them steady
      // while the field shakes from a blast.
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      if (screen === SCREEN_PLAY) drawTouchControls(touch);
      if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) drawRotateHint();
    }
    if (screen === SCREEN_TITLE) {
      drawHud(state, best, muted);
      drawTitle(state, best, t);
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The garden waits for you.'], 'Press P or click RESUME', '▶  RESUME', BUTTONS.resume);
    } else if (screen === SCREEN_CLEAR) {
      drawPanel(
        'LEVEL CLEAR!',
        [
          `${state.levelName} — all pests beaten`,
          `Level bonus  +${state.stats.levelBonus}`,
          `Score  ${state.score}`,
        ],
        'Press SPACE for the next level',
        'NEXT LEVEL  ▶',
        BUTTONS.again,
      );
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'THE GARDEN WILTED',
        [
          `Score  ${state.score}`,
          `Best  ${Math.max(best, state.score)}`,
          `You reached level ${state.levelIndex + 1} — ${state.levelName}`,
        ],
        'Press SPACE to plant again',
        '↻  PLAY AGAIN',
        BUTTONS.again,
      );
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'THE GARDEN BLOOMS!',
        [
          `All five levels cleared — score  ${state.score}`,
          `Hedges shattered ${state.stats.wallsBroken} · pests beaten ${state.stats.enemiesDown}`,
          'The gate is open forever now.',
        ],
        'Play again, or keep going in endless mode',
        null,
        null,
      );
      drawButton(BUTTONS.againWin, '↻  PLAY AGAIN');
      drawButton(BUTTONS.endlessWin, '∞  ENDLESS');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** The current touch-control layout, in logical coordinates; the input
     * module reads it at event time so a rotation re-lays the controls out
     * without any re-wiring. */
    touchLayout() {
      return layout;
    },
    toLogical(cssX, cssY) {
      return { x: (cssX - view.cssX) / view.cssScale, y: (cssY - view.cssY) / view.cssScale };
    },
  };
}
