// Keyboard, pointer and touch input. Held keys give a movement direction;
// one-shot presses (plant a seed, start, pause, mute) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and
// never counted twice. Pointer presses are reported with their canvas
// position so the game can test them against its buttons.
//
// On touch devices a virtual joystick (bottom left) and a big BOMB button
// (bottom right) appear, drawn by the renderer from the shared `touchState`
// this module keeps. Holding the joystick steers exactly like holding a key;
// tapping BOMB plants a seed exactly like Space. A desktop browser has no
// touch, so none of this runs there and keyboard + mouse are untouched.

import { TOUCH } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_BOMB = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const BOMB_KEYS = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

/** True when this device has a touchscreen (a phone or tablet). */
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  if ('ontouchstart' in window) return true;
  if (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0) return true;
  return false;
}

/**
 * The live touch state the renderer draws: which thumb is where.
 * `move` is the joystick touch ({ id, dx, dy } with dx/dy in -1..1);
 * `bomb` is the bomb touch ({ id }) while it is held down.
 */
export function createTouchState() {
  return { supported: isTouchDevice(), move: null, bomb: null };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {(cssX: number, cssY: number) => {x: number, y: number}} [options.toLogical]
 *   Converts canvas CSS pixels to the game's logical coordinates; without it
 *   touch positions are read as logical coordinates directly.
 * @param {object} [options.touchState] The shared state (see createTouchState).
 * @param {() => {dpad: {x: number, y: number, radius: number}, bomb: {x: number, y: number, radius: number}}} [options.touchLayout]
 *   Where the controls currently are, in logical coordinates; read at event
 *   time so a rotation moves the hit areas with the drawing. Without it the
 *   classic spots from config.js are used.
 */
export function createInput(canvas, options = {}) {
  const held = new Set();
  let actions = 0;
  let pointer = null;
  const toLogical = options.toLogical ?? ((x, y) => ({ x, y }));
  const touchState = options.touchState ?? createTouchState();
  const touchLayout = options.touchLayout ?? (() => TOUCH);

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (BOMB_KEYS.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BOMB;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });

  // --- Touch controls (only on touch devices; desktop never registers these). ---
  function touchPoint(touch) {
    const rect = canvas.getBoundingClientRect();
    return toLogical(touch.clientX - rect.left, touch.clientY - rect.top);
  }

  function updateJoystick(touch) {
    const at = touchPoint(touch);
    const dpad = touchLayout().dpad;
    let dx = (at.x - dpad.x) / dpad.radius;
    let dy = (at.y - dpad.y) / dpad.radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    touchState.move = { id: touch.identifier, dx, dy };
  }

  if (touchState.supported) {
    canvas.addEventListener('touchstart', (event) => {
      // Never let a game touch scroll, zoom or pull-to-refresh the page.
      event.preventDefault();
      for (const touch of event.changedTouches) {
        const at = touchPoint(touch);
        const controls = touchLayout();
        if (dist(at.x, at.y, controls.bomb.x, controls.bomb.y) <= controls.bomb.radius + 12) {
          if (touchState.bomb === null) {
            touchState.bomb = { id: touch.identifier };
            actions |= ACTION_BOMB;
          }
        } else if (dist(at.x, at.y, controls.dpad.x, controls.dpad.y) <= controls.dpad.radius + 16) {
          updateJoystick(touch);
        }
        // Any other touch (a menu button, the HUD) is left to pointerdown.
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      for (const touch of event.changedTouches) {
        if (touchState.move !== null && touch.identifier === touchState.move.id) updateJoystick(touch);
      }
    }, { passive: false });
    const endTouch = (event) => {
      for (const touch of event.changedTouches) {
        if (touchState.move !== null && touch.identifier === touchState.move.id) touchState.move = null;
        if (touchState.bomb !== null && touch.identifier === touchState.bomb.id) touchState.bomb = null;
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    touchState,
    /**
     * Movement direction this frame: the joystick's vector while a thumb holds
     * it (any angle, diagonals included), else the held keys as -1/0/1.
     */
    direction() {
      const move = touchState.move;
      if (move !== null) {
        const len = Math.hypot(move.dx, move.dy);
        if (len > TOUCH.dpad.deadZone) return { x: move.dx, y: move.dy };
      }
      return {
        x: (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0),
        y: (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last pointer press in canvas CSS pixels, taken once. */
    takePointer() {
      const taken = pointer;
      pointer = null;
      return taken;
    },
  };
}
