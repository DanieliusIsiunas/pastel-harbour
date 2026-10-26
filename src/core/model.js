import { MAXY } from './palette.js';

// ---------- state ----------
export let blocks = new Map();              // "vertex:level" -> { c: wallHex }
export const keyOf = (v, y) => v + ':' + y;
export const has = (v, y) => v >= 0 && y >= 0 && blocks.has(keyOf(v, y));
export const parseKey = k => k.split(':').map(Number);
export function topOf(v) { let t = 0; for (let y = 1; y < MAXY; y++) if (has(v, y)) t = y; return t; }
export function setBlocks(m) { blocks = m; }
