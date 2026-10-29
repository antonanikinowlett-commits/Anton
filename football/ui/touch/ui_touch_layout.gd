class_name UiTouchLayout
extends RefCounted
## Pure layout math for the touch controls and the button layout editor
## (shared so the editor preview matches the in-game result exactly).
##
## Right-handed: joystick on the left 45 %, buttons in an arc in the bottom-right
## corner. Left-handed mirrors everything horizontally.
## custom_button_positions (GameSettings) store slot -> Vector2 normalized inside
## the *right-handed* control zone (x 0 = zone left edge, 1 = screen edge side).

const BASE_BUTTON_SIZE := 100.0
const EDGE_MARGIN := 22.0
const JOY_RADIUS := 70.0
const JOY_ZONE_FRACTION := 0.45
const PAUSE_RADIUS := 34.0
## Relative diameter per slot (primary is the biggest).
const SIZE_MULT: Array[float] = [1.2, 1.0, 1.0, 1.0, 0.95]
## Default arc: offset of the button centre from the bottom corner (x towards the screen
## centre, y upwards), at button_scale <= 1.
const DEFAULT_OFFSETS: Array[Vector2] = [
	Vector2(120, 118), Vector2(285, 78), Vector2(108, 288), Vector2(262, 222), Vector2(410, 160),
]


## Rectangle containing the button arc (editor / custom coordinates).
static func button_zone(safe: Rect2, left_handed: bool) -> Rect2:
	var w := clampf(safe.size.x * 0.42, 440.0, 640.0)
	var h := clampf(safe.size.y * 0.86, 300.0, 640.0)
	var x := safe.end.x - w
	if left_handed:
		x = safe.position.x
	return Rect2(x, safe.end.y - h, w, h)


## Zone where a new finger starts the floating joystick.
static func joystick_zone(safe: Rect2, left_handed: bool) -> Rect2:
	var w := safe.size.x * JOY_ZONE_FRACTION
	var x := safe.position.x
	if left_handed:
		x = safe.end.x - w
	return Rect2(x, safe.position.y, w, safe.size.y)


static func button_radius(slot: int, button_scale: float) -> float:
	return BASE_BUTTON_SIZE * SIZE_MULT[slot] * button_scale * 0.5


## Default (non-custom) centre of a slot's button.
static func default_center(slot: int, safe: Rect2, button_scale: float, left_handed: bool) -> Vector2:
	var f := maxf(button_scale, 1.0)
	var off := DEFAULT_OFFSETS[slot] * f
	var r := button_radius(slot, button_scale)
	var c := Vector2.ZERO
	if left_handed:
		c = Vector2(safe.position.x + EDGE_MARGIN + off.x, safe.end.y - EDGE_MARGIN - off.y)
	else:
		c = Vector2(safe.end.x - EDGE_MARGIN - off.x, safe.end.y - EDGE_MARGIN - off.y)
	return _clamp_in(c, r, safe)


## Centre of a slot's button, honouring custom positions.
static func button_center(slot: int, safe: Rect2, button_scale: float, left_handed: bool, custom: Dictionary) -> Vector2:
	if custom.has(slot):
		var n: Vector2 = custom[slot]
		var zone := button_zone(safe, left_handed)
		var nx := (1.0 - n.x) if left_handed else n.x
		var c := zone.position + Vector2(nx * zone.size.x, n.y * zone.size.y)
		return _clamp_in(c, button_radius(slot, button_scale), safe)
	return default_center(slot, safe, button_scale, left_handed)


## Default centre expressed as normalized right-handed zone coordinates (editor start value).
static func default_normalized(slot: int, safe: Rect2, button_scale: float) -> Vector2:
	var c := default_center(slot, safe, button_scale, false)
	var zone := button_zone(safe, false)
	return Vector2(clampf((c.x - zone.position.x) / zone.size.x, 0.0, 1.0), clampf((c.y - zone.position.y) / zone.size.y, 0.0, 1.0))


## Inverse of the custom mapping: world position -> normalized right-handed zone coords.
static func to_normalized(world: Vector2, safe: Rect2, left_handed: bool) -> Vector2:
	var zone := button_zone(safe, left_handed)
	var nx := clampf((world.x - zone.position.x) / zone.size.x, 0.0, 1.0)
	if left_handed:
		nx = 1.0 - nx
	return Vector2(nx, clampf((world.y - zone.position.y) / zone.size.y, 0.0, 1.0))


static func pause_center(safe: Rect2) -> Vector2:
	return Vector2(safe.end.x - EDGE_MARGIN - PAUSE_RADIUS, safe.position.y + EDGE_MARGIN * 0.6 + PAUSE_RADIUS)


## Set-piece curve slider rectangle (bottom, on the side away from the buttons).
static func curve_rect(safe: Rect2, left_handed: bool) -> Rect2:
	var w := 320.0
	var h := 76.0
	var cx := safe.position.x + safe.size.x * (0.62 if left_handed else 0.38)
	return Rect2(cx - w * 0.5, safe.end.y - EDGE_MARGIN - h, w, h)


static func _clamp_in(c: Vector2, r: float, safe: Rect2) -> Vector2:
	return Vector2(clampf(c.x, safe.position.x + r, safe.end.x - r), clampf(c.y, safe.position.y + r, safe.end.y - r))
