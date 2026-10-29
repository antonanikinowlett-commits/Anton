extends "res://tests/physics/phys_scenario.gd"
## TouchInputController shaping and HumanBrain input -> intent (through the InputController API only).

const SRC := InputController.Source

var _highlights: Array = []
var _saved_assist := 0.6


func before_each() -> void:
	_saved_assist = GameSettings.aim_assist
	GameSettings.aim_assist = 0.6


func after_each() -> void:
	GameSettings.aim_assist = _saved_assist


func _on_highlight(p: Player) -> void:
	_highlights.append(p)


## Scene with a human home team; returns the controlled player standing on the ball at (0,0).
func _human_scene(seed_value: int = 71) -> FootballMatch:
	var m := make_scene(seed_value, 0)
	var cp := m.human_team.controlled_player
	cp.teleport(Vector2(0.0, 0.0), Vector2.RIGHT)
	m.ball.set_carrier(cp)
	m.ball.pos = Vector2(0.7, 0.0)
	m.human_input.set_context(FB.Context.HAS_BALL)
	return m


func _act(m: FootballMatch) -> PlayerIntent:
	var cp := m.human_team.controlled_player
	cp.brain.act(FB.TICK_DT)
	return cp.intent


# --- TouchInputController ----------------------------------------------------------------------
func test_controller_slot_is_touch_implementation() -> void:
	assert_true(Factory.is_implemented("input_controller"), "slot file exists")
	var m := make_scene(70, 0)
	assert_true(m.human_input is InputController, "is an InputController")
	assert_true(m.human_input.get_script().resource_path.ends_with("touch_input_controller.gd"), "touch impl in use")


func test_dead_zone() -> void:
	var ic: InputController = load("res://physics/touch_input_controller.gd").new()
	ic.set_move_vector(SRC.TOUCH, Vector2(0.1, 0.0))
	assert_eq(ic.get_move_vector(), Vector2.ZERO, "inside the 0.12 dead zone")
	ic.set_move_vector(SRC.TOUCH, Vector2(0.0, -0.11))
	assert_eq(ic.get_move_vector(), Vector2.ZERO, "inside the dead zone (y)")
	ic.set_move_vector(SRC.TOUCH, Vector2(0.2, 0.0))
	var v := ic.get_move_vector()
	assert_true(v.x > 0.0 and v.x < 0.2, "small deflection is attenuated (%f)" % v.x)
	ic.free()


func test_response_curve_monotonic_and_reaches_one() -> void:
	var ic: InputController = load("res://physics/touch_input_controller.gd").new()
	var prev := 0.0
	for i in range(1, 21):
		var raw := float(i) / 20.0
		ic.set_move_vector(SRC.TOUCH, Vector2(raw, 0.0))
		ic.end_tick()
		ic.end_tick()
		var out := ic.get_move_vector().length()
		assert_true(out >= prev - 0.0001, "monotonic at %f" % raw)
		assert_true(out <= 1.0001, "never above 1")
		prev = out
	assert_near(prev, 1.0, 0.001, "full push = full speed")
	ic.free()


func test_direction_preserved_by_shaping() -> void:
	var ic: InputController = load("res://physics/touch_input_controller.gd").new()
	var raw := Vector2(0.6, -0.4)
	ic.set_move_vector(SRC.TOUCH, raw)
	var out := ic.get_move_vector()
	assert_near(out.normalized().dot(raw.normalized()), 1.0, 0.0001, "direction")
	ic.free()


func test_smoothing_is_light_and_idempotent_per_tick() -> void:
	var ic: InputController = load("res://physics/touch_input_controller.gd").new()
	ic.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	var first := ic.get_move_vector()
	assert_near(first.length(), 1.0, 0.001, "onset is instant")
	ic.end_tick()
	ic.set_move_vector(SRC.TOUCH, Vector2(0.5, 0.0))
	var a := ic.get_move_vector()
	var b := ic.get_move_vector()
	assert_eq(a, b, "same tick, same value")
	assert_true(a.x < first.x and a.x > ic.shape(Vector2(0.5, 0.0)).x, "eases toward the new value (%f)" % a.x)
	ic.end_tick()
	ic.set_move_vector(SRC.TOUCH, Vector2.ZERO)
	assert_eq(ic.get_move_vector(), Vector2.ZERO, "release stops instantly")
	ic.free()


func test_sharp_turn_not_smoothed() -> void:
	var ic: InputController = load("res://physics/touch_input_controller.gd").new()
	ic.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	ic.get_move_vector()
	ic.end_tick()
	ic.set_move_vector(SRC.TOUCH, Vector2(-1.0, 0.0))
	assert_true(ic.get_move_vector().x < -0.95, "reversal is immediate")
	ic.free()


