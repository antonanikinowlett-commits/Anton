extends PlayerMotor
## Player motor (PHYSICS module): executes PlayerIntent.
## Locomotion (acceleration / top speed / turn rate from stats, stamina), ball control with first
## touch, dribble risk, kicks with realistic error, standing & slide tackles, goalkeeper dives and
## catches. Everything is allocation-free per tick (value-type Vector2 temporaries only).
##
## Power semantics (documented for brains):
##   PASS / THROUGH_PASS / LOB_PASS / CROSS / GK_THROW: power is a *weight* around the ideal speed to
##     reach target_point (0.5 = ideal, <0.5 under-hit, >0.5 firmer).
##   SHOOT / CLEAR / GK_KICK / SET_PIECE_KICK: power is *absolute* strength 0..1 (SHOOT max ~30 m/s).
##   loft 0..1 sets the launch elevation; curve -1..1 sets sidespin (positive = left of travel).

const PM = preload("res://physics/phys_math.gd")

## Centre-to-centre distance within which a loose ball can be controlled.
const REACH := 0.95
const REACH_SQ := REACH * REACH
const KICK_REACH := 1.35
const TACKLE_REACH := 1.55
const SLIDE_REACH := 1.65
const GK_REACH := 1.15
const GK_DIVE_REACH := 1.65
const GK_HOLD_TIME := 5.0
## Balls faster than this (relative) cannot be cushioned by an outfield player (body block instead).
const MAX_CONTROL_REL_SPEED := 15.0

var _data_ref: PlayerData = null
# Cached stats (0..1) and derived locomotion constants.
var _sprint_top := 8.5
var _jog_top := 6.1
var _accel := 5.5
var _brake := 8.0
var _turn := 7.0
var _drain := 0.02
var _rec_jog := 0.006
var _rec_rest := 0.02
var _ctrl := 0.6
var _drib := 0.6
var _tack := 0.6
var _str := 0.6
var _agg := 0.5
var _pass := 0.6
var _shoot := 0.6
var _gk := 0.2
var _refl := 0.2

var _turn_now := 0.0
var _skill_timer := 0.0
var _slide_dir := Vector2.RIGHT
var _slide_resolved := false
var _slide_won := false


func _refresh_stats() -> void:
	var d: PlayerData = player.data
	_data_ref = d
	var pace := d.stat01("pace")
	_sprint_top = lerpf(7.2, 9.5, pace)
	_jog_top = _sprint_top * 0.72
	_accel = lerpf(4.2, 7.2, d.stat01("acceleration"))
	var agi := d.stat01("agility")
	_turn = lerpf(5.0, 10.0, agi)
	_brake = lerpf(6.5, 9.0, agi)
	var sta := d.stat01("stamina")
	_drain = lerpf(0.030, 0.014, sta)
	_rec_jog = lerpf(0.004, 0.009, sta)
	_rec_rest = lerpf(0.015, 0.03, sta)
	_ctrl = d.stat01("control")
	_drib = d.stat01("dribbling")
	_tack = d.stat01("tackling")
	_str = d.stat01("strength")
	_agg = d.stat01("aggression")
	_pass = d.stat01("passing")
	_shoot = d.stat01("shooting")
	_gk = d.stat01("goalkeeping")
	_refl = d.stat01("reflexes")


## Can this player physically play the ball now (not locked in a tackle/fall, off cooldown)?
func can_touch_ball() -> bool:
	var p := player
	if not p.can_play() or p.touch_cooldown > 0.0:
		return false
	var s := p.state
	return s == FB.PlayerState.NORMAL or s == FB.PlayerState.SET_PIECE \
		or s == FB.PlayerState.HOLDING_BALL or s == FB.PlayerState.DIVING


## True while a skill move is in progress (harder to tackle, sharper turns).
func skill_active() -> bool:
	return _skill_timer > 0.0


## Top sprint speed (m/s) of this player when fresh. Exposed for tests / AI.
func sprint_top_speed() -> float:
	if player.data != _data_ref:
		_refresh_stats()
	return _sprint_top


