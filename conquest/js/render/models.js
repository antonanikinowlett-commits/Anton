// Procedural low-poly models, merged into single vertex-coloured geometries so each
// kind can be drawn with one InstancedMesh.
import * as THREE from '../../vendor/three.module.js';

const C = (h) => new THREE.Color(h);

function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return { geo, color: C(color), m };
}

export function merge(parts) {
  let count = 0;
  const geos = parts.map((p) => {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()).applyMatrix4(p.m);
    g.computeVertexNormals();
    count += g.attributes.position.count;
    return [g, p.color];
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const [g, c] of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < n; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = (seg = 8) => new THREE.CylinderGeometry(0.5, 0.5, 1, seg);
const cone = (seg = 8) => new THREE.ConeGeometry(0.5, 1, seg);
const pyr = new THREE.ConeGeometry(0.72, 1, 4);
const sph = new THREE.SphereGeometry(0.5, 8, 6);
const prism = (() => { // gable roof
  const g = new THREE.BufferGeometry();
  const v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0.5, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 0.5, 0.5];
  const idx = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  return g;
})();

const STONE = '#b9b1a3', STONE_D = '#8f877a', WOOD = '#7a5634', WOOD_D = '#5a3d22', THATCH = '#c9a75a', TILE = '#a5523a', SLATE = '#5a6070', WHITE = '#e8e2d2', GREEN = '#5d7a3a';

function house(x, z, s, roof, ry = 0) {
  return [
    part(box, WHITE, { x, y: 0.22 * s, z, sx: 0.5 * s, sy: 0.44 * s, sz: 0.36 * s, ry }),
    part(prism, roof, { x, y: 0.44 * s, z, sx: 0.58 * s, sy: 0.3 * s, sz: 0.42 * s, ry: ry + Math.PI / 2 }),
  ];
}

export const MODELS = {
  // A small town; roof colour is varied per instance.
  town: () => merge([
    ...house(0, 0, 1, '#ffffff'), ...house(0.55, 0.15, 0.85, '#ffffff', 0.4), ...house(-0.5, 0.25, 0.9, '#ffffff', -0.3),
    ...house(0.2, -0.55, 0.8, '#ffffff', 1.2), ...house(-0.35, -0.45, 0.75, '#ffffff', 0.8),
    part(box, '#8a7a60', { y: 0.01, sx: 1.7, sy: 0.02, sz: 1.5 }),
  ]),
  castle1: () => merge([ // motte and bailey
    part(cone(10), '#7c8a4a', { y: 0.2, sx: 1.4, sy: 0.4, sz: 1.4 }),
    part(box, WOOD, { y: 0.55, sx: 0.4, sy: 0.4, sz: 0.4 }),
    part(pyr, WOOD_D, { y: 0.88, sx: 0.4, sy: 0.25, sz: 0.4, ry: Math.PI / 4 }),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => part(box, WOOD_D, { x: Math.cos(i * Math.PI / 4) * 0.95, z: Math.sin(i * Math.PI / 4) * 0.95, y: 0.12, sx: 0.08, sy: 0.24, sz: 0.75, ry: -i * Math.PI / 4 })),
  ]),
  castle2: () => merge([ // stone keep with curtain wall
    part(box, STONE, { y: 0.45, sx: 0.55, sy: 0.9, sz: 0.55 }),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(box, STONE_D, { x: a * 0.22, z: b * 0.22, y: 0.95, sx: 0.12, sy: 0.14, sz: 0.12 })),
    ...[0, 1, 2, 3].map((i) => part(box, STONE, { x: [0, 0.75, 0, -0.75][i], z: [0.75, 0, -0.75, 0][i], y: 0.18, sx: i % 2 ? 0.1 : 1.5, sy: 0.36, sz: i % 2 ? 1.5 : 0.1 })),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(cyl(8), STONE_D, { x: a * 0.75, z: b * 0.75, y: 0.25, sx: 0.24, sy: 0.5, sz: 0.24 })),
    part(box, '#7a6a4a', { y: 0.01, sx: 1.5, sy: 0.02, sz: 1.5 }),
  ]),
  castle3: () => merge([ // concentric castle
    part(cyl(10), STONE, { y: 0.55, sx: 0.6, sy: 1.1, sz: 0.6 }),
    part(cone(10), SLATE, { y: 1.3, sx: 0.65, sy: 0.4, sz: 0.65 }),
    ...[0, 1, 2, 3].map((i) => part(box, STONE, { x: [0, 0.6, 0, -0.6][i], z: [0.6, 0, -0.6, 0][i], y: 0.25, sx: i % 2 ? 0.12 : 1.2, sy: 0.5, sz: i % 2 ? 1.2 : 0.12 })),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(cyl(8), STONE_D, { x: a * 0.6, z: b * 0.6, y: 0.35, sx: 0.26, sy: 0.7, sz: 0.26 })),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(cone(8), SLATE, { x: a * 0.6, z: b * 0.6, y: 0.82, sx: 0.3, sy: 0.25, sz: 0.3 })),
    ...[0, 1, 2, 3].map((i) => part(box, STONE_D, { x: [0, 1.05, 0, -1.05][i], z: [1.05, 0, -1.05, 0][i], y: 0.15, sx: i % 2 ? 0.12 : 2.1, sy: 0.3, sz: i % 2 ? 2.1 : 0.12 })),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(cyl(8), STONE_D, { x: a * 1.05, z: b * 1.05, y: 0.22, sx: 0.22, sy: 0.44, sz: 0.22 })),
  ]),
  church: () => merge([
    part(box, WHITE, { y: 0.25, sx: 0.8, sy: 0.5, sz: 0.36 }),
    part(prism, SLATE, { y: 0.5, sx: 0.84, sy: 0.28, sz: 0.4, ry: Math.PI / 2 }),
    part(box, WHITE, { x: -0.42, y: 0.45, sx: 0.24, sy: 0.9, sz: 0.24 }),
    part(pyr, SLATE, { x: -0.42, y: 1.05, sx: 0.26, sy: 0.4, sz: 0.26, ry: Math.PI / 4 }),
  ]),
  cathedral: () => merge([
    part(box, '#d8cfbd', { y: 0.35, sx: 1.3, sy: 0.7, sz: 0.5 }),
    part(prism, SLATE, { y: 0.7, sx: 1.34, sy: 0.38, sz: 0.56, ry: Math.PI / 2 }),
    part(box, '#d8cfbd', { y: 0.3, sx: 0.4, sy: 0.6, sz: 1.0 }),
    ...[-1, 1].map((a) => part(box, '#d8cfbd', { x: -0.6, z: a * 0.18, y: 0.7, sx: 0.26, sy: 1.4, sz: 0.26 })),
    ...[-1, 1].map((a) => part(pyr, SLATE, { x: -0.6, z: a * 0.18, y: 1.6, sx: 0.28, sy: 0.45, sz: 0.28, ry: Math.PI / 4 })),
  ]),
  orthodox: () => merge([
    part(box, WHITE, { y: 0.3, sx: 0.7, sy: 0.6, sz: 0.7 }),
    part(cyl(10), WHITE, { y: 0.75, sx: 0.36, sy: 0.3, sz: 0.36 }),
    part(sph, '#d4a83a', { y: 0.95, sx: 0.4, sy: 0.5, sz: 0.4 }),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(sph, '#4a6aa0', { x: a * 0.25, z: b * 0.25, y: 0.68, sx: 0.18, sy: 0.24, sz: 0.18 })),
  ]),
  mosque: () => merge([
    part(box, '#e6dcc4', { y: 0.25, sx: 0.9, sy: 0.5, sz: 0.9 }),
    part(sph, '#e6dcc4', { y: 0.55, sx: 0.6, sy: 0.6, sz: 0.6 }),
    part(cyl(8), '#e6dcc4', { x: 0.55, z: 0.55, y: 0.6, sx: 0.12, sy: 1.2, sz: 0.12 }),
    part(cone(8), '#3a7a6a', { x: 0.55, z: 0.55, y: 1.3, sx: 0.14, sy: 0.25, sz: 0.14 }),
  ]),
  grove: () => merge([ // pagan sacred grove: stone ring and oak
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => part(box, '#9a948a', { x: Math.cos(i * 0.9) * 0.6, z: Math.sin(i * 0.9) * 0.6, y: 0.18, sx: 0.12, sy: 0.36, sz: 0.1, ry: -i * 0.9 })),
    part(cyl(6), WOOD_D, { y: 0.3, sx: 0.1, sy: 0.6, sz: 0.1 }),
    part(sph, '#3e6a2e', { y: 0.8, sx: 0.7, sy: 0.6, sz: 0.7 }),
  ]),
  farm: () => merge([
    part(box, '#c9b45a', { x: -0.55, y: 0.01, z: -0.3, sx: 0.9, sy: 0.02, sz: 0.55 }),
    part(box, '#8fa04a', { x: 0.45, y: 0.01, z: -0.35, sx: 0.8, sy: 0.02, sz: 0.5 }),
    part(box, '#a88a4a', { x: -0.3, y: 0.01, z: 0.4, sx: 1.0, sy: 0.02, sz: 0.5 }),
    part(box, WOOD, { x: 0.55, y: 0.16, z: 0.4, sx: 0.4, sy: 0.32, sz: 0.3 }),
    part(prism, THATCH, { x: 0.55, y: 0.32, z: 0.4, sx: 0.46, sy: 0.24, sz: 0.36, ry: Math.PI / 2 }),
  ]),
  market: () => merge([
    part(box, WHITE, { y: 0.25, sx: 0.9, sy: 0.5, sz: 0.5 }),
    part(prism, TILE, { y: 0.5, sx: 0.96, sy: 0.3, sz: 0.56, ry: Math.PI / 2 }),
    ...[-0.6, 0, 0.6].map((x) => part(prism, ['#b03a2e', '#2e5ab0', '#d4a83a'][Math.round(x / 0.6) + 1], { x, z: 0.55, y: 0.18, sx: 0.4, sy: 0.12, sz: 0.3, ry: Math.PI / 2 })),
    ...[-0.6, 0, 0.6].map((x) => part(box, WOOD, { x, z: 0.55, y: 0.07, sx: 0.32, sy: 0.14, sz: 0.2 })),
  ]),
  mine: () => merge([
    part(cone(7), '#7a6e60', { y: 0.3, sx: 1.2, sy: 0.6, sz: 1.0 }),
    part(box, '#1a1612', { z: 0.38, y: 0.15, sx: 0.28, sy: 0.3, sz: 0.1 }),
    part(box, WOOD, { z: 0.42, y: 0.32, sx: 0.36, sy: 0.05, sz: 0.06 }),
    part(box, '#4a4a50', { x: 0.45, z: 0.6, y: 0.08, sx: 0.22, sy: 0.12, sz: 0.14 }),
  ]),
  lumber: () => merge([
    ...[0, 1, 2].map((i) => part(cyl(6), '#8a6038', { x: -0.3, y: 0.06 + i * 0.1, z: -0.1 + (i % 2) * 0.05, sx: 0.1, sy: 0.7, sz: 0.1, rz: Math.PI / 2 })),
    part(box, WOOD_D, { x: 0.35, y: 0.15, z: 0.2, sx: 0.4, sy: 0.3, sz: 0.3 }),
    part(prism, WOOD, { x: 0.35, y: 0.3, z: 0.2, sx: 0.46, sy: 0.2, sz: 0.36 }),
    part(cyl(6), '#6a6a6a', { x: -0.4, y: 0.12, z: 0.4, sx: 0.08, sy: 0.24, sz: 0.08 }),
  ]),
  stables: () => merge([
    ...[0, 1, 2, 3].map((i) => part(box, WOOD, { x: [0, 0.6, 0, -0.6][i], z: [0.5, 0, -0.5, 0][i], y: 0.08, sx: i % 2 ? 0.04 : 1.2, sy: 0.12, sz: i % 2 ? 1.0 : 0.04 })),
    part(box, '#8a3a2a', { x: 0.2, y: 0.18, z: -0.15, sx: 0.5, sy: 0.36, sz: 0.3 }),
    part(prism, WOOD_D, { x: 0.2, y: 0.36, z: -0.15, sx: 0.56, sy: 0.2, sz: 0.36, ry: Math.PI / 2 }),
    part(box, '#6a4a2a', { x: -0.3, y: 0.1, z: 0.2, sx: 0.22, sy: 0.08, sz: 0.06 }),
  ]),
  barracks: () => merge([
    part(box, WOOD, { y: 0.16, sx: 1.0, sy: 0.32, sz: 0.36 }),
    part(prism, THATCH, { y: 0.32, sx: 1.04, sy: 0.24, sz: 0.42, ry: Math.PI / 2 }),
    part(cyl(5), WOOD_D, { x: 0.65, y: 0.4, sx: 0.04, sy: 0.8, sz: 0.04 }),
    part(box, '#b03030', { x: 0.75, y: 0.68, sx: 0.2, sy: 0.14, sz: 0.01 }),
    ...[-0.4, 0, 0.4].map((x) => part(box, '#8a7a5a', { x, y: 0.01, z: 0.45, sx: 0.3, sy: 0.02, sz: 0.3 })),
  ]),
  port: () => merge([
    part(box, WOOD, { y: 0.05, z: 0.4, sx: 0.25, sy: 0.08, sz: 1.1 }),
    part(box, WOOD_D, { x: 0.45, y: 0.08, z: 0.6, sx: 0.28, sy: 0.12, sz: 0.7 }),
    part(cyl(5), WOOD_D, { x: 0.45, y: 0.45, z: 0.6, sx: 0.03, sy: 0.6, sz: 0.03 }),
    part(box, WHITE, { x: 0.45, y: 0.48, z: 0.6, sx: 0.02, sy: 0.4, sz: 0.36 }),
    part(box, WHITE, { x: -0.35, y: 0.18, z: -0.2, sx: 0.4, sy: 0.36, sz: 0.36 }),
    part(prism, TILE, { x: -0.35, y: 0.36, z: -0.2, sx: 0.44, sy: 0.22, sz: 0.4 }),
  ]),
  workshop: () => merge([
    ...house(0, 0, 1, TILE),
    part(box, STONE_D, { x: 0.18, y: 0.55, z: 0.08, sx: 0.08, sy: 0.35, sz: 0.08 }),
    ...house(0.5, 0.3, 0.8, TILE, 0.5),
  ]),
  // Units
  soldier: () => merge([
    part(box, '#ffffff', { y: 0.2, sx: 0.12, sy: 0.22, sz: 0.08 }),
    part(sph, '#d8b090', { y: 0.38, sx: 0.09, sy: 0.09, sz: 0.09 }),
    part(cone(6), '#8a8a90', { y: 0.45, sx: 0.1, sy: 0.08, sz: 0.1 }),
    part(box, '#5a4a3a', { x: -0.035, y: 0.05, sx: 0.04, sy: 0.12, sz: 0.04 }),
    part(box, '#5a4a3a', { x: 0.035, y: 0.05, sx: 0.04, sy: 0.12, sz: 0.04 }),
    part(cyl(4), '#6a5030', { x: 0.09, y: 0.32, sx: 0.015, sy: 0.6, sz: 0.015 }),
    part(cone(4), '#c0c0c8', { x: 0.09, y: 0.64, sx: 0.03, sy: 0.06, sz: 0.03 }),
    part(box, '#ffffff', { x: -0.08, y: 0.22, sx: 0.02, sy: 0.16, sz: 0.12 }),
  ]),
  archer: () => merge([
    part(box, '#ffffff', { y: 0.2, sx: 0.11, sy: 0.22, sz: 0.08 }),
    part(sph, '#d8b090', { y: 0.38, sx: 0.09, sy: 0.09, sz: 0.09 }),
    part(cone(6), '#4a5a3a', { y: 0.45, sx: 0.1, sy: 0.08, sz: 0.1 }),
    part(box, '#5a4a3a', { x: -0.035, y: 0.05, sx: 0.04, sy: 0.12, sz: 0.04 }),
    part(box, '#5a4a3a', { x: 0.035, y: 0.05, sx: 0.04, sy: 0.12, sz: 0.04 }),
    part(new THREE.TorusGeometry(0.16, 0.012, 3, 8, Math.PI), '#6a4a2a', { x: 0.1, y: 0.27, ry: Math.PI / 2, rz: Math.PI / 2 }),
  ]),
  rider: () => merge([
    part(box, '#6a4a30', { y: 0.22, sx: 0.12, sy: 0.14, sz: 0.36 }),
    part(box, '#6a4a30', { y: 0.32, z: 0.2, sx: 0.07, sy: 0.16, sz: 0.1, rx: -0.5 }),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(box, '#4a3420', { x: a * 0.04, z: b * 0.13, y: 0.08, sx: 0.035, sy: 0.16, sz: 0.035 })),
    part(box, '#ffffff', { y: 0.38, sx: 0.1, sy: 0.18, sz: 0.08 }),
    part(sph, '#9a9aa0', { y: 0.52, sx: 0.08, sy: 0.08, sz: 0.08 }),
    part(cyl(4), '#6a5030', { x: 0.07, y: 0.42, z: 0.15, sx: 0.015, sy: 0.6, sz: 0.015, rx: Math.PI / 2.4 }),
  ]),
  banner: () => merge([
    part(cyl(5), '#5a4028', { y: 0.55, sx: 0.025, sy: 1.1, sz: 0.025 }),
    part(box, '#ffffff', { x: 0.14, y: 0.95, sx: 0.26, sy: 0.18, sz: 0.01 }),
  ]),
  trebuchet: () => merge([
    part(box, WOOD, { y: 0.05, sx: 0.4, sy: 0.06, sz: 0.3 }),
    ...[-1, 1].map((a) => part(box, WOOD_D, { z: a * 0.12, y: 0.25, sx: 0.05, sy: 0.4, sz: 0.04, rz: 0.2 })),
    part(box, WOOD, { y: 0.45, sx: 0.6, sy: 0.04, sz: 0.04, rz: -0.6 }),
    part(box, '#5a5a5a', { x: -0.2, y: 0.3, sx: 0.1, sy: 0.12, sz: 0.1 }),
  ]),
  tree: () => merge([
    part(cyl(5), '#5a3e26', { y: 0.12, sx: 0.06, sy: 0.24, sz: 0.06 }),
    part(sph, '#ffffff', { y: 0.38, sx: 0.36, sy: 0.38, sz: 0.36 }),
  ]),
  pine: () => merge([
    part(cyl(5), '#5a3e26', { y: 0.08, sx: 0.05, sy: 0.16, sz: 0.05 }),
    part(cone(6), '#ffffff', { y: 0.36, sx: 0.32, sy: 0.5, sz: 0.32 }),
    part(cone(6), '#ffffff', { y: 0.56, sx: 0.22, sy: 0.36, sz: 0.22 }),
  ]),
  palm: () => merge([
    part(cyl(5), '#7a5a36', { y: 0.3, sx: 0.04, sy: 0.6, sz: 0.04, rz: 0.1 }),
    ...[0, 1, 2, 3, 4].map((i) => part(box, '#ffffff', { x: Math.cos(i * 1.25) * 0.14, z: Math.sin(i * 1.25) * 0.14, y: 0.6, sx: 0.3, sy: 0.02, sz: 0.07, ry: -i * 1.25, rz: -0.35 })),
  ]),
  tent: () => merge([
    part(cone(6), '#e0d6c0', { y: 0.2, sx: 0.5, sy: 0.4, sz: 0.5 }),
    part(cyl(4), WOOD_D, { y: 0.45, sx: 0.02, sy: 0.2, sz: 0.02 }),
  ]),
};
