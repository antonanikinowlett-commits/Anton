// Shared helpers: seeded randomness, noise, math and formatting.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

export function fbm(x, y, oct = 4, s = 0) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f, s + i * 17); tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}

export function ridged(x, y, oct = 4, s = 0) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(vnoise(x * f, y * f, s + i * 31) * 2 - 1); v += amp * n * n; tot += amp; amp *= 0.5; f *= 2.1; }
  return v / tot;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (r, a, b) => a + (b - a) * r();
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  return f >= 0 ? rgbToHex([r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f]) : rgbToHex([r * (1 + f), g * (1 + f), b * (1 + f)]);
}

export function fmt(n, d = 0) {
  if (n === undefined || n === null || isNaN(n)) return '–';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return d ? n.toFixed(d) : Math.round(n).toLocaleString('en');
}
export const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
export const signed = (v, d = 0, suffix = '') => (v >= 0 ? '+' : '') + (d ? v.toFixed(d) : Math.round(v)) + suffix;
export const signedPct = (v, d = 0) => (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%';

// Binary min-heap keyed by float priority, storing int values. Used by the map generator and pathfinding.
export class Heap {
  constructor(cap = 1024) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  push(key, val) {
    if (this.n === this.k.length) {
      const k = new Float64Array(this.n * 2); k.set(this.k); this.k = k;
      const v = new Int32Array(this.n * 2); v.set(this.v); this.v = v;
    }
    let i = this.n++;
    const K = this.k, V = this.v;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= key) break;
      K[i] = K[p]; V[i] = V[p]; i = p;
    }
    K[i] = key; V[i] = val;
  }
  pop() {
    const K = this.k, V = this.v;
    const top = V[0];
    this.lastKey = K[0];
    const n = --this.n;
    if (n > 0) {
      const key = K[n], val = V[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && K[c + 1] < K[c]) c++;
        if (K[c] >= key) break;
        K[i] = K[c]; V[i] = V[c]; i = c;
      }
      K[i] = key; V[i] = val;
    }
    return top;
  }
}

export const DAY_MS = 86400000;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function dateOf(day) {
  // day 0 = 1 January 1200 (proleptic Julian calendar, 365-day years for simplicity)
  const ML = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let y = 1200 + Math.floor(day / 365), d = day % 365, m = 0;
  while (d >= ML[m]) { d -= ML[m]; m++; }
  return { y, m, d: d + 1 };
}
export function dateStr(day) { const { y, m, d } = dateOf(day); return `${d} ${MONTHS[m]} ${y}`; }
export function season(day) {
  const m = dateOf(day).m;
  return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
}

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}

// Browser storage can be unavailable (private windows, sandboxed frames); never let it throw.
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
