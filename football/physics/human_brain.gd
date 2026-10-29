extends PlayerBrain
## Human brain (PHYSICS module): turns the abstract InputController into PlayerIntent.
## Reads ONLY player.team.input. Aim assist (passes / through balls / lobs / shots), charge-based
## shooting, tap vs hold long passes, tackles, switching, goalkeeper actions and a short input
## buffer so a button pressed just before the ball arrives still fires.
##
## During SET_PIECE context this brain writes nothing: the rules module owns set-piece kicks.

const PM = preload("res://physics/phys_math.gd")

enum Kind { PASS, THROUGH, LOB, GK_THROW }

## Seconds an early button press is remembered while waiting for the ball.
const PEND_WINDOW := 0.25
## A LONG_PASS shorter than this is a through ball; longer is a lofted pass.
const TAP_TIME := 0.25
## Shoot charge (seconds) that gives full power.
const SHOOT_FULL := 1.0
const FREE_BALL_NEAR_SQ := 1.8 * 1.8

var _highlight: Player = null
var _pend: int = FB.IntentAction.NONE
var _pend_age := 0.0
var _pend_hold := 0.0
var _switch_cd := 0.0
var _press_on := false
## Scratch outputs of _select_target (no allocations).
var _sel_point := Vector2.ZERO
var _sel_dist := 0.0


func on_activated() -> void:
	_pend = FB.IntentAction.NONE
	_pend_age = 0.0
	_switch_cd = 0.4
	_set_press(false)
	_set_highlight(null)


## ~10 Hz: pass-target highlight and (simple scheme) automatic switching while defending.
func think(_dt: float) -> void:
	var p := player
	var input := p.team.input
	if input == null:
		return
	var ctx := input.context
	if ctx == FB.Context.HAS_BALL and p.has_ball():
		_set_highlight(_select_target(_aim_dir(input.get_move_vector()), Kind.PASS))
	else:
		_set_highlight(null)
	if ctx == FB.Context.DEFENDING and input.scheme == FB.ControlScheme.SIMPLE and _switch_cd <= 0.0:
		var bpos := p.football_match.ball.pos
		var nearest := p.team.nearest_player_to(bpos, true)
		if nearest != null and nearest != p and nearest.pos.distance_to(bpos) + 3.0 < p.pos.distance_to(bpos):
			_switch_cd = 1.0
			p.team.set_controlled_player(nearest)


## Every tick: read input, write intent.
func act(delta: float) -> void:
	var p := player
	var input := p.team.input
	if input == null:
		return
	var ctx := input.context
	if ctx == FB.Context.SET_PIECE:
		_set_highlight(null)
		return
	_switch_cd = maxf(_switch_cd - delta, 0.0)
	var it := p.intent
	var mv := input.get_move_vector()
	it.move = mv
	it.sprint = input.is_held(FB.Action.SPRINT)
	it.look = Vector2.ZERO
	if input.consume_press(FB.Action.SWITCH_PLAYER):
		_do_switch()
		return
	match ctx:
		FB.Context.HAS_BALL:
			_set_press(false)
			_act_attack(delta, it, input, mv)
		FB.Context.GOALKEEPER:
			_set_press(false)
			_act_keeper(it, input, mv)
		_:
			_act_defend(it, input, mv)


# --- Attacking ------------------------------------------------------------------------------
func _act_attack(delta: float, it: PlayerIntent, input: InputController, mv: Vector2) -> void:
	var p := player
	var ball := p.football_match.ball
	if input.consume_press(FB.Action.PASS):
		_queue(FB.IntentAction.PASS, 0.0)
	var held := input.consume_release(FB.Action.LONG_PASS)
	if held >= 0.0:
		_queue(FB.IntentAction.THROUGH_PASS if held < TAP_TIME else FB.IntentAction.LOB_PASS, held)
	var shot_held := input.consume_release(FB.Action.SHOOT)
	if shot_held >= 0.0:
		_queue(FB.IntentAction.SHOOT, shot_held)
	if input.consume_press(FB.Action.SKILL) and p.has_ball():
		var d := _aim_dir(mv)
		it.set_action(FB.IntentAction.SKILL, p.pos + d * 3.0, 0.5)
	if _pend != FB.IntentAction.NONE:
		_pend_age += delta
		var has := ball.owner_player == p
		var free_near := ball.owner_player == null and not ball.frozen \
			and p.pos.distance_squared_to(ball.pos) < FREE_BALL_NEAR_SQ
		if has or free_near:
			_fire_pending(it, input, mv)
		elif _pend_age > PEND_WINDOW:
			_pend = FB.IntentAction.NONE


