class_name UiSafe
extends RefCounted
## Safe-area helper shared by all UI. Wraps SafeArea and allows tests to
## simulate a notch by setting `override_rect` (zero size = no override).

static var override_rect: Rect2 = Rect2()


## Safe rect in canvas units of the node's viewport.
static func rect(node: Node) -> Rect2:
	if override_rect.size.x > 0.0 and override_rect.size.y > 0.0:
		return override_rect
	var vp: Viewport = node.get_viewport() if node.is_inside_tree() else null
	if vp == null:
		return Rect2(0, 0, 1280, 720)
	return SafeArea.get_safe_rect(vp)


## Visible viewport rect (full canvas area).
static func visible(node: Node) -> Rect2:
	var vp: Viewport = node.get_viewport() if node.is_inside_tree() else null
	if vp == null:
		return Rect2(0, 0, 1280, 720)
	return vp.get_visible_rect()


## Margins (left, top, right, bottom) between the visible rect and the safe rect.
static func margins(node: Node) -> Vector4:
	var v := visible(node)
	var s := rect(node)
	return Vector4(maxf(s.position.x - v.position.x, 0.0), maxf(s.position.y - v.position.y, 0.0),
		maxf(v.end.x - s.end.x, 0.0), maxf(v.end.y - s.end.y, 0.0))
