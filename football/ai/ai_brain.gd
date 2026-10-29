extends PlayerBrain
## Utility-based player AI. think() (10 Hz, staggered) chooses a mode and a target and,
## when carrying the ball, scores shots / passes / dribbles; act() (every tick) only
## steers towards the chosen target and fires pending one-shot actions.
## Goalkeepers delegate to AiGoalkeeper.

enum Mode { IDLE, SET_PIECE, WITH_BALL, PRESS, MARK, SUPPORT, POSITION, CHASE, INTERCEPT, GK }

## Failsafe: seconds a set-piece taker may wait before the AI kicks it itself, in case
## the RULES module never handles AI takers. See docs/REQUESTS.md.
const TAKER_FAILSAFE := 7.0

var mode: int = Mode.IDLE
var _diff := -1
var _react := 0.24
var _noise := 0.13
var _aim_err := 0.8
var _stam_floor := 0.2
var _tackle_f := 1.0
var _press_f := 1.0

var _target := Vector2.ZERO
var _want_sprint := false
var _exhausted := false
var _arrive_radius := 2.5
var _dribble_dir := Vector2.RIGHT
var _cur_dir := Vector2.RIGHT
var _ball_time := 0.0
var _tackle_cd := 0.0
var _shield_time := 0.0
var _taker_wait := 0.0
var _line_a := 0.0

# Pending one-shot action (fired in act() when _pend_delay elapses).
var _pend_action: int = FB.IntentAction.NONE
var _pend_target := Vector2.ZERO
var _pend_power := 0.5
var _pend_loft := 0.0
var _pend_curve := 0.0
var _pend_player: Player = null
var _pend_delay := 0.0

var _gk: AiGoalkeeper = null


func setup(p: Player) -> void:
	super.setup(p)
	_gk = AiGoalkeeper.new(p)


func on_activated() -> void:
	_pend_action = FB.IntentAction.NONE
	_ball_time = 0.0
	_taker_wait = 0.0
	_shield_time = 0.0
	if _gk != null:
		_gk._dive_pending = false
		_gk._pend_action = FB.IntentAction.NONE


# ---------------------------------------------------------------------------
# think(): heavy decisions, ~10 Hz
# ---------------------------------------------------------------------------
func think(dt: float) -> void:
	var p := player
	var m := p.football_match
	if m == null or m.ball == null:
		return
	_refresh_difficulty(m.config.difficulty)
	_tackle_cd -= dt
	if _is_locked():
		mode = Mode.IDLE
		return
	var ref := m.referee
	if ref.is_set_piece_pending():
		_think_set_piece(ref)
		return
	_taker_wait = 0.0
	if p.is_goalkeeper():
		mode = Mode.GK
		_gk.think(dt)
		return
	if not ref.is_ball_in_play():
		mode = Mode.POSITION
		_target = p.home_position
		_want_sprint = false
		_arrive_radius = 3.0
		return
	var ball := m.ball
	var carrier := ball.owner_player
	var tb := p.team.team_brain
	var tai: Variant = tb if tb != null and tb.has_method("is_team_ai") else null
	if carrier == p:
		_think_with_ball(m, ball, dt)
		return
	_ball_time = 0.0
	_shield_time = 0.0
	if carrier == null:
		_think_loose(m, ball, tai)
	elif carrier.team == p.team:
		_think_attack(m, ball, carrier.pos, carrier, tai)
	else:
		_think_defend(m, ball, carrier, tai)


func _refresh_difficulty(d_raw: int) -> void:
	var d := AiParams.idx(d_raw)
	if d == _diff:
		return
	_diff = d
	_react = AiParams.react_time(d)
	_noise = AiParams.noise(d)
	_aim_err = AiParams.aim_error(d)
	_stam_floor = AiParams.stamina_floor(d)
	_tackle_f = AiParams.tackle_factor(d)
	_press_f = AiParams.press_factor(d)


