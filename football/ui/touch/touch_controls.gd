extends Control
## Touch controls (SPEC section 6.4). Handles raw InputEventScreenTouch / ScreenDrag by finger index.
## Every finger belongs to at most one widget: the floating joystick, one button, the pause
## button, or (set pieces only) the aim drag / curve slider. Fingers that land elsewhere or
## slide off a button become "dead" until lifted.
##
## Only the InputController feeding API is used (Source.TOUCH); no gameplay logic here.
## Testable without a display through handle_touch() / handle_drag().

enum Kind { NONE, JOYSTICK, BUTTON, PAUSE, AIM, CURVE }

const TOUCH := InputController.Source.TOUCH
## Pointer may travel this much beyond the button radius before the press is released.
const SLIDE_OFF_FACTOR := 1.25
const HIT_FACTOR := 1.12
const AIM_RADIUS := 150.0
const SLOT_COLORS: Array[Color] = [
	Color("2ee06f"), Color("4aa8ff"), Color("ff6b5a"), Color("f5c542"), Color("b48cff"),
]
const SHOOT_CHARGE_TIME := 1.0

class TouchButton extends RefCounted:
	var slot: int = 0
	var center: Vector2 = Vector2.ZERO
	var radius: float = 50.0
	var action: int = FB.Action.NONE
	var label: String = ""
	var shown: bool = false
	var hold: bool = false
	var finger: int = -1

var football_match: FootballMatch
var human_input: InputController
## Hide even on touch/emulated platforms (also env FB_HIDE_TOUCH=1).
var force_hidden: bool = false

var buttons: Array[TouchButton] = []
var fingers: Dictionary = {}

var joy_finger: int = -1
var joy_origin: Vector2 = Vector2.ZERO
var joy_pos: Vector2 = Vector2.ZERO
var joy_vector: Vector2 = Vector2.ZERO
var aim_finger: int = -1
var aim_origin: Vector2 = Vector2.ZERO
var aim_vector: Vector2 = Vector2.ZERO
var curve_finger: int = -1
var curve_value: float = 0.0
var pause_finger: int = -1
var pause_center: Vector2 = Vector2.ZERO

var safe_rect: Rect2 = Rect2(0, 0, 1280, 720)
var joystick_zone: Rect2 = Rect2()
var curve_rect: Rect2 = Rect2()
var context: int = FB.Context.NONE

var _last_visible: Rect2 = Rect2()
var _last_safe: Rect2 = Rect2()
var _connected := false


func _init() -> void:
	for i in FB.SLOT_COUNT:
		var b := TouchButton.new()
		b.slot = i
		buttons.append(b)


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	process_mode = Node.PROCESS_MODE_ALWAYS
	relayout()


## Binds to a match (uses match.human_input). Safe to call with an AI-vs-AI match.
func bind(m: FootballMatch) -> void:
	football_match = m
	human_input = m.human_input if m != null else null
	_connect_signals()
	visible = should_show() and human_input != null
	relayout()


func _connect_signals() -> void:
	if _connected:
		return
	_connected = true
	EventBus.control_context_changed.connect(_on_context_changed)
	EventBus.match_paused.connect(_on_match_paused)
	GameSettings.changed.connect(_on_settings_changed)
	if human_input != null:
		human_input.context_changed.connect(_on_context_changed)


func _exit_tree() -> void:
	if not _connected:
		return
	_connected = false
	EventBus.control_context_changed.disconnect(_on_context_changed)
	EventBus.match_paused.disconnect(_on_match_paused)
	GameSettings.changed.disconnect(_on_settings_changed)
	if human_input != null and is_instance_valid(human_input) and human_input.context_changed.is_connected(_on_context_changed):
		human_input.context_changed.disconnect(_on_context_changed)


## True on phones, touch devices, or when mouse emulates touch (desktop testing).
func should_show() -> bool:
	if force_hidden or OS.get_environment("FB_HIDE_TOUCH") != "":
		return false
	if OS.has_feature("mobile") or DisplayServer.is_touchscreen_available():
		return true
	return bool(ProjectSettings.get_setting("input_devices/pointing/emulate_touch_from_mouse", false))


