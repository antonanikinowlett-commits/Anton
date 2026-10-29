extends Referee
## RULES implementation of the Referee slot (res://rules/referee_impl.gd).
##
## Clock/halves/stoppage, kickoff, goals, out of play, offside (evaluated at the
## moment of the pass), fouls + advantage + cards, and the whole set-piece flow
## (AI takers and the touch-playable human taker).
##
## Design notes:
## * Events reported from inside other nodes' step() (report_contact, on_ball_touched,
##   ball.kicked) are only *recorded*; they are resolved in step() so that we never
##   teleport players while the match loop is iterating them.
## * Set-piece kicks are written as SET_PIECE_KICK intents (the motor may execute
##   them). If nobody touched the ball shortly after, the referee performs the kick
##   itself with Ball.kick(), so restarts never dead-lock on a missing motor feature.

# --- Tunables ----------------------------------------------------------------------
const CELEBRATION_TIME := 3.0
const KICKOFF_TIME := 1.2
const WALL_DISTANCE := 9.15
const THROW_IN_DISTANCE := 2.5
const ADVANTAGE_TIME := 2.5
const FOULS_PER_MATCH := 25.0
const KICK_WAIT := 0.3
const HUMAN_TIMEOUT := 45.0
const STUCK_BALL_TIME := 15.0
const METER_PERIOD := 1.6
const MAX_STOPPAGE := 420.0

enum SpStep { AIM, POWER, CURVE, KICKING }

# --- Public state (read by UI / tests) ----------------------------------------------
## Half-time length in real seconds (shortened automatically in headless matches).
var half_time_duration := 6.0
## Tests: force every reported contact to be a foul.
var debug_force_foul := false
## Tests: -1 random advantage decision, 0 never, 1 always (when possible).
var debug_advantage := -1

var fouls_total := 0
var yellow_total := 0
var red_total := 0
var offsides_total := 0
var corners_total := 0
var throw_ins_total := 0
var goal_kicks_total := 0
var free_kicks_total := 0
var penalties_total := 0
var goals_total := 0
var foul_count := PackedInt32Array([0, 0])

## True while a human is taking the current set piece.
var sp_human := false
var sp_step: int = SpStep.AIM
## Aim direction (unit, world space).
var sp_aim_dir := Vector2.RIGHT
## Live (POWER step) or locked power 0..1.
var sp_power := 0.0
var sp_curve := 0.0
var sp_needs_curve := false
## World position the taker stands at (arrow origin).
var sp_origin := Vector2.ZERO

# --- Internals -----------------------------------------------------------------------
var _ball: Ball
var _prev_ball := Vector2.ZERO
var _stoppage_set := false
var _stop_acc := 0.0
var _since_restart := 0.0
var _active_restart: int = FB.Restart.NONE
var _stuck_t := 0.0

# Touch history (assists).
var _last_toucher: Player = null
var _prev_toucher: Player = null
var _touch_clock := 0.0
var _prev_touch_time := -100.0

# Pending events recorded from callbacks.
var _pf_active := false
var _pf_tackler: Player
var _pf_victim: Player
var _pf_ball_first := false
var _pf_intensity := 0.0
var _pf_from_behind := false
var _po_active := false
var _po_player: Player
var _po_pos := Vector2.ZERO

# Offside snapshot taken when the ball is kicked.
var _off_list: Array[Player] = []
var _off_kicker: Player
var _off_team := -1
var _exempt_next_kick := false

# Restrictions after restarts.
var _no_direct_goal := false
var _nd_taker: Player

# Advantage.
var _adv_active := false
var _adv_timer := 0.0
var _adv_team := -1
var _adv_pos := Vector2.ZERO
var _adv_offender: Player

# Set piece working state.
var _sp_time := 0.0
var _ai_delay := 1.2
var _taker_spot := Vector2.ZERO
var _meter_t := 0.0
var _k_pending := false
var _k_wait := 0.0
var _k_target := Vector2.ZERO
var _k_power := 0.5
var _k_loft := 0.0
var _k_curve := 0.0
var _goal_conceding := 0


# ======================================================================================
# Lifecycle
# ======================================================================================
## Wires ball signals and computes the clock scale.
func setup(m: FootballMatch) -> void:
	super.setup(m)
	_ball = m.ball
	_ball.kicked.connect(_on_ball_kicked)
	EventBus.substitution.connect(_on_substitution)
	if m.headless:
		half_time_duration = 0.5


## Starts the first half with a random kickoff team.
func start_match() -> void:
	half = 1
	clock = 0.0
	stoppage = 0.0
	_stoppage_set = false
	_stop_acc = 0.0
	first_kickoff_team = football_match.rng.randi_range(0, 1)
	_prev_ball = _ball.pos
	begin_kickoff(first_kickoff_team)


## Skips the remaining half-time pause (UI "continue" button).
func skip_half_time() -> void:
	if phase == FB.MatchPhase.HALF_TIME:
		phase_timer = 0.0


