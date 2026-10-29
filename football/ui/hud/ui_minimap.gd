class_name UiMinimap
extends Control
## Radar: whole pitch with player dots and the ball. Redrawn at ~12 Hz.

const SIZE := Vector2(224.0, 148.0)
const REFRESH := 1.0 / 12.0

var football_match: FootballMatch
var _accum := 0.0


func _init() -> void:
	custom_minimum_size = SIZE
	size = SIZE
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func bind(m: FootballMatch) -> void:
	football_match = m
	queue_redraw()


func _process(delta: float) -> void:
	if not visible:
		return
	_accum += delta
	if _accum >= REFRESH:
		_accum = 0.0
		queue_redraw()


## Maps a world position (meters) to local minimap pixels.
func world_to_map(w: Vector2) -> Vector2:
	var inner := Rect2(Vector2(8, 8), size - Vector2(16, 16))
	return inner.position + Vector2((w.x + FB.HALF_LENGTH) / FB.PITCH_LENGTH * inner.size.x,
		(w.y + FB.HALF_WIDTH) / FB.PITCH_WIDTH * inner.size.y)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.03, 0.12, 0.07, 0.78))
	var inner := Rect2(Vector2(8, 8), size - Vector2(16, 16))
	draw_rect(inner, Color(0.12, 0.45, 0.22, 0.85))
	var line := Color(1, 1, 1, 0.5)
	draw_rect(inner, line, false, 1.5)
	draw_line(inner.position + Vector2(inner.size.x * 0.5, 0), inner.position + Vector2(inner.size.x * 0.5, inner.size.y), line, 1.5)
	draw_arc(inner.get_center(), inner.size.x * FB.CENTER_CIRCLE_RADIUS / FB.PITCH_LENGTH, 0.0, TAU, 24, line, 1.5)
	var pa_w := inner.size.x * FB.PENALTY_AREA_DEPTH / FB.PITCH_LENGTH
	var pa_h := inner.size.y * FB.PENALTY_AREA_WIDTH / FB.PITCH_WIDTH
	draw_rect(Rect2(inner.position.x, inner.get_center().y - pa_h * 0.5, pa_w, pa_h), line, false, 1.5)
	draw_rect(Rect2(inner.end.x - pa_w, inner.get_center().y - pa_h * 0.5, pa_w, pa_h), line, false, 1.5)
	var m := football_match
	if m == null:
		return
	var controlled := m.controlled_player()
	for t: Team in m.teams:
		var col := t.data.color_primary
		for p: Player in t.players:
			if p.sent_off:
				continue
			var c := world_to_map(p.pos)
			var gk := p.is_goalkeeper()
			draw_circle(c, 5.0, Color.BLACK)
			draw_circle(c, 4.0, t.data.color_goalkeeper if gk else col)
	if controlled != null:
		draw_arc(world_to_map(controlled.pos), 8.0, 0.0, TAU, 16, Color.WHITE, 2.0)
	if m.ball != null:
		var bc := world_to_map(m.ball.pos)
		draw_circle(bc, 5.0, Color.BLACK)
		draw_circle(bc, 3.5, Color.WHITE)
