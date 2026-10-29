extends TeamShape
## TACTICS implementation of TeamShape (slot: tactics/team_shape_impl.gd).
##
## All shape maths is done in the team's "attack frame" (metres): x 0 = own goal line .. 105 =
## opponent goal line, y 0 = left touchline .. 68 as seen by the attacking team. Results are
## converted to world metres at the end (see TacShapeMath.to_frame / from_frame).

const L := FB.PITCH_LENGTH
const W := FB.PITCH_WIDTH
const HL := FB.HALF_LENGTH
const HW := FB.HALF_WIDTH

# Per-group tables, indexed by TacShapeMath.Group (GK, DEF, WB, DM, CM, AM, WIDE, FWD).
const K_BLOCK := [0.0, 0.30, 0.38, 0.40, 0.45, 0.50, 0.45, 0.40]
const PUSH_ATT := [0.0, 5.0, 12.0, 5.0, 7.0, 8.0, 10.0, 6.0]
const DROP_DEF := [0.0, 2.0, 6.0, 3.0, 5.0, 8.0, 9.0, 3.0]
const MENT_F := [0.0, 0.3, 0.6, 0.4, 0.8, 1.0, 1.0, 1.0]
const LINE_F := [0.0, 1.0, 0.8, 0.6, 0.4, 0.3, 0.3, 0.2]
const PRESS_F := [0.0, 0.5, 0.5, 0.8, 0.8, 0.8, 0.8, 0.5]
const COMPACT_F := [0.0, 0.18, 0.10, 0.30, 0.28, 0.25, 0.12, 0.15]
const TEMPO_F := [0.0, 0.0, 0.3, 0.0, 0.3, 1.0, 1.0, 1.0]

const MIN_SPACING := 6.0
const SMOOTH_RATE := 5.0

# Set-piece layouts. "End" coordinates: x = depth from the goal line (m), y = lateral offset from
# the goal centre, positive on the side of the restart spot.
const THROW_OPTS := [Vector2(5.0, 6.0), Vector2(-6.0, 9.0), Vector2(12.0, 12.0), Vector2(-11.0, 15.0)]
const CORNER_NEAR := [Vector2(4.0, 3.0), Vector2(6.5, 0.5), Vector2(7.5, -3.5), Vector2(10.5, 6.0), Vector2(11.5, -7.0)]
const CORNER_FAR := [Vector2(6.0, -4.0), Vector2(6.5, 0.5), Vector2(8.5, 3.5), Vector2(10.5, -8.0), Vector2(12.5, 1.0)]
const CORNER_SHORT := [Vector2(7.0, -1.0), Vector2(9.0, 4.5), Vector2(10.5, -5.0), Vector2(13.0, 0.5)]
const CORNER_REST := [Vector2(45.0, -13.0), Vector2(45.0, 13.0), Vector2(42.0, 0.0)]
const FK_BOX := [Vector2(8.0, -3.0), Vector2(6.0, 2.5), Vector2(11.0, -7.0), Vector2(9.5, 7.0)]
const WALL_OFFSETS := [0.0, 1.0, -1.0, 2.0, -2.0]

# --- Per-update state (preallocated) -------------------------------------------
var _tgt := PackedVector2Array()
var _cur := PackedVector2Array()
var _grp := PackedInt32Array()
var _inited := false
var _attack := 0.5
var _ball_a := Vector2(HL, HW)
var _line_x := 25.0
var _off_line := L

# Frame state shared by the helpers during one update.
var _bx := HL
var _by := HW
var _att := 0.5
var _def := 0.5
var _press := 0.5
var _line_h := 0.5
var _width := 0.5
var _tempo := 0.5
var _ment := 0.5

# --- Set-piece cache -------------------------------------------------------------
var _sp_pos := PackedVector2Array()
var _sp_valid := false
var _sp_type := -1
var _sp_team := -2
var _sp_spot := Vector2.ZERO
var _sp_taker_id := 0
var _sp_tick := 0
var _sp_n := 0
var _sp_direct := true


func setup(t: Team) -> void:
	super.setup(t)
	_inited = false
	_sp_valid = false


# =================================================================================
# Open play
# =================================================================================