## Fixed-step update (60 Hz). No allocations.
func step(delta: float) -> void:
	match phase:
		FB.MatchPhase.KICKOFF:
			_step_kickoff(delta)
		FB.MatchPhase.PLAYING:
			_tick_clock(delta)
			_step_playing(delta)
		FB.MatchPhase.SET_PIECE:
			_tick_clock(delta)
			_step_set_piece(delta)
		FB.MatchPhase.STOPPED:
			_tick_clock(delta)
			phase_timer -= delta
			if phase_timer <= 0.0:
				set_phase(FB.MatchPhase.PLAYING)
		FB.MatchPhase.GOAL_CELEBRATION:
			_tick_clock(delta)
			phase_timer -= delta
			if phase_timer <= 0.0:
				if _is_expired():
					_end_half()
				else:
					begin_kickoff(_goal_conceding)
		FB.MatchPhase.HALF_TIME:
			phase_timer -= delta
			if phase_timer <= 0.0:
				_start_second_half()
	_prev_ball = _ball.pos


func is_ball_in_play() -> bool:
	return phase == FB.MatchPhase.PLAYING


## Summary counters (tests/debug).
func get_stats() -> Dictionary:
	return {
		"fouls": fouls_total, "yellows": yellow_total, "reds": red_total,
		"offsides": offsides_total, "corners": corners_total, "throw_ins": throw_ins_total,
		"goal_kicks": goal_kicks_total, "free_kicks": free_kicks_total,
		"penalties": penalties_total, "goals": goals_total,
	}


# ======================================================================================
# Clock
# ======================================================================================
func _tick_clock(delta: float) -> void:
	clock += delta * time_scale
	if not _stoppage_set and clock >= FB.HALF_GAME_SECONDS * half:
		_stoppage_set = true
		stoppage = clampf(ceilf(_stop_acc / 60.0) * 60.0, 60.0, MAX_STOPPAGE)


func _is_expired() -> bool:
	return _stoppage_set and clock >= FB.HALF_GAME_SECONDS * half + stoppage


func _end_half() -> void:
	_clear_transient()
	EventBus.whistle.emit(FB.Whistle.LONG)
	if half == 1:
		for t: Team in football_match.teams:
			t.attack_dir = -t.attack_dir
		_ball.place(Vector2.ZERO)
		phase_timer = half_time_duration
		set_phase(FB.MatchPhase.HALF_TIME)
		EventBus.half_time.emit()
	else:
		set_phase(FB.MatchPhase.FULL_TIME)
		EventBus.full_time.emit(football_match.teams[0].score, football_match.teams[1].score)
		football_match.finish()


func _start_second_half() -> void:
	half = 2
	clock = FB.HALF_GAME_SECONDS
	stoppage = 0.0
	_stoppage_set = false
	_stop_acc = 0.0
	begin_kickoff(1 - first_kickoff_team)


func _on_substitution(team_id: int, player: Player, _out_data: PlayerData, _in_data: PlayerData) -> void:
	if player == null or player.football_match != football_match:
		return
	_stop_acc += 30.0


func _clear_transient() -> void:
	_pf_active = false
	_po_active = false
	_adv_active = false
	_off_list.clear()
	_off_kicker = null
	_off_team = -1
	_exempt_next_kick = false
	_no_direct_goal = false
	_k_pending = false
	sp_human = false
	_stuck_t = 0.0


# ======================================================================================
# Kickoff
# ======================================================================================
## Proper kickoff: only the taker near the ball, opponents outside the centre circle,
## everybody in their own half. Play starts after a short whistle delay.
func begin_kickoff(team_id: int) -> void:
	_clear_transient()
	restart.reset()
	restart.type = FB.Restart.KICKOFF
	restart.team_id = team_id
	restart.position = Vector2.ZERO
	_ball.place(Vector2.ZERO)
	var kteam: Team = football_match.teams[team_id]
	var taker: Player = kteam.shape.get_kickoff_taker()
	if taker == null or taker.sent_off:
		taker = kteam.nearest_player_to(Vector2.ZERO, true)
	restart.taker = taker
	for t: Team in football_match.teams:
		var kicking := t.team_id == team_id
		for p: Player in t.players:
			if p.sent_off:
				continue
			p.state = FB.PlayerState.NORMAL
			p.state_timer = 0.0
			var target: Vector2 = t.shape.get_kickoff_position(p, kicking)
			if p == taker:
				target = Vector2(-t.attack_dir * 0.35, 0.0)
			else:
				target = _kickoff_legal(target, t, kicking)
			p.teleport(target, Vector2(t.attack_dir, 0.0))
	phase_timer = KICKOFF_TIME
	set_phase(FB.MatchPhase.KICKOFF)
	EventBus.whistle.emit(FB.Whistle.SHORT)
	EventBus.set_piece_ready.emit(restart)
	if kteam.is_human and taker != null:
		kteam.set_controlled_player(taker)


func _kickoff_legal(target: Vector2, t: Team, kicking: bool) -> Vector2:
	var out := target
	# Own half only.
	if out.x * t.attack_dir > -0.5:
		out.x = -0.5 * t.attack_dir
	# Opponents outside the centre circle.
	if not kicking:
		var d := out.length()
		if d < FB.CENTER_CIRCLE_RADIUS + 0.4:
			var dir := out / d if d > 0.01 else Vector2(-t.attack_dir, 0.0)
			out = dir * (FB.CENTER_CIRCLE_RADIUS + 0.4)
			if out.x * t.attack_dir > -0.5:
				out.x = -0.5 * t.attack_dir
	return _clamp_pitch(out, 0.5)


