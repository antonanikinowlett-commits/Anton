extends Control
## Set-piece overlay for the human taker: aim arrow (screen space), power meter,
## curve indicator and a big hint. Hidden outside human set pieces.
## Reads the public sp_* state of rules/referee_impl.gd through Object.get().

const ARROW_LEN_M := 14.0
const COLOR_ARROW := Color(1.0, 0.95, 0.2, 0.95)
const COLOR_METER_BG := Color(0, 0, 0, 0.55)
const COLOR_METER := Color(0.3, 0.95, 0.4, 0.95)

var football_match: FootballMatch
var _font: Font


func bind(m: FootballMatch) -> void:
	football_match = m


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = ThemeDB.fallback_font
	visible = false


func _process(_delta: float) -> void:
	var active := _is_active()
	if active != visible:
		visible = active
	if active:
		queue_redraw()


func _is_active() -> bool:
	if football_match == null or football_match.referee == null:
		return false
	if football_match.referee.phase != FB.MatchPhase.SET_PIECE:
		return false
	var r: Object = football_match.referee
	return bool(r.get("sp_human"))


func _world_to_screen(world_m: Vector2) -> Vector2:
	var xf: Transform2D = get_viewport().get_canvas_transform()
	return xf * (world_m * FB.PPM)


func _draw() -> void:
	if not _is_active():
		return
	var r: Object = football_match.referee
	var step: int = int(r.get("sp_step"))
	var origin_m: Vector2 = r.get("sp_origin")
	var dir: Vector2 = r.get("sp_aim_dir")
	var power: float = float(r.get("sp_power"))
	var curve: float = float(r.get("sp_curve"))
	var needs_curve: bool = bool(r.get("sp_needs_curve"))
	var rest_pos: Vector2 = football_match.referee.restart.position
	var safe := SafeArea.get_safe_rect(get_viewport())

	# Aim arrow, anchored on the ball.
	var a := _world_to_screen(rest_pos)
	var length_m := ARROW_LEN_M * (0.4 + 0.6 * power) if step >= 1 else ARROW_LEN_M
	var b := _world_to_screen(rest_pos + dir * length_m)
	draw_line(a, b, COLOR_ARROW, 6.0, true)
	var head := (b - a).normalized()
	var side := Vector2(-head.y, head.x)
	draw_colored_polygon(PackedVector2Array([b + head * 18.0, b - head * 6.0 + side * 14.0, b - head * 6.0 - side * 14.0]), COLOR_ARROW)
	draw_arc(_world_to_screen(origin_m), 22.0, 0.0, TAU, 24, COLOR_ARROW, 3.0)

	# Power meter (vertical bar on the left of the safe area).
	var bar := Rect2(safe.position.x + 40.0, safe.position.y + safe.size.y * 0.5 - 130.0, 36.0, 260.0)
	draw_rect(bar, COLOR_METER_BG)
	var fill_h := bar.size.y * clampf(power, 0.0, 1.0)
	var col := COLOR_METER.lerp(Color(1.0, 0.3, 0.2), clampf((power - 0.8) / 0.2, 0.0, 1.0))
	draw_rect(Rect2(bar.position.x, bar.end.y - fill_h, bar.size.x, fill_h), col)
	draw_rect(bar, Color.WHITE, false, 3.0)
	_text("POWER", Vector2(bar.position.x - 10.0, bar.position.y - 14.0), 24)

	# Curve indicator (horizontal), only when the kick supports curve.
	if needs_curve:
		var cb := Rect2(safe.position.x + safe.size.x * 0.5 - 150.0, safe.end.y - 150.0, 300.0, 26.0)
		draw_rect(cb, COLOR_METER_BG)
		draw_line(Vector2(cb.position.x + cb.size.x * 0.5, cb.position.y), Vector2(cb.position.x + cb.size.x * 0.5, cb.end.y), Color.WHITE, 2.0)
		var cx := cb.position.x + cb.size.x * (0.5 + 0.5 * curve)
		draw_circle(Vector2(cx, cb.position.y + cb.size.y * 0.5), 15.0, COLOR_ARROW if step >= 2 else Color(1, 1, 1, 0.4))
		_text("CURVE", Vector2(cb.position.x, cb.position.y - 8.0), 22)

	# Hint text.
	var hint := "Drag to aim, tap OK"
	if step == 1:
		hint = "Tap OK to lock power"
	elif step == 2:
		hint = "Swipe to curve, tap OK to kick"
	elif step >= 3:
		hint = ""
	if hint != "":
		_text(hint, Vector2(safe.position.x + safe.size.x * 0.5 - 220.0, safe.position.y + 90.0), 34)


func _text(s: String, pos: Vector2, size: int) -> void:
	draw_string(_font, pos + Vector2(2, 2), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(0, 0, 0, 0.8))
	draw_string(_font, pos, s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color.WHITE)
