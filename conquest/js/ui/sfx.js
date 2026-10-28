// Tiny synthesized sound effects (WebAudio, no files). The AudioContext is created lazily on the first user gesture.
// sfx.play('click' | 'panel' | 'toast' | 'alert' | 'coin' | 'horn' | 'clash' | 'fanfare' | 'page' | 'peace' | 'error')
let ctx = null, master = null, noiseBuf = null;
const state = { on: true, volume: 0.5 };

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = state.volume * 0.6;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}

// helpers -------------------------------------------------------------------
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(type, f0, t, a, d, peak, f1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  env(g, t, a, peak, d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + a + d + 0.05);
  return { o, g };
}
function noise(t, a, d, peak, type, f0, f1, q = 1) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  const g = ctx.createGain(); env(g, t, a, peak, d);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + a + d + 0.05);
}

const SOUNDS = {
  click(t) { tone('sine', 1500, t, 0.002, 0.045, 0.22, 700); noise(t, 0.001, 0.015, 0.1, 'highpass', 3000); },
  panel(t) { noise(t, 0.03, 0.14, 0.12, 'bandpass', 500, 1800, 0.8); },
  toast(t) { tone('sine', 659, t, 0.004, 0.22, 0.16); tone('sine', 988, t + 0.07, 0.004, 0.3, 0.12); },
  alert(t) { tone('triangle', 392, t, 0.004, 0.16, 0.2); tone('triangle', 330, t + 0.12, 0.004, 0.3, 0.2); },
  error(t) { tone('square', 150, t, 0.003, 0.14, 0.12, 100); },
  page(t) { noise(t, 0.02, 0.2, 0.14, 'bandpass', 2400, 900, 0.6); noise(t + 0.09, 0.01, 0.1, 0.08, 'highpass', 3500); },
  coin(t) {
    for (const [f, dt] of [[1568, 0], [2093, 0.07]]) { tone('sine', f, t + dt, 0.002, 0.35, 0.16); tone('sine', f * 2.4, t + dt, 0.002, 0.18, 0.05); }
  },
  horn(t) {
    // two stacked saw tones through a sweeping low-pass: a war horn
    for (const f of [98, 147]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.94, t); o.frequency.linearRampToValueAtTime(f, t + 0.35);
      lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(250, t); lp.frequency.linearRampToValueAtTime(900, t + 0.5); lp.frequency.linearRampToValueAtTime(300, t + 1.5);
      lfo.frequency.value = 5; lg.gain.value = 3; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.25); g.gain.setValueAtTime(0.28, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(lp); lp.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + 1.7); lfo.stop(t + 1.7);
    }
  },
  clash(t) {
    noise(t, 0.002, 0.22, 0.4, 'bandpass', 2600, 900, 1.2);
    tone('square', 820, t, 0.001, 0.32, 0.07, 790); tone('square', 1310, t, 0.001, 0.26, 0.05, 1290); tone('sine', 90, t, 0.002, 0.18, 0.3, 50);
    noise(t + 0.14, 0.002, 0.16, 0.22, 'bandpass', 3200, 1200, 1.4); tone('square', 1010, t + 0.14, 0.001, 0.22, 0.05);
  },
  fanfare(t) {
    const seq = [[392, 0, 0.2], [523, 0.18, 0.2], [659, 0.36, 0.2], [784, 0.54, 0.7]];
    for (const [f, dt, d] of seq) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 1.5;
      env(g, t + dt, 0.03, 0.2, d + 0.25);
      o.connect(lp); lp.connect(g); g.connect(master); o.start(t + dt); o.stop(t + dt + d + 0.4);
    }
  },
  peace(t) { for (const [f, dt] of [[523, 0], [659, 0.1], [784, 0.2]]) tone('sine', f, t + dt, 0.02, 0.9, 0.12); },
};
const LAST = {};

export const sfx = {
  get enabled() { return state.on; },
  get volume() { return state.volume; },
  configure({ sound, volume } = {}) {
    if (sound !== undefined) state.on = !!sound;
    if (volume !== undefined) { state.volume = Math.max(0, Math.min(1, +volume)); if (master) master.gain.value = state.volume * 0.6; }
  },
  play(name) {
    if (!state.on || state.volume <= 0) return;
    const fn = SOUNDS[name];
    if (!fn || !ensure()) return;
    const now = performance.now();
    if (now - (LAST[name] || 0) < 60) return;   // never machine-gun the same sound
    LAST[name] = now;
    try { fn(ctx.currentTime + 0.005); } catch { /* audio is optional */ }
  },
  // call from a user gesture so the browser lets the context start
  unlock() { if (state.on) ensure(); },
};
