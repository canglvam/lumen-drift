// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  accel: 2600,
  maxSpeed: 430,
  dashSpeed: 980,
  dashTime: 0.32,
  dashCooldown: 1.6,
  invulnerable: 1.5,
};

export const LIVES = 3;

/** Bank this many points to light the beacon and win the run. */
export const WIN_SCORE = 800;

/** A mote is one unit of carried light. */
export const MOTE = {
  radius: 9,
  fallSpeed: 55,
  fallJitter: 35,
  sway: 26,
  interval: 1.1,
  minInterval: 0.5,
  carryMax: 6,
  bankPoints: 5,
};

/** A storm shard hurts on touch, unless the skiff is dashing through it. */
export const SHARD = {
  minRadius: 12,
  maxRadius: 20,
  speed: 110,
  speedPerLevel: 16,
  interval: 2.4,
  minInterval: 0.7,
  shatterPoints: 5,
};

/** Seconds of play per level, and the last level: speeds and spawn rates stop growing there. */
export const LEVEL = { seconds: 25, max: 10 };

export const COMBO_MAX = 5;

/** How many motes, shards and particles can exist at once; the pools are allocated once. */
export const POOL = { motes: 48, shards: 40, particles: 160, texts: 12 };

export const PALETTE = {
  skyTop: '#0b1030',
  skyMid: '#14204d',
  skyBottom: '#0a2a33',
  auroraGreen: '#3ef2a0',
  auroraTeal: '#37c8e8',
  auroraViolet: '#9a6bff',
  star: '#dfe8ff',
  beacon: '#ffd166',
  beaconRing: '#ffe9a8',
  mote: '#7df9d8',
  moteCore: '#eafff6',
  shard: '#ff5d73',
  shardDark: '#8f1d2e',
  skiff: '#8ef1ff',
  skiffDark: '#1e6f8e',
  panel: 'rgba(10, 16, 38, 0.82)',
  panelEdge: '#3a4a7a',
  text: '#f2f6ff',
  muted: '#9aa8c7',
  gold: '#ffd166',
  danger: '#ff5d73',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-drift.best';

/** Rank titles shown on the end screens, by banked score. */
export const RANKS = [
  { at: 0, name: 'Drifter' },
  { at: 100, name: 'Light Gatherer' },
  { at: 200, name: 'Beacon Keeper' },
  { at: 300, name: 'Aurora Master' },
];
