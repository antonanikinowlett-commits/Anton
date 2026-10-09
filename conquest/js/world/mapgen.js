// Procedural-on-real-data world builder.
// Rasterises Natural Earth coastlines/rivers and NASA elevation onto the Mercator
// raster, classifies biomes, then grows provinces from historical settlements with a
// terrain-aware multi-source Dijkstra so borders settle on rivers and ridgelines.
import { GEO } from '../../data/geo.js';
import { HEIGHT } from '../../data/height.js';
import { W, H, toXY, toLonLat, kmPerPx } from './proj.js';
import { CITIES } from '../data/cities.js';
import { NATIONS } from '../data/nations.js';
import { mulberry32, fbm, ridged, clamp, Heap } from '../util.js';
import { placeName } from '../data/names.js';

export const BIOME = { SEA: 0, LAKE: 1, FARM: 2, PLAINS: 3, FOREST: 4, TAIGA: 5, HILLS: 6, MOUNT: 7, MARSH: 8, STEPPE: 9, DESERT: 10 };
export const TERRAIN_NAMES = ['sea', 'lake', 'farmland', 'plains', 'forest', 'taiga', 'hills', 'mountains', 'marsh', 'steppe', 'desert'];

const N = W * H;
const tick = () => new Promise((r) => setTimeout(r, 0));

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function tracePath(ctx, flat, sx = 1) {
  for (let i = 0; i < flat.length; i += 2) {
    const [x, y] = toXY(flat[i], flat[i + 1]);
    if (i === 0) ctx.moveTo(x * sx, y * sx); else ctx.lineTo(x * sx, y * sx);
  }
}

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

function inBox(lon, lat, a, b, c, d) { return lon >= a && lon <= c && lat >= b && lat <= d; }