func _is_locked() -> bool:
	var p := player
	if p.sent_off:
		return true
	var s := p.state
	return s == FB.PlayerState.TACKLING or s == FB.PlayerState.SLIDING or s == FB.PlayerState.FALLEN \
		or s == FB.PlayerState.DIVING or s == FB.PlayerState.SENT_OFF \
		or s == FB.PlayerState.CELEBRATING or s == FB.PlayerState.SET_PIECE


func _clamp_pitch(v: Vector2) -> Vector2:
	return Vector2(clampf(v.x, -FB.HALF_LENGTH + 0.8, FB.HALF_LENGTH - 0.8),
		clampf(v.y, -FB.HALF_WIDTH + 0.8, FB.HALF_WIDTH - 0.8))


# --- Set pieces ----------------------------------------------------------------
func _think_set_piece(ref: Referee) -> void:
	var p := player
	mode = Mode.SET_PIECE
	var r := ref.restart
	var shape := p.team.shape
	if r.type == FB.Restart.KICKOFF:
		_target = shape.get_kickoff_position(p, r.team_id == p.team.team_id)
	else:
		_target = shape.get_set_piece_position(p, r)
	_want_sprint = p.pos.distance_to(_target) > 10.0
	_arrive_radius = 2.0
	_pend_action = FB.IntentAction.NONE
	if p.is_goalkeeper():
		_gk.mode = AiGoalkeeper.Mode.POSITION


func _failsafe_kick(ref: Referee) -> void:
	# Only if the taker is stuck waiting far longer than any sane set-piece routine.
	var p := player
	var r := ref.restart
	if r.taker != p or r.type == FB.Restart.KICKOFF or _taker_wait < TAKER_FAILSAFE:
		return
	if p.pos.distance_to(r.position) > 3.0:
		return
	var tgt := p.team.target_goal_center()
	var power := 0.9
	if r.type != FB.Restart.PENALTY:
		var mate := p.team.nearest_player_to(p.pos + Vector2(p.team.attack_dir * 12.0, 0.0), true, p)
		if mate != null:
			tgt = mate.pos
		power = 0.6
	p.intent.set_action(FB.IntentAction.SET_PIECE_KICK, tgt, power)
	_taker_wait = 0.0


# --- Loose ball ------------------------------------------------------------------
func _think_loose(m: FootballMatch, ball: Ball, tai: Variant) -> void:
	var p := player
	var speed := AiMath.run_speed(p)
	var ic := AiMath.intercept(p.pos, speed, ball)
	var chaser_eta := INF
	var is_chaser := false
	if tai != null:
		chaser_eta = tai.chaser_eta
		is_chaser = tai.chaser == p
	var ipt := Vector2(ic.y, ic.z)
	if is_chaser or ic.x < chaser_eta * 0.8:
		mode = Mode.CHASE if ball.last_touch_team == p.team.team_id or is_chaser else Mode.INTERCEPT
		_target = _clamp_pitch(ipt)
		_want_sprint = p.pos.distance_to(_target) > 2.0
		_arrive_radius = 0.8
		return
	if ball.last_touch_team == p.team.team_id:
		_think_attack(m, ball, ball.pos, null, tai)
	else:
		_think_defend(m, ball, null, tai)


# --- Attacking off the ball ----------------------------------------------------
func _think_attack(m: FootballMatch, ball: Ball, ref_pos: Vector2, carrier: Player, tai: Variant) -> void:
	var p := player
	var dir := float(p.team.attack_dir)
	var home := p.home_position
	var t := home
	_line_a = AiMath.offside_line_a(p.team)
	mode = Mode.POSITION
	# Ball-side shift (compress towards the ball a little).
	t.y = lerpf(home.y, ref_pos.y, 0.15)
	t.x = home.x + (ref_pos.x - home.x) * 0.08
	var role := p.role
	var sprint_dist := 7.0
	if AiMath.is_defender_role(role):
		var lx: float = tai.defensive_line_x if tai != null else home.x
		t.x = lerpf(home.x, lx, 0.5)
	elif tai != null and carrier != null and (tai.support_near == p or tai.support_far == p):
		mode = Mode.SUPPORT
		var side := signf(home.y - carrier.pos.y)
		if side == 0.0:
			side = 1.0
		if tai.support_near == p:
			t = carrier.pos + Vector2(dir * 4.5, side * 9.0)
		else:
			t = Vector2(carrier.pos.x + dir * 17.0, lerpf(home.y, -carrier.pos.y, 0.4))
		sprint_dist = 3.5
	elif AiMath.is_forward_role(role):
		var want_a: float = maxf(home.x * dir, ref_pos.x * dir + 6.0)
		t.x = minf(want_a, _line_a - 0.8) * dir
		sprint_dist = 4.5
	# Never be offside: stay behind the second-last defender / ball.
	if role != FB.Role.GK:
		var lim := _line_a - 0.6
		if t.x * dir > lim:
			t.x = lim * dir
	_target = _clamp_pitch(t)
	_want_sprint = p.pos.distance_to(_target) > sprint_dist
	_arrive_radius = 2.5


