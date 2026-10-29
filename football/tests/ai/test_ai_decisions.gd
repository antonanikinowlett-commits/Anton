extends AiScenario
## Per-player decision tests: passing, shooting, offside awareness, tackling, set pieces,
## state locks and difficulty scaling.

const PASS_KINDS := [
	FB.IntentAction.PASS, FB.IntentAction.THROUGH_PASS, FB.IntentAction.LOB_PASS, FB.IntentAction.CROSS,
]


func _open_play_setup(diff: int) -> Dictionary:
	var m := make_scene(11, diff)
	var t0 := m.teams[0]
	var t1 := m.teams[1]
	var carrier := outfield(t0, 5)
	var open_fwd := outfield(t0, 8)
	var covered := outfield(t0, 9)
	var back := outfield(t0, 3)
	var marker := outfield(t1, 0)
	place(carrier, 0.0, 0.0)
	carrier.facing = Vector2.RIGHT
	place(open_fwd, 16.0, -2.0)
	place(covered, 16.0, 6.0)
	place(marker, 16.6, 6.4)
	place(back, -14.0, 0.0)
	give_ball(m, carrier)
	return {"m": m, "carrier": carrier, "open": open_fwd, "covered": covered, "back": back}


func test_pass_prefers_open_forward_teammate() -> void:
	var s := _open_play_setup(FB.Difficulty.HARD)
	var carrier: Player = s["carrier"]
	var br := carrier.ai_brain
	br._ball_time = 1.0
	br.think(0.1)
	assert_true(br._pend_action in PASS_KINDS, "expected a pass, got action %d" % br._pend_action)
	assert_true(br._pend_player == s["open"], "should pick the open forward, not covered/back")


func test_pass_avoids_offside_receiver() -> void:
	var s := _open_play_setup(FB.Difficulty.HARD)
	var m: FootballMatch = s["m"]
	var carrier: Player = s["carrier"]
	var covered: Player = s["covered"]
	# Put a wide-open teammate far beyond the last defender (offside) and drag the others back.
	var off := outfield(m.teams[0], 7)
	place(off, 46.0, -10.0)
	place(s["open"], -2.0, 12.0)
	var br := carrier.ai_brain
	br._ball_time = 1.0
	br.think(0.1)
	assert_true(br._pend_player != off, "must not pass to an offside teammate")
	assert_true(covered != null)


func test_shoots_in_range_not_from_distance() -> void:
	var m := make_scene(12)
	var fwd := outfield(m.teams[0], 9)
	place(fwd, 40.0, 2.0)
	fwd.facing = Vector2.RIGHT
	give_ball(m, fwd)
	var br := fwd.ai_brain
	br._ball_time = 1.0
	br.think(0.1)
	assert_eq(br._pend_action, FB.IntentAction.SHOOT, "shoot from 12 m with open goal")
	assert_true(absf(br._pend_target.y) <= FB.GOAL_WIDTH * 0.5, "aimed inside the posts")
	assert_near(br._pend_target.x, FB.HALF_LENGTH, 0.01)
	# From own half: no shot.
	place(fwd, -20.0, 0.0)
	give_ball(m, fwd)
	br._pend_action = FB.IntentAction.NONE
	br._ball_time = 1.0
	br.think(0.1)
	assert_true(br._pend_action != FB.IntentAction.SHOOT, "no shot from own half")


func test_shot_blocked_prefers_other_option() -> void:
	var m := make_scene(13)
	var fwd := outfield(m.teams[0], 9)
	place(fwd, 28.0, 0.0)
	give_ball(m, fwd)
	# Wall of defenders in the shooting lane.
	for i in 3:
		place(outfield(m.teams[1], i), 31.0 + float(i), 0.5 * float(i))
	var mate := outfield(m.teams[0], 8)
	place(mate, 38.0, 10.0)
	var br := fwd.ai_brain
	br._ball_time = 1.0
	br.think(0.1)
	assert_true(br._pend_action != FB.IntentAction.SHOOT, "do not shoot into a wall of defenders")