export async function generateMap(progress = () => {}) {
  const rng = mulberry32(1200);
  progress('Charting coastlines', 0.02);
  // ── 1. coast, lakes, rivers
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f00';
  for (const poly of GEO.land) {
    ctx.beginPath();
    tracePath(ctx, poly[0]); ctx.closePath();
    ctx.fill('nonzero');
  }
  ctx.fillStyle = '#000';
  for (const poly of GEO.land) for (let r = 1; r < poly.length; r++) { ctx.beginPath(); tracePath(ctx, poly[r]); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#f00';
  ctx.fillStyle = '#00f';
  for (const ring of GEO.lakes) { ctx.beginPath(); tracePath(ctx, ring); ctx.closePath(); ctx.fill(); }
  let px = ctx.getImageData(0, 0, W, H).data;
  const land = new Uint8Array(N); // 0 sea, 1 land, 2 lake
  for (let i = 0; i < N; i++) land[i] = px[i * 4 + 2] > 127 ? 2 : px[i * 4] > 120 ? 1 : 0;
  // fill pinholes left by simplified, self-touching coastlines
  {
    const seen = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (land[i] !== 0 || seen[i]) continue;
      const cells = [i]; seen[i] = 1;
      for (let h = 0; h < cells.length && cells.length < 60; h++) {
        const c = cells[h];
        for (const j of [c - 1, c + 1, c - W, c + W]) if (j >= 0 && j < N && !seen[j] && land[j] === 0) { seen[j] = 1; cells.push(j); }
      }
      if (cells.length < 60) for (const c of cells) land[c] = 1;
    }
  }

  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const r of GEO.rivers) {
    ctx.lineWidth = r.r <= 2 ? 2.2 : r.r <= 4 ? 1.6 : r.r <= 6 ? 1.2 : 0.9;
    ctx.beginPath(); tracePath(ctx, r.p); ctx.stroke();
  }
  px = ctx.getImageData(0, 0, W, H).data;
  const river = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (land[i] === 1 && px[i * 4] > 90) river[i] = 1;

  // ── 2. elevation
  progress('Raising mountains', 0.08);
  const himg = await loadImage(HEIGHT.src);
  const hmeta = HEIGHT.meta;
  const hc = canvas(hmeta.w, hmeta.h).getContext('2d', { willReadFrequently: true });
  hc.drawImage(himg, 0, 0);
  const hd = hc.getImageData(0, 0, hmeta.w, hmeta.h).data;
  const hs = (fx, fy) => {
    const x0 = clamp(Math.floor(fx), 0, hmeta.w - 2), y0 = clamp(Math.floor(fy), 0, hmeta.h - 2);
    const tx = fx - x0, ty = fy - y0;
    const g = (x, y) => hd[(y * hmeta.w + x) * 4];
    return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
  };
  const lonA = new Float32Array(W), latA = new Float32Array(H);
  for (let x = 0; x < W; x++) lonA[x] = toLonLat(x + 0.5, 0)[0];
  for (let y = 0; y < H; y++) latA[y] = toLonLat(0, y + 0.5)[1];

  // distance to coast (land→sea and sea→land), 4-neighbour BFS
  const dist = new Int16Array(N).fill(-1);
  let q = new Int32Array(N), qh = 0, qt = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, l = land[i] === 1;
    if ((land[i - 1] === 1) !== l || (land[i + 1] === 1) !== l || (land[i - W] === 1) !== l || (land[i + W] === 1) !== l) { dist[i] = 0; q[qt++] = i; }
  }
  while (qh < qt) {
    const i = q[qh++], l = land[i] === 1;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (j < 0 || j >= N || dist[j] >= 0 || (land[j] === 1) !== l) continue;
      dist[j] = dist[i] + 1; q[qt++] = j;
    }
  }
  // distance to rivers (for green river valleys in arid lands)
  const rdist = new Uint8Array(N).fill(255);
  qh = qt = 0;
  for (let i = 0; i < N; i++) if (river[i]) { rdist[i] = 0; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++];
    if (rdist[i] >= 12) continue;
    for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && rdist[j] === 255) { rdist[j] = rdist[i] + 1; q[qt++] = j; }
  }

  const height = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const lat = latA[y];
    const fy = (hmeta.lat1 - lat) / (hmeta.lat1 - hmeta.lat0) * hmeta.h;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, lon = lonA[x];
      const fx = (lon - hmeta.lon0) / (hmeta.lon1 - hmeta.lon0) * hmeta.w;
      let e = (hs(fx, fy) - 24) * 32;
      if (land[i] === 1) {
        const mount = clamp((e - 300) / 1400, 0, 1);
        e += (ridged(x / 14, y / 14, 4, 7) - 0.45) * 1300 * mount;
        e += (fbm(x / 26, y / 26, 4, 3) - 0.5) * 220;
        e = Math.max(e, 4 + Math.min(dist[i], 12) * 3);
      } else if (land[i] === 2) {
        e = Math.max(2, e - 30);
      } else {
        e = -Math.min(2600, 25 + Math.pow(Math.max(dist[i], 0), 1.25) * 22 + fbm(x / 20, y / 20, 3, 5) * 120);
      }
      height[i] = e;
    }
  }
  await tick();

  // ── 3. biomes
  progress('Sowing forests and fields', 0.16);
  const cityPx = CITIES.map(([n, lon, lat, imp]) => { const [x, y] = toXY(lon, lat); return { n, x: Math.round(x), y: Math.round(y), imp, lon, lat }; });
  const bigCities = cityPx.filter((c) => c.imp >= 2);
  const urban = new Float32Array(N); // proximity to major settlements → cultivated land
  for (const c of bigCities) {
    const R = 22 + c.imp * 6;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.hypot(dx, dy) / R;
      if (d < 1) urban[y * W + x] = Math.max(urban[y * W + x], (1 - d) * (c.imp / 3));
    }
  }
  const biome = new Uint8Array(N);
  const aridity = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const lat = latA[y];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (land[i] === 0) { biome[i] = BIOME.SEA; continue; }
      if (land[i] === 2) { biome[i] = BIOME.LAKE; continue; }
      const lon = lonA[x], e = height[i], dc = dist[i];
      // ── aridity
      let a = clamp((34.8 - lat) / 4, 0, 1);
      if (lon < 11.5 && lat > 33.5 && dc < 40) a *= 0.35; // Maghreb littoral
      if (inBox(lon, lat, 20, 32, 23, 33)) a *= 0.4; // Jebel Akhdar
      if (lon > 35.6 && lat < 37.3) a = Math.max(a, clamp((lon - 36.1) / 1.6, 0, 1) * clamp((37.3 - lat) / 2.2, 0, 1));
      if (lon > 34.2 && lat < 31.3) a = Math.max(a, 0.85);
      if (inBox(lon, lat, 38.5, 29, 48.5, 37)) a = Math.max(a, 0.7);
      if (lon > 31 && lat > 44 && lat < 51.5) a = Math.max(a, 0.42 + clamp((lon - 40) / 10, 0, 0.3) - clamp((lat - 49) / 3, 0, 0.3));
      if (lon > 44.5 && lat > 44 && lat < 49) a = Math.max(a, 0.62);
      if (inBox(lon, lat, 31, 37.4, 38.5, 40.1) && e > 750) a = Math.max(a, 0.45);
      if (inBox(lon, lat, -5.5, 38, -1.2, 42) && dc > 35) a = Math.max(a, 0.28);
      if (lon > 45.5 && lat < 36.5) a = Math.max(a, 0.55);
      if (e > 1300) a *= 0.6;
      if (rdist[i] < 12) a *= 0.25 + rdist[i] * 0.06; // irrigated river valleys (Nile, Euphrates…)
      a += (fbm(x / 22, y / 22, 3, 11) - 0.5) * 0.18;
      aridity[i] = a;
      // ── classification
      let b;
      const forestN = fbm(x / 28, y / 28, 4, 21);
      let forestP = 0.47;
      if (inBox(lon, lat, 5, 46.5, 42, 58)) forestP += 0.1;
      if (lat < 42.5) forestP -= 0.18;
      if (lat > 58) forestP += 0.18;
      forestP -= urban[i] * 0.5;
      const marshy = inBox(lon, lat, 24.3, 51.2, 30.5, 52.7) || (inBox(lon, lat, 3.3, 51.5, 7.2, 53.4) && dc < 14) ||
        inBox(lon, lat, -0.4, 52.3, 0.5, 52.9) || inBox(lon, lat, 28.6, 44.8, 29.8, 45.5) || inBox(lon, lat, 12.0, 44.7, 12.6, 45.2) ||
        inBox(lon, lat, 46.3, 30.4, 48.0, 31.6) || inBox(lon, lat, 4.2, 43.3, 4.9, 43.7) || inBox(lon, lat, 21.0, 52.0, 23.0, 53.2);
      if (e > 1250 + (lat - 45) * -12) b = BIOME.MOUNT;
      else if (a > 0.62) b = BIOME.DESERT;
      else if (a > 0.36) b = e > 600 ? BIOME.HILLS : BIOME.STEPPE;
      else if (marshy && e < 220 && fbm(x / 9, y / 9, 3, 41) > 0.38) b = BIOME.MARSH;
      else if (e > 480 + (lat - 45) * -8) b = BIOME.HILLS;
      else if (forestN < forestP) b = lat > 58.5 || (lat > 56.5 && lon > 32) ? BIOME.TAIGA : BIOME.FOREST;
      else if (urban[i] > 0.12 || (rdist[i] < 6 && a < 0.2 && lat < 56) || fbm(x / 16, y / 16, 3, 33) > 0.62 - urban[i]) b = BIOME.FARM;
      else b = lat > 60 ? BIOME.TAIGA : BIOME.PLAINS;
      biome[i] = b;
    }
  }
  await tick();

  // ── 4. province seeds
  progress('Founding settlements', 0.22);
  const seeds = []; // {x,y,city}
  const GS = 8, gw = Math.ceil(W / GS), gh = Math.ceil(H / GS);
  const grid = Array.from({ length: gw * gh }, () => []);
  const addSeed = (s) => { seeds.push(s); grid[Math.floor(s.y / GS) * gw + Math.floor(s.x / GS)].push(s); };
  const near = (x, y, r) => {
    const gx = Math.floor(x / GS), gy = Math.floor(y / GS), R = Math.ceil(r / GS);
    for (let j = Math.max(0, gy - R); j <= Math.min(gh - 1, gy + R); j++)
      for (let k = Math.max(0, gx - R); k <= Math.min(gw - 1, gx + R); k++)
        for (const s of grid[j * gw + k]) if ((s.x - x) ** 2 + (s.y - y) ** 2 < r * r) return s;
    return null;
  };
  for (const c of cityPx) {
    let best = -1, bd = 1e9;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= W || y >= H || land[y * W + x] !== 1) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = y * W + x; }
    }
    if (best < 0) continue;
    const x = best % W, y = (best / W) | 0;
    const other = near(x, y, 4);
    if (other) { if (other.city && other.city.imp < c.imp) other.city = c; continue; }
    addSeed({ x, y, city: c });
  }
  const k45 = kmPerPx(toXY(0, 45)[1]);
  const radiusAt = (i) => {
    const y = (i / W) | 0;
    const f = Math.sqrt(k45 / kmPerPx(y));
    const r = [0, 0, 10.5, 12, 13.5, 19, 13, 16, 15, 20, 30][biome[i]];
    return r * f;
  };
  const order = [];
  for (let y = 2; y < H - 2; y += 3) for (let x = 2; x < W - 2; x += 3) order.push([x + Math.floor(rng() * 3), y + Math.floor(rng() * 3)]);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const [x, y] of order) {
    const i = y * W + x;
    if (land[i] !== 1 || river[i]) continue;
    if (near(x, y, radiusAt(i))) continue;
    addSeed({ x, y, city: null });
  }
  await tick();

  // ── 5. grow provinces (multi-source Dijkstra on land)
  progress('Drawing borders', 0.3);
  const pid = new Int32Array(N).fill(-1);
  const cost = new Float64Array(N).fill(Infinity);
  const heap = new Heap(1 << 20);
  seeds.forEach((s, k) => { const i = s.y * W + s.x; cost[i] = 0; pid[i] = k; heap.push(0, i); });
  const D8 = [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [1, 1, 1.414]];
  let popped = 0;
  while (heap.n) {
    const i = heap.pop(), c = heap.lastKey;
    if (c > cost[i]) continue;
    if (++popped % 200000 === 0) { progress('Drawing borders', 0.3 + 0.25 * popped / N); await tick(); }
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy, len] of D8) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (land[j] !== 1) continue;
      const step = len * (1 + Math.abs(height[j] - height[i]) / 45 + (river[j] && !river[i] ? 9 : 0) + (biome[j] === BIOME.MOUNT ? 0.6 : 0));
      const nc = c + step;
      if (nc < cost[j]) { cost[j] = nc; pid[j] = pid[i]; heap.push(nc, j); }
    }
  }
  await tick();

  { let u = 0, ex = null; for (let i = 0; i < N; i++) if (land[i] === 1 && pid[i] < 0) { u++; if (!ex) ex = [i % W, (i / W) | 0, height[i], biome[i], river[i]]; } window.__dbg = { u, ex }; }
  // ── 6. orphan islands: create or attach
  progress('Settling islands', 0.57);
  const comp = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (land[i] !== 1 || pid[i] >= 0 || comp[i] >= 0) continue;
    const cells = [i]; comp[i] = i;
    for (let h2 = 0; h2 < cells.length; h2++) {
      const c = cells[h2];
      for (const j of [c - 1, c + 1, c - W, c + W]) if (j >= 0 && j < N && land[j] === 1 && pid[j] < 0 && comp[j] < 0) { comp[j] = i; cells.push(j); }
    }
    if (cells.length >= 14) {
      let sx = 0, sy = 0;
      for (const c of cells) { sx += c % W; sy += (c / W) | 0; }
      const cx = sx / cells.length, cy = sy / cells.length;
      let best = cells[0], bd = 1e9;
      for (const c of cells) { const d = (c % W - cx) ** 2 + (((c / W) | 0) - cy) ** 2; if (d < bd) { bd = d; best = c; } }
      const k = seeds.length;
      seeds.push({ x: best % W, y: (best / W) | 0, city: null });
      for (const c of cells) pid[c] = k;
    } else {
      for (const c of cells) { land[c] = 0; biome[c] = BIOME.SEA; height[c] = -20; }
    }
  }

  // ── 7. merge slivers into the neighbour they share most border with
  const area = new Int32Array(seeds.length);
  for (let i = 0; i < N; i++) if (pid[i] >= 0) area[pid[i]]++;
  for (let pass = 0; pass < 2; pass++) {
    const small = new Set();
    for (let k = 0; k < seeds.length; k++) if (area[k] > 0 && area[k] < 26) small.add(k);
    if (!small.size) break;
    const share = new Map();
    for (let i = 0; i < N; i++) {
      const a = pid[i];
      if (a < 0 || !small.has(a)) continue;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        const b = pid[j];
        if (b >= 0 && b !== a) { const key = a * 100000 + b; share.set(key, (share.get(key) || 0) + 1); }
      }
    }
    const target = new Map();
    for (const [key, v] of share) {
      const a = Math.floor(key / 100000), b = key % 100000;
      const t = target.get(a);
      if (!t || v > t[1]) target.set(a, [b, v]);
    }
    for (const [a, [b]] of target) {
      if (small.has(b) && area[b] <= area[a]) continue;
      const ca = seeds[a].city, cb = seeds[b].city;
      if (ca && (!cb || ca.imp > cb.imp)) seeds[b].city = ca;
      area[b] += area[a]; area[a] = 0;
      for (let i = 0; i < N; i++) if (pid[i] === a) pid[i] = b;
    }
  }
  // compact ids
  const remap = new Int32Array(seeds.length).fill(-1);
  const landSeeds = [];
  for (let k = 0; k < seeds.length; k++) if (area[k] > 0) { remap[k] = landSeeds.length; landSeeds.push(seeds[k]); }
  for (let i = 0; i < N; i++) if (pid[i] >= 0) pid[i] = remap[pid[i]];
  const L = landSeeds.length;
  await tick();

  // ── 8. sea zones
  progress('Naming the seas', 0.62);
  const seaSeeds = [];
  const sorder = [];
  for (let y = 3; y < H - 3; y += 6) for (let x = 3; x < W - 3; x += 6) sorder.push([x + Math.floor(rng() * 6) - 3, y + Math.floor(rng() * 6) - 3]);
  for (let i = sorder.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [sorder[i], sorder[j]] = [sorder[j], sorder[i]]; }
  for (const [x, y] of sorder) {
    const i = y * W + x;
    if (land[i] !== 0 || dist[i] < 4) continue;
    const r = dist[i] > 60 ? 95 : 62;
    if (seaSeeds.some((s) => (s.x - x) ** 2 + (s.y - y) ** 2 < r * r)) continue;
    seaSeeds.push({ x, y });
  }
  const sid = new Int32Array(N).fill(-1);
  qh = qt = 0;
  seaSeeds.forEach((s, k) => { const i = s.y * W + s.x; sid[i] = k; q[qt++] = i; });
  // BFS with random tie-breaking gives organic sea borders
  while (qh < qt) {
    const i = q[qh++];
    for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && land[j] === 0 && sid[j] < 0) { sid[j] = sid[i]; q[qt++] = j; }
  }
  for (let i = 0; i < N; i++) if (land[i] === 0) { if (sid[i] >= 0) pid[i] = L + sid[i]; else { land[i] = 2; biome[i] = BIOME.LAKE; } }
  const S = seaSeeds.length;
  await tick();

  // ── 9. province statistics & adjacency
  progress('Surveying provinces', 0.68);
  const T = L + S;
  const sumX = new Float64Array(T), sumY = new Float64Array(T), cnt = new Int32Array(T), sumE = new Float64Array(T);
  const bcount = Array.from({ length: L }, () => new Float32Array(11));
  const minX = new Int32Array(T).fill(W), minY = new Int32Array(T).fill(H), maxX = new Int32Array(T), maxY = new Int32Array(T);
  let riverPx = new Int32Array(L);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = pid[i];
    if (p < 0) continue;
    sumX[p] += x; sumY[p] += y; cnt[p]++; sumE[p] += height[i];
    if (x < minX[p]) minX[p] = x; if (y < minY[p]) minY[p] = y; if (x > maxX[p]) maxX[p] = x; if (y > maxY[p]) maxY[p] = y;
    if (p < L) { bcount[p][biome[i]]++; if (river[i]) riverPx[p]++; }
  }
  const edges = new Map();
  const addEdge = (a, b, isRiver, strait = false) => {
    if (a > b) [a, b] = [b, a];
    const key = a * 65536 + b;
    let e = edges.get(key);
    if (!e) { e = { a, b, len: 0, river: 0, strait }; edges.set(key, e); }
    e.len++; if (isRiver) e.river++;
  };
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const i = y * W + x, a = pid[i];
    if (a < 0) continue;
    for (const j of [i + 1, i + W]) {
      const b = pid[j];
      if (b >= 0 && b !== a) addEdge(a, b, a < L && b < L && (river[i] || river[j] || rdist[i] <= 1 || rdist[j] <= 1));
    }
  }
  // straits: short water gaps between land provinces (Dover, Messina, Bosporus, Øresund…)
  const straitPairs = new Map();
  for (let y = 2; y < H - 2; y += 1) for (let x = 2; x < W - 2; x += 1) {
    const i = y * W + x, a = pid[i];
    if (a < 0 || a >= L || dist[i] !== 0) continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]]) {
      let k = 1, crossed = false;
      for (; k <= 11; k++) {
        const nx = x + dx * k, ny = y + dy * k;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
        const j = ny * W + nx;
        if (land[j] !== 1) { crossed = true; continue; }
        const b = pid[j];
        if (crossed && b >= 0 && b < L && b !== a) {
          const key = Math.min(a, b) * 65536 + Math.max(a, b);
          if (!edges.has(key)) straitPairs.set(key, Math.min(straitPairs.get(key) || 99, k));
        }
        break;
      }
    }
  }
  for (const [key] of straitPairs) { const a = Math.floor(key / 65536), b = key % 65536; addEdge(a, b, false, true); }

  const used = new Set(CITIES.map((c) => c[0]));
  const provinces = [];
  for (let p = 0; p < T; p++) {
    const cx = sumX[p] / cnt[p], cy = sumY[p] / cnt[p];
    const sea = p >= L;
    const s = sea ? seaSeeds[p - L] : landSeeds[p];
    // anchor: settlement if present, else the province pixel nearest the centroid
    let ax = s.x, ay = s.y;
    if (!sea && !s.city) {
      let bd = 1e9;
      for (let y = minY[p]; y <= maxY[p]; y++) for (let x = minX[p]; x <= maxX[p]; x++) {
        if (pid[y * W + x] !== p) continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < bd) { bd = d; ax = x; ay = y; }
      }
    }
    const [lon, lat] = toLonLat(ax, ay);
    const pr = { id: p, sea, x: ax + 0.5, y: ay + 0.5, cx, cy, area: cnt[p], km2: Math.round(cnt[p] * kmPerPx(cy) ** 2), lon, lat,
      elev: sumE[p] / cnt[p], bbox: [minX[p], minY[p], maxX[p], maxY[p]], adj: [], seas: [], coastal: false, city: s.city ? s.city.n : null, imp: s.city ? s.city.imp : 0 };
    if (!sea) {
      const bc = bcount[p], tot = cnt[p];
      const sh = (b) => bc[b] / tot;
      let t;
      if (sh(BIOME.MOUNT) > 0.38 || pr.elev > 1300) t = BIOME.MOUNT;
      else if (sh(BIOME.DESERT) > 0.45) t = BIOME.DESERT;
      else if (sh(BIOME.MARSH) > 0.3) t = BIOME.MARSH;
      else if (sh(BIOME.HILLS) + sh(BIOME.MOUNT) > 0.4) t = BIOME.HILLS;
      else if (sh(BIOME.STEPPE) > 0.4) t = BIOME.STEPPE;
      else if (sh(BIOME.TAIGA) > 0.4) t = BIOME.TAIGA;
      else if (sh(BIOME.FOREST) + sh(BIOME.TAIGA) > 0.45) t = BIOME.FOREST;
      else if (sh(BIOME.FARM) > 0.35) t = BIOME.FARM;
      else t = BIOME.PLAINS;
      pr.terrain = TERRAIN_NAMES[t];
      pr.river = riverPx[p] / tot;
    } else pr.terrain = 'sea';
    provinces.push(pr);
  }
  for (const e of edges.values()) {
    const A = provinces[e.a], B = provinces[e.b];
    const river = !e.strait && e.river / e.len > 0.35;
    A.adj.push({ id: e.b, len: e.len, river, strait: e.strait });
    B.adj.push({ id: e.a, len: e.len, river, strait: e.strait });
    if (!A.sea && B.sea) { A.coastal = true; A.seas.push(B.id); }
    if (A.sea && !B.sea) { B.coastal = true; B.seas.push(A.id); }
  }
  await tick();

  // ── 10. starting realms (multi-source Dijkstra over the province graph)
  progress('Crowning kings', 0.76);
  const byCity = new Map();
  provinces.forEach((p) => { if (p.city) byCity.set(p.city, p.id); });
  const owner = new Int32Array(T).fill(-1);
  const ocost = new Float64Array(T).fill(Infinity);
  const ph = new Heap(4096);
  const capitals = [];
  NATIONS.forEach((n, ni) => {
    capitals[ni] = byCity.get(n.capital) ?? -1;
    for (const c of n.seeds) {
      const p = byCity.get(c);
      if (p === undefined) continue;
      owner[p] = ni; ocost[p] = 0; ph.push(0, p);
    }
  });
  const tcost = { farmland: 1, plains: 1, forest: 1.6, taiga: 1.8, hills: 1.7, mountains: 3, marsh: 2.2, steppe: 1.1, desert: 1.6, sea: 1 };
  while (ph.n) {
    const a = ph.pop(), c = ph.lastKey;
    if (c > ocost[a]) continue;
    const A = provinces[a];
    for (const e of A.adj) {
      const B = provinces[e.id];
      let step = Math.hypot(A.cx - B.cx, A.cy - B.cy);
      if (B.sea || A.sea) step = step * 2 + 40; else step *= tcost[B.terrain] + (e.river ? 0.6 : 0) + (e.strait ? 2 : 0);
      const nc = c + step;
      if (nc < ocost[e.id]) { ocost[e.id] = nc; owner[e.id] = owner[a]; ph.push(nc, e.id); }
    }
  }
  for (let p = L; p < T; p++) owner[p] = -1;

  // ── 11. culture and names
  progress('Naming the land', 0.84);
  const nrng = mulberry32(77);
  for (let p = 0; p < L; p++) {
    const pr = provinces[p];
    const n = NATIONS[owner[p]];
    pr.culture = cultureAt(pr.lon, pr.lat, n ? n.culture : 'german', n ? n.tag : '');
    pr.religion = religionAt(pr.lon, pr.lat, pr.culture, n ? n.religion : 'catholic');
    pr.name = pr.city || placeName(nrng, pr.culture, used);
  }
  const SEA_NAMES = [
    ['North Sea', 3.5, 56], ['English Channel', -2, 50.1], ['Celtic Sea', -7, 50.5], ['Irish Sea', -5, 53.8], ['Bay of Biscay', -4.5, 45.5],
    ['Cantabrian Sea', -6, 44], ['Atlantic Ocean', -10, 47], ['Hebridean Sea', -8, 57.5], ['Norwegian Sea', 3, 62.5], ['Skagerrak', 9, 57.8],
    ['Kattegat', 11.5, 56.8], ['Baltic Sea', 18, 55.5], ['Gulf of Bothnia', 20, 62], ['Gulf of Finland', 26, 59.8], ['Gulf of Riga', 23.5, 57.6],
    ['Wadden Sea', 6, 53.8], ['Gulf of Lion', 4, 42.5], ['Balearic Sea', 2, 40], ['Alboran Sea', -3.5, 36], ['Ligurian Sea', 8.5, 43.5],
    ['Tyrrhenian Sea', 12, 40], ['Adriatic Sea', 15, 43], ['Gulf of Venice', 13, 45], ['Ionian Sea', 18.5, 38], ['Strait of Sicily', 12, 36.8],
    ['Gulf of Gabès', 11.5, 34], ['Gulf of Sidra', 18.5, 32], ['Libyan Sea', 25, 33.5], ['Cretan Sea', 25, 36], ['Aegean Sea', 25, 38.8],
    ['Sea of Marmara', 28, 40.7], ['Black Sea', 34, 43.3], ['Sea of Azov', 36.5, 46.2], ['Levantine Sea', 32, 34], ['Gulf of Antalya', 31, 36.3],
    ['Atlantic Approaches', -10.5, 40], ['Gulf of Cádiz', -7.5, 36.5], ['Moroccan Coast', -10, 32], ['Algerian Sea', 3, 37.5], ['Sea of Crete', 23, 35],
    ['Dogger Bank', 2, 54.5], ['Bay of Danzig', 19, 54.8], ['Åland Sea', 19.8, 60.2], ['Western Black Sea', 30, 43], ['Eastern Black Sea', 39, 42.5],
    ['Nile Mouths', 31, 32], ['Sea of Sardinia', 7.5, 40], ['Gulf of Taranto', 17, 39.8], ['Red Sea', 34, 28.5], ['Persian Gulf', 49.5, 28.5], ['White Sea', 37, 64.5],
  ].map(([n, lon, lat]) => ({ n, xy: toXY(lon, lat) }));
  const seaUsed = {};
  for (let p = L; p < T; p++) {
    const pr = provinces[p];
    let best = SEA_NAMES[0], bd = 1e9;
    for (const s of SEA_NAMES) { const d = (s.xy[0] - pr.cx) ** 2 + (s.xy[1] - pr.cy) ** 2; if (d < bd) { bd = d; best = s; } }
    seaUsed[best.n] = (seaUsed[best.n] || 0) + 1;
    pr.name = best.n + (seaUsed[best.n] > 1 ? ' ' + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][seaUsed[best.n]] : '');
    pr.culture = null;
  }
  progress('Map complete', 0.9);
  return { W, H, L, S, land, river, height, biome, aridity, pid, provinces, owner, capitals, dist, lat: latA, lon: lonA };
}

