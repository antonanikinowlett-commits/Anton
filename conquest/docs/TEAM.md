# The team

Every role is a separate, long-running Claude Code session working in the same repo. They share **git** (code), **GitHub issues** (the task board) and **this folder** (specs and status). Nobody shares a chat or a working copy.

| Role | Session works on | Branch |
|---|---|---|
| Orchestrator | merges, unblocks, re-plans; the session the owner talks to | `dev` (integration) |
| Product manager | roadmap, specs, priorities, issue triage, playtest notes | `pm` (docs only) |
| Art director / graphics designer | visual identity: palette, typography, icons, heraldry, map style, 3D look | `ws/design` |
| Progression | innovations tree, realm ranks, ambitions, achievements, long-term goals | `ws/progression` |
| Workstreams 1–10 | see `MODULES.md` (map, render, battle, military, ai, diplomacy, politics, content, economy, ui) | `ws/<name>` |
| QA — simulation | long AI runs, balance, crashes, perf regressions, save/load | `qa/sim` |
| QA — gameplay | plays the real UI in a headless browser, finds UX and interaction bugs | `qa/play` |

## Flow of work
1. **PM** turns the owner's wishes into GitHub issues: title `[area] short summary`, label `ws:<area>` (`ws:battle`, `ws:design`, `qa`, …) plus `p1`/`p2`/`p3`, with acceptance criteria. Bigger features get a spec in `docs/specs/<feature>.md`.
2. **Workers** pick up open issues for their area (highest priority first) after their brief's goals, fix them on their own branch, and close them with the commit hash in a comment.
3. **QA** test the `dev` branch, file bugs with exact reproduction steps against the owning area (see `MODULES.md`), and may push small fixes to `qa/*` only for code no workstream owns.
4. **Orchestrator** periodically merges every `ws/*` and `qa/*` branch that passes `npm run check` + `npm run smoke` into `dev`, resolves conflicts, and tells workers to merge `dev` back into their branch when they have fallen behind.

## Talking to each other
- Durable, asynchronous: GitHub issues and comments (everyone can read them later).
- Urgent or blocking: message the orchestrator session with `send_message` (session id in your first prompt), if your session has that tool. Say what is blocked and what you need.
- Contracts between modules (a new method one area calls on another): open an issue on the owning area, and describe the method signature. Don't edit their files.
- Status: keep a `## Status` section at the end of your brief, updated every time you push.

## Merging rules
- Branch from and regularly merge in `origin/dev` (`git fetch origin dev && git merge origin/dev`). Never rebase or force-push shared branches.
- Never commit `CrownAndConquest.html`; the orchestrator rebuilds it on `dev`.
