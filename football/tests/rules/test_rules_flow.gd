extends RulesTestBase
## Goals, kickoff, out of play, restarts, clock, halves, full time.


func test_referee_is_rules_impl() -> void:
	var m := start_playing()
	assert_true(m.referee.get_script().resource_path.ends_with("rules/referee_impl.gd"), "impl loaded")


func test_goal_detected_and_kickoff_by_conceding_team() -> void:
	var m := start_playing()
	park_players(m)
	var scorer := outfield(m.teams[0], 3)
	put_ball(m, Vector2(50.0, 0.0), Vector2(25.0, 0.0), 0.3, 0, scorer)
	step_n(m, 20)
	assert_eq(m.teams[0].score, 1, "home scored in +x goal")
	assert_eq(m.referee.phase, FB.MatchPhase.GOAL_CELEBRATION, "celebration")
	assert_eq(rec.n("goal"), 1, "goal signal")
	assert_false(rec.goals[0][1], "not own goal")
	assert_true(step_until_phase(m, FB.MatchPhase.KICKOFF, 400), "kickoff follows")
	assert_eq(m.referee.restart.team_id, 1, "conceding team kicks off")
	assert_true(step_until_phase(m, FB.MatchPhase.PLAYING, 400), "play restarts")
	assert_eq(m.ball.owner_player, m.referee.restart.taker, "taker has the ball")
	assert_eq(rec.n("kickoff"), 2, "kickoff signal (initial + after goal)")


func test_own_goal() -> void:
	var m := start_playing()
	park_players(m)
	var defender := outfield(m.teams[1], 2)
	# Away defender puts it into the -x goal... which away DEFENDS? away attack_dir=-1, so -x is the goal home defends.
	# Ball into +x goal (home attacks it): last touch away player = own goal for away.
	put_ball(m, Vector2(50.0, 1.0), Vector2(20.0, 0.0), 0.2, 1, defender)
	step_n(m, 20)
	assert_eq(m.teams[0].score, 1, "home gets the own goal")
	assert_true(rec.goals[0][1], "flagged own goal")


func test_no_goal_over_bar_or_wide() -> void:
	var m := start_playing()
	park_players(m)
	put_ball(m, Vector2(52.0, 0.0), Vector2(20.0, 0.0), 3.2, 0, outfield(m.teams[0], 1))
	step_n(m, 12)
	assert_eq(m.teams[0].score, 0, "over the bar is no goal")
	assert_eq(m.referee.phase, FB.MatchPhase.SET_PIECE, "restart instead")
	assert_eq(m.referee.restart.type, FB.Restart.GOAL_KICK, "goal kick for the defenders")
	var m2 := start_playing(2)
	park_players(m2)
	put_ball(m2, Vector2(52.0, 4.5), Vector2(20.0, 0.0), 0.2, 0, outfield(m2.teams[0], 1))
	step_n(m2, 12)
	assert_eq(m2.teams[0].score, 0, "wide of the post is no goal")


func test_goal_via_fast_ball_crossing_line_between_ticks() -> void:
	var m := start_playing()
	park_players(m)
	put_ball(m, Vector2(51.0, 0.0), Vector2(60.0, 0.0), 0.5, 0, outfield(m.teams[0], 1))
	step_n(m, 6)
	assert_eq(m.teams[0].score, 1, "fast shot counts")


func test_throw_in_for_opponent_of_last_touch() -> void:
	var m := start_playing()
	park_players(m)
	put_ball(m, Vector2(10.0, 34.3), Vector2(0.0, 5.0), 0.0, 0, outfield(m.teams[0], 2))
	step_n(m, 3)
	var r = m.referee
	assert_eq(r.phase, FB.MatchPhase.SET_PIECE)
	assert_eq(r.restart.type, FB.Restart.THROW_IN)
	assert_eq(r.restart.team_id, 1, "opponent of last touch")
	assert_near(r.restart.position.y, FB.HALF_WIDTH, 0.01, "on the touchline")
	assert_not_null(r.restart.taker)
	assert_eq(r.restart.taker.team.team_id, 1)
	assert_true(m.ball.frozen, "ball dead until taken")
	assert_eq(rec.n("throw_in"), 1)
	# AI takes it within a few seconds; first touch resumes play.
	assert_true(step_until_phase(m, FB.MatchPhase.PLAYING, 400), "AI throws in")
	assert_false(m.ball.frozen)
	assert_true(m.ball.vel.length() > 1.0, "ball moving")


func test_corner_and_goal_kick() -> void:
	# Home attacks +x. Away touch last over +x goal line -> corner for home.
	var m := start_playing()
	park_players(m)
	put_ball(m, Vector2(52.8, 20.0), Vector2(5.0, 0.0), 0.0, 1, outfield(m.teams[1], 2))
	step_n(m, 3)
	var r = m.referee
	assert_eq(r.restart.type, FB.Restart.CORNER)
	assert_eq(r.restart.team_id, 0)
	assert_near(r.restart.position.x, FB.HALF_LENGTH, 0.01)
	assert_near(r.restart.position.y, FB.HALF_WIDTH, 0.01, "near corner on the ball's side")
	assert_eq(rec.n("corner"), 1)
	# Home touch last over +x line -> goal kick for away.
	var m2 := start_playing(3)
	park_players(m2)
	put_ball(m2, Vector2(52.8, -20.0), Vector2(5.0, 0.0), 0.0, 0, outfield(m2.teams[0], 2))
	step_n(m2, 3)
	var r2 = m2.referee
	assert_eq(r2.restart.type, FB.Restart.GOAL_KICK)
	assert_eq(r2.restart.team_id, 1)
	assert_true(absf(r2.restart.position.x) < FB.HALF_LENGTH - 4.0, "ball at the goal area")
	assert_true(r2.restart.taker.is_goalkeeper(), "keeper takes the goal kick")
	assert_eq(rec.n("goal_kick"), 1)
	assert_true(step_until_phase(m2, FB.MatchPhase.PLAYING, 400), "goal kick taken")
	assert_true(m2.ball.vel.length() > 5.0, "long kick")


