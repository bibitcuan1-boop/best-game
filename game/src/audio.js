// All sound is procedural WebAudio: no audio files, no network. Short
// oscillator and noise bursts for every action, plus a light pentatonic loop
// that hums under play. The context is created on the first user gesture, so
// a page that only stages a screenshot stays silent.

const MELODY = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33];
const BASS = [130.81, 164.81, 196.0, 146.83];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx !== null;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, volume, when = 0, slideTo = null) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(dur, volume, lowpass = 1200) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime;
      const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function startMusic() {
    if (musicTimer !== null || !ensure()) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const note = MELODY[musicStep % MELODY.length];
      tone(note, 0.34, 'triangle', 0.055);
      if (musicStep % 2 === 0) tone(BASS[(musicStep / 2 | 0) % BASS.length], 0.5, 'sine', 0.05);
      musicStep += 1;
    }, 300);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (muted) stopMusic();
      return muted;
    },
    startMusic,
    stopMusic,
    plant() { tone(420, 0.12, 'sine', 0.16, 0, 640); },
    explosion() {
      noise(0.45, 0.5, 900);
      tone(140, 0.4, 'sine', 0.35, 0, 42);
    },
    pickup() { tone(660, 0.1, 'triangle', 0.18); tone(990, 0.16, 'triangle', 0.18, 0.07); },
    wallBreak() { noise(0.16, 0.22, 2400); tone(220, 0.12, 'square', 0.06, 0, 110); },
    enemyDown() { tone(520, 0.22, 'sawtooth', 0.12, 0, 130); },
    hurt() { tone(300, 0.3, 'sawtooth', 0.2, 0, 70); noise(0.2, 0.2, 800); },
    shield() { tone(880, 0.14, 'triangle', 0.16); tone(1174, 0.2, 'triangle', 0.14, 0.08); },
    gate() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.09)); },
    levelClear() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, i * 0.1)); },
    win() { [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.32, 'triangle', 0.16, i * 0.11)); },
    gameOver() { [392, 329.63, 261.63, 196].forEach((f, i) => tone(f, 0.36, 'triangle', 0.15, i * 0.16)); },
    click() { tone(740, 0.07, 'triangle', 0.12); },
  };
}
