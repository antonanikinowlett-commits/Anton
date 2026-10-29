# Interface Change Requests

Append requests here instead of editing files outside your folder. The orchestrator
reviews them during integration and marks each one `ACCEPTED (commit)`, `REJECTED (reason)` or `DONE`.

Template:

```
### [module] Short title
- What: exact change (file, member, signature)
- Why: gameplay/perf reason
- Workaround in the meantime: ...
- Status: OPEN
```

---

### [ui] Include match stats in FootballMatch.get_result()
- What: in `FootballMatch.get_result()` add `"stats"` = `get_meta(&"ui_stats_tracker").to_dict()` when that meta exists (set by `UiStatsTracker.ensure_for(match)`, created by the HUD / half-time scene). Guard with `has_meta`.
- Why: post-match currently falls back to the static `UiStatsTracker.last_stats` snapshot (kept after the match node is freed). Putting stats into the result dictionary makes the hand-off explicit and testable for QA / replays.
- Workaround in the meantime: `post_match.gd` reads `result["stats"]` if present, else `UiStatsTracker.last_stats`.
- Status: OPEN

### [ui] FYI: half-time overlay pauses the match
- What: `ui/menus/half_time.tscn` calls `match.set_paused(true)` on `EventBus.half_time` and `set_paused(false)` on CONTINUE, so the referee's HALF_TIME phase timer only runs after the player taps CONTINUE. It sets match meta `ui_blocking_overlay = true` while shown so the pause menu does not stack on top.
- Why: RULES must not rely on `phase_timer` expiring while the overlay is visible; the second-half kickoff happens after CONTINUE.
- Workaround in the meantime: none needed (UI-only behaviour).
- Status: OPEN (FYI)

### [ui] FYI: custom_button_positions format
- What: `GameSettings.custom_button_positions` holds `{slot:int -> Vector2}` normalized in the right-handed button zone (x 0 = zone left edge, 1 = screen edge; mirrored automatically when `left_handed`). Read it only via `UiTouchLayout.button_center()` (`ui/touch/ui_touch_layout.gd`).
- Why: keeps the editor preview and the in-game controls identical.
- Status: OPEN (FYI)
