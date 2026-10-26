import { VERTS, generateGrid, vFixed } from '../core/grid.js';
import { blocks, keyOf, parseKey, setBlocks } from '../core/model.js';
import { GRID_SEED, GRID_VERSION, HEX_N, TRI_SIDE } from '../core/palette.js';
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
export function save() { try { localStorage.setItem(STORE, JSON.stringify({ grid: GRID_SEED, n: HEX_N, v: GRID_VERSION, blocks: [...blocks] })); } catch (e) {} }
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!(s && s.grid === GRID_SEED && s.n === HEX_N && s.blocks.length)) return null;
    return (s.v || 1) === GRID_VERSION ? new Map(s.blocks) : migrate(s.blocks, s.v || 1);
  } catch (e) {}
  return null;
}
// a town saved on an older grid moves to the current one: each occupied old corner is matched to its own
// nearby new corner, closest pairs first, and takes its whole column along (the grids differ only in how
// triangles were paired, so the town keeps its shape)
function migrate(list, version) {
  const old = generateGrid(GRID_SEED, HEX_N, TRI_SIDE, version).V, cols = new Map();
  for (const [k, b] of list) { const [v, y] = parseKey(k); if (old[v]) (cols.get(v) || cols.set(v, []).get(v)).push([y, b]); }
  const pairs = [];
  for (const v of cols.keys()) for (let n = 0; n < VERTS.length; n++) {
    if (vFixed[n]) continue;
    const d = Math.hypot(VERTS[n][0] - old[v][0], VERTS[n][1] - old[v][1]);
    if (d < 1.5) pairs.push([d, v, n]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const from = new Set(), to = new Set(), out = new Map();
  for (const [, v, n] of pairs) {
    if (from.has(v) || to.has(n)) continue;
    from.add(v); to.add(n);
    for (const [y, b] of cols.get(v)) out.set(keyOf(n, y), b);
  }
  return out.size ? out : null;
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
