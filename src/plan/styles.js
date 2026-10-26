import { houseOf } from './houses.js';

// ---------- house-type vocabulary ----------
// Each house type speaks its own architectural language. The planner draws a house's traits from its
// type's vocabulary; doors, windows, roofs and props are then drawn in that type's style.
export const STYLES = {
  cottage: {
    door: 'plank', win: { half: 0.075, y0: 0.42, y1: 0.72 }, pairs: 0, heads: [0, 0.3], shutters: 0.75, flowers: 0.7,
    balcony: 0, gable: [0.97, 0.9], dormers: 0.15, chimneys: 1, planters: 0.7, ivy: 0.55, shop: 0,
    roofs: ['#c95f3c', '#b9533b', '#d8723f', '#a94f45', '#8a4a2f'],
  },
  townhouse: {
    door: 'panel', win: { half: 0.085, y0: 0.36, y1: 0.78 }, pairs: 0.5, heads: [0.3, 1], shutters: 0.4, flowers: 0.45,
    balcony: 0.22, gable: [0.5, 0.45], dormers: 0.25, chimneys: 2, planters: 0.6, ivy: 0.35, shop: 0.45,
    roofs: ['#dcaa63', '#e3b672', '#cf914e', '#d8723f', '#c95f3c', '#e3824a'],
  },
  tower: {
    door: 'arched', win: { half: 0.05, y0: 0.3, y1: 0.84 }, pairs: 0, heads: [0.75, 1], shutters: 0, flowers: 0.15,
    balcony: 0.12, gable: [0, 0], dormers: 0, chimneys: 0, planters: 0.3, ivy: 0.2, shop: 0,
    roofs: ['#4f5d66', '#3d5878', '#5f8f7a', '#6a7f86'],
  },
  warehouse: {
    door: 'barn', win: { half: 0.075, y0: 0.56, y1: 0.8 }, pairs: 0.6, heads: [0, 0.35], shutters: 0.25, flowers: 0,
    balcony: 0, gable: [1, 1], dormers: 0, chimneys: 1, planters: 0, ivy: 0.45, shop: 0,
    roofs: ['#5b6670', '#4f5d66', '#6a6460', '#8a4a2f'],
  },
};
export const styleOf = v => { const h = houseOf(v); return h && h.style ? h.style : STYLES.townhouse; };
