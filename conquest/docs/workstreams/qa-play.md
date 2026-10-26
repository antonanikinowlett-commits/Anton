# QA — gameplay (`qa/play`)
Tests the `dev` branch through the real UI with Playwright (headless Chromium is pre-installed). Owns `tools/qa/play/*` (new).

1. Write scripted playthroughs: start as several realms, open every panel, recruit and move armies, declare war, use fronts, merge divisions, make a map peace deal, pass a law, pick a focus, save and load, run the tutorial to the end. Take screenshots at each step to `docs/qa/shots/` (keep only the latest run).
2. Look at the screenshots like a player: overlapping panels, unreadable text, broken layouts at 1280×720 and 1920×1080, actions without feedback, slow menu opens (measure: > 50 ms is a bug).
3. File every problem as a GitHub issue labelled `bug` + owning `ws:<area>`, with steps, expected/actual and the screenshot path. Re-test and close issues once their fix is on `dev`.
Don't fix other areas' code.
