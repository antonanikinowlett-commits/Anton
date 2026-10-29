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

### [tactics] Resolve away-kit clash when a match is built
- What: in `FootballMatch.setup` (or UI before building `MatchConfig`), call `TacTeamLibrary.resolve_away_kit(home_data, away_data)` (static, mutates the away `TeamData` colours when the primaries clash).
- Why: SPEC §9 says TACTICS provides the helper and the caller applies it; players are coloured from `TeamData.color_primary` in `Player.setup`.
- Workaround in the meantime: none needed for play; kits may look alike for some pairings.
- Status: OPEN

### [tactics] Pre-match formation change must reorder the squad
- What: when the UI changes `TeamData.tactics.formation_id` before a match, call `TacFormationUtils.arrange_squad(team_data, formation_id)` so `squad[0..10]` matches the new slot roles (Team.setup maps squad[i] to slot i). During a match use `TacFormationUtils.change_formation(team, id)` (remaps `slot_index` / `role` of existing Player nodes; keeps node identity).
- Why: `Team.setup` assigns `starting_xi()[i]` to formation slot i; a mismatch puts e.g. a striker in the LB slot.
- Workaround in the meantime: use only the team's own formation, or call the helpers above from UI.
- Status: OPEN

### [tactics] Set-piece contract notes for RULES/AI
- What: call `team.shape.get_set_piece_position(p, restart)` (cheap, cached ~0.5 s, recomputed when restart type/spot/taker changes) and `team.shape.pick_set_piece_taker(restart)`; the Referee should assign `restart.taker` from it. `restart.wall_distance` (9.15) is honoured for walls.
- Why: documentation of the contract; no core change required.
- Status: OPEN (informational)
### [physics] TeamBrain.set_press_requested(on: bool) for the PRESS button
- What: add `func set_press_requested(on: bool) -> void` to `TeamBrain` (stub no-op) and have `ai/team_ai.gd` make the nearest teammate press the ball carrier while `on` is true.
- Why: the human `PRESS` action (hold) must call a teammate to press (SPEC 6.1) but PHYSICS cannot touch AI state.
- Workaround in the meantime: `physics/human_brain.gd` calls `team.team_brain.set_press_requested(on)` only if the method exists (`has_method`) and meanwhile auto-chases the carrier with the controlled player.
- Status: OPEN

