extends TeamBrain
## Team-level AI (~10 Hz): chaser/presser selection, marking assignments, defensive line,
## support-player designation and the auto-switch suggestion for the human team.

## Maximum simultaneous man-markers (the rest of the team stays zonal).
const MAX_MARKERS := 5
## Longest man-marking assignment distance (m); beyond this the defender stays zonal.
const MAX_MARK_DIST := 30.0

## Seconds the chaser needs to reach the ball / carrier (INF if no chaser).
var chaser_eta := INF
## Second player who covers/doubles the presser when pressing is high (may be null).
var second_presser: Player = null
## Designated support options for the ball carrier (null if we do not have the ball).
var support_near: Player = null
var support_far: Player = null
## Possession state as seen by this team (refreshed in think()).
var own_has_ball := false
var opp_has_ball := false
var ball_loose := true
## True while the team is pressing (ball inside the pressing trigger zone).
var pressing_active := false
## True while the HARD offside trap has pushed the line up.
var trap_active := false
## Seconds since the human was last sent an auto-switch suggestion.
var _switch_cd := 0.0
var _pending_cand: Player = null
var _pending_time := 0.0
var _att: Array[Player] = []
var _att_threat: Array[float] = []
var _def_pool: Array[Player] = []
var _used: Array[bool] = []
var _prev_marking: Dictionary = {}
var _difficulty := 1


## Marker so the player brain can detect this implementation without a type dependency.
func is_team_ai() -> bool:
	return true


func think(dt: float) -> void:
	var m := team.football_match
	if team.opponent == null or m == null:
		return
	_difficulty = AiParams.idx(m.config.difficulty)
	_update_possession(m.ball)
	if m.referee.is_set_piece_pending():
		chaser = null
		chaser_eta = INF
		second_presser = null
		support_near = null
		support_far = null
		marking.clear()
		_compute_line(m.ball, dt)
		return
	_compute_line(m.ball, dt)
	_pick_chaser(m.ball)
	_assign_marking(m.ball)
	_pick_support(m.ball)
	if team.is_human:
		_human_switch(dt)


func _update_possession(ball: Ball) -> void:
	var carrier := ball.owner_player
	own_has_ball = carrier != null and carrier.team == team
	opp_has_ball = carrier != null and carrier.team != team
	ball_loose = carrier == null


# ---------------------------------------------------------------------------
# Defensive line
# ---------------------------------------------------------------------------
func _compute_line(ball: Ball, dt: float) -> void:
	var dir := float(team.attack_dir)
	var ball_depth := ball.pos.x * dir + FB.HALF_LENGTH
	var lh := team.tactics.line_height
	var max_depth := lerpf(22.0, 46.0, lh)
	var depth: float
	trap_active = false
	if own_has_ball or (ball_loose and ball.last_touch_team == team.team_id):
		depth = clampf(ball_depth - 20.0, 14.0, max_depth + 6.0)
	else:
		depth = clampf(ball_depth - 24.0, 12.0, max_depth)
		if _difficulty == 2 and opp_has_ball and lh > 0.35 and ball_depth > 38.0 \
				and chaser != null and chaser.distance_to_ball() < 5.0:
			depth = minf(depth + 3.5, max_depth + 3.5)
			trap_active = true
	var target := -dir * FB.HALF_LENGTH + dir * depth
	if absf(target - defensive_line_x) > 15.0 or defensive_line_x == 0.0:
		defensive_line_x = target
	else:
		defensive_line_x = move_toward(defensive_line_x, target, 6.0 * dt)


# ---------------------------------------------------------------------------
# Chaser / presser
# ---------------------------------------------------------------------------
func _eta_for(p: Player, ball: Ball) -> float:
	var carrier := ball.owner_player
	if carrier != null:
		return AiMath.reach_time(p, carrier.pos + carrier.vel * 0.25)
	return AiMath.intercept(p.pos, AiMath.run_speed(p), ball).x


func _pick_chaser(ball: Ball) -> void:
	var prev := chaser
	chaser = null
	chaser_eta = INF
	second_presser = null
	pressing_active = false
	if own_has_ball:
		return
	var press := team.tactics.pressing
	var trigger := lerpf(14.0, 36.0, press) * AiParams.press_factor(_difficulty)
	var best_score := INF
	var second_score := INF
	var best_eta := INF
	var human_cp := team.controlled_player if team.is_human else null
	for p: Player in team.players:
		if p.sent_off or p.is_goalkeeper() or not p.can_play() or p == human_cp:
			continue
		var eta := _eta_for(p, ball)
		var score := eta
		var out_of_zone := p.home_position.distance_to(ball.pos) - trigger
		if out_of_zone > 0.0 and not ball_loose:
			score += out_of_zone * 0.06
		if p == prev:
			score *= 0.8
		if score < best_score:
			second_score = best_score
			second_presser = chaser
			best_score = score
			best_eta = eta
			chaser = p
		elif score < second_score:
			second_score = score
			second_presser = p
	chaser_eta = best_eta
	pressing_active = chaser != null and chaser.pos.distance_to(ball.pos) < trigger
	if press < 0.65 or not opp_has_ball or second_score > best_score + 1.3:
		second_presser = null


