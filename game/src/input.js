// Keyboard and pointer input. Held keys give a steering direction; one-shot presses (start,
// restart, dash, pause, mute) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The pointer steers too: the skiff
// flies toward the mouse while it moves.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const DASH = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false };
  const pointer = { x: null, y: null, active: false };
  let actions = 0;

  function press(code) {
    if (UP.has(code)) held.up = true;
    else if (DOWN.has(code)) held.down = true;
    else if (LEFT.has(code)) held.left = true;
    else if (RIGHT.has(code)) held.right = true;
    else if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (DASH.has(code)) actions |= ACTION_DASH;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    else if (RESTART.has(code)) actions |= ACTION_RESTART;
    else return false;
    return true;
  }

  function release(code) {
    if (UP.has(code)) held.up = false;
    else if (DOWN.has(code)) held.down = false;
    else if (LEFT.has(code)) held.left = false;
    else if (RIGHT.has(code)) held.right = false;
  }

  window.addEventListener('keydown', (event) => {
    if (press(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    release(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    pointer.active = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
    actions |= ACTION_DASH;
  });

  return {
    /** Steering direction from the keys: {x, y} each -1, 0 or 1. */
    keys() {
      return { x: (held.right ? 1 : 0) - (held.left ? 1 : 0), y: (held.down ? 1 : 0) - (held.up ? 1 : 0) };
    },
    /** Pointer position in canvas CSS pixels, or null when the mouse never moved. */
    pointer() {
      return pointer.active ? { x: pointer.x, y: pointer.y } : null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
