// Screenshot harness: node tools/shots.cjs <outdir> [WxH] — start screen, map at 3 zooms, every panel.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || 'shots');
const [W, H] = (process.argv[3] || '1600x900').split('x').map(Number);
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
  await u.goto(`${base}/index.html`);
  await u.waitForSelector('#start .nitem, #start .realm-card', { timeout: 180000 });
  await u.waitForTimeout(1500);
  const shot = async n => { await u.waitForTimeout(+process.env.WAIT || 1400); await u.screenshot({ path: `${out}/${n}.png` }); };
  await shot('00-start');
  await u.evaluate(() => { const c = [...document.querySelectorAll('#start .nitem, #start .realm-card')].find(n => /France/.test(n.textContent)); c.click(); });
  await shot('01-start-france');
  await u.evaluate(() => [...document.querySelectorAll('.btn')].find(b => /Rule the/.test(b.textContent)).click());
  await u.waitForTimeout(4000);
  await shot('02-map-first');
  // close tutorial if any
  const zoom = async (d, n) => { await u.evaluate(d => { const v = window.__view; v.cam.td = v.cam.d = d; v.dirty = true; }, d); await u.waitForTimeout(1200); await shot(n); };
  if (process.env.ZOOM !== '0') { await zoom(330, '03-map-close'); await zoom(800, '04-map-mid'); await zoom(1800, '05-map-far'); await zoom(330, '06-map-close'); }
  if (process.env.SEL) {
    await u.evaluate(() => { const ui = window.__ui, g = ui.g; ui.openTab(null); ui.selectProvince(g.player.capital); });
    await shot('sel-prov');
    await u.evaluate(() => { const ui = window.__ui, g = ui.g; ui.selectProvince(-1); const a = g.armiesOf(g.s.player)[0]; ui.selectArmies([a.id], true); });
    await shot('sel-army');
    await u.evaluate(() => { const ui = window.__ui; ui.selectArmies([]); ui.selectProvince(-1); });
  }
  if (process.env.UIX) {
    await u.evaluate(() => { const ui = window.__ui; ui._outCollapsed = false; ui._outKey = null; ui.updateOutliner(); ui.toggleMoreRes(); });
    await shot('outliner-more');
    await u.evaluate(() => { const ui = window.__ui; ui.toggleMoreRes(); ui.toggleModeMenu(true); });
    await shot('modes');
    await u.evaluate(() => { const ui = window.__ui; ui.toggleModeMenu(false); ui.banner('War declared', 'France · England', 'Reconquest of Claims', 'war'); ui.toast('Battle!', 'Battle of Rouen', 'swords', null, 'critical'); ui.toast('Army mustered', 'First Host is ready at Paris', 'swords'); });
    await shot('banner');
    await u.waitForTimeout(4500);
    await u.evaluate(() => { window.__ui.gameMenu(); });
    await shot('menu');
    await u.evaluate(() => { document.querySelector('.modal-back')?.remove(); window.__ui.settingsModal(); });
    await shot('settings');
    await u.evaluate(() => { document.querySelector('.modal-back')?.remove(); });
  }
  if (process.env.EVENT) {
    await u.evaluate(() => { const g = window.__game; g.s.eventQueue.push({ id: 'plague' }); window.__ui.showEvent(); });
    await shot('event');
    await u.evaluate(() => document.querySelector('.modal .opt')?.click());
  }
  if (process.env.INNOV) await u.evaluate(() => { window.__ui.subtab.progress = 'innov'; window.__ui.subtab.techBranch = 'military'; });
  const keys = process.argv[4] !== undefined ? process.argv[4].split(',').filter(Boolean) : ['c', 'b', 'm', 'l', 'f', 'g', 'i', 'k', 'd', 'e', 't', 'r', 'w'];
  for (const k of keys) { await u.keyboard.press('Escape'); await u.keyboard.press(k); await shot('panel-' + k); }
  await browser.close(); server.close();
})();
