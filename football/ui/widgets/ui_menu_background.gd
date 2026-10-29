class_name UiMenuBackground
extends Control
## Cheap full-screen background: dark green mowing stripes with pitch markings.


func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), UiTheme.BG)
	var stripe := size.x / 14.0
	for i in 14:
		if i % 2 == 0:
			draw_rect(Rect2(i * stripe, 0.0, stripe, size.y), Color(1, 1, 1, 0.025))
	var line := Color(1, 1, 1, 0.06)
	draw_arc(size * 0.5, size.y * 0.30, 0.0, TAU, 64, line, 6.0, true)
	draw_line(Vector2(size.x * 0.5, 0.0), Vector2(size.x * 0.5, size.y), line, 6.0)
	draw_circle(size * 0.5, 10.0, line)
