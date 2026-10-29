class_name UiSafeContainer
extends MarginContainer
## Full-rect container whose margins follow the device safe area plus a base padding.

@export var padding: float = 24.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	get_viewport().size_changed.connect(refresh)
	refresh()


## Recomputes margins from UiSafe.
func refresh() -> void:
	var m := UiSafe.margins(self)
	add_theme_constant_override("margin_left", int(m.x + padding))
	add_theme_constant_override("margin_top", int(m.y + padding * 0.6))
	add_theme_constant_override("margin_right", int(m.z + padding))
	add_theme_constant_override("margin_bottom", int(m.w + padding * 0.6))