# ---------------------------------------------------------------------------
# Marking
# ---------------------------------------------------------------------------
func _assign_marking(ball: Ball) -> void:
	_prev_marking.clear()
	_prev_marking.merge(marking)
	marking.clear()
	if own_has_ball:
		return
	var dir := float(team.attack_dir)
	var own_goal := team.own_goal_center()
	var carrier := ball.owner_player
	var human_cp := team.controlled_player if team.is_human else null
	# Attackers sorted by threat (closest to our goal / ball first), insertion sort.
	_att.clear()
	_att_threat.clear()
	for o: Player in team.opponent.players:
		if o.sent_off or o.is_goalkeeper() or o == carrier:
			continue
		var depth_from_goal := o.pos.x * -dir + FB.HALF_LENGTH
		if depth_from_goal > 70.0:
			continue
		var threat := 100.0 - o.pos.distance_to(own_goal) - 0.15 * o.pos.distance_to(ball.pos)
		var i := _att.size()
		_att.append(o)
		_att_threat.append(threat)
		while i > 0 and _att_threat[i - 1] < threat:
			_att[i] = _att[i - 1]
			_att_threat[i] = _att_threat[i - 1]
			i -= 1
		_att[i] = o
		_att_threat[i] = threat
	_def_pool.clear()
	for p: Player in team.players:
		if p.sent_off or p.is_goalkeeper() or p == chaser or p == second_presser or p == human_cp or not p.can_play():
			continue
		_def_pool.append(p)
	var n := mini(mini(_att.size(), _def_pool.size()), MAX_MARKERS)
	_used.clear()
	for i in _def_pool.size():
		_used.append(false)
	for ai in n:
		var a := _att[ai]
		var best_i := -1
		var best_cost := INF
		for di in _def_pool.size():
			if _used[di]:
				continue
			var d := _def_pool[di]
			var dist := d.pos.distance_to(a.pos)
			if dist > MAX_MARK_DIST:
				continue
			var cost := dist
			if AiMath.is_forward_role(d.role):
				cost += 4.0
			elif not AiMath.is_defender_role(d.role):
				cost += 1.0
			if _prev_marking.get(d) == a:
				cost -= 3.0 * (2.0 - AiParams.TEAM_HYSTERESIS[_difficulty])
			if cost < best_cost:
				best_cost = cost
				best_i = di
		if best_i >= 0:
			_used[best_i] = true
			marking[_def_pool[best_i]] = a


# ---------------------------------------------------------------------------
# Support designation
# ---------------------------------------------------------------------------
func _pick_support(ball: Ball) -> void:
	support_near = null
	support_far = null
	var c := ball.owner_player
	if c == null or c.team != team:
		return
	var dir := float(team.attack_dir)
	var human_cp := team.controlled_player if team.is_human else null
	var best_near := -INF
	var best_far := -INF
	var opp := team.opponent.players
	for p: Player in team.players:
		if p == c or p.sent_off or p.is_goalkeeper() or not p.can_play() or p == human_cp:
			continue
		var d := p.pos.distance_to(c.pos)
		if d < 4.0:
			continue
		var mg := AiMath.lane_margin(c.pos, p.pos, opp)
		var prog := (p.pos.x - c.pos.x) * dir
		var s_near := mg * 2.0 - absf(d - 10.0) * 0.12 + prog * 0.01
		if d < 22.0 and s_near > best_near:
			best_near = s_near
			support_near = p
		var s_far := mg + prog * 0.05 - (0.0 if d > 14.0 else 1.0)
		if d < 45.0 and s_far > best_far:
			best_far = s_far
			support_far = p
	if support_far == support_near:
		support_far = null


# ---------------------------------------------------------------------------
# Human-team switching
# ---------------------------------------------------------------------------
## Best player for the human to switch to right now (explicit SWITCH_PLAYER press):
## never the current controlled player.
func suggest_switch_target() -> Player:
	return _best_switch_candidate(true)


func _switch_score(p: Player, ball: Ball) -> float:
	var carrier := ball.owner_player
	var t: float
	if carrier != null:
		t = AiMath.reach_time(p, carrier.pos + carrier.vel * 0.3)
		# Defenders positioned goal-side of the ball are better placed.
		var dir := float(team.attack_dir)
		if carrier.team != team and (p.pos.x - ball.pos.x) * dir < -1.0 \
				and absf(p.pos.y - ball.pos.y) < 12.0:
			t -= 0.5
	else:
		t = AiMath.intercept(p.pos, AiMath.run_speed(p), ball).x
	return t


func _best_switch_candidate(exclude_current: bool) -> Player:
	var ball := team.football_match.ball
	var cur := team.controlled_player
	var best: Player = null
	var best_s := INF
	for p: Player in team.players:
		if p.sent_off or p.is_goalkeeper() or not p.can_play():
			continue
		if exclude_current and p == cur:
			continue
		var s := _switch_score(p, ball)
		if not exclude_current and p == cur:
			s -= 0.35  # hysteresis: the current player is favoured
		if s < best_s:
			best_s = s
			best = p
	return best


func _human_switch(dt: float) -> void:
	_switch_cd -= dt
	var cp := team.controlled_player
	var m := team.football_match
	if cp == null or own_has_ball or m.referee.is_set_piece_pending() or not m.referee.is_ball_in_play():
		_pending_cand = null
		return
	if cp.is_goalkeeper():
		return
	var cand := _best_switch_candidate(false)
	if cand == null or cand == cp:
		_pending_cand = null
		return
	if cand == _pending_cand:
		_pending_time += dt
	else:
		_pending_cand = cand
		_pending_time = 0.0
	if _pending_time >= 0.25 and _switch_cd <= 0.0:
		_switch_cd = 1.5
		_pending_cand = null
		EventBus.auto_switch_suggested.emit(cand)