func _step_kickoff(delta: float) -> void:
	phase_timer -= delta
	_pin_taker()
	if phase_timer > 0.0:
		return
	var taker := restart.taker
	set_phase(FB.MatchPhase.PLAYING)
	_since_restart = 0.0
	_active_restart = FB.Restart.KICKOFF
	_exempt_next_kick = true
	_last_toucher = null
	_prev_toucher = null
	_ball.frozen = false
	if taker != null:
		taker.touch_cooldown = 0.0
		_ball.set_carrier(taker)
	EventBus.kickoff.emit(restart.team_id)


func _pin_taker() -> void:
	var taker := restart.taker
	if taker == null or taker.sent_off:
		return
	if restart.type == FB.Restart.KICKOFF:
		taker.pos = Vector2(-taker.team.attack_dir * 0.35, 0.0)
		taker.vel = Vector2.ZERO


# ======================================================================================
# Playing
# ======================================================================================
func _step_playing(delta: float) -> void:
	_since_restart += delta
	if _pf_active:
		_resolve_foul()
		if phase != FB.MatchPhase.PLAYING:
			return
	if _po_active:
		_resolve_offside()
		return
	if _check_goal_scored():
		return
	if _check_ball_out():
		return
	if _adv_active:
		_step_advantage(delta)
		if phase != FB.MatchPhase.PLAYING:
			return
	_check_stuck_ball(delta)
	if phase != FB.MatchPhase.PLAYING:
		return
	if _is_expired():
		var settle := _active_restart != FB.Restart.PENALTY and _active_restart != FB.Restart.FREE_KICK_DIRECT \
			and _active_restart != FB.Restart.FREE_KICK_INDIRECT and _active_restart != FB.Restart.CORNER
		if settle or _since_restart > 8.0:
			_end_half()


func _check_stuck_ball(delta: float) -> void:
	if _ball.owner_player == null and not _ball.frozen and _ball.vel.length_squared() < 0.01 and _ball.height < 0.1:
		_stuck_t += delta
		if _stuck_t > STUCK_BALL_TIME:
			_stuck_t = 0.0
			var team_id := _ball.last_touch_team if _ball.last_touch_team >= 0 else 0
			_start_restart(FB.Restart.DROP_BALL, team_id, _clamp_pitch(_ball.pos, 1.0), true)
	else:
		_stuck_t = 0.0


# --- Goals -------------------------------------------------------------------------
func _check_goal_scored() -> bool:
	var line := FB.HALF_LENGTH + FB.BALL_RADIUS
	var bx := _ball.pos.x
	if absf(bx) < line or _no_direct_goal:
		return false
	var ax := absf(_prev_ball.x)
	var cx := absf(bx)
	var t := 1.0
	if ax < line and cx > ax:
		t = clampf((line - ax) / (cx - ax), 0.0, 1.0)
	var y_cross := lerpf(_prev_ball.y, _ball.pos.y, t)
	if absf(y_cross) > FB.GOAL_WIDTH * 0.5 or _ball.height > FB.GOAL_HEIGHT - FB.BALL_RADIUS:
		return false
	_score_goal(signf(bx))
	return true


func _score_goal(side: float) -> void:
	# side > 0: ball in the +x goal. Scoring team attacks that goal.
	var scoring := 0 if float(football_match.teams[0].attack_dir) == side else 1
	var scorer := _ball.last_touch_player
	var own_goal := scorer != null and scorer.team.team_id != scoring
	var assist: Player = null
	if not own_goal and scorer != null and _prev_toucher != null and _prev_toucher != scorer \
			and _prev_toucher.team.team_id == scoring and _touch_clock - _prev_touch_time < 8.0:
		assist = _prev_toucher
	football_match.teams[scoring].score += 1
	goals_total += 1
	_stop_acc += 30.0
	_clear_transient()
	_goal_conceding = 1 - scoring
	restart.reset()
	restart.type = FB.Restart.NONE
	restart.team_id = scoring
	_ball.place(_ball.pos)
	if scorer != null and not own_goal and not scorer.sent_off:
		scorer.state = FB.PlayerState.CELEBRATING
	phase_timer = CELEBRATION_TIME
	set_phase(FB.MatchPhase.GOAL_CELEBRATION)
	EventBus.whistle.emit(FB.Whistle.DOUBLE)
	EventBus.goal_scored.emit(scoring, scorer, assist, own_goal)


# --- Out of play ------------------------------------------------------------------
func _check_ball_out() -> bool:
	var bp := _ball.pos
	var out_x := absf(bp.x) > FB.HALF_LENGTH + FB.BALL_RADIUS
	var out_y := absf(bp.y) > FB.HALF_WIDTH + FB.BALL_RADIUS
	if not out_x and not out_y:
		return false
	if _adv_active:
		_recall_advantage()
		return true
	var last := _ball.last_touch_team
	if last < 0:
		last = football_match.rng.randi_range(0, 1)
	var reason := FB.OutReason.GOAL_LINE if out_x else FB.OutReason.TOUCHLINE
	_clear_transient()
	EventBus.out_of_play.emit(bp, _ball.last_touch_team, reason)
	if out_x:
		var side := signf(bp.x)
		var defending := 0 if float(football_match.teams[0].attack_dir) == -side else 1
		if last == defending:
			var cy := signf(bp.y) if bp.y != 0.0 else 1.0
			_start_restart(FB.Restart.CORNER, 1 - defending, Vector2(side * FB.HALF_LENGTH, cy * FB.HALF_WIDTH), true)
		else:
			var gy := signf(bp.y) if bp.y != 0.0 else 1.0
			_start_restart(FB.Restart.GOAL_KICK, defending,
				Vector2(side * (FB.HALF_LENGTH - FB.GOAL_AREA_DEPTH), gy * 5.0), true)
	else:
		var sy := signf(bp.y)
		var tx := clampf(bp.x, -FB.HALF_LENGTH + 2.0, FB.HALF_LENGTH - 2.0)
		_start_restart(FB.Restart.THROW_IN, 1 - last, Vector2(tx, sy * FB.HALF_WIDTH), true)
	return true


