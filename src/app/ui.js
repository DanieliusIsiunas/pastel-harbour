import { commit, redo, undo } from './history.js';
import { updateGhost } from './input.js';
import { colorForPlacement, resetGhost } from './picking.js';
import { sampleTown } from './sample.js';
import { S } from './state.js';
import { blocks, setBlocks } from '../core/model.js';
import { PALETTE } from '../core/palette.js';
import { amb, pluck, startAmbient } from '../fx/sound.js';
import { cycleTime } from '../render/time.js';

// ---------- UI ----------
export const swWrap = document.getElementById('swatches');
export function addSwatch(value, label, cls, bg) {
  const s = document.createElement('button');
  s.className = 'sw' + (cls ? ' ' + cls : '');
  s.id = 'sw-' + label.toLowerCase();
  s.setAttribute('role', 'radio');
  s.setAttribute('aria-label', label);
  s.title = label;
  if (bg) s.style.background = bg;
  s.addEventListener('click', () => {
    S.colorChoice = value;
    S.nextMixed = colorForPlacement();
    swWrap.querySelectorAll('.sw').forEach(n => n.setAttribute('aria-checked', String(n === s)));
    setMode('build');
  });
  s.setAttribute('aria-checked', String(value === S.colorChoice));
  swWrap.appendChild(s);
}
addSwatch('mixed', 'Mixed', 'mixed');
PALETTE.forEach(p => addSwatch(p.wall, p.name, '', p.wall));

export function setMode(m) {
  S.mode = m;
  document.getElementById('m-build').setAttribute('aria-pressed', String(m === 'build'));
  document.getElementById('m-erase').setAttribute('aria-pressed', String(m === 'erase'));
  resetGhost(); updateGhost();
}
document.getElementById('m-build').onclick = () => setMode('build');
document.getElementById('m-erase').onclick = () => setMode('erase');
document.getElementById('undo').onclick = undo;
document.getElementById('redo').onclick = redo;
document.getElementById('time').onclick = cycleTime;
document.getElementById('sample').onclick = () => {
  commit(() => { setBlocks(sampleTown((Math.random() * 1e9) | 0)); });
  pluck(4); setTimeout(() => pluck(7), 90); setTimeout(() => pluck(9), 180);
};
export const clearBtn = document.getElementById('clear');
export let clearTimer = null;
clearBtn.onclick = () => {
  if (!clearTimer) {
    clearBtn.textContent = 'Tap again to clear';
    clearBtn.classList.add('warn');
    clearTimer = setTimeout(() => { clearBtn.textContent = 'Clear'; clearBtn.classList.remove('warn'); clearTimer = null; }, 2500);
    return;
  }
  clearTimeout(clearTimer); clearTimer = null;
  clearBtn.textContent = 'Clear'; clearBtn.classList.remove('warn');
  commit(() => blocks.clear());
};
export const soundBtn = document.getElementById('sound');
soundBtn.onclick = () => {
  S.soundOn = !S.soundOn;
  soundBtn.textContent = S.soundOn ? 'Sound on' : 'Sound off';
  soundBtn.setAttribute('aria-pressed', String(S.soundOn));
  if (amb) amb.gain.value = S.soundOn ? 0.05 : 0;
  if (S.soundOn) startAmbient();
};
