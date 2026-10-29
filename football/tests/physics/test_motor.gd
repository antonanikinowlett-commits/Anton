extends "res://tests/physics/phys_scenario.gd"
## Locomotion, stamina and ball control.


func _runner(m: FootballMatch) -> Player:
	var p := outfield(m, 0, 3)
	p.teleport(Vector2(-20.0, 0.0), Vector2.RIGHT)
	return p


func _run_move(m: FootballMatch, p: Player, dir: Vector2, sprint: bool, ticks: int) -> void:
	for i in ticks:
		p.intent.move = dir
		p.intent.sprint = sprint
		p.motor.step(FB.TICK_DT)
		m.collision_solver.solve(FB.TICK_DT)


func test_slot_is_implemented() -> void:
	assert_true(Factory.is_implemented("player_motor"), "motor")
	assert_true(Factory.is_implemented("collision_solver"), "solver")
	assert_true(Factory.is_implemented("human_brain"), "human brain")
	assert_true(Factory.is_implemented("input_controller"), "input controller")


func test_sprint_top_speed_realistic() -> void:
	var m := make_scene()
	var p := _runner(m)
	_run_move(m, p, Vector2.RIGHT, true, 300)
	var v := p.vel.length()
	assert_true(v > 7.3 and v < 9.6, "sprint speed %f" % v)
	assert_near(v, p.motor.sprint_top_speed(), 0.3, "reaches top")


func test_jog_slower_than_sprint() -> void:
	var m := make_scene()
	var p := _runner(m)
	_run_move(m, p, Vector2.RIGHT, false, 240)
	var jog := p.vel.length()
	var q := outfield(m, 0, 4)
	q.teleport(Vector2(-20.0, 5.0), Vector2.RIGHT)
	_run_move(m, q, Vector2.RIGHT, true, 240)
	assert_true(jog > 5.0 and jog < 7.0, "jog speed %f" % jog)
	assert_true(q.vel.length() > jog + 1.0, "sprint faster than jog")


func test_analog_stick_scales_speed() -> void:
	var m := make_scene()
	var p := _runner(m)
	_run_move(m, p, Vector2.RIGHT * 0.4, false, 240)
	var half := p.vel.length()
	assert_true(half > 1.8 and half < 3.0, "40%% stick speed %f" % half)


func test_acceleration_takes_time() -> void:
	var m := make_scene()
	var p := _runner(m)
	_run_move(m, p, Vector2.RIGHT, true, 30)
	assert_true(p.vel.length() > 1.5 and p.vel.length() < 5.0, "0.5s speed %f" % p.vel.length())
	_run_move(m, p, Vector2.RIGHT, true, 200)
	assert_true(p.vel.length() > 7.0, "reaches speed")


func test_pace_stat_changes_top_speed() -> void:
	var m := make_scene()
	var fast := outfield(m, 0, 3)
	var slow := outfield(m, 0, 4)
	set_stats(fast, {"pace": 95})
	set_stats(slow, {"pace": 25})
	fast.teleport(Vector2(-20.0, -5.0), Vector2.RIGHT)
	slow.teleport(Vector2(-20.0, 5.0), Vector2.RIGHT)
	for i in 300:
		fast.intent.move = Vector2.RIGHT
		fast.intent.sprint = true
		slow.intent.move = Vector2.RIGHT
		slow.intent.sprint = true
		fast.motor.step(FB.TICK_DT)
		slow.motor.step(FB.TICK_DT)
	assert_true(fast.vel.length() > slow.vel.length() + 1.0, "fast %f slow %f" % [fast.vel.length(), slow.vel.length()])
	assert_true(fast.vel.length() <= 9.6, "no superhuman speed")


func test_deceleration_believable() -> void:
	var m := make_scene()
	var p := _runner(m)
	_run_move(m, p, Vector2.RIGHT, true, 240)
	var x0 := p.pos.x
	var ticks := 0
	while p.vel.length() > 0.01 and ticks < 200:
		_run_move(m, p, Vector2.ZERO, false, 1)
		ticks += 1
	var t := float(ticks) * FB.TICK_DT
	assert_true(t > 0.5 and t < 1.6, "stop time %f" % t)
	assert_true(p.pos.x - x0 > 2.0 and p.pos.x - x0 < 7.0, "stop distance %f" % (p.pos.x - x0))