# ======================================================================================
# Touches, offside
# ======================================================================================
## Connected to Ball.touched: bookkeeping, restarts taken, offside resolution.
func on_ball_touched(p: Player) -> void:
	if p == null:
		return
	if p != _last_toucher:
		_prev_toucher = _last_toucher
		_prev_touch_time = _touch_clock
		_last_toucher = p
	_touch_clock = float(football_match.tick) * FB.TICK_DT
	match phase:
		FB.MatchPhase.SET_PIECE:
			if p.team.team_id == restart.team_id:
				_resume_play(p)
		FB.MatchPhase.PLAYING:
			if _no_direct_goal and p != _nd_taker:
				_no_direct_goal = false
			_check_touch_offside(p)


func _resume_play(p: Player) -> void:
	var rtype := restart.type
	set_phase(FB.MatchPhase.PLAYING)
	_since_restart = 0.0
	_active_restart = rtype
	_k_pending = false
	sp_human = false
	_stuck_t = 0.0
	_exempt_next_kick = rtype == FB.Restart.THROW_IN or rtype == FB.Restart.GOAL_KICK \
		or rtype == FB.Restart.CORNER
	_no_direct_goal = rtype == FB.Restart.THROW_IN or rtype == FB.Restart.FREE_KICK_INDIRECT
	_nd_taker = p
	var taker := restart.taker
	if taker != null:
		if taker.state == FB.PlayerState.SET_PIECE:
			taker.state = FB.PlayerState.NORMAL
		if taker.intent.action == FB.IntentAction.SET_PIECE_KICK:
			taker.intent.clear_action()


func _on_ball_kicked(by: Player) -> void:
	if by == null or phase != FB.MatchPhase.PLAYING:
		return
	if _exempt_next_kick:
		_exempt_next_kick = false
		_off_list.clear()
		_off_team = -1
		return
	_snapshot_offside(by)


func _snapshot_offside(by: Player) -> void:
	_off_list.clear()
	_off_kicker = by
	_off_team = by.team.team_id
	var t := by.team
	var d := float(t.attack_dir)
	var a := -INF
	var b := -INF
	for q: Player in t.opponent.players:
		if q.sent_off:
			continue
		var s := q.pos.x * d
		if s > a:
			b = a
			a = s
		elif s > b:
			b = s
	var line := maxf(maxf(b, _ball.pos.x * d), 0.0)
	for q: Player in t.players:
		if q == by or q.sent_off:
			continue
		if q.pos.x * d > line + 0.05:
			_off_list.append(q)


func _check_touch_offside(p: Player) -> void:
	if _off_team < 0:
		return
	if p.team.team_id != _off_team or p == _off_kicker:
		_off_list.clear()
		_off_team = -1
		return
	if p in _off_list and not _po_active:
		_po_active = true
		_po_player = p
		_po_pos = p.pos
	_off_list.clear()
	_off_team = -1


func _resolve_offside() -> void:
	_po_active = false
	var q := _po_player
	var pos := _clamp_pitch(_po_pos, 0.5)
	_clear_transient()
	offsides_total += 1
	_stop_acc += 5.0
	EventBus.offside.emit(q, pos)
	EventBus.whistle.emit(FB.Whistle.SHORT)
	var defenders := 1 - q.team.team_id
	_start_restart(FB.Restart.FREE_KICK_INDIRECT, defenders, pos, false)


# ======================================================================================
# Fouls, advantage, cards
# ======================================================================================
## Physics reports every challenge here. Decides foul / no foul, severity, restart.
func report_contact(tackler: Player, victim: Player, ball_first: bool, intensity: float, from_behind: bool) -> void:
	if phase != FB.MatchPhase.PLAYING or _pf_active or tackler == null or victim == null:
		return
	if tackler.team == victim.team or tackler.sent_off or victim.sent_off:
		return
	var p: float
	if ball_first:
		p = 0.03 + 0.10 * intensity
	else:
		p = 0.45 + 0.40 * intensity
	if from_behind:
		p += 0.2
	p *= lerpf(0.75, 1.3, tackler.stat("aggression")) * lerpf(1.2, 0.85, tackler.stat("tackling"))
	p *= _foul_rate_scale()
	if not debug_force_foul and football_match.rng.randf() >= p:
		return
	_pf_active = true
	_pf_tackler = tackler
	_pf_victim = victim
	_pf_ball_first = ball_first
	_pf_intensity = intensity
	_pf_from_behind = from_behind


## Soft regulator keeping foul counts near FOULS_PER_MATCH however often physics reports contacts.
func _foul_rate_scale() -> float:
	var expected := FOULS_PER_MATCH * clock / (FB.HALF_GAME_SECONDS * 2.0)
	var ratio := (expected + 3.0) / (float(fouls_total) + 3.0)
	if float(fouls_total) > expected * 1.15 + 3.0:
		return 0.0
	var r2 := ratio * ratio
	return clampf(r2 * r2 * ratio, 0.01, 2.5)