## Executes the intent for this tick. Always clears one-shot actions.
func step(delta: float) -> void:
	var p := player
	if p.data != _data_ref:
		_refresh_stats()
	var it := p.intent
	var m := p.football_match
	if _skill_timer > 0.0:
		_skill_timer -= delta
	match p.state:
		FB.PlayerState.NORMAL, FB.PlayerState.SET_PIECE:
			_step_free(delta, it, m)
		FB.PlayerState.HOLDING_BALL:
			_step_holding(delta, it, m)
		FB.PlayerState.TACKLING:
			_step_tackling(delta, it)
		FB.PlayerState.SLIDING:
			_step_sliding(delta, it, m)
		FB.PlayerState.DIVING:
			_step_diving(delta, it, m)
		_:
			_step_inert(delta, it)
	# Keep players near the pitch.
	p.pos.x = clampf(p.pos.x, -FB.HALF_LENGTH - 3.0, FB.HALF_LENGTH + 3.0)
	p.pos.y = clampf(p.pos.y, -FB.HALF_WIDTH - 3.0, FB.HALF_WIDTH + 3.0)


# --- States ----------------------------------------------------------------------
func _step_free(delta: float, it: PlayerIntent, m: FootballMatch) -> void:
	var p := player
	var act := it.action
	if act != FB.IntentAction.NONE:
		if is_kick_action(act):
			_do_kick(it)
		elif act == FB.IntentAction.TACKLE or act == FB.IntentAction.SLIDE:
			_start_tackle(it, act == FB.IntentAction.SLIDE)
		elif act == FB.IntentAction.GK_DIVE:
			_start_dive(it)
		elif act == FB.IntentAction.SKILL:
			_start_skill(it)
		it.clear_action()
	if p.state == FB.PlayerState.NORMAL or p.state == FB.PlayerState.SET_PIECE:
		_gk_reflex(m)
		if p.state == FB.PlayerState.DIVING:
			return
		_locomote(delta, it, 99.0)
		_ball_interaction(delta, m)


func _step_holding(delta: float, it: PlayerIntent, m: FootballMatch) -> void:
	var p := player
	if m.ball.owner_player != p:
		p.state = FB.PlayerState.NORMAL
		it.clear_action()
		return
	p.state_timer -= delta
	var act := it.action
	if act != FB.IntentAction.NONE:
		if is_kick_action(act):
			_do_kick(it)
		it.clear_action()
	elif p.state_timer <= 0.0:
		# Referee-friendly auto release: punt it downfield.
		it.set_action(FB.IntentAction.GK_KICK, p.pos + Vector2(p.team.attack_dir * 30.0, p.pos.y * 0.3), 0.7)
		it.loft = 0.7
		_do_kick(it)
		it.clear_action()
	if p.state == FB.PlayerState.HOLDING_BALL:
		_locomote(delta, it, 3.2)


func _step_tackling(delta: float, it: PlayerIntent) -> void:
	var p := player
	p.state_timer -= delta
	it.clear_action()
	_locomote(delta, it, 1.6)
	if p.state_timer <= 0.0:
		p.state = FB.PlayerState.NORMAL


func _step_sliding(delta: float, it: PlayerIntent, m: FootballMatch) -> void:
	var p := player
	p.state_timer -= delta
	it.clear_action()
	var s := maxf(p.vel.length() - 9.0 * delta, 0.0)
	p.vel = _slide_dir * s
	p.pos += p.vel * delta
	p.facing = _slide_dir
	if not _slide_resolved:
		_slide_contact(m)
	if p.state_timer <= 0.0:
		if not _slide_resolved:
			EventBus.tackle_attempted.emit(p, null, true, false)
		_slide_resolved = true
		p.state = FB.PlayerState.FALLEN
		p.state_timer = 0.55


func _step_diving(delta: float, it: PlayerIntent, m: FootballMatch) -> void:
	var p := player
	p.state_timer -= delta
	it.clear_action()
	var s := maxf(p.vel.length() - 6.0 * delta, 0.0)
	if s > 0.0:
		p.vel = p.vel.normalized() * s
	else:
		p.vel = Vector2.ZERO
	p.pos += p.vel * delta
	var ball := m.ball
	if ball.owner_player == null and not ball.frozen and p.touch_cooldown <= 0.0 \
			and ball.last_touch_team != p.team.team_id and ball.height < 2.6 \
			and p.pos.distance_squared_to(ball.pos) < GK_DIVE_REACH * GK_DIVE_REACH:
		_gk_catch(ball, true)
	if p.state == FB.PlayerState.DIVING and p.state_timer <= 0.0:
		p.state = FB.PlayerState.FALLEN
		p.state_timer = 0.7


