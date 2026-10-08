// The 3D campaign map: displaced terrain with a political overlay shader, animated water,
// instanced 3D buildings, trees and armies that appear as you zoom in, nation names laid
// on the land, and a smooth RTS camera.
import * as THREE from '../../vendor/three.module.js';
import { bakeTerrain, upsampleProvinces, depthTexture, noiseTexture, UP } from './terrain.js';
import { MODELS } from './models.js';
import { BIOME } from '../world/mapgen.js';
import { UNITS } from '../data/units.js';
import { hexToRgb, clamp, hash2, mulberry32, fmt } from '../util.js';

export const HS = 0.0016; // metres → world units (vertical exaggeration)
const MAXP = 4096;
const D_MIN = 14, D_MAX = 1150;

const LAND_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const LAND_FS = `
precision highp float;
uniform sampler2D tTerrain, tProv, tCol, tNoise;
uniform vec2 provSize; uniform float uPolAlpha, uBorderAlpha, uTime, uNear, uSnow, uTerrainMode;
uniform vec3 uSun;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
float dec(vec4 c){ return floor(c.r*255.0+0.5) + floor(c.g*255.0+0.5)*256.0; }
vec4 colFor(float id, float row){ return texture2D(tCol, vec2((id-1.0+0.5)/4096.0, (row+0.5)/4.0)); }
float ownerOf(float id){ if(id<0.5) return -1.0; vec4 c = colFor(id,2.0); return dec(c); }
void main(){
  vec4 pc = texture2D(tProv, vUv);
  float id = dec(pc);
  vec3 base = texture2D(tTerrain, vUv).rgb;
  float dn = texture2D(tNoise, vW.xz*0.23).r; float dn2 = texture2D(tNoise, vW.xz*0.031).r;
  base *= mix(1.0, 0.93 + 0.14*dn, uNear) * (0.97 + 0.06*dn2);
  vec3 N = normalize(vN);
  float lam = clamp(dot(N, normalize(uSun)), 0.0, 1.0);
  vec3 lit = base * (0.72 + 0.42*lam);
  // seasonal snow in the north and on heights
  float snow = uSnow * smoothstep(0.42, 0.18, vUv.y) * smoothstep(0.35, 0.6, dn*0.6+dn2*0.6) ;
  lit = mix(lit, vec3(0.93,0.95,0.98)*(0.8+0.25*lam), clamp(snow,0.0,0.85));
  if (id < 0.5 || pc.b > 0.5) { gl_FragColor = vec4(lit, 1.0); return; }
  vec4 c0 = colFor(id,0.0); vec4 c1 = colFor(id,1.0); vec4 c2 = colFor(id,2.0);
  float own = dec(c2);
  vec3 pol = c0.rgb;
  if (c1.a > 0.5) { float st = step(0.5, fract((vW.x - vW.z)*0.45)); pol = mix(pol, c1.rgb, st*0.9); }
  float a = uPolAlpha * c0.a * (1.0 - uTerrainMode);
  vec3 col = mix(lit, pol*(0.78+0.3*lam), a);
  // borders: compare neighbours a screen-size-aware distance away
  vec2 fw = fwidth(vUv);
  vec2 o1 = fw*1.1;
  vec2 o2 = max(fw*2.6, vec2(0.6)/provSize);
  float pb = 0.0, cb = 0.0;
  vec2 dirs[4]; dirs[0]=vec2(1.0,0.0); dirs[1]=vec2(-1.0,0.0); dirs[2]=vec2(0.0,1.0); dirs[3]=vec2(0.0,-1.0);
  for (int k=0;k<4;k++){
    float nid = dec(texture2D(tProv, vUv + dirs[k]*o1));
    if (abs(nid-id)>0.5) { pb = 1.0; if (abs(ownerOf(nid)-own)>0.5) cb = 1.0; }
    float nid2 = dec(texture2D(tProv, vUv + dirs[k]*o2));
    if (abs(nid2-id)>0.5 && abs(ownerOf(nid2)-own)>0.5) cb = max(cb, 0.55);
  }
  col = mix(col, col*0.35, pb*uBorderAlpha);
  vec3 bc = mix(pol*0.35, vec3(0.06,0.05,0.04), 0.5);
  col = mix(col, bc, cb*0.85*(1.0-uTerrainMode*0.5));
  // flags: 1 selected, 2 hovered, 4 highlighted target, 8 claimed
  float f = floor(c2.b*255.0+0.5);
  float sel = mod(f,2.0), hov = mod(floor(f/2.0),2.0), tgt = mod(floor(f/4.0),2.0), clm = mod(floor(f/8.0),2.0);
  if (clm > 0.5) { float st = step(0.82, fract((vW.x + vW.z)*0.3)); col = mix(col, vec3(0.95,0.85,0.4), st*0.35); }
  if (hov > 0.5) col = mix(col, vec3(1.0,0.97,0.85), 0.16);
  if (tgt > 0.5) col = mix(col, vec3(0.95,0.25,0.15), 0.22 + 0.1*sin(uTime*5.0));
  if (sel > 0.5) { col = mix(col, vec3(1.0,0.9,0.55), 0.22 + 0.06*sin(uTime*3.0)); col = mix(col, vec3(1.0,0.85,0.3), pb); }
  gl_FragColor = vec4(col, 1.0);
}`;

const WATER_FS = `
precision highp float;
uniform sampler2D tDepth, tNoise, tProv, tCol; uniform float uTime, uNear; uniform vec3 uSun; uniform vec2 provSize;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
float dec(vec4 c){ return floor(c.r*255.0+0.5) + floor(c.g*255.0+0.5)*256.0; }
vec4 colFor(float id, float row){ return texture2D(tCol, vec2((id-1.0+0.5)/4096.0, (row+0.5)/4.0)); }
void main(){
  float d = texture2D(tDepth, vUv).r;
  vec3 deep = vec3(0.075,0.19,0.30), shallow = vec3(0.22,0.44,0.50);
  vec3 col = mix(shallow, deep, smoothstep(0.0, 0.5, d));
  // gentle swell: two slow noise layers, stronger when zoomed in
  float n1 = texture2D(tNoise, vW.xz*0.15 + vec2(uTime*0.010, uTime*0.006)).r;
  float n2 = texture2D(tNoise, vW.xz*0.27 - vec2(uTime*0.008, uTime*0.012)).r;
  float w = mix(0.08, 0.5, uNear);
  vec3 N = normalize(vec3((n1-0.5)*w, 1.0, (n2-0.5)*w));
  vec3 V = normalize(cameraPosition - vW);
  vec3 H = normalize(normalize(uSun) + V);
  float spec = pow(max(dot(N,H),0.0), 80.0) * mix(0.12, 0.45, uNear);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col = mix(col, vec3(0.55,0.68,0.75), fres*0.25) + spec;
  float foam = smoothstep(0.045, 0.0, d) * (0.55+0.45*sin(uTime*1.3 + n1*9.0)) * uNear;
  col = mix(col, vec3(0.86,0.9,0.9), foam*0.3);
  vec4 pc = texture2D(tProv, vUv); float id = dec(pc);
  if (id > 0.5 && pc.b > 0.5) {
    vec2 o = max(vec2(1.5)/provSize, fwidth(vUv)*1.2);
    float b = 0.0;
    if (abs(dec(texture2D(tProv, vUv+vec2(o.x,0.0)))-id)>0.5 || abs(dec(texture2D(tProv, vUv+vec2(0.0,o.y)))-id)>0.5) b = 1.0;
    col = mix(col, col*1.18, b*0.4*uNear);
    vec4 c2 = colFor(id,2.0); float f = floor(c2.b*255.0+0.5);
    if (mod(floor(f/2.0),2.0) > 0.5) col = mix(col, vec3(0.7,0.85,1.0), 0.12);
    if (mod(f,2.0) > 0.5) col = mix(col, vec3(1.0,0.9,0.5), 0.2);
  }
  gl_FragColor = vec4(col, 0.93 - smoothstep(0.035, 0.0, d)*0.45);
}`;

