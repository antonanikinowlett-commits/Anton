extends TestCase
## Touch controls: synthetic multitouch through handle_touch / handle_drag.

const TOUCH := InputController.Source.TOUCH
var _saved: Dictionary = {}


func before_each() -> void:
	for k in ["button_scale", "button_opacity", "left_handed", "custom_button_positions", "control_scheme"]:
		_saved[k] = GameSettings.get(k)
	GameSettings.button_scale = 1.0
	GameSettings.button_opacity = 0.6
	GameSettings.left_handed = false
	GameSettings.custom_button_positions = {}
	GameSettings.control_scheme = FB.ControlScheme.PRO
	UiSafe.override_rect = Rect2()


func after_each() -> void:
	for k: String in _saved.keys():
		GameSettings.set_value(k, _saved[k])
	UiSafe.override_rect = Rect2()


func _make(ctx: int = FB.Context.HAS_BALL) -> Array:
	var m := make_headless_match(11, 0)
	var tc: Control = load("res://ui/touch/touch_controls.tscn").instantiate()
	root.add_child(tc)
	tc.call("bind", m)
	m.human_input.set_context(ctx)
	return [m, tc]


func _center(tc: Control, slot: int) -> Vector2:
	return tc.call("get_button_info", slot)["center"]


func test_joystick_floats_and_outputs_vector() -> void:
	var a := _make()
	var m: FootballMatch = a[0]
	var tc: Control = a[1]
	tc.call("handle_touch", 0, true, Vector2(200, 400))
	assert_true(tc.call("is_joystick_active"), "joystick started")
	tc.call("handle_drag", 0, Vector2(270, 400))
	assert_near(m.human_input.get_move_vector().x, 1.0, 0.01, "full right")
	tc.call("handle_drag", 0, Vector2(235, 400))
	# PHYSICS shapes the stick with a response curve (finer control near centre): half
	# deflection must be a clearly smaller, but non-zero, output.
	var half := m.human_input.get_move_vector().x
	assert_true(half > 0.15 and half < 0.5, "half deflection is shaped (got %f)" % half)
	tc.call("handle_touch", 0, false, Vector2(235, 400))
	assert_eq(m.human_input.get_move_vector(), Vector2.ZERO, "released")
	assert_false(tc.call("is_joystick_active"))


func test_joystick_zone_is_left_45_percent_and_mirrors() -> void:
	var a := _make()
	var tc: Control = a[1]
	tc.call("handle_touch", 3, true, Vector2(900, 300))
	assert_false(tc.call("is_joystick_active"), "right side does not start the stick")
	tc.call("handle_touch", 3, false, Vector2(900, 300))
	GameSettings.set_value("left_handed", true)
	tc.call("handle_touch", 4, true, Vector2(900, 300))
	assert_true(tc.call("is_joystick_active"), "left-handed stick on the right")
	tc.call("handle_touch", 4, false, Vector2(900, 300))
	tc.call("handle_touch", 5, true, Vector2(100, 300))
	assert_false(tc.call("is_joystick_active"), "left side is buttons when left-handed")


func test_multitouch_joystick_plus_three_buttons() -> void:
	var a := _make()
	var m: FootballMatch = a[0]
	var tc: Control = a[1]
	var ic: InputController = m.human_input
	tc.call("handle_touch", 0, true, Vector2(200, 450))
	tc.call("handle_drag", 0, Vector2(260, 450))
	tc.call("handle_touch", 1, true, _center(tc, FB.Slot.PRIMARY))
	tc.call("handle_touch", 2, true, _center(tc, FB.Slot.SPRINT))
	tc.call("handle_touch", 3, true, _center(tc, FB.Slot.TERTIARY))
	assert_true(ic.is_held(FB.Action.PASS), "pass")
	assert_true(ic.is_held(FB.Action.SPRINT), "sprint")
	assert_true(ic.is_held(FB.Action.SHOOT), "shoot")
	assert_true(ic.get_move_vector().length() > 0.5, "still moving")
	# Release order: sprint, joystick, pass, shoot.
	tc.call("handle_touch", 2, false, _center(tc, FB.Slot.SPRINT))
	assert_false(ic.is_held(FB.Action.SPRINT), "sprint up")
	assert_true(ic.is_held(FB.Action.PASS) and ic.is_held(FB.Action.SHOOT), "others held")
	tc.call("handle_touch", 0, false, Vector2(260, 450))
	assert_eq(ic.get_move_vector(), Vector2.ZERO, "stick up")
	assert_true(ic.is_held(FB.Action.PASS), "pass still held after stick up")
	tc.call("handle_touch", 1, false, _center(tc, FB.Slot.PRIMARY))
	assert_false(ic.is_held(FB.Action.PASS))
	assert_true(ic.is_held(FB.Action.SHOOT))
	tc.call("handle_touch", 3, false, _center(tc, FB.Slot.TERTIARY))
	assert_false(ic.is_held(FB.Action.SHOOT))


