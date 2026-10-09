// Bundles the whole game into one self-contained HTML file that runs by double-clicking
// (file://), no web server needed. Usage: node tools/build_single.mjs <path-to-esbuild-binary>
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const esbuild = process.argv[2] || 'esbuild';
const js = execFileSync(esbuild, [path.join(root, 'js/main.js'), '--bundle', '--format=iife', '--minify', '--target=es2020', '--legal-comments=none'], { maxBuffer: 64 << 20 }).toString();
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const body = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<link rel="stylesheet" href="css/style.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="js/main.js"></script>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
fs.writeFileSync(path.join(root, 'CrownAndConquest.html'), body);
console.log('wrote CrownAndConquest.html', (body.length / 1e6).toFixed(2), 'MB');
