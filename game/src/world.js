// The game's rules and state, with no drawing and no browser in it: the skiff, the light
// motes, the storm shards, the beacon, spawning, collisions, banking, combos, score, lives
// and levels. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react without the world knowing about screens or sound. Nothing here allocates
// after createWorld returns.
import {
  COMBO_MAX,
  FIELD,
  LEVEL,
  LIVES,
  MOTE,
  PLAYER,
  POOL,
  SHARD,
  WIN_SCORE,
} from './config.js';

export const KIND_MOTE = 0;
export const KIND_SHARD = 1;

export const EVENT_COLLECT = 1;
export const EVENT_BANK = 2;
export const EVENT_HIT = 4;
export const EVENT_SHATTER = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_LEVEL = 64;

/** The beacon: fly into it with carried light to bank points. */
export const BEACON = { x: FIELD.width / 2, y: 118, radius: 42 };

function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height - 120,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    dashTime: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: -1,
    invulnerable: 0,
  };
  const motes = [];
  const shards = [];
  const particles = [];
  const texts = [];
  for (let i = 0; i < POOL.motes; i += 1) {
    motes.push({ active: false, x: 0, y: 0, radius: MOTE.radius, speed: 0, phase: 0, spin: 0 });
  }
  for (let i = 0; i < POOL.shards; i += 1) {
    shards.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 0, angle: 0, spin: 0 });
  }
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  for (let i = 0; i < POOL.texts; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#ffffff' });
  }
  const state = {
    player,
    motes,
    shards,
    particles,
    texts,
    beacon: BEACON,
    score: 0,
    carried: 0,
    combo: 1,
    lives: LIVES,
    level: 1,
    elapsed: 0,
    moteTimer: 0,
    shardTimer: 0,
    won: false,
    shake: 0,
    flash: 0,
    flashColor: '#ffd166',
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height - 120;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.invulnerable = 0;
    for (const mote of motes) mote.active = false;
    for (const shard of shards) shard.active = false;
    for (const particle of particles) particle.active = false;
    for (const text of texts) text.active = false;
    state.score = 0;
    state.carried = 0;
    state.combo = 1;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.moteTimer = 0.4;
    state.shardTimer = 1.2;
    state.won = false;
    state.shake = 0;
    state.flash = 0;
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const particle = free(particles);
      if (particle === null) return;
      const angle = random() * Math.PI * 2;
      const power = speed * (0.3 + random() * 0.7);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * power;
      particle.vy = Math.sin(angle) * power;
      particle.maxLife = 0.4 + random() * 0.4;
      particle.life = particle.maxLife;
      particle.size = 2 + random() * 3;
      particle.color = color;
    }
  }

  function floatText(x, y, text, color) {
    const slot = free(texts);
    if (slot === null) return;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.life = 1.1;
    slot.text = text;
    slot.color = color;
  }

  function spawnMote() {
    const mote = free(motes);
    if (mote === null) return;
    mote.active = true;
    mote.x = 30 + random() * (FIELD.width - 60);
    mote.y = -20;
    mote.speed = MOTE.fallSpeed + random() * MOTE.fallJitter;
    mote.phase = random() * Math.PI * 2;
    mote.spin = 0;
  }

  function spawnShard() {
    const shard = free(shards);
    if (shard === null) return;
    const speed = SHARD.speed + SHARD.speedPerLevel * (state.level - 1);
    shard.active = true;
    shard.radius = SHARD.minRadius + random() * (SHARD.maxRadius - SHARD.minRadius);
    shard.angle = random() * Math.PI * 2;
    shard.spin = (random() - 0.5) * 4;
    if (state.level >= 3 && random() < 0.3) {
      // A sideways shard, from the left or the right edge.
      const fromLeft = random() < 0.5;
      shard.x = fromLeft ? -30 : FIELD.width + 30;
      shard.y = 120 + random() * (FIELD.height - 240);
      shard.vx = (fromLeft ? 1 : -1) * speed * (0.7 + random() * 0.4);
      shard.vy = (random() - 0.5) * speed * 0.4;
    } else {
      shard.x = 30 + random() * (FIELD.width - 60);
      shard.y = -30;
      shard.vx = (random() - 0.5) * speed * 0.8;
      shard.vy = speed * (0.7 + random() * 0.4);
    }
  }

  function moteInterval() {
    return Math.max(MOTE.minInterval, MOTE.interval * 0.94 ** (state.level - 1));
  }

  function shardInterval() {
    return Math.max(SHARD.minInterval, SHARD.interval * 0.9 ** (state.level - 1));
  }

  function bankCarried() {
    const points = state.carried * MOTE.bankPoints * state.combo;
    state.score += points;
    floatText(BEACON.x + 110, BEACON.y - 8, `+${points}`, '#ffd166');
    burst(BEACON.x, BEACON.y, '#ffd166', 22, 260);
    state.carried = 0;
    state.combo = Math.min(COMBO_MAX, state.combo + 1);
    state.flash = 0.35;
    state.flashColor = '#ffd166';
  }

  function takeHit(shard) {
    shard.active = false;
    state.lives -= 1;
    state.combo = 1;
    state.carried = Math.floor(state.carried / 2);
    player.invulnerable = PLAYER.invulnerable;
    state.shake = 1;
    state.flash = 0.3;
    state.flashColor = '#ff5d73';
    burst(player.x, player.y, '#ff5d73', 20, 300);
  }

  /**
   * One fixed step. `control` is { kx, ky, px, py, dash }: the keyboard direction (-1..1),
   * the pointer target in logical pixels (or null), and whether a dash was requested.
   * With `harmless` set (the title screen's backdrop) things drift but nothing touches the
   * player and nothing scores.
   */
  function step(dt, control, harmless) {
    let events = 0;
    state.elapsed += dt;
    const level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (level !== state.level) {
      state.level = level;
      events |= EVENT_LEVEL;
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.5);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    // Steering: keys win over the pointer; the pointer steers toward where it rests.
    let steerX = 0;
    let steerY = 0;
    if (control.kx !== 0 || control.ky !== 0) {
      steerX = control.kx;
      steerY = control.ky;
    } else if (control.px !== null && control.py !== null) {
      const dx = control.px - player.x;
      const dy = control.py - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 14) {
        steerX = dx / dist;
        steerY = dy / dist;
      }
    }

    if (control.dash && player.dashCooldown <= 0 && player.dashTime <= 0) {
      let dx = steerX;
      let dy = steerY;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(player.angle);
        dy = Math.sin(player.angle);
      }
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      player.dashX = dx / len;
      player.dashY = dy / len;
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
    }

    if (player.dashTime > 0) {
      player.dashTime = Math.max(0, player.dashTime - dt);
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
    } else {
      player.vx += steerX * PLAYER.accel * dt;
      player.vy += steerY * PLAYER.accel * dt;
      const damp = Math.exp(-3.2 * dt);
      player.vx *= damp;
      player.vy *= damp;
      const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
      if (speed > PLAYER.maxSpeed) {
        player.vx = (player.vx / speed) * PLAYER.maxSpeed;
        player.vy = (player.vy / speed) * PLAYER.maxSpeed;
      }
    }
    player.x = clamp(player.x + player.vx * dt, player.radius, FIELD.width - player.radius);
    player.y = clamp(player.y + player.vy * dt, player.radius, FIELD.height - player.radius);
    if (Math.abs(player.vx) + Math.abs(player.vy) > 20) {
      player.angle = Math.atan2(player.vy, player.vx);
    }

    // Spawning.
    state.moteTimer -= dt;
    if (state.moteTimer <= 0) {
      spawnMote();
      state.moteTimer += moteInterval();
    }
    state.shardTimer -= dt;
    if (state.shardTimer <= 0) {
      spawnShard();
      state.shardTimer += shardInterval();
    }

    // Motes drift down, sway, and get collected on touch.
    for (const mote of motes) {
      if (!mote.active) continue;
      mote.y += mote.speed * dt;
      mote.x += Math.sin(state.elapsed * 2 + mote.phase) * MOTE.sway * dt;
      mote.spin += dt;
      if (mote.y > FIELD.height + 30) {
        mote.active = false;
        continue;
      }
      if (harmless) continue;
      const reach = mote.radius + player.radius + 6;
      if (distanceSq(mote.x, mote.y, player.x, player.y) > reach * reach) continue;
      mote.active = false;
      if (state.carried < MOTE.carryMax) {
        state.carried += 1;
        burst(mote.x, mote.y, '#7df9d8', 8, 140);
        events |= EVENT_COLLECT;
      } else {
        state.score += 5;
        floatText(mote.x, mote.y - 14, '+5', '#7df9d8');
        events |= EVENT_COLLECT;
      }
    }

    // The beacon banks carried light.
    if (!harmless && state.carried > 0) {
      const reach = BEACON.radius + player.radius;
      if (distanceSq(player.x, player.y, BEACON.x, BEACON.y) <= reach * reach) {
        bankCarried();
        events |= EVENT_BANK;
        if (!state.won && state.score >= WIN_SCORE) {
          state.won = true;
          events |= EVENT_WIN;
        }
      }
    }

    // Shards fly on, and hurt on touch unless the skiff is dashing through them.
    for (const shard of shards) {
      if (!shard.active) continue;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.angle += shard.spin * dt;
      if (shard.x < -60 || shard.x > FIELD.width + 60 || shard.y > FIELD.height + 60) {
        shard.active = false;
        continue;
      }
      if (harmless) continue;
      const reach = shard.radius + player.radius - 4;
      if (distanceSq(shard.x, shard.y, player.x, player.y) > reach * reach) continue;
      if (player.dashTime > 0) {
        shard.active = false;
        state.score += SHARD.shatterPoints;
        floatText(shard.x, shard.y - 14, `+${SHARD.shatterPoints}`, '#8ef1ff');
        burst(shard.x, shard.y, '#ff5d73', 14, 240);
        events |= EVENT_SHATTER;
      } else if (player.invulnerable === 0) {
        takeHit(shard);
        events |= EVENT_HIT;
        if (state.lives === 0) {
          events |= EVENT_OVER;
          break;
        }
      }
    }

    // Particles and floating texts age out.
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-2 * dt);
      particle.vy *= Math.exp(-2 * dt);
    }
    for (const text of texts) {
      if (!text.active) continue;
      text.life -= dt;
      text.y -= 34 * dt;
      if (text.life <= 0) text.active = false;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