## Writes home_position (world metres) for every player. Call at ~10 Hz.
func update(dt: float) -> void:
	var n := team.players.size()
	var fm := team.football_match
	if n == 0 or fm == null or fm.ball == null or team.formation == null:
		return
	if dt <= 0.0:
		dt = 0.1
	_ensure_size(n)
	var dir := team.attack_dir
	var tac := team.tactics
	_press = tac.pressing
	_line_h = tac.line_height
	_width = tac.width
	_tempo = tac.tempo
	_ment = tac.mentality

	var ball_a := TacShapeMath.to_frame(fm.ball.pos, dir)
	if _inited:
		_ball_a = _ball_a.lerp(ball_a, minf(1.0, dt * 6.0))
	else:
		_ball_a = ball_a
	_bx = _ball_a.x
	_by = _ball_a.y
	var poss := fm.possession_team
	var want := 0.5
	if poss == team.team_id:
		want = 1.0
	elif poss >= 0:
		want = 0.0
	_attack = move_toward(_attack, want, dt * 1.5)
	if not _inited:
		_attack = want
	_att = _attack
	_def = 1.0 - _attack
	_off_line = _offside_line()

	var positions := team.formation.positions
	var nslots := positions.size()
	var def_sum := 0.0
	var def_cnt := 0
	# 1) raw per-player targets
	for i in n:
		var p: Player = team.players[i]
		if p.sent_off:
			_grp[i] = -1
			continue
		var slot := clampi(p.slot_index, 0, nslots - 1)
		var g := TacShapeMath.group_of(p.role)
		_grp[i] = g
		if g == TacShapeMath.Group.GK:
			_tgt[i] = _goalkeeper_target(positions[slot])
			continue
		var t := _base_target(p.role, g, positions[slot])
		_tgt[i] = t
		if g == TacShapeMath.Group.DEF:
			def_sum += t.x
			def_cnt += 1
	# 2) coherent defensive line
	var line := 25.0
	if def_cnt > 0:
		line = def_sum / def_cnt
	var cap := clampf(maxf(_ball_a.x - 8.0 + 8.0 * _att, 14.0), 14.0, 62.0)
	line = clampf(line, 9.0, cap)
	_line_x = line
	for i in n:
		var g: int = _grp[i]
		if g < 0 or g == TacShapeMath.Group.GK:
			continue
		var t: Vector2 = _tgt[i]
		var role: int = team.players[i].role
		match g:
			TacShapeMath.Group.DEF:
				var off := 0.0
				if def_cnt >= 3 and role == FB.Role.CB and absf(t.y - HW) < 6.0:
					off = -1.5
				t.x = lerpf(t.x, line + off, 0.9)
			TacShapeMath.Group.WB:
				if def_cnt >= 3 and _def > 0.55:
					t.x = lerpf(t.x, line + 4.0, (_def - 0.55) * 2.0)
			TacShapeMath.Group.DM:
				# Screen the back line: stay between the line and the ball.
				t.x = maxf(line + 7.0, minf(t.x, _ball_a.x - 6.0))
				t.y = lerpf(t.y, HW + (_by - HW) * 0.55, 0.5)
			_:
				t.x = maxf(t.x, line + 5.5)
		# Never be offside-ahead of the ball while waiting.
		t.x = minf(t.x, maxf(_off_line - 0.8, ball_a.x))
		_tgt[i] = t
	# 3) spacing + pitch limits
	_separate(n)
	# 4) smoothing and output
	var alpha := 1.0 - exp(-dt * SMOOTH_RATE)
	for i in n:
		var g: int = _grp[i]
		if g < 0:
			continue
		var t: Vector2 = _tgt[i]
		if g == TacShapeMath.Group.GK:
			t.x = clampf(t.x, 1.0, 12.0)
			t.y = clampf(t.y, HW - 6.0, HW + 6.0)
		else:
			t.x = clampf(t.x, 6.0, L - 1.5)
			t.y = clampf(t.y, 2.0, W - 2.0)
		if _inited:
			_cur[i] = (_cur[i] as Vector2).lerp(t, alpha)
		else:
			_cur[i] = t
		team.players[i].home_position = TacShapeMath.from_frame(_cur[i], dir)
	_inited = true


func _ensure_size(n: int) -> void:
	if _tgt.size() != n:
		_tgt.resize(n)
		_cur.resize(n)
		_grp.resize(n)
		_inited = false


func _goalkeeper_target(np: Vector2) -> Vector2:
	var base_x := np.x * L
	var adv := _line_h * _att * clampf((_bx - 35.0) / 45.0, 0.0, 1.0) * 7.0
	var gy := HW + clampf((_by - HW) * 0.15, -4.0, 4.0)
	return Vector2(base_x + adv, gy)


