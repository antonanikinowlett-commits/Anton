// Run a snippet against a fresh game: node tools/qa/eval.cjs <file.js> [--tag FRA] [--seed 1] [--difficulty normal]
// The snippet is the body of an async function (g, G helpers available): `return` the string to print.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(__dirname, '../..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await browser.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto(`http://localhost:${server.address().port}/tools/qa/play.html`);
  await p.waitForFunction('window.ready', null, { timeout: 600000 });
  const code = fs.readFileSync(path.resolve(process.argv[2]), 'utf8');
  const out = await p.evaluate(async ([code, tag, seed, diff]) => { const g = window.mkGame(tag, +seed, diff); const f = new (Object.getPrototypeOf(async function () {}).constructor)('g', code); return await f(g); }, [code, arg('tag', 'FRA'), arg('seed', 1), arg('difficulty', 'normal')]);
  console.log(out);
  await browser.close(); server.close();
})();
