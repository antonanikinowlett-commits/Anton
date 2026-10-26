# Product manager (`pm`)
Owns `docs/ROADMAP.md`, `docs/specs/*`, the GitHub issue board. Writes no game code.

1. Read every brief in `docs/workstreams/` and play the game (`npm run smoke` gives you a screenshot; `tools/debug_sim.html` gives a simulated campaign). Write `docs/ROADMAP.md`: the vision in one paragraph (HOI4-depth medieval grand strategy), milestones M1 "solid core" / M2 "deep systems" / M3 "polish & onboarding", and which issues belong to each.
2. Create the labels `ws:<area>` for every area in `docs/TEAM.md`, plus `p1`, `p2`, `p3`, `bug`, `spec`. Then file 5–10 well-scoped issues per area with acceptance criteria, avoiding duplicates of the brief goals already in progress.
3. Write specs for cross-cutting features that need several areas (e.g. crusades: diplomacy + politics + ai + content + ui), splitting them into per-area issues that reference the spec.
4. Every time you are woken: triage new QA bugs (label, priority, owner), close stale or duplicate issues, and update the roadmap's progress. Report blockers or decisions the owner must make to the orchestrator.

## Status
Handover 2026-10-26 (session stopped by orchestrator for a model change).

Done
- Read all briefs, MODULES, ARCHITECTURE; ran `npm run smoke` on `dev` (3c573bc): smoke OK, 365 days in 3759 ms (≈10.3 ms/day, at the 10 ms budget), only 4 wars in year 1 (all in Eastern Europe, none in the West), 0 siege assaults, tutorial popup covers the map at boot.
- Specs written in `docs/specs/`: `crusades.md` (diplomacy+politics+ai+content+ui), `trade.md` (economy+diplomacy+ai+ui+render), `saves.md` (ui+map+qa; `load()` has no version check, saves capped at 3 in localStorage).
- GitHub board was empty; no labels or issues created yet.

Next
1. Create labels (`ws:map`, `ws:render`, `ws:battle`, `ws:military`, `ws:ai`, `ws:diplomacy`, `ws:politics`, `ws:content`, `ws:economy`, `ws:ui`, `ws:design`, `ws:progression`, `qa`, `p1`–`p3`, `bug`, `spec`) — the GitHub MCP has no create-label tool; labels are auto-created when first applied to an issue.
2. File 5–10 issues per area (avoid repeating brief goals), plus per-area issues for each spec. Observed candidates: tick at budget (ws:ai/ws:military perf), too few wars in the West (ws:ai), AI never assaults sieges (ws:ai), tutorial blocks map at start (ws:ui), save versioning (spec saves.md), only 25 events (ws:content).
3. Write `docs/ROADMAP.md` (vision, M1 solid core / M2 deep systems / M3 polish & onboarding, issue numbers per milestone).
4. Message the orchestrator (session_0128P3AFKxV4tjv9UaBUuG4q) when the roadmap and first issue batch are up.