function cultureAt(lon, lat, c, tag) {
  if (tag === 'ENG') {
    if (lon < -5.6 && lat > 51.3) return 'irish';
    if (inBox(lon, lat, -5.4, 51.35, -2.95, 53.45)) return 'welsh';
    if (lat < 50.3 && lon > -5.6 || (lat < 49.8)) return 'french';
    if (lon > -2 && lat < 50.9 && lat > 49) return 'french';
  }
  if (tag === 'HRE') {
    if (lon < 6.8 && lat > 50.65 && lat < 53.7) return 'dutch';
    if (lon < 6.3 && lat < 50.65) return 'french';
    if (lon < 7.1 && lat < 47.2) return 'french';
    if (lat < 46.4 && lon > 10.4) return 'italian';
  }
  if (tag === 'ALM' && lat > 35.95 && lon < 4) return 'andalusian';
  if (tag === 'ALM' && lon > 7.5) return 'arabic';
  if (tag === 'JER' || tag === 'ANT') return 'arabic';
  if (tag === 'CYP') return 'greek';
  if (tag === 'CUM' && lon < 30.5 && lat > 43.6 && lat < 48.5) return 'vlach';
  if (tag === 'HUN') {
    if (lat < 46.55 && lon < 18.2 || (lat < 45.5 && lon < 19)) return 'croatian';
    if (lat > 48.2 && lon < 21.5) return 'slovak';
    if (lon > 22.8 && lat < 47.3) return 'vlach';
  }
  if (tag === 'GEO' && lon > 42.8 && lat < 41.2) return 'armenian';
  if (tag === 'NOV') { if (lon > 39) return 'komi'; if (lat > 60.4) return 'finnish'; }
  if (tag === 'AYY' && lat > 37 && lon > 39.5) return 'kurdish';
  if (tag === 'RUM' && lon > 40) return 'armenian';
  if (tag === 'BYZ' && lat > 41.6 && lon < 27 && lon > 22.5) return 'bulgarian';
  if (tag === 'SIC' && lat < 38.3 && lon < 15) return 'sicilian';
  if (tag === 'DEN' && lat < 54.9 && lon > 9.8) return 'german';
  if (tag === 'VOL' && lat > 56) return 'komi';
  return c;
}

function religionAt(lon, lat, culture, r) {
  if (['arabic', 'andalusian'].includes(culture) && r === 'catholic') return 'sunni';
  if (culture === 'greek' && r === 'catholic') return 'orthodox';
  if (culture === 'armenian') return 'armenian';
  if (culture === 'vlach') return 'orthodox';
  if (culture === 'komi' || (culture === 'finnish' && r === 'orthodox')) return 'pagan';
  if (culture === 'kurdish') return 'sunni';
  return r;
}
