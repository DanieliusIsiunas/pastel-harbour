import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { C } from '../core/palette.js';
import { VOX_GLSL, voxUniforms } from './voxels.js';

export const mainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
// painted materials: brick, tile and stone patterns are drawn from world position, each unit with
// its own slight shift in tone and hue so surfaces look hand-made rather than flat
mainMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, voxUniforms);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float kind;\nvarying float vKind;\nvarying vec3 vWP;\nvarying vec3 vWN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKind = kind;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
varying float vKind;
varying vec3 vWP;
varying vec3 vWN;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
${VOX_GLSL}
vec3 paint(vec3 base) {
  if (vKind < 0.5) return base;
  if (vKind > 3.5) return base * 0.88;   // mortar behind instanced bricks
  vec3 n = normalize(vWN);
  vec2 sz; vec2 q;
  if (vKind < 1.5) { sz = vec2(0.23, 0.105); q = vec2(vWP.x * n.z - vWP.z * n.x, vWP.y); }
  else if (vKind < 2.5) {
    vec3 hz = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-4, 0.0, 0.0));
    sz = vec2(0.15, 0.07); q = vec2(dot(vWP, hz), vWP.y);
  } else { sz = vec2(0.34, 0.15); q = vec2(vWP.x * n.z - vWP.z * n.x, vWP.y); }
  float row = floor(q.y / sz.y);
  float u = q.x / sz.x + 0.5 * mod(row, 2.0) + 0.17 * h21(vec2(row, vKind));
  vec2 id = vec2(floor(u), row);
  vec2 fr = vec2(fract(u), fract(q.y / sz.y));
  float r = h21(id + vKind * 17.0);
  vec3 tint = vec3(h21(id + 3.1), h21(id + 5.7), h21(id + 9.3)) - 0.5;
  float spread = vKind < 1.5 ? 0.26 : vKind < 2.5 ? 0.26 : 0.3;
  vec3 c = base * (1.0 - spread * 0.5 + spread * r) * (1.0 + 0.07 * tint);
  float edge = min(min(fr.x, 1.0 - fr.x) * sz.x, min(fr.y, 1.0 - fr.y) * sz.y);
  if (vKind > 1.5 && vKind < 2.5) {
    // tiles: a shadowed lower lip on every course and a fine gap between tiles
    c *= mix(0.74, 1.0, smoothstep(0.0, 0.3, fr.y));
    c *= mix(0.86, 1.0, smoothstep(0.002, 0.006, min(fr.x, 1.0 - fr.x) * sz.x));
  } else {
    c *= mix(0.9, 1.0, smoothstep(0.002, 0.006, edge));
  }
  // a little extra saturation keeps the pastels lively under filmic tone mapping
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return mix(vec3(l), c, 1.18);
}`)
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = paint(diffuseColor.rgb) * voxAO(vWP, normalize(vWN));');
};
export const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#41546b', roughness: 0.4, emissive: '#ffb04a', emissiveIntensity: 0 });
export const darkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
export const foamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false });
export const maskMat = new THREE.MeshBasicMaterial({
  colorWrite: false, depthWrite: false,
  stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
});
export const roomMat = (hex) => new THREE.MeshBasicMaterial({
  vertexColors: true, color: hex, side: THREE.BackSide, depthWrite: false, depthFunc: THREE.AlwaysDepth,
  stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc,
  stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
});
export const roomLitMat = roomMat('#3a4658'), roomDarkMat = roomMat('#2b3443');
export const brickMat = new THREE.MeshStandardMaterial({ roughness: 0.84, metalness: 0 });
brickMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, voxUniforms);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 bwp = vec4(transformed, 1.0); vec3 bn = objectNormal;
#ifdef USE_INSTANCING
bwp = instanceMatrix * bwp; bn = mat3(instanceMatrix) * bn;
#endif
vWP = (modelMatrix * bwp).xyz; vWN = normalize(mat3(modelMatrix) * bn);`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + VOX_GLSL)
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= voxAO(vWP, normalize(vWN));');
};
export const MATS = { main: mainMat, lit: litMat, dark: darkMat, foam: foamMat, mask: maskMat, roomLit: roomLitMat, roomDark: roomDarkMat };
// a chamfered unit cube: the hull of each corner pulled in along its three axes
export const BRICK_GEO = (() => {
  const b = 0.22, pts = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    pts.push(new THREE.Vector3(x * (1 - b), y, z).multiplyScalar(0.5), new THREE.Vector3(x, y * (1 - b), z).multiplyScalar(0.5), new THREE.Vector3(x, y, z * (1 - b)).multiplyScalar(0.5));
  }
  const g = new ConvexGeometry(pts);
  g.computeVertexNormals();
  return g;
})();
// window cut-outs and bricks stay out of the reflection and the AO normal pass
export const WINFX = new Set();

export const treeGeo = new THREE.IcosahedronGeometry(1, 1);
export const treeMat = new THREE.MeshStandardMaterial({ color: C.leaf, roughness: 0.9, flatShading: true });
