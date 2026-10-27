# Workstream 2 — Rendering & performance (`ws/render`)
Owns `js/render/*`, `vendor/*`.

Goals
1. Smooth 60 fps zoom/pan on an integrated GPU: profile `map3d.js` (shader cost, label layout, HTML army counters → consider a single canvas/instanced sprite layer), keep render-on-demand.
2. Better close-zoom 3D: per-culture building styles (Latin, Byzantine, Islamic, Rus', Norse), animated marching units, siege camps, battle markers, ships on sea zones.
3. Map visuals: smoother province borders (distance-field borders), parchment-style political mode at far zoom, nicer water, fog-of-war option, seasonal snow tint.
4. A small perf HUD (`?perf=1`) printing frame time and draw calls.
Constraints: don't change the color-table layout without updating every `ci(p,row)` user; keep the vendored three.js r160. Verify visually with screenshots from a headless run (`npm run smoke` writes `smoke.png`).
