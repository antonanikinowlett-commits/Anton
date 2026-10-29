extends RulesTestBase
## Human set-piece input flow (InputController feeding API) and AI-vs-AI statistics.


func _free_kick_for_human(m: FootballMatch) -> void:
	var off := outfield(m.teams[1], 2)
	var vic := outfield(m.teams[0], 5)
	vic.teleport(Vector2(10.0, 0.0))
	m.referee.award_foul(off, vic, FB.FoulSeverity.CARELESS, false)
	step_n(m, 2)


func _tap(m: FootballMatch, action: int) -> void:
	m.human_input.press_action(action)
	step_n(m, 1)
	m.human_input.release_action(action)
	step_n(m, 1)


func test_human_free_kick_full_flow() -> void:
	var m := start_playing(2, 0)
	var r = m.referee
	_free_kick_for_human(m)
	assert_eq(r.phase, FB.MatchPhase.SET_PIECE)
	assert_true(r.sp_human, "human set piece")
	assert_eq(m.teams[0].controlled_player, r.restart.taker, "control moved to the taker")
	assert_eq(m.control_context, FB.Context.SET_PIECE, "SET_PIECE context")
	assert_eq(r.sp_step, r.SpStep.AIM)
	# Drag aim up (towards -y).
	m.human_input.set_aim_vector(Vector2(0.0, -1.0))
	step_n(m, 3)
	assert_near(r.sp_aim_dir.y, -1.0, 0.01, "aim follows drag")
	# Joystick-style aim must not walk the taker away.
	var spot: Vector2 = r.restart.taker.pos
	step_n(m, 30)
	assert_true(r.restart.taker.pos.distance_to(spot) < 0.01, "taker pinned")
	_tap(m, FB.Action.SP_CONFIRM)
	assert_eq(r.sp_step, r.SpStep.POWER, "aim -> power")
	step_n(m, 25)
	assert_true(r.sp_power > 0.1, "meter moves")
	# Cancel goes back, confirm again.
	_tap(m, FB.Action.SP_CANCEL)
	assert_eq(r.sp_step, r.SpStep.AIM, "cancel steps back")
	_tap(m, FB.Action.SP_CONFIRM)
	step_n(m, 30)
	_tap(m, FB.Action.SP_CONFIRM)
	assert_eq(r.sp_step, r.SpStep.CURVE, "power -> curve")
	var locked: float = r.sp_power
	m.human_input.set_curve_input(0.6)
	step_n(m, 2)
	assert_near(r.sp_curve, 0.6, 0.01)
	_tap(m, FB.Action.SP_CONFIRM)
	assert_true(locked > 0.0)
	assert_true(step_until_phase(m, FB.MatchPhase.PLAYING, 120), "kick taken")
	assert_true(m.ball.vel.y < -1.0, "ball travels along the aim (-y): %s" % str(m.ball.vel))
	assert_false(r.sp_human)


func test_human_throw_in_skips_curve_step() -> void:
	var m := start_playing(3, 0)
	var r = m.referee
	park_players(m)
	put_ball(m, Vector2(0.0, 34.3), Vector2(0.0, 5.0), 0.0, 1, outfield(m.teams[1], 2))
	step_n(m, 3)
	assert_eq(r.restart.type, FB.Restart.THROW_IN)
	assert_true(r.sp_human)
	assert_false(r.sp_needs_curve)
	# Default aim is infield (-y on the bottom touchline).
	assert_true(r.sp_aim_dir.y < 0.0, "default aim infield")
	_tap(m, FB.Action.SP_CONFIRM)
	step_n(m, 20)
	_tap(m, FB.Action.SP_CONFIRM)
	assert_true(step_until_phase(m, FB.MatchPhase.PLAYING, 120), "thrown after power lock")


func test_ai_set_pieces_do_not_use_human_flow() -> void:
	var m := start_playing(4, 0)
	var r = m.referee
	# Foul by home: free kick for away (AI).
	var off := outfield(m.teams[0], 2)
	var vic := outfield(m.teams[1], 5)
	vic.teleport(Vector2(-10.0, 0.0))
	r.award_foul(off, vic, FB.FoulSeverity.CARELESS, false)
	assert_false(r.sp_human)
	assert_eq(m.control_context != FB.Context.SET_PIECE, true)
	assert_true(step_until_phase(m, FB.MatchPhase.PLAYING, 600), "AI takes it")


func test_human_timeout_falls_back_to_ai() -> void:
	var m := start_playing(5, 0)
	var r = m.referee
	_free_kick_for_human(m)
	r._sp_time = r.HUMAN_TIMEOUT + 1.0
	assert_true(step_until_phase(m, FB.MatchPhase.PLAYING, 600), "auto kick after timeout")


func test_set_piece_ui_scene_loads_and_binds() -> void:
	var scene: PackedScene = load("res://rules/set_piece_ui.tscn")
	assert_not_null(scene)
	var ui: Control = scene.instantiate()
	root.add_child(ui)
	var m := start_playing(2, 0)
	ui.call("bind", m)
	_free_kick_for_human(m)
	ui._process(0.016)
	assert_true(ui.visible, "visible during human set piece")
	step_n(m, 1)


func _inject_contacts(m: FootballMatch) -> void:
	# Stand-in for the physics module: report a challenge whenever opponents are close.
	if m.tick % 20 != 0:
		return
	for a: Player in m.teams[0].players:
		for b: Player in m.teams[1].players:
			if a.sent_off or b.sent_off:
				continue
			if a.pos.distance_squared_to(b.pos) < 2.5 * 2.5:
				var rng := m.rng
				m.referee.report_contact(a, b, rng.randf() < 0.4, rng.randf(), rng.randf() < 0.25)
				return


func test_ai_vs_ai_simulations_are_stable() -> void:
	var total_fouls := 0
	var total_goals := 0
	var total_cards := 0
	var finished := 0
	for s in [11, 12, 13]:
		var m := make_headless_match(s, -1, 0.3)
		rec.attach()
		var guard := 0
		while not m.is_finished and guard < 60 * 300:
			m.step(FB.TICK_DT)
			_inject_contacts(m)
			guard += 1
		if m.is_finished:
			finished += 1
		var r = m.referee
		total_fouls += r.fouls_total
		total_goals += r.goals_total
		total_cards += r.yellow_total + r.red_total
		for p: Player in m.players:
			assert_false(is_nan(p.pos.x) or is_nan(p.pos.y), "finite player pos")
		assert_eq(m.teams[0].score + m.teams[1].score, r.goals_total, "score matches goal count")
		print("    sim seed %d: fouls=%d cards=%d goals=%d offsides=%d corners=%d throw_ins=%d goal_kicks=%d fk=%d pens=%d" % [
			s, r.fouls_total, r.yellow_total + r.red_total, r.goals_total, r.offsides_total,
			r.corners_total, r.throw_ins_total, r.goal_kicks_total, r.free_kicks_total, r.penalties_total])
		m.free()
	assert_eq(finished, 3, "all sims reach full time")
	var avg_fouls := total_fouls / 3.0
	assert_true(avg_fouls >= 8.0 and avg_fouls <= 40.0, "avg fouls %.1f within a plausible range" % avg_fouls)
	assert_true(total_cards >= 0)
	assert_true(total_goals >= 0)
