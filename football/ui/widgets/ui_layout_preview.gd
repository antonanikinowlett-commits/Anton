class_name UiLayoutPreview
extends Control
## Miniature of the game screen where the 5 touch buttons can be dragged.
## Positions are stored normalized in the (right-handed) button zone, exactly like
## GameSettings.custom_button_positions, and use UiTouchLayout so the preview
## matches the in-game result.

signal changed

## slot(int) -> Vector2 normalized; missing slot = default position.
var positions: Dictionary = {}
var dragging_slot: int = -1
## Full-screen rect the preview represents (canvas units).
var screen_rect: Rect2 = Rect2(0, 0, 1280, 720)
var safe: Rect2 = Rect2(0, 0, 1280, 720)


func _init() -> void:
	custom_minimum_size = Vector2(400, 300)
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(queue_redraw)


## Loads positions from GameSettings and the current screen / safe rects.
func load_from_settings() -> void:
	positions = GameSettings.custom_button_positions.duplicate()
	screen_rect = UiSafe.visible(self)
	safe = UiSafe.rect(self)
	queue_redraw()


## Preview scale (preview px per canvas px) and offset.
func fit() -> Dictionary:
	var s := minf(size.x / screen_rect.size.x, size.y / screen_rect.size.y)
	var off := (size - screen_rect.size * s) * 0.5
	return {"scale": s, "offset": off}


func to_preview(world: Vector2) -> Vector2:
	var f := fit()
	return (f.offset as Vector2) + (world - screen_rect.position) * float(f.scale)


func to_world(p: Vector2) -> Vector2:
	var f := fit()
	return (p - (f.offset as Vector2)) / float(f.scale) + screen_rect.position


## World-space centre of a slot's button given the edited positions.
func world_center(slot: int) -> Vector2:
	return UiTouchLayout.button_center(slot, safe, GameSettings.button_scale, GameSettings.left_handed, positions)


## Moves a slot's button to a world-space position (clamped into the zone).
func set_slot_from_world(slot: int, world: Vector2) -> void:
	positions[slot] = UiTouchLayout.to_normalized(world, safe, GameSettings.left_handed)
	changed.emit()
	queue_redraw()


## Restores default positions for all buttons.
func reset_positions() -> void:
	positions = {}
	changed.emit()
	queue_redraw()


func slot_at(p: Vector2) -> int:
	var w := to_world(p)
	var best := -1
	var best_d := INF
	var s := float(fit().scale)
	for slot in FB.SLOT_COUNT:
		var r := UiTouchLayout.button_radius(slot, GameSettings.button_scale)
		var d := w.distance_to(world_center(slot))
		if d <= maxf(r * 1.2, 40.0 / s) and d < best_d:
			best_d = d
			best = slot
	return best


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		var mb := event as InputEventMouseButton
		if mb.pressed:
			dragging_slot = slot_at(mb.position)
		else:
			dragging_slot = -1
		queue_redraw()
		accept_event()
	elif event is InputEventMouseMotion and dragging_slot >= 0:
		set_slot_from_world(dragging_slot, to_world((event as InputEventMouseMotion).position))
		accept_event()


func _draw() -> void:
	var s := float(fit().scale)
	var top_left := to_preview(screen_rect.position)
	draw_rect(Rect2(top_left, screen_rect.size * s), Color("0d2b18"))
	draw_rect(Rect2(top_left, screen_rect.size * s), UiTheme.BORDER, false, 3.0)
	# Safe area + joystick zone hints.
	draw_rect(Rect2(to_preview(safe.position), safe.size * s), Color(1, 1, 1, 0.25), false, 2.0)
	var lh := GameSettings.left_handed
	var jz := UiTouchLayout.joystick_zone(safe, lh)
	draw_rect(Rect2(to_preview(jz.position), jz.size * s), Color(1, 1, 1, 0.05))
	var font := ThemeDB.fallback_font
	draw_string(font, to_preview(jz.get_center()) + Vector2(-80, 0), "MOVE ZONE", HORIZONTAL_ALIGNMENT_CENTER, 160, 22, Color(1, 1, 1, 0.4))
	var bz := UiTouchLayout.button_zone(safe, lh)
	draw_rect(Rect2(to_preview(bz.position), bz.size * s), Color(UiTheme.ACCENT, 0.5), false, 2.0)
	var pc := UiTouchLayout.pause_center(safe)
	draw_circle(to_preview(pc), UiTouchLayout.PAUSE_RADIUS * s, Color(0, 0, 0, 0.5))
	for slot in FB.SLOT_COUNT:
		var c := to_preview(world_center(slot))
		var r := UiTouchLayout.button_radius(slot, GameSettings.button_scale) * s
		var col: Color = UiTouchLayout.SLOT_COLORS[slot]
		draw_circle(c, r, col.darkened(0.1))
		draw_arc(c, r, 0.0, TAU, 32, Color.WHITE if slot == dragging_slot else Color(1, 1, 1, 0.6), 4.0 if slot == dragging_slot else 2.0, true)
		var label := ControlLayouts.label_for(ControlLayouts.action_for(FB.Context.HAS_BALL, FB.ControlScheme.PRO, slot))
		var fs := int(clampf(r * 0.33, 13.0, 28.0))
		var tw := font.get_string_size(label, HORIZONTAL_ALIGNMENT_CENTER, -1, fs).x
		draw_string(font, c + Vector2(-tw * 0.5, fs * 0.35), label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)