## FALLEN, CELEBRATING, SENT_OFF: no control, just slide to a stop.
func _step_inert(delta: float, it: PlayerIntent) -> void:
	var p := player
	it.clear_action()
	var s := p.vel.length()
	if s > 0.0:
		s = maxf(s - _brake * 1.2 * delta, 0.0)
		p.vel = p.vel.normalized() * s if s > 0.0 else Vector2.ZERO
		p.pos += p.vel * delta
	if p.state == FB.PlayerState.FALLEN:
		p.state_timer -= delta
		if p.state_timer <= 0.0:
			p.state = FB.PlayerState.NORMAL
	elif p.state == FB.PlayerState.CELEBRATING:
		p.stamina = minf(p.stamina + _rec_rest * delta, 1.0)
	p.touch_cooldown = maxf(p.touch_cooldown, 0.0)


# --- Locomotion ----------------------------------------------------------------------
func _locomote(dt: float, it: PlayerIntent, speed_cap: float) -> void:
	var p := player
	var want := it.move
	var wl := want.length()
	if wl > 1.0:
		want /= wl
		wl = 1.0
	var v := p.vel
	var s := v.length()
	var sprinting := it.sprint and p.stamina > 0.03 and wl > 0.1
	# Fatigue: lower stamina costs top speed.
	var fat := lerpf(0.82, 1.0, smoothstep(0.0, 0.4, p.stamina))
	var top := (_sprint_top if sprinting else _jog_top) * fat
	if p.has_ball():
		top *= 0.93 + 0.07 * _drib
	top = minf(top, speed_cap)
	var sd := top * wl if wl > 0.05 else 0.0
	_turn_now = 0.0
	if sd > 0.0:
		var dd := want / wl
		if s > 0.4:
			var diff := v.angle_to(dd)
			var omega := _turn / (1.0 + s * 0.18)
			if _skill_timer > 0.0:
				omega *= 1.8
			var step_a := clampf(diff, -omega * dt, omega * dt)
			v = v.rotated(step_a)
			_turn_now = absf(step_a) / dt
			# Cutting costs speed.
			s *= 1.0 - minf(absf(step_a) * 0.15, 0.3)
			if s < sd:
				var a := _accel * maxf(1.0 - s / (_sprint_top * 1.2), 0.25)
				s = minf(sd, s + a * dt)
			else:
				s = maxf(sd, s - _brake * 0.7 * dt)
			v = v.normalized() * s
		else:
			s = minf(sd, s + _accel * dt)
			v = dd * s if s > 0.0 else dd * 0.05
			if s <= 0.0:
				s = 0.05
	elif s > 0.0:
		s = maxf(s - _brake * dt, 0.0)
		v = v.normalized() * s if s > 0.0 else Vector2.ZERO
	p.vel = v
	p.pos += v * dt
	# Stamina.
	if sprinting and s > 3.0:
		p.stamina = maxf(p.stamina - _drain * dt, 0.0)
	elif s > 1.0:
		p.stamina = minf(p.stamina + _rec_jog * dt, 1.0)
	else:
		p.stamina = minf(p.stamina + _rec_rest * dt, 1.0)
	# Facing.
	var face := it.look
	if face.length_squared() < 0.0001:
		face = v if s > 0.5 else Vector2.ZERO
	if face != Vector2.ZERO:
		var fd := p.facing.angle_to(face)
		var fr := (9.0 + _turn * 0.6) * dt
		p.facing = p.facing.rotated(clampf(fd, -fr, fr))


# --- Ball interaction -------------------------------------------------------------------
func _ball_interaction(delta: float, m: FootballMatch) -> void:
	var p := player
	var ball := m.ball
	if ball.frozen:
		return
	var owner := ball.owner_player
	if owner == p:
		_dribble_risk(delta, m)
		return
	if owner != null or not can_touch_ball():
		return
	var d2 := p.pos.distance_squared_to(ball.pos)
	var gk_hands := p.is_goalkeeper() and ball.last_touch_team != p.team.team_id and ball.height < 2.3
	if d2 > (GK_REACH * GK_REACH if gk_hands else REACH_SQ):
		return
	if _closer_contender(ball.pos, d2, m):
		return
	if gk_hands:
		_gk_catch(ball, false)
		return
	if ball.height > 1.2:
		return
	var rel := (ball.vel - p.vel).length()
	if rel > MAX_CONTROL_REL_SPEED:
		return
	var press := _pressure()
	var prob := 0.55 + 0.45 * _ctrl - 0.035 * rel - 0.2 * press - 0.1 * (1.0 - p.stamina)
	if ball.height > 0.5:
		prob -= 0.15
	if rel < 3.5:
		prob = maxf(prob, 0.95)
	prob = clampf(prob, 0.1, 1.0)
	if m.rng.randf() < prob:
		ball.set_carrier(p)
	else:
		# Heavy first touch: ball squirts away.
		var away := ball.pos - p.pos
		away = away.normalized() if away.length_squared() > 0.0001 else p.facing
		away = away.rotated(m.rng.randf_range(-0.7, 0.7))
		ball.vel = ball.vel * 0.4 + away * (1.5 + rel * 0.18)
		ball.register_touch(p)
		p.touch_cooldown = 0.3


