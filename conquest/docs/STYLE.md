# Crown & Conquest — visual style guide

**Direction: illuminated manuscript meets HOI4.** HOI4 supplies the structure: dense, readable panels, a dark
chrome that recedes behind the map, and strong realm colours. The manuscript supplies the materials:
oak-gall ink, gold leaf, vermilion and lapis, parchment for anything "written" (events, treaties, laws),
and heraldic shields wherever a realm is named.

Rules of thumb:
1. **The map is the hero.** Chrome is dark, low-saturation and thin; colour on screen should mostly come
   from realm colours and heraldry.
2. **Gold means interactive or important**, never decoration alone. Body text is never gold.
3. **One icon language.** Every pictogram is from `js/ui/icons.js` (see §4); no emoji in shipped UI.
4. **Parchment for documents, wood-and-ink for controls.** Event pop-ups, peace treaties, law texts and
   the ledger use the parchment surface; buttons, tabs and lists use the dark chrome.

Owner: art director (`ws/design`). The UI workstream applies this file to `css/style.css`.

---

## 1. Palette tokens

All colours are CSS custom properties on `:root`. Names in **bold** already exist in `css/style.css`;
the rest are new and should be added verbatim. Keep the existing names — code references them.

### Chrome (dark wood & ink)
| Token | Value | Use |
|---|---|---|
| **`--bg0`** | `#12100d` | deepest background, overlays behind modal dialogs |
| **`--bg1`** | `#1d1914` | panel body |
| **`--bg2`** | `#27211a` | panel header, raised rows |
| **`--bg3`** | `#332b22` | hover rows, inputs |
| **`--line`** | `#4d4132` | 1 px dividers, card borders |
| **`--ink`** | `#1b1510` | text on parchment |

### Gold leaf
| Token | Value | Use |
|---|---|---|
| **`--gold`** | `#d4af5f` | section headings, active tab, frame accents |
| **`--gold2`** | `#f0d48a` | titles, key numbers, hovered gold |
| **`--gold-d`** | `#8a6d33` | frame borders, button borders |
| `--gold-grad` | `linear-gradient(180deg, #f0d48a 0%, #d4af5f 45%, #8a6d33 100%)` | crowns, rank badges, primary-button rim |

### Text
| Token | Value | Contrast on `--bg1` |
|---|---|---|
| **`--text`** | `#ece2cc` | 13.6 : 1 — body |
| **`--text2`** | `#b9ab90` | 7.7 : 1 — secondary |
| **`--muted`** | `#857a66` | 4.1 : 1 — labels ≥ 12 px only, never for numbers the player acts on |

### Manuscript pigments (semantic)
| Token | Value | Meaning |
|---|---|---|
| **`--red`** | `#c84a3a` | vermilion — negative, war, danger, losses |
| **`--green`** | `#6fae5a` | verdigris — positive, gains, allied |
| **`--blue`** | `#5a8ad0` | lapis — information, diplomacy, neutral selection |
| `--purple` | `#9a6ac0` | tyrian — dynasty, characters, intrigue |
| `--amber` | `#e09a3a` | warnings, unrest, pending decisions |
| `--faith` | `#e8e0c8` | religion & clergy (lily-white) |

### Parchment surface (documents)
| Token | Value | Use |
|---|---|---|
| **`--parch`** | `#e9dcbc` | parchment body |
| **`--parch2`** | `#d8c79e` | parchment edge / ruled lines |
| `--parch-ink` | `#2a1e12` | text on parchment (11.9 : 1) |
| `--parch-red` | `#9a2a1a` | rubric: headings & initials on parchment |
| `--parch-edge` | `radial-gradient(ellipse at center, transparent 55%, rgba(110,70,20,.35) 100%)` | aged vignette overlay |

### Heraldic tinctures (fixed; used by `heraldry.js`, banners and 3D flags)
| Tincture | Value | | Tincture | Value |
|---|---|---|---|---|
| or | `#e2b93b` | | azure | `#2a5aa8` |
| argent | `#f1eee4` | | vert | `#2e7a3a` |
| gules | `#c0282d` | | sable | `#1d1d1d` |
| purpure | `#7a3a8a` | | tenné | `#b8652a` |
| sanguine | `#8a1e24` | | | |

