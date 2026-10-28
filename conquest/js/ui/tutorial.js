// Dynamic tutorial: steps advance when the player actually does the thing, adapt their
// text to the chosen realm, skip what the player already did, and contextual hints pop
// up the first time a new situation (battle, siege, debt, revolt…) arises.
import { el, store } from '../util.js';

export class Tutorial {
  constructor(ui) {
    this.ui = ui; this.g = ui.g; this.v = ui.v;
    this.i = 0; this.active = false; this.seen = new Set(JSON.parse(store.get('cc_hints') || '[]'));
  }
  ctx() {
    const g = this.g, n = g.player;
    const r = g.s.chars[n.ruler];
    const rival = n.focusRival ? g.nationByTag(n.focusRival) : null;
    return { n, title: g.rulerTitle(n), ruler: g.charName(r), cap: n.capital >= 0 ? g.provName(n.capital) : 'your capital', rival: rival ? rival.name : 'your neighbours' };
  }
  steps() {
    const g = this.g, ui = this.ui, v = this.v;
    const C = this.ctx();
    const pid = g.s.player;
    return [
      { t: `Welcome, ${C.title} ${C.ruler}`, x: `You rule the <b>${C.n.name}</b> in the year of Our Lord 1200. Europe is divided into thousands of provinces whose borders will shift with every war and treaty.<br><br>This guide adapts to what you do — follow it or skip it at any time.`, next: true },
      { t: 'The Map', x: 'Use the <b>mouse wheel</b> to zoom, <b>drag</b> with the left button (or <b>WASD</b>) to pan. Zoom in close on your capital to see your realm come alive.', done: () => v.cam.d < 150 },
      { t: 'A Living Realm', x: 'Up close every castle, church, mosque, farm, market, mine and harbour you own is shown in 3D, as are your soldiers on the march. Zoom out and the political map with realm names returns.', next: true },
      { t: 'Provinces', x: `Click your capital, <b>${C.cap}</b>, to open its province panel.`, done: () => ui.selProv === C.n.capital, onEnter: () => { if (C.n.capital >= 0) v.flyToProvince(C.n.capital, 110); } },
      { t: 'Building', x: 'Here you see terrain, development, culture, faith, unrest and fortifications. Click an empty <b>building slot</b> to construct: farms feed armies, markets fill the treasury, castles stop invaders.', target: '#prov .bgrid', done: () => g.ownedProvinces(pid).some((p) => g.s.prov[p].queue.length) },
      { t: 'Resources', x: 'Your treasury and stores are along the top. <b>Hover</b> any of them for a full breakdown of where it comes from and where it goes.', target: '.res', next: true },
      { t: 'The Military', x: 'Open the <b>Military</b> panel (button or key <b>M</b>).', target: '#tab-military', done: () => ui.tab === 'military' },
      { t: 'Army Templates', x: 'Open <b>Army Templates</b>. Each regiment type matters: pikes stop cavalry, archers win the skirmish, knights shatter infantry on open ground, horse archers wear down slow armies. The designer shows your army\'s battle profile and weaknesses.', target: '#panel .subtabs', done: () => ui.subtab.mil === 'templates' },
      { t: 'Muster an Army', x: 'Pick a template and press <b>Recruit</b>. The regiments assemble after some weeks and cost gold, iron, horses and manpower.', target: '#panel', done: () => g.s.recruit.some((r) => r.nation === pid) || this.flag.recruited },
      { t: 'Command', x: 'Close the panel and <b>click one of your army counters</b> on the map (the small banners with numbers).', done: () => ui.selArmies.some((i) => g.s.armies[i]?.nation === pid), onEnter: () => { const a = g.armiesOf(pid)[0]; if (a) v.flyToProvince(a.loc, 160); } },
      { t: 'Marching', x: '<b>Right-click</b> a province to march there. Forests, hills, marshes, rivers and winter slow you; an enemy castle blocks the road until besieged. From a coast you can even sail across the sea.', done: () => g.armiesOf(pid).some((a) => a.path.length) },
      { t: 'Time', x: 'The game is paused. Press <b>Space</b> or ▶ to let time flow; keys <b>1–5</b> set the speed.', target: '.timebox', done: () => ui.speed > 0 && g.s.day > this.startDay + 3 },
      { t: 'National Focus', x: 'Open the <b>National Focus</b> tree (<b>F</b>) and pick a first focus. Your tree is built from your government, faith, rivals and history.', target: '#tab-focus', done: () => !!C.n.focus.cur },
      { t: 'The Court', x: 'Open <b>Court & Estates</b> (<b>C</b>). Every councillor applies his skill to the realm. The nobles, clergy, burghers and peasants must be kept loyal — powerful, disloyal estates rebel.', target: '#tab-court', done: () => ui.tab === 'court' },
      { t: 'Laws', x: 'Open <b>Laws</b> (<b>L</b>). Each law is only offered if it suits your government and faith, and has prerequisites: crown authority must be raised step by step, serfs freed only after legal reform. The estates vote by influence.', target: '#tab-laws', done: () => ui.tab === 'laws' },
      { t: 'Diplomacy', x: `Open <b>Diplomacy</b> (<b>G</b>). Make allies and marriages, demand vassals and declare wars. Wars need a casus belli — claims, holy war, reconquista — or cost stability. Your natural rival seems to be <b>${C.rival}</b>.`, target: '#tab-diplomacy', done: () => ui.tab === 'diplomacy' },
      { t: 'War', x: 'Battles are fought when armies meet. Terrain, weather, rivers, high ground, frontage, generals, morale and your mix of troops decide them; each phase your general picks a historical tactic that may counter the enemy\'s. Click the ⚔ on the map to watch battles unfold.', next: true },
      { t: 'Alerts & Goals', x: 'Round discs at the top of the map are <b>alerts</b>: things that need you (idle research, a free ambition, an empty council seat, debt, war). Click one to jump straight to it. The <b>Outliner</b> on the right lists your armies, sieges, construction, <b>goals</b> and recent news.', target: '#alerts', next: true },
      { t: 'Research', x: 'Open the <b>Progress</b> panel (key <b>I</b>). Innovations form a tree of four branches and three eras; each unlocks bonuses and sometimes units or laws. Learning, development, churches and your neighbours speed research up.', target: '#tab-progress', done: () => ui.tab === 'progress' },
      { t: 'Choose an Innovation', x: 'Click an available innovation to start researching it. Hover for its effects, cost and prerequisites. Only one is researched at a time, and a top-bar alert reminds you when none is.', done: () => !!C.n.prog?.cur || C.n.prog?.known.length > 0 },
      { t: 'Ambitions', x: 'On the <b>Ambitions</b> tab choose a personal goal for your ruler: win battles, build a cathedral, expand. Fulfil it before the deadline for prestige and legitimacy; fail and prestige suffers. <b>Realm Rank</b> and <b>Decisions</b> (forming Iberia, Italy or Rus\') live in the same panel.', done: () => !!C.n.prog?.amb || (C.n.prog?.ambDone || 0) > 0 },
      { t: 'The Treasury', x: 'Open the <b>Treasury</b> (key <b>T</b>): gold sinks such as development, patronage and projects. A full treasury does nothing for you; an empty one in war loses it.', target: '#tab-treasury', done: () => ui.tab === 'treasury' },
      { t: 'Trade', x: 'Open <b>Trade</b> (key <b>K</b>). Goods flow along routes between nodes such as Venice, Constantinople or Bruges, and every realm collects by <b>trade power</b>. Send a <b>merchant</b> to collect or to steer value downstream; ports and markets raise your power; embargoes (Diplomacy) cripple rivals.', target: '#tab-trade', done: () => ui.tab === 'trade' },
      { t: 'Fronts & Divisions', x: 'In the <b>Military</b> panel, <b>Fronts</b> assign armies to a border and let them hold, advance or siege on their own. Select two armies in the same province and use <b>merge</b> to combine divisions; reinforce losses from the army panel.', target: '#tab-military', next: true },
      { t: 'Doctrines', x: 'Your realm follows a <b>national military doctrine</b> and each army a <b>battle doctrine</b> (defensive, shock, maneuver...). Choose them in the Military panel to suit your terrain, troops and enemies; changing costs prestige.', target: '#tab-military', next: true },
      { t: 'Making Peace', x: 'War ends in <b>Wars & Peace</b> (key <b>X</b>): press <b>Negotiate peace on the map</b>, then <b>click the enemy provinces you want</b>; the bar shows whether they will accept. Provinces you occupy cost less. When an AI sues for peace you can simply <b>Accept</b> or <b>Refuse</b>.', target: '#tab-wars', next: true },
      { t: 'Difficulty', x: `You are playing on <b>${g.s.difficulty === 'hard' ? 'Hard' : 'Normal'}</b>. On Hard the other realms are richer and far more eager to attack you. Idle treasuries and a spotless reputation attract demands, pretenders and wars: rule actively.`, next: true },
      { t: 'Go forth!', x: `That is all you need, ${C.title}. New hints will appear as new situations arise (battles, sieges, revolts, debts). Glory awaits!`, next: true, last: true },
    ];
  }
  start() {
    this.active = true; this.i = 0; this.flag = {};
    this.startDay = this.g.s.day;
    this.ui.on('recruited', () => { this.flag.recruited = true; });
    this.show();
    this.timer = setInterval(() => this.check(), 300);
  }
  stop() { this.active = false; clearInterval(this.timer); this.card?.remove(); this.ring?.remove(); this.ui.root.classList.remove('tut-on'); }
  show() {
    const S = this.steps();
    this.card?.remove(); this.ring?.remove();
    if (this.i >= S.length) { this.stop(); return; }
    const st = S[this.i];
    if (st.onEnter) st.onEnter();
    // skip steps the player has already accomplished
    if (st.done && st.done() && !st.next) { this.i++; return this.show(); }
    this.ui.root.classList.add('tut-on');
    this.card = el('div', { class: 'tut frame' });
    this.card.innerHTML = `<div class="tp-bar"><i style="width:${Math.round(100 * (this.i + 1) / S.length)}%"></i></div><div class="tp">Guide · step ${this.i + 1} of ${S.length}</div><div class="tt">${st.t}</div><div class="tx">${st.x}</div>`;
    const row = el('div', { class: 'row', style: { marginTop: '8px' } });
    if (st.next) row.append(el('div', { class: 'btn primary small', onclick: () => { if (st.last) { this.stop(); return; } this.i++; this.show(); } }, st.last ? 'Finish' : 'Next ›'));
    row.append(el('div', { class: 'btn small', onclick: () => this.stop() }, 'Skip tutorial'));
    this.card.append(row);
    document.body.append(this.card);
    this.place(st);
  }
  place(st) {
    // The card lives in the right-hand column (below the outliner) so it never sits on top of a control;
    // a pulsing ring marks the thing it talks about.
    const modal = document.querySelector('.modal-back');
    this.card.style.visibility = modal ? 'hidden' : '';
    if (modal) this.ring?.remove();
    const out = document.getElementById('outliner');
    this.card.style.top = Math.max(124, (out ? out.getBoundingClientRect().bottom : 114) + 10) + 'px';
    const sel = st.target && st.target.replace(/^#tab-(\w+)$/, (m, id) => this.ui.tabTarget(id));
    const tgt = sel && document.querySelector(sel);
    if (tgt && tgt.offsetParent !== null) {
      const r = tgt.getBoundingClientRect();
      this.ring ||= el('div', { class: 'tut-ring' });
      if (!this.ring.isConnected) document.body.append(this.ring);
      Object.assign(this.ring.style, { left: r.left - 5 + 'px', top: r.top - 5 + 'px', width: r.width + 10 + 'px', height: r.height + 10 + 'px' });
    } else this.ring?.remove();
  }
  check() {
    if (!this.active) return;
    const S = this.steps();
    const st = S[this.i];
    if (!st) return this.stop();
    if (st.done && st.done()) { this.i++; this.show(); return; }
    this.card.style.transform = '';
    this.place(st);
  }

  // ── contextual hints
  hint(id, title, text) {
    if (this.ui.settings && this.ui.settings.tutorial === false) return;
    if (this.seen.has(id)) return;
    this.seen.add(id);
    store.set('cc_hints', JSON.stringify([...this.seen]));
    const h = el('div', { class: 'tut-hint frame' }, el('div', { class: 'tt' }, '💡 ' + title), el('div', { class: 'small', html: text }), el('div', { class: 'btn small', style: { marginTop: '6px' }, onclick: () => h.remove() }, 'Understood'));
    document.body.append(h);
    setTimeout(() => h.remove(), 25000);
  }
  watch() {
    const g = this.g, ui = this.ui, pid = () => g.s.player;
    g.on('battle', (id) => { const b = g.s.battles[id]; if (b && [b.attN, b.defN].includes(pid())) this.hint('battle', 'Battle!', 'Click the <b>⚔</b> icon on the map (or the alert at the top) to watch the battle live. Battles are decided by <b>morale</b>: flanks, charges into unbraced lines and arrow storms break men before they die. Change your army\'s <b>doctrine</b> to influence the tactics your general chooses.'); });
    g.on('siege', (p) => { const sg = g.s.prov[p]?.siege; if (sg && (sg.by === pid() || g.s.prov[p].owner === pid())) this.hint('siege', 'Siege', 'Castles must be starved or battered into surrender. <b>Trebuchets</b> and a general with <b>siege</b> skill speed it up greatly. You may also <b>assault</b> the walls — fast, but bloody. You need 1.5× the garrison to make progress.'); });
    g.on('war', () => { if (g.atWar(pid())) this.hint('war', 'At War', 'Occupy enemy provinces and win battles to raise your <b>war score</b>, then negotiate peace in the <b>Wars & Peace</b> tab (X). Every province you demand costs war score. Taking land angers neighbours (aggressive expansion).'); });
    g.on('month', () => {
      const n = g.player;
      if (!n) return;
      if (n.gold < 0) this.hint('debt', 'In Debt', 'Your treasury is negative: stability drops and interest accrues. Disband idle regiments, build markets, or <b>Demand Funds</b> from an estate in the Court panel.');
      if (n.food < 0) this.hint('food', 'Starvation', 'Your food stores are empty. Armies suffer attrition and morale loss. Build <b>farms</b> and keep armies on friendly soil where they need half as much.');
      if (g.maxUnrest(n.id) > 45) this.hint('unrest', 'Unrest', 'A province is close to revolt. Churches, stability, a loyal peasantry and lower war exhaustion reduce unrest. Use the 🔥 Unrest map mode to find trouble spots.');
      for (const w of g.warsOf(n.id)) { const sc = w.att.includes(n.id) ? w.score : -w.score; if (sc >= 25) this.hint('peace', 'Victory in Sight', 'Your war score is high enough to demand provinces. Open <b>Wars & Peace</b> (X) and click <b>Negotiate peace</b>.'); }
    });
    g.on('event', () => this.hint('event', 'Events', 'Events present choices with consequences shown under each option. The game pauses while you decide.'));
    ui.on('battleViewer', () => this.hint('viewer', 'The Battle Viewer', 'Regiments deploy by terrain frontage: centre, wings, missile line and reserves. Watch the tactic each general picks per phase — a ★ means it <b>counters</b> the enemy\'s choice. You can change doctrine or order a withdrawal to limit the slaughter of the pursuit.'));
  }
}
