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