# --- Layout ------------------------------------------------------------------
## Recomputes widget positions, sizes, labels and visibility from settings and context.
func relayout() -> void:
	safe_rect = UiSafe.rect(self)
	var sc := GameSettings.button_scale
	var lh := GameSettings.left_handed
	var custom := GameSettings.custom_button_positions
	var scheme := human_input.scheme if human_input != null else GameSettings.control_scheme
	context = human_input.context if human_input != null else FB.Context.NONE
	for b in buttons:
		b.radius = UiTouchLayout.button_radius(b.slot, sc)
		b.center = UiTouchLayout.button_center(b.slot, safe_rect, sc, lh, custom)
		b.action = ControlLayouts.action_for(context, scheme, b.slot)
		b.label = ControlLayouts.label_for(b.action)
		b.shown = b.action != FB.Action.NONE or b.finger != -1
		b.hold = ControlLayouts.is_hold_action(b.action)
	joystick_zone = UiTouchLayout.joystick_zone(safe_rect, lh)
	curve_rect = UiTouchLayout.curve_rect(safe_rect, lh)
	pause_center = UiTouchLayout.pause_center(safe_rect)
	modulate.a = GameSettings.button_opacity
	_last_visible = UiSafe.visible(self)
	_last_safe = safe_rect
	queue_redraw()


func _on_context_changed(ctx: int) -> void:
	var was_set_piece := context == FB.Context.SET_PIECE
	relayout()
	if was_set_piece and ctx != FB.Context.SET_PIECE:
		_end_set_piece_widgets()


func _on_settings_changed(key: String) -> void:
	if (key == "control_scheme" or key == "") and human_input != null:
		human_input.set_scheme(GameSettings.control_scheme)
	relayout()


func _on_match_paused(is_paused: bool) -> void:
	if is_paused:
		release_all_fingers()


func _end_set_piece_widgets() -> void:
	for idx: int in fingers.keys():
		var f: Dictionary = fingers[idx]
		if f.kind == Kind.AIM or f.kind == Kind.CURVE:
			fingers[idx] = {"kind": Kind.NONE}
	aim_finger = -1
	curve_finger = -1
	aim_vector = Vector2.ZERO
	curve_value = 0.0
	if human_input != null:
		human_input.set_aim_vector(Vector2.ZERO)
		human_input.set_curve_input(0.0)


func _process(_delta: float) -> void:
	if UiSafe.visible(self) != _last_visible or UiSafe.rect(self) != _last_safe:
		relayout()
	# Charge rings / pressed feedback need continuous redraws only while something is active.
	if joy_finger != -1 or aim_finger != -1 or _any_button_held():
		queue_redraw()


func _any_button_held() -> bool:
	for b in buttons:
		if b.finger != -1:
			return true
	return false


# --- Raw input -----------------------------------------------------------------
func _input(event: InputEvent) -> void:
	if not visible or human_input == null:
		return
	if football_match != null and (football_match.paused or football_match.is_finished):
		return
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		handle_touch(st.index, st.pressed and not st.canceled, st.position)
	elif event is InputEventScreenDrag:
		var sd := event as InputEventScreenDrag
		handle_drag(sd.index, sd.position)


## A finger went down (pressed = true) or up (false) at canvas position `pos`.
func handle_touch(index: int, pressed: bool, pos: Vector2) -> void:
	if human_input == null:
		return
	if pressed:
		_touch_down(index, pos)
	else:
		_touch_up(index, pos)
	queue_redraw()


## A finger moved to `pos`.
func handle_drag(index: int, pos: Vector2) -> void:
	if human_input == null or not fingers.has(index):
		return
	var f: Dictionary = fingers[index]
	match f.kind:
		Kind.JOYSTICK:
			_joy_move(pos)
		Kind.BUTTON:
			var b: TouchButton = buttons[f.slot]
			if pos.distance_to(b.center) > b.radius * SLIDE_OFF_FACTOR:
				_release_button(b)
				fingers[index] = {"kind": Kind.NONE}
		Kind.AIM:
			_aim_move(pos)
		Kind.CURVE:
			_curve_move(pos)
	queue_redraw()