func test_finger_on_button_never_steers_joystick() -> void:
	var a := _make()
	var m: FootballMatch = a[0]
	var tc: Control = a[1]
	var c := _center(tc, FB.Slot.PRIMARY)
	tc.call("handle_touch", 7, true, c)
	# Drag far into the joystick zone: button released, finger stays dead.
	tc.call("handle_drag", 7, Vector2(150, 400))
	assert_false(m.human_input.is_held(FB.Action.PASS), "slid off -> released")
	assert_eq(m.human_input.get_move_vector(), Vector2.ZERO, "no steering")
	assert_false(tc.call("is_joystick_active"))
	tc.call("handle_drag", 7, c)
	assert_false(m.human_input.is_held(FB.Action.PASS), "does not re-press by sliding back")
	tc.call("handle_touch", 7, false, c)


func test_second_finger_cannot_double_press_or_steal_stick() -> void:
	var a := _make()
	var tc: Control = a[1]
	tc.call("handle_touch", 0, true, Vector2(200, 400))
	tc.call("handle_touch", 1, true, Vector2(250, 420))
	assert_eq(tc.call("finger_kind", 1), 0, "second finger in joystick zone is dead")


func test_context_swap_relayout_and_hidden_buttons() -> void:
	var a := _make(FB.Context.HAS_BALL)
	var m: FootballMatch = a[0]
	var tc: Control = a[1]
	assert_eq(tc.call("get_button_info", FB.Slot.SECONDARY)["label"], "THROUGH")
	m.human_input.set_context(FB.Context.DEFENDING)
	assert_eq(tc.call("get_button_info", FB.Slot.PRIMARY)["label"], "TACKLE")
	m.human_input.set_context(FB.Context.SET_PIECE)
	assert_true(tc.call("get_button_info", FB.Slot.PRIMARY)["shown"], "OK shown")
	assert_false(tc.call("get_button_info", FB.Slot.TERTIARY)["shown"], "tertiary hidden in set piece")
	# Hidden buttons are not hit-testable.
	tc.call("handle_touch", 1, true, _center(tc, FB.Slot.TERTIARY))
	assert_false(m.human_input.is_held(FB.Action.SHOOT))
	GameSettings.set_value("control_scheme", FB.ControlScheme.SIMPLE)
	m.human_input.set_context(FB.Context.HAS_BALL)
	assert_false(tc.call("get_button_info", FB.Slot.SECONDARY)["shown"], "simple hides through ball")


func test_context_change_mid_hold_releases_correct_action() -> void:
	var a := _make(FB.Context.HAS_BALL)
	var m: FootballMatch = a[0]
	var tc: Control = a[1]
	tc.call("handle_touch", 1, true, _center(tc, FB.Slot.TERTIARY))
	assert_true(m.human_input.is_held(FB.Action.SHOOT))
	m.human_input.set_context(FB.Context.DEFENDING)
	tc.call("handle_touch", 1, false, _center(tc, FB.Slot.TERTIARY))
	assert_false(m.human_input.is_held(FB.Action.SHOOT), "shoot released")
	assert_false(m.human_input.is_held(FB.Action.SWITCH_PLAYER), "no phantom switch")


func test_set_piece_aim_and_curve() -> void:
	var a := _make(FB.Context.SET_PIECE)
	var m: FootballMatch = a[0]
	var tc: Control = a[1]
	var ic: InputController = m.human_input
	tc.call("handle_touch", 0, true, Vector2(300, 300))
	tc.call("handle_drag", 0, Vector2(300 + 75, 300))
	assert_near(ic.get_aim_vector().x, 0.5, 0.01, "aim direction & power")
	tc.call("handle_touch", 0, false, Vector2(375, 300))
	assert_near(ic.get_aim_vector().x, 0.5, 0.01, "aim persists for the OK press")
	var cr: Rect2 = tc.get("curve_rect")
	tc.call("handle_touch", 1, true, cr.get_center())
	tc.call("handle_drag", 1, cr.get_center() + Vector2(cr.size.x * 0.5, 0))
	assert_near(ic.get_curve_input(), 1.0, 0.01, "curve full right")
	tc.call("handle_touch", 1, false, cr.get_center())
	# Button in set piece still works and aim finger is separate.
	tc.call("handle_touch", 2, true, _center(tc, FB.Slot.PRIMARY))
	assert_true(ic.is_held(FB.Action.SP_CONFIRM))
	tc.call("handle_touch", 2, false, _center(tc, FB.Slot.PRIMARY))
	# Leaving the set piece clears aim/curve.
	ic.set_context(FB.Context.HAS_BALL)
	assert_eq(ic.get_curve_input(), 0.0)
	assert_eq(ic.get_aim_vector(), Vector2.ZERO)


