extends "res://tests/physics/phys_scenario.gd"
## Performance budget and full-match sanity with the physics module plugged in.


func test_all_physics_slots_present() -> void:
	for slot in ["ball", "player_motor", "human_brain", "collision_solver", "input_controller"]:
		assert_true(Factory.is_implemented(slot), "slot %s" % slot)


func test_60fps_budget_22_players() -> void:
	# Physics-only budget (motors + solver + ball) for 22 moving players: spec says <= 1 ms/tick on a
	# phone; a desktop headless build must be far below that. Generous margin to avoid CI flakiness.
	var m := make_scene(81)
	var i := 0
	for p: Player in m.players:
		var row := i % 11
		p.teleport(Vector2(-40.0 + float(row) * 8.0, -20.0 if i < 11 else 20.0), Vector2.RIGHT)
		i += 1
	m.ball.set_carrier(m.players[3])
	var ticks := 600
	var t0 := Time.get_ticks_usec()
	for t in ticks:
		var k := 0
		for p: Player in m.players:
			# Wander so bodies meet and the solver has work to do.
			var ang := float(t) * 0.02 + float(k)
			p.intent.move = Vector2(cos(ang), sin(ang))
			p.intent.sprint = (k % 3) == 0
			p.touch_cooldown = maxf(p.touch_cooldown - FB.TICK_DT, 0.0)
			p.motor.step(FB.TICK_DT)
			k += 1
		m.collision_solver.solve(FB.TICK_DT)
		m.ball.physics_step(FB.TICK_DT)
	var per_tick_ms := float(Time.get_ticks_usec() - t0) / 1000.0 / float(ticks)
	print("    physics per tick: %.3f ms" % per_tick_ms)
	assert_true(per_tick_ms < 2.0, "22-player physics tick %.3f ms" % per_tick_ms)


func test_full_match_tick_budget() -> void:
	var m := make_headless_match(82, 0, 4.0)
	run_ticks(m, 120)
	var ticks := 600
	var t0 := Time.get_ticks_usec()
	run_ticks(m, ticks)
	var per_tick_ms := float(Time.get_ticks_usec() - t0) / 1000.0 / float(ticks)
	print("    whole match per tick: %.3f ms" % per_tick_ms)
	assert_true(per_tick_ms < 8.0, "whole simulation tick %.3f ms" % per_tick_ms)


func test_match_runs_without_nans_or_escapes() -> void:
	var m := make_headless_match(83, -1, 4.0)
	run_ticks(m, 60 * 90)
	assert_true(is_finite(m.ball.pos.x) and is_finite(m.ball.pos.y), "ball finite")
	assert_true(m.ball.pos.length() < 200.0, "ball not lost in space (%s)" % str(m.ball.pos))
	for p: Player in m.players:
		assert_true(is_finite(p.pos.x) and is_finite(p.vel.x) and is_finite(p.stamina), "player finite")
		assert_true(p.vel.length() < 11.0, "no superhuman speed (%f)" % p.vel.length())
		assert_true(absf(p.pos.x) < FB.HALF_LENGTH + 4.0 and absf(p.pos.y) < FB.HALF_WIDTH + 4.0, "player on or near the pitch")
		assert_true(p.stamina >= 0.0 and p.stamina <= 1.0, "stamina range")


func test_stub_ai_match_produces_kicks_and_touches() -> void:
	# With real physics under the stub AI, the ball should actually be played.
	var m := make_headless_match(84, -1, 4.0)
	var kicks := [0]
	var cb := func(_p: Player, _k: int, _pw: float) -> void:
		kicks[0] += 1
	EventBus.ball_kicked.connect(cb)
	run_ticks(m, 60 * 60)
	EventBus.ball_kicked.disconnect(cb)
	assert_true(kicks[0] > 3, "ball is kicked during a minute of play (%d)" % kicks[0])