### [physics] InputController hold time should be tick-based, not wall-clock
- What: `InputController.get_hold_time()/get_charge()/consume_release()` use `Time.get_ticks_msec()`. Please count simulation time instead (e.g. `end_tick()` adds `FB.TICK_DT` to each held action's timer).
- Why: determinism and headless fast-forward (a sim running 20x real time charges shots 20x too slowly; tests must `OS.delay_msec`). Real play is unaffected.
- Workaround in the meantime: physics tests sleep with `OS.delay_msec`; `TouchInputController` does not touch hold timing.
- Status: OPEN

### [physics] Intent power semantics for AI / RULES brains (FYI, no core change)
- PASS / THROUGH_PASS / LOB_PASS / CROSS / GK_THROW: `power` is a *weight* around the ideal speed to reach `target_point` (0.5 = arrives with a sensible speed, 0.2 = soft, 0.9 = driven). Distance is taken from `target_point`.
- SHOOT / CLEAR / GK_KICK / SET_PIECE_KICK: `power` is *absolute* strength 0..1 (SHOOT 1.0 is about 30 m/s; SET_PIECE_KICK speed = lerp(7, 31, power); THROW_IN is capped at 19 m/s and always arcs).
- `loft` 0..1 = launch elevation (LOB default 0.5, CROSS 0.45, CLEAR 0.65, GK_KICK 0.7, SHOOT/PASS 0 = on the ground). `curve` -1..1 = sidespin, positive curls to the kicker's left.
- Helpers usable by any module: `preload("res://physics/phys_math.gd")` has `ideal_ground_speed(dist, arrive_speed)`, `lob_speed(dist, elevation)`, `roll_distance(v0, v1)`, `roll_time(v0, v1)`. The ball also offers `predict_landing_time()`.
- The motor also reacts for AI-controlled goalkeepers (auto-dive at on-target shots, catch/parry in reach, auto-punt after 5 s of holding), so the GK AI only needs to position itself. A GK_DIVE intent still overrides it.
- Dead ball: while `ball.frozen`, only `referee.restart.taker` (if set) may kick it, and only while `is_set_piece_pending()`.
- Status: INFO
### [rules] Referee base: expose half-time skip and set-piece UI state
- What: add to `core/interfaces/referee.gd`: `func skip_half_time() -> void: pass` and the public set-piece UI state members `sp_human: bool`, `sp_step: int`, `sp_aim_dir: Vector2`, `sp_power: float`, `sp_curve: float`, `sp_needs_curve: bool`, `sp_origin: Vector2` (all already implemented in `rules/referee_impl.gd`).
- Why: the half-time menu needs a typed way to end the HALF_TIME pause early ("Continue" button; the referee otherwise resumes after `half_time_duration`, 6 s, 0.5 s headless); UI/HUD can read set-piece state without `Object.get()`.
- Workaround in the meantime: `referee.call("skip_half_time")` / `referee.get("sp_step")`.
- Status: OPEN

### [rules] New signal for announced added time
- What: `signal added_time_announced(minutes: int)` on EventBus, emitted by Referee when regulation time of a half ends.
- Why: HUD can show the fourth-official board ("+4").
- Workaround in the meantime: read `referee.stoppage / 60.0` after `referee.clock` passes 45:00 / 90:00 (stoppage is 0 before that).
- Status: OPEN

### [physics] Motor contract needed by the referee (informational)
- What: (1) The motor should ignore/clear `SET_PIECE_KICK` unless the ball is frozen and the taker is within ~1.2 m; when it kicks it must go through `Ball.kick()` so `touched`/`kicked` fire. The referee falls back to its own `Ball.kick()` 0.3 s after writing the intent if nothing touched the ball. (2) `report_contact` should be called for every tackle/shoulder challenge (also clean ones, `ball_first = true`); the referee regulates the overall foul rate (target ~25 per match) itself. (3) After a kick, set `player.touch_cooldown` > 0 so the kicker does not immediately re-collect the ball (a re-touch by the kicker cancels the offside snapshot). (4) The referee pins the set-piece taker to the ball spot every tick and sets `state = SET_PIECE` until play resumes.
- Why: avoids double kicks and keeps offside detection correct.
### [ai] Who issues SET_PIECE_KICK for AI takers?
- What: SPEC 7.10 says AI takers kick via intent `SET_PIECE_KICK`, but the AI brief says RULES handles taker kicks. The AI brain moves everybody (taker included) to `shape.get_set_piece_position()` and issues nothing, except a failsafe: if `restart.taker == player` has waited `AiBrain.TAKER_FAILSAFE` (7 s) in a non-kickoff set piece and stands within 3 m of the ball, it fires `SET_PIECE_KICK` (target = nearest forward teammate, or goal for penalties).
- Why: avoids a dead-lock if RULES expects the brain to kick. RULES should kick well before 7 s so the failsafe never triggers. If RULES wants the AI to choose targets, expose a Referee/shape query and the AI will call it.
- Workaround in the meantime: failsafe above.
- Status: OPEN

### [ai] Wire EventBus.auto_switch_suggested to the human team
- What: TeamAi (human team only) emits `EventBus.auto_switch_suggested(player)` at most once per 1.5 s, only when the human does not own the ball, the ball is in play and a clearly better placed outfield player exists (0.35 s hysteresis bonus for the current player, 0.25 s persistence). Nothing in core/physics consumes it yet. HumanBrain (simple scheme) or core should call `team.set_controlled_player(p)` on it when defending. The explicit SWITCH button keeps using `team_brain.suggest_switch_target()` (never returns the current player or the GK).
- Why: auto-switch is specified but its receiver is not owned by AI.
- Workaround in the meantime: none, the signal is simply unused.
- Status: OPEN

### [ai] Intent semantics assumed by the AI (PHYSICS to confirm)
- What: (1) `GK_DIVE`: `target_point` = ball interception point on the ground plane. (2) `GK_THROW` / `GK_KICK`: `target_point` = receiver position (lead included), `target_player` = receiver or null, `loft` 0..1 for kicks. (3) Ground passes use `power` such that `v0 = lerp(10, 28, power)` m/s (stub mapping); AI picks power with `v0 = sqrt(64 + 6 d)` for about 8 m/s arrival. (4) `SHIELD`: `target_point` = nearest opponent position, re-issued at 10 Hz while shielding (max 1.5 s). (5) `TACKLE`/`SLIDE`: `target_player` = ball carrier. (6) `CLEAR`: `target_point` upfield wide, loft 0.7.
- Why: AI tuning depends on them; deviations change pass weight and save success.
- Workaround in the meantime: values match the core stub motor.
- Status: OPEN

### [ai] Optional: expose TeamAi extras on TeamBrain base
- What: TeamAi adds public members `chaser_eta: float`, `second_presser`, `support_near`, `support_far`, `pressing_active`, `own_has_ball`, `opp_has_ball`, `ball_loose`, `trap_active`. UI/HUD/debug overlays may want them on the `TeamBrain` base (defaults INF/null/false) to read without duck typing. The AI brain currently detects TeamAi via `has_method("is_team_ai")`.
- Why: debug overlays and cleaner typing.
- Workaround in the meantime: duck typing.
- Status: OPEN
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