func _base_target(role: int, g: int, np: Vector2) -> Vector2:
	var fx := np.x * L
	var fy := np.y * W
	var x: float = fx + (_bx - HL) * K_BLOCK[g]
	x += _att * PUSH_ATT[g] - _def * DROP_DEF[g]
	x += (_ment - 0.5) * 12.0 * MENT_F[g]
	x += (_press - 0.5) * 10.0 * _def * PRESS_F[g]
	x += (_line_h - 0.5) * 14.0 * LINE_F[g]
	x += (_tempo - 0.5) * 6.0 * _att * TEMPO_F[g]
	var wscale := lerpf(0.75, 1.25, _width)
	if g == TacShapeMath.Group.WIDE or g == TacShapeMath.Group.WB:
		wscale += 0.08 * _att
	var y := HW + (fy - HW) * wscale
	var c: float = COMPACT_F[g] * (0.7 + 0.7 * _def) * (1.2 - 0.4 * _width)
	y += (_by - y) * c
	var left := np.y < 0.5
	var edge := 4.5 if left else W - 4.5
	match g:
		TacShapeMath.Group.DEF, TacShapeMath.Group.WB:
			if TacShapeMath.is_fullback(role) and _att > 0.5:
				var ov := (_att - 0.5) * 2.0
				if absf(_by - y) > 25.0:
					ov *= 0.5
				x += (10.0 if g == TacShapeMath.Group.WB else 8.0) * ov
				y = lerpf(y, edge, 0.35 * ov)
		TacShapeMath.Group.WIDE:
			y = lerpf(y, edge, 0.25 * _att)
		TacShapeMath.Group.FWD:
			x = maxf(x, 46.0 + 8.0 * _att)
			if role == FB.Role.CF:
				x -= 3.0
		TacShapeMath.Group.AM:
			if _att > 0.5:
				x = lerpf(x, _bx + 2.0, 0.5 * (_att - 0.5) * 2.0)
	return Vector2(x, y)


## Second-last opponent x in the attack frame (offside line), at least the halfway line.
func _offside_line() -> float:
	var opp := team.opponent
	if opp == null:
		return L
	var dir := team.attack_dir
	var m1 := -INF
	var m2 := -INF
	for o: Player in opp.players:
		if o.sent_off:
			continue
		var ox := o.pos.x * dir + HL
		if ox > m1:
			m2 = m1
			m1 = ox
		elif ox > m2:
			m2 = ox
	if m2 == -INF:
		return L
	return maxf(m2, HL)


## One pass of pairwise separation among outfield targets.
func _separate(n: int) -> void:
	for i in n:
		if _grp[i] <= 0:
			continue
		for j in range(i + 1, n):
			if _grp[j] <= 0:
				continue
			var a: Vector2 = _tgt[i]
			var b: Vector2 = _tgt[j]
			var d := a.distance_to(b)
			if d >= MIN_SPACING:
				continue
			var push: Vector2
			if d < 0.01:
				push = Vector2(0.0, 1.0)
			else:
				push = (a - b) / d
			var m := (MIN_SPACING - d) * 0.5
			_tgt[i] = a + push * m
			_tgt[j] = b - push * m


# =================================================================================
# Kickoff
# =================================================================================

## Kickoff slot: own half only; only the taker may stand in the centre circle.
func get_kickoff_position(p: Player, kicking_off: bool) -> Vector2:
	var dir := team.attack_dir
	if kicking_off and p == get_kickoff_taker():
		return Vector2(-dir * 0.5, 0.0)
	var positions := team.formation.positions
	var np := positions[clampi(p.slot_index, 0, positions.size() - 1)]
	var a := Vector2(minf(np.x * L * 0.82, 49.5), np.y * W)
	if p.is_goalkeeper():
		a = Vector2(3.0, HW)
	else:
		var centre := Vector2(HL, HW)
		var d := a - centre
		if d.length() < FB.CENTER_CIRCLE_RADIUS + 0.5:
			if d.length() < 0.01:
				d = Vector2(-1.0, 0.0)
			a = centre + d.normalized() * (FB.CENTER_CIRCLE_RADIUS + 0.75)
	a.x = minf(a.x, HL - 0.3)
	return TacShapeMath.from_frame(a, dir)


## Most advanced active outfield slot (ties: best passer).
func get_kickoff_taker() -> Player:
	var best: Player = null
	var best_score := -INF
	var positions := team.formation.positions
	for p: Player in team.players:
		if p.sent_off or p.is_goalkeeper():
			continue
		var s := positions[clampi(p.slot_index, 0, positions.size() - 1)].x * 100.0 + p.data.passing * 0.01
		if s > best_score:
			best_score = s
			best = p
	return best


