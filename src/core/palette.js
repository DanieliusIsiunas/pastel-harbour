import { lin } from './util.js';

// ---------- palette ----------
export const PALETTE = [
  { name: 'Rose',   wall: '#e8a3a0', roof: '#8e4b55' },
  { name: 'Sand',   wall: '#f2d0a4', roof: '#b5563f' },
  { name: 'Butter', wall: '#f5e6b8', roof: '#c0654a' },
  { name: 'Mint',   wall: '#a8d5ba', roof: '#3f6b66' },
  { name: 'Sky',    wall: '#9cc5e3', roof: '#3d5878' },
  { name: 'Lilac',  wall: '#c7b3e6', roof: '#5b4a7a' },
  { name: 'Chalk',  wall: '#f4f1ec', roof: '#4f5d66' },
  { name: 'Ochre',  wall: '#e9b872', roof: '#8a4a2f' },
];
export const ROOF_OF = Object.fromEntries(PALETTE.map(p => [p.wall, p.roof]));
export const C = {
  stone: '#b9b2a6', stoneLip: '#ddd6ca', trim: '#fbf8f2', glass: '#41546b', wood: '#6b4a3a',
  flat: '#d9cdbd', leaf: '#7aa862', grass: '#9cc97a', foam: '#ffffff', gold: '#e9c46a', lamp: '#fff1c4',
};

export const GRID_SEED = 1337, GRID_VERSION = 2, HEX_N = 8, TRI_SIDE = 2, MAXY = 14;

export const SHUTTERS = ['#5f7f6a', '#4f6d8a', '#8a5a4a', '#6b5b7a', '#3f6b66', '#7a8f9e'];
export const PAVERS = ['#ddd5c7', '#d2c9b9', '#e4dccd', '#cbc2b1', '#d8cfbf'];
export const LEAVES = ['#6f9e5c', '#5f8f4e', '#7fae63', '#88b86a', '#679a57'];
export const BLOOMS = ['#f2a7b5', '#fbe7a1', '#f4f1ec', '#e8a3a0', '#c7b3e6', '#f6c28b'];
export const ROOF_TONES = ['#dcaa63', '#e3b672', '#cf914e', '#d8723f', '#c95f3c', '#b9533b', '#e3824a', '#a94f45', '#d9a35f', '#c4683f'];
export const IRON2 = '#4c535b';
export const IRON = lin('#4a5058');
