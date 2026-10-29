class_name UiBigButton
extends Button
## Touch-sized button: min height 72, min width 200, large font.


static func make(label: String, variation: StringName = &"", min_w: float = 200.0) -> UiBigButton:
	var b := UiBigButton.new()
	b.text = label
	b.custom_minimum_size = Vector2(min_w, UiTheme.BUTTON_HEIGHT)
	if variation != &"":
		b.theme_type_variation = variation
	b.focus_mode = Control.FOCUS_NONE
	return b