func test_turning_costs_speed_and_time() -> void:
	var m := make_scene()
	var p := _runner(m)
	_run_move(m, p, Vector2.RIGHT, true, 240)
	var v0 := p.vel.length()
	_run_move(m, p, Vector2.LEFT, true, 18)
	assert_true(p.vel.x > 0.0, "cannot reverse instantly (vx %f)" % p.vel.x)
	_run_move(m, p, Vector2.LEFT, true, 120)
	assert_true(p.vel.x < -4.0, "eventually runs the other way (vx %f)" % p.vel.x)
	assert_true(v0 > 7.0, "was sprinting")


func test_agility_speeds_up_turns() -> void:
	var m := make_scene()
	var agile := outfield(m, 0, 3)
	var heavy := outfield(m, 0, 4)
	set_stats(agile, {"agility": 99})
	set_stats(heavy, {"agility": 10})
	agile.teleport(Vector2(-20.0, -5.0), Vector2.RIGHT)
	heavy.teleport(Vector2(-20.0, 5.0), Vector2.RIGHT)
	for i in 200:
		for q: Player in [agile, heavy]:
			q.intent.move = Vector2.RIGHT
			q.intent.sprint = true
			q.motor.step(FB.TICK_DT)
	for i in 25:
		for q: Player in [agile, heavy]:
			q.intent.move = Vector2.DOWN
			q.intent.sprint = true
			q.motor.step(FB.TICK_DT)
	assert_true(agile.vel.y > heavy.vel.y + 0.5, "agile turns faster (%f vs %f)" % [agile.vel.y, heavy.vel.y])


func test_stamina_drains_when_sprinting_and_recovers() -> void:
	var m := make_scene()
	var p := _runner(m)
	_run_move(m, p, Vector2.RIGHT, true, 60 * 8)
	var after := p.stamina
	assert_true(after < 0.95 and after > 0.5, "sprint drain %f" % after)
	_run_move(m, p, Vector2.ZERO, false, 60 * 8)
	assert_true(p.stamina > after + 0.05, "rests back (%f -> %f)" % [after, p.stamina])


func test_stamina_stat_slows_drain() -> void:
	var m := make_scene()
	var fit := outfield(m, 0, 3)
	var unfit := outfield(m, 0, 4)
	set_stats(fit, {"stamina": 95})
	set_stats(unfit, {"stamina": 20})
	fit.teleport(Vector2(-30.0, -5.0), Vector2.RIGHT)
	unfit.teleport(Vector2(-30.0, 5.0), Vector2.RIGHT)
	for i in 60 * 8:
		for q: Player in [fit, unfit]:
			q.intent.move = Vector2.RIGHT
			q.intent.sprint = true
			q.motor.step(FB.TICK_DT)
			q.pos.x = -30.0
	assert_true(fit.stamina > unfit.stamina + 0.05, "fit %f unfit %f" % [fit.stamina, unfit.stamina])


func test_exhausted_player_is_slower_and_cannot_sprint() -> void:
	var m := make_scene()
	var p := _runner(m)
	p.stamina = 1.0
	_run_move(m, p, Vector2.RIGHT, true, 200)
	var fresh := p.vel.length()
	var q := outfield(m, 0, 4)
	q.teleport(Vector2(-20.0, 5.0), Vector2.RIGHT)
	q.stamina = 0.0
	_run_move(m, q, Vector2.RIGHT, true, 200)
	assert_true(q.vel.length() < fresh - 1.0, "tired %f vs fresh %f" % [q.vel.length(), fresh])
	assert_true(q.stamina < 0.1, "stays low while pushing")