# =================================================================================
# Taker selection
# =================================================================================

## Picks the restart taker: tactics ids first, else the best-suited active player.
func pick_set_piece_taker(restart: RestartInfo) -> Player:
	var tac := team.tactics
	match restart.type:
		FB.Restart.KICKOFF:
			return get_kickoff_taker()
		FB.Restart.GOAL_KICK:
			var gk := team.goalkeeper()
			if gk != null:
				return gk
			return _best_by(restart, 0)
		FB.Restart.PENALTY:
			var pt := _by_id(tac.penalty_taker_id)
			return pt if pt != null else _best_by(restart, 1)
		FB.Restart.FREE_KICK_DIRECT, FB.Restart.FREE_KICK_INDIRECT:
			var ft := _by_id(tac.free_kick_taker_id)
			return ft if ft != null else _best_by(restart, 2)
		FB.Restart.CORNER:
			var ct := _by_id(tac.corner_taker_id)
			return ct if ct != null else _best_by(restart, 3)
		FB.Restart.THROW_IN:
			return _nearest_outfield(restart.position)
	return _nearest_outfield(restart.position)


func _by_id(id: String) -> Player:
	if id == "":
		return null
	for p: Player in team.players:
		if p.data.id == id and not p.sent_off and not p.is_goalkeeper():
			return p
	return null


func _nearest_outfield(point: Vector2) -> Player:
	var best: Player = null
	var best_d := INF
	for p: Player in team.players:
		if p.sent_off or p.is_goalkeeper():
			continue
		var d := p.pos.distance_squared_to(point)
		if d < best_d:
			best_d = d
			best = p
	if best == null:
		return team.nearest_player_to(point)
	return best


## mode 0 = passing, 1 = penalty, 2 = free kick, 3 = corner.
func _best_by(restart: RestartInfo, mode: int) -> Player:
	var best: Player = null
	var best_s := -INF
	var goal_d := restart.position.distance_to(team.target_goal_center())
	for p: Player in team.players:
		if p.sent_off:
			continue
		var d := p.data
		if p.is_goalkeeper() and mode != 0:
			continue
		var s := 0.0
		match mode:
			1:
				s = d.shooting * 0.7 + d.control * 0.3
			2:
				if goal_d < 35.0 and restart.type == FB.Restart.FREE_KICK_DIRECT:
					s = d.shooting * 0.5 + d.passing * 0.3 + d.vision * 0.2
				else:
					s = d.passing * 0.5 + d.vision * 0.3 + d.shooting * 0.2
			3:
				s = d.passing * 0.6 + d.vision * 0.4
			_:
				s = d.passing * 0.5 + d.vision * 0.3 + d.control * 0.2
		s -= p.pos.distance_to(restart.position) * 0.01
		if s > best_s:
			best_s = s
			best = p
	return best


# =================================================================================
# Set pieces
# =================================================================================

## Where player p should stand for the pending restart.
func get_set_piece_position(p: Player, restart: RestartInfo) -> Vector2:
	if restart == null or p.sent_off:
		return p.home_position
	if restart.type == FB.Restart.KICKOFF:
		return get_kickoff_position(p, restart.team_id == team.team_id)
	var idx := team.players.find(p)
	if idx < 0:
		return p.home_position
	var tick := team.football_match.tick if team.football_match != null else 0
	var tid := restart.taker.get_instance_id() if restart.taker != null else 0
	if not _sp_valid or restart.type != _sp_type or restart.team_id != _sp_team \
			or restart.position != _sp_spot or tid != _sp_taker_id or _sp_n != team.players.size() \
			or restart.direct != _sp_direct or tick < _sp_tick or tick - _sp_tick > 30:
		_sp_type = restart.type
		_sp_team = restart.team_id
		_sp_spot = restart.position
		_sp_taker_id = tid
		_sp_tick = tick
		_sp_n = team.players.size()
		_sp_direct = restart.direct
		_compute_set_piece(restart)
		_sp_valid = true
	return _sp_pos[idx]


