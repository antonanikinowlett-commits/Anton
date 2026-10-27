// Long all-AI simulation QA. Usage: node tools/qa/longrun.cjs [--years 50] [--seeds 1,2,3] [--out docs/qa/sim-DATE.md]
// Runs in headless Chromium (map generation needs canvas). Writes a markdown report + raw JSON next to it.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const years = +arg('years', 50), seeds = arg('seeds', '1,2,3').split(',').map(Number);
const date = new Date().toISOString().slice(0, 10);
const root = path.resolve(__dirname, '../..');
const out = path.resolve(root, arg('out', `docs/qa/sim-${date}.md`));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await browser.newPage();
  const pageErrors = []; p.on('pageerror', (e) => pageErrors.push(e.message));
  await p.goto(`http://localhost:${server.address().port}/tools/qa/longrun.html`);
  await p.waitForFunction('window.ready', null, { timeout: 600000 });
  const results = [];
  for (const seed of seeds) {
    const t0 = Date.now();
    const r = await p.evaluate(([s, y]) => window.runSeed(s, y), [seed, years]);
    r.wallS = Math.round((Date.now() - t0) / 1000);
    results.push(r); console.log(`seed ${seed}: ${r.crash ? 'CRASH day ' + r.crash.day : 'ok'} wars ${r.wars} battles ${r.battles} alive ${r.finalAlive} violations ${Object.keys(r.violations).length} (${r.wallS}s)`);
  }
  await browser.close(); server.close();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify(results));
  let md = `# Simulation QA report ${date}\n\nCommand: \`node tools/qa/longrun.cjs --years ${years} --seeds ${seeds.join(',')}\`  (dev @ ${require('child_process').execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()})\n\n`;
  md += '| seed | crash | wars | battles | alive@end | max realm share | longest peace (d) | rebel armies@end | save/load | s/yr tick ms (first→last) |\n|---|---|---|---|---|---|---|---|---|---|\n';
  for (const r of results) md += `| ${r.seed} | ${r.crash ? 'day ' + r.crash.day : 'no'} | ${r.wars} | ${r.battles} | ${r.finalAlive} | ${(r.maxRealmShare * 100).toFixed(0)}% | ${r.longestPeaceDays} | ${r.revolts} | ${r.saveload.filter((x) => x.ok).length}/${r.saveload.length} | ${r.years[0]?.ms}→${r.years.at(-1)?.ms} |\n`;
  for (const r of results) {
    md += `\n## Seed ${r.seed}\n`;
    if (r.crash) md += `\n**CRASH** day ${r.crash.day} ${r.crash.date}\n\`\`\`\n${r.crash.stack}\n\`\`\`\n`;
    for (const s of r.saveload.filter((x) => !x.ok)) md += `\nSave/load failed at year ${s.y}: ${s.err}\n`;
    const v = Object.values(r.violations).sort((a, b) => b.n - a.n);
    if (v.length) md += `\nInvariant violations (${v.length} kinds):\n` + v.slice(0, 25).map((x) => `- x${x.n} (first day ${x.first}): ${x.example}`).join('\n') + '\n';
    md += '\n| yr | tick ms avg | max | alive | top 3 | wars | armies | men | rebels |\n|---|---|---|---|---|---|---|---|---|\n';
    for (const y of r.years.filter((y) => y.y % 5 === 0 || y.y === 1)) md += `| ${y.y} | ${y.ms} | ${y.msMax} | ${y.alive} | ${y.top} | ${y.wars} | ${y.armies} | ${y.men} | ${y.rebels} |\n`;
  }
  if (pageErrors.length) md += `\nPage errors:\n${[...new Set(pageErrors)].slice(0, 10).join('\n')}\n`;
  fs.writeFileSync(out, md); console.log('report ' + out);
})();