# --- Defending off the ball ----------------------------------------------------
func _think_defend(m: FootballMatch, ball: Ball, carrier: Player, tai: Variant) -> void:
	var p := player
	var home := p.home_position
	var own_goal := p.team.own_goal_center()
	_want_sprint = false
	_arrive_radius = 2.5
	# 1. Presser.
	if tai != null and tai.chaser == p and carrier != null:
		_think_press(m, ball, carrier, tai)
		return
	# 2. Marker.
	if tai != null and carrier != null and p.team.team_brain.marking.has(p):
		var a: Player = p.team.team_brain.marking[p]
		if a != null and not a.sent_off:
			mode = Mode.MARK
			var stand := lerpf(1.4, 3.6, clampf(a.pos.distance_to(ball.pos) / 25.0, 0.0, 1.0))
			var to_goal := own_goal - a.pos
			var l := to_goal.length()
			var gs := to_goal / l if l > 0.01 else Vector2.ZERO
			_target = _clamp_pitch(a.pos + a.vel * 0.3 + gs * stand)
			_want_sprint = p.pos.distance_to(_target) > 5.0
			_arrive_radius = 1.2
			return
	# 3. Cover space: compress to the ball, defenders hold the line.
	mode = Mode.POSITION
	var t := home + Vector2((ball.pos.x - home.x) * 0.10, (ball.pos.y - home.y) * 0.26)
	if AiMath.is_defender_role(p.role) and tai != null:
		t.x = tai.defensive_line_x
	elif tai != null and tai.second_presser == p and carrier != null:
		# Cover behind the presser, on the line to our goal.
		var cp: Player = tai.chaser
		if cp != null:
			var tg := own_goal - cp.pos
			var tl := tg.length()
			if tl > 0.01:
				t = cp.pos + tg / tl * 5.5
	_target = _clamp_pitch(t)
	_want_sprint = p.pos.distance_to(_target) > 8.0
	_arrive_radius = 2.5


func _think_press(m: FootballMatch, ball: Ball, carrier: Player, tai: Variant) -> void:
	var p := player
	var own_goal := p.team.own_goal_center()
	mode = Mode.PRESS
	var d := p.pos.distance_to(carrier.pos)
	var to_goal := own_goal - carrier.pos
	var tl := to_goal.length()
	var goal_side := to_goal / tl if tl > 0.01 else Vector2.ZERO
	var contain: bool = not tai.pressing_active
	# A human teammate who is clearly closer is the presser; the AI stands off.
	var cp := p.team.controlled_player if p.team.is_human else null
	if cp != null and cp.pos.distance_to(carrier.pos) < d - 3.0:
		contain = true
	if contain:
		_target = carrier.pos + goal_side * 4.5
		_want_sprint = d > 12.0
		_arrive_radius = 1.5
	else:
		if d > 3.2:
			_target = carrier.pos + carrier.vel * 0.25
		else:
			_target = carrier.pos + carrier.vel * 0.2 + goal_side * 0.7
		_want_sprint = d > 3.5
		_arrive_radius = 0.6
	_target = _clamp_pitch(_target)
	# Tackle decisions (sparingly).
	if _tackle_cd > 0.0 or not p.motor.can_touch_ball():
		return
	var rng := m.rng
	var from_behind := carrier.facing.dot((p.pos - carrier.pos).normalized()) < -0.25 if d > 0.01 else false
	var tackling := p.data.stat01("tackling")
	if d < 1.35:
		var prob := (0.22 + 0.5 * tackling) * _tackle_f
		if from_behind:
			prob *= 0.35
		if rng.randf() < prob:
			_queue_action(FB.IntentAction.TACKLE, carrier.pos, 0.6, carrier, 0.0)
			_tackle_cd = 1.4
	elif d < 3.0 and not from_behind and _is_last_resort(carrier):
		if rng.randf() < 0.33 * _tackle_f:
			_queue_action(FB.IntentAction.SLIDE, carrier.pos, 0.8, carrier, 0.0)
			_tackle_cd = 2.5


