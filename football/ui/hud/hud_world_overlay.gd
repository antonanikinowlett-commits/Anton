class_name UiHudWorldOverlay
extends Control
## Draws world-anchored markers in screen space: pass-target ring and an arrow
## pointing at the controlled player when it is off-screen.

var football_match: FootballMatch
var highlight: Player
var safe_rect: Rect2 = Rect2(0, 0, 1280, 720)

var _arrow_pos: Vector2 = Vector2.ZERO
var _arrow_dir: Vector2 = Vector2.ZERO
var _arrow_visible := false
var _ring_pos: Vector2 = Vector2.ZERO
var _ring_radius: float = 0.0
var _ring_visible := false


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## Converts a world position (meters) to HUD canvas coordinates through the camera.
func world_to_screen(w: Vector2) -> Vector2:
	return get_viewport().get_canvas_transform() * (w * FB.PPM)


func _process(_delta: float) -> void:
	var m := football_match
	if m == null or not is_inside_tree():
		return
	var scale_f := get_viewport().get_canvas_transform().get_scale().x
	# Pass target ring.
	var had_ring := _ring_visible
	_ring_visible = highlight != null and is_instance_valid(highlight) and not highlight.sent_off
	if _ring_visible:
		_ring_pos = world_to_screen(highlight.pos)
		_ring_radius = maxf(FB.PLAYER_RADIUS * 2.6 * FB.PPM * scale_f, 24.0)
	# Off-screen pointer.
	var cp := m.controlled_player()
	var had_arrow := _arrow_visible
	_arrow_visible = false
	if cp != null and is_instance_valid(cp):
		var sp := world_to_screen(cp.pos)
		var inner := safe_rect.grow(-30.0)
		if not inner.has_point(sp):
			var center := inner.get_center()
			_arrow_dir = (sp - center).normalized()
			var half := inner.size * 0.5
			var k := minf(half.x / maxf(absf(_arrow_dir.x), 0.0001), half.y / maxf(absf(_arrow_dir.y), 0.0001))
			_arrow_pos = center + _arrow_dir * k
			_arrow_visible = true
	if _ring_visible or had_ring or _arrow_visible or had_arrow:
		queue_redraw()


func _draw() -> void:
	if _ring_visible:
		draw_arc(_ring_pos, _ring_radius, 0.0, TAU, 40, Color(0, 0, 0, 0.6), 9.0, true)
		draw_arc(_ring_pos, _ring_radius, 0.0, TAU, 40, UiTheme.WARN, 5.0, true)
	if _arrow_visible:
		var d := _arrow_dir
		var n := Vector2(-d.y, d.x)
		var pts := PackedVector2Array([_arrow_pos + d * 4.0, _arrow_pos - d * 36.0 + n * 24.0, _arrow_pos - d * 36.0 - n * 24.0])
		draw_colored_polygon(pts, UiTheme.ACCENT)
		var outline := pts.duplicate()
		outline.append(pts[0])
		draw_polyline(outline, Color.WHITE, 3.0, true)