func test_strongest_source_wins() -> void:
	var ic: InputController = load("res://physics/touch_input_controller.gd").new()
	ic.set_move_vector(SRC.DEVICE, Vector2(0.3, 0.0))
	ic.set_move_vector(SRC.TOUCH, Vector2(0.0, 1.0))
	assert_true(ic.get_move_vector().y > 0.9, "touch stick dominates")
	ic.free()


func test_sub_frame_tap_not_dropped() -> void:
	var ic: InputController = load("res://physics/touch_input_controller.gd").new()
	ic.set_context(FB.Context.HAS_BALL)
	ic.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	ic.release_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	assert_false(ic.is_held(FB.Action.PASS), "already released")
	assert_true(ic.consume_press(FB.Action.PASS), "press edge kept")
	ic.press_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	ic.release_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	assert_true(ic.consume_release(FB.Action.SHOOT) >= 0.0, "release edge kept")
	ic.end_tick()
	assert_false(ic.consume_press(FB.Action.PASS), "edges expire at end_tick")
	ic.free()


# --- HumanBrain: multitouch and actions ------------------------------------------------------------
func test_stick_and_sprint_become_movement_intent() -> void:
	var m := _human_scene()
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(0.0, 1.0))
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.SPRINT)
	var it := _act(m)
	assert_true(it.move.y > 0.9 and absf(it.move.x) < 0.01, "stick down")
	assert_true(it.sprint, "sprint held")
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.SPRINT)
	it = _act(m)
	assert_false(it.sprint, "sprint released")


func test_multitouch_stick_plus_buttons_same_frame() -> void:
	var m := _human_scene()
	var cp := m.human_team.controlled_player
	var mate := outfield(m, 0, 4)
	mate.teleport(Vector2(14.0, 0.0), Vector2.LEFT)
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.SPRINT)
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	var it := _act(m)
	assert_true(it.move.x > 0.9, "movement with stick")
	assert_true(it.sprint, "sprint at the same time")
	assert_eq(it.action, FB.IntentAction.PASS, "pass at the same time")
	assert_true(it.target_player == mate, "aimed at the mate in the stick direction")
	assert_true(cp.has_ball(), "still has the ball before the motor runs")


func test_tap_pass_shorter_than_a_frame_still_passes() -> void:
	var m := _human_scene()
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.PASS, "sub-frame tap produced a pass")


func test_sub_frame_shoot_tap_fires_weak_shot() -> void:
	var m := _human_scene()
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.SHOOT, "shot fired")
	assert_true(it.power >= 0.25 and it.power < 0.4, "tap = weak shot (%f)" % it.power)


func test_shot_power_follows_charge_time() -> void:
	var m := _human_scene()
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	OS.delay_msec(550)
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.NONE, "nothing fires while still charging")
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	it = _act(m)
	assert_eq(it.action, FB.IntentAction.SHOOT, "release fires")
	assert_true(it.power > 0.45 and it.power < 0.8, "half-second charge (%f)" % it.power)


func test_long_pass_tap_is_through_ball_hold_is_lob() -> void:
	var m := _human_scene()
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.SECONDARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.SECONDARY)
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.THROUGH_PASS, "tap = through ball")
	it.clear_action()
	m.human_input.end_tick()
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.SECONDARY)
	OS.delay_msec(380)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.SECONDARY)
	it = _act(m)
	assert_true(it.action == FB.IntentAction.LOB_PASS or it.action == FB.IntentAction.CROSS, "hold = lofted ball")
	assert_true(it.loft > 0.2, "has loft")


func test_pass_aim_assist_snaps_to_mate_in_cone() -> void:
	var m := _human_scene()
	var near_line := outfield(m, 0, 4)
	var off_line := outfield(m, 0, 5)
	near_line.teleport(Vector2(15.0, 3.0), Vector2.LEFT)
	off_line.teleport(Vector2(15.0, -14.0), Vector2.LEFT)
	GameSettings.aim_assist = 1.0
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	var it := _act(m)
	assert_true(it.target_player == near_line, "picks the mate in the cone")
	var to_mate := (near_line.pos - m.human_team.controlled_player.pos).normalized()
	var to_pt := (it.target_point - m.human_team.controlled_player.pos).normalized()
	assert_true(to_mate.dot(to_pt) > 0.995, "full assist points at the mate")