func _resolve_foul() -> void:
	_pf_active = false
	var s := _pf_intensity * 0.6 + (0.2 if _pf_from_behind else 0.0) + (0.0 if _pf_ball_first else 0.1) \
		+ football_match.rng.randf() * 0.25
	var sev: int = FB.FoulSeverity.CARELESS
	if s > 1.08:
		sev = FB.FoulSeverity.EXCESSIVE
	elif s > 0.88:
		sev = FB.FoulSeverity.RECKLESS
	award_foul(_pf_tackler, _pf_victim, sev, true)


## Awards a foul (public so tests/other modules can force one).
func award_foul(offender: Player, victim: Player, severity: int, allow_advantage: bool = true) -> void:
	var pos := _clamp_pitch(victim.pos, 0.5)
	fouls_total += 1
	foul_count[offender.team.team_id] += 1
	_stop_acc += 12.0
	var side := signf(offender.team.own_goal_center().x)
	var in_box := pos.x * side > FB.HALF_LENGTH - FB.PENALTY_AREA_DEPTH and absf(pos.y) < FB.PENALTY_AREA_WIDTH * 0.5
	var advantage := false
	if allow_advantage and not in_box and severity != FB.FoulSeverity.EXCESSIVE and _victim_team_in_control(victim.team):
		advantage = debug_advantage == 1 or (debug_advantage < 0 and football_match.rng.randf() < 0.7)
	EventBus.foul.emit(offender, victim, pos, severity, advantage)
	if severity == FB.FoulSeverity.RECKLESS:
		_give_card(offender, FB.Card.YELLOW)
	elif severity == FB.FoulSeverity.EXCESSIVE:
		_give_card(offender, FB.Card.RED)
	if advantage:
		_adv_active = true
		_adv_timer = ADVANTAGE_TIME
		_adv_team = victim.team.team_id
		_adv_pos = pos
		_adv_offender = offender
		return
	EventBus.whistle.emit(FB.Whistle.SHORT)
	_clear_transient()
	_foul_restart(victim.team.team_id, pos, in_box, side)


func _foul_restart(victim_team: int, pos: Vector2, in_box: bool, side: float) -> void:
	if in_box:
		_start_restart(FB.Restart.PENALTY, victim_team, Vector2(side * (FB.HALF_LENGTH - FB.PENALTY_SPOT_DIST), 0.0), true)
	else:
		_start_restart(FB.Restart.FREE_KICK_DIRECT, victim_team, pos, true)


func _victim_team_in_control(vt: Team) -> bool:
	if _ball.owner_player != null:
		return _ball.owner_player.team == vt
	return _ball.last_touch_team == vt.team_id and not _ball.frozen


func _step_advantage(delta: float) -> void:
	_adv_timer -= delta
	var lost := false
	if _ball.owner_player != null and _ball.owner_player.team.team_id != _adv_team:
		lost = true
	elif _ball.last_touch_team >= 0 and _ball.last_touch_team != _adv_team:
		lost = true
	if lost:
		_recall_advantage()
	elif _adv_timer <= 0.0:
		_adv_active = false


func _recall_advantage() -> void:
	var pos := _adv_pos
	var team_id := _adv_team
	var off := _adv_offender
	_clear_transient()
	EventBus.whistle.emit(FB.Whistle.SHORT)
	var side := signf(off.team.own_goal_center().x) if off != null else 1.0
	_foul_restart(team_id, pos, false, side)


func _give_card(p: Player, kind: int) -> void:
	var card_type := kind
	if kind == FB.Card.YELLOW:
		p.yellow_cards += 1
		yellow_total += 1
		_stop_acc += 10.0
		if p.yellow_cards >= 2:
			card_type = FB.Card.SECOND_YELLOW
	else:
		red_total += 1
		_stop_acc += 25.0
	EventBus.card.emit(p, card_type)
	if card_type != FB.Card.YELLOW:
		_send_off(p)


func _send_off(p: Player) -> void:
	p.sent_off = true
	p.state = FB.PlayerState.SENT_OFF
	p.intent.reset()
	if _ball.owner_player == p:
		_ball.set_carrier(null)
	var t := p.team
	p.teleport(Vector2(-40.0 + float(p.slot_index) * 4.0 + float(t.team_id) * 2.0, FB.HALF_WIDTH + 3.5 + float(t.team_id) * 1.5))
	if t.controlled_player == p:
		var repl := t.nearest_player_to(_ball.pos, true, p)
		if repl != null:
			t.set_controlled_player(repl)


