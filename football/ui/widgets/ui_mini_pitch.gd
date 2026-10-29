class_name UiMiniPitch
extends Control
## Mini pitch with draggable player tokens (formation editor).
## Drag one token onto another (or tap one then another) to swap their slots.
## The pitch is drawn attacking left -> right.

signal slot_tapped(slot: int)
signal swapped(slot_a: int, slot_b: int)

const TOKEN_RADIUS := 27.0
const TAP_SLOP := 14.0
const GRAB_RADIUS := 48.0

var team: TeamData
var formation: FormationData
var selected_slot: int = -1
var drag_slot: int = -1
var drag_pos: Vector2 = Vector2.ZERO
var _press_pos: Vector2 = Vector2.ZERO
var _moved := false


func _init() -> void:
	custom_minimum_size = Vector2(600.0, 388.0)
	mouse_filter = Control.MOUSE_FILTER_STOP


## Sets data to show (references, not copies).
func set_data(t: TeamData, f: FormationData) -> void:
	team = t
	formation = f
	selected_slot = -1
	drag_slot = -1
	queue_redraw()


## Pitch rectangle fitted into this control keeping 105:68.
func pitch_rect() -> Rect2:
	var aspect := FB.PITCH_LENGTH / FB.PITCH_WIDTH
	var w := size.x
	var h := w / aspect
	if h > size.y:
		h = size.y
		w = h * aspect
	return Rect2((size.x - w) * 0.5, (size.y - h) * 0.5, w, h)


## Local position of a slot's token.
func token_pos(slot: int) -> Vector2:
	var r := pitch_rect()
	var n := formation.positions[slot]
	return r.position + Vector2(n.x * r.size.x, n.y * r.size.y)


## Nearest slot to a local position within `radius`, or -1.
func slot_at(p: Vector2, radius: float = GRAB_RADIUS, ignore: int = -1) -> int:
	if formation == null:
		return -1
	var best := -1
	var best_d := radius
	for i in formation.slot_count():
		if i == ignore:
			continue
		var d := token_pos(i).distance_to(p)
		if d <= best_d:
			best_d = d
			best = i
	return best


## Press / move / release entry points (also used by tests).
func press_at(p: Vector2) -> void:
	_press_pos = p
	_moved = false
	drag_slot = slot_at(p)
	drag_pos = p
	queue_redraw()


func move_to(p: Vector2) -> void:
	if drag_slot < 0:
		return
	if p.distance_to(_press_pos) > TAP_SLOP:
		_moved = true
	drag_pos = p
	queue_redraw()


func release_at(p: Vector2) -> void:
	var from := drag_slot
	drag_slot = -1
	if from >= 0:
		if _moved:
			var to := slot_at(p, GRAB_RADIUS * 1.3, from)
			if to >= 0:
				_try_swap(from, to)
		else:
			_tap(from)
	queue_redraw()


func _tap(slot: int) -> void:
	slot_tapped.emit(slot)
	if selected_slot == -1:
		selected_slot = slot
	elif selected_slot == slot:
		selected_slot = -1
	else:
		_try_swap(selected_slot, slot)
		selected_slot = -1


func _try_swap(a: int, b: int) -> void:
	# The goalkeeper slot only swaps with itself (never with an outfielder).
	if (a == 0) != (b == 0):
		return
	swapped.emit(a, b)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		var mb := event as InputEventMouseButton
		if mb.pressed:
			press_at(mb.position)
		else:
			release_at(mb.position)
		accept_event()
	elif event is InputEventMouseMotion and drag_slot >= 0:
		move_to((event as InputEventMouseMotion).position)
		accept_event()


func _draw() -> void:
	var r := pitch_rect()
	draw_rect(r, Color("1f7a3a"))
	var line := Color(1, 1, 1, 0.55)
	draw_rect(r, line, false, 2.0)
	draw_line(r.position + Vector2(r.size.x * 0.5, 0), r.position + Vector2(r.size.x * 0.5, r.size.y), line, 2.0)
	draw_arc(r.get_center(), r.size.x * FB.CENTER_CIRCLE_RADIUS / FB.PITCH_LENGTH, 0, TAU, 32, line, 2.0)
	var pa_w := r.size.x * FB.PENALTY_AREA_DEPTH / FB.PITCH_LENGTH
	var pa_h := r.size.y * FB.PENALTY_AREA_WIDTH / FB.PITCH_WIDTH
	draw_rect(Rect2(r.position.x, r.get_center().y - pa_h * 0.5, pa_w, pa_h), line, false, 2.0)
	draw_rect(Rect2(r.end.x - pa_w, r.get_center().y - pa_h * 0.5, pa_w, pa_h), line, false, 2.0)
	if formation == null or team == null:
		return
	var font := ThemeDB.fallback_font
	for i in formation.slot_count():
		var c := drag_pos if i == drag_slot and _moved else token_pos(i)
		var col := team.color_goalkeeper if i == 0 else team.color_primary
		if i == drag_slot:
			draw_circle(c, TOKEN_RADIUS + 8.0, Color(1, 1, 1, 0.25))
		draw_circle(c, TOKEN_RADIUS, col)
		var ring := UiTheme.ACCENT if i == selected_slot else team.color_secondary
		draw_arc(c, TOKEN_RADIUS, 0.0, TAU, 32, ring, 5.0 if i == selected_slot else 3.0, true)
		var num := ""
		if i < team.squad.size():
			num = str(team.squad[i].number)
		var tc := Color.WHITE if col.get_luminance() < 0.55 else Color.BLACK
		draw_string(font, c + Vector2(-TOKEN_RADIUS, 8.0), num, HORIZONTAL_ALIGNMENT_CENTER, TOKEN_RADIUS * 2.0, 24, tc)
		var role := FB.role_to_string(formation.roles[i])
		draw_string(font, c + Vector2(-TOKEN_RADIUS * 1.5, TOKEN_RADIUS + 20.0), role, HORIZONTAL_ALIGNMENT_CENTER, TOKEN_RADIUS * 3.0, 18, Color(1, 1, 1, 0.9))