func test_aim_not_set_outside_set_piece() -> void:
	var a := _make(FB.Context.HAS_BALL)
	var m: FootballMatch = a[0]
	var tc: Control = a[1]
	tc.call("handle_touch", 0, true, Vector2(900, 100))
	tc.call("handle_drag", 0, Vector2(1000, 100))
	assert_eq(m.human_input.get_aim_vector(), Vector2.ZERO)


func test_left_handed_swaps_sides() -> void:
	var a := _make()
	var tc: Control = a[1]
	var right := _center(tc, FB.Slot.PRIMARY)
	assert_true(right.x > 640.0, "buttons on the right")
	GameSettings.set_value("left_handed", true)
	var left := _center(tc, FB.Slot.PRIMARY)
	assert_true(left.x < 640.0, "buttons on the left")
	assert_near(left.x, 1280.0 - right.x, 0.5, "mirrored")


func test_button_scale_and_opacity_apply() -> void:
	var a := _make()
	var tc: Control = a[1]
	var r1: float = tc.call("get_button_info", FB.Slot.SECONDARY)["radius"]
	assert_true(r1 * 2.0 >= 48.0, "at least 48 px")
	GameSettings.set_value("button_scale", 1.5)
	var r2: float = tc.call("get_button_info", FB.Slot.SECONDARY)["radius"]
	assert_near(r2 / r1, 1.5, 0.001, "scale")
	GameSettings.set_value("button_scale", 0.75)
	var r3: float = tc.call("get_button_info", FB.Slot.SECONDARY)["radius"]
	assert_true(r3 * 2.0 >= 48.0, "min size at 0.75")
	GameSettings.set_value("button_opacity", 0.3)
	assert_near(tc.modulate.a, 0.3, 0.001, "opacity")


func test_custom_positions_used() -> void:
	var a := _make()
	var tc: Control = a[1]
	var zone := UiTouchLayout.button_zone(UiSafe.rect(tc), false)
	GameSettings.set_value("custom_button_positions", {FB.Slot.PRIMARY: Vector2(0.5, 0.5)})
	var c := _center(tc, FB.Slot.PRIMARY)
	assert_near(c.x, zone.get_center().x, 1.0)
	assert_near(c.y, zone.get_center().y, 1.0)
	GameSettings.set_value("custom_button_positions", {})
	assert_true(_center(tc, FB.Slot.PRIMARY).distance_to(c) > 10.0, "reset restores default")


func test_buttons_inside_simulated_notch_safe_area() -> void:
	var a := _make()
	var tc: Control = a[1]
	var notch := Rect2(100, 20, 1080, 660)
	UiSafe.override_rect = notch
	tc.call("relayout")
	for slot in FB.SLOT_COUNT:
		var info: Dictionary = tc.call("get_button_info", slot)
		var c: Vector2 = info["center"]
		var r: float = info["radius"]
		assert_true(notch.grow(0.5).encloses(Rect2(c - Vector2(r, r), Vector2(r, r) * 2.0)), "slot %d inside safe area" % slot)
	var pc: Vector2 = tc.get("pause_center")
	assert_true(notch.has_point(pc), "pause inside safe area")
	# Joystick zone is inside too.
	var jz: Rect2 = tc.get("joystick_zone")
	assert_true(jz.position.x >= notch.position.x - 0.5)


func test_pause_button_pauses_match() -> void:
	var a := _make()
	var m: FootballMatch = a[0]
	var tc: Control = a[1]
	var pc: Vector2 = tc.get("pause_center")
	tc.call("handle_touch", 9, true, pc)
	assert_false(m.paused, "pauses on release")
	tc.call("handle_touch", 9, false, pc)
	assert_true(m.paused)


func test_hold_button_exposes_charge() -> void:
	var a := _make()
	var m: FootballMatch = a[0]
	var tc: Control = a[1]
	tc.call("handle_touch", 1, true, _center(tc, FB.Slot.TERTIARY))
	assert_true(m.human_input.get_charge(FB.Action.SHOOT, 1.0) >= 0.0)
	assert_true(ControlLayouts.is_hold_action(tc.call("get_button_info", FB.Slot.TERTIARY)["action"]))
	tc.call("handle_touch", 1, false, _center(tc, FB.Slot.TERTIARY))