## True if another player who can play the ball is clearly closer to it.
func _closer_contender(bpos: Vector2, my_d2: float, m: FootballMatch) -> bool:
	var me := player
	for o: Player in m.players:
		if o == me or o.sent_off or o.touch_cooldown > 0.0 or o.state == FB.PlayerState.FALLEN:
			continue
		if o.pos.distance_squared_to(bpos) < my_d2 - 0.04:
			return true
	return false


func _dribble_risk(delta: float, m: FootballMatch) -> void:
	var p := player
	var s := p.vel.length()
	if s < 5.0 or p.state != FB.PlayerState.NORMAL:
		return
	var risk := (1.0 - _drib) * 0.2 * clampf(_turn_now / 5.0, 0.0, 1.5)
	if p.intent.sprint:
		risk += (1.0 - _drib) * 0.03
	if risk <= 0.0 or m.rng.randf() >= risk * delta:
		return
	var ball := m.ball
	ball.set_carrier(null)
	ball.vel = p.vel * 1.1 + p.facing.rotated(m.rng.randf_range(-0.4, 0.4)) * 1.5
	ball.register_touch(p)
	p.touch_cooldown = 0.35


## Pressure 0..1 from opponents close to this player.
func _pressure() -> float:
	var p := player
	var opp := p.team.opponent
	if opp == null:
		return 0.0
	var s := 0.0
	for o: Player in opp.players:
		if o.sent_off:
			continue
		var d2 := o.pos.distance_squared_to(p.pos)
		if d2 < 9.0:
			s += 1.0 - sqrt(d2) / 3.0
	return minf(s, 1.0)