func test_state_lock_blocks_movement_input() -> void:
	var m := make_scene()
	var p := _runner(m)
	p.state = FB.PlayerState.FALLEN
	p.state_timer = 0.5
	_run_move(m, p, Vector2.RIGHT, true, 20)
	assert_true(p.vel.length() < 0.5, "fallen player does not run")
	_run_move(m, p, Vector2.ZERO, false, 40)
	assert_eq(p.state, FB.PlayerState.NORMAL, "gets back up")


func test_facing_follows_movement() -> void:
	var m := make_scene()
	var p := _runner(m)
	_run_move(m, p, Vector2.DOWN, false, 90)
	assert_true(p.facing.dot(Vector2.DOWN) > 0.9, "faces movement")
	p.intent.look = Vector2.UP
	_run_move(m, p, Vector2.DOWN, false, 1)
	p.intent.look = Vector2.UP
	for i in 60:
		p.intent.move = Vector2.DOWN
		p.intent.look = Vector2.UP
		p.motor.step(FB.TICK_DT)
	assert_true(p.facing.dot(Vector2.UP) > 0.9, "look overrides movement for facing")


# --- Ball control ---------------------------------------------------------------------------
func _control_rate(m: FootballMatch, ctrl: int, ball_speed: float, trials: int) -> float:
	var p := _runner(m)
	set_stats(p, {"control": ctrl})
	var ok := 0
	for i in trials:
		p.teleport(Vector2(0.0, 0.0), Vector2.LEFT)
		p.touch_cooldown = 0.0
		p.state = FB.PlayerState.NORMAL
		m.ball.set_carrier(null)
		m.ball.frozen = false
		m.ball.pos = Vector2(-8.0, 0.0)
		m.ball.vel = Vector2(ball_speed, 0.0)
		m.ball.height = 0.0
		m.ball.vz = 0.0
		m.ball.last_touch_player = null
		for t in 120:
			sim(m, [p], 1)
			if m.ball.owner_player == p or m.ball.last_touch_player == p:
				break
		if m.ball.owner_player == p:
			ok += 1
	m.ball.set_carrier(null)
	return float(ok) / float(trials)


func test_first_touch_skill_and_speed() -> void:
	var m := make_scene(11)
	var good_slow := _control_rate(m, 95, 6.0, 40)
	var bad_fast := _control_rate(m, 15, 13.0, 40)
	assert_true(good_slow > 0.9, "skilled player cushions a slow pass (%f)" % good_slow)
	assert_true(bad_fast < good_slow - 0.2, "poor control on a hard pass loses it more (%f vs %f)" % [bad_fast, good_slow])


func test_hot_shot_is_blocked_not_controlled() -> void:
	var m := make_scene(12)
	var rate := _control_rate(m, 99, 24.0, 10)
	assert_true(rate < 0.2, "a 24 m/s shot is not trapped by an outfielder (%f)" % rate)


func test_loose_ball_goes_to_closest_player() -> void:
	var m := make_scene(13)
	var a := outfield(m, 0, 3)
	var b := outfield(m, 1, 3)
	a.teleport(Vector2(-0.5, 0.0), Vector2.RIGHT)
	b.teleport(Vector2(0.3, 0.0), Vector2.LEFT)
	m.ball.pos = Vector2.ZERO
	m.ball.vel = Vector2.ZERO
	var arr: Array[Player] = [a, b]
	sim(m, arr, 5)
	assert_true(m.ball.owner_player == b or m.ball.owner_player == null, "closer player wins the ball")


func test_dribbling_keeps_ball_at_feet_while_running() -> void:
	var m := make_scene(14)
	var p := _runner(m)
	set_stats(p, {"dribbling": 99})
	m.ball.set_carrier(p)
	for i in 240:
		p.intent.move = Vector2(1, 0)
		p.intent.sprint = true
		p.motor.step(FB.TICK_DT)
		m.ball.physics_step(FB.TICK_DT)
	assert_true(m.ball.owner_player == p, "still has the ball")
	assert_true(m.ball.pos.distance_to(p.pos) < 1.3, "ball at feet")
	assert_true(p.vel.length() > 6.5, "dribbling speed %f" % p.vel.length())