# ======================================================================================
# Set pieces
# ======================================================================================
func _start_restart(type: int, team_id: int, pos: Vector2, direct: bool) -> void:
	# After the (extended) half has run out, the next stoppage ends it (a penalty is still taken).
	if _is_expired() and type != FB.Restart.PENALTY:
		_end_half()
		return
	restart.reset()
	restart.type = type
	restart.team_id = team_id
	restart.position = pos
	restart.direct = direct
	restart.wall_distance = WALL_DISTANCE if (type == FB.Restart.CORNER or type == FB.Restart.FREE_KICK_DIRECT \
		or type == FB.Restart.FREE_KICK_INDIRECT) else THROW_IN_DISTANCE
	_ball.place(pos)
	var team: Team = football_match.teams[team_id]
	var taker: Player = team.shape.pick_set_piece_taker(restart)
	if taker == null or taker.sent_off:
		taker = team.nearest_player_to(pos, true)
	if taker == null:
		taker = team.nearest_player_to(pos, false)
	restart.taker = taker
	_taker_spot = _compute_taker_spot(restart)
	for t: Team in football_match.teams:
		for p: Player in t.players:
			if p.sent_off:
				continue
			p.state = FB.PlayerState.NORMAL
			p.state_timer = 0.0
			if p == taker:
				continue
			var target: Vector2 = t.shape.get_set_piece_position(p, restart)
			p.teleport(_legalize(p, target), _face_toward(p.pos, pos))
	if taker != null:
		taker.teleport(_taker_spot, _face_toward(_taker_spot, pos))
		taker.state = FB.PlayerState.SET_PIECE
		taker.touch_cooldown = 0.0
	_sp_time = 0.0
	_k_pending = false
	_meter_t = 0.0
	sp_step = SpStep.AIM
	sp_power = 0.0
	sp_curve = 0.0
	sp_needs_curve = type == FB.Restart.CORNER or type == FB.Restart.FREE_KICK_DIRECT
	sp_origin = _taker_spot
	sp_aim_dir = _default_aim(restart)
	match type:
		FB.Restart.THROW_IN: _ai_delay = 0.9
		FB.Restart.GOAL_KICK: _ai_delay = 1.3
		FB.Restart.CORNER: _ai_delay = 1.4
		FB.Restart.PENALTY: _ai_delay = 2.0
		FB.Restart.DROP_BALL: _ai_delay = 0.8
		_: _ai_delay = 1.5
	sp_human = team.is_human and team.input != null and taker != null
	set_phase(FB.MatchPhase.SET_PIECE)
	EventBus.whistle.emit(FB.Whistle.SHORT)
	match type:
		FB.Restart.THROW_IN:
			throw_ins_total += 1
			EventBus.throw_in.emit(team_id, pos)
		FB.Restart.CORNER:
			corners_total += 1
			EventBus.corner.emit(team_id, pos)
		FB.Restart.GOAL_KICK:
			goal_kicks_total += 1
			EventBus.goal_kick.emit(team_id, pos)
		FB.Restart.PENALTY:
			penalties_total += 1
			EventBus.penalty.emit(team_id, pos)
		FB.Restart.FREE_KICK_DIRECT, FB.Restart.FREE_KICK_INDIRECT:
			free_kicks_total += 1
			EventBus.free_kick.emit(team_id, pos, direct)
	EventBus.set_piece_ready.emit(restart)
	if sp_human:
		team.set_controlled_player(taker)


func _compute_taker_spot(r: RestartInfo) -> Vector2:
	var b := r.position
	match r.type:
		FB.Restart.THROW_IN:
			return Vector2(b.x, b.y + signf(b.y) * 0.8)
		FB.Restart.CORNER:
			return b + Vector2(signf(b.x), signf(b.y)) * 0.6
	var dir := _default_forward(r)
	return b - dir * 0.8


## Natural direction of play for this restart (unit).
func _default_forward(r: RestartInfo) -> Vector2:
	var team: Team = football_match.teams[r.team_id]
	var goal := team.target_goal_center()
	if r.type == FB.Restart.GOAL_KICK or r.type == FB.Restart.DROP_BALL:
		return Vector2(team.attack_dir, 0.0)
	var d := goal - r.position
	if d.length_squared() < 0.01:
		return Vector2(team.attack_dir, 0.0)
	return d.normalized()


func _default_aim(r: RestartInfo) -> Vector2:
	var team: Team = football_match.teams[r.team_id]
	match r.type:
		FB.Restart.THROW_IN:
			return Vector2(team.attack_dir * 0.35, -signf(r.position.y)).normalized()
		FB.Restart.CORNER:
			var spot := Vector2(signf(r.position.x) * (FB.HALF_LENGTH - 9.0), 0.0)
			return (spot - r.position).normalized()
	return _default_forward(r)


func _face_toward(from: Vector2, to: Vector2) -> Vector2:
	var d := to - from
	if d.length_squared() < 0.0001:
		return Vector2(1.0, 0.0)
	return d.normalized()


## Pushes a player to a legal position for the current restart.
func _legalize(p: Player, target: Vector2) -> Vector2:
	var r := restart
	var same := p.team.team_id == r.team_id
	var out := target
	var bp := r.position
	match r.type:
		FB.Restart.THROW_IN:
			if not same:
				out = _push_from(out, bp, THROW_IN_DISTANCE)
		FB.Restart.CORNER, FB.Restart.FREE_KICK_DIRECT, FB.Restart.FREE_KICK_INDIRECT:
			if not same and not p.is_goalkeeper():
				out = _push_from(out, bp, WALL_DISTANCE + 0.3)
		FB.Restart.GOAL_KICK:
			if not same:
				out = _push_out_of_area(out, signf(bp.x))
		FB.Restart.DROP_BALL:
			out = _push_from(out, bp, 3.5)
		FB.Restart.PENALTY:
			var side := signf(bp.x)
			if p.is_goalkeeper() and not same:
				out = Vector2(side * (FB.HALF_LENGTH - 0.3), 0.0)
			else:
				out = _push_out_of_area(out, side)
				out = _push_from(out, bp, FB.PENALTY_ARC_RADIUS + 0.3)
	return _clamp_pitch(out, 0.4)


