import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { lowPower } from '../core/env.js';
import { fxMat } from '../fx/particles.js';
import { WINFX } from './materials.js';
import { camera, renderer, scene, sun } from './stage.js';

// ---------- post-processing ----------
export const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true });
export const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
// soft contact shadows in the creases: roof against wall, wall against street, under eaves and arches
export let gtao = null;
if (!lowPower) {
  gtao = new GTAOPass(scene, camera, 1, 1);
  const hideAll = gtao.overrideVisibility.bind(gtao);
  gtao.overrideVisibility = () => { hideAll(); for (const m of WINFX) m.visible = false; };
  gtao.blendIntensity = 0.6;
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.3, thickness: 1.2, scale: 1.0, samples: 10 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
  composer.addPass(gtao);
}
// ink: screen-space outlines from the AO pass's depth and normal buffers, so the cost does not grow
// with the town. Lines appear where depth jumps (silhouettes) or the surface turns (creases).
export let ink = null;
if (gtao) {
  ink = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, tNormal: { value: gtao.normalTexture }, tDepth: { value: gtao.depthTexture },
      resolution: { value: new THREE.Vector2(1, 1) }, cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
      inkColor: { value: new THREE.Color('#2a2430') }, strength: { value: 0.45 },
      proj: { value: new THREE.Matrix4() }, projInv: { value: new THREE.Matrix4() }, lightView: { value: new THREE.Vector3(0, 1, 0) }, contactStrength: { value: 0.18 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `#include <packing>
uniform sampler2D tDiffuse; uniform sampler2D tNormal; uniform sampler2D tDepth;
uniform vec2 resolution; uniform float cameraNear; uniform float cameraFar; uniform vec3 inkColor; uniform float strength;
uniform mat4 proj; uniform mat4 projInv; uniform vec3 lightView; uniform float contactStrength;
vec3 viewPos(vec2 uv) { vec4 v = projInv * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
// short screen-space ray march toward the sun: small things (sills, cornices, chimneys) cast crisp shadows
float contact(vec2 uv, vec3 n) {
  if (dot(n, lightView) < 0.05) return 0.0;
  vec3 p = viewPos(uv) + n * 0.01;
  for (int i = 1; i <= 6; i++) {
    vec3 q = p + lightView * (0.05 * float(i));
    vec4 c = proj * vec4(q, 1.0);
    vec2 s = c.xy / c.w * 0.5 + 0.5;
    if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return 0.0;
    float dz = viewPos(s).z - q.z;
    if (dz > 0.008 && dz < 0.25) return 1.0;
  }
  return 0.0;
}
varying vec2 vUv;
float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  vec2 px = 1.0 / resolution;
  float d0 = viewDepth(vUv);
  vec3 n0 = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
  float e = 0.0;
  vec2 offs[4]; offs[0] = vec2(px.x, 0.0); offs[1] = vec2(-px.x, 0.0); offs[2] = vec2(0.0, px.y); offs[3] = vec2(0.0, -px.y);
  for (int i = 0; i < 4; i++) {
    float d = viewDepth(vUv + offs[i]);
    vec3 n = texture2D(tNormal, vUv + offs[i]).xyz * 2.0 - 1.0;
    e = max(e, smoothstep(0.03, 0.09, (d - d0) / d0));
    e = max(e, smoothstep(0.42, 0.7, 1.0 - dot(n, n0)));
  }
  float fade = 1.0 - smoothstep(35.0, 110.0, d0);
  c.rgb *= 1.0 - contactStrength * contact(vUv, n0) * (1.0 - smoothstep(20.0, 45.0, d0));
  // AgX is gentle on colour; give back the saturation the palette was painted with
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = max(mix(vec3(lum), c.rgb, 1.32), 0.0);
  // the line is a deeper shade of the surface it sits on, not black, the way a painter inks
  c.rgb = mix(c.rgb, c.rgb * 0.42 + inkColor * 0.12, e * strength * fade);
  gl_FragColor = c;
}`,
  });
  composer.addPass(ink);
}
export const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0.45, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

export function resize() {
  fxMat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  if (ink) ink.uniforms.resolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

export function renderFrame(sunIntensity) {
  if (ink) {
    ink.uniforms.cameraNear.value = camera.near; ink.uniforms.cameraFar.value = camera.far;
    ink.uniforms.proj.value.copy(camera.projectionMatrix);
    ink.uniforms.projInv.value.copy(camera.projectionMatrixInverse);
    ink.uniforms.lightView.value.copy(sun.position).sub(sun.target.position).normalize().transformDirection(camera.matrixWorldInverse);
    ink.uniforms.contactStrength.value = 0.18 * Math.min(1, sunIntensity / 2.4);
  }
  composer.render();
}
