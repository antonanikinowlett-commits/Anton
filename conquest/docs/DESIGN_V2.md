# Crown & Conquest — Design V2 ("Midnight Chancery")

Supersedes `STYLE.md` (illuminated manuscript / HOI4 brown). V1 failed in playtest: walls of small text in brown
boxes, a 12-button sidebar, emoji icons, and a map that read as flat coloured blobs with stair-stepped borders.

## 1. Idea

> **A scribe's night desk laid over a painted vellum map.**
> The *map* is warm, painterly parchment — soft watercolour realms, ink coast lines, hill-shading.
> The *interface* is cool, deep ink-slate glass with gold-leaf accents. Warm map / cool chrome means the
> eye always knows which is "world" and which is "controls".

Principles
1. **One focal point per screen.** The map is the hero; chrome is thin, dark, translucent.
2. **Progressive disclosure.** First screen = top bar + a 5-button dock + minimap. Everything else opens on demand.
3. **Cards, not tables.** A card has an icon, a big heading, one highlighted number, short text and a clear action.
4. **Gold = interactive or important.** Body text is never gold. Primary action = one gold button per card.
5. **Numbers are the UI.** Key numbers are large, tabular, coloured by meaning (green/red) — text is secondary.
6. **Never emoji.** Every pictogram is an inline SVG from `js/ui/icons.js` (`el()` converts legacy emoji automatically).

## 2. Palette (CSS variables on `:root`)

### Ink (chrome)
| Token | Value | Use |
|---|---|---|
| `--ink-1000` | `#06090f` | behind modals, map vignette |
| `--ink-950` | `#0a0f17` | top bar, dock base |
| `--ink-900` | `#0f1621` | panel body |
| `--ink-850` | `#131c2a` | card |
| `--ink-800` | `#182234` | raised card, input |
| `--ink-700` | `#213049` | hover, track of bars |
| `--ink-600` | `#2d4060` | strong border, pressed |
| `--line` | `rgba(190,208,240,.10)` | hairlines |
| `--line-2` | `rgba(190,208,240,.18)` | borders of controls |

### Text
`--tx-1 #eef2f8` (primary, 15:1) · `--tx-2 #b4bfd0` (secondary, 9:1) · `--tx-3 #7c8aa3` (labels ≥ 11px, 4.8:1) · `--tx-4 #55627a` (disabled only)

### Gold leaf
`--gold-200 #f8e8b8` · `--gold-300 #f3dc9c` · `--gold-400 #e8c56d` (accent text) · `--gold-500 #d9a93f` (buttons) · `--gold-600 #b2832a` · `--gold-700 #7a5a1c`

### Semantic pigments
`--red #e0644d` (war, loss, danger) · `--green #5cc08c` (gain, allied) · `--blue #6f9bf0` (info, diplomacy) ·
`--amber #f0a54a` (warning, unrest) · `--violet #a98be0` (dynasty, intrigue) · `--teal #4fc0b4` (trade, sea)

### Vellum (documents: events, treaties, lore text)
`--vellum #efe3c6` · `--vellum-2 #e2d3ae` · `--vellum-ink #33261a` · `--vellum-red #8a2c1c`

### Map palette (shader)
Political fills are *muted watercolour*: realm colour is desaturated ~22 % and lightened toward vellum
(`#e9dcc0`) at far zoom, returning to full saturation under the borders and at close zoom. Water: deep
`#1c3a52` → shallow `#5d9aa0`, ink coast `#2a2118`. Realm borders: 2.2 px dark ink with an inner glow in the
realm colour. Province borders: 0.8 px, 35 % ink, fade out above d≈700.

## 3. Type

| Role | Family | Use |
|---|---|---|
| Display | **Cormorant Garamond** 600/700 (+italic) | realm names, panel titles, dates, hero, map labels |
| UI | **Inter** 400/500/600/700, `font-feature-settings: "tnum","cv11"` | everything else |

Scale (px): `11 micro-caps (+.14em, tx-3)` · `12 meta` · `13 body-s` · `14 body` · `16 lead` · `20 h3 (display)` ·
`26 h2 (display)` · `34 h1 (display)` · `64 hero (display)`. Line-height 1.4 body, 1.1 display.
Numbers in cards use display face at 22–30px.

