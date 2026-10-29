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
