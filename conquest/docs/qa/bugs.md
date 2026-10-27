# Open sim bugs (debugger log)
Reported to fixer (session_01DWFX6UDAcppDhULwit3mH3) 2026-10-27, from docs/qa/sim-2026-10-26.md; status checked against dev a11225e (docs/qa/sim-2026-10-27.md, 20y seeds 1-2):
| bug | repro | status on dev a11225e |
|---|---|---|
| frozen world (borders never change) | longrun --years 50 --seeds 1; top3 identical y1..y50 | still failing (ALM 858 / CUM 480 / BYZ 424 at y20) |
| uncapped armies, tick ms 8→26 | longrun --years 50; armies 100→330, men 0.7M→3M | not reproducible in 20y: 1.05M men y20, 12 ms/day; recheck at 50y |
| non-mutual alliances (BYZ/SER, HRE/BAV, ENG/TOU, PIS/GEN…) | longrun --years 20 --seeds 1,2 | still failing (hundreds of hits) |
| negative morale (reg morale -0.005) | seed 2 day 2979 | still failing (minor) |
| MON alive with 0 provinces; 0-regiment armies | 50y seeds 1-3 | not seen in 20y |
`controller = -2` is the rebel sentinel, not a bug (invariant fixed).

## 2026-10-27 12:40 re-test (dev 2ba98df + ws/design,battle,progression,military,ui merged in scratch; fix/conquest not on remote yet)
check 60/60, smoke OK, longrun 20y×2 no crash (13 ms/day avg, 1.0M men y20), `tools/qa/visual.cjs` OK (far/mid/close render fine).
Still failing: frozen world (ALM858/CUM477/BYZ420 at y20), non-mutual alliances (HRE/BAV, LOM/FLO, PAP/GEN, ENG/TOU…), 0-regiment army (seed 2 day 396).
Visual (ws/design, minor): far zoom shows repeating diamond/star-shaped light patches across open sea (west of Ireland/France).

## 2026-10-27 13:25 verify fix/conquest a4442e9 (20y×2 seeds)
VERIFIED: non-mutual alliances, tick time (13.2/13.6 ms/day at y20), army growth, sea-diamond render (ws/design). Borders: 412/346 provinces changed owner by y20 (new `provs changed owner` column) – "frozen world" withdrawn (top-3 sizes understate turnover).
Open (minor): transient 0-regiment army (1 hit/seed), regiment morale slightly negative (-0.02). Tick still ~13 ms vs 10 budget.