## 4. Space, shape, depth
- 4 px grid: `--s1 4 · --s2 8 · --s3 12 · --s4 16 · --s5 24 · --s6 32 · --s7 48`.
- Radius: `--r1 6` (controls), `--r2 10` (cards), `--r3 16` (panels, modals).
- Panels: `linear-gradient(180deg, rgba(19,28,42,.92), rgba(11,17,27,.94))`, `backdrop-filter: blur(14px)`, 1px `--line-2`
  border, inner top highlight `inset 0 1px 0 rgba(255,236,170,.07)`, shadow `0 18px 50px rgba(0,0,0,.5)`.
- Gold hairline under panel headers: `linear-gradient(90deg, transparent, --gold-600, transparent)`.

## 5. Components (all in `css/style.css`)
| Class | Description |
|---|---|
| `.frame` | translucent panel surface (legacy name kept) |
| `.card` / `.card.hl` | ink-850 tile, 10px radius; `.hl` = gold edge + glow |
| `.btn`, `.btn.primary/.danger/.green/.ghost/.small/.icon` | 34px high; primary is gold gradient; press = 1px down |
| `.chip` / `.pill` | rounded meta label; `.good/.bad/.warn/.info` |
| `.stat` / `.stat-grid` | big number + micro-caps caption |
| `.bar` (+ `.green/.red/.blue`) | 8px rounded progress with soft inner shadow |
| `.subtabs/.subtab` | underline tabs (gold on active) |
| `.seg` | segmented control |
| `.section` | micro-caps heading with trailing hairline |
| `.tbl` | zebra-free table with hairline rows (use only for ledgers) |
| `.dock`, `.dock-btn` | bottom action bar, icon over micro-label, red notification dot |
| `.rpill` | resource pill in the top bar: icon, value, delta |
| `.tech-*` | node-link technology graph |
| `.unit-card`, `.army-card` | military cards |
| `.banner` | full-width animated announcement (coronation, war) |
| `.toast` | slide-in card with coloured left rail by level |

## 6. Layout (1280×720 minimum)
```
┌ top bar ─ realm badge │ gold food manpower prestige legit stability  [more ▾] │ date ▶ ▮▮▮ ☰ ┐
│                                                                                     toasts →  │
│ outliner (collapsed to a 36px rail by default ▸)                                              │
│                                    MAP                                                        │
│  province card (left, bottom)                                       mode ▾  ┌ minimap 180×140 ┐│
│                      ┌──────────── dock: Realm · Military · Economy · Diplomacy · Progress ───┐│
```
Panels slide in from the left over the map (max 460px, wide panels up to 1100px) and have a group tab strip
in their header (Realm group: Realm/Court/Laws/Focus; Economy: Economy/Trade/Treasury/Ledger; Military: Military/Wars).

## 7. Motion
- Panels: translateX(-16px)+fade, 180 ms `cubic-bezier(.2,.8,.2,1)`.
- Hover: 120 ms colour/elevate; buttons lift 0 → -1px, brightness 1.08.
- Click: press 60 ms; WebAudio tick.
- Banners (war, peace, coronation, battle): scale 0.96 → 1, 400 ms in, hold 2.4 s, 500 ms out; gold sweep on the title.
- Armies on the map: standard sways (CSS), selected pulses; battle start = white flash ring.
- Respect `prefers-reduced-motion`.

## 8. Sound (WebAudio only, `js/ui/sfx.js`)
click, panel, coin, horn (war), clash (battle), fanfare (coronation), page (event). Master mute + volume in
Settings (`cc_settings.sound`). No external files; default volume 0.5.

## 9. Map rendering rules (js/render)
- Province ids are sampled as *nearest*; borders come from a **smooth coverage field** (`tEdge`, own-province
  fraction in a 9×9 window, bilinear) so lines are sub-texel smooth and have constant screen width.
- Realm border = ownership differs across the line; province border = same owner.
- Colour edge anti-aliased by blending with the neighbour colour across the same field.
- Far zoom: paper grain + vignette + muted colours; terrain hillshade softened; labels curved along the realm's
  principal axis, small caps, letter-spaced, 0.55 opacity; fade out at close zoom.
- Armies: banner standards (flag in realm colour, pole, strength pip row by unit class: ●inf ▲cav ◆siege ◗ranged),
  never a bare number; size scales with zoom.
