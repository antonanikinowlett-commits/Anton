class_name InputBindings
extends RefCounted
## Registers default InputMap actions at runtime (keeps project.godot simple).


static func ensure_defaults() -> void:
	_key(&"fb_move_left", [KEY_A, KEY_LEFT])
	_key(&"fb_move_right", [KEY_D, KEY_RIGHT])
	_key(&"fb_move_up", [KEY_W, KEY_UP])
	_key(&"fb_move_down", [KEY_S, KEY_DOWN])
	_axis(&"fb_move_left", JOY_AXIS_LEFT_X, -1.0)
	_axis(&"fb_move_right", JOY_AXIS_LEFT_X, 1.0)
	_axis(&"fb_move_up", JOY_AXIS_LEFT_Y, -1.0)
	_axis(&"fb_move_down", JOY_AXIS_LEFT_Y, 1.0)
	_key(&"fb_slot_0", [KEY_J, KEY_SPACE])
	_key(&"fb_slot_1", [KEY_K])
	_key(&"fb_slot_2", [KEY_L])
	_key(&"fb_slot_3", [KEY_I])
	_key(&"fb_slot_4", [KEY_SHIFT])
	_key(&"fb_switch", [KEY_Q])
	_key(&"fb_pause", [KEY_ESCAPE, KEY_P])
	_button(&"fb_slot_0", JOY_BUTTON_A)
	_button(&"fb_slot_1", JOY_BUTTON_Y)
	_button(&"fb_slot_2", JOY_BUTTON_B)
	_button(&"fb_slot_3", JOY_BUTTON_X)
	_button(&"fb_slot_4", JOY_BUTTON_RIGHT_SHOULDER)
	_button(&"fb_switch", JOY_BUTTON_LEFT_SHOULDER)
	_button(&"fb_pause", JOY_BUTTON_START)


static func _ensure_action(action: StringName) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action, 0.2)


static func _key(action: StringName, keys: Array) -> void:
	_ensure_action(action)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		if not InputMap.action_has_event(action, ev):
			InputMap.action_add_event(action, ev)


static func _axis(action: StringName, axis: JoyAxis, dir: float) -> void:
	_ensure_action(action)
	var ev := InputEventJoypadMotion.new()
	ev.axis = axis
	ev.axis_value = dir
	if not InputMap.action_has_event(action, ev):
		InputMap.action_add_event(action, ev)


static func _button(action: StringName, button: JoyButton) -> void:
	_ensure_action(action)
	var ev := InputEventJoypadButton.new()
	ev.button_index = button
	if not InputMap.action_has_event(action, ev):
		InputMap.action_add_event(action, ev)
