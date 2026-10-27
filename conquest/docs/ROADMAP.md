# Roadmap

**Vision.** Crown & Conquest is a browser grand-strategy game of Europe and the Near East from 1200: HOI4-depth warfare (fronts, supply, sieges, battle plans) fused with medieval statecraft (dynasties, estates, laws, the Church, trade). A living AI world should produce plausible history on its own, and a player should be able to pick any realm and have a distinct, readable, fast game.

Specs: `specs/crusades.md`, `specs/trade.md`, `specs/saves.md`. Issues: GitHub, labels `ws:<area>`, `p1`-`p3`, `bug`, `spec`. Each issue body states its milestone.

## M1 — Solid core
Goal: a stable, fast, believable 50-year AI campaign; saves that never break; a first minute that isn't blocked by a popup.
- Perf: tick at budget (≈10.3 ms/day) — #18, #25, #49, #12, #10
- AI world: too few western wars #23 (+ CB data #33, alliances #34), siege assaults #24 (+ #13, #19), border plausibility metrics #26
- Robustness: retreats #16, invariants #21, succession #38, whyNot audit #32
- Saves: #2 (MAP_VERSION), #51 (IndexedDB slots, export), #37 (load back-fill)
- Onboarding basics: tutorial blocks map #50, panel open ≤ 50 ms #54, map graph test #3
- Content: first 25 events #40; design label rules #55; UI adopts palette #1

## M2 — Deep systems
Goal: Church/crusades and trade as full cross-area systems, plus richer events.
- Crusades (spec): #30 API, #35 excommunication effects, #36 generic Fourth Crusade, #27 Pope AI, #42 events, #43 schedule, #20 levies, #17 morale, #5 holy sites, #8 map markers, #52 panel, #56 icons
- Trade (spec): #4 nodes data, #45 node calc, #46 merchants, #47 ledger, #48 calibration, #31 embargo, #29 AI, #7 map mode, #53 panel, #57 icons
- Other: events batch B #41, naval transport #22, unrest warnings #39

- Playtest round 1 (docs/PLAYTEST.md): M1 additions #60 objectives, #61 research panel, #62 gold sinks, #63 alerts bar, #66 start balance, #69 tutorial overlap; M2 additions #64 war screen, #65 supply, #68 espionage; M3 addition #67 sound

## M3 — Polish & onboarding
- #9 label legibility, #11 highlight pulses for hints, #44 start-screen blurbs, #58 start screen/logo, #59 rank regalia, #6 map border review
- Tutorial refresh for fronts, merging and map peace (ws:ui brief)
- Not yet filed: progression, QA tooling and mobile polish issues (add when those roles are staffed).

## Progress
Updated when woken. 2026-10-27: roadmap and first issue batch (#2–#59) filed; no issue closed yet.
