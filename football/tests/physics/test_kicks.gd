extends "res://tests/physics/phys_scenario.gd"
## Kicks: power, accuracy, curve, loft, signals.

var _kicked_count := 0
var _shots := 0
var _last_on_target := false


func _on_kicked(_p: Player, _k: int, _pw: float) -> void:
	_kicked_count += 1


func _on_shot(_p: Player, on_target: bool) -> void:
	_shots += 1
	_last_on_target = on_target


func _kicker(m: FootballMatch) -> Player:
	var p := outfield(m, 0, 3)
	p.teleport(Vector2(20.0, 0.0), Vector2.RIGHT)
	return p


func _fire(m: FootballMatch, p: Player, action: int, target: Vector2, power: float, loft: float = 0.0, curve: float = 0.0) -> void:
	m.ball.set_carrier(p)
	m.ball.pos = p.pos + p.facing * 0.7
	m.ball.vel = Vector2.ZERO
	m.ball.height = 0.0
	m.ball.vz = 0.0
	p.touch_cooldown = 0.0
	p.state = FB.PlayerState.NORMAL
	p.vel = Vector2.ZERO
	p.stamina = 1.0
	p.intent.set_action(action, target, power)
	p.intent.loft = loft
	p.intent.curve = curve
	p.motor.step(FB.TICK_DT)


func test_shot_power_scales_with_charge_and_caps_near_30() -> void:
	var m := make_scene(21)
	var p := _kicker(m)
	set_stats(p, {"shooting": 90})
	var goal := Vector2(FB.HALF_LENGTH, 0.0)
	var prev := 0.0
	for pw: float in [0.25, 0.5, 0.75, 1.0]:
		var total := 0.0
		for i in 12:
			_fire(m, p, FB.IntentAction.SHOOT, goal, pw)
			total += Vector2(m.ball.vel.x, m.ball.vel.y).length()
		var avg := total / 12.0
		assert_true(avg > prev + 1.5, "power %f -> speed %f (prev %f)" % [pw, avg, prev])
		prev = avg
	assert_true(prev > 26.0 and prev <= 30.6, "full-power shot speed %f" % prev)


func test_shot_clears_possession_and_registers_touch() -> void:
	var m := make_scene(22)
	var p := _kicker(m)
	_fire(m, p, FB.IntentAction.SHOOT, Vector2(FB.HALF_LENGTH, 0.0), 0.8)
	assert_true(m.ball.owner_player == null, "ball released")
	assert_true(m.ball.last_touch_player == p, "touch registered")
	assert_true(p.touch_cooldown > 0.2, "kicker cannot immediately retake it")
	assert_eq(p.intent.action, FB.IntentAction.NONE, "action consumed")


func test_signals_ball_kicked_and_shot_taken() -> void:
	var m := make_scene(23)
	var p := _kicker(m)
	_kicked_count = 0
	_shots = 0
	EventBus.ball_kicked.connect(_on_kicked)
	EventBus.shot_taken.connect(_on_shot)
	set_stats(p, {"shooting": 99})
	_fire(m, p, FB.IntentAction.SHOOT, Vector2(FB.HALF_LENGTH, 0.0), 0.7)
	assert_eq(_kicked_count, 1, "ball_kicked")
	assert_eq(_shots, 1, "shot_taken")
	assert_true(_last_on_target, "centre shot is on target")
	_fire(m, p, FB.IntentAction.SHOOT, Vector2(20.0, 30.0), 0.7)
	assert_false(_last_on_target, "sideways shot is not on target")
	_fire(m, p, FB.IntentAction.PASS, Vector2(30.0, 0.0), 0.5)
	assert_eq(_shots, 2, "passes are not shots")
	EventBus.ball_kicked.disconnect(_on_kicked)
	EventBus.shot_taken.disconnect(_on_shot)


func test_no_kick_without_ball() -> void:
	var m := make_scene(24)
	var p := _kicker(m)
	m.ball.pos = Vector2(5.0, 0.0)
	m.ball.vel = Vector2.ZERO
	p.intent.set_action(FB.IntentAction.PASS, Vector2(30.0, 0.0), 0.5)
	p.motor.step(FB.TICK_DT)
	assert_eq(m.ball.vel, Vector2.ZERO, "ball far away is untouched")
	assert_eq(p.intent.action, FB.IntentAction.NONE, "rejected action cleared")


func test_first_time_kick_of_loose_ball_in_reach() -> void:
	var m := make_scene(25)
	var p := _kicker(m)
	m.ball.pos = p.pos + Vector2(0.7, 0.0)
	m.ball.vel = Vector2(-4.0, 0.0)
	p.intent.set_action(FB.IntentAction.PASS, Vector2(40.0, 0.0), 0.5)
	p.motor.step(FB.TICK_DT)
	assert_true(m.ball.vel.x > 5.0, "one-touch pass sends the ball away (%f)" % m.ball.vel.x)


