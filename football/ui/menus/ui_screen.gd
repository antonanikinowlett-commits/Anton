class_name UiScreen
extends Control
## Base class of menu screens. Full-rect, themed, content inside a safe-area container.

signal navigate(screen: String)

var state: UiMenuState
var content: UiSafeContainer


func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS


## Creates the safe-area container and calls build(). Call once after `state` is set.
func setup(s: UiMenuState) -> void:
	state = s
	UiTheme.apply(self)
	content = UiSafeContainer.new()
	add_child(content)
	build()


## Override: add widgets to `content`.
func build() -> void:
	pass


## Called each time the screen becomes visible.
func on_show() -> void:
	pass


## Standard header: back button + title. Returns the HBox so callers can add to it.
func make_header(title: String, back_to: String = "home") -> HBoxContainer:
	var h := HBoxContainer.new()
	h.custom_minimum_size = Vector2(0, UiTheme.BUTTON_HEIGHT)
	var back := UiBigButton.make("< BACK", &"", 180.0)
	back.pressed.connect(func() -> void: navigate.emit(back_to))
	h.add_child(back)
	var l := Label.new()
	l.text = title
	l.theme_type_variation = &"TitleLabel"
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	h.add_child(l)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(180, 0)
	h.add_child(spacer)
	return h


static func label(text: String, variation: StringName = &"", min_w: float = 0.0) -> Label:
	var l := Label.new()
	l.text = text
	if variation != &"":
		l.theme_type_variation = variation
	if min_w > 0.0:
		l.custom_minimum_size = Vector2(min_w, 0)
	return l
