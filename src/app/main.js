import { load, refreshHistoryButtons } from './history.js';
import { animateGhost } from './picking.js';
import { sampleTown } from '../core/sample.js';
import { busy } from '../core/env.js';
import { setBlocks } from '../core/model.js';
import { animateFolk } from '../fx/folk.js';
import { animateLife } from '../fx/life.js';
import { updateFx } from '../fx/particles.js';
import { foamMat } from '../render/materials.js';
import { renderFrame } from '../render/post.js';
import { animateWater, consumeShadows, controls, renderer, sun } from '../render/stage.js';
import { directCamera, fitClipPlanes, steerCamera } from '../render/director.js';
import { heldArrows } from './input.js';
import { cur, timeBusy, updateTime } from '../render/time.js';
import { animateRipple, rebuild, ripple } from '../render/town.js';

// Pastel Harbour: wires the modules together and runs the frame loop.
import './ui.js';
import './input.js';
import './dev.js';

function tick(now) {
  const t = now / 1000;
  updateTime(now);
  animateWater(t);
  foamMat.opacity = cur.foam + Math.sin(t * 1.4) * 0.12;
  animateLife(t);
  const dt = Math.min(0.05, (now - (tick.last || now)) / 1000);
  tick.last = now;
  animateRipple(now, dt);
  animateFolk(dt, Math.min(1, cur.glow / 1.7));
  updateFx(dt);
  animateGhost(dt, t);
  busy.anim = ripple.length > 0 || timeBusy();
  controls.update();
  const keys = heldArrows();
  steerCamera(keys.turn, keys.zoom, dt);
  directCamera(dt);
  fitClipPlanes();
  sun.target.position.set(0, 0, 0);
  if (consumeShadows() || busy.anim) renderer.shadowMap.needsUpdate = true;
  renderFrame(cur.sunI);
  requestAnimationFrame(tick);
}

setBlocks(load() || sampleTown(20261025));
rebuild();
refreshHistoryButtons();
requestAnimationFrame(tick);
