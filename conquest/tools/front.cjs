// Headless runner for tools/debug_front.html. Usage: node tools/front.cjs "?war=1&vs=ENG"
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto(`http://localhost:${server.address().port}/tools/debug_front.html${process.argv[2] || ''}`);
  await p.waitForFunction('window.done', null, { timeout: 300000 });
  console.log(await p.textContent('#o'));
  await browser.close(); server.close();
})();