func test_clears_under_pressure_in_own_third() -> void:
	var m := make_scene(14)
	var d := outfield(m.teams[0], 1)
	place(d, -42.0, 3.0)
	d.facing = Vector2.RIGHT
	give_ball(m, d)
	place(outfield(m.teams[1], 0), -40.5, 3.5)
	place(outfield(m.teams[1], 1), -40.5, 1.0)
	var br := d.ai_brain
	br._ball_time = 1.0
	br.think(0.1)
	assert_true(br._pend_action == FB.IntentAction.CLEAR or br._pend_action in PASS_KINDS,
		"expected clearance or safe pass, got %d" % br._pend_action)
	assert_true(br._pend_action != FB.IntentAction.SHOOT)


func test_reaction_time_gates_decision() -> void:
	var s := _open_play_setup(FB.Difficulty.EASY)
	var carrier: Player = s["carrier"]
	var br := carrier.ai_brain
	br._ball_time = 0.0
	br.think(0.1)
	assert_eq(br._pend_action, FB.IntentAction.NONE, "no decision before reaction time elapsed")


func test_difficulty_scaling_params() -> void:
	assert_true(AiParams.react_time(0) > AiParams.react_time(1))
	assert_true(AiParams.react_time(1) > AiParams.react_time(2))
	assert_true(AiParams.noise(0) > AiParams.noise(1) and AiParams.noise(1) > AiParams.noise(2))
	assert_true(AiParams.aim_error(0) > AiParams.aim_error(2))
	assert_true(AiParams.press_factor(2) > AiParams.press_factor(0))
	assert_true(AiParams.stamina_floor(2) > AiParams.stamina_floor(0))
	assert_true(AiParams.gk_react(0) > AiParams.gk_react(2))


func test_difficulty_scales_time_to_act() -> void:
	var times: Array[float] = []
	for diff in [FB.Difficulty.EASY, FB.Difficulty.MEDIUM, FB.Difficulty.HARD]:
		var s := _open_play_setup(diff)
		var m: FootballMatch = s["m"]
		var carrier: Player = s["carrier"]
		var acted := -1.0
		for i in 120:
			if i % FB.AI_STAGGER_GROUPS == 0:
				carrier.ai_brain.think(0.1)
			carrier.ai_brain.act(FB.TICK_DT)
			if carrier.intent.action != FB.IntentAction.NONE:
				acted = float(i) / 60.0
				break
		times.append(acted)
		assert_true(m != null)
	assert_true(times[0] > 0.0 and times[1] > 0.0 and times[2] >= 0.0, "all difficulties eventually act: %s" % str(times))
	assert_true(times[0] > times[2], "EASY reacts slower than HARD: %s" % str(times))


func test_pass_aim_error_grows_on_easy() -> void:
	var err: Array[float] = []
	for diff in [FB.Difficulty.EASY, FB.Difficulty.HARD]:
		var total := 0.0
		for seed_i in 12:
			var s := _open_play_setup(diff)
			var m: FootballMatch = s["m"]
			m.rng.seed = 100 + seed_i
			var carrier: Player = s["carrier"]
			var br := carrier.ai_brain
			br._ball_time = 1.0
			br.think(0.1)
			if br._pend_player != null:
				total += br._pend_target.distance_to(br._pend_player.pos + br._pend_player.vel * 0.0)
		err.append(total)
	assert_true(err[0] > err[1], "EASY passes are less accurate (%s)" % str(err))