func _push_from(pos: Vector2, center: Vector2, radius: float) -> Vector2:
	var d := pos - center
	var l := d.length()
	if l >= radius:
		return pos
	var dir := d / l if l > 0.01 else Vector2(0.0, 1.0)
	return center + dir * radius


## Moves a point out of the penalty area at the goal on the given side (+1/-1).
func _push_out_of_area(pos: Vector2, side: float) -> Vector2:
	var edge := FB.HALF_LENGTH - FB.PENALTY_AREA_DEPTH
	if pos.x * side > edge and absf(pos.y) < FB.PENALTY_AREA_WIDTH * 0.5:
		return Vector2(side * (edge - 0.4), pos.y)
	return pos


func _clamp_pitch(v: Vector2, margin: float) -> Vector2:
	return Vector2(clampf(v.x, -FB.HALF_LENGTH + margin, FB.HALF_LENGTH - margin),
		clampf(v.y, -FB.HALF_WIDTH + margin, FB.HALF_WIDTH - margin))


func _step_set_piece(delta: float) -> void:
	var taker := restart.taker
	if taker == null or taker.sent_off:
		set_phase(FB.MatchPhase.PLAYING)
		_ball.frozen = false
		return
	_sp_time += delta
	# Keep the taker on his spot until the ball is struck (joystick must not walk him away).
	taker.pos = _taker_spot
	taker.vel = Vector2.ZERO
	if _k_pending:
		_k_wait -= delta
		if _k_wait <= 0.0:
			_direct_kick()
		return
	if sp_human and _human_input() != null:
		_step_human(delta)
		if _sp_time > HUMAN_TIMEOUT and not _k_pending:
			sp_human = false
		return
	if _sp_time >= _ai_delay:
		_plan_ai_kick()
		_begin_kick()


func _human_input() -> InputController:
	var team: Team = football_match.teams[restart.team_id]
	return team.input


func _step_human(delta: float) -> void:
	var team: Team = football_match.teams[restart.team_id]
	var inp := team.input
	var taker := restart.taker
	if team.controlled_player != taker:
		team.set_controlled_player(taker)
	var confirm := inp.consume_press(FB.Action.SP_CONFIRM)
	var cancel := inp.consume_press(FB.Action.SP_CANCEL)
	match sp_step:
		SpStep.AIM:
			var aim := inp.get_aim_vector()
			if aim.length_squared() > 0.04:
				sp_aim_dir = aim.normalized()
			if confirm:
				sp_step = SpStep.POWER
				_meter_t = 0.0
				sp_power = 0.0
		SpStep.POWER:
			_meter_t += delta
			var ph := fposmod(_meter_t / METER_PERIOD, 1.0)
			sp_power = 1.0 - absf(ph * 2.0 - 1.0)
			if cancel:
				sp_step = SpStep.AIM
			elif confirm:
				if sp_needs_curve:
					sp_step = SpStep.CURVE
				else:
					_human_fire()
		SpStep.CURVE:
			sp_curve = inp.get_curve_input()
			if cancel:
				sp_step = SpStep.POWER
				_meter_t = 0.0
			elif confirm:
				_human_fire()
	taker.facing = sp_aim_dir


func _human_fire() -> void:
	var taker := restart.taker
	var skill := taker.stat("shooting") if (restart.type == FB.Restart.PENALTY or restart.type == FB.Restart.FREE_KICK_DIRECT) \
		else taker.stat("passing")
	var err := 0.015 + 0.09 * maxf(0.0, (sp_power - 0.85) / 0.15) + (1.0 - skill) * 0.03
	var ang := football_match.rng.randfn(0.0, err)
	var dir := sp_aim_dir.rotated(ang)
	_k_target = restart.position + dir * 30.0
	_k_power = maxf(sp_power, 0.12)
	_k_loft = _default_loft(restart.type)
	_k_curve = sp_curve
	sp_step = SpStep.KICKING
	_begin_kick()


func _default_loft(type: int) -> float:
	match type:
		FB.Restart.THROW_IN: return 0.2
		FB.Restart.CORNER: return 0.55
		FB.Restart.GOAL_KICK: return 0.6
		FB.Restart.FREE_KICK_DIRECT: return 0.3
		FB.Restart.FREE_KICK_INDIRECT: return 0.25
		FB.Restart.PENALTY: return 0.25
	return 0.0


## Writes the SET_PIECE_KICK intent; _direct_kick() is the fallback.
func _begin_kick() -> void:
	var taker := restart.taker
	var it := taker.intent
	it.set_action(FB.IntentAction.SET_PIECE_KICK, _k_target, _k_power)
	it.loft = _k_loft
	it.curve = _k_curve
	it.look = (_k_target - restart.position).normalized()
	taker.facing = it.look if it.look != Vector2.ZERO else taker.facing
	_k_pending = true
	_k_wait = KICK_WAIT


