class_name AiGoalkeeper
extends RefCounted
## Goalkeeper behaviour used by ai_brain.gd: positioning on the arc, shot reading and
## dives, sweeping, claiming crosses and distribution. think() is heavy (10 Hz),
## act() is cheap and allocation free.

enum Mode { POSITION, SAVE, SWEEP, DISTRIBUTE }

var player: Player
var mode := Mode.POSITION
var target := Vector2.ZERO
var sprint := false

var _hold_timer := 0.0
var _hold_wait := 1.0
var _dive_cd := 0.0
var _react_left := -1.0
var _dive_point := Vector2.ZERO
var _dive_pending := false
var _pend_action: int = FB.IntentAction.NONE
var _pend_target := Vector2.ZERO
var _pend_power := 0.5
var _pend_loft := 0.0
var _pend_player: Player = null
var _pend_delay := 0.0


func _init(p: Player) -> void:
	player = p


func _skill() -> float:
	return player.data.stat01("goalkeeping")


## Heavy evaluation (10 Hz).
func think(dt: float) -> void:
	var p := player
	var m := p.football_match
	var ball := m.ball
	var diff := AiParams.idx(m.config.difficulty)
	_dive_cd -= dt
	if p.has_ball() or p.state == FB.PlayerState.HOLDING_BALL:
		_think_distribute(dt, m, ball)
		return
	_hold_timer = 0.0
	_hold_wait = 0.7 + m.rng.randf() * 1.3
	var goal_c := p.team.own_goal_center()
	var sgn := signf(goal_c.x)
	# 1. Shot / dangerous ball heading for goal.
	if ball.owner_player == null and ball.vel.length_squared() > 25.0 and ball.vel.x * sgn > 2.0:
		var t := 0.05
		while t <= 2.0:
			var pt := ball.predict_position(t)
			if pt.x * sgn >= absf(goal_c.x) - 0.1:
				var h := ball.height + ball.vz * t - 0.5 * FB.GRAVITY * t * t
				if absf(pt.y) <= FB.GOAL_WIDTH * 0.5 + 1.6 and h < FB.GOAL_HEIGHT + 0.6:
					_plan_save(t, ball, diff)
					return
				break
			t += 0.08
	_dive_pending = false
	# 2. Sweep / claim loose or airborne balls inside our zone.
	var depth_ball := absf(ball.pos.x - goal_c.x)
	if ball.owner_player == null and depth_ball < FB.PENALTY_AREA_DEPTH + 10.0 and absf(ball.pos.y) < FB.PENALTY_AREA_WIDTH * 0.5 + 6.0:
		var ic := AiMath.intercept(p.pos, AiMath.run_speed(p) * 1.05, ball)
		var ipt := Vector2(ic.y, ic.z)
		var opp_t := _opp_arrival(ipt, p.team.opponent.players)
		var inside := absf(ipt.x - goal_c.x) < FB.PENALTY_AREA_DEPTH + 3.0 and absf(ipt.y) < FB.PENALTY_AREA_WIDTH * 0.5
		if inside and ic.x < opp_t - 0.15:
			mode = Mode.SWEEP
			target = ipt
			sprint = ic.x > 0.6
			return
	# 3. Positioning on the arc between the ball and the goal centre.
	mode = Mode.POSITION
	var to_ball := ball.pos - goal_c
	var bd := to_ball.length()
	var r: float
	if ball.owner_player != null and ball.owner_player.team != p.team and bd < 24.0:
		r = clampf(bd * 0.28, 2.0, 6.5)
	else:
		r = clampf(1.0 + bd * 0.07, 1.0, 4.5)
	var dir_b := to_ball / bd if bd > 0.01 else Vector2(-sgn, 0.0)
	var t_pos := goal_c + dir_b * r
	t_pos.y = clampf(t_pos.y, -FB.GOAL_WIDTH * 0.5 - 0.8, FB.GOAL_WIDTH * 0.5 + 0.8)
	t_pos.x = goal_c.x - sgn * clampf(absf(t_pos.x - goal_c.x), 0.8, 7.5)
	target = t_pos
	sprint = p.pos.distance_to(target) > 5.0


func _opp_arrival(point: Vector2, opps: Array[Player]) -> float:
	var best := INF
	for o: Player in opps:
		if o.sent_off or not o.can_play():
			continue
		var t := AiMath.reach_time(o, point)
		if t < best:
			best = t
	return best


