import { S } from '../app/state.js';

// ---------- sound ----------
export let ac = null, amb = null;
export function audio() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); return ac; }
export const SCALE = [0, 2, 4, 7, 9];
export function pluck(level, erase = false, gain = 1) {
  if (!S.soundOn) return;
  try {
    const a = audio(), t = a.currentTime;
    const note = erase ? -12 : SCALE[level % 5] + 12 * Math.floor(level / 5) + (Math.random() < 0.5 ? 0 : 12);
    const f = 261.6 * Math.pow(2, note / 12);
    const g = a.createGain(), lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = erase ? 900 : 3200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((erase ? 0.18 : 0.13) * gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (erase ? 0.25 : 0.6));
    for (const [type, mult, vol] of [['triangle', 1, 1], ['sine', 2, 0.35]]) {
      const o = a.createOscillator(), og = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f * mult, t);
      if (erase) o.frequency.exponentialRampToValueAtTime(f * mult * 0.6, t + 0.2);
      og.gain.value = vol;
      o.connect(og).connect(lp);
      o.start(t); o.stop(t + 0.65);
    }
    lp.connect(g).connect(a.destination);
  } catch (e) {}
}
// a quiet three-note shimmer when a block lands
export function chime() {
  if (!S.soundOn) return;
  try {
    const a = audio();
    [1568, 2093, 2637].forEach((f, i) => {
      const t = a.currentTime + 0.05 + i * 0.045, o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.028, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g).connect(a.destination);
      o.start(t); o.stop(t + 0.6);
    });
  } catch (e) {}
}
// a soft dusty poof when something is removed
export function poof() {
  if (!S.soundOn) return;
  try {
    const a = audio(), t = a.currentTime, len = Math.floor(a.sampleRate * 0.3);
    const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = a.createBufferSource(), lp = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 700; g.gain.value = 0.22;
    src.connect(lp).connect(g).connect(a.destination);
    src.start(t);
  } catch (e) {}
}
export function startAmbient() {
  if (amb || !S.soundOn) return;
  try {
    const a = audio(), len = a.sampleRate * 3, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 4; }
    const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = a.createGain(); g.gain.value = 0.05;
    const lfo = a.createOscillator(), lg = a.createGain();
    lfo.frequency.value = 0.12; lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(g).connect(a.destination);
    src.start(); lfo.start();
    amb = g;
  } catch (e) {}
}