## Carrier running at our goal inside our final third with at most one covering defender.
func _is_last_resort(carrier: Player) -> bool:
	var p := player
	var dir := float(p.team.attack_dir)
	var depth := carrier.pos.x * -dir + FB.HALF_LENGTH
	if depth > 30.0:
		return false
	if carrier.vel.x * -dir < 2.0:
		return false
	var cover := 0
	for q: Player in p.team.players:
		if q == p or q.sent_off or q.is_goalkeeper():
			continue
		if (q.pos.x - carrier.pos.x) * -dir < -1.0 and absf(q.pos.y - carrier.pos.y) < 9.0:
			cover += 1
	return cover <= 1


func _queue_action(action: int, tgt: Vector2, power: float, tp: Player, delay: float, loft: float = 0.0, curve: float = 0.0) -> void:
	_pend_action = action
	_pend_target = tgt
	_pend_power = power
	_pend_player = tp
	_pend_delay = delay
	_pend_loft = loft
	_pend_curve = curve


# ---------------------------------------------------------------------------
# With the ball
# ---------------------------------------------------------------------------
func _think_with_ball(m: FootballMatch, ball: Ball, dt: float) -> void:
	var p := player
	var team := p.team
	mode = Mode.WITH_BALL
	if p.is_goalkeeper():
		_gk.think(dt)
		mode = Mode.GK
		return
	var rng := m.rng
	var dir := float(team.attack_dir)
	var goal := team.target_goal_center()
	var opps := team.opponent.players
	var me := p.pos
	var me_a := me.x * dir
	var own_depth := me.x * -dir + FB.HALF_LENGTH
	_line_a = AiMath.offside_line_a(team)
	var tactics := team.tactics
	# --- Pressure -------------------------------------------------------------
	var near_d := INF
	var near_o: Player = null
	var n_close := 0
	for o: Player in opps:
		if o.sent_off:
			continue
		var od := me.distance_to(o.pos)
		if od < near_d:
			near_d = od
			near_o = o
		if od < 5.0:
			n_close += 1
	var pressure := clampf(1.0 - (near_d - 0.8) / 4.2, 0.0, 1.0)
	pressure = minf(pressure + 0.07 * maxf(float(n_close) - 1.0, 0.0), 1.0)
	var nz := _noise * (1.4 - p.data.stat01("vision"))
	# --- Dribble candidate -------------------------------------------------
	var h0 := goal - me
	var hl := h0.length()
	h0 = h0 / hl if hl > 0.01 else Vector2(dir, 0.0)
	var best_ds := -INF
	var best_dir := h0
	var best_space := 0.0
	for k in range(-3, 4):
		var v := h0.rotated(float(k) * 0.5236)
		var pt := me + v * 6.0
		var min_d := 7.0
		for o: Player in opps:
			if o.sent_off:
				continue
			var sd := AiMath.seg_dist(o.pos, me, pt)
			if sd < min_d:
				min_d = sd
		var space := clampf(min_d / 5.0, 0.0, 1.0)
		var s := 0.55 * space + 0.45 * maxf(v.dot(h0), 0.0)
		if absf(pt.y) > FB.HALF_WIDTH - 1.5 or absf(pt.x) > FB.HALF_LENGTH - 1.0:
			s -= 0.6
		if s > best_ds:
			best_ds = s
			best_dir = v
			best_space = space
	_dribble_dir = best_dir
	var dribble01 := p.data.stat01("dribbling")
	var u_dribble := clampf(0.22 + 0.45 * best_space * (0.6 + 0.4 * maxf(best_dir.dot(h0), 0.0)) - 0.4 * pressure, 0.0, 0.75)
	u_dribble *= 0.75 + 0.5 * dribble01
	if own_depth < 18.0 and pressure > 0.3:
		u_dribble *= 0.5
	_want_sprint = best_space > 0.7 and near_d > 5.0 or (pressure > 0.4 and best_dir.dot(h0) > 0.5)
	_arrive_radius = 1.0
	# Cannot decide yet (reaction time) or just kicked: keep dribbling.
	if _ball_time < _react or p.touch_cooldown > 0.0 or _pend_action != FB.IntentAction.NONE:
		return
	var best_u := u_dribble + (rng.randf() - 0.5) * nz
	var kind: int = FB.IntentAction.NONE   # NONE = keep dribbling
	var best_target := Vector2.ZERO
	var best_player: Player = null
	var best_power := 0.5
	var best_loft := 0.0
	var best_pass_u := -INF
	# --- Shot ----------------------------------------------------------------
	var dg := me.distance_to(goal)
	var shoot01 := p.data.stat01("shooting")
	if dg < 38.0 and me_a > 0.0:
		var ang := AiMath.goal_angle(me, goal)
		var xg := minf((ang / 0.64) * (ang / 0.64), 1.2)
		var lane := AiMath.lane_margin(me, goal, opps, true)
		var lane_f := clampf(0.4 + lane / 0.5, 0.15, 1.0)
		var xg_est := xg * lane_f * (0.6 + 0.6 * shoot01)
		if AiMath.is_forward_role(p.role):
			xg_est *= 1.15
		var u_shoot := xg_est * 2.4 + 0.12 * pressure + (rng.randf() - 0.5) * nz
		if xg_est > 0.08 and u_shoot > best_u:
			best_u = u_shoot
			kind = FB.IntentAction.SHOOT
			best_target = _shot_target(goal, opps, rng)
			best_power = 0.88
			best_loft = 0.0 if lane > 0.0 else 0.25
	# --- Passes --------------------------------------------------------------
	var passing01 := p.data.stat01("passing")
	var w_prog := 0.2 + 0.28 * tactics.tempo + 0.08 * (tactics.mentality - 0.5)
	var wide := absf(me.y) > 16.0 and me_a > 24.0
	for t: Player in team.players:
		if t == p or t.sent_off or not t.can_play():
			continue
		var tp := t.pos
		var d := me.distance_to(tp)
		if d < 4.0 or d > 50.0:
			continue
		var t_a := tp.x * dir
		if t_a > _line_a + 0.2:
			continue  # offside at the moment of the pass
		var mg := AiMath.lane_margin(me, tp, opps)
		var space := clampf(AiMath.nearest_dist(tp, opps, null) / 6.0, 0.0, 1.0)
		var prog := clampf((t_a - me_a) / 25.0, -0.6, 1.0)
		var gprox := 1.0 - clampf(tp.distance_to(goal) / 70.0, 0.0, 1.0)
		var open := clampf(mg / 0.7, 0.0, 1.0)
		var u := 0.34 * open + 0.2 * space + w_prog * prog + 0.14 * gprox + 0.08 * (passing01 - 0.5)
		if mg < 0.15:
			u -= 0.35
		if d > 30.0:
			u -= (d - 30.0) * 0.01
		elif d < 7.0:
			u -= 0.05
		if prog < 0.0 and open > 0.5:
			u += 0.12 * pressure
		if t.is_goalkeeper() and pressure < 0.5:
			u -= 0.25
		u += (rng.randf() - 0.5) * nz
		var pk: int = FB.IntentAction.PASS
		var ptgt := tp + t.vel * clampf(d / 30.0, 0.0, 0.6)
		var ppow := _ground_power(d)
		var ploft := 0.0
		if mg < 0.15 and d > 20.0 and space > 0.5:
			pk = FB.IntentAction.LOB_PASS
			ppow = clampf(0.4 + d / 70.0, 0.4, 1.0)
			ploft = clampf(d / 45.0, 0.35, 0.9)
			u += 0.12  # recover part of the lane penalty: lofted over the press
		elif d > 36.0:
			pk = FB.IntentAction.LOB_PASS
			ppow = clampf(0.4 + d / 70.0, 0.4, 1.0)
			ploft = clampf(d / 45.0, 0.35, 0.9)
		# Cross from wide into the box.
		if wide and t_a > 36.0 and absf(tp.y) < 17.0 and d > 8.0:
			var uc := 0.42 + 0.3 * space + 0.2 * gprox + 0.06 * (passing01 - 0.5) + (rng.randf() - 0.5) * nz
			if uc > u:
				u = uc
				pk = FB.IntentAction.CROSS
				ppow = clampf(0.5 + d / 60.0, 0.5, 0.9)
				ploft = 0.6
		if u > best_pass_u:
			best_pass_u = u
		if u > best_u:
			best_u = u
			kind = pk
			best_target = ptgt
			best_player = t
			best_power = ppow
			best_loft = ploft
		# Through ball behind the line to a forward runner.
		if t_a > me_a + 6.0 and (t.vel.x * dir > 1.5 or AiMath.is_forward_role(t.role)) and pk != FB.IntentAction.CROSS:
			var lead := clampf(d * 0.35, 4.0, 11.0)
			var thr := _clamp_pitch(tp + Vector2(dir * lead, t.vel.y * 0.3))
			var mg2 := AiMath.lane_margin(me, thr, opps)
			if mg2 > 0.15:
				var thr_a := thr.x * dir
				var ut := 0.3 * clampf(mg2 / 0.7, 0.0, 1.0) + 0.2 * space \
					+ w_prog * clampf((thr_a - me_a) / 25.0, 0.0, 1.0) * 1.2 \
					+ 0.2 * (1.0 - clampf(thr.distance_to(goal) / 70.0, 0.0, 1.0)) \
					+ 0.08 * (p.data.stat01("vision") - 0.5) - 0.04 + (rng.randf() - 0.5) * nz
				if ut > best_u:
					best_u = ut
					kind = FB.IntentAction.THROUGH_PASS
					best_target = thr
					best_player = t
					best_power = _ground_power(me.distance_to(thr))
					best_loft = 0.0
	# --- Clear under pressure --------------------------------------------------
	if (own_depth < 30.0 and pressure > 0.55) or (own_depth < 14.0 and pressure > 0.3):
		var u_clear := 0.45 + 0.5 * pressure + (rng.randf() - 0.5) * nz
		if u_clear > best_u:
			best_u = u_clear
			kind = FB.IntentAction.CLEAR
			var side := signf(me.y) if absf(me.y) > 3.0 else (1.0 if rng.randf() < 0.5 else -1.0)
			if near_o != null and signf(near_o.pos.y - me.y) == side and absf(near_o.pos.y - me.y) > 1.0:
				side = -side
			best_target = Vector2(dir * clampf(me_a + 35.0, -10.0, 45.0), side * 24.0)
			best_player = null
			best_power = 1.0
			best_loft = 0.7
	# --- Hold up / shield ------------------------------------------------------
	if kind == FB.IntentAction.NONE and pressure > 0.55 and own_depth >= 30.0 and best_pass_u < 0.35 \
			and _shield_time < 1.5 and near_o != null:
		_shield_time += dt
		_queue_action(FB.IntentAction.SHIELD, near_o.pos, 0.5, near_o, 0.0)
		_dribble_dir = (me - near_o.pos).normalized() * 0.5 + h0 * 0.5
		_want_sprint = false
		return
	if pressure < 0.4:
		_shield_time = 0.0
	if kind == FB.IntentAction.NONE:
		return
	# --- Commit ----------------------------------------------------------------
	var tgt := best_target
	if kind == FB.IntentAction.PASS or kind == FB.IntentAction.THROUGH_PASS \
			or kind == FB.IntentAction.LOB_PASS or kind == FB.IntentAction.CROSS:
		var d2 := me.distance_to(tgt)
		var err := _aim_err * (1.25 - passing01) * clampf(d2 / 25.0, 0.3, 1.2)
		tgt += Vector2(rng.randf_range(-1.0, 1.0), rng.randf_range(-1.0, 1.0)) * err * 0.7
	_queue_action(kind, tgt, best_power, best_player, 0.0, best_loft, 0.0)
	_dribble_dir = (tgt - me).normalized() if tgt != me else _dribble_dir


