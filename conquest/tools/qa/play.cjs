// Headless "player" playtest: node tools/qa/play.cjs --tag FRA --years 5 [--bot passive|active] [--seed 1] [--difficulty normal]
// Prints a monthly digest of what the player sees (money, wars, threats, events) so design problems can be read as text.
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
  const out = await p.evaluate(([tag, years, bot, seed, diff]) => {
    const g = window.mkGame(tag, +seed, diff); const me = g.s.player; const lines = [];
    const n = () => g.s.nations[me];
    const L = (t) => lines.push(`${g.date().y}-${String(g.date().m + 1).padStart(2, '0')} ${t}`);
    L(`START ${n().name} prov ${g.ownedProvinces(me).length} gold ${Math.round(n().gold)} mp ${Math.round(n().manpower)} armies ${g.armiesOf(me).length} neighbours ${[...g.neighbours(me)].map((o) => g.s.nations[o].tag + '(' + Math.round(g.power(o) / g.power(me) * 100) + '%)').join(' ')}`);
    let lastWars = new Set(), events = 0, evTitles = {}, lastLog = 0;
    const total = years * 365;
    for (let d = 0; d < total; d++) {
      g.tickDay();
      if (g.s.eventQueue.length) { while (g.s.eventQueue.length) { const q = g.s.eventQueue[0]; const ev = g.eventDef(q.id); events++; evTitles[ev?.title || q.id] = (evTitles[ev?.title || q.id] || 0) + 1; if (ev?.options) g.chooseEvent(0); else g.s.eventQueue.shift(); } }
      const dt = g.date();
      const ws = new Set(g.warsOf(me).map((w) => w.id));
      for (const w of g.warsOf(me)) if (!lastWars.has(w.id)) L(`WAR started: ${w.name} score ${w.score}`);
      for (const id of lastWars) if (!ws.has(id)) L(`WAR ended: ${id}`);
      lastWars = ws;
      if (dt.d === 2) {
        if (bot === 'active') window.activeBot && window.activeBot(g, me);
        if (dt.m % 3 === 0) { const B = g.budget(me); L(`gold ${Math.round(n().gold)} (${B.net >= 0 ? '+' : ''}${B.net.toFixed(1)}) mp ${Math.round(n().manpower)}/${n().maxManpower} stab ${n().stability.toFixed(1)} leg ${Math.round(n().legitimacy)} prestige ${Math.round(n().prestige)} prov ${g.ownedProvinces(me).length} armies ${g.armiesOf(me).length}/${Math.round(g.armiesOf(me).reduce((t, a) => t + g.armyMen(a), 0))}men wars ${ws.size} known ${n().prog.known.length} focus ${n().focus.done.length}`); }
      }
      if (d % 30 === 0) { for (const e of g.s.log.filter((x) => x.day > lastLog && (x.nation === me)).reverse()) L('  log: ' + e.text); lastLog = g.s.day; }
    }
    const s = g.s;
    L(`END prov ${g.ownedProvinces(me).length} events ${events} ${JSON.stringify(evTitles)}`);
    L(`wars total ${Object.keys(s.wars).length}; AI-AI wars now ${Object.values(s.wars).map((w) => w.name).join(' | ')}`);
    return lines.join('\n');
  }, [arg('tag', 'FRA'), +arg('years', 5), arg('bot', 'passive'), arg('seed', 1), arg('difficulty', 'normal')]);
  console.log(out);
  await browser.close(); server.close();
})();