func _compute_set_piece(r: RestartInfo) -> void:
	var n := team.players.size()
	_sp_pos.resize(n)
	for i in n:
		_sp_pos[i] = team.players[i].home_position
	var taking := r.team_id == team.team_id
	var taker_i := -1
	if taking:
		taker_i = team.players.find(_taker_for(r))
	match r.type:
		FB.Restart.THROW_IN:
			_sp_throw_in(r, taking, taker_i)
		FB.Restart.CORNER:
			_sp_corner(r, taking, taker_i)
		FB.Restart.GOAL_KICK:
			_sp_goal_kick(r, taking, taker_i)
		FB.Restart.FREE_KICK_DIRECT, FB.Restart.FREE_KICK_INDIRECT:
			_sp_free_kick(r, taking, taker_i)
		FB.Restart.PENALTY:
			_sp_penalty(r, taking, taker_i)
		_:
			pass
	# Defending side keeps the required distance from the ball.
	if not taking and (r.type == FB.Restart.CORNER or r.type == FB.Restart.FREE_KICK_DIRECT \
			or r.type == FB.Restart.FREE_KICK_INDIRECT):
		for i in n:
			_sp_pos[i] = _keep_away(_sp_pos[i], r.position, maxf(r.wall_distance, FB.CENTER_CIRCLE_RADIUS) + 0.35)
	for i in n:
		if team.players[i].sent_off:
			continue
		var margin := 0.3
		if i == taker_i and r.type == FB.Restart.THROW_IN:
			margin = 0.0
		_sp_pos[i] = TacShapeMath.clamp_pitch(_sp_pos[i], margin)


func _taker_for(r: RestartInfo) -> Player:
	if r.taker != null and r.taker.team == team and not r.taker.sent_off:
		return r.taker
	return pick_set_piece_taker(r)


func _put(i: int, w: Vector2) -> void:
	if i >= 0:
		_sp_pos[i] = w


func _keep_away(pos: Vector2, from: Vector2, dist: float) -> Vector2:
	var d := pos - from
	var ln := d.length()
	if ln >= dist:
		return pos
	if ln < 0.01:
		d = team.own_goal_center() - from
		if d.length() < 0.01:
			d = Vector2(-team.attack_dir, 0.0)
		ln = d.length()
	return from + d / ln * dist


func _gk_index() -> int:
	for i in team.players.size():
		var p: Player = team.players[i]
		if p.is_goalkeeper() and not p.sent_off:
			return i
	return -1


## Active outfield (non-GK) indices excluding `exclude`.
func _outfield_indices(exclude: int) -> Array[int]:
	var out: Array[int] = []
	for i in team.players.size():
		var p: Player = team.players[i]
		if p.sent_off or p.is_goalkeeper() or i == exclude:
			continue
		out.append(i)
	return out


func _sort_by_distance(idx: Array[int], point: Vector2) -> void:
	idx.sort_custom(func(a: int, b: int) -> bool:
		return team.players[a].home_position.distance_squared_to(point) \
			< team.players[b].home_position.distance_squared_to(point))


func _sort_by_aerial(idx: Array[int]) -> void:
	idx.sort_custom(func(a: int, b: int) -> bool:
		return _aerial_score(team.players[a]) > _aerial_score(team.players[b]))


func _sort_by_defence(idx: Array[int]) -> void:
	idx.sort_custom(func(a: int, b: int) -> bool:
		return _defence_score(team.players[a]) > _defence_score(team.players[b]))


func _aerial_score(p: Player) -> float:
	var d := p.data
	var s := d.height_cm * 0.4 + d.strength * 0.25 + d.shooting * 0.15 + d.positioning * 0.2
	if TacShapeMath.is_forward(p.role):
		s += 25.0
	elif p.role == FB.Role.CB:
		s += 18.0
	elif p.role == FB.Role.CDM:
		s -= 12.0
	elif TacShapeMath.is_fullback(p.role):
		s -= 22.0
	return s + p.slot_index * 0.001


func _defence_score(p: Player) -> float:
	var d := p.data
	var s := d.tackling * 0.3 + d.strength * 0.2 + d.height_cm * 0.3 + d.positioning * 0.2
	if p.role == FB.Role.CB:
		s += 10.0
	return s + p.slot_index * 0.001


## Opponent outfield players sorted by distance to `point`, excluding `exclude`.
func _opp_sorted(point: Vector2, exclude: Player) -> Array[Player]:
	var out: Array[Player] = []
	var opp := team.opponent
	if opp == null:
		return out
	for o: Player in opp.players:
		if o.sent_off or o.is_goalkeeper() or o == exclude:
			continue
		out.append(o)
	out.sort_custom(func(a: Player, b: Player) -> bool:
		return a.pos.distance_squared_to(point) < b.pos.distance_squared_to(point))
	return out


func _mark_pos(opp_p: Player, goal: Vector2) -> Vector2:
	var d := goal - opp_p.pos
	if d.length() < 0.01:
		return opp_p.pos
	return opp_p.pos + d.normalized() * 1.2


