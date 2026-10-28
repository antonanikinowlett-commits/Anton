// Map-only screenshots: node tools/mapshot.cjs <outdir> <WxH> <x,z,d[,mode]> ...   (camera in map pixels; d = distance)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2]);
const [W, H] = process.argv[3].split('x').map(Number);
const specs = process.argv.slice(4);
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const u = await browser.newPage({ viewport: { width: W, height: H } });
  u.on('pageerror', e => console.log('PAGEERR', e.message));
  u.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  const t0 = Date.now();
  await u.goto(`${base}/index.html`);
  await u.waitForSelector('#start .nitem', { timeout: 300000 });
  console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  await u.evaluate(() => { [...document.querySelectorAll('#start .nitem')].find(n => /France/.test(n.textContent)).click(); const t = document.getElementById('tutchk'); if (t) t.checked = false; });
  await u.evaluate(() => [...document.querySelectorAll('.btn')].find(b => /Rule the/.test(b.textContent)).click());
  await u.waitForTimeout(2500);
  let i = 0;
  for (const sp of specs) {
    const [x, z, d, mode] = sp.split(',');
    await u.evaluate(([x, z, d, mode]) => { const v = window.__view; v.cam.x = v.cam.tx = +x; v.cam.z = v.cam.tz = +z; v.cam.d = v.cam.td = +d; if (mode) v.setMode(mode); v.dirty = true; }, [x, z, d, mode]);
    await u.waitForTimeout(1500);
    await u.screenshot({ path: `${out}/m${String(i++).padStart(2, '0')}_${x}_${z}_${d}${mode ? '_' + mode : ''}.png` });
  }
  await browser.close(); server.close();
})();