The rule of tincture applies when composing new arms: never a *colour* (gules, azure, vert, sable,
purpure) charge on a *colour* field, nor a *metal* (or, argent) charge on a metal field — except where
history disagrees (Jerusalem's or on argent is canon).

### Exact CSS to add to `:root`
```css
  --gold-grad: linear-gradient(180deg, #f0d48a 0%, #d4af5f 45%, #8a6d33 100%);
  --purple: #9a6ac0;
  --amber: #e09a3a;
  --faith: #e8e0c8;
  --parch-ink: #2a1e12;
  --parch-red: #9a2a1a;
  --parch-edge: radial-gradient(ellipse at center, transparent 55%, rgba(110, 70, 20, .35) 100%);
  --radius: 3px;          /* buttons, chips, inputs */
  --radius-lg: 4px;       /* frames, cards */
  --icon: 16px;           /* default inline icon size */
  --sp1: 4px; --sp2: 8px; --sp3: 12px; --sp4: 16px; --sp5: 24px;
  --t-fast: .12s; --t-med: .25s;
```

---

## 2. Typography

Two families only, both already loaded from Google Fonts in `index.html`:

| Role | Family | Weight | Size | Tracking | Case |
|---|---|---|---|---|---|
| Display (loading, start screen, realm name) | Cinzel | 900 | 40–54 px | .06em | as written |
| Panel title (`.frame-title`) | Cinzel | 700 | 15 px | .08em | UPPER |
| Section heading (`.section`) | Cinzel | 500 | 13 px | .10em | UPPER |
| Table header / tag (`.tbl th`, `.tag`) | Cinzel | 500 | 11 px | .08em | UPPER |
| Body | EB Garamond | 400 | 15 px | 0 | sentence |
| Numbers that matter (treasury, manpower, war score) | EB Garamond | 600 | 15 px | 0 | `font-variant-numeric: lining-nums tabular-nums` |
| Flavour / quotes / event body | EB Garamond | 400 *italic* | 15–16 px | 0 | sentence |
| Map labels | Cinzel | see §6 | | | |

- Minimum size **12 px** for anything the player reads; 11 px only for Cinzel caps labels.
- Numbers always use `tabular-nums` so columns don't jitter while the clock runs.
- Event and treaty texts open with a **drop-cap**: first letter Cinzel 900, 2.6em, `--parch-red`,
  floated left (`.dropcap::first-letter`).
- Roman numerals for regnal numbers ("Philip II"); Arabic for everything else. Dates read
  "14 March 1203".

---

## 3. Panel chrome

```
┌─ 1px --gold-d border, radius 4 ─────────────────────┐
│ ▓ header: --bg2, Cinzel title, close ✕ at right     │  height 38px, 1px --line bottom
│─────────────────────────────────────────────────────│
│ body: gradient rgba(38,32,25,.97) → rgba(24,20,16,.97)
│ inner padding 12px; sections separated by .section  │
└─────────────────────────────────────────────────────┘
  shadow: 0 6px 24px rgba(0,0,0,.55); inset 0 0 0 1px rgba(0,0,0,.6)
```
- **Corners:** frames get small gold corner brackets (an 8 × 8 L in `--gold` at each corner, via
  `.frame::before/::after` with `border-image` or background SVG `assets/ui/corner.svg`). This is the
  one ornament the chrome is allowed.
- **Buttons:** dark wood (`#4a3d2c → #2c241a`), 1 px `--gold-d` rim, 3 px radius, icon + label with
  6 px gap. Primary = gilt (`#8a6a2a → #5a4216`, rim `--gold`). Danger = vermilion. Height 28 px
  (small: 22 px). Hover = brightness 1.25; disabled = 45 % opacity + desaturate.
- **Tabs (left rail):** 48 × 48, icon 24 px centred, hotkey letter bottom-right in Cinzel 10 px
  `--muted`. Active tab: `--gold` 2 px left bar + icon in `--gold2`.
- **Cards / list rows:** `rgba(255,240,210,.04)` fill, 1 px `--line`, radius 4; highlighted = `--gold`
  border + 8 % gold fill.
- **Bars:** 7 px tall, track `#15110d`, fill colour by meaning (gold default, green/red/blue semantic).
- **Tooltips:** `--bg0` at 96 %, 1 px `--gold-d`, max-width 380 px; first line Cinzel 13 px `--gold2`;
  modifiers as two-column rows with signed values coloured pos/neg.
- **Parchment dialogs** (events, peace, laws): `--parch` with `--parch-edge` overlay, `--parch-ink`
  text, 2 px `--gold-d` outer rim + 1 px `--parch2` inner rule 4 px inset, illustration slot 100 % ×
  140 px at top, options as dark-chrome buttons at the bottom.

---

## 4. Icons

Source of truth: `js/ui/icons.js` (inline SVG path data, so the single-file build and `file://` work).
`assets/icons/*.svg` are the same glyphs exported as files for docs, previews and the issue tracker
(`node assets/icons/export.mjs`).

**Grid.** 24 × 24 viewBox, 2 px safe margin (live area 20 × 20), filled silhouettes — no hairline
strokes, minimum feature 1.5 px so glyphs survive at 14 px. Optical weight: the glyph's ink should
cover ~45 % of the live area; tall/thin glyphs (sword, key) may run edge-to-edge vertically.

**Colour.** Glyphs use `currentColor`; they inherit text colour. Semantic colour comes from the
container (`.pos`, `.neg`, `.gold`), never from the icon. Exception: `coin` and `crown` may be drawn
with `--gold-grad` via `icon(name, {gilt: true})` in the top bar.

**API.**
```js
import { icon, iconFor, ICONS } from './icons.js';
icon('sword')                 // '<svg class="ic" …>' at 1em
icon('coin', { size: 20, title: 'Treasury', gilt: true })
iconFor('⚔')                  // the icon replacing an emoji, or the emoji itself if unmapped
```
CSS (add to `style.css`):
```css
.ic { width: 1em; height: 1em; display: inline-block; vertical-align: -0.14em; fill: currentColor; flex: none; }
.ic.gilt { filter: drop-shadow(0 1px 0 rgba(0,0,0,.6)); }
```

**Naming:** lowercase noun, one word where possible (`sword`, `castle`, `manpower`). The emoji →
icon table lives in `EMOJI` in `icons.js`; the UI swaps emoji by calling `iconFor()` (or by passing
data strings through `iconize(html)`), so data tables (`focus.js`, `events.js`, `traits.js`) can keep
their emoji keys until their owners migrate.

---

## 5. Realm colours — legibility rules

Realm colours (`nations.js → color`) are the map's main signal. Rules for any new or changed colour:

1. **Lightness band:** OKLCH L between 0.42 and 0.78. Darker reads as "occupied/dead", lighter washes
   out against the parchment terrain and white labels.
2. **Chroma floor:** C ≥ 0.06, so no realm looks like neutral terrain or uncolonised land
   (`#9a9080` grey is reserved for unowned / rebels).
3. **Neighbour distance:** two realms sharing a border must differ by ΔE (OKLab) ≥ 0.12; if the hue
   is the same family, separate them by ≥ 0.15 in L.
4. **Reserved hues:** pure red `#c0282d`-ish (gules) only for realms whose arms are gules-dominant
   (England, Castile, Aragon…); vermilion `--red` is never a realm colour (it means war in the UI).
5. **Vassals** render as their overlord's colour lightened by 18 % with a 1 px darker inner border;
   occupied land uses diagonal stripes of the occupier's colour at 45° over the owner's.
6. **Labels on realm colour:** always `#fff8e0` with a 3 px `#000` halo — never coloured text on the
   map.

---

## 6. Map labels

| Kind | Font | Size | Colour | Treatment |
|---|---|---|---|---|
| Realm name | Cinzel 700 | scales with realm extent, 14–64 px | `#fff8e0` at 85 % | tracking .25em, curved along the realm's long axis, 2 px dark halo, UPPER |
| Capital / city | Cinzel 700 | 13 px | `#ffe9a8` | 3 px halo + small gold square marker |
| Province | Cinzel 500 | 11 px | `#fff8e0` | 3 px halo; only at close zoom |
| Sea zone | EB Garamond italic | 13–18 px | `#cfe0ea` at 75 % | tracking .3em, no halo, never UPPER |
| Rivers/straits | EB Garamond italic | 11 px | `#cfe0ea` | only at close zoom |

Label density: at most one label per ~120 × 40 screen px; drop province labels before city labels,
city labels before realm labels.

---

## 7. Heraldry, portraits and rank

- **Shields** (`heraldry.js`): heater shield, 100 × 120 viewBox, 5 px dark rim + 2 px gold inner rim,
  soft diagonal light. Rank is shown *above* the shield, never by changing the shield:
  - Emperor: closed imperial crown with arch & orb · King: open crown, 5 fleurons · Duke/Prince:
    ducal coronet (strawberry leaves) · Count: pearl coronet · Tribe/chiefdom: torc · Theocracy:
    mitre (Catholic) / klobuk (Orthodox) · Republic: none (merchant cap for doges).
  - Use `coaSVG(coa, size, { rank })` — rank crowns are drawn only at size ≥ 28.
- **Portraits** (`portrait.js`): 64 × 80, painted-miniature look: background radial gradient in the
  realm's colour, flat shapes with one shadow tone; clothing and headgear by culture group and role.
- **Banners & army counters:** realm colour field with the shield's charge in its tincture.

---

## 8. 3D models (`js/render/models.js`)

- Low-poly, vertex-coloured, flat-shaded; one merged geometry per kind (one InstancedMesh each).
- **Budget:** ≤ 300 triangles per building kind, ≤ 150 per unit figure. Total kinds ≤ 40.
- Palette: limestone `#b9b1a3`, shadow stone `#8f877a`, timber `#7a5634`, thatch `#c9a75a`,
  terracotta `#a5523a`, slate `#5a6070`, whitewash `#e8e2d2`, gilt `#d4a83a`, steppe felt `#d8c8a0`.
- Silhouette first: each kind must be identifiable as a 24 px black shape (castle ≠ church ≠ mosque;
  knight ≠ levy ≠ horse archer). Culture variants vary roofs and towers, not the footprint.

---

## Changelog
- v1 (ws/design) — initial guide: tokens, type scale, chrome, icon grid, realm colour rules, labels.
