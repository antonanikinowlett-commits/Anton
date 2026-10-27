// node assets/icons/export.mjs — writes one .svg per icon next to this file.
import { writeFileSync } from 'node:fs';
import { ICONS } from '../../js/ui/icons.js';
const dir = new URL('.', import.meta.url);
for (const [name, body] of Object.entries(ICONS)) {
  writeFileSync(new URL(`${name}.svg`, dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${body}</svg>\n`);
}
console.log(Object.keys(ICONS).length + ' icons written');
