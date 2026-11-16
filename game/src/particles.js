// Particles, floating score popups and the little screen shake that sells a
// burst. Everything here is cosmetic: it never changes a rule, so the world
// can spawn it freely and the renderer just paints what is alive.

export function createEffects() {
  return { particles: [], popups: [], shake: 0, shakeX: 0, shakeY: 0 };
}

export function burst(effects, x, y, color, count, speed, life = 0.6, size = 5) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    effects.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - speed * 0.25,
      life: life * (0.6 + Math.random() * 0.4),
      maxLife: life,
      color,
      size: size * (0.6 + Math.random() * 0.8),
      gravity: 260,
    });
  }
}

export function petalBurst(effects, x, y, count = 10) {
  const colors = ['#7ee787', '#ffd166', '#ff70a6', '#f2f7ee'];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 90;
    effects.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - 40,
      life: 0.9 + Math.random() * 0.5,
      maxLife: 1.4,
      color: colors[i % colors.length],
      size: 4 + Math.random() * 4,
      gravity: 60,
    });
  }
}

export function popup(effects, text, x, y, color = '#ffd166') {
  effects.popups.push({ text, x, y, life: 1.1, maxLife: 1.1, color });
}

export function addShake(effects, amount) {
  effects.shake = Math.min(14, effects.shake + amount);
}

export function updateEffects(effects, dt) {
  for (let i = effects.particles.length - 1; i >= 0; i -= 1) {
    const p = effects.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      effects.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = effects.popups.length - 1; i >= 0; i -= 1) {
    const p = effects.popups[i];
    p.life -= dt;
    p.y -= 34 * dt;
    if (p.life <= 0) effects.popups.splice(i, 1);
  }
  if (effects.shake > 0) {
    effects.shake = Math.max(0, effects.shake - dt * 34);
    effects.shakeX = (Math.random() - 0.5) * effects.shake;
    effects.shakeY = (Math.random() - 0.5) * effects.shake;
  } else {
    effects.shakeX = 0;
    effects.shakeY = 0;
  }
}

export function clearEffects(effects) {
  effects.particles.length = 0;
  effects.popups.length = 0;
  effects.shake = 0;
  effects.shakeX = 0;
  effects.shakeY = 0;
}