func _queue(kind: int, hold: float) -> void:
	_pend = kind
	_pend_age = 0.0
	_pend_hold = hold


func _fire_pending(it: PlayerIntent, input: InputController, mv: Vector2) -> void:
	var kind := _pend
	_pend = FB.IntentAction.NONE
	match kind:
		FB.IntentAction.PASS:
			_fire_pass(it, input, mv, Kind.PASS, 0.0)
		FB.IntentAction.THROUGH_PASS:
			_fire_pass(it, input, mv, Kind.THROUGH, _pend_hold)
		FB.IntentAction.LOB_PASS:
			_fire_pass(it, input, mv, Kind.LOB, _pend_hold)
		FB.IntentAction.SHOOT:
			_fire_shot(it, input, mv, _pend_hold)


func _fire_pass(it: PlayerIntent, input: InputController, mv: Vector2, kind: int, hold: float) -> void:
	var p := player
	var dir := _aim_dir(mv)
	var t := _select_target(dir, kind)
	var action := FB.IntentAction.PASS
	var power := 0.5
	var tp: Vector2
	if kind == Kind.THROUGH:
		action = FB.IntentAction.THROUGH_PASS
	elif kind == Kind.LOB:
		action = FB.IntentAction.LOB_PASS
		it.loft = 0.5
		power = 0.5 + 0.15 * clampf((hold - TAP_TIME) / 0.75, 0.0, 1.0)
	if t != null:
		var assist := _assist()
		var to_pt := _sel_point - p.pos
		var aimed := dir.slerp(to_pt.normalized(), 0.4 + 0.6 * assist)
		tp = p.pos + aimed * _sel_dist
		if kind == Kind.LOB and _is_cross_situation(t):
			action = FB.IntentAction.CROSS
			it.loft = 0.45
	else:
		var reach := 12.0
		if kind == Kind.THROUGH:
			reach = 20.0
		elif kind == Kind.LOB:
			reach = lerpf(16.0, 46.0, clampf((hold - TAP_TIME) / 0.75, 0.0, 1.0))
		tp = p.pos + dir * reach
	var loft := it.loft
	it.set_action(action, tp, power, t)
	it.loft = loft
	it.curve = input.get_curve_input()


func _is_cross_situation(t: Player) -> bool:
	var p := player
	var ad := float(p.team.attack_dir)
	return absf(p.pos.y) > 17.0 and p.pos.x * ad > 28.0 and t.pos.x * ad > 36.0 and absf(t.pos.y) < 18.0


func _fire_shot(it: PlayerIntent, input: InputController, mv: Vector2, hold: float) -> void:
	var p := player
	var team := p.team
	var goal := team.target_goal_center()
	var to_goal := goal - p.pos
	var gdist := to_goal.length()
	var gdir := to_goal / maxf(gdist, 0.01)
	var dir := _aim_dir(mv)
	var assist := _assist()
	var snap := deg_to_rad(lerpf(22.0, 70.0, assist))
	var ang := absf(dir.angle_to(gdir))
	var final_dir := dir
	if ang < snap and gdist < 48.0:
		# Aim at the corner away from the keeper.
		var gk := team.opponent.goalkeeper() if team.opponent != null else null
		var side := 1.0
		if gk != null and absf(gk.pos.y) > 0.4:
			side = -signf(gk.pos.y)
		elif absf(mv.y) > 0.2:
			side = signf(mv.y)
		elif absf(p.pos.y) > 0.5:
			side = -signf(p.pos.y)
		var corner := Vector2(goal.x, side * (FB.GOAL_WIDTH * 0.5 - 0.95))
		var cdir := (corner - p.pos).normalized()
		var w := assist * (1.0 - 0.4 * ang / snap)
		final_dir = dir.slerp(cdir, w)
	var power := maxf(clampf(hold / SHOOT_FULL, 0.0, 1.0), 0.25)
	it.set_action(FB.IntentAction.SHOOT, p.pos + final_dir * 30.0, power)
	it.loft = clampf((gdist - 20.0) / 60.0, 0.0, 0.25)
	it.curve = input.get_curve_input()