func _plan_save(t_cross: float, ball: Ball, diff: int) -> void:
	var p := player
	var m := p.football_match
	var ts := maxf(t_cross - 0.06, 0.02)
	var pt := ball.predict_position(ts)
	var dist := p.pos.distance_to(pt)
	var skill := _skill()
	mode = Mode.SAVE
	target = pt
	sprint = true
	var reach := 1.5 + 2.4 * skill + 0.8 * p.data.stat01("reflexes")
	var window := 0.55 + 0.2 * p.data.stat01("reflexes")
	if dist > 0.9 and dist <= reach and ts <= window and _dive_cd <= 0.0:
		if not _dive_pending:
			_dive_pending = true
			_react_left = AiParams.gk_react(diff) * (1.3 - p.data.stat01("reflexes"))
		var err := AiParams.gk_aim_error(diff) * (1.2 - skill)
		_dive_point = pt + Vector2(m.rng.randf_range(-1.0, 1.0), m.rng.randf_range(-1.0, 1.0)) * err * 0.5
	else:
		_dive_pending = false


func _think_distribute(dt: float, m: FootballMatch, ball: Ball) -> void:
	var p := player
	mode = Mode.DISTRIBUTE
	target = p.pos
	sprint = false
	_hold_timer += dt
	if _hold_timer < _hold_wait or _pend_action != FB.IntentAction.NONE:
		return
	var team := p.team
	var dir := float(team.attack_dir)
	var line_a := AiMath.offside_line_a(team)
	var opps := team.opponent.players
	var best_u := -INF
	var best_p: Player = null
	var best_d := 0.0
	for t: Player in team.players:
		if t == p or t.sent_off or t.is_goalkeeper() or not t.can_play():
			continue
		var d := p.pos.distance_to(t.pos)
		if d < 6.0 or d > 55.0 or t.pos.x * dir > line_a:
			continue
		var mg := AiMath.lane_margin(p.pos, t.pos, opps)
		var space := clampf(AiMath.nearest_dist(t.pos, opps) / 6.0, 0.0, 1.0)
		var prog := clampf((t.pos.x - p.pos.x) * dir / 40.0, -0.2, 1.0)
		var u := 0.5 * clampf(mg / 0.7, 0.0, 1.0) + 0.25 * space + 0.25 * prog
		if mg < 0.1:
			u -= 0.4
		if d > 30.0:
			u -= 0.05
		u += (m.rng.randf() - 0.5) * AiParams.noise(AiParams.idx(m.config.difficulty))
		if u > best_u:
			best_u = u
			best_p = t
			best_d = d
	_pend_delay = 0.0
	if best_p != null and best_u > 0.25:
		if best_d <= 32.0:
			_pend_action = FB.IntentAction.GK_THROW
			_pend_power = clampf(best_d / 36.0 + 0.2, 0.3, 1.0)
			_pend_loft = 0.0
		else:
			_pend_action = FB.IntentAction.GK_KICK
			_pend_power = 0.95
			_pend_loft = 0.7
		_pend_target = best_p.pos + best_p.vel * 0.6
		_pend_player = best_p
	else:
		# No safe option: punt up the nearer flank.
		var side := 1.0 if p.pos.y >= 0.0 else -1.0
		_pend_action = FB.IntentAction.GK_KICK
		_pend_power = 1.0
		_pend_loft = 0.8
		_pend_target = Vector2(dir * 25.0, side * 18.0)
		_pend_player = null
	_hold_timer = 0.0


## Cheap per-tick steering. Writes player.intent.
func act(delta: float) -> void:
	var p := player
	var it := p.intent
	var ball := p.football_match.ball
	# Pending distribution
	if _pend_action != FB.IntentAction.NONE:
		_pend_delay -= delta
		if _pend_delay <= 0.0:
			if p.has_ball() or p.state == FB.PlayerState.HOLDING_BALL:
				it.set_action(_pend_action, _pend_target, _pend_power, _pend_player)
				it.loft = _pend_loft
			_pend_action = FB.IntentAction.NONE
			_pend_player = null
	# Pending dive after reaction delay
	if _dive_pending:
		_react_left -= delta
		if _react_left <= 0.0:
			_dive_pending = false
			_dive_cd = 1.2
			it.set_action(FB.IntentAction.GK_DIVE, _dive_point, 1.0)
	if mode == Mode.DISTRIBUTE:
		it.move = Vector2.ZERO
		it.sprint = false
		var tp := _pend_target if _pend_action != FB.IntentAction.NONE else ball.pos
		var lk := tp - p.pos
		it.look = lk.normalized() if lk.length_squared() > 0.01 else Vector2.ZERO
		return
	var d := target - p.pos
	var dist := d.length()
	if dist < 0.25:
		it.move = Vector2.ZERO
	else:
		it.move = d / dist * clampf(dist / 1.6, 0.25, 1.0)
	it.sprint = sprint and dist > 1.5 and p.stamina > 0.1
	var tb := ball.pos - p.pos
	it.look = tb.normalized() if tb.length_squared() > 0.01 else Vector2.ZERO
