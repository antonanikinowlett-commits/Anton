// Visual regression smoke: boots the UI, screenshots far/mid/close zoom, reports blank/uniform frames and page errors.
// Usage: node tools/qa/visual.cjs [outDir]   (run from a checkout root; serves ../..)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..'), outDir = path.resolve(process.argv[2] || path.join(root, 'docs/qa/shots'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => { const f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise((r) => server.listen(0, r)); fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(`http://localhost:${server.address().port}/index.html?perf=1`);
  await p.waitForSelector('#start .nitem', { timeout: 240000 });
  await p.evaluate(() => [...document.querySelectorAll('#start .nitem')].find((n) => /France/.test(n.textContent)).click());
  await p.evaluate(() => [...document.querySelectorAll('.btn')].find((b) => /Rule the/.test(b.textContent)).click());
  await p.waitForTimeout(4000);
  const bad = [];
  for (const [name, d] of [['far', 700], ['mid', 220], ['close', 70]]) {
    await p.evaluate((d) => { const v = window.__view, c = v.cam; const g = window.__game, cap = g.s.nations[g.s.player]?.capital; const sp = g.map.provinces[cap >= 0 ? cap : 0]; c.x = c.tx = sp.x; c.z = c.tz = sp.y; c.d = c.td = d; v.dirty = true; }, d);
    await p.waitForTimeout(2500);
    const f = path.join(outDir, `${name}.png`); await p.screenshot({ path: f, timeout: 120000 });
    const st = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 36; return null; });
    const buf = fs.readFileSync(f); // crude uniformity check: compressed size of a flat frame is tiny
    console.log(`${name}: ${buf.length} bytes`); if (buf.length < 60000) bad.push(`${name} frame suspiciously small (${buf.length}B) – blank/broken render?`);
  }
  const fps = await p.evaluate(() => { const v = window.__view; return v.perf || v.stats || null; }).catch(() => null);
  console.log('perf', JSON.stringify(fps));
  if (errs.length) bad.push('errors: ' + [...new Set(errs)].slice(0, 5).join(' | '));
  await b.close(); server.close(); console.log(bad.length ? 'VISUAL PROBLEMS\n' + bad.join('\n') : 'visual OK'); process.exit(bad.length ? 1 : 0);
})();
