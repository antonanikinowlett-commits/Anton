class_name UiKitView
extends Control
## Draws a simple shirt in the team colors (menu team cards, half-time).

var primary: Color = Color.RED
var secondary: Color = Color.WHITE


func _init() -> void:
	custom_minimum_size = Vector2(132.0, 120.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## Sets the colors and redraws.
func set_colors(p: Color, s: Color) -> void:
	primary = p
	secondary = s
	queue_redraw()


func _draw() -> void:
	var w := size.x
	var h := size.y
	var pts := PackedVector2Array([
		Vector2(0.30 * w, 0.02 * h), Vector2(0.42 * w, 0.10 * h), Vector2(0.58 * w, 0.10 * h), Vector2(0.70 * w, 0.02 * h),
		Vector2(0.98 * w, 0.24 * h), Vector2(0.84 * w, 0.44 * h), Vector2(0.76 * w, 0.36 * h),
		Vector2(0.76 * w, 0.98 * h), Vector2(0.24 * w, 0.98 * h), Vector2(0.24 * w, 0.36 * h),
		Vector2(0.16 * w, 0.44 * h), Vector2(0.02 * w, 0.24 * h),
	])
	draw_colored_polygon(pts, primary)
	var closed := pts.duplicate()
	closed.append(pts[0])
	draw_polyline(closed, Color(1, 1, 1, 0.8), 3.0, true)
	# Collar and trim in the secondary color.
	draw_rect(Rect2(0.42 * w, 0.10 * h, 0.16 * w, 0.06 * h), secondary)
	draw_line(Vector2(0.24 * w, 0.62 * h), Vector2(0.76 * w, 0.62 * h), secondary, 8.0)
	draw_line(Vector2(0.24 * w, 0.78 * h), Vector2(0.76 * w, 0.78 * h), secondary, 8.0)
