// The screenshot scenes behind ?shot=start|play|bank|end. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_BANK, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const BANK_LIMIT_SECONDS = 90;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;
/** How far ahead, in seconds, the autopilot checks each way it could move. */
const HORIZON_PLAY = 0.8;
const HORIZON_END = 0.25;
/** Eight compass directions plus staying put, as unit vectors. */
const DIRECTIONS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, 0.7071],
  [-0.7071, -0.7071],
];
/** Extra room, each side, it keeps between the skiff and a shard. */
const MARGIN = 8;

/** Seconds until moving in `direction` runs the skiff into a shard; Infinity when it never does. */
function timeToHit(state, direction, horizon) {
  const player = state.player;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const x = Math.min(
      FIELD.width - player.radius,
      Math.max(player.radius, player.x + direction[0] * PLAYER.maxSpeed * t),
    );
    const y = Math.min(
      FIELD.height - player.radius,
      Math.max(player.radius, player.y + direction[1] * PLAYER.maxSpeed * t),
    );
    for (let index = 0; index < state.shards.length; index += 1) {
      const shard = state.shards[index];
      if (!shard.active) continue;
      const sx = shard.x + shard.vx * t;
      const sy = shard.y + shard.vy * t;
      const reach = shard.radius + player.radius - 4 + MARGIN;
      const dx = sx - x;
      const dy = sy - y;
      if (dx * dx + dy * dy < reach * reach) return t;
    }
  }
  return Infinity;
}

/**
 * Steer the skiff: among the directions that stay clear of shards for the horizon, the one
 * most toward the target (the beacon when carrying plenty, else the nearest mote); when no
 * direction is clear, the one that is hit last, and dash through a shard that is already
 * nearly on top of the skiff. Returns { kx, ky, dash }.
 */
export function autopilot(state, horizon, useDash) {
  const player = state.player;
  let target = null;
  if (state.carried >= 4) {
    target = { x: state.beacon.x, y: state.beacon.y };
  } else {
    let best = Infinity;
    for (const mote of state.motes) {
      if (!mote.active) continue;
      const dx = mote.x - player.x;
      const dy = mote.y - player.y;
      const dist = dx * dx + dy * dy;
      if (dist < best) {
        best = dist;
        target = mote;
      }
    }
  }
  if (target === null) target = { x: FIELD.width / 2, y: FIELD.height / 2 };
  const tx = target.x - player.x;
  const ty = target.y - player.y;
  const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
  const wantX = tx / tlen;
  const wantY = ty / tlen;

  let bestDir = DIRECTIONS[0];
  let bestTime = -1;
  let bestAlign = -Infinity;
  for (const dir of DIRECTIONS) {
    const time = timeToHit(state, dir, horizon);
    const align = dir[0] * wantX + dir[1] * wantY;
    // A direction that is safe for the whole horizon wins on alignment; otherwise the
    // longest survival wins.
    if (time === Infinity && bestTime !== Infinity) {
      bestTime = Infinity;
      bestAlign = align;
      bestDir = dir;
    } else if (time === Infinity && bestTime === Infinity && align > bestAlign) {
      bestAlign = align;
      bestDir = dir;
    } else if (time !== Infinity && bestTime !== Infinity && time > bestTime) {
      bestTime = time;
      bestAlign = align;
      bestDir = dir;
    }
  }
  const dash =
    useDash && bestTime !== Infinity && bestTime < 0.35 && player.dashCooldown <= 0;
  return { kx: bestDir[0], ky: bestDir[1], dash };
}

/** Run the world forward one step with the autopilot's control. */
function pilotStep(world, horizon, useDash) {
  const control = autopilot(world.state, horizon, useDash);
  return world.step(STEP, { kx: control.kx, ky: control.ky, px: null, py: null, dash: control.dash }, false);
}

/** A clean frame: no hit shake or flash frozen mid-decay when the staging stops. */
function settle(world) {
  world.state.shake = 0;
  world.state.flash = 0;
}

/**
 * Set `world` to the named scene (start, play, bank or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'bank' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { kx: 0, ky: 0, px: null, py: null, dash: false }, true);
    }
    settle(world);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'bank') {
    // Play until the skiff has banked twice (combo 3), then stop mid-game.
    for (let i = 0; i < BANK_LIMIT_SECONDS / STEP; i += 1) {
      const events = pilotStep(world, HORIZON_PLAY, true);
      if (events & EVENT_WIN) {
        settle(world);
        return { screen: SCREEN_WIN, best: world.state.score };
      }
      if (events & EVENT_BANK && world.state.combo >= 3) {
        settle(world);
        return { screen: SCREEN_PLAY, best: world.state.score };
      }
      if (events & EVENT_OVER) break;
    }
    settle(world);
    return { screen: world.state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const horizon = name === 'end' ? HORIZON_END : HORIZON_PLAY;
  const useDash = name !== 'end';
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = pilotStep(world, horizon, useDash);
    if (events & EVENT_WIN && name !== 'end') {
      settle(world);
      return { screen: SCREEN_WIN, best: world.state.score };
    }
    if (events & EVENT_OVER) break;
  }
  settle(world);
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
