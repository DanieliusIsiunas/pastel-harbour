import * as THREE from 'three';
import { GROUND, WATER } from '../core/dims.js';
import { VERTS } from '../core/grid.js';
import { blocks, has, parseKey } from '../core/model.js';

// ---------- N3: voxel occupancy field ----------
// The town's blocks are splatted into a coarse 3D texture and blurred. Every surface samples it a little
// way out along its normal: crowded alleys, lower floors and corners darken smoothly, and because the
// field only changes with the blocks, the shading never flickers the way screen-space AO can.
export const VOX = { res: 0.4, ox: -18, oy: 0, oz: -18, nx: 90, ny: 40, nz: 90 };
export const voxData = new Uint8Array(VOX.nx * VOX.ny * VOX.nz);
export const voxTex = new THREE.Data3DTexture(voxData, VOX.nx, VOX.ny, VOX.nz);
voxTex.format = THREE.RedFormat; voxTex.type = THREE.UnsignedByteType;
voxTex.minFilter = voxTex.magFilter = THREE.LinearFilter; voxTex.unpackAlignment = 1;
voxTex.needsUpdate = true;
export const voxUniforms = {
  tVox: { value: voxTex },
  voxOrigin: { value: new THREE.Vector3(VOX.ox, VOX.oy, VOX.oz) },
  voxSize: { value: new THREE.Vector3(VOX.nx * VOX.res, VOX.ny * VOX.res, VOX.nz * VOX.res) },
};
export const VOX_GLSL = `precision highp sampler3D;
uniform sampler3D tVox; uniform vec3 voxOrigin; uniform vec3 voxSize;
float voxAO(vec3 wp, vec3 n) {
  float o = texture(tVox, (wp + n * 0.38 - voxOrigin) / voxSize).r;
  return clamp(1.0 - 1.1 * o, 0.45, 1.0);
}`;
export function updateVoxels() {
  const { res, ox, oy, oz, nx, ny, nz } = VOX, idx = (i, j, k) => i + nx * (j + ny * k);
  let a = new Float32Array(nx * ny * nz), b = new Float32Array(nx * ny * nz);
  for (const key of blocks.keys()) {
    const [v, y] = parseKey(key), [x, z] = VERTS[v];
    const y0 = y === 0 ? WATER - 0.3 : y, y1 = y === 0 ? GROUND : y + 1 + (has(v, y + 1) ? 0 : 0.3), r = 0.62;
    const i0 = Math.max(0, Math.floor((x - r - ox) / res)), i1 = Math.min(nx - 1, Math.floor((x + r - ox) / res));
    const k0 = Math.max(0, Math.floor((z - r - oz) / res)), k1 = Math.min(nz - 1, Math.floor((z + r - oz) / res));
    const j0 = Math.max(0, Math.floor((y0 - oy) / res)), j1 = Math.min(ny - 1, Math.floor((y1 - oy) / res));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const cx = ox + (i + 0.5) * res - x, cz = oz + (k + 0.5) * res - z;
      if (cx * cx + cz * cz > r * r) continue;
      for (let j = j0; j <= j1; j++) a[idx(i, j, k)] = 1;
    }
  }
  // separable box blur, two cells each way, along x, y and z
  const blur = (src, dst, dim) => {
    const n = [nx, ny, nz][dim], step = [1, nx, nx * ny][dim];
    const lines = nx * ny * nz / n;
    for (let l = 0; l < lines; l++) {
      let base;
      if (dim === 0) base = l * nx;
      else if (dim === 1) base = (l % nx) + Math.floor(l / nx) * nx * ny;
      else base = l;
      for (let t = 0; t < n; t++) {
        let sum = 0, cnt = 0;
        for (let q = -2; q <= 2; q++) { const u = t + q; if (u >= 0 && u < n) { sum += src[base + u * step]; cnt++; } }
        dst[base + t * step] = sum / 5;
      }
    }
  };
  blur(a, b, 0); blur(b, a, 1); blur(a, b, 2);
  for (let i = 0; i < voxData.length; i++) voxData[i] = Math.min(255, b[i] * 300);
  voxTex.needsUpdate = true;
}

// materials for the baked town