func _touch_down(index: int, pos: Vector2) -> void:
	if fingers.has(index):
		_touch_up(index, pos)
	# Pause button.
	if pos.distance_to(pause_center) <= UiTouchLayout.PAUSE_RADIUS * 1.3 and pause_finger == -1:
		pause_finger = index
		fingers[index] = {"kind": Kind.PAUSE}
		return
	# Buttons (nearest wins when hit areas overlap).
	var hit := _hit_button(pos)
	if hit != null:
		if hit.finger == -1:
			hit.finger = index
			fingers[index] = {"kind": Kind.BUTTON, "slot": hit.slot}
			human_input.press_slot(TOUCH, hit.slot)
			Haptics.pulse(Haptics.Kind.LIGHT)
		else:
			fingers[index] = {"kind": Kind.NONE}
		return
	if context == FB.Context.SET_PIECE:
		if curve_rect.has_point(pos) and curve_finger == -1:
			curve_finger = index
			fingers[index] = {"kind": Kind.CURVE}
			_curve_move(pos)
		elif aim_finger == -1:
			aim_finger = index
			aim_origin = pos
			fingers[index] = {"kind": Kind.AIM}
		else:
			fingers[index] = {"kind": Kind.NONE}
		return
	if joystick_zone.has_point(pos) and joy_finger == -1:
		joy_finger = index
		joy_origin = pos
		joy_pos = pos
		joy_vector = Vector2.ZERO
		fingers[index] = {"kind": Kind.JOYSTICK}
		human_input.set_move_vector(TOUCH, Vector2.ZERO)
		return
	fingers[index] = {"kind": Kind.NONE}


func _touch_up(index: int, pos: Vector2) -> void:
	if not fingers.has(index):
		return
	var f: Dictionary = fingers[index]
	fingers.erase(index)
	match f.kind:
		Kind.JOYSTICK:
			joy_finger = -1
			joy_vector = Vector2.ZERO
			human_input.set_move_vector(TOUCH, Vector2.ZERO)
		Kind.BUTTON:
			var b: TouchButton = buttons[f.slot]
			if b.finger == index:
				_release_button(b)
		Kind.PAUSE:
			pause_finger = -1
			if pos.distance_to(pause_center) <= UiTouchLayout.PAUSE_RADIUS * 1.6:
				request_pause()
		Kind.AIM:
			aim_finger = -1  # the aim itself is kept so the player can then press OK
		Kind.CURVE:
			curve_finger = -1


func _release_button(b: TouchButton) -> void:
	b.finger = -1
	human_input.release_slot(TOUCH, b.slot)
	b.shown = b.action != FB.Action.NONE


func _hit_button(pos: Vector2) -> TouchButton:
	var best: TouchButton = null
	var best_d := INF
	for b in buttons:
		if b.action == FB.Action.NONE:
			continue
		var d := pos.distance_to(b.center)
		if d <= b.radius * HIT_FACTOR and d < best_d:
			best_d = d
			best = b
	return best


func _joy_move(pos: Vector2) -> void:
	var off := pos - joy_origin
	if off.length() > UiTouchLayout.JOY_RADIUS:
		# Floating base follows the thumb so the stick never needs re-centering.
		joy_origin = pos - off.normalized() * UiTouchLayout.JOY_RADIUS
		off = pos - joy_origin
	joy_pos = pos
	joy_vector = off / UiTouchLayout.JOY_RADIUS
	human_input.set_move_vector(TOUCH, joy_vector)


func _aim_move(pos: Vector2) -> void:
	var v := (pos - aim_origin) / AIM_RADIUS
	if v.length() < 0.04:
		return
	aim_vector = v.limit_length(1.0)
	human_input.set_aim_vector(aim_vector)


func _curve_move(pos: Vector2) -> void:
	var half := curve_rect.size.x * 0.5 - 36.0
	curve_value = clampf((pos.x - curve_rect.get_center().x) / half, -1.0, 1.0)
	human_input.set_curve_input(curve_value)


## Pauses the match (pause button).
func request_pause() -> void:
	if football_match != null:
		football_match.set_paused(true)


## Lifts every tracked finger (pause, focus loss).
func release_all_fingers() -> void:
	fingers.clear()
	joy_finger = -1
	aim_finger = -1
	curve_finger = -1
	pause_finger = -1
	joy_vector = Vector2.ZERO
	for b in buttons:
		b.finger = -1
	if human_input != null:
		human_input.set_move_vector(TOUCH, Vector2.ZERO)
		human_input.release_all()
	queue_redraw()


# --- Introspection (tests / editor) ------------------------------------------------
## Info about a slot's button: center, radius, shown, pressed, action, label.
func get_button_info(slot: int) -> Dictionary:
	var b: TouchButton = buttons[slot]
	return {"center": b.center, "radius": b.radius, "shown": b.shown and b.action != FB.Action.NONE,
		"pressed": b.finger != -1, "action": b.action, "label": b.label, "finger": b.finger}


