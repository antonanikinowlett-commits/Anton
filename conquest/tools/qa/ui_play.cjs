// Playtest through the real UI: node tools/qa/ui_play.cjs [--tag FRA] [--script file.js]
// The script body runs in the page with (g, ui, view, sleep) and may press keys through window.__press(key).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(__dirname, '../..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const u = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  u.on('pageerror', (e) => errors.push('ui: ' + e.message)); u.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await u.goto(`http://localhost:${server.address().port}/index.html`);
  await u.waitForSelector('#start .nitem', { timeout: 180000 });
  const tag = arg('tag', 'France');
  await u.evaluate((t) => [...document.querySelectorAll('#start .nitem')].find((n) => n.textContent.includes(t)).click(), tag);
  await u.evaluate(() => [...document.querySelectorAll('.btn')].find((b) => /Rule the/.test(b.textContent)).click());
  await u.waitForTimeout(3000);
  const code = fs.readFileSync(path.resolve(arg('script')), 'utf8');
  const shots = [];
  const out = await u.evaluate(async (code) => { const f = new (Object.getPrototypeOf(async function () {}).constructor)('g', 'ui', 'view', 'sleep', code); return await f(window.__game, window.__ui, window.__view, (ms) => new Promise((r) => setTimeout(r, ms))); }, code);
  await u.screenshot({ path: path.resolve(arg('shot', '/tmp/claude-0/scratch/ui.png')) });
  console.log(out); if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].join('\n'));
  await browser.close(); server.close();
})();
