class_name SafeArea
extends RefCounted
## Converts the OS safe area (notches, rounded corners, nav bars) into
## canvas coordinates of a viewport using stretch mode "canvas_items".


static func get_safe_rect(vp: Viewport) -> Rect2:
	var visible := vp.get_visible_rect()
	if not OS.has_feature("mobile"):
		return visible
	var win := DisplayServer.window_get_size()
	var sa := DisplayServer.get_display_safe_area()
	if win.x <= 0 or win.y <= 0 or sa.size.x <= 0 or sa.size.y <= 0:
		return visible
	var scale := visible.size / Vector2(win)
	return Rect2(visible.position + Vector2(sa.position) * scale, Vector2(sa.size) * scale)


## Margins (left, top, right, bottom) in canvas units, handy for MarginContainers.
static func get_margins(vp: Viewport) -> Vector4:
	var visible := vp.get_visible_rect()
	var safe := get_safe_rect(vp)
	return Vector4(
		safe.position.x - visible.position.x,
		safe.position.y - visible.position.y,
		visible.end.x - safe.end.x,
		visible.end.y - safe.end.y)