func test_pass_weight_reaches_target() -> void:
	var m := make_scene(26)
	var p := _kicker(m)
	set_stats(p, {"passing": 99})
	for dist: float in [8.0, 18.0, 30.0]:
		_fire(m, p, FB.IntentAction.PASS, p.pos + Vector2(dist, 0.0), 0.5)
		var start := m.ball.pos
		var arrive_speed := -1.0
		for i in 400:
			m.ball.physics_step(FB.TICK_DT)
			if m.ball.pos.distance_to(start) >= dist:
				arrive_speed = m.ball.vel.length()
				break
		assert_true(arrive_speed > 1.5 and arrive_speed < 8.0, "dist %f arrives at %f m/s" % [dist, arrive_speed])
		m.ball.vel = Vector2.ZERO


func test_stronger_pass_arrives_faster() -> void:
	var m := make_scene(27)
	var p := _kicker(m)
	set_stats(p, {"passing": 99})
	var speeds: Array[float] = []
	for pw: float in [0.2, 0.5, 0.9]:
		_fire(m, p, FB.IntentAction.PASS, p.pos + Vector2(20.0, 0.0), pw)
		speeds.append(m.ball.vel.length())
	assert_true(speeds[0] < speeds[1] and speeds[1] < speeds[2], "weights ordered %s" % str(speeds))


func test_lob_pass_lands_near_target() -> void:
	var m := make_scene(28)
	var p := _kicker(m)
	set_stats(p, {"passing": 99})
	for dist: float in [20.0, 35.0, 50.0]:
		_fire(m, p, FB.IntentAction.LOB_PASS, p.pos + Vector2(dist, 0.0), 0.5, 0.5)
		assert_true(m.ball.vz > 3.0, "lofted")
		var landed := Vector2.ZERO
		for i in 400:
			m.ball.physics_step(FB.TICK_DT)
			if m.ball.height <= 0.0 and m.ball.vz > 0.0 or (m.ball.height <= 0.0 and i > 5):
				landed = m.ball.pos
				break
		var err := absf((landed.x - p.pos.x) - dist) / dist
		assert_true(err < 0.2, "lob %f landed %f from kicker (err %f)" % [dist, landed.x - p.pos.x, err])


func test_cross_is_lofted() -> void:
	var m := make_scene(29)
	var p := _kicker(m)
	_fire(m, p, FB.IntentAction.CROSS, p.pos + Vector2(25.0, 10.0), 0.5)
	assert_true(m.ball.vz > 2.0, "cross has height")


func test_clear_goes_long_and_high() -> void:
	var m := make_scene(30)
	var p := _kicker(m)
	_fire(m, p, FB.IntentAction.CLEAR, p.pos + Vector2(40.0, 0.0), 1.0)
	assert_true(m.ball.vel.length() > 15.0 and m.ball.vz > 5.0, "clearance")


func test_curve_sign_and_effect() -> void:
	var m := make_scene(31)
	var p := _kicker(m)
	set_stats(p, {"shooting": 99})
	_fire(m, p, FB.IntentAction.SHOOT, p.pos + Vector2(30.0, 0.0), 0.9, 0.05, 1.0)
	assert_true(m.ball.spin > 20.0, "positive curve = positive spin (%f)" % m.ball.spin)
	var heading0 := m.ball.vel.angle()
	for i in 45:
		m.ball.physics_step(FB.TICK_DT)
	var drift := angle_difference(heading0, m.ball.vel.angle())
	assert_true(drift < -0.05, "positive curve bends left of travel (heading change %f)" % drift)
	_fire(m, p, FB.IntentAction.SHOOT, p.pos + Vector2(30.0, 0.0), 0.9, 0.05, -1.0)
	assert_true(m.ball.spin < -20.0, "negative curve")


func _angle_spread(m: FootballMatch, p: Player, action: int, power: float, n: int) -> float:
	var errs: Array[float] = []
	for i in n:
		_fire(m, p, action, p.pos + Vector2(25.0, 0.0), power)
		errs.append(m.ball.vel.angle())
	return stddev(errs)


func test_accuracy_depends_on_skill() -> void:
	var m := make_scene(32)
	var p := _kicker(m)
	set_stats(p, {"passing": 95})
	var good := _angle_spread(m, p, FB.IntentAction.PASS, 0.5, 150)
	set_stats(p, {"passing": 15})
	var bad := _angle_spread(m, p, FB.IntentAction.PASS, 0.5, 150)
	assert_true(bad > good * 1.5, "skill %f vs %f" % [good, bad])
	assert_true(good < 0.06, "elite passer is accurate (%f rad)" % good)


