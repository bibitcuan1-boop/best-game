// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, level clear, game over and win.
// 
// ?seed=N fixes the maze. ?shot=start|play|clear|over|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_ENEMY_DOWN,
  EVENT_EXPLOSION,
  EVENT_GAME_OVER,
  EVENT_GATE,
  EVENT_HURT,
  EVENT_LEVEL_CLEAR,
  EVENT_PICKUP,
  EVENT_PLANT,
  EVENT_SHIELD,
  EVENT_TIMEOUT,
  EVENT_WALL,
  EVENT_WIN,
} from './world.js';
import { ACTION_BOMB, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  buttonAt,
  createRenderer,
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false, 2.0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function bankBest() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function playEvents(events) {
    if (events & EVENT_PLANT) audio.plant();
    if (events & EVENT_EXPLOSION) audio.explosion();
    if (events & EVENT_WALL) audio.wallBreak();
    if (events & EVENT_ENEMY_DOWN) audio.enemyDown();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_SHIELD) audio.shield();
    if (events & EVENT_GATE) audio.gate();
    if (events & EVENT_LEVEL_CLEAR) audio.levelClear();
    if (events & EVENT_TIMEOUT) audio.hurt();
    if (events & EVENT_GAME_OVER) {
      audio.gameOver();
      audio.stopMusic();
      bankBest();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
    if (events & EVENT_WIN) {
      audio.win();
      bankBest();
      announce(`You won! Score ${world.state.score}. Best ${best}.`);
    }
  }

  function startGame() {
    audio.unlock();
    audio.click();
    world.startGame();
    screen = SCREEN_PLAY;
    audio.startMusic();
    announce(`Playing level 1, ${world.state.levelName}. ${world.state.player.lives} lives.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_CLEAR) {
        audio.click();
        const events = world.nextLevel();
        if (events & EVENT_WIN) {
          screen = SCREEN_WIN;
          playEvents(events);
        } else {
          screen = SCREEN_PLAY;
          announce(`Level ${world.state.levelIndex + 1}, ${world.state.levelName}.`);
        }
      } else if (screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_BOMB && screen === SCREEN_PLAY) {
      const events = world.plantSeed();
      playEvents(events);
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function handlePointer() {
    const pointer = input.takePointer();
    if (pointer === null) return;
    audio.unlock();
    const logical = renderer.toLogical(pointer.x, pointer.y);
    const hit = buttonAt(screen, logical.x, logical.y);
    if (hit === 'mute') {
      muted = audio.toggleMute();
      return;
    }
    if (hit === 'pause' && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (hit === 'start' || hit === 'again') {
      startGame();
      return;
    }
    if (hit === 'continue') {
      audio.click();
      const events = world.nextLevel();
      if (events & EVENT_WIN) {
        screen = SCREEN_WIN;
        playEvents(events);
      } else {
        screen = SCREEN_PLAY;
        announce(`Level ${world.state.levelIndex + 1}, ${world.state.levelName}.`);
      }
      return;
    }
    if (hit === 'endless') {
      audio.click();
      world.continueEndless();
      screen = SCREEN_PLAY;
      audio.startMusic();
      announce('Endless mode. How far can the garden grow?');
      return;
    }
    if (hit === 'resume') {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 });
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input.direction());
    screen = world.state.screen;
    playEvents(events);
    if (events & EVENT_LEVEL_CLEAR) {
      announce(`Level clear! Bonus ${world.state.stats.levelBonus}. Score ${world.state.score}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handlePointer();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world.state, screen, best, muted, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting seeds burst unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Blastbloom. Press Space or click Start to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