func _direct_kick() -> void:
	_k_pending = false
	var taker := restart.taker
	var d := _k_target - _ball.pos
	var dir := d.normalized() if d.length_squared() > 0.0001 else Vector2(taker.team.attack_dir, 0.0)
	var speed := lerpf(4.0, 32.0, _k_power)
	var vz := 0.0
	if _k_loft >= 0.12:
		vz = lerpf(3.0, 11.0, _k_loft)
	taker.intent.clear_action()
	taker.touch_cooldown = 0.6
	_ball.kick(dir * speed, vz, _k_curve * 8.0, taker)
	EventBus.ball_kicked.emit(taker, FB.IntentAction.SET_PIECE_KICK, _k_power)


# --- AI taking set pieces ----------------------------------------------------------
func _plan_ai_kick() -> void:
	var taker := restart.taker
	var team := taker.team
	var rng := football_match.rng
	var bp := restart.position
	var goal := team.target_goal_center()
	var pass_err := 0.02 + (1.0 - taker.stat("passing")) * 0.07
	var shot_err := 0.02 + (1.0 - taker.stat("shooting")) * 0.08
	match restart.type:
		FB.Restart.THROW_IN:
			var mate := _best_mate(taker, 4.0, 24.0)
			var tgt := mate.pos if mate != null else Vector2(bp.x, bp.y - signf(bp.y) * 8.0)
			_set_plan(taker, tgt, 0.2, 0.0, pass_err)
		FB.Restart.CORNER:
			var spot := Vector2(signf(bp.x) * (FB.HALF_LENGTH - rng.randf_range(6.0, 11.0)), rng.randf_range(-6.0, 6.0))
			_set_plan(taker, spot, 0.55, rng.randf_range(-0.5, 0.5), pass_err + 0.03)
		FB.Restart.GOAL_KICK:
			var aim_pt := Vector2(bp.x + team.attack_dir * 38.0, rng.randf_range(-15.0, 15.0))
			var mate2 := _mate_near_point(taker, aim_pt)
			_set_plan(taker, mate2.pos if mate2 != null else aim_pt, 0.62, 0.0, pass_err + 0.02)
		FB.Restart.PENALTY:
			var side := -1.0 if rng.randf() < 0.5 else 1.0
			var corner_pt := goal + Vector2(0.0, side * (FB.GOAL_WIDTH * 0.5 - 0.8))
			_set_plan(taker, corner_pt, 0.25, 0.0, shot_err)
			_k_power = 0.9
		FB.Restart.FREE_KICK_DIRECT, FB.Restart.FREE_KICK_INDIRECT:
			var dist_goal := bp.distance_to(goal)
			if restart.direct and dist_goal < 30.0:
				var side2 := -1.0 if rng.randf() < 0.5 else 1.0
				_set_plan(taker, goal + Vector2(0.0, side2 * (FB.GOAL_WIDTH * 0.5 - 0.9)), 0.3, rng.randf_range(-0.4, 0.4), shot_err + dist_goal * 0.0012)
				_k_power = 0.92
			else:
				var mate3 := _best_mate(taker, 6.0, 38.0)
				var tgt3 := mate3.pos if mate3 != null else bp + Vector2(team.attack_dir * 10.0, 0.0)
				var dd := bp.distance_to(tgt3)
				_set_plan(taker, tgt3, 0.3 if dd > 18.0 else 0.0, 0.0, pass_err)
		_:
			var mate4 := _best_mate(taker, 3.0, 20.0)
			_set_plan(taker, mate4.pos if mate4 != null else bp + Vector2(team.attack_dir * 8.0, 0.0), 0.0, 0.0, pass_err)


## Fills the _k_* plan: perturbs the aim by a random angular error and derives the
## power needed to reach the target.
func _set_plan(taker: Player, target: Vector2, loft: float, curve: float, err: float) -> void:
	var from := restart.position
	var d := target - from
	var dist := d.length()
	if dist < 0.5:
		d = Vector2(taker.team.attack_dir, 0.0)
		dist = 6.0
	var dir := d.normalized().rotated(football_match.rng.randfn(0.0, err))
	_k_target = from + dir * dist
	_k_loft = loft
	_k_curve = curve
	var v: float
	if loft >= 0.12:
		var vz := lerpf(3.0, 11.0, loft)
		v = dist / (2.0 * vz / FB.GRAVITY) * 1.05
	else:
		v = sqrt(2.0 * 2.2 * dist) + 1.5
	_k_power = clampf((v - 4.0) / 28.0, 0.08, 1.0)


func _best_mate(taker: Player, min_d: float, max_d: float) -> Player:
	var best: Player = null
	var best_score := -INF
	var team := taker.team
	for q: Player in team.players:
		if q == taker or q.sent_off:
			continue
		var d := q.pos.distance_to(taker.pos)
		if d < min_d or d > max_d:
			continue
		var opp := 99.0
		for o: Player in team.opponent.players:
			if not o.sent_off:
				opp = minf(opp, o.pos.distance_to(q.pos))
		var score := minf(opp, 12.0) - d * 0.25 + q.pos.x * team.attack_dir * 0.05
		if q.is_goalkeeper():
			score -= 5.0
		if score > best_score:
			best_score = score
			best = q
	return best


func _mate_near_point(taker: Player, pt: Vector2) -> Player:
	var best: Player = null
	var best_d := INF
	for q: Player in taker.team.players:
		if q == taker or q.sent_off or q.is_goalkeeper():
			continue
		var d := q.pos.distance_squared_to(pt)
		if d < best_d:
			best_d = d
			best = q
	return best