func test_accuracy_depends_on_pressure() -> void:
	var m := make_scene(33)
	var p := _kicker(m)
	set_stats(p, {"passing": 70})
	var free := _angle_spread(m, p, FB.IntentAction.PASS, 0.5, 150)
	var d1 := outfield(m, 1, 3)
	var d2 := outfield(m, 1, 4)
	d1.teleport(p.pos + Vector2(0.9, 0.5))
	d2.teleport(p.pos + Vector2(-0.7, 1.0))
	var pressed := _angle_spread(m, p, FB.IntentAction.PASS, 0.5, 150)
	assert_true(pressed > free * 1.4, "free %f pressed %f" % [free, pressed])


func test_accuracy_depends_on_fatigue() -> void:
	var m := make_scene(34)
	var p := _kicker(m)
	set_stats(p, {"passing": 70})
	var fresh := _angle_spread(m, p, FB.IntentAction.PASS, 0.5, 150)
	var errs: Array[float] = []
	for i in 150:
		_fire(m, p, FB.IntentAction.PASS, p.pos + Vector2(25.0, 0.0), 0.5)
		p.stamina = 0.0
		m.ball.set_carrier(p)
		p.touch_cooldown = 0.0
		p.intent.set_action(FB.IntentAction.PASS, p.pos + Vector2(25.0, 0.0), 0.5)
		p.motor.step(FB.TICK_DT)
		errs.append(m.ball.vel.angle())
	assert_true(stddev(errs) > fresh * 1.2, "tired %f fresh %f" % [stddev(errs), fresh])


func test_overcharged_shots_are_wilder() -> void:
	var m := make_scene(35)
	var p := _kicker(m)
	set_stats(p, {"shooting": 80})
	var firm := _angle_spread(m, p, FB.IntentAction.SHOOT, 0.8, 150)
	var maxed := _angle_spread(m, p, FB.IntentAction.SHOOT, 1.0, 150)
	assert_true(maxed > firm * 1.5, "firm %f maxed %f" % [firm, maxed])


func test_goalkeeper_throw_and_kick() -> void:
	var m := make_scene(36)
	var gk := m.teams[0].goalkeeper()
	gk.teleport(Vector2(-48.0, 0.0), Vector2.RIGHT)
	m.ball.set_carrier(gk)
	gk.state = FB.PlayerState.HOLDING_BALL
	gk.state_timer = 5.0
	gk.touch_cooldown = 0.0
	gk.intent.set_action(FB.IntentAction.GK_THROW, Vector2(-30.0, 5.0), 0.5)
	gk.motor.step(FB.TICK_DT)
	assert_true(m.ball.owner_player == null and m.ball.vel.length() > 5.0, "thrown")
	assert_eq(gk.state, FB.PlayerState.NORMAL, "no longer holding")
	m.ball.set_carrier(gk)
	gk.state = FB.PlayerState.HOLDING_BALL
	gk.state_timer = 5.0
	gk.touch_cooldown = 0.0
	gk.intent.set_action(FB.IntentAction.GK_KICK, Vector2(0.0, 0.0), 1.0)
	gk.motor.step(FB.TICK_DT)
	assert_true(m.ball.vel.length() > 14.0 and m.ball.vz > 4.0, "punted")


func test_goalkeeper_auto_releases_after_hold_time() -> void:
	var m := make_scene(37)
	var gk := m.teams[0].goalkeeper()
	gk.teleport(Vector2(-48.0, 0.0), Vector2.RIGHT)
	m.ball.set_carrier(gk)
	gk.state = FB.PlayerState.HOLDING_BALL
	gk.state_timer = 0.1
	for i in 20:
		gk.motor.step(FB.TICK_DT)
		m.ball.physics_step(FB.TICK_DT)
	assert_true(m.ball.owner_player == null, "keeper must not hold forever")


func test_set_piece_kick_unfreezes_dead_ball() -> void:
	var m := make_scene(38)
	var p := _kicker(m)
	m.ball.place(p.pos + Vector2(0.6, 0.0))
	m.referee.restart.taker = p
	m.referee.set_phase(FB.MatchPhase.SET_PIECE)
	p.intent.set_action(FB.IntentAction.SET_PIECE_KICK, Vector2(40.0, 0.0), 0.8)
	p.motor.step(FB.TICK_DT)
	assert_false(m.ball.frozen, "ball live after set-piece kick")
	assert_true(m.ball.vel.length() > 15.0, "kicked hard")


func test_non_taker_cannot_kick_dead_ball() -> void:
	var m := make_scene(39)
	var taker := _kicker(m)
	var other := outfield(m, 0, 4)
	other.teleport(taker.pos + Vector2(0.0, 1.0))
	m.ball.place(taker.pos + Vector2(0.6, 0.0))
	m.referee.restart.taker = taker
	m.referee.set_phase(FB.MatchPhase.SET_PIECE)
	other.intent.set_action(FB.IntentAction.PASS, Vector2(40.0, 0.0), 0.8)
	other.motor.step(FB.TICK_DT)
	assert_true(m.ball.frozen, "dead ball stays put")