func _end_dir(r: RestartInfo) -> float:
	return -1.0 if r.position.x < 0.0 else 1.0


func _side(r: RestartInfo) -> float:
	return -1.0 if r.position.y < 0.0 else 1.0


## Restart-end coordinates -> world. depth from goal line, lat from goal centre toward the spot side.
func _end(depth: float, lat: float, eg: float, ns: float) -> Vector2:
	return Vector2(eg * (HL - depth), ns * lat)


# --- Throw-in ----------------------------------------------------------------
func _sp_throw_in(r: RestartInfo, taking: bool, taker_i: int) -> void:
	var dir := team.attack_dir
	var spot := r.position
	var a := TacShapeMath.to_frame(spot, dir)
	var s := 1.0 if a.y < HW else -1.0
	var cand := _outfield_indices(taker_i)
	_sort_by_distance(cand, spot)
	if taking:
		_put(taker_i, spot)
		for k in mini(cand.size(), THROW_OPTS.size()):
			var o: Vector2 = THROW_OPTS[k]
			_put(cand[k], TacShapeMath.from_frame(Vector2(a.x + o.x, a.y + s * o.y), dir))
	else:
		var opp_list := _opp_sorted(spot, r.taker)
		for k in cand.size():
			if k == 0:
				_put(cand[0], TacShapeMath.from_frame(Vector2(a.x - 1.5, a.y + s * 2.2), dir))
			elif k - 1 < opp_list.size() and k <= 5:
				_put(cand[k], _mark_pos(opp_list[k - 1], team.own_goal_center()))
		# Defenders keep 2 m from the thrower in any case.
		for i in team.players.size():
			if not team.players[i].sent_off:
				_sp_pos[i] = _keep_away(_sp_pos[i], spot, 2.5)


# --- Corner ------------------------------------------------------------------
func _sp_corner(r: RestartInfo, taking: bool, taker_i: int) -> void:
	var eg := _end_dir(r)
	var ns := _side(r)
	var corner := r.position
	if taking:
		var inward := (Vector2.ZERO - corner).normalized()
		_put(taker_i, corner + inward * 0.7)
		var cand := _outfield_indices(taker_i)
		var routine := team.tactics.corner_routine
		if routine == "short" and not cand.is_empty():
			_sort_by_distance(cand, corner)
			var short_i: int = cand[0]
			cand.remove_at(0)
			_put(short_i, _end(2.0, 28.5, eg, ns))
		_sort_by_aerial(cand)
		var slots := CORNER_FAR
		if routine == "near_post":
			slots = CORNER_NEAR
		elif routine == "short":
			slots = CORNER_SHORT
		var e := cand.size()
		var rest_n := mini(3, e)
		var remaining := e - rest_n
		var box_n := mini(slots.size(), remaining)
		var edge_n := mini(1, remaining - box_n)
		for k in e:
			var idx: int = cand[k]
			if k < box_n:
				var s: Vector2 = slots[k]
				_put(idx, _end(s.x, s.y, eg, ns))
			elif k < box_n + edge_n:
				_put(idx, _end(17.5, -7.0, eg, ns))
			else:
				var rs: Vector2 = CORNER_REST[(k - box_n - edge_n) % CORNER_REST.size()]
				_put(idx, _end(rs.x, rs.y, eg, ns))
	else:
		var gk_i := _gk_index()
		_put(gk_i, _end(0.8, 0.8, eg, ns))
		var cand := _outfield_indices(-1)
		# Up to two forwards stay up for the counter.
		var fwd_n := 0
		var rest: Array[int] = []
		for i in cand:
			if TacShapeMath.is_forward(team.players[i].role) and fwd_n < 2:
				_put(i, _end(54.0, 8.0 if fwd_n == 0 else -8.0, eg, ns))
				fwd_n += 1
			else:
				rest.append(i)
		_sort_by_defence(rest)
		var goal_c := Vector2(eg * HL, 0.0)
		var attackers := _opp_sorted(goal_c, r.taker)
		var spot_w := _end(11.0, 0.0, eg, ns)
		for k in rest.size():
			var idx: int = rest[k]
			match k:
				0:
					_put(idx, _end(1.0, 3.2, eg, ns))
				1:
					_put(idx, _end(1.0, -3.2, eg, ns))
				2:
					_put(idx, _end(5.0, 1.8, eg, ns))
				3:
					_put(idx, corner + (spot_w - corner).normalized() * 9.7)
				_:
					if k - 4 < attackers.size():
						_put(idx, _mark_pos(attackers[k - 4], goal_c))
					else:
						_put(idx, _end(12.0, 6.0 if k % 2 == 0 else -6.0, eg, ns))


