// Bakes the painted terrain texture, the smoothed 2x province-id texture and depth maps.
import { BIOME, tracePath } from '../world/mapgen.js';
import { GEO } from '../../data/geo.js';
import { fbm, hash2, clamp } from '../util.js';
import { paintSymbols } from './symbols.js';

export const UP = 2; // province texture upsampling factor

const BC = {
  [BIOME.FARM]: [150, 162, 92], [BIOME.PLAINS]: [112, 148, 82], [BIOME.FOREST]: [70, 108, 58], [BIOME.TAIGA]: [50, 84, 62],
  [BIOME.HILLS]: [140, 132, 80], [BIOME.MOUNT]: [136, 124, 108], [BIOME.MARSH]: [80, 108, 74], [BIOME.STEPPE]: [188, 170, 100],
  [BIOME.DESERT]: [222, 192, 130], [BIOME.LAKE]: [60, 100, 130], [BIOME.SEA]: [30, 70, 100],
};

// Sea heights blurred so isolated shallow pixels don't show up as diamond-shaped bilinear patches.
function smoothSea(map) {
  if (map._seaSm) return map._seaSm;
  const { W, H, height, land } = map;
  let a = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = land[i] === 1 ? 0 : height[i];
  for (let pass = 0; pass < 3; pass++) {
    const b = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let t = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        t += a[yy * W + xx]; n++;
      }
      b[y * W + x] = t / n;
    }
    a = b;
  }
  // open sea far from any coast is flat deep water: underwater bumps there only read as noise
  let m = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) m[i] = land[i] === 1 ? 1 : 0;
  for (let pass = 0; pass < 4; pass++) {
    const b = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let t = 0, n = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        t += m[yy * W + xx]; n++;
      }
      b[y * W + x] = t / n;
    }
    m = b;
  }
  for (let i = 0; i < W * H; i++) { const c = clamp(m[i] * 7, 0, 1); a[i] = a[i] * c - 1500 * (1 - c); }
  return (map._seaSm = a);
}

export function bakeTerrain(map) {
  const { W, H, biome, height, land, dist, aridity } = map;
  const img = new ImageData(W, H);
  const d = img.data;
  const sun = [-0.55, 0.65, -0.52];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, b = biome[i];
    let [r, g, bl] = BC[b] || BC[BIOME.PLAINS];
    if (land[i] === 1) {
      const e = height[i];
      const n = fbm(x / 9, y / 9, 3, 51) - 0.5, n2 = fbm(x / 40, y / 40, 3, 52) - 0.5;
      let k = 1 + n * 0.26 + n2 * 0.2;
      // fine grain + patches of a second tone per biome (meadow/forest floor/scrub/tundra moss)
      const grain = hash2(x, y, 77) - 0.5, patch = fbm(x / 14 + 7, y / 14 - 3, 2, 61) - 0.5;
      k += grain * 0.04;
      if (b === BIOME.FOREST || b === BIOME.TAIGA) { r += patch * -14; g += patch * -6; bl += patch * 10; }
      else if (b === BIOME.PLAINS) { r += patch * 22; g += patch * 10; bl -= patch * 6; }
      else if (b === BIOME.STEPPE || b === BIOME.HILLS) { r += patch * 34; g += patch * 22; bl += patch * 4; }
      const lat = map.lat?.[y] ?? 45;
      if (lat > 56 && b !== BIOME.MOUNT) { // tundra: moss and bare ground in the far north
        const t = clamp((lat - 56) / 12, 0, 0.7);
        r = r * (1 - t) + 150 * t; g = g * (1 - t) + 150 * t; bl = bl * (1 - t) + 118 * t;
      }
      if (b === BIOME.FARM) {
        // patchwork of fields
        const h = hash2(Math.floor(x / 2.2), Math.floor(y / 2.2), 9);
        k *= 0.95 + h * 0.12;
        if (h > 0.75) { r += 10; g += 6; bl -= 2; }
      }
      if (b === BIOME.DESERT) { const dn = Math.sin((x + fbm(x / 20, y / 20, 2, 3) * 40) * 0.35) * 0.04; k += dn; }
      r *= k; g *= k; bl *= k;
      // aridity browns the grass
      const a = clamp(aridity[i], 0, 1);
      if (b !== BIOME.DESERT && b !== BIOME.MOUNT) { r += a * 40; g += a * 18; bl += a * 6; }
      // rock and snow at altitude
      if (e > 900) {
        const t = clamp((e - 900) / 900, 0, 1);
        r = r * (1 - t) + 122 * t; g = g * (1 - t) + 112 * t; bl = bl * (1 - t) + 100 * t;
      }
      const snowLine = 2300 + n2 * 600 - Math.max(0, (map.lat?.[y] ?? 45) - 45) * 40;
      if (e > snowLine) { const t = clamp((e - snowLine) / 400, 0, 1); r = r * (1 - t) + 236 * t; g = g * (1 - t) + 240 * t; bl = bl * (1 - t) + 244 * t; }
      // beaches
      if (dist[i] <= 1 && e < 300 && b !== BIOME.MARSH) { r = r * 0.55 + 214 * 0.45; g = g * 0.55 + 200 * 0.45; bl = bl * 0.55 + 150 * 0.45; }
      // baked hillshade
      const hx = (height[Math.min(i + 1, W * H - 1)] - height[Math.max(i - 1, 0)]) / 2300;
      const hy = (height[Math.min(i + W, W * H - 1)] - height[Math.max(i - W, 0)]) / 2300;
      const nx = -hx, ny = 1, nz = -hy, nl = Math.hypot(nx, ny, nz);
      const sh = clamp((nx * sun[0] + ny * sun[1] + nz * sun[2]) / nl, 0, 1);
      const rel = b === BIOME.MOUNT ? 1.6 : b === BIOME.HILLS ? 1.3 : 1;
      const shade = 0.88 + (sh - 0.5) * 1.2 * rel;
      r *= shade; g *= shade; bl *= shade;
    } else if (land[i] === 2) { r = 60; g = 100; bl = 128; }
    else {
      const hs = smoothSea(map)[i], dep = clamp(-hs / 2000, 0, 1), sh = Math.pow(1 - clamp(-hs / 350, 0, 1), 2);
      r = 70 - dep * 50; g = 120 - dep * 70; bl = 130 - dep * 60;
      // turquoise shallows hugging the coast
      r += sh * 18; g += sh * 42; bl += sh * 24;
    }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = bl; d[i * 4 + 3] = 255;
  }
  const c1 = document.createElement('canvas');
  c1.width = W; c1.height = H;
  c1.getContext('2d').putImageData(img, 0, 0);
  const c2 = document.createElement('canvas');
  c2.width = W * UP; c2.height = H * UP;
  const ctx = c2.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c1, 0, 0, W * UP, H * UP);
  // rivers as soft vector strokes
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    for (const r of GEO.rivers) {
      const w = (r.r <= 2 ? 1.6 : r.r <= 4 ? 1.15 : r.r <= 6 ? 0.85 : 0.6) * UP * 0.6;
      ctx.lineWidth = pass ? w : w + 1.2;
      ctx.strokeStyle = pass ? 'rgba(70,118,150,0.95)' : 'rgba(60,80,60,0.25)';
      ctx.beginPath(); tracePath(ctx, r.p, UP); ctx.stroke();
    }
  }
  paintSymbols(ctx, map, UP);
  return c2;
}

