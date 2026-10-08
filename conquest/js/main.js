// Bootstrap: build the world, the renderer and the UI, then run the game loop.
import { generateMap } from './world/mapgen.js';
import { Game } from './sim/game.js';
import { MapView } from './render/map3d.js';
import { UI, SPEEDS } from './ui/ui.js';
import { StartScreen } from './ui/start.js';
import { Tutorial } from './ui/tutorial.js';
import { dateStr } from './util.js';

const loadEl = document.getElementById('loading');
const progress = (msg, f) => {
  loadEl.querySelector('.load-msg').textContent = msg + '…';
  loadEl.querySelector('.load-bar i').style.width = Math.round(f * 100) + '%';
};

async function boot() {
  const map = await generateMap(progress);
  const game = new Game(map);
  game.newGame('FRA');
  game.s.player = -1;
  const view = new MapView(document.getElementById('map'), document.getElementById('overlay'), game, map);
  await view.init(progress);
  view.cam.x = view.cam.tx = 560; view.cam.z = view.cam.tz = 560; view.cam.d = view.cam.td = 980;
  const ui = new UI(document.getElementById('ui'), game, view);
  window.__game = game; window.__view = view; window.__ui = ui;
  let started = false, acc = 0, last = performance.now();
  const tutorial = new Tutorial(ui);

  const startGame = (tag, withTutorial) => {
    game.newGame(tag);
    ui.build();
    started = true;
    ui.setSpeed(0);
    const n = game.player;
    if (n.capital >= 0) view.flyToProvince(n.capital, 330);
    tutorial.watch();
    ui.settings = { pauseOnWar: true, autoBattle: false, tutorial: withTutorial };
    if (withTutorial) setTimeout(() => tutorial.start(), 900);
    else ui.toast(`${n.name}`, 'Press Space to start time. Hover anything for details.', '👑');
  };

  ui.on('save', () => {
    try {
      const key = 'cc_save_' + Date.now();
      const n = game.player;
      localStorage.setItem(key, game.serialize());
      let saves = JSON.parse(localStorage.getItem('cc_saves') || '[]');
      saves.push({ key, name: `${n.name}, ${dateStr(game.s.day)}` });
      while (saves.length > 3) { const old = saves.shift(); localStorage.removeItem(old.key); }
      localStorage.setItem('cc_saves', JSON.stringify(saves));
      ui.toast('Game saved', `${n.name}, ${dateStr(game.s.day)}`, '💾');
    } catch (e) { ui.toast('Save failed', String(e.message || e), '🚫'); }
  });
  ui.on('load', (key) => {
    const json = localStorage.getItem(key);
    if (!json) { ui.toast('Load failed', 'Save not found', '🚫'); return; }
    game.load(json);
    ui.build();
    started = true;
    ui.setSpeed(0);
    ui.settings ||= { pauseOnWar: true, autoBattle: false, tutorial: true };
    tutorial.watch();
    const n = game.player;
    if (n && n.capital >= 0) view.flyToProvince(n.capital, 330);
    ui.toast('Game loaded', dateStr(game.s.day), '📂');
  });
  ui.on('restart', () => location.reload());

  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (started) {
      const sp = SPEEDS[ui.speed];
      if (sp > 0 && !document.querySelector('.modal-back')) {
        acc += dt * sp;
        let n = 0;
        while (acc >= 1 && n < 3) { game.tickDay(); acc -= 1; n++; }
        if (acc > 2) acc = 0;
      }
      game.dayFrac = ui.speed ? acc : 0;
      ui.update();
    }
    view.frame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  loadEl.classList.add('done');
  setTimeout(() => loadEl.remove(), 800);
  new StartScreen(ui, startGame).show();
}

boot().catch((e) => {
  console.error(e);
  progress('Error: ' + (e.message || e), 1);
});
