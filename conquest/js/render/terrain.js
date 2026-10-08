// Bakes the painted terrain texture, the smoothed 2x province-id texture and depth maps.
import { BIOME, tracePath } from '../world/mapgen.js';
import { GEO } from '../../data/geo.js';
import { fbm, hash2, clamp } from '../util.js';

export const UP = 2; // province texture upsampling factor

const BC = {
  [BIOME.FARM]: [150, 160, 86], [BIOME.PLAINS]: [138, 154, 84], [BIOME.FOREST]: [70, 104, 52], [BIOME.TAIGA]: [56, 86, 58],
  [BIOME.HILLS]: [136, 130, 84], [BIOME.MOUNT]: [128, 118, 102], [BIOME.MARSH]: [86, 104, 72], [BIOME.STEPPE]: [182, 168, 104],
  [BIOME.DESERT]: [216, 190, 136], [BIOME.LAKE]: [60, 100, 130], [BIOME.SEA]: [30, 70, 100],
};

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
      let k = 1 + n * 0.22 + n2 * 0.18;
      if (b === BIOME.FARM) {
        // patchwork of fields
        const h = hash2(Math.floor(x / 2.2), Math.floor(y / 2.2), 9);
        k *= 0.9 + h * 0.22;
        if (h > 0.75) { r += 22; g += 14; bl -= 6; }
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
      const hx = (height[Math.min(i + 1, W * H - 1)] - height[Math.max(i - 1, 0)]) / 3500;
      const hy = (height[Math.min(i + W, W * H - 1)] - height[Math.max(i - W, 0)]) / 3500;
      const nx = -hx, ny = 1, nz = -hy, nl = Math.hypot(nx, ny, nz);
      const sh = clamp((nx * sun[0] + ny * sun[1] + nz * sun[2]) / nl, 0, 1);
      const shade = 0.62 + sh * 0.55;
      r *= shade; g *= shade; bl *= shade;
    } else if (land[i] === 2) { r = 60; g = 100; bl = 128; }
    else {
      const dep = clamp(-height[i] / 2000, 0, 1);
      r = 70 - dep * 50; g = 120 - dep * 70; bl = 130 - dep * 60;
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
  const tex = new Uint8Array(W2 * H2 * 4);
  for (let i = 0; i < W2 * H2; i++) {
    const id = sm[i] + 1;
    tex[i * 4] = id & 255; tex[i * 4 + 1] = (id >> 8) & 255; tex[i * 4 + 2] = sm[i] >= map.L ? 255 : 0; tex[i * 4 + 3] = 255;
  }
  return { ids: sm, tex, W2, H2 };
}

export function depthTexture(map) {
  const { W, H, height, land } = map;
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = land[i] === 1 ? 0 : land[i] === 2 ? 0.15 : clamp(-height[i] / 1800, 0.02, 1);
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