func test_corner_flow_places_defenders_away() -> void:
	var m := start_playing()
	put_ball(m, Vector2(52.8, -20.0), Vector2(5.0, 0.0), 0.0, 1, outfield(m.teams[1], 2))
	step_n(m, 3)
	var r = m.referee
	assert_eq(r.restart.type, FB.Restart.CORNER)
	for p: Player in m.teams[1].players:
		if not p.is_goalkeeper():
			assert_true(p.pos.distance_to(r.restart.position) >= 9.0, "%s keeps distance" % p.name)
	assert_true(r.restart.taker.pos.distance_to(r.restart.position) < 1.5, "taker at the corner")


func test_wall_distance_on_free_kick() -> void:
	var m := start_playing()
	var off := outfield(m.teams[1], 3)
	var vic := outfield(m.teams[0], 4)
	vic.teleport(Vector2(25.0, 5.0))
	m.referee.award_foul(off, vic, FB.FoulSeverity.CARELESS, false)
	var r = m.referee
	assert_eq(r.restart.type, FB.Restart.FREE_KICK_DIRECT)
	assert_eq(r.restart.team_id, 0)
	for p: Player in m.teams[1].players:
		if not p.is_goalkeeper():
			assert_true(p.pos.distance_to(r.restart.position) >= 9.15, "%s outside 9.15 m" % p.name)
	assert_eq(rec.n("free_kick"), 1)
	assert_eq(rec.n("foul"), 1)


func test_kickoff_positions_are_legal() -> void:
	var m := make_headless_match(4)
	rec.attach()
	var r = m.referee
	assert_eq(r.phase, FB.MatchPhase.KICKOFF)
	var taker: Player = r.restart.taker
	for t: Team in m.teams:
		for p: Player in t.players:
			assert_true(p.pos.x * t.attack_dir <= 0.0 + 0.001, "%s in own half" % p.name)
			if p != taker and t.team_id != r.restart.team_id:
				assert_true(p.pos.length() >= FB.CENTER_CIRCLE_RADIUS, "%s outside circle" % p.name)
	assert_true(taker.pos.length() < 1.0, "taker at the ball")


func test_half_time_swaps_sides_and_second_half_kickoff() -> void:
	var m := make_headless_match(5, -1, 0.25)
	rec.attach()
	var first: int = m.referee.first_kickoff_team
	assert_eq(m.teams[0].attack_dir, 1)
	assert_true(step_until_phase(m, FB.MatchPhase.HALF_TIME, 60 * 120), "half time reached")
	assert_eq(m.teams[0].attack_dir, -1, "home swapped")
	assert_eq(m.teams[1].attack_dir, 1, "away swapped")
	assert_eq(rec.n("half_time"), 1)
	assert_true(m.referee.clock >= FB.HALF_GAME_SECONDS, "clock >= 45:00")
	assert_true(step_until_phase(m, FB.MatchPhase.KICKOFF, 600), "second half kickoff")
	assert_eq(m.referee.half, 2)
	assert_eq(m.referee.restart.team_id, 1 - first, "other team kicks off")
	assert_true(m.referee.clock >= FB.HALF_GAME_SECONDS)


func test_full_time_finishes_match() -> void:
	var m := make_headless_match(6, -1, 0.25)
	rec.attach()
	step_n(m, 60 * 200)
	assert_true(m.is_finished, "finished")
	assert_eq(m.referee.phase, FB.MatchPhase.FULL_TIME)
	assert_eq(rec.n("full_time"), 1)
	assert_true(m.referee.clock >= FB.HALF_GAME_SECONDS * 2.0)
	assert_eq(m.referee.half, 2)


func test_stoppage_time_from_incidents() -> void:
	var m := start_playing()
	var r = m.referee
	r._stop_acc = 200.0
	r.clock = FB.HALF_GAME_SECONDS - 0.5
	step_n(m, 60)
	assert_near(r.stoppage, 240.0, 0.01, "200 s rounds up to 4 minutes")
	assert_true(m.referee.phase != FB.MatchPhase.HALF_TIME, "plays on in stoppage time")
	assert_true(m.referee.get_clock_text().contains("+"), "clock shows added time")
	# Minimum 1 minute.
	var m2 := start_playing(8)
	m2.referee._stop_acc = 0.0
	m2.referee.clock = FB.HALF_GAME_SECONDS - 0.5
	step_n(m2, 60)
	assert_near(m2.referee.stoppage, 60.0, 0.01, "minimum one minute")


func test_time_scale_from_half_length() -> void:
	var m := make_headless_match(1, -1, 3.0)
	assert_near(m.referee.time_scale, FB.HALF_GAME_SECONDS / 180.0, 0.001)


func test_ball_in_goal_after_indirect_free_kick_is_not_a_goal() -> void:
	var m := start_playing()
	park_players(m)
	var r = m.referee
	r._no_direct_goal = true
	r._nd_taker = outfield(m.teams[0], 0)
	put_ball(m, Vector2(51.0, 0.0), Vector2(30.0, 0.0), 0.3, 0, r._nd_taker)
	step_n(m, 8)
	assert_eq(m.teams[0].score, 0, "no direct goal from indirect free kick")
	assert_eq(r.restart.type, FB.Restart.GOAL_KICK)
