// All drawing, and nothing else: the night sky, the aurora, the beacon, the motes, the
// shards, the skiff, the particles, the HUD and the five screens. The playfield is a fixed
// 1280x720 logical area scaled to the window, so the game looks the same at any size.
import { FIELD, PALETTE, FONT, RANKS, WIN_SCORE } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

function starField(count, seed) {
  let a = seed | 0;
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const x = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    a = (a + 0x6d2b79f5) | 0;
    t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const y = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    stars.push({ x: x * FIELD.width, y: y * FIELD.height, size: 0.6 + x * 1.8, phase: y * 6.28 });
  }
  return stars;
}

function rankFor(score) {
  let name = RANKS[0].name;
  for (const rank of RANKS) if (score >= rank.at) name = rank.name;
  return name;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const stars = starField(130, 20261117);
  const trail = [];
  let time = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || FIELD.width;
    const height = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    return dpr;
  }

  function drawGlowCircle(x, y, radius, color, alpha) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = alpha;
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawAurora() {
    context.save();
    context.globalCompositeOperation = 'lighter';
    const bands = [
      { color: PALETTE.auroraGreen, base: 150, amp: 46, speed: 0.11, alpha: 0.07 },
      { color: PALETTE.auroraTeal, base: 260, amp: 60, speed: 0.07, alpha: 0.055 },
      { color: PALETTE.auroraViolet, base: 380, amp: 52, speed: 0.09, alpha: 0.05 },
    ];
    for (const band of bands) {
      context.beginPath();
      context.moveTo(0, band.base);
      for (let x = 0; x <= FIELD.width; x += 32) {
        context.lineTo(x, band.base + Math.sin(x * 0.004 + time * band.speed * 10) * band.amp);
      }
      for (let x = FIELD.width; x >= 0; x -= 32) {
        context.lineTo(x, band.base + 90 + Math.sin(x * 0.004 + time * band.speed * 10) * band.amp);
      }
      context.closePath();
      context.globalAlpha = band.alpha;
      context.fillStyle = band.color;
      context.fill();
    }
    context.restore();
  }

  function drawBeacon(beacon, pulse) {
    const glow = 70 + Math.sin(pulse * 2.4) * 10;
    drawGlowCircle(beacon.x, beacon.y, glow + 40, PALETTE.beacon, 0.35);
    context.save();
    context.strokeStyle = PALETTE.beaconRing;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(beacon.x, beacon.y, beacon.radius, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = PALETTE.beacon;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(beacon.x, beacon.y, beacon.radius - 12, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.beacon;
    context.beginPath();
    context.arc(beacon.x, beacon.y, 10 + Math.sin(pulse * 2.4) * 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.fillStyle = PALETTE.gold;
    context.font = `700 17px ${FONT}`;
    context.textAlign = 'center';
    context.fillText('B E A C O N', beacon.x, beacon.y + beacon.radius + 24);
  }

  function drawSkiff(player, dashing) {
    // A fading trail of where the skiff has been.
    trail.push({ x: player.x, y: player.y });
    if (trail.length > 14) trail.shift();
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (let i = 0; i < trail.length; i += 1) {
      const point = trail[i];
      const alpha = (i / trail.length) * (dashing ? 0.5 : 0.25);
      drawGlowCircle(point.x, point.y, 18, PALETTE.skiff, alpha);
    }
    context.restore();
    context.save();
    context.translate(player.x, player.y);
    context.rotate(player.angle);
    if (player.invulnerable > 0 && player.dashTime <= 0 && Math.floor(time * 12) % 2 === 0) {
      context.globalAlpha = 0.35;
    }
    drawGlowCircle(0, 0, 34, dashing ? '#ffffff' : PALETTE.skiff, 0.5);
    context.fillStyle = PALETTE.skiff;
    context.beginPath();
    context.moveTo(22, 0);
    context.lineTo(-14, -13);
    context.lineTo(-7, 0);
    context.lineTo(-14, 13);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.skiffDark;
    context.beginPath();
    context.arc(2, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  /** A small heart shape, drawn (not a text glyph: headless fonts may lack it). */
  function drawHeart(x, y, size, color) {
    context.save();
    context.translate(x, y);
    context.scale(size / 10, size / 10);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, 3);
    context.bezierCurveTo(-6, -3, -11, 2, 0, 9);
    context.bezierCurveTo(11, 2, 6, -3, 0, 3);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawHud(state, best, muted) {
    const pad = 20;
    context.textBaseline = 'alphabetic';
    // Top-left: banked score and the goal.
    context.fillStyle = PALETTE.text;
    context.font = `800 34px ${FONT}`;
    context.textAlign = 'left';
    context.fillText(`${state.score}`, pad, 46);
    context.fillStyle = PALETTE.muted;
    context.font = `600 15px ${FONT}`;
    context.fillText(`GOAL ${WIN_SCORE}  •  BEST ${best}`, pad, 70);
    // Goal progress bar under the score.
    const barWidth = 190;
    const barX = pad;
    const barY = 80;
    context.fillStyle = 'rgba(255,255,255,0.14)';
    context.fillRect(barX, barY, barWidth, 8);
    context.fillStyle = PALETTE.gold;
    context.fillRect(barX, barY, barWidth * Math.min(1, state.score / WIN_SCORE), 8);
    // Top-centre: carried light as dots, and the combo.
    const dotGap = 22;
    const dotsWidth = Math.max(1, state.carried) * dotGap;
    for (let i = 0; i < state.carried; i += 1) {
      const x = FIELD.width / 2 - dotsWidth / 2 + i * dotGap + dotGap / 2;
      context.fillStyle = PALETTE.mote;
      context.beginPath();
      context.arc(x, 36, 7, 0, Math.PI * 2);
      context.fill();
    }
    if (state.carried === 0) {
      context.fillStyle = PALETTE.muted;
      context.font = `600 15px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('—', FIELD.width / 2, 42);
    }
    context.fillStyle = state.combo > 1 ? PALETTE.gold : PALETTE.muted;
    context.font = `700 17px ${FONT}`;
    context.textAlign = 'center';
    context.fillText(state.combo > 1 ? `COMBO ×${state.combo}` : 'carry light to the beacon', FIELD.width / 2, 70);
    // Top-right: lives as hearts, level, dash.
    for (let i = 0; i < state.lives; i += 1) {
      drawHeart(FIELD.width - pad - 12 - i * 30, 32, 11, PALETTE.danger);
    }
    context.fillStyle = PALETTE.text;
    context.font = `700 17px ${FONT}`;
    context.textAlign = 'right';
    context.fillText(`LEVEL ${state.level}`, FIELD.width - pad, 70);
    const dashReady = state.player.dashCooldown <= 0;
    context.fillStyle = dashReady ? PALETTE.skiff : PALETTE.muted;
    context.fillText(dashReady ? 'DASH READY' : 'dash…', FIELD.width - pad, 94);
    // Bottom hint and mute state.
    context.textAlign = 'left';
    context.fillStyle = PALETTE.muted;
    context.font = `600 14px ${FONT}`;
    context.fillText('WASD / arrows or mouse to fly  •  Space / click to dash  •  P pause  •  M sound', pad, FIELD.height - 16);
    if (muted) {
      context.textAlign = 'right';
      context.fillText('MUTED', FIELD.width - pad, FIELD.height - 16);
    }
  }

  function drawPanel(x, y, width, height) {
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, width, height, 18);
    context.fill();
    context.stroke();
  }

  function drawTitle(state, best) {
    drawPanel(290, 150, 700, 420);
    context.textAlign = 'center';
    context.fillStyle = PALETTE.auroraGreen;
    context.font = `800 64px ${FONT}`;
    context.fillText('LUMEN DRIFT', FIELD.width / 2, 240);
    context.fillStyle = PALETTE.text;
    context.font = `600 21px ${FONT}`;
    context.fillText('Gather the falling light. Bank it at the beacon. Dodge the storm.', FIELD.width / 2, 282);
    context.fillStyle = PALETTE.muted;
    context.font = `600 17px ${FONT}`;
    context.fillText('Fly with WASD, arrows or the mouse.  Space or click to dash —', FIELD.width / 2, 330);
    context.fillText(`a dash shatters storm shards.  Bank ${WIN_SCORE} light to win.`, FIELD.width / 2, 356);
    context.fillStyle = PALETTE.gold;
    context.font = `700 19px ${FONT}`;
    context.fillText(`BEST  ${best}`, FIELD.width / 2, 402);
    context.fillStyle = PALETTE.text;
    context.font = `800 24px ${FONT}`;
    const blink = Math.floor(time * 2) % 2 === 0;
    if (blink) context.fillText('PRESS SPACE OR CLICK TO START', FIELD.width / 2, 460);
    context.fillStyle = PALETTE.muted;
    context.font = `600 15px ${FONT}`;
    context.fillText('P pause  •  M sound  •  R restart', FIELD.width / 2, 520);
  }

  function drawPaused() {
    context.fillStyle = 'rgba(5, 8, 22, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textAlign = 'center';
    context.fillStyle = PALETTE.text;
    context.font = `800 52px ${FONT}`;
    context.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
    context.fillStyle = PALETTE.muted;
    context.font = `600 19px ${FONT}`;
    context.fillText('Press P or Space to keep flying', FIELD.width / 2, FIELD.height / 2 + 34);
  }

  function drawEnd(state, best, won) {
    context.fillStyle = 'rgba(5, 8, 22, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    drawPanel(340, 170, 600, 380);
    context.textAlign = 'center';
    context.fillStyle = won ? PALETTE.gold : PALETTE.danger;
    context.font = `800 46px ${FONT}`;
    context.fillText(won ? 'THE BEACON IS LIT!' : 'THE LIGHT FADES', FIELD.width / 2, 250);
    context.fillStyle = PALETTE.text;
    context.font = `700 22px ${FONT}`;
    context.fillText(won ? `You banked ${WIN_SCORE} light. The night is yours.` : 'The storm took the skiff.', FIELD.width / 2, 292);
    context.fillStyle = PALETTE.gold;
    context.font = `800 40px ${FONT}`;
    context.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 356);
    context.fillStyle = PALETTE.muted;
    context.font = `600 19px ${FONT}`;
    context.fillText(`BEST  ${best}    •    RANK  ${rankFor(state.score)}    •    LEVEL ${state.level}`, FIELD.width / 2, 396);
    context.fillStyle = PALETTE.text;
    context.font = `800 22px ${FONT}`;
    const blink = Math.floor(time * 2) % 2 === 0;
    if (blink) {
      context.fillText(
        won ? 'SPACE to keep drifting  •  R to fly again' : 'PRESS SPACE OR CLICK TO FLY AGAIN',
        FIELD.width / 2,
        470,
      );
    }
  }

  function draw(state, screen, best, muted) {
    time += 1 / 60;
    const dpr = resize();
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const offsetX = (canvas.width - FIELD.width * scale) / 2;
    const offsetY = (canvas.height - FIELD.height * scale) / 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#050816';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    // Screen shake after a hit.
    if (state.shake > 0) {
      const mag = state.shake * 7;
      context.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    // Sky.
    const sky = context.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = sky;
    context.fillRect(-10, -10, FIELD.width + 20, FIELD.height + 20);
    for (const star of stars) {
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.4 + star.phase));
      context.globalAlpha = twinkle;
      context.fillStyle = PALETTE.star;
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
    drawAurora();
    drawBeacon(state.beacon, time);
    // Motes.
    for (const mote of state.motes) {
      if (!mote.active) continue;
      const pulse = 0.75 + 0.25 * Math.sin(time * 5 + mote.spin * 10);
      drawGlowCircle(mote.x, mote.y, 26, PALETTE.mote, 0.45 * pulse);
      context.fillStyle = PALETTE.moteCore;
      context.beginPath();
      context.arc(mote.x, mote.y, mote.radius * 0.7, 0, Math.PI * 2);
      context.fill();
    }
    // Shards.
    for (const shard of state.shards) {
      if (!shard.active) continue;
      context.save();
      context.translate(shard.x, shard.y);
      context.rotate(shard.angle);
      drawGlowCircle(0, 0, shard.radius + 14, PALETTE.shard, 0.4);
      context.fillStyle = PALETTE.shardDark;
      context.strokeStyle = PALETTE.shard;
      context.lineWidth = 2;
      context.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2;
        const px = Math.cos(angle) * shard.radius;
        const py = Math.sin(angle) * shard.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }
    // Particles.
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const particle of state.particles) {
      if (!particle.active) continue;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    context.globalAlpha = 1;
    drawSkiff(state.player, state.player.dashTime > 0);
    // Floating score texts.
    context.textAlign = 'center';
    for (const text of state.texts) {
      if (!text.active) continue;
      context.globalAlpha = Math.min(1, text.life);
      context.fillStyle = text.color;
      context.font = `800 22px ${FONT}`;
      context.fillText(text.text, text.x, text.y);
    }
    context.globalAlpha = 1;
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best, muted);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawEnd(state, best, false);
    if (screen === SCREEN_WIN) drawEnd(state, best, true);
    // Bank/hit flash.
    if (state.flash > 0) {
      context.globalAlpha = state.flash * 0.5;
      context.fillStyle = state.flashColor;
      context.fillRect(-10, -10, FIELD.width + 20, FIELD.height + 20);
      context.globalAlpha = 1;
    }
    void dpr;
  }

  return { draw };
}
