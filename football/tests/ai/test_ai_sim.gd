extends AiScenario
## Whole-match headless simulations with the core stubs, plus a timing benchmark.

const SEEDS := [1, 2, 3, 7]
const WINDOW := 600


func _all_finite(m: FootballMatch) -> bool:
	if not is_finite_v(m.ball.pos) or not is_finite_v(m.ball.vel):
		return false
	for p: Player in m.players:
		if not is_finite_v(p.pos) or not is_finite_v(p.vel) or not is_finite_v(p.intent.move) \
				or not is_finite(p.stamina) or not is_finite_v(p.facing):
			return false
		if p.intent.move.length() > 1.001:
			return false
	return true


func test_sims_have_no_nan_and_players_move() -> void:
	for seed_value in SEEDS:
		var m := make_headless_match(seed_value, -1, 4.0)
		m.config.difficulty = seed_value % 3
		var start := PackedVector2Array()
		var path := PackedFloat32Array()
		var last := PackedVector2Array()
		for p: Player in m.players:
			start.append(p.pos)
			last.append(p.pos)
			path.append(0.0)
		for tick_i in 3000:
			m.step(FB.TICK_DT)
			for i in m.players.size():
				var p := m.players[i]
				var dd := p.pos.distance_to(last[i])
				if dd < 4.0:  # ignore teleports (kickoff reset)
					path[i] += dd
				last[i] = p.pos
			if tick_i % 100 == 0:
				assert_true(_all_finite(m), "NaN/inf or oversized intent in seed %d at tick %d" % [seed_value, tick_i])
			if (tick_i + 1) % WINDOW == 0:
				for i in m.players.size():
					var p := m.players[i]
					if p.is_goalkeeper():
						continue
					assert_true(path[i] > 2.0,
						"%s stuck: moved %.2f m in %d ticks (seed %d, tick %d)" % [p.name, path[i], WINDOW, seed_value, tick_i])
					path[i] = 0.0
		assert_true(_all_finite(m))


func test_possession_changes_and_play_flows() -> void:
	var m := make_headless_match(5, -1, 4.0)
	var seen_teams := {}
	var progress := 0.0
	var last_ball := m.ball.pos
	for i in 3000:
		m.step(FB.TICK_DT)
		if m.ball.owner_player != null:
			seen_teams[m.ball.owner_player.team.team_id] = true
		progress += m.ball.pos.distance_to(last_ball)
		last_ball = m.ball.pos
	assert_true(seen_teams.size() == 2, "both teams get the ball in 50 s")
	assert_true(progress > 150.0, "ball actually travels (%.0f m)" % progress)


func test_human_team_sim_runs_clean() -> void:
	var m := make_headless_match(9, 0, 4.0)
	run_ticks(m, 2000)
	assert_true(_all_finite(m))


func test_ai_timing_benchmark() -> void:
	var m := make_headless_match(4, -1, 4.0)
	run_ticks(m, 600)  # warm-up into a realistic state
	m.referee.set_phase(FB.MatchPhase.PLAYING)
	var ticks := 600
	var t0 := Time.get_ticks_usec()
	for n in ticks:
		var group := (m.tick + n) % FB.AI_STAGGER_GROUPS
		if group == 0:
			m.teams[0].team_brain.think(0.1)
		elif group == FB.AI_STAGGER_GROUPS / 2:
			m.teams[1].team_brain.think(0.1)
		for p: Player in m.players:
			if p.stagger_group == group:
				p.ai_brain.think(0.1)
		for p: Player in m.players:
			p.ai_brain.act(FB.TICK_DT)
	var avg_ms := float(Time.get_ticks_usec() - t0) / float(ticks) / 1000.0
	print("    AI avg per tick: %.3f ms (budget 2 ms)" % avg_ms)
	assert_true(avg_ms < 2.0, "AI average %.3f ms/tick exceeds 2 ms" % avg_ms)
