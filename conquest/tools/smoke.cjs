// Headless smoke test: serves the game, runs a year of all-AI simulation (tools/debug_sim.html)
// and boots the real UI as France. Fails on any page error. Usage: npm run smoke [-- days]
// Needs Chromium + Playwright (pre-installed in Claude Code cloud sessions; else `npm i -D playwright`).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const days = +process.argv[2] || 365;
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
  const errors = [];
  try {
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push('sim: ' + e.message));
    await p.goto(`${base}/tools/debug_sim.html?days=${days}`);
    await p.waitForFunction('window.done', null, { timeout: 600000 });
    const out = await p.textContent('#o');
    console.log(out.split('\n').slice(0, 8).join('\n'));
    if (out.startsWith('ERR')) errors.push(out.split('\n').slice(0, 6).join('\n'));

    const u = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    u.on('pageerror', e => errors.push('ui: ' + e.message));
    await u.goto(`${base}/index.html`);
    await u.waitForSelector('#start .nitem', { timeout: 180000 });
    await u.evaluate(() => [...document.querySelectorAll('#start .nitem')].find(n => /France/.test(n.textContent)).click());
    await u.evaluate(() => [...document.querySelectorAll('.btn')].find(b => /Rule the/.test(b.textContent)).click());
    await u.waitForTimeout(4000);
    for (const k of ['c', 'b', 'm', 'l', 'f', 'g', 'Escape']) { await u.keyboard.press(k); await u.waitForTimeout(400); }
    await u.screenshot({ path: path.join(root, 'smoke.png') });
    console.log('UI booted; screenshot at smoke.png');
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.error('FAILED\n' + errors.join('\n')); process.exit(1); }
  console.log('smoke OK');
})();