export function upsampleProvinces(map) {
  const { W, H, pid } = map;
  const W2 = W * UP, H2 = H * UP;
  const out = new Int32Array(W2 * H2);
  const get = (x, y) => pid[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
  for (let Y = 0; Y < H2; Y++) {
    const fy = (Y + 0.5) / UP - 0.5, y0 = Math.floor(fy), ty = fy - y0;
    for (let X = 0; X < W2; X++) {
      const fx = (X + 0.5) / UP - 0.5, x0 = Math.floor(fx), tx = fx - x0;
      const a = get(x0, y0), b = get(x0 + 1, y0), c = get(x0, y0 + 1), e = get(x0 + 1, y0 + 1);
      const wa = (1 - tx) * (1 - ty), wb = tx * (1 - ty), wc = (1 - tx) * ty, we = tx * ty;
      let best = a, bw = wa + (b === a ? wb : 0) + (c === a ? wc : 0) + (e === a ? we : 0);
      if (b !== a) { const w = wb + (c === b ? wc : 0) + (e === b ? we : 0); if (w > bw) { bw = w; best = b; } }
      if (c !== a && c !== b) { const w = wc + (e === c ? we : 0); if (w > bw) { bw = w; best = c; } }
      if (e !== a && e !== b && e !== c && we > bw) best = e;
      out[Y * W2 + X] = best;
    }
  }
  // majority smoothing rounds off staircase corners
  const sm = new Int32Array(out);
  for (let Y = 1; Y < H2 - 1; Y++) for (let X = 1; X < W2 - 1; X++) {
    const i = Y * W2 + X, c = out[i];
    if (out[i - 1] === c && out[i + 1] === c && out[i - W2] === c && out[i + W2] === c) continue;
    const nb = [out[i - 1], out[i + 1], out[i - W2], out[i + W2], out[i - W2 - 1], out[i - W2 + 1], out[i + W2 - 1], out[i + W2 + 1]];
    let same = 0;
    for (const v of nb) if (v === c) same++;
    if (same <= 2) {
      const cnt = new Map();
      for (const v of nb) cnt.set(v, (cnt.get(v) || 0) + 1);
      let bv = c, bc = 0;
      for (const [v, k] of cnt) if (k > bc) { bc = k; bv = v; }
      if (bc >= 5) sm[i] = bv;
    }
  }
  return { ids: sm, W2, H2 };
}

// Smooth province edges. For every pixel near a boundary, blur each nearby province's indicator with a Gaussian
// (sigma 1.2 px) and take the two strongest: the line between them is where their scores are equal, and its signed
// distance / direction follow analytically from the scores and their gradients. The shader rebuilds an
// anti-aliased line of constant screen width from (distance, direction) plus the pixel offset, so province lines and
// colour edges are smooth curves at any zoom instead of raster stair-steps.
export function buildEdgeField(map) {
  const { W, H, pid } = map;
  const N = W * H, R = 3, SIG = 1.2, inv2 = 1 / (2 * SIG * SIG), invS2 = 1 / (SIG * SIG);
  const lab = new Int32Array(N);
  for (let i = 0; i < N; i++) lab[i] = pid[i] + 1;       // 0 = outside any province
  const bnd = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, c = lab[i];
    if (x + 1 < W && lab[i + 1] !== c) bnd[i] = bnd[i + 1] = 1;
    if (y + 1 < H && lab[i + W] !== c) bnd[i] = bnd[i + W] = 1;
  }
  const t1 = new Uint8Array(N), near = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bnd[y * W + x]) for (let k = Math.max(0, x - R); k <= Math.min(W - 1, x + R); k++) t1[y * W + k] = 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t1[y * W + x]) for (let k = Math.max(0, y - R); k <= Math.min(H - 1, y + R); k++) near[k * W + x] = 1;
  const taps = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const r2 = dx * dx + dy * dy;
    if (r2 <= (R + 0.3) * (R + 0.3)) { const w = Math.exp(-r2 * inv2); taps.push([dx, dy, w, dx * w * invS2, dy * w * invS2]); }
  }
  const tex = new Uint8Array(N * 4), edge = new Uint8Array(N * 4);
  const ids = new Int32Array(8), S = new Float32Array(8), GX = new Float32Array(8), GY = new Float32Array(8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, o4 = i * 4, own = lab[i];
    let other = 0, d = 4, nx = 0, ny = 0;
    if (near[i]) {
      let n = 0;
      for (let k = 0; k < taps.length; k++) {
        const t = taps[k], xx = x + t[0], yy = y + t[1];
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const v = lab[yy * W + xx];
        let j = 0;
        while (j < n && ids[j] !== v) j++;
        if (j === n) { if (n >= 8) continue; ids[n] = v; S[n] = 0; GX[n] = 0; GY[n] = 0; n++; }
        S[j] += t[2]; GX[j] += t[3]; GY[j] += t[4];
      }
      let a = -1, b = -1;
      for (let j = 0; j < n; j++) { if (ids[j] === own) a = j; else if (b < 0 || S[j] > S[b]) b = j; }
      if (a >= 0 && b >= 0) {
        other = ids[b];
        const g = S[a] - S[b], gx = GX[a] - GX[b], gy = GY[a] - GY[b], gl = Math.hypot(gx, gy);
        if (gl > 1e-3) { d = clamp(g / gl, -1.5, 4); nx = gx / gl; ny = gy / gl; }
      }
    }
    tex[o4] = own & 255; tex[o4 + 1] = (own >> 8) & 255; tex[o4 + 2] = other & 255; tex[o4 + 3] = (other >> 8) & 255;
    edge[o4] = Math.round((d + 2) / 8 * 255); edge[o4 + 1] = Math.round((nx * 0.5 + 0.5) * 255); edge[o4 + 2] = Math.round((ny * 0.5 + 0.5) * 255); edge[o4 + 3] = 255;
  }
  return { tex, edge, W, H };
}

export function depthTexture(map) {
  const { W, H, height, land } = map;
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = land[i] === 1 ? 0 : land[i] === 2 ? 0.15 : clamp(-smoothSea(map)[i] / 1800, 0.02, 1);
    out[i * 4] = v * 255; out[i * 4 + 3] = 255;
  }
  return out;
}

export function noiseTexture(size = 256) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // tileable by wrapping the lattice
    const v = (tileNoise(x, y, size, 8) * 0.6 + tileNoise(x, y, size, 32) * 0.4);
    const i = (y * size + x) * 4;
    out[i] = out[i + 1] = out[i + 2] = v * 255; out[i + 3] = 255;
  }
  return out;
}
function tileNoise(x, y, size, cells) {
  const fx = x / size * cells, fy = y / size * cells;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const h = (a, b) => hash2(((a % cells) + cells) % cells, ((b % cells) + cells) % cells, cells);
  const s = (t) => t * t * (3 - 2 * t);
  const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
  return a + (b - a) * s(tx) + (c - a) * s(ty) + (a - b - c + d) * s(tx) * s(ty);
}