func test_tackles_when_close_slides_sparingly() -> void:
	var m := make_scene(15)
	var carrier := outfield(m.teams[0], 5)
	var presser := outfield(m.teams[1], 0)
	place(carrier, 0.0, 0.0)
	carrier.facing = Vector2.RIGHT
	give_ball(m, carrier)
	place(presser, 1.0, 0.0)
	presser.facing = Vector2.LEFT
	var tackles := 0
	var slides := 0
	var br := presser.ai_brain
	for i in 200:
		presser.team.team_brain.think(0.1)
		br._tackle_cd = 0.0
		br.think(0.1)
		if br._pend_action == FB.IntentAction.TACKLE:
			tackles += 1
		elif br._pend_action == FB.IntentAction.SLIDE:
			slides += 1
		br._pend_action = FB.IntentAction.NONE
	assert_true(tackles > 5, "should tackle at close range (%d)" % tackles)
	assert_eq(slides, 0, "no slides when standing tackle is available")
	# From behind a jogging carrier far from goal: no slides either.
	place(presser, -2.5, 0.0)
	carrier.vel = Vector2(6.0, 0.0)
	var behind_slides := 0
	for i in 200:
		presser.team.team_brain.think(0.1)
		br._tackle_cd = 0.0
		br.think(0.1)
		if br._pend_action == FB.IntentAction.SLIDE:
			behind_slides += 1
		br._pend_action = FB.IntentAction.NONE
	assert_eq(behind_slides, 0, "never slide from behind")


func test_presser_closes_down_carrier() -> void:
	var m := make_scene(16)
	var carrier := outfield(m.teams[0], 5)
	var presser := outfield(m.teams[1], 0)
	place(carrier, 0.0, 0.0)
	give_ball(m, carrier)
	place(presser, 12.0, 0.0)
	presser.team.team_brain.think(0.1)
	assert_true(presser.team.team_brain.chaser == presser, "closest defender chases")
	presser.ai_brain.think(0.1)
	presser.ai_brain.act(FB.TICK_DT)
	assert_true(presser.intent.move.x < -0.3, "moves towards the carrier")


func test_attacker_stays_onside() -> void:
	var m := make_scene(17)
	var t0 := m.teams[0]
	var t1 := m.teams[1]
	var carrier := outfield(t0, 5)
	var striker := outfield(t0, 9)
	place(carrier, 5.0, 0.0)
	give_ball(m, carrier)
	# Two deepest opponents: GK at 50.5 and a centre back at 30.
	var cb := outfield(t1, 0)
	place(cb, 30.0, 0.0)
	for i in range(1, 10):
		place(outfield(t1, i), 10.0, -30.0 + 6.0 * float(i))
	place(striker, 20.0, 8.0)
	striker.home_position = Vector2(46.0, 8.0)
	striker.ai_brain.think(0.1)
	assert_true(striker.ai_brain._target.x <= 30.0 - 0.5 + 0.01,
		"run target %f must stay behind the second-last defender (x=30)" % striker.ai_brain._target.x)
	# With no defender covering, a forward hovers on the line rather than far beyond it.
	assert_true(striker.ai_brain._target.x > 28.0, "hovers on the offside line, not deep")


func test_set_piece_positions_and_no_touch() -> void:
	var m := make_scene(18)
	var p := outfield(m.teams[0], 4)
	var r := m.referee
	r.restart.reset()
	r.restart.type = FB.Restart.CORNER
	r.restart.team_id = 1
	r.restart.position = Vector2(52.0, 33.0)
	r.restart.taker = outfield(m.teams[1], 6)
	r.set_phase(FB.MatchPhase.SET_PIECE)
	assert_true(r.is_set_piece_pending())
	place(p, 40.0, 20.0)
	p.home_position = Vector2(30.0, 5.0)
	m.ball.pos = Vector2(40.2, 20.0)
	p.ai_brain.think(0.1)
	var expect := p.team.shape.get_set_piece_position(p, r.restart)
	assert_true(p.ai_brain._target.distance_to(expect) < 0.01, "goes to the shape's set-piece position")
	for i in 30:
		p.ai_brain.act(FB.TICK_DT)
	assert_eq(p.intent.action, FB.IntentAction.NONE, "does not touch the ball during set piece")


func test_locked_states_do_nothing() -> void:
	var s := _open_play_setup(FB.Difficulty.HARD)
	var carrier: Player = s["carrier"]
	carrier.state = FB.PlayerState.FALLEN
	var br := carrier.ai_brain
	br._ball_time = 1.0
	br.think(0.1)
	br.act(FB.TICK_DT)
	assert_eq(carrier.intent.action, FB.IntentAction.NONE)
	assert_eq(carrier.intent.move, Vector2.ZERO)
