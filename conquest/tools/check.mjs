// Syntax-checks every ES module in js/ with `node --check`. Usage: npm run check
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
  }
})(path.join(root, 'js'));
let bad = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { bad++; console.error(path.relative(root, f) + '\n' + e.stderr.toString()); }
}
console.log(`${files.length - bad}/${files.length} modules OK`);
if (!bad) {
  try { execFileSync(process.execPath, [path.join(root, 'tools/validate_data.mjs')], { stdio: 'inherit' }); }
  catch { bad++; }
}
process.exit(bad ? 1 : 0);
