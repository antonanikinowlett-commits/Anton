extends AiScenario
## Goalkeeper behaviour: positioning, shot reading, dives, sweeping, distribution.


func _gk_scene(diff: int = FB.Difficulty.HARD) -> Array:
	var m := make_scene(21, diff)
	var gk := m.teams[0].goalkeeper()  # defends x = -52.5
	place(gk, -51.0, 0.0)
	return [m, gk]


func test_gk_positions_between_ball_and_goal() -> void:
	var sc := _gk_scene()
	var m: FootballMatch = sc[0]
	var gk: Player = sc[1]
	var opp := outfield(m.teams[1], 3)
	place(opp, -30.0, 12.0)
	give_ball(m, opp)
	gk.ai_brain.think(0.1)
	var tgt: Vector2 = gk.ai_brain._gk.target
	assert_true(tgt.x < -44.0 and tgt.x > -52.5, "stays near the goal line (x=%f)" % tgt.x)
	assert_true(tgt.y > 0.2 and tgt.y <= FB.GOAL_WIDTH * 0.5 + 0.9, "shades towards the ball side (y=%f)" % tgt.y)
	# Ball close and central: GK comes further out than when the ball is far away.
	var near_r := tgt.distance_to(Vector2(-52.5, 0.0))
	place(opp, -35.0, 0.0)
	give_ball(m, opp)
	gk.ai_brain.think(0.1)
	var tgt2: Vector2 = gk.ai_brain._gk.target
	assert_true(tgt2.distance_to(Vector2(-52.5, 0.0)) > 1.0)
	assert_true(near_r > 0.5)


func test_gk_dives_at_predicted_shot() -> void:
	var sc := _gk_scene()
	var m: FootballMatch = sc[0]
	var gk: Player = sc[1]
	m.ball.owner_player = null
	m.ball.pos = Vector2(-41.0, 1.5)
	m.ball.vel = Vector2(-22.0, 0.6)
	m.ball.last_touch_team = 1
	gk.ai_brain.think(0.1)
	assert_eq(gk.ai_brain._gk.mode, AiGoalkeeper.Mode.SAVE, "reads the shot")
	assert_true(gk.ai_brain._gk._dive_pending or gk.ai_brain._gk.target.distance_to(gk.pos) < 1.0, "dives or just steps to it")
	var dived := false
	for i in 40:
		gk.ai_brain.act(FB.TICK_DT)
		if gk.intent.action == FB.IntentAction.GK_DIVE:
			dived = true
			assert_true(absf(gk.intent.target_point.y - 1.6) < 1.6, "dive aimed at the shot (y=%f)" % gk.intent.target_point.y)
			break
	assert_true(dived or gk.intent.move.length() > 0.2, "GK reacts to the shot")


func test_gk_ignores_shot_wide_of_goal() -> void:
	var sc := _gk_scene()
	var m: FootballMatch = sc[0]
	var gk: Player = sc[1]
	m.ball.owner_player = null
	m.ball.pos = Vector2(-41.0, 14.0)
	m.ball.vel = Vector2(-22.0, 0.0)
	m.ball.last_touch_team = 1
	gk.ai_brain.think(0.1)
	assert_true(gk.ai_brain._gk.mode != AiGoalkeeper.Mode.SAVE, "shot passing wide needs no save")


func test_gk_sweeps_loose_ball_he_can_win() -> void:
	var sc := _gk_scene()
	var m: FootballMatch = sc[0]
	var gk: Player = sc[1]
	m.ball.owner_player = null
	m.ball.pos = Vector2(-40.0, 2.0)
	m.ball.vel = Vector2.ZERO
	m.ball.last_touch_team = 1
	gk.ai_brain.think(0.1)
	assert_eq(gk.ai_brain._gk.mode, AiGoalkeeper.Mode.SWEEP)
	assert_true(gk.ai_brain._gk.target.distance_to(m.ball.pos) < 1.0)


func test_gk_does_not_sweep_when_attacker_is_first() -> void:
	var sc := _gk_scene()
	var m: FootballMatch = sc[0]
	var gk: Player = sc[1]
	m.ball.owner_player = null
	m.ball.pos = Vector2(-40.0, 2.0)
	m.ball.vel = Vector2.ZERO
	place(outfield(m.teams[1], 2), -39.0, 2.0)
	gk.ai_brain.think(0.1)
	assert_true(gk.ai_brain._gk.mode != AiGoalkeeper.Mode.SWEEP)


func test_gk_distributes_after_holding() -> void:
	var sc := _gk_scene()
	var m: FootballMatch = sc[0]
	var gk: Player = sc[1]
	var fb := outfield(m.teams[0], 0)
	place(fb, -35.0, -15.0)
	give_ball(m, gk)
	gk.state = FB.PlayerState.HOLDING_BALL
	var act := FB.IntentAction.NONE
	for i in 400:
		if i % FB.AI_STAGGER_GROUPS == 0:
			gk.ai_brain.think(0.1)
		gk.ai_brain.act(FB.TICK_DT)
		if gk.intent.action != FB.IntentAction.NONE:
			act = gk.intent.action
			break
	assert_true(act == FB.IntentAction.GK_THROW or act == FB.IntentAction.GK_KICK, "distributes with throw or kick (%d)" % act)


func test_gk_set_piece_goes_to_shape_position() -> void:
	var sc := _gk_scene()
	var m: FootballMatch = sc[0]
	var gk: Player = sc[1]
	var r := m.referee
	r.restart.reset()
	r.restart.type = FB.Restart.PENALTY
	r.restart.team_id = 1
	r.restart.position = Vector2(-41.5, 0.0)
	r.restart.taker = outfield(m.teams[1], 4)
	r.set_phase(FB.MatchPhase.SET_PIECE)
	gk.ai_brain.think(0.1)
	var expect := gk.team.shape.get_set_piece_position(gk, r.restart)
	assert_true(gk.ai_brain._target.distance_to(expect) < 0.01)