# --- Kicking --------------------------------------------------------------------------------
func _do_kick(it: PlayerIntent) -> bool:
	var p := player
	var m := p.football_match
	var ball := m.ball
	var act := it.action
	var has := ball.owner_player == p
	if has:
		if not p.can_play():
			return false
	else:
		if ball.owner_player != null or not can_touch_ball():
			return false
		if p.pos.distance_squared_to(ball.pos) > KICK_REACH * KICK_REACH or ball.height > 2.2:
			return false
	if ball.frozen:
		var ref := m.referee
		if not ref.is_set_piece_pending() or (ref.restart.taker != null and ref.restart.taker != p):
			return false
	var header := (not has) and ball.height > 0.8
	var pw := clampf(it.power, 0.0, 1.0)
	var to := it.target_point - p.pos
	var dist := to.length()
	var dir := to / dist if dist > 0.05 else p.facing
	var weight := lerpf(0.75, 1.25, pw)
	var v := 10.0
	var elev := 0.0
	var skill := _pass
	var sig_mult := 1.0
	var shot := false
	var loft := it.loft
	match act:
		FB.IntentAction.PASS:
			v = clampf(PM.ideal_ground_speed(dist, 4.0) * weight, 4.0, PM.MAX_PASS_SPEED)
		FB.IntentAction.THROUGH_PASS:
			v = clampf(PM.ideal_ground_speed(dist, 6.0) * weight, 5.0, PM.MAX_PASS_SPEED)
		FB.IntentAction.LOB_PASS:
			elev = deg_to_rad(lerpf(18.0, 58.0, loft if loft > 0.01 else 0.5))
			v = minf(PM.lob_speed(maxf(dist, 4.0), elev) * weight, 29.0)
			sig_mult = 1.2
		FB.IntentAction.CROSS:
			elev = deg_to_rad(lerpf(14.0, 48.0, loft if loft > 0.01 else 0.45))
			v = minf(PM.lob_speed(maxf(dist, 4.0), elev) * weight, 28.0)
			sig_mult = 1.15
		FB.IntentAction.SHOOT:
			skill = _shoot
			v = PM.shot_speed(pw, _shoot)
			elev = deg_to_rad(loft * 42.0)
			shot = true
		FB.IntentAction.CLEAR:
			skill = (_pass + _shoot) * 0.5
			v = lerpf(16.0, 29.0, pw) * (0.88 + 0.12 * skill)
			elev = deg_to_rad(lerpf(20.0, 52.0, loft if loft > 0.01 else 0.65))
			sig_mult = 2.0
		FB.IntentAction.GK_THROW:
			skill = (_pass + _gk) * 0.5
			if dist <= 18.0:
				v = clampf(PM.ideal_ground_speed(dist, 5.0) * weight, 4.0, 20.0)
			else:
				elev = deg_to_rad(28.0)
				v = minf(PM.lob_speed(dist, elev) * weight, 24.0)
		FB.IntentAction.GK_KICK:
			skill = (_pass + _gk) * 0.5
			v = lerpf(17.0, 30.0, pw) * (0.85 + 0.15 * skill)
			elev = deg_to_rad(lerpf(18.0, 52.0, loft if loft > 0.01 else 0.7))
			sig_mult = 1.6
		_:  # SET_PIECE_KICK
			skill = (_pass + _shoot) * 0.5
			v = lerpf(7.0, 31.0, pw) * (0.92 + 0.08 * skill)
			elev = deg_to_rad(loft * 50.0)
			var rtype := m.referee.restart.type
			if rtype == FB.Restart.THROW_IN:
				v = minf(v, 19.0)
				elev = maxf(elev, deg_to_rad(20.0))
			elif rtype == FB.Restart.PENALTY or rtype == FB.Restart.FREE_KICK_DIRECT:
				shot = absf(ball.pos.x - p.team.target_goal_center().x) < 40.0 \
					and signf(dir.x) == float(p.team.attack_dir)
	if header:
		v *= 0.7
		sig_mult *= 1.6
		if elev == 0.0 and not shot:
			elev = deg_to_rad(8.0)
	# Accuracy: skill, pressure, fatigue, overhitting, running speed.
	var press := _pressure() if act != FB.IntentAction.SET_PIECE_KICK else 0.0
	var sigma := deg_to_rad(PM.kick_error_deg(skill, press, 1.0 - p.stamina, pw, shot))
	sigma *= sig_mult * (1.0 + 0.04 * p.vel.length())
	var rng := m.rng
	var err := clampf(rng.randfn(0.0, sigma), -2.5 * sigma, 2.5 * sigma)
	dir = dir.rotated(err)
	v *= 1.0 + clampf(rng.randfn(0.0, 0.015 + 0.035 * (1.0 - skill)), -0.1, 0.1)
	v = minf(v, PM.MAX_BALL_SPEED)
	var gspeed := v * cos(elev)
	var vz := v * sin(elev)
	if shot:
		vz += absf(rng.randfn(0.0, sigma)) * v * 0.5
	var spin := it.curve * PM.MAX_SPIN * (0.55 + 0.45 * skill)
	var gv := dir * gspeed
	if shot:
		var on_target := _on_target(ball.pos, gv, vz, p.team.target_goal_center().x)
		ball.kick(gv, vz, spin, p)
		EventBus.shot_taken.emit(p, on_target)
	else:
		ball.kick(gv, vz, spin, p)
	p.facing = dir
	p.touch_cooldown = 0.45 if (shot or act == FB.IntentAction.CLEAR) else 0.3
	p.stamina = maxf(p.stamina - 0.004 * (0.5 + pw), 0.0)
	if p.state == FB.PlayerState.HOLDING_BALL:
		p.state = FB.PlayerState.NORMAL
	EventBus.ball_kicked.emit(p, act, pw)
	return true


## Rough check (no drag) whether a shot will cross the goal mouth.
func _on_target(from: Vector2, gv: Vector2, vz: float, goal_x: float) -> bool:
	if absf(gv.x) < 0.01 or signf(gv.x) != signf(goal_x - from.x):
		return false
	var t := (goal_x - from.x) / gv.x
	var y := from.y + gv.y * t
	var z := vz * t - 0.5 * FB.GRAVITY * t * t
	return absf(y) < FB.GOAL_WIDTH * 0.5 and z > -0.1 and z < FB.GOAL_HEIGHT


