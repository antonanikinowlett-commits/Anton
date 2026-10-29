extends "res://tests/physics/phys_scenario.gd"
## CollisionSolver: separation, mass, momentum, body-ball deflection.


func test_players_are_separated() -> void:
	var m := make_scene(61)
	var a := outfield(m, 0, 3)
	var b := outfield(m, 1, 3)
	a.teleport(Vector2(0.0, 0.0))
	b.teleport(Vector2(0.3, 0.1))
	m.collision_solver.solve(FB.TICK_DT)
	assert_true(a.pos.distance_to(b.pos) >= FB.PLAYER_RADIUS * 2.0 - 0.001, "no overlap (%f)" % a.pos.distance_to(b.pos))


func test_stronger_player_is_pushed_less() -> void:
	var m := make_scene(62)
	var strong := outfield(m, 0, 3)
	var weak := outfield(m, 1, 3)
	set_stats(strong, {"strength": 99, "height_cm": 195})
	set_stats(weak, {"strength": 10, "height_cm": 165})
	strong.teleport(Vector2(0.0, 0.0))
	weak.teleport(Vector2(0.5, 0.0))
	m.collision_solver.solve(FB.TICK_DT)
	assert_true(absf(strong.pos.x) < absf(weak.pos.x - 0.5), "weak player gives way (%f vs %f)" % [strong.pos.x, weak.pos.x - 0.5])


func test_body_mass_ordering() -> void:
	var m := make_scene(63)
	var a := outfield(m, 0, 3)
	var b := outfield(m, 0, 4)
	set_stats(a, {"strength": 95})
	set_stats(b, {"strength": 20})
	var solver_script: GDScript = load("res://physics/collision_solver_impl.gd")
	assert_true(solver_script.body_mass(a) > solver_script.body_mass(b), "strength adds mass")


func test_head_on_collision_exchanges_momentum() -> void:
	var m := make_scene(64)
	var a := outfield(m, 0, 3)
	var b := outfield(m, 1, 3)
	set_stats(a, {"strength": 50, "height_cm": 180})
	set_stats(b, {"strength": 50, "height_cm": 180})
	a.teleport(Vector2(0.0, 0.0))
	b.teleport(Vector2(0.7, 0.0))
	a.vel = Vector2(6.0, 0.0)
	b.vel = Vector2(-6.0, 0.0)
	m.collision_solver.solve(FB.TICK_DT)
	assert_true(a.vel.x < 1.0 and b.vel.x > -1.0, "closing speed absorbed (%f, %f)" % [a.vel.x, b.vel.x])


func test_sprinting_into_a_standing_player_slows_the_runner() -> void:
	var m := make_scene(65)
	var runner := outfield(m, 0, 3)
	var wall := outfield(m, 1, 3)
	set_stats(wall, {"strength": 90, "height_cm": 190})
	set_stats(runner, {"strength": 40, "height_cm": 172})
	runner.teleport(Vector2(-5.0, 0.0), Vector2.RIGHT)
	wall.teleport(Vector2(0.0, 0.0), Vector2.LEFT)
	for i in 120:
		runner.intent.move = Vector2.RIGHT
		runner.intent.sprint = true
		runner.motor.step(FB.TICK_DT)
		wall.motor.step(FB.TICK_DT)
		m.collision_solver.solve(FB.TICK_DT)
	assert_true(runner.pos.x < wall.pos.x, "cannot run through")
	assert_true(runner.pos.distance_to(wall.pos) >= 0.79, "kept apart")
	assert_true(wall.pos.x < 2.5, "wall is not shoved across the pitch (%f)" % wall.pos.x)


func test_crowd_resolves_without_overlap() -> void:
	var m := make_scene(66)
	var i := 0
	for p: Player in m.players:
		if i < 10:
			p.teleport(Vector2(float(i % 4) * 0.4, float(i / 4) * 0.4))
		i += 1
	for k in 30:
		m.collision_solver.solve(FB.TICK_DT)
	var worst := 99.0
	for a: Player in m.players:
		for b: Player in m.players:
			if a != b:
				worst = minf(worst, a.pos.distance_to(b.pos))
	assert_true(worst > 0.6, "crowd mostly separated (min %f)" % worst)


func test_fallen_and_sent_off_players_ignored() -> void:
	var m := make_scene(67)
	var a := outfield(m, 0, 3)
	var b := outfield(m, 1, 3)
	a.teleport(Vector2.ZERO)
	b.teleport(Vector2(0.2, 0.0))
	b.state = FB.PlayerState.FALLEN
	m.collision_solver.solve(FB.TICK_DT)
	assert_eq(a.pos, Vector2.ZERO, "no push from a downed player")


func test_ball_deflects_off_defender() -> void:
	var m := make_scene(68)
	var d := outfield(m, 1, 3)
	d.teleport(Vector2(10.0, 0.0), Vector2.LEFT)
	d.touch_cooldown = 0.0
	m.ball.pos = Vector2(8.0, 0.0)
	m.ball.vel = Vector2(25.0, 0.0)
	m.ball.height = 0.0
	m.ball.last_touch_team = 0
	var arr: Array[Player] = [d]
	for i in 15:
		sim(m, arr, 1)
	assert_true(m.ball.vel.x < 5.0, "shot is blocked (vx %f)" % m.ball.vel.x)
	assert_eq(m.ball.last_touch_team, 1, "defender's block counts as a touch")
	assert_true(m.ball.last_touch_player == d, "touch player")


func test_ball_passes_over_player_when_high() -> void:
	var m := make_scene(69)
	var d := outfield(m, 1, 3)
	d.teleport(Vector2(10.0, 0.0), Vector2.LEFT)
	m.ball.pos = Vector2(9.0, 0.0)
	m.ball.vel = Vector2(20.0, 0.0)
	m.ball.height = 3.0
	m.ball.vz = 0.0
	m.collision_solver.solve(FB.TICK_DT)
	assert_eq(m.ball.vel, Vector2(20.0, 0.0), "overhead ball untouched")


func test_owned_ball_not_deflected() -> void:
	var m := make_scene(70)
	var a := outfield(m, 0, 3)
	var d := outfield(m, 1, 3)
	a.teleport(Vector2.ZERO)
	d.teleport(Vector2(0.4, 0.0))
	m.ball.set_carrier(a)
	m.ball.pos = Vector2(0.4, 0.0)
	var v0 := m.ball.vel
	m.collision_solver.solve(FB.TICK_DT)
	assert_eq(m.ball.vel, v0, "dribbled ball is the motor's business")