# --- Defending ----------------------------------------------------------------------------------
func _act_defend(it: PlayerIntent, input: InputController, mv: Vector2) -> void:
	var p := player
	var ball := p.football_match.ball
	var carrier := ball.owner_player
	if carrier != null and carrier.team == p.team:
		carrier = null
	if input.consume_press(FB.Action.TACKLE):
		var victim := carrier if carrier != null and carrier.pos.distance_squared_to(p.pos) < 16.0 else null
		var tp := victim.pos if victim != null else p.pos + p.facing * 1.2
		it.set_action(FB.IntentAction.TACKLE, tp, 0.5, victim)
	if input.consume_press(FB.Action.SLIDE):
		var d := p.facing
		if mv.length_squared() > 0.09:
			d = mv.normalized()
		elif carrier != null:
			d = (carrier.pos - p.pos).normalized()
		it.set_action(FB.IntentAction.SLIDE, p.pos + d * 4.0, 0.5, null)
	var press := input.is_held(FB.Action.PRESS)
	_set_press(press)
	if press and carrier != null:
		# Assisted chase: close down the carrier unless the stick says otherwise.
		var chase := carrier.pos + carrier.vel * 0.3 - p.pos
		if chase.length_squared() > 1.0:
			if mv.length_squared() < 0.04:
				it.move = chase.normalized()
			it.sprint = true


func _set_press(on: bool) -> void:
	if on == _press_on:
		return
	_press_on = on
	var tb := player.team.team_brain
	if tb != null and tb.has_method("set_press_requested"):
		tb.call("set_press_requested", on)


func _do_switch() -> void:
	var p := player
	var tb := p.team.team_brain
	var target: Player = null
	if tb != null:
		target = tb.suggest_switch_target()
	if target == null or target == p:
		target = p.team.nearest_player_to(p.football_match.ball.pos, true, p)
	if target != null and target != p:
		_switch_cd = 0.5
		p.team.set_controlled_player(target)


# --- Goalkeeper ---------------------------------------------------------------------------------
func _act_keeper(it: PlayerIntent, input: InputController, mv: Vector2) -> void:
	var p := player
	var ball := p.football_match.ball
	var holding := p.state == FB.PlayerState.HOLDING_BALL
	var has := p.has_ball()
	var fwd := Vector2(float(p.team.attack_dir), 0.0)
	if input.consume_press(FB.Action.GK_DISTRIBUTE) and has:
		var dir := mv.normalized() if mv.length_squared() > 0.09 else fwd
		var t := _select_target(dir, Kind.GK_THROW)
		var tp := p.pos + dir * 18.0
		if t != null:
			tp = p.pos + dir.slerp((_sel_point - p.pos).normalized(), 0.4 + 0.6 * _assist()) * _sel_dist
		it.set_action(FB.IntentAction.GK_THROW if holding else FB.IntentAction.PASS, tp, 0.5, t)
		it.curve = 0.0
	var kick_held := input.consume_release(FB.Action.GK_KICK)
	if kick_held >= 0.0 and has:
		var dir2 := mv.normalized() if mv.length_squared() > 0.09 else fwd
		var t2 := _select_target(dir2, Kind.LOB)
		var tp2 := p.pos + dir2 * 40.0
		if t2 != null:
			tp2 = p.pos + dir2.slerp((_sel_point - p.pos).normalized(), 0.3 + 0.5 * _assist()) * _sel_dist
		it.set_action(FB.IntentAction.GK_KICK, tp2, 0.55 + 0.45 * clampf(kick_held / 0.9, 0.0, 1.0), t2)
		it.loft = 0.7
	if input.consume_press(FB.Action.GK_DIVE):
		var d := Vector2.ZERO
		if mv.length_squared() > 0.09:
			d = mv.normalized()
		else:
			d = (ball.pos - p.pos).normalized()
		it.set_action(FB.IntentAction.GK_DIVE, p.pos + d * 4.0, 1.0)
	if input.is_held(FB.Action.GK_COME_OUT) and not has:
		var to_ball := ball.pos + ball.vel * 0.25 - p.pos
		if to_ball.length_squared() > 0.25:
			it.move = to_ball.normalized()
			it.sprint = true