func test_pass_without_assist_goes_exactly_where_stick_points() -> void:
	var m := _human_scene()
	var mate := outfield(m, 0, 4)
	mate.teleport(Vector2(15.0, 3.0), Vector2.LEFT)
	GameSettings.aim_assist = 0.0
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	var it := _act(m)
	var to_pt := (it.target_point - m.human_team.controlled_player.pos).normalized()
	if it.target_player != null:
		assert_true(to_pt.dot(Vector2.RIGHT) > 0.97, "no snapping at 0 assist")
	else:
		assert_true(to_pt.dot(Vector2.RIGHT) > 0.999, "pure stick direction")


func test_simple_scheme_assists_more_than_pro() -> void:
	var m := _human_scene()
	var mate := outfield(m, 0, 4)
	mate.teleport(Vector2(15.0, 9.0), Vector2.LEFT)
	GameSettings.aim_assist = 0.0
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	m.human_input.set_scheme(FB.ControlScheme.PRO)
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	var pro := _act(m)
	var pro_target := pro.target_player
	pro.clear_action()
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	m.human_input.end_tick()
	m.human_input.set_scheme(FB.ControlScheme.SIMPLE)
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	var simple := _act(m)
	assert_true(pro_target == null, "pro with zero assist ignores a mate 31 degrees off")
	assert_true(simple.target_player == mate, "simple scheme still finds him")


func test_pass_target_highlight_signal() -> void:
	var m := _human_scene()
	var mate := outfield(m, 0, 4)
	mate.teleport(Vector2(16.0, 1.0), Vector2.LEFT)
	_highlights.clear()
	EventBus.pass_target_highlighted.connect(_on_highlight)
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	var cp := m.human_team.controlled_player
	cp.brain.think(0.1)
	cp.brain.think(0.1)
	assert_eq(_highlights.size(), 1, "emitted once on change")
	assert_true(_highlights[0] == mate, "highlights the aimed mate")
	m.ball.set_carrier(null)
	cp.brain.think(0.1)
	EventBus.pass_target_highlighted.disconnect(_on_highlight)
	assert_eq(_highlights.size(), 2, "cleared when the ball is lost")
	assert_true(_highlights[1] == null, "null clears")


func test_shot_assist_snaps_toward_goal() -> void:
	var m := _human_scene()
	var cp := m.human_team.controlled_player
	cp.teleport(Vector2(30.0, 0.0), Vector2.RIGHT)
	GameSettings.aim_assist = 1.0
	var off := Vector2.from_angle(deg_to_rad(18.0))
	m.human_input.set_move_vector(SRC.TOUCH, off)
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.SHOOT, "shot")
	var dir := (it.target_point - cp.pos).normalized()
	var hit_y := cp.pos.y + dir.y / dir.x * (FB.HALF_LENGTH - cp.pos.x)
	assert_true(absf(hit_y) < FB.GOAL_WIDTH * 0.5, "assist drags the shot into the goal mouth (y=%f)" % hit_y)
	GameSettings.aim_assist = 0.0
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	it = _act(m)
	dir = (it.target_point - cp.pos).normalized()
	assert_near(dir.angle(), deg_to_rad(18.0), 0.01, "no assist: pure stick direction")


func test_shot_picks_corner_away_from_keeper() -> void:
	var m := _human_scene()
	var cp := m.human_team.controlled_player
	cp.teleport(Vector2(35.0, 0.0), Vector2.RIGHT)
	var gk := m.teams[1].goalkeeper()
	gk.teleport(Vector2(51.5, -1.5))
	GameSettings.aim_assist = 1.0
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	var it := _act(m)
	assert_true(it.target_point.y > cp.pos.y, "keeper on the -y side: shot goes +y")


func test_early_press_is_buffered_until_ball_arrives() -> void:
	var m := _human_scene()
	var cp := m.human_team.controlled_player
	m.ball.set_carrier(null)
	m.ball.pos = Vector2(4.0, 0.0)
	m.ball.vel = Vector2.ZERO
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.NONE, "ball not there yet")
	m.human_input.end_tick()
	m.ball.set_carrier(cp)
	it = _act(m)
	assert_eq(it.action, FB.IntentAction.PASS, "buffered pass fires on arrival")


func test_stale_buffered_press_expires() -> void:
	var m := _human_scene()
	var cp := m.human_team.controlled_player
	m.ball.set_carrier(null)
	m.ball.pos = Vector2(8.0, 0.0)
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	for i in 30:
		_act(m)
		m.human_input.end_tick()
	m.ball.set_carrier(cp)
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.NONE, "old press forgotten")