# --- Goal kick ---------------------------------------------------------------
func _sp_goal_kick(r: RestartInfo, taking: bool, taker_i: int) -> void:
	var dir := team.attack_dir
	var eg := _end_dir(r)
	if taking:
		_put(taker_i, r.position + Vector2(eg * 0.9, 0.0))
		var positions := team.formation.positions
		for i in _outfield_indices(taker_i):
			var p: Player = team.players[i]
			var np := positions[clampi(p.slot_index, 0, positions.size() - 1)]
			var g := TacShapeMath.group_of(p.role)
			var sx := 1.8 if p.role == FB.Role.CB else 1.2
			var fx := clampf(np.x * L + 8.0, 21.0, 72.0)
			var fy := clampf(HW + (np.y * W - HW) * sx, 5.0, W - 5.0)
			if g == TacShapeMath.Group.FWD:
				fx = clampf(np.x * L + 4.0, 50.0, 72.0)
			_put(i, TacShapeMath.from_frame(Vector2(fx, fy), dir))
	else:
		# Opponents press from outside the penalty area.
		var positions := team.formation.positions
		for i in _outfield_indices(-1):
			var p: Player = team.players[i]
			var np := positions[clampi(p.slot_index, 0, positions.size() - 1)]
			var fx := np.x * L * 0.55 + 42.0 + (team.tactics.pressing - 0.5) * 10.0
			fx = minf(fx, L - FB.PENALTY_AREA_DEPTH - 1.5)
			var fy := clampf(HW + (np.y * W - HW) * 1.1, 4.0, W - 4.0)
			var w := TacShapeMath.from_frame(Vector2(fx, fy), dir)
			_put(i, w)
		# Own goal-kick end is the opponent's attacking... make sure nobody is in that box.
		for i in team.players.size():
			if team.players[i].sent_off or team.players[i].is_goalkeeper():
				continue
			var w2: Vector2 = _sp_pos[i]
			var depth := HL - absf(w2.x)
			if absf(w2.x) > 0.0 and signf(w2.x) == eg and depth < FB.PENALTY_AREA_DEPTH + 1.0 \
					and absf(w2.y) < FB.PENALTY_AREA_WIDTH * 0.5 + 1.0:
				w2.x = eg * (HL - FB.PENALTY_AREA_DEPTH - 1.0)
				_sp_pos[i] = w2


# --- Free kick ---------------------------------------------------------------
func _sp_free_kick(r: RestartInfo, taking: bool, taker_i: int) -> void:
	var dir := team.attack_dir
	var spot := r.position
	var goal := team.target_goal_center() if taking else team.own_goal_center()
	var eg := 1.0 if goal.x > 0.0 else -1.0
	var ns := _side(r)
	var to_goal := goal - spot
	var gd := to_goal.length()
	var gdir := to_goal / maxf(gd, 0.01)
	if taking:
		_put(taker_i, spot - gdir * 1.3)
		var cand := _outfield_indices(taker_i)
		var short_opts := gd >= 28.0 or team.tactics.free_kick_routine == "short"
		var perp := Vector2(-gdir.y, gdir.x)
		if short_opts:
			_sort_by_distance(cand, spot)
			for k in mini(2, cand.size()):
				_put(cand[0], spot + perp * (7.0 if k == 0 else -7.0) - gdir * 2.0)
				cand.remove_at(0)
		_sort_by_aerial(cand)
		var e := cand.size()
		var box_n := 0
		if gd < 40.0:
			box_n = mini(FK_BOX.size(), maxi(0, e - 3))
		var ball_x := TacShapeMath.to_frame(spot, dir).x
		var lim := maxf(_offside_line() - 0.6, ball_x)
		for k in e:
			var idx: int = cand[k]
			var w: Vector2
			if k < box_n:
				var s: Vector2 = FK_BOX[k]
				w = _end(s.x, s.y, eg, ns)
			else:
				w = team.players[idx].home_position + gdir * 5.0
			var a := TacShapeMath.to_frame(w, dir)
			a.x = minf(a.x, lim)
			_put(idx, TacShapeMath.from_frame(a, dir))
	else:
		var wn := 0
		if gd >= r.wall_distance + 1.0:
			if gd <= 18.0:
				wn = 5
			elif gd <= 24.0:
				wn = 4
			elif gd <= 30.0:
				wn = 3
			elif gd <= 38.0:
				wn = 2
		# Wall centred on the line from the ball to the near post.
		var near_post := goal
		if absf(spot.y) > 2.0:
			near_post = Vector2(goal.x, signf(spot.y) * (FB.GOAL_WIDTH * 0.5 - 0.3))
		var wdir := (near_post - spot).normalized()
		var wc := spot + wdir * (r.wall_distance + 0.45)
		# Spots close to the goal line: rotate the wall around the ball until it fits in the pitch.
		var wperp := Vector2(-wdir.y, wdir.x)
		if wn > 0 and not _wall_fits(wc, wperp):
			for deg in range(10, 181, 10):
				var fitted := false
				for sgn in [1.0, -1.0]:
					var cand_dir := wdir.rotated(deg_to_rad(deg) * sgn)
					var cand_c := spot + cand_dir * (r.wall_distance + 0.45)
					var cand_perp := Vector2(-cand_dir.y, cand_dir.x)
					if _wall_fits(cand_c, cand_perp):
						wdir = cand_dir
						wc = cand_c
						wperp = cand_perp
						fitted = true
						break
				if fitted:
					break
		var gk_i := _gk_index()
		if gk_i >= 0:
			if gd < 40.0:
				var gy := -signf(spot.y) * 1.3 if absf(spot.y) > 2.0 else 0.0
				_put(gk_i, Vector2(goal.x - eg * 0.8, gy))
		var cand := _outfield_indices(-1)
		var pool: Array[int] = []
		for i in cand:
			if TacShapeMath.is_forward(team.players[i].role):
				continue
			pool.append(i)
		_sort_by_distance(pool, wc)
		var wall_set := {}
		for k in mini(wn, pool.size()):
			_put(pool[k], wc + wperp * (WALL_OFFSETS[k] * 0.85))
			wall_set[pool[k]] = true
		var rest: Array[int] = []
		for i in pool:
			if not wall_set.has(i):
				rest.append(i)
		_sort_by_distance(rest, goal)
		var attackers := _opp_sorted(goal, r.taker)
		for k in rest.size():
			if gd < 45.0 and k < attackers.size():
				_put(rest[k], _mark_pos(attackers[k], goal))