# --- Aim assist ---------------------------------------------------------------------------------------
## Effective assist 0..1 (simple scheme is always stronger).
func _assist() -> float:
	var a := clampf(GameSettings.aim_assist, 0.0, 1.0)
	var input := player.team.input
	if input != null and input.scheme == FB.ControlScheme.SIMPLE:
		a = a * 0.5 + 0.5
	return a


func _aim_dir(mv: Vector2) -> Vector2:
	if mv.length_squared() > 0.09:
		return mv.normalized()
	return player.facing


## Best teammate in a cone around dir. Fills _sel_point (lead-adjusted target) and _sel_dist.
func _select_target(dir: Vector2, kind: int) -> Player:
	var p := player
	var team := p.team
	var opp := team.opponent
	var assist := _assist()
	var cone := deg_to_rad(lerpf(16.0, 52.0, assist))
	var pref := 14.0
	var maxr := 42.0
	match kind:
		Kind.THROUGH:
			pref = 20.0
			maxr = 46.0
		Kind.LOB:
			pref = 30.0
			maxr = 62.0
		Kind.GK_THROW:
			pref = 24.0
			maxr = 60.0
			cone = maxf(cone, deg_to_rad(40.0))
	var ad := float(team.attack_dir)
	var best: Player = null
	var best_s := -INF
	for t: Player in team.players:
		if t == p or t.sent_off:
			continue
		var d := t.pos - p.pos
		var dist := d.length()
		if dist < 4.0 or dist > maxr:
			continue
		var ang := absf(dir.angle_to(d))
		if ang > cone:
			continue
		if kind == Kind.THROUGH and (t.pos.x - p.pos.x) * ad < 2.0:
			continue
		var s := (1.0 - ang / cone) * 0.55
		s += 0.15 * clampf(1.0 - absf(dist - pref) / 30.0, 0.0, 1.0)
		s += 0.3 * _lane_open(p.pos, t.pos, opp)
		if t.is_goalkeeper():
			s -= 0.2
		if s > best_s:
			best_s = s
			best = t
	if best != null:
		match kind:
			Kind.THROUGH:
				_sel_point = best.pos + best.vel * 0.9 + Vector2(ad * 2.5, 0.0)
			Kind.LOB:
				_sel_point = best.pos + best.vel * 1.3
			_:
				_sel_point = best.pos + best.vel * 0.45
		_sel_point.x = clampf(_sel_point.x, -FB.HALF_LENGTH, FB.HALF_LENGTH)
		_sel_point.y = clampf(_sel_point.y, -FB.HALF_WIDTH, FB.HALF_WIDTH)
		_sel_dist = p.pos.distance_to(_sel_point)
	return best


## 0..1: how free the passing lane is of opponents.
func _lane_open(a: Vector2, b: Vector2, opp: Team) -> float:
	if opp == null:
		return 1.0
	var best := 3.0
	for o: Player in opp.players:
		if o.sent_off:
			continue
		var d := PM.dist_point_segment(o.pos, a, b)
		if d < best:
			best = d
	return best / 3.0


func _set_highlight(t: Player) -> void:
	if t == _highlight:
		return
	_highlight = t
	EventBus.pass_target_highlighted.emit(t)