func _start_skill(it: PlayerIntent) -> void:
	var p := player
	if not p.has_ball():
		return
	var dir := it.target_point - p.pos
	if dir.length_squared() < 0.01:
		dir = it.move if it.move != Vector2.ZERO else p.facing
	dir = dir.normalized()
	_skill_timer = 0.45
	# Drag-back / feint: a burst of speed in the chosen direction.
	var s := maxf(p.vel.length(), 3.0)
	p.vel = p.vel.lerp(dir * minf(s + 1.2, _sprint_top), 0.65)
	p.stamina = maxf(p.stamina - 0.004, 0.0)


# --- Tackles ------------------------------------------------------------------------------------
func _start_tackle(it: PlayerIntent, slide: bool) -> void:
	var p := player
	if not p.can_play():
		return
	var m := p.football_match
	var victim: Player = it.target_player
	var reach := SLIDE_REACH if slide else TACKLE_REACH
	if victim != null and (victim.team == p.team or victim.sent_off \
			or victim.pos.distance_squared_to(p.pos) > reach * reach * 1.4):
		victim = null
	if victim == null:
		var o := m.ball.owner_player
		if o != null and o.team != p.team and o.pos.distance_squared_to(p.pos) <= reach * reach:
			victim = o
	if slide:
		var dir := it.target_point - p.pos
		if dir.length_squared() < 0.01:
			dir = p.facing
		_slide_dir = dir.normalized()
		var s0 := clampf(p.vel.length() + 2.5, 6.5, 9.8)
		p.vel = _slide_dir * s0
		p.state = FB.PlayerState.SLIDING
		p.state_timer = 0.7
		_slide_resolved = false
		p.stamina = maxf(p.stamina - 0.01, 0.0)
		return
	p.state = FB.PlayerState.TACKLING
	p.state_timer = 0.42
	p.stamina = maxf(p.stamina - 0.004, 0.0)
	if victim != null:
		_resolve_challenge(victim, false)
	else:
		EventBus.tackle_attempted.emit(p, null, false, false)


func _slide_contact(m: FootballMatch) -> void:
	var p := player
	var ball := m.ball
	var o := ball.owner_player
	if o != null and o.team != p.team:
		if o.pos.distance_squared_to(p.pos) <= SLIDE_REACH * SLIDE_REACH:
			_slide_resolved = true
			_resolve_challenge(o, true)
		return
	if o == null and not ball.frozen and ball.height < 0.6 \
			and ball.pos.distance_squared_to(p.pos) <= 1.2 * 1.2 and p.touch_cooldown <= 0.0:
		# Sliding into a loose ball: poke it away along the slide.
		_slide_resolved = true
		ball.vel = _slide_dir * 7.0 + ball.vel * 0.2
		ball.register_touch(p)
		p.touch_cooldown = 0.3
		EventBus.tackle_attempted.emit(p, null, true, true)


func _resolve_challenge(victim: Player, slide: bool) -> void:
	var p := player
	var m := p.football_match
	var ball := m.ball
	var rng := m.rng
	var dr := victim.stat("dribbling")
	var stv := victim.stat("strength")
	var prob := 0.42 + 0.50 * (_tack - 0.8 * dr) + 0.10 * (_str - stv)
	if slide:
		prob += 0.06
	var to_t := p.pos - victim.pos
	var l := to_t.length()
	var from_behind := l > 0.01 and victim.facing.dot(to_t / l) < -0.3
	if from_behind:
		prob += 0.08
	prob *= 0.85 + 0.15 * p.stamina
	var vmotor := victim.motor
	if vmotor != null and vmotor.has_method("skill_active") and vmotor.skill_active():
		prob -= 0.25
	prob = clampf(prob, 0.06, 0.92)
	var success := rng.randf() < prob
	var intensity := clampf(0.3 + 0.35 * _agg + 0.03 * p.vel.length() + (0.2 if slide else 0.0), 0.0, 1.0)
	var ref := m.referee
	if success:
		var had := ball.owner_player == victim
		if had:
			ball.set_carrier(null)
			var pop := p.facing.rotated(rng.randf_range(-0.6, 0.6)) * 3.5 + victim.vel * 0.3
			ball.vel = pop
			ball.register_touch(p)
			victim.touch_cooldown = 0.5
			p.touch_cooldown = 0.0
			if rng.randf() < 0.35 + 0.35 * _tack:
				ball.set_carrier(p)
		ref.report_contact(p, victim, true, intensity, from_behind)
	else:
		var contact_p := 0.35 + 0.35 * _agg + (0.3 if slide else 0.0)
		if rng.randf() < contact_p:
			victim.touch_cooldown = maxf(victim.touch_cooldown, 0.4)
			if (intensity > 0.6 or slide) and (victim.state == FB.PlayerState.NORMAL or victim.state == FB.PlayerState.SET_PIECE):
				victim.state = FB.PlayerState.FALLEN
				victim.state_timer = 0.9 + 0.8 * intensity
			ref.report_contact(p, victim, false, intensity, from_behind)
	EventBus.tackle_attempted.emit(p, victim, slide, success)