func _ground_power(d: float) -> float:
	var v := sqrt(64.0 + 6.0 * d)
	return clampf((v - 10.0) / 18.0, 0.25, 1.0)


## Aim for the post furthest from the goalkeeper.
func _shot_target(goal: Vector2, opps: Array[Player], rng: RandomNumberGenerator) -> Vector2:
	var gk_y := 0.0
	for o: Player in opps:
		if o.is_goalkeeper() and not o.sent_off:
			gk_y = o.pos.y
			break
	var half := FB.GOAL_WIDTH * 0.5 - 0.7
	var side := -1.0 if gk_y > goal.y else 1.0
	if _diff == 0 and rng.randf() < 0.4:
		side = -side
	return Vector2(goal.x, goal.y + side * half * (0.75 + 0.25 * rng.randf()))


# ---------------------------------------------------------------------------
# act(): cheap, every tick
# ---------------------------------------------------------------------------
func act(delta: float) -> void:
	var p := player
	var it := p.intent
	if _is_locked():
		it.move = Vector2.ZERO
		it.sprint = false
		return
	var m := p.football_match
	if mode == Mode.GK:
		_gk.act(delta)
		return
	var ball := m.ball
	var has_ball := p.has_ball()
	if has_ball:
		_ball_time += delta
	# Pending one-shot action.
	if _pend_action != FB.IntentAction.NONE:
		_pend_delay -= delta
		if _pend_delay <= 0.0:
			var a := _pend_action
			var needs_ball := a != FB.IntentAction.TACKLE and a != FB.IntentAction.SLIDE
			if not needs_ball or has_ball:
				it.set_action(a, _pend_target, _pend_power, _pend_player)
				it.loft = _pend_loft
				it.curve = _pend_curve
			_pend_action = FB.IntentAction.NONE
			_pend_player = null
	if mode == Mode.IDLE:
		it.move = Vector2.ZERO
		it.sprint = false
		return
	if mode == Mode.SET_PIECE:
		_taker_wait += delta
		if _taker_wait > TAKER_FAILSAFE:
			_failsafe_kick(m.referee)
	# Stamina management.
	if p.stamina < _stam_floor:
		_exhausted = true
	elif p.stamina > _stam_floor + 0.2:
		_exhausted = false
	it.sprint = _want_sprint and not _exhausted
	if mode == Mode.WITH_BALL and has_ball:
		_cur_dir = _cur_dir.lerp(_dribble_dir, minf(1.0, 8.0 * delta))
		var l := _cur_dir.length()
		if l > 0.001:
			_cur_dir /= l
		it.move = _cur_dir
		if _pend_action != FB.IntentAction.NONE and _pend_target != Vector2.ZERO:
			var lk := _pend_target - p.pos
			it.look = lk.normalized() if lk.length_squared() > 0.01 else Vector2.ZERO
		else:
			it.look = Vector2.ZERO
		return
	# Steering to the think() target.
	var to_t := _target - p.pos
	var dist := to_t.length()
	if dist < 0.35:
		it.move = Vector2.ZERO
		var tb := ball.pos - p.pos
		it.look = tb.normalized() if tb.length_squared() > 0.01 else Vector2.ZERO
	else:
		var mag := clampf(dist / _arrive_radius, 0.3, 1.0) if dist < _arrive_radius else 1.0
		it.move = to_t / dist * mag
		it.look = Vector2.ZERO