export class MapView {
  constructor(canvas, overlay, game, map) {
    this.canvas = canvas; this.overlay = overlay; this.game = game; this.map = map;
    this.mode = 'political';
    this.sel = { prov: -1, armies: [] };
    this.hover = -1;
    this.listeners = {};
    this.flags = new Uint8Array(MAXP);
    this.tmpV = new THREE.Vector3();
    this.cam = { x: 640, z: 600, d: 700, tx: 640, tz: 600, td: 700 };
    this.clock = new THREE.Clock();
  }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  async init(progress = () => {}) {
    const { map } = this;
    const R = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.setClearColor(0x0d1a24);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x162a36, 1400, 2600);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.3, 5000);
    this.sunDir = new THREE.Vector3(-0.5, 0.75, 0.42).normalize();
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x404858, 0.95));
    const sun = new THREE.DirectionalLight(0xfff1d8, 1.25);
    sun.position.copy(this.sunDir).multiplyScalar(100);
    this.scene.add(sun);
    progress('Painting the land', 0.9);
    await tick();
    const terrainCanvas = bakeTerrain(map);
    progress('Inking the borders', 0.93);
    await tick();
    const up = upsampleProvinces(map);
    this.ids2 = up.ids; this.W2 = up.W2; this.H2 = up.H2;
    const tTerrain = new THREE.CanvasTexture(terrainCanvas);
    tTerrain.flipY = false; tTerrain.colorSpace = THREE.SRGBColorSpace; tTerrain.anisotropy = R.capabilities.getMaxAnisotropy();
    tTerrain.generateMipmaps = true; tTerrain.minFilter = THREE.LinearMipmapLinearFilter;
    const tProv = new THREE.DataTexture(up.tex, up.W2, up.H2, THREE.RGBAFormat);
    tProv.magFilter = tProv.minFilter = THREE.NearestFilter; tProv.needsUpdate = true;
    this.colData = new Uint8Array(MAXP * 4 * 4);
    const tCol = this.tCol = new THREE.DataTexture(this.colData, MAXP, 4, THREE.RGBAFormat);
    tCol.magFilter = tCol.minFilter = THREE.NearestFilter; tCol.needsUpdate = true;
    const nz = noiseTexture(256);
    const tNoise = new THREE.DataTexture(nz, 256, 256, THREE.RGBAFormat);
    tNoise.wrapS = tNoise.wrapT = THREE.RepeatWrapping; tNoise.magFilter = THREE.LinearFilter; tNoise.minFilter = THREE.LinearMipmapLinearFilter; tNoise.generateMipmaps = true; tNoise.needsUpdate = true;
    const tDepth = new THREE.DataTexture(depthTexture(map), map.W, map.H, THREE.RGBAFormat);
    tDepth.magFilter = tDepth.minFilter = THREE.LinearFilter; tDepth.needsUpdate = true;

    progress('Raising the mountains', 0.95);
    await tick();
    this.buildHeights();
    this.uniforms = {
      tTerrain: { value: tTerrain }, tProv: { value: tProv }, tCol: { value: tCol }, tNoise: { value: tNoise }, tDepth: { value: tDepth },
      provSize: { value: new THREE.Vector2(up.W2, up.H2) }, uPolAlpha: { value: 0.7 }, uBorderAlpha: { value: 0.4 }, uTime: { value: 0 }, uNear: { value: 0 },
      uSnow: { value: 0 }, uTerrainMode: { value: 0 }, uSun: { value: this.sunDir },
    };
    // terrain mesh
    const SX = 2, SZ = 2;
    const nx = Math.floor(map.W / SX), nz2 = Math.floor(map.H / SZ);
    const geo = new THREE.PlaneGeometry(map.W, map.H, nx, nz2);
    geo.rotateX(-Math.PI / 2);
    geo.translate(map.W / 2, 0, map.H / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this.heightAt(x, z));
      uv.setXY(i, x / map.W, z / map.H);
    }
    geo.computeVertexNormals();
    this.land = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: LAND_VS, fragmentShader: LAND_FS, extensions: { derivatives: true } }));
    this.scene.add(this.land);
    // water
    const wgeo = new THREE.PlaneGeometry(map.W, map.H, 1, 1);
    wgeo.rotateX(-Math.PI / 2); wgeo.translate(map.W / 2, 0, map.H / 2);
    const wuv = wgeo.attributes.uv;
    for (let i = 0; i < wuv.count; i++) { const p = wgeo.attributes.position; wuv.setXY(i, p.getX(i) / map.W, p.getZ(i) / map.H); }
    this.water = new THREE.Mesh(wgeo, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: LAND_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false, extensions: { derivatives: true } }));
    this.water.renderOrder = 1;
    this.scene.add(this.water);
    // the world beyond the map edge
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ color: 0x0f2230 }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(map.W / 2, -0.6, map.H / 2);
    this.scene.add(outer);
    const frame = new THREE.Mesh(new THREE.RingGeometry(1, 1.02, 4, 1), new THREE.MeshBasicMaterial({ color: 0x8a6a3a }));
    void frame;

    progress('Planting forests', 0.97);
    await tick();
    this.buildTrees();
    this.buildBuildingMeshes();
    this.buildArmyMeshes();
    this.labelGroup = new THREE.Group();
    this.scene.add(this.labelGroup);
    this.pathGroup = new THREE.Group();
    this.scene.add(this.pathGroup);
    this.setupInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.hookGame();
    this.refreshColors();
    this.refreshBuildings();
    this.refreshLabels();
    this.setSeason();
  }

  // ── heights
  buildHeights() {
    const { W, H, height, land } = this.map;
    const h = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const e = height[i];
      h[i] = land[i] === 1 ? 0.06 + Math.max(0, e) * HS : land[i] === 2 ? -0.12 : Math.max(-2.2, e * 0.0006) - 0.1;
    }
    // soften
    const s = new Float32Array(h);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (land[i] !== 1) continue;
      s[i] = (h[i] * 4 + h[i - 1] + h[i + 1] + h[i - W] + h[i + W]) / 8;
      if (land[i - 1] !== 1 || land[i + 1] !== 1 || land[i - W] !== 1 || land[i + W] !== 1) s[i] = Math.max(0.05, s[i]);
    }
    this.hgt = s;
  }
  heightAt(x, z) {
    const { W, H } = this.map;
    const fx = clamp(x, 0, W - 1.001), fz = clamp(z, 0, H - 1.001);
    const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
    const h = this.hgt, i = z0 * W + x0;
    return (h[i] * (1 - tx) + h[i + 1] * tx) * (1 - tz) + (h[i + W] * (1 - tx) + h[i + W + 1] * tx) * tz;
  }
  groundY(x, z) { return Math.max(0.02, this.heightAt(x, z)); }

  // ── trees
  buildTrees() {
    const { W, H, biome, land, height, provinces, pid } = this.map;
    const rng = mulberry32(5);
    const decid = [], pine = [], palm = [];
    const anchors = new Set();
    for (const p of provinces) if (!p.sea) anchors.add(Math.round(p.y) * W + Math.round(p.x));
    for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
      const i = y * W + x;
      if (land[i] !== 1) continue;
      const b = biome[i];
      let pr = 0;
      if (b === BIOME.FOREST) pr = 0.42; else if (b === BIOME.TAIGA) pr = 0.4; else if (b === BIOME.HILLS) pr = 0.06;
      else if (b === BIOME.PLAINS) pr = 0.025; else if (b === BIOME.FARM) pr = 0.012; else if (b === BIOME.MARSH) pr = 0.08;
      else if (b === BIOME.MOUNT && height[i] < 2000) pr = 0.07; else if (b === BIOME.DESERT && this.map.river[i]) pr = 0.25;
      if (rng() > pr) continue;
      const p = provinces[pid[i]];
      if (p && Math.hypot(p.x - x, p.y - y) < 2.6) continue;
      const tx = x + rng(), tz = y + rng();
      const ent = [tx, tz, 0.55 + rng() * 0.5, rng()];
      if (b === BIOME.DESERT || (b === BIOME.STEPPE && this.map.lat[y] < 34)) palm.push(ent);
      else if (b === BIOME.TAIGA || b === BIOME.MOUNT || (b === BIOME.FOREST && (this.map.lat[y] > 55 || rng() < 0.25))) pine.push(ent);
      else decid.push(ent);
    }
    const mk = (geo, list, colors, cap) => {
      list = list.slice(0, cap);
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
      list.forEach(([x, z, s, r], i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * 6.28);
        M.compose(new THREE.Vector3(x, this.groundY(x, z) - 0.03, z), q, new THREE.Vector3(s, s * (0.9 + r * 0.3), s));
        m.setMatrixAt(i, M);
        c.set(colors[Math.floor(r * colors.length)]);
        m.setColorAt(i, c);
      });
      m.instanceMatrix.needsUpdate = true;
      m.frustumCulled = false;
      this.scene.add(m);
      return m;
    };
    this.trees = [
      mk(MODELS.tree(), decid, ['#4f7a34', '#5e8a3c', '#46702e', '#6b8f42', '#557d36'], 60000),
      mk(MODELS.pine(), pine, ['#2f5532', '#355e38', '#2a4d2e', '#3c6a3e'], 60000),
      mk(MODELS.palm(), palm, ['#5d8a3a', '#6e9a40'], 8000),
    ];
  }
  setSeason() {
    const s = this.game.season();
    const tint = { spring: '#ffffff', summer: '#f2f6e8', autumn: '#e8b878', winter: '#c8ccc8' }[s];
    this.trees[0].material.color.set(tint);
    this.trees[1].material.color.set(s === 'winter' ? '#dfe6e8' : '#ffffff');
    this.uniforms.uSnow.value = s === 'winter' ? 1 : s === 'autumn' || s === 'spring' ? 0.25 : 0;
  }

  // ── buildings
  buildBuildingMeshes() {
    const L = this.map.L;
    this.bmesh = {};
    const types = ['town', 'castle1', 'castle2', 'castle3', 'church', 'cathedral', 'orthodox', 'mosque', 'grove', 'farm', 'market', 'mine', 'lumber', 'stables', 'barracks', 'port', 'workshop', 'tent', 'trebuchet'];
    for (const t of types) {
      const cap = t === 'town' ? L * 2 : t === 'tent' || t === 'trebuchet' ? 600 : L;
      const m = new THREE.InstancedMesh(MODELS[t](), new THREE.MeshLambertMaterial({ vertexColors: true }), cap);
      m.count = 0; m.frustumCulled = false;
      if (t === 'town') { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); }
      this.scene.add(m);
      this.bmesh[t] = m;
    }
    // building slots per province: positions around the anchor that stay inside the province
    const { W, provinces, pid } = this.map;
    this.slots = [];
    for (let p = 0; p < L; p++) {
      const pr = provinces[p];
      const pts = [];
      const rng = mulberry32(p * 7 + 3);
      const base = rng() * 6.28;
      for (let k = 0; k < 9; k++) {
        let placed = null;
        for (let tries = 0; tries < 8 && !placed; tries++) {
          const ang = base + k * 2.3 + tries * 0.7, r = 1.6 + (k % 3) * 0.9 + tries * 0.25;
          const x = pr.x + Math.cos(ang) * r, z = pr.y + Math.sin(ang) * r;
          const i = Math.floor(z) * W + Math.floor(x);
          if (pid[i] === p && this.map.land[i] === 1) placed = [x, z, ang];
        }
        pts.push(placed || [pr.x + (k - 4) * 0.25, pr.y + 0.4, 0]);
      }
      // the harbour sits on the nearest coast
      let port = null;
      if (pr.coastal) {
        let bd = 1e9;
        const [x0, y0, x1, y1] = pr.bbox;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const i = y * W + x;
          if (pid[i] !== p || this.map.dist[i] !== 0) continue;
          const d = (x - pr.x) ** 2 + (y - pr.y) ** 2;
          if (d < bd) {
            // face the sea
            let sx = 0, sz = 0;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.map.land[i + dz * W + dx] === 0) { sx += dx; sz += dz; }
            bd = d; port = [x + 0.5, y + 0.5, Math.atan2(sx, sz)];
          }
        }
      }
      this.slots.push({ pts, port });
    }
  }
  refreshBuildings() {
    const g = this.game, s = g.s, L = this.map.L, P = this.map.provinces;
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    for (const m of Object.values(this.bmesh)) m.count = 0;
    const put = (type, x, z, ang, sc = 1, color) => {
      const m = this.bmesh[type];
      if (m.count >= m.instanceMatrix.count) return;
      q.setFromAxisAngle(up, ang);
      V.set(x, this.groundY(x, z) - 0.02, z); S.set(sc, sc, sc);
      M.compose(V, q, S);
      m.setMatrixAt(m.count, M);
      if (color && m.instanceColor) { c.set(color).lerp(this._white ||= new THREE.Color(1, 1, 1), 0.45); m.setColorAt(m.count, c); }
      m.count++;
    };
    for (let p = 0; p < L; p++) {
      const pr = s.prov[p], sp = P[p], b = pr.buildings, sl = this.slots[p];
      const owner = s.nations[pr.owner];
      const southern = sp.lat < 44;
      const roof = southern ? '#b5573c' : sp.lat > 55 ? '#7a6a4a' : ['#a5523a', '#8a5a3a', '#c9a75a', '#6a6a72'][p % 4];
      const fort = b.walls || 0;
      const townScale = 0.75 + Math.min(1, pr.dev / 18) * 0.6;
      if (fort) { put('castle' + Math.min(3, fort), sp.x, sp.y, sl.pts[0][2], 1.1); put('town', sl.pts[0][0], sl.pts[0][1], sl.pts[0][2], townScale, roof); }
      else put('town', sp.x, sp.y, (p * 1.3) % 6.28, townScale, roof);
      if (pr.dev >= 10) put('town', sl.pts[8][0], sl.pts[8][1], sl.pts[8][2] + 1, townScale * 0.8, roof);
      const rel = pr.religion;
      if (b.church) {
        const t = rel === 'sunni' ? 'mosque' : rel === 'pagan' || rel === 'tengri' ? 'grove' : rel === 'orthodox' || rel === 'armenian' ? 'orthodox' : b.church >= 3 ? 'cathedral' : 'church';
        put(t, sl.pts[1][0], sl.pts[1][1], sl.pts[1][2], 0.8 + b.church * 0.15);
      }
      const order = [['farm', 2], ['market', 3], ['mine', 4], ['lumber', 5], ['stables', 6], ['barracks', 7], ['workshop', 3]];
      for (const [t, k] of order) if (b[t]) put(t, sl.pts[k][0] + (t === 'workshop' ? 0.9 : 0), sl.pts[k][1], sl.pts[k][2], 0.8 + b[t] * 0.15);
      if (b.port && sl.port) put('port', sl.port[0], sl.port[1], sl.port[2], 1);
      void owner;
    }
    // siege camps
    for (let p = 0; p < L; p++) {
      const sg = s.prov[p].siege;
      if (!sg) continue;
      const sp = P[p];
      for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.4; put('tent', sp.x + Math.cos(a) * 2, sp.y + Math.sin(a) * 2, a, 1); }
      put('trebuchet', sp.x + 1.6, sp.y - 1.2, 2.2, 1.4);
    }
    for (const m of Object.values(this.bmesh)) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  // ── armies
  buildArmyMeshes() {
    const mk = (geo, cap) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), cap);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      m.count = 0; m.frustumCulled = false;
      this.scene.add(m);
      return m;
    };
    this.amesh = { soldier: mk(MODELS.soldier(), 6000), archer: mk(MODELS.archer(), 3000), rider: mk(MODELS.rider(), 3000), banner: mk(MODELS.banner(), 800), trebuchet: mk(MODELS.trebuchet(), 400) };
    this.armyEls = new Map();
  }
  armyPos(a) {
    const P = this.map.provinces;
    const from = P[a.loc];
    let x = from.x, z = from.y, dir = 0, moving = false;
    if (a.path.length) {
      const to = P[a.path[0]];
      const t = clamp(a.prog + (this.game.dayFrac || 0) * (a.rate || 0), 0, 1);
      x = from.x + (to.x - from.x) * t; z = from.y + (to.y - from.y) * t;
      dir = Math.atan2(to.x - from.x, to.y - from.y);
      moving = true;
    }
    return { x, z, dir, moving };
  }
  updateArmies(t) {
    const g = this.game, s = g.s;
    const near = this.cam.d < 260;
    for (const m of Object.values(this.amesh)) m.count = 0;
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color(), white = new THREE.Color(1, 1, 1);
    const seen = new Set();
    const byLoc = new Map();
    for (const a of Object.values(s.armies)) { const k = a.loc; byLoc.set(k, (byLoc.get(k) || 0) + 1); }
    const idxAt = new Map();
    const rect = this.canvas.getBoundingClientRect();
    for (const a of Object.values(s.armies)) {
      const pos = this.armyPos(a);
      const k = idxAt.get(a.loc) || 0; idxAt.set(a.loc, k + 1);
      const nAt = byLoc.get(a.loc);
      if (!a.path.length && nAt > 1) { const ang = k * 2.4 + 0.8; pos.x += Math.cos(ang) * 1.6; pos.z += Math.sin(ang) * 1.6; }
      if (a.battle) { const b = s.battles[a.battle]; if (b) { const att = b.att.includes(a.id); pos.x += att ? -0.9 : 0.9; pos.dir = att ? Math.PI / 2 : -Math.PI / 2; } }
      const y = this.map.provinces[a.loc].sea ? 0.05 : this.groundY(pos.x, pos.z);
      const nation = s.nations[a.nation];
      const col = nation ? nation.color : '#222222';
      // 3D figures when close
      if (near && this.inView(pos.x, y, pos.z)) {
        const regs = a.regs;
        const fig = clamp(Math.round(regs.length * 0.9), 3, 16);
        const comp = { inf: 0, rng: 0, cav: 0, siege: 0 };
        for (const r of regs) comp[UNITS[r.type].cls]++;
        const tot = regs.length || 1;
        const list = [];
        const nCav = Math.round(fig * comp.cav / tot), nRng = Math.round(fig * comp.rng / tot), nSiege = Math.min(2, comp.siege);
        for (let i = 0; i < fig - nCav - nRng; i++) list.push('soldier');
        for (let i = 0; i < nRng; i++) list.push('archer');
        for (let i = 0; i < nCav; i++) list.push('rider');
        for (let i = 0; i < nSiege; i++) list.push('trebuchet');
        const cols = 4, sp = 0.32;
        c.set(col).lerp(white, 0.15);
        q.setFromAxisAngle(up, pos.dir);
        const cosd = Math.cos(pos.dir), sind = Math.sin(pos.dir);
        list.forEach((type, i) => {
          const row = Math.floor(i / cols), cl = i % cols;
          const lx = (cl - (cols - 1) / 2) * sp * (type === 'rider' ? 1.3 : 1), lz = -row * sp * 1.2 + (type === 'rider' ? -0.2 : 0);
          const wx = pos.x + lx * cosd + lz * sind, wz = pos.z - lx * sind + lz * cosd;
          const bob = pos.moving || a.battle ? Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.05 : 0;
          V.set(wx, (this.map.provinces[a.loc].sea ? 0.05 : this.groundY(wx, wz)) + bob, wz);
          const sc = type === 'trebuchet' ? 1.4 : 1.15;
          S.set(sc, sc, sc);
          M.compose(V, q, S);
          const m = this.amesh[type];
          if (m.count < m.instanceMatrix.count) { m.setMatrixAt(m.count, M); m.setColorAt(m.count, c); m.count++; }
        });
        // standard bearer
        const bm = this.amesh.banner;
        V.set(pos.x + sind * 0.5, y, pos.z + cosd * 0.5); S.set(1.4, 1.4, 1.4); M.compose(V, q, S);
        if (bm.count < bm.instanceMatrix.count) { bm.setMatrixAt(bm.count, M); c.set(col); bm.setColorAt(bm.count, c); bm.count++; }
      }
      // HTML counter
      seen.add(a.id);
      this.updateArmyCounter(a, pos.x, y + (near ? 1.8 : 0.5), pos.z, rect);
    }
    for (const [id, el] of this.armyEls) if (!seen.has(id)) { el.remove(); this.armyEls.delete(id); }
    for (const m of Object.values(this.amesh)) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  updateArmyCounter(a, x, y, z, rect) {
    let el = this.armyEls.get(a.id);
    const g = this.game, s = g.s;
    if (!el) {
      el = document.createElement('div');
      el.className = 'army-counter';
      el.innerHTML = '<div class="ac-flag"></div><div class="ac-num"></div><div class="ac-bar"><i></i></div>';
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
      el.addEventListener('click', (e) => { e.stopPropagation(); this.emit('armyClick', a.id, e); });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this.emit('rightClick', a.loc, e); });
      this.overlay.appendChild(el);
      this.armyEls.set(a.id, el);
    }
    this.V3 ||= new THREE.Vector3();
    this.V3.set(x, y, z).project(this.camera);
    const vis = this.V3.z < 1 && Math.abs(this.V3.x) < 1.1 && Math.abs(this.V3.y) < 1.1;
    if (!vis) { el.style.display = 'none'; return; }
    el.style.display = '';
    const sx = (this.V3.x + 1) / 2 * rect.width, sy = (1 - this.V3.y) / 2 * rect.height;
    const scale = clamp(1.25 - this.cam.d / 900, 0.6, 1.05);
    el.style.transform = `translate(${sx | 0}px, ${sy | 0}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
    const n = s.nations[a.nation];
    const mine = a.nation === s.player;
    const hostile = s.player >= 0 && (a.nation < 0 ? a.rebelOf === s.player : g.atWar(s.player, a.nation));
    const men = g.armyMen(a);
    const key = `${Math.round(men / 100)}|${Math.round(g.armyMorale(a) * 20)}|${this.sel.armies.includes(a.id)}|${!!a.battle}|${hostile}|${a.retreating}|${!!a.atSea}`;
    if (el._k === key) return;
    el._k = key;
    el.querySelector('.ac-flag').style.background = n ? n.color : '#111';
    el.querySelector('.ac-num').textContent = men >= 1000 ? (men / 1000).toFixed(men >= 10000 ? 0 : 1) + 'k' : Math.round(men);
    el.querySelector('.ac-bar i').style.width = `${Math.round(g.armyMorale(a) * 100)}%`;
    el.classList.toggle('mine', mine);
    el.classList.toggle('hostile', hostile);
    el.classList.toggle('selected', this.sel.armies.includes(a.id));
    el.classList.toggle('fighting', !!a.battle);
    el.classList.toggle('retreat', !!a.retreating);
    el.classList.toggle('sea', !!a.atSea);
    el.title = `${a.name}${n ? ' (' + n.adj + ')' : ' (rebels)'} — ${fmt(men)} men`;
  }

  // ── battle & siege markers
  updateMarkers() {
    const s = this.game.s, rect = this.canvas.getBoundingClientRect();
    this.markerEls ||= new Map();
    const seen = new Set();
    const place = (key, p, cls, html, onclick) => {
      seen.add(key);
      let el = this.markerEls.get(key);
      if (!el) {
        el = document.createElement('div'); el.className = 'map-marker ' + cls;
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.addEventListener('click', (e) => { e.stopPropagation(); onclick(); });
        this.overlay.appendChild(el); this.markerEls.set(key, el);
      }
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      const sp = this.map.provinces[p];
      this.V3.set(sp.x, this.groundY(sp.x, sp.y) + 3.4, sp.y).project(this.camera);
      if (this.V3.z > 1 || Math.abs(this.V3.x) > 1.1 || Math.abs(this.V3.y) > 1.1) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.transform = `translate(${((this.V3.x + 1) / 2 * rect.width) | 0}px, ${((1 - this.V3.y) / 2 * rect.height) | 0}px) translate(-50%, -100%)`;
    };
    for (const b of Object.values(s.battles)) {
      if (b.over) continue;
      const ma = this.game.sideMorale(b, 'att'), md = this.game.sideMorale(b, 'def');
      const pct = Math.round(ma / Math.max(0.01, ma + md) * 100);
      place('b' + b.id, b.prov, 'battle', `<span class="mk-icon">⚔</span><div class="mk-bar"><i style="width:${pct}%"></i></div>`, () => this.emit('battleClick', b.id));
    }
    for (let p = 0; p < this.map.L; p++) {
      const sg = s.prov[p].siege;
      if (!sg) continue;
      place('s' + p, p, 'siege', `<span class="mk-icon">🏰</span><div class="mk-bar siegebar"><i style="width:${Math.min(100, Math.round(sg.prog))}%"></i></div>`, () => this.emit('provinceClick', p));
    }
    for (const [k, el] of this.markerEls) if (!seen.has(k)) { el.remove(); this.markerEls.delete(k); }
  }

  // ── colours & map modes
  provColor(p) {
    const g = this.game, s = g.s, pr = s.prov[p], sp = this.map.provinces[p];
    const mode = this.mode;
    const own = s.nations[pr.owner];
    const pl = s.player;
    switch (mode) {
      case 'political': case 'terrain': {
        if (!own) return [128, 128, 128];
        let c = hexToRgb(own.color);
        if (own.overlord >= 0) c = c.map((v, i) => v * 0.75 + hexToRgb(s.nations[own.overlord].color)[i] * 0.25);
        return c;
      }
      case 'diplomacy': {
        if (pr.owner === pl) return [70, 140, 220];
        if (pl < 0) return [128, 128, 128];
        if (g.atWar(pl, pr.owner)) return [210, 50, 40];
        if (g.isAlly(pl, pr.owner)) return [60, 180, 90];
        if (own && own.overlord === pl) return [120, 190, 230];
        const op = g.opinion(pr.owner, pl);
        const t = clamp((op + 100) / 200, 0, 1);
        return [200 - t * 80, 140 + t * 60, 120];
      }
      case 'religion': return hexToRgb({ catholic: '#e8d070', orthodox: '#6a8ad8', sunni: '#3a9a5a', pagan: '#9a6a3a', tengri: '#7ab0c0', armenian: '#c86a4a' }[pr.religion] || '#999999');
      case 'culture': { const h = hash2(pr.culture.length * 31 + pr.culture.charCodeAt(0), pr.culture.charCodeAt(1) || 0, 3); const h2 = hash2(pr.culture.charCodeAt(2) || 0, pr.culture.length, 7); return [80 + h * 160, 80 + h2 * 150, 90 + (1 - h) * 140]; }
      case 'development': { const t = clamp(pr.dev / 22, 0, 1); return [60 + t * 60, 70 + t * 170, 40 + t * 40]; }
      case 'supply': { const v = g.supplyLimit(p, pl >= 0 ? pl : pr.owner); const t = clamp(v / 18, 0, 1); return [220 - t * 160, 60 + t * 160, 50]; }
      case 'unrest': { const t = clamp(pr.unrest / 60, 0, 1); return [80 + t * 170, 170 - t * 120, 70]; }
      case 'fort': { const f = g.fortLevel(p); return f === 0 ? [110, 110, 100] : [[150, 140, 90], [190, 160, 70], [230, 170, 50], [250, 120, 40]][Math.min(3, f - 1)]; }
      case 'terrainType': return hexToRgb({ farmland: '#c8c060', plains: '#9ab86a', forest: '#3a7a3a', taiga: '#2a5a4a', hills: '#a08a5a', mountains: '#8a7a7a', marsh: '#5a7a6a', steppe: '#d0c080', desert: '#e8d090' }[sp.terrain]);
      default: return [128, 128, 128];
    }
  }
  refreshColors() {
    const g = this.game, s = g.s, D = this.colData, L = this.map.L, T = this.map.provinces.length;
    const pl = s.player;
    for (let p = 0; p < T; p++) {
      const i = p * 4;
      if (p >= L) {
        D[i] = D[i + 1] = D[i + 2] = 0; D[i + 3] = 0;
        D[2 * MAXP * 4 + i] = 0; D[2 * MAXP * 4 + i + 1] = 0; D[2 * MAXP * 4 + i + 2] = this.flags[p];
        continue;
      }
      const pr = s.prov[p];
      const c = this.provColor(p);
      D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255;
      const j = MAXP * 4 + i;
      if (pr.controller !== pr.owner) {
        const cc = pr.controller >= 0 ? hexToRgb(s.nations[pr.controller].color) : [20, 20, 20];
        D[j] = cc[0]; D[j + 1] = cc[1]; D[j + 2] = cc[2]; D[j + 3] = 255;
      } else D[j + 3] = 0;
      const k = 2 * MAXP * 4 + i;
      const o = pr.owner + 1;
      D[k] = o & 255; D[k + 1] = (o >> 8) & 255;
      let f = this.flags[p];
      if (pl >= 0 && pr.claims.includes(pl) && pr.owner !== pl && this.mode !== 'terrain') f |= 8;
      D[k + 2] = f; D[k + 3] = 255;
    }
    this.tCol.needsUpdate = true;
    this.uniforms.uTerrainMode.value = this.mode === 'terrain' ? 1 : 0;
    this.minimapDirty = true;
  }
  setMode(m) { this.mode = m; this.refreshColors(); this.emit('mode', m); }
  setFlag(p, bit, on) {
    if (p < 0) return;
    if (on) this.flags[p] |= bit; else this.flags[p] &= ~bit;
    const k = 2 * MAXP * 4 + p * 4 + 2;
    let f = this.flags[p];
    const pl = this.game.s.player;
    if (p < this.map.L && pl >= 0 && this.game.s.prov[p].claims.includes(pl) && this.game.s.prov[p].owner !== pl && this.mode !== 'terrain') f |= 8;
    this.colData[k] = f;
    this.tCol.needsUpdate = true;
  }
  selectProvince(p) {
    if (this.sel.prov >= 0) this.setFlag(this.sel.prov, 1, false);
    this.sel.prov = p;
    if (p >= 0) this.setFlag(p, 1, true);
  }
  selectArmies(ids) { this.sel.armies = ids; for (const el of this.armyEls.values()) el._k = null; this.refreshPaths(); }
  highlightTargets(list) {
    for (const p of this._targets || []) this.setFlag(p, 4, false);
    this._targets = list;
    for (const p of list) this.setFlag(p, 4, true);
  }

  // ── labels
  refreshLabels() {
    const g = this.game, s = g.s, P = this.map.provinces;
    for (const c of [...this.labelGroup.children]) { c.geometry.dispose(); c.material.map.dispose(); c.material.dispose(); this.labelGroup.remove(c); }
    for (const n of s.nations) {
      if (!n.alive) continue;
      const owned = g.ownedProvinces(n.id);
      if (!owned.length) continue;
      // largest connected block
      const set = new Set(owned), seen = new Set();
      let best = [], bestA = 0;
      for (const p of owned) {
        if (seen.has(p)) continue;
        const comp = [p]; seen.add(p);
        for (let i = 0; i < comp.length; i++) for (const e of P[comp[i]].adj) if (set.has(e.id) && !seen.has(e.id) && !e.strait) { seen.add(e.id); comp.push(e.id); }
        const A = comp.reduce((t, q) => t + P[q].area, 0);
        if (A > bestA) { bestA = A; best = comp; }
      }
      if (bestA < 60) continue;
      let mx = 0, mz = 0, W = 0;
      for (const p of best) { mx += P[p].cx * P[p].area; mz += P[p].cy * P[p].area; W += P[p].area; }
      mx /= W; mz /= W;
      let sxx = 0, szz = 0, sxz = 0;
      for (const p of best) { const dx = P[p].cx - mx, dz = P[p].cy - mz; sxx += dx * dx * P[p].area; szz += dz * dz * P[p].area; sxz += dx * dz * P[p].area; }
      sxx /= W; szz /= W; sxz /= W;
      let ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
      if (Math.abs(ang) > 0.9) ang = ang * 0.3;
      const major = Math.sqrt(Math.max(1, (sxx + szz) / 2 + Math.sqrt(((sxx - szz) / 2) ** 2 + sxz * sxz)));
      const minor = Math.sqrt(Math.max(1, (sxx + szz) / 2 - Math.sqrt(((sxx - szz) / 2) ** 2 + sxz * sxz)));
      const text = labelName(n).toUpperCase();
      const len = Math.max(1, major * 3.0);
      const tex = textTexture(text, n.color);
      const aspect = tex.image.width / tex.image.height;
      const h = clamp(Math.min(len / aspect, minor * 1.5), 2.5, 70);
      const w = h * aspect;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -ang;
      m.position.set(mx, 6, mz);
      m.renderOrder = 10;
      m.userData = { size: h };
      this.labelGroup.add(m);
    }
  }

  // ── movement paths
  refreshPaths() {
    for (const c of [...this.pathGroup.children]) { c.geometry.dispose(); c.material.dispose(); this.pathGroup.remove(c); }
    const s = this.game.s, P = this.map.provinces;
    const show = Object.values(s.armies).filter((a) => a.path.length && (this.sel.armies.includes(a.id) || (a.nation === s.player)));
    for (const a of show) {
      const pts = [];
      const pos = this.armyPos(a);
      pts.push([pos.x, pos.z]);
      for (const p of a.path) pts.push([P[p].x, P[p].y]);
      const sel = this.sel.armies.includes(a.id);
      const dest = a.path[a.path.length - 1];
      const hostile = this.game.hostileToProvince(a, dest) || this.game.armiesAt(dest).some((b) => this.game.hostileArmies(a, b));
      const color = a.retreating ? 0xd8d8d8 : hostile ? 0xe04030 : 0x60d070;
      this.pathGroup.add(this.ribbon(pts, sel ? 0.42 : 0.26, color, sel ? 0.95 : 0.55));
    }
  }
  ribbon(pts, w, color, alpha) {
    // densify and lay on the terrain
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.5));
      for (let k = 0; k < n; k++) dense.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n]);
    }
    dense.push(pts[pts.length - 1]);
    const pos = [], idx = [];
    for (let i = 0; i < dense.length; i++) {
      const [x, z] = dense[i];
      const [xn, zn] = dense[Math.min(i + 1, dense.length - 1)], [xp, zp] = dense[Math.max(i - 1, 0)];
      let dx = xn - xp, dz = zn - zp; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const y = Math.max(0.15, this.heightAt(x, z)) + 0.25;
      const ww = i === dense.length - 1 ? 0 : i > dense.length - 4 ? w * 2.2 * (dense.length - 1 - i) / 3 : w;
      pos.push(x - dz * ww, y, z + dx * ww, x + dz * ww, y, z - dx * ww);
      if (i < dense.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false, side: THREE.DoubleSide }));
    m.renderOrder = 5;
    return m;
  }

  // ── province name labels (HTML) when zoomed in
  updateProvLabels(rect) {
    this.plEls ||= [];
    const show = this.cam.d < 150;
    let used = 0;
    if (show) {
      const P = this.map.provinces;
      const span = this.cam.d * 1.2;
      for (let p = 0; p < this.map.L && used < 140; p++) {
        const sp = P[p];
        if (Math.abs(sp.x - this.cam.x) > span || Math.abs(sp.y - this.cam.z) > span * 0.8) continue;
        if (this.cam.d > 80 && sp.imp < 2 && sp.area < 260) continue;
        this.V3.set(sp.x, this.groundY(sp.x, sp.y) + 0.2, sp.y + 1.2).project(this.camera);
        if (this.V3.z > 1 || Math.abs(this.V3.x) > 1 || Math.abs(this.V3.y) > 1) continue;
        let el = this.plEls[used];
        if (!el) { el = document.createElement('div'); el.className = 'prov-label'; this.overlay.appendChild(el); this.plEls.push(el); }
        if (el._p !== p) { el.textContent = sp.name; el._p = p; el.classList.toggle('city', sp.imp >= 2); }
        el.style.display = '';
        el.style.transform = `translate(${((this.V3.x + 1) / 2 * rect.width) | 0}px, ${((1 - this.V3.y) / 2 * rect.height) | 0}px) translate(-50%, 0)`;
        used++;
      }
    }
    for (let i = used; i < this.plEls.length; i++) this.plEls[i].style.display = 'none';
  }

  // ── camera & input
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  applyCamera() {
    const c = this.cam;
    const t = clamp((c.d - D_MIN) / (D_MAX - D_MIN), 0, 1);
    const pitch = (48 + Math.pow(t, 0.6) * 34) * Math.PI / 180;
    const gy = this.groundY(c.x, c.z);
    this.camera.position.set(c.x, gy + c.d * Math.sin(pitch), c.z + c.d * Math.cos(pitch));
    this.camera.lookAt(c.x, gy, c.z);
    this.camera.far = c.d * 4 + 600;
    this.camera.updateProjectionMatrix();
  }
  flyTo(x, z, d) { this.cam.tx = x; this.cam.tz = z; if (d) this.cam.td = d; }
  flyToProvince(p, d = 120) { const sp = this.map.provinces[p]; this.flyTo(sp.x, sp.y, Math.min(this.cam.td, d)); }
  pickWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    let y = 0;
    const o = ray.ray.origin, d = ray.ray.direction;
    let x = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const t = (y - o.y) / d.y;
      x = o.x + d.x * t; z = o.z + d.z * t;
      y = Math.max(0, this.heightAt(x, z));
    }
    return { x, z };
  }
  provAt(x, z) {
    if (x < 0 || z < 0 || x >= this.map.W || z >= this.map.H) return -1;
    return this.ids2[Math.floor(z * UP) * this.W2 + Math.floor(x * UP)];
  }
  setupInput() {
    const cv = this.canvas;
    let drag = null;
    this.keys = {};
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const w = this.pickWorld(e.clientX, e.clientY);
      drag = { x: e.clientX, y: e.clientY, wx: w.x, wz: w.z, btn: e.button, moved: false, box: e.shiftKey && e.button === 0 };
      if (drag.box) { this.boxEl = document.createElement('div'); this.boxEl.className = 'select-box'; this.overlay.appendChild(this.boxEl); }
    });
    cv.addEventListener('pointermove', (e) => {
      if (drag) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
        if (drag.moved && drag.box) {
          const r = cv.getBoundingClientRect();
          const x0 = Math.min(drag.x, e.clientX) - r.left, y0 = Math.min(drag.y, e.clientY) - r.top;
          Object.assign(this.boxEl.style, { left: x0 + 'px', top: y0 + 'px', width: Math.abs(e.clientX - drag.x) + 'px', height: Math.abs(e.clientY - drag.y) + 'px' });
        } else if (drag.moved && (drag.btn === 0 || drag.btn === 1)) {
          const w = this.pickWorld(e.clientX, e.clientY);
          this.cam.tx += drag.wx - w.x; this.cam.tz += drag.wz - w.z;
          this.cam.x = this.cam.tx; this.cam.z = this.cam.tz;
          this.applyCamera();
          const w2 = this.pickWorld(e.clientX, e.clientY);
          drag.wx = w2.x; drag.wz = w2.z;
        }
      }
      const w = this.pickWorld(e.clientX, e.clientY);
      const p = this.provAt(w.x, w.z);
      if (p !== this.hover) {
        if (this.hover >= 0) this.setFlag(this.hover, 2, false);
        this.hover = p;
        if (p >= 0) this.setFlag(p, 2, true);
      }
      this.emit('hover', p, e);
    });
    cv.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.box && this.boxEl) {
        const r = cv.getBoundingClientRect();
        const box = this.boxEl.getBoundingClientRect();
        this.boxEl.remove(); this.boxEl = null;
        if (d.moved) {
          const ids = [];
          for (const [id, el] of this.armyEls) {
            if (el.style.display === 'none') continue;
            const b = el.getBoundingClientRect();
            const cx = b.left + b.width / 2, cy = b.bottom;
            if (cx >= box.left && cx <= box.right && cy >= box.top && cy <= box.bottom) ids.push(id);
          }
          this.emit('boxSelect', ids);
          void r;
          return;
        }
      }
      if (d.moved) return;
      const w = this.pickWorld(e.clientX, e.clientY);
      const p = this.provAt(w.x, w.z);
      if (d.btn === 2) this.emit('rightClick', p, e);
      else if (d.btn === 0) this.emit('provinceClick', p, e);
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const before = this.pickWorld(e.clientX, e.clientY);
      const f = Math.exp(e.deltaY * 0.0012 * (e.deltaMode === 1 ? 30 : 1));
      this.cam.td = clamp(this.cam.td * f, D_MIN, D_MAX);
      // zoom towards the cursor
      const k = 1 - this.cam.td / this.cam.d;
      this.cam.tx += (before.x - this.cam.tx) * k * 0.9;
      this.cam.tz += (before.z - this.cam.tz) * k * 0.9;
    }, { passive: false });
    window.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }
  inView(x, y, z) {
    this.V3 ||= new THREE.Vector3();
    this.V3.set(x, y, z).project(this.camera);
    return this.V3.z < 1 && Math.abs(this.V3.x) < 1.15 && Math.abs(this.V3.y) < 1.15;
  }

  hookGame() {
    const g = this.game;
    let colorTimer = null, labelTimer = null, bTimer = null;
    const recolor = () => { if (!colorTimer) colorTimer = setTimeout(() => { colorTimer = null; this.refreshColors(); }, 60); };
    const relabel = () => { if (!labelTimer) labelTimer = setTimeout(() => { labelTimer = null; this.refreshLabels(); }, 800); };
    const rebuild = () => { if (!bTimer) bTimer = setTimeout(() => { bTimer = null; this.refreshBuildings(); }, 120); };
    g.on('owner', () => { recolor(); relabel(); rebuild(); });
    g.on('control', recolor);
    g.on('claims', recolor);
    g.on('diplo', () => { if (this.mode === 'diplomacy' || this.mode === 'political') recolor(); });
    g.on('war', recolor);
    g.on('building', rebuild);
    g.on('siege', rebuild);
    g.on('province', () => { if (this.mode !== 'political') recolor(); });
    g.on('month', () => { if (this.mode !== 'political') recolor(); this.setSeason(); rebuild(); });
    g.on('nationChanged', () => { recolor(); relabel(); });
    g.on('nationGone', () => { relabel(); });
    g.on('armyMoved', () => this.refreshPaths());
    g.on('army', () => this.refreshPaths());
    g.on('armyGone', () => this.refreshPaths());
    g.on('reset', () => { this.refreshColors(); this.refreshLabels(); this.refreshBuildings(); this.refreshPaths(); });
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const c = this.cam;
    // keyboard pan
    const sp = c.d * 1.1 * dt;
    if (this.keys.w || this.keys.arrowup) c.tz -= sp;
    if (this.keys.s || this.keys.arrowdown) c.tz += sp;
    if (this.keys.a || this.keys.arrowleft) c.tx -= sp;
    if (this.keys.d || this.keys.arrowright) c.tx += sp;
    if (this.keys.q || this.keys['-']) c.td = Math.min(D_MAX, c.td * (1 + dt * 1.8));
    if (this.keys.e || this.keys['=']) c.td = Math.max(D_MIN, c.td * (1 - dt * 1.8));
    c.tx = clamp(c.tx, 0, this.map.W); c.tz = clamp(c.tz, 0, this.map.H);
    const k = 1 - Math.exp(-dt * 9);
    c.x += (c.tx - c.x) * k; c.z += (c.tz - c.z) * k; c.d += (c.td - c.d) * k;
    this.applyCamera();
    const near = clamp((260 - c.d) / 200, 0, 1);
    this.uniforms.uTime.value = t;
    this.uniforms.uNear.value = near;
    this.uniforms.uPolAlpha.value = 0.3 + 0.52 * (1 - near);
    this.uniforms.uBorderAlpha.value = clamp((520 - c.d) / 380, 0, 1) * 0.65;
    const showDetail = c.d < 300;
    for (const m of this.trees) m.visible = c.d < 330;
    for (const m of Object.values(this.bmesh)) m.visible = showDetail;
    for (const l of this.labelGroup.children) {
      const op = clamp((c.d - 110) / 160, 0, 1) * clamp((l.userData.size * 34 - c.d) / 200 + 0.6, 0.15, 1);
      l.material.opacity = op;
      l.visible = op > 0.02;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.updateArmies(t);
    this.updateMarkers();
    this.updateProvLabels(rect);
    if (this.pathGroup.children.length && this._lastPathRefresh !== this.game.s.day) { this._lastPathRefresh = this.game.s.day; this.refreshPaths(); }
    this.renderer.render(this.scene, this.camera);
  }
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }

function labelName(n) {
  return n.name.replace(/^(Kingdom|Duchy|County|Principality|Grand Principality|Margraviate|Republic|Tsardom|Banate|Sultanate|Empire) of (the )?/, '').replace(/ Republic$/, '').replace(/^Holy Roman Empire$/, 'Holy Roman Empire');
}

function textTexture(text, color) {
  const fs = 96;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `700 ${fs}px Cinzel, "Trajan Pro", Georgia, serif`;
  const w = Math.ceil(ctx.measureText(text).width + fs * 0.6 + text.length * fs * 0.12);
  cv.width = w; cv.height = Math.ceil(fs * 1.4);
  ctx.font = `700 ${fs}px Cinzel, "Trajan Pro", Georgia, serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${fs * 0.12}px`;
  const [r, g, b] = hexToRgb(color);
  const dark = `rgb(${r * 0.3 | 0},${g * 0.3 | 0},${b * 0.3 | 0})`;
  ctx.lineWidth = fs * 0.1; ctx.strokeStyle = 'rgba(255,248,230,0.55)';
  ctx.strokeText(text, w / 2, cv.height / 2);
  ctx.fillStyle = dark;
  ctx.fillText(text, w / 2, cv.height / 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