func is_joystick_active() -> bool:
	return joy_finger != -1


## Which widget a finger currently owns (Kind enum), NONE if dead / unknown.
func finger_kind(index: int) -> int:
	if not fingers.has(index):
		return -1
	var f: Dictionary = fingers[index]
	return f.kind


# --- Drawing -----------------------------------------------------------------------
func _draw() -> void:
	if human_input == null:
		return
	var font := ThemeDB.fallback_font
	# Joystick (idle hint when not touched).
	if joy_finger != -1:
		draw_circle(joy_origin, UiTouchLayout.JOY_RADIUS, Color(1, 1, 1, 0.16))
		draw_arc(joy_origin, UiTouchLayout.JOY_RADIUS, 0.0, TAU, 48, Color(1, 1, 1, 0.55), 4.0, true)
		draw_circle(joy_origin + joy_vector * UiTouchLayout.JOY_RADIUS, 36.0, Color(1, 1, 1, 0.55))
	elif context != FB.Context.SET_PIECE:
		var hint := Vector2(joystick_zone.position.x + joystick_zone.size.x * 0.5, safe_rect.end.y - 130.0)
		draw_arc(hint, UiTouchLayout.JOY_RADIUS, 0.0, TAU, 48, Color(1, 1, 1, 0.22), 3.0, true)
		draw_circle(hint, 30.0, Color(1, 1, 1, 0.12))
	# Aim drag line + curve slider in set pieces.
	if context == FB.Context.SET_PIECE:
		if aim_finger != -1:
			draw_circle(aim_origin, 10.0, Color(1, 1, 1, 0.7))
			draw_line(aim_origin, aim_origin + aim_vector * AIM_RADIUS, UiTheme.WARN, 6.0, true)
		_draw_curve_slider(font)
	# Buttons.
	for b in buttons:
		if not b.shown or b.action == FB.Action.NONE:
			continue
		var pressed := b.finger != -1
		var col := SLOT_COLORS[b.slot]
		var r := b.radius * (0.93 if pressed else 1.0)
		draw_circle(b.center, r, col.darkened(0.1) if not pressed else col.lightened(0.35))
		draw_circle(b.center, r * 0.86, Color(0, 0, 0, 0.30))
		draw_arc(b.center, r, 0.0, TAU, 40, Color(1, 1, 1, 0.95 if pressed else 0.6), 5.0 if pressed else 3.0, true)
		if b.hold and pressed:
			var charge := human_input.get_charge(b.action, SHOOT_CHARGE_TIME)
			if charge > 0.0:
				draw_arc(b.center, r + 9.0, -PI * 0.5, -PI * 0.5 + TAU * charge, 40, Color.WHITE, 7.0, true)
		var fs := int(clampf(b.radius * 0.40, 18.0, 34.0))
		var tw := font.get_string_size(b.label, HORIZONTAL_ALIGNMENT_CENTER, -1, fs).x
		draw_string(font, b.center + Vector2(-tw * 0.5, fs * 0.35), b.label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)
	# Pause button.
	var pr := UiTouchLayout.PAUSE_RADIUS
	draw_circle(pause_center, pr, Color(0, 0, 0, 0.55))
	draw_arc(pause_center, pr, 0.0, TAU, 32, Color(1, 1, 1, 0.8), 3.0, true)
	draw_rect(Rect2(pause_center + Vector2(-10, -12), Vector2(7, 24)), Color.WHITE)
	draw_rect(Rect2(pause_center + Vector2(3, -12), Vector2(7, 24)), Color.WHITE)


func _draw_curve_slider(font: Font) -> void:
	var r := curve_rect
	draw_rect(r, Color(0, 0, 0, 0.5), true)
	draw_rect(r, Color(1, 1, 1, 0.5), false, 3.0)
	var cy := r.get_center().y
	draw_line(Vector2(r.position.x + 36.0, cy), Vector2(r.end.x - 36.0, cy), Color(1, 1, 1, 0.5), 4.0)
	var hx := r.get_center().x + curve_value * (r.size.x * 0.5 - 36.0)
	draw_circle(Vector2(hx, cy), 26.0, UiTheme.WARN if curve_finger != -1 else Color.WHITE)
	draw_string(font, Vector2(r.position.x + 8.0, r.position.y - 8.0), "CURVE", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color.WHITE)