func test_set_piece_context_leaves_intent_to_rules() -> void:
	var m := _human_scene()
	var cp := m.human_team.controlled_player
	m.human_input.set_context(FB.Context.SET_PIECE)
	cp.intent.set_action(FB.IntentAction.SET_PIECE_KICK, Vector2(30.0, 0.0), 0.6)
	cp.intent.move = Vector2(0.3, 0.3)
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.SET_PIECE_KICK, "action written by rules survives")
	assert_eq(it.move, Vector2(0.3, 0.3), "movement untouched")


func test_defending_tackle_and_slide_intents() -> void:
	var m := _human_scene()
	var cp := m.human_team.controlled_player
	var foe := outfield(m, 1, 3)
	foe.teleport(Vector2(1.5, 0.0), Vector2.LEFT)
	m.ball.set_carrier(foe)
	m.human_input.set_context(FB.Context.DEFENDING)
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.TACKLE, "tackle")
	assert_true(it.target_player == foe, "targets the carrier")
	it.clear_action()
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	m.human_input.end_tick()
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(0.0, 1.0))
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.SECONDARY)
	it = _act(m)
	assert_eq(it.action, FB.IntentAction.SLIDE, "slide")
	assert_true((it.target_point - cp.pos).y > 2.0, "slides in the stick direction")


func test_switch_player() -> void:
	var m := _human_scene()
	var cp := m.human_team.controlled_player
	var mate := outfield(m, 0, 6)
	mate.teleport(Vector2(3.0, 2.0))
	m.human_input.set_context(FB.Context.DEFENDING)
	m.ball.set_carrier(null)
	m.ball.pos = Vector2(4.0, 2.0)
	m.human_input.press_action(FB.Action.SWITCH_PLAYER)
	cp.brain.act(FB.TICK_DT)
	assert_true(m.human_team.controlled_player != cp, "control moved")
	assert_false(cp.is_human, "old player is released to AI")
	assert_true(m.human_team.controlled_player.is_human, "new player is human controlled")


func test_press_assists_chase() -> void:
	var m := _human_scene()
	var foe := outfield(m, 1, 3)
	foe.teleport(Vector2(10.0, 4.0), Vector2.LEFT)
	m.ball.set_carrier(foe)
	m.human_input.set_context(FB.Context.DEFENDING)
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.QUATERNARY)
	var it := _act(m)
	assert_true(it.move.x > 0.5 and it.sprint, "closes down the carrier")


func test_goalkeeper_actions() -> void:
	var m := _human_scene()
	var gk := m.teams[0].goalkeeper()
	gk.teleport(Vector2(-50.0, 0.0), Vector2.RIGHT)
	m.human_team.set_controlled_player(gk)
	m.human_input.set_context(FB.Context.GOALKEEPER)
	m.ball.set_carrier(null)
	m.ball.pos = Vector2(-40.0, 5.0)
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(0.0, 1.0))
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	var it := _act(m)
	assert_eq(it.action, FB.IntentAction.GK_DIVE, "dive")
	assert_true((it.target_point - gk.pos).y > 2.0, "dives where the stick points")
	it.clear_action()
	m.human_input.end_tick()
	# Distribution while holding the ball.
	m.human_input.set_move_vector(SRC.TOUCH, Vector2(1.0, 0.0))
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.TERTIARY)
	var mate := outfield(m, 0, 2)
	mate.teleport(Vector2(-35.0, 0.0), Vector2.LEFT)
	m.ball.set_carrier(gk)
	gk.state = FB.PlayerState.HOLDING_BALL
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	it = _act(m)
	assert_eq(it.action, FB.IntentAction.GK_THROW, "throw")
	assert_true(it.target_player == mate, "to the mate")
	it.clear_action()
	m.human_input.end_tick()
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.SECONDARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.SECONDARY)
	it = _act(m)
	assert_eq(it.action, FB.IntentAction.GK_KICK, "punt")
	assert_true(it.loft > 0.5, "punts are lofted")


func test_end_to_end_pass_through_match_step() -> void:
	# Full tick: input -> brain -> motor -> ball, with real match stepping.
	var m := make_headless_match(77, 0)
	var cp := m.human_team.controlled_player
	var mate := m.human_team.nearest_player_to(cp.pos + Vector2(12.0, 0.0), true, cp)
	m.ball.set_carrier(cp)
	run_ticks(m, 2)
	m.human_input.set_move_vector(SRC.TOUCH, (mate.pos - cp.pos).normalized())
	m.human_input.press_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	m.human_input.release_slot(SRC.TOUCH, FB.Slot.PRIMARY)
	run_ticks(m, 2)
	assert_true(m.ball.owner_player != cp or m.ball.vel.length() > 3.0, "ball left the passer after a sub-frame tap")
