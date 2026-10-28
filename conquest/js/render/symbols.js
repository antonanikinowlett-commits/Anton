// Cartographer's symbols painted into the terrain texture: ridges of peaks, tufts of forest, hill humps, reeds, dunes.
// They carry the terrain at mid zoom (before 3D models appear) and show through the political watercolour wash.
import { BIOME } from '../world/mapgen.js';
import { clamp, mulberry32 } from '../util.js';

export function paintSymbols(ctx, map, S) {
  const { W, H, biome, height, land, lat } = map;
  const rng = mulberry32(77);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const inLand = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && land[Math.floor(y) * W + Math.floor(x)] === 1;

  // mountains, drawn back to front so the ridges overlap naturally
  const peaks = [];
  for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) {
    const i = y * W + x;
    if (land[i] !== 1 || biome[i] !== BIOME.MOUNT) continue;
    const e = height[i];
    if (e < 700 || rng() > 0.62) continue;
    peaks.push([x + (rng() - 0.5) * 2.4, y + (rng() - 0.5) * 2.4, e, lat[y] ?? 45]);
  }
  peaks.sort((a, b) => a[1] - b[1]);
  for (const [x, y, e, la] of peaks) {
    if (!inLand(x, y)) continue;
    const k = clamp(0.8 + (e - 700) / 2200, 0.8, 1.9) * (0.85 + rng() * 0.3);
    const w = 3.1 * k * S, h = 3.9 * k * S, cx = x * S, by = y * S + h * 0.4;
    const snow = e > 2300 - Math.max(0, la - 45) * 35;
    const apx = cx + (rng() - 0.5) * w * 0.15, apy = by - h;
    ctx.beginPath(); ctx.moveTo(cx - w / 2, by); ctx.lineTo(apx, apy); ctx.lineTo(apx + w * 0.12, by - h * 0.15); ctx.lineTo(cx, by); ctx.closePath();
    ctx.fillStyle = snow ? '#c3c8cd' : '#b2a48c'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(apx, apy); ctx.lineTo(cx + w / 2, by); ctx.closePath();
    ctx.fillStyle = snow ? '#8d95a2' : '#6f6352'; ctx.fill();
    if (snow) {
      ctx.beginPath(); ctx.moveTo(apx, apy); ctx.lineTo(cx - w * 0.22, apy + h * 0.34); ctx.lineTo(cx - w * 0.06, apy + h * 0.27); ctx.lineTo(cx + w * 0.08, apy + h * 0.38); ctx.lineTo(cx + w * 0.24, apy + h * 0.3); ctx.closePath();
      ctx.fillStyle = '#dfe3e8'; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(cx - w / 2, by); ctx.lineTo(apx, apy); ctx.lineTo(cx + w / 2, by);
    ctx.strokeStyle = 'rgba(38,28,18,.55)'; ctx.lineWidth = 0.55 * S; ctx.stroke();
  }

  // forests, hills, marsh and dunes
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const i = y * W + x;
    if (land[i] !== 1) continue;
    const b = biome[i];
    const forest = b === BIOME.FOREST || b === BIOME.TAIGA;
    if (!(forest || b === BIOME.HILLS || b === BIOME.MARSH || b === BIOME.DESERT)) continue;
    if (rng() > (forest ? 0.55 : b === BIOME.HILLS ? 0.22 : 0.18)) continue;
    const tx = (x + rng()) * S, ty = (y + rng()) * S;
    if (forest) {
      const r = (0.62 + rng() * 0.35) * S, cone = b === BIOME.TAIGA || (lat[y] ?? 45) > 57 || rng() < 0.18;
      ctx.beginPath();
      if (cone) { ctx.moveTo(tx, ty - r * 1.5); ctx.lineTo(tx + r * 0.85, ty + r * 0.6); ctx.lineTo(tx - r * 0.85, ty + r * 0.6); ctx.closePath(); }
      else ctx.arc(tx, ty, r, 0, 6.3);
      ctx.fillStyle = cone ? 'rgba(30,64,44,.62)' : 'rgba(42,84,40,.58)'; ctx.fill();
      ctx.beginPath(); ctx.arc(tx - r * 0.3, ty - r * 0.35, r * 0.38, 0, 6.3); ctx.fillStyle = 'rgba(190,220,140,.28)'; ctx.fill();
    } else if (b === BIOME.HILLS) {
      const r = (1.2 + rng() * 0.8) * S;
      ctx.beginPath(); ctx.arc(tx, ty, r, Math.PI * 1.08, Math.PI * 1.92); ctx.strokeStyle = 'rgba(70,52,28,.55)'; ctx.lineWidth = 0.38 * S; ctx.stroke();
      ctx.beginPath(); ctx.arc(tx + r * 0.1, ty + 0.2 * S, r * 0.92, Math.PI * 1.1, Math.PI * 1.5); ctx.strokeStyle = 'rgba(255,240,200,.28)'; ctx.stroke();
    } else if (b === BIOME.MARSH) {
      ctx.strokeStyle = 'rgba(40,80,70,.55)'; ctx.lineWidth = 0.3 * S;
      ctx.beginPath(); ctx.moveTo(tx - S * 0.9, ty); ctx.lineTo(tx + S * 0.9, ty); ctx.moveTo(tx - S * 0.4, ty + S * 0.5); ctx.lineTo(tx + S * 0.5, ty + S * 0.5); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(tx, ty, 1.6 * S, Math.PI * 1.15, Math.PI * 1.85); ctx.strokeStyle = 'rgba(130,86,40,.4)'; ctx.lineWidth = 0.3 * S; ctx.stroke();
    }
  }
}
