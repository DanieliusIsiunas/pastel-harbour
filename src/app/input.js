import { redo, undo } from './history.js';
import { act, pick, setGhost } from './picking.js';
import { S } from './state.js';
import { startAmbient } from '../fx/sound.js';
import { canvas, gridMat } from '../render/stage.js';
import { cycleTime } from '../render/time.js';

// ---------- input ----------
export let down = null, lastPointer = null, shiftHeld = false;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, b: e.button }; startAmbient(); });
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), b = down.b;
  down = null;
  if (moved > 6) return;
  act(e.clientX, e.clientY, S.mode === 'erase' || e.shiftKey || b === 2);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointermove', e => { lastPointer = { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' }; shiftHeld = e.shiftKey; updateGhost(); });
canvas.addEventListener('pointerleave', () => { lastPointer = null; setGhost(null); gridMat.uniforms.uCursor.value.set(999, 0, 999); });
addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (!mod && e.key.toLowerCase() === 't') cycleTime();
  if (e.key === 'Shift') { shiftHeld = true; updateGhost(); }
});
addEventListener('keyup', e => { if (e.key === 'Shift') { shiftHeld = false; updateGhost(); } });

export function updateGhost() {
  if (!lastPointer || lastPointer.touch || down) { setGhost(null); return; }
  const erase = S.mode === 'erase' || shiftHeld;
  setGhost(pick(lastPointer.x, lastPointer.y, erase), erase);
}