func _wall_fits(centre: Vector2, perp: Vector2) -> bool:
	for k in WALL_OFFSETS.size():
		var w: Vector2 = centre + perp * (WALL_OFFSETS[k] * 0.85)
		if absf(w.x) > HL - 0.5 or absf(w.y) > HW - 0.5:
			return false
	return true


# --- Penalty -----------------------------------------------------------------
func _sp_penalty(r: RestartInfo, taking: bool, taker_i: int) -> void:
	var spot := r.position
	var eg := _end_dir(r)
	var n := team.players.size()
	var gk_i := _gk_index()
	if taking:
		_put(taker_i, spot - Vector2(eg * 1.0, 0.0))
	else:
		if gk_i >= 0:
			_put(gk_i, Vector2(eg * (HL - 0.4), 0.0))
	for i in n:
		var p: Player = team.players[i]
		if p.sent_off or i == taker_i or (not taking and i == gk_i):
			continue
		_sp_pos[i] = _penalty_legal(_sp_pos[i], spot, eg)
	# Spread so nobody stacks, then re-legalise.
	for _it in 2:
		for i in n:
			if team.players[i].sent_off or i == taker_i or i == gk_i:
				continue
			for j in range(i + 1, n):
				if team.players[j].sent_off or j == taker_i or j == gk_i:
					continue
				var d: Vector2 = _sp_pos[i] - _sp_pos[j]
				var ln := d.length()
				if ln < 2.5:
					var push := Vector2(0.0, 1.0) if ln < 0.01 else d / ln
					var m := (2.5 - ln) * 0.5
					_sp_pos[i] = _penalty_legal(_sp_pos[i] + push * m, spot, eg)
					_sp_pos[j] = _penalty_legal(_sp_pos[j] - push * m, spot, eg)


## Outside the penalty area, behind the spot, and at least 9.15 m from it.
func _penalty_legal(w: Vector2, spot: Vector2, eg: float) -> Vector2:
	var u := (spot.x - w.x) * eg
	u = maxf(u, FB.PENALTY_AREA_DEPTH - FB.PENALTY_SPOT_DIST + 0.6)
	var dy := w.y - spot.y
	var ln := sqrt(u * u + dy * dy)
	var need := FB.PENALTY_ARC_RADIUS + 0.75
	if ln < need:
		var k := need / maxf(ln, 0.01)
		u *= k
		dy *= k
	return Vector2(spot.x - eg * u, spot.y + dy)
