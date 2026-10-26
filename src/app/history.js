import { blocks, setBlocks } from '../core/model.js';
import { GRID_SEED, HEX_N } from '../core/palette.js';
import { pluck } from '../fx/sound.js';
import { rebuild } from '../render/town.js';

export let undoStack = [], redoStack = [];
export function refreshHistoryButtons() {
  document.getElementById('undo').disabled = undoStack.length === 0;
  document.getElementById('redo').disabled = redoStack.length === 0;
}
// ---------- persistence & history ----------
export const STORE = 'pastel-harbour-v4';
export const snapshot = () => JSON.stringify([...blocks]);
export function save() { try { localStorage.setItem(STORE, JSON.stringify({ grid: GRID_SEED, n: HEX_N, blocks: [...blocks] })); } catch (e) {} }
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s && s.grid === GRID_SEED && s.n === HEX_N && s.blocks.length) return new Map(s.blocks);
  } catch (e) {}
  return null;
}
export function commit(fn) {
  undoStack.push(snapshot());
  if (undoStack.length > 150) undoStack.shift();
  redoStack = [];
  fn(); save(); rebuild(); refreshHistoryButtons();
}
export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  setBlocks(new Map(JSON.parse(undoStack.pop())));
  save(); rebuild(); refreshHistoryButtons(); pluck(0, true);
}
export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  setBlocks(new Map(JSON.parse(redoStack.pop())));
  save(); rebuild(); refreshHistoryButtons(); pluck(2);
}
