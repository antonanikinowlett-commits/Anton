// Safety net: any emoji written into the DOM via innerHTML / textContent becomes an inline SVG icon
// (see icons.js), so panels added later by other workstreams never show system emoji.
import { iconize, hasEmoji } from './icons.js';

let done = false;
export function installEmojiPatch() {
  if (done) return;
  done = true;
  const ih = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true, enumerable: ih.enumerable, get: ih.get,
    set(v) { ih.set.call(this, typeof v === 'string' && hasEmoji(v) ? iconize(v) : v); },
  });
  const tc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  Object.defineProperty(Node.prototype, 'textContent', {
    configurable: true, enumerable: tc.enumerable, get: tc.get,
    set(v) {
      if (this.nodeType === 1 && typeof v === 'string' && hasEmoji(v)) ih.set.call(this, iconize(v.replace(/&/g, '&amp;').replace(/</g, '&lt;')));
      else tc.set.call(this, v);
    },
  });
}