# --- Goalkeeper ---------------------------------------------------------------------------------------
func _start_dive(it: PlayerIntent) -> void:
	var p := player
	if not p.is_goalkeeper() or not p.can_play():
		return
	var dir := it.target_point - p.pos
	if dir.length_squared() < 0.01:
		dir = Vector2(0.0, 1.0)
	dir = dir.normalized()
	p.state = FB.PlayerState.DIVING
	p.state_timer = 0.8
	p.vel = dir * lerpf(5.0, 8.2, _refl)
	p.facing = dir


## AI-controlled keepers react to shots even when the brain does not ask for a dive.
func _gk_reflex(m: FootballMatch) -> void:
	var p := player
	if p.is_human or not p.is_goalkeeper() or p.state != FB.PlayerState.NORMAL:
		return
	var ball := m.ball
	if ball.owner_player != null or ball.frozen or ball.last_touch_team == p.team.team_id:
		return
	var gx := p.team.own_goal_center().x
	var dirx := signf(gx)
	var vx := ball.vel.x
	if vx * dirx < 6.0:
		return
	var t := (p.pos.x - ball.pos.x) / vx
	if t < 0.03 or t > lerpf(0.32, 0.5, _refl):
		return
	var t_line := (gx - ball.pos.x) / vx
	if t_line <= 0.0:
		return
	var y_line := ball.pos.y + ball.vel.y * t_line
	var z_line := ball.height + FB.BALL_RADIUS + ball.vz * t_line - 0.5 * FB.GRAVITY * t_line * t_line
	if absf(y_line) > FB.GOAL_WIDTH * 0.5 + 0.3 or z_line > FB.GOAL_HEIGHT + 0.3:
		return
	var y_gk := ball.pos.y + ball.vel.y * t
	var dy := y_gk - p.pos.y
	if absf(dy) < 0.7:
		return
	var max_v := lerpf(5.0, 8.2, _refl)
	var need := minf(absf(dy) / t * 0.9, max_v)
	p.state = FB.PlayerState.DIVING
	p.state_timer = 0.8
	p.vel = Vector2(0.0, signf(dy) * need)
	p.facing = Vector2(0.0, signf(dy))


## Goalkeeper handling attempt: catch (hold) or parry. Emits save_made for shots.
func _gk_catch(ball: Ball, diving: bool) -> void:
	var p := player
	var m := p.football_match
	var rel := (ball.vel - p.vel).length()
	var prob := 0.97 - 0.022 * maxf(rel - 7.0, 0.0) + 0.3 * (_gk - 0.5) + 0.15 * (_refl - 0.5)
	if ball.height > 1.6:
		prob *= 0.88
	if diving:
		prob -= 0.08
	prob = clampf(prob, 0.08, 0.98)
	var shot := rel > 8.0
	if m.rng.randf() < prob:
		ball.set_carrier(p)
		p.state = FB.PlayerState.HOLDING_BALL
		p.state_timer = GK_HOLD_TIME
		p.vel = Vector2.ZERO
	else:
		# Parry: pushed wide / up, away from goal.
		var side := signf(ball.pos.y - p.pos.y)
		if side == 0.0:
			side = 1.0 if m.rng.randf() < 0.5 else -1.0
		var away_x := -signf(p.team.own_goal_center().x)
		ball.vel = Vector2(away_x * (2.0 + rel * 0.2), side * (3.0 + rel * 0.3))
		ball.vz = 1.5 + rel * 0.1
		ball.register_touch(p)
		p.touch_cooldown = 0.35
	if shot:
		EventBus.save_made.emit(p)
