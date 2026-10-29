extends TestCase
## Core skeleton smoke tests: factory slots, data, coordinate mapping, input buffering, stub match.


func test_factory_script_slots_instantiate() -> void:
	for slot in Factory.SCRIPT_SLOTS.keys():
		var obj := Factory.create(slot)
		assert_not_null(obj, "slot %s" % slot)
		if obj is Node:
			(obj as Node).free()


func test_factory_slot_base_types() -> void:
	assert_true(Factory.create("player_motor") is PlayerMotor, "motor")
	assert_true(Factory.create("ai_brain") is PlayerBrain, "ai brain")
	assert_true(Factory.create("human_brain") is PlayerBrain, "human brain")
	assert_true(Factory.create("team_shape") is TeamShape, "shape")
	assert_true(Factory.create("team_brain") is TeamBrain, "team brain")
	assert_true(Factory.create("collision_solver") is CollisionSolver, "collisions")
	for slot in ["ball", "referee", "input_controller", "camera"]:
		var n := Factory.create(slot) as Node
		assert_not_null(n, slot)
		if slot == "ball":
			assert_true(n is Ball, "ball")
		if slot == "referee":
			assert_true(n is Referee, "referee")
		if slot == "input_controller":
			assert_true(n is InputController, "input")
		n.free()


func test_data_loader_teams_have_squads() -> void:
	for id in DataLoader.list_team_ids():
		var t := DataLoader.load_team(id)
		assert_true(t.squad.size() >= 11, "%s squad size" % id)
		assert_eq(t.starting_xi()[0].role, FB.Role.GK, "%s first XI player is GK" % id)
		var f := DataLoader.load_formation(t.tactics.formation_id)
		assert_eq(f.slot_count(), 11, "%s formation slots" % id)
		assert_eq(f.roles[0], FB.Role.GK, "%s slot 0 is GK" % id)


func test_normalized_world_roundtrip() -> void:
	var m := make_headless_match()
	for t: Team in m.teams:
		var w := t.normalized_to_world(Vector2(0.0, 0.5))
		assert_near(w.x, -t.attack_dir * FB.HALF_LENGTH, 0.001, "own goal line x")
		var n := Vector2(0.3, 0.2)
		var back := t.world_to_normalized(t.normalized_to_world(n))
		assert_near(back.x, n.x, 0.0001)
		assert_near(back.y, n.y, 0.0001)
		# Left (y=0) for the attacker facing +x is -y (screen up).
		var left := t.normalized_to_world(Vector2(0.5, 0.0))
		assert_near(left.y, -t.attack_dir * FB.HALF_WIDTH, 0.001, "left touchline")


func test_input_multitouch_buffering() -> void:
	var ic := InputController.new()
	ic.set_context(FB.Context.HAS_BALL)
	# Joystick + pass + sprint at once, from touch; shoot from keyboard.
	ic.set_move_vector(InputController.Source.TOUCH, Vector2(1, 0))
	ic.press_slot(InputController.Source.TOUCH, FB.Slot.PRIMARY)
	ic.press_slot(InputController.Source.TOUCH, FB.Slot.SPRINT)
	ic.press_slot(InputController.Source.DEVICE, FB.Slot.TERTIARY)
	# Tap shorter than a frame: press + release before the tick.
	ic.release_slot(InputController.Source.TOUCH, FB.Slot.PRIMARY)
	assert_near(ic.get_move_vector().x, 1.0)
	assert_true(ic.consume_press(FB.Action.PASS), "pass tap buffered")
	assert_true(ic.consume_release(FB.Action.PASS) >= 0.0, "pass release buffered")
	assert_true(ic.is_held(FB.Action.SPRINT), "sprint held")
	assert_true(ic.is_held(FB.Action.SHOOT), "shoot held")
	# Context changes mid-hold: release must still release SHOOT.
	ic.set_context(FB.Context.DEFENDING)
	ic.release_slot(InputController.Source.DEVICE, FB.Slot.TERTIARY)
	assert_false(ic.is_held(FB.Action.SHOOT), "shoot released after context change")
	assert_false(ic.is_held(FB.Action.SWITCH_PLAYER), "no phantom switch")
	ic.end_tick()
	assert_false(ic.consume_press(FB.Action.PASS), "edges cleared after tick")
	ic.free()


func test_stub_match_runs_two_minutes() -> void:
	var m := make_headless_match(7)
	assert_eq(m.players.size(), 22, "22 players")
	run_ticks(m, 60 * 120)
	assert_true(m.referee.clock > 0.0, "clock advanced")
	for p in m.players:
		assert_false(is_nan(p.pos.x) or is_nan(p.pos.y), "%s position finite" % p.name)
	assert_false(is_nan(m.ball.pos.x), "ball finite")


func test_full_stub_match_finishes() -> void:
	var m := make_headless_match(3, -1, 0.5)
	run_ticks(m, 60 * 150)
	assert_true(m.is_finished, "match reached full time")
	assert_eq(m.referee.phase, FB.MatchPhase.FULL_TIME)


func test_human_side_context() -> void:
	var m := make_headless_match(5, 0)
	run_ticks(m, 120)
	assert_not_null(m.human_input, "human input exists")
	assert_not_null(m.controlled_player(), "controlled player")
	assert_true(m.control_context != FB.Context.NONE, "context resolved")
