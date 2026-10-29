class_name UiSegmented
extends HBoxContainer
## Row of toggle buttons where exactly one is selected (quick picks).

signal selected(index: int)

var _buttons: Array[Button] = []
var _group := ButtonGroup.new()
var index: int = 0


static func make(options: Array, current: int, min_w: float = 100.0) -> UiSegmented:
	var s := UiSegmented.new()
	s.add_theme_constant_override("separation", 8)
	for i in options.size():
		var b := UiBigButton.make(str(options[i]), &"ToggleButton", min_w)
		b.toggle_mode = true
		b.button_group = s._group
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(s._on_pressed.bind(i))
		s.add_child(b)
		s._buttons.append(b)
	s.set_index(current, false)
	return s


## Selects an option (optionally emitting `selected`).
func set_index(i: int, emit: bool = true) -> void:
	if _buttons.is_empty():
		return
	index = clampi(i, 0, _buttons.size() - 1)
	_buttons[index].set_pressed_no_signal(true)
	if emit:
		selected.emit(index)


func get_button(i: int) -> Button:
	return _buttons[i]


func _on_pressed(i: int) -> void:
	index = i
	selected.emit(i)
