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
- Status: OPEN
