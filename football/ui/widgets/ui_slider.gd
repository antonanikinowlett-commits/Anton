class_name UiSlider
extends Control
## Touch slider with a big handle. Tap anywhere on the bar to jump, drag to adjust.
## Mouse events are enough: Godot emulates mouse from touch (project setting).

signal value_changed(value: float)

@export var min_value: float = 0.0
@export var max_value: float = 1.0
## 0 = continuous.
@export var step: float = 0.0
var value: float = 0.5:
	set(v):
		value = _snap(v)
		queue_redraw()

const HANDLE_RADIUS := 30.0
const TRACK_HEIGHT := 14.0

var _dragging := false


func _init() -> void:
	custom_minimum_size = Vector2(280.0, 68.0)
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_NONE


static func make(min_v: float, max_v: float, current: float, step_v: float = 0.0) -> UiSlider:
	var s := UiSlider.new()
	s.min_value = min_v
	s.max_value = max_v
	s.step = step_v
	s.value = current
	return s


## Normalized 0..1 position of the current value.
func get_ratio() -> float:
	if max_value <= min_value:
		return 0.0
	return clampf((value - min_value) / (max_value - min_value), 0.0, 1.0)


## Sets the value from a local x position (also used by tests).
func set_from_x(x: float) -> void:
	var usable := maxf(size.x - HANDLE_RADIUS * 2.0, 1.0)
	var r := clampf((x - HANDLE_RADIUS) / usable, 0.0, 1.0)
	var old := value
	value = min_value + r * (max_value - min_value)
	if not is_equal_approx(old, value):
		value_changed.emit(value)


func _snap(v: float) -> float:
	var out := clampf(v, min_value, max_value)
	if step > 0.0:
		out = clampf(snappedf(out, step), min_value, max_value)
	return out


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		_dragging = (event as InputEventMouseButton).pressed
		if _dragging:
			set_from_x((event as InputEventMouseButton).position.x)
		accept_event()
	elif event is InputEventMouseMotion and _dragging:
		set_from_x((event as InputEventMouseMotion).position.x)
		accept_event()


func _draw() -> void:
	var cy := size.y * 0.5
	var usable := maxf(size.x - HANDLE_RADIUS * 2.0, 1.0)
	var x0 := HANDLE_RADIUS
	var hx := x0 + usable * get_ratio()
	draw_rect(Rect2(x0, cy - TRACK_HEIGHT * 0.5, usable, TRACK_HEIGHT), UiTheme.PANEL_LIGHT.darkened(0.2))
	draw_rect(Rect2(x0, cy - TRACK_HEIGHT * 0.5, hx - x0, TRACK_HEIGHT), UiTheme.ACCENT_DARK)
	draw_circle(Vector2(hx, cy), HANDLE_RADIUS, UiTheme.ACCENT if _dragging else UiTheme.TEXT)
	draw_arc(Vector2(hx, cy), HANDLE_RADIUS, 0.0, TAU, 32, UiTheme.ACCENT_DARK, 4.0, true)
