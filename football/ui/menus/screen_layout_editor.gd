class_name UiScreenLayoutEditor
extends UiScreen
## Drag the 5 touch buttons around a preview; Save writes custom_button_positions.

var preview: UiLayoutPreview
var save_button: Button
var reset_button: Button


func build() -> void:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	content.add_child(v)
	v.add_child(make_header("BUTTON LAYOUT", "settings"))
	preview = UiLayoutPreview.new()
	preview.size_flags_vertical = Control.SIZE_EXPAND_FILL
	preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_child(preview)
	var bar := HBoxContainer.new()
	bar.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(bar)
	reset_button = UiBigButton.make("RESET", &"DangerButton", 240.0)
	reset_button.pressed.connect(reset)
	bar.add_child(reset_button)
	save_button = UiBigButton.make("SAVE", &"AccentButton", 300.0)
	save_button.pressed.connect(save)
	bar.add_child(save_button)
	var hint := UiScreen.label("Drag the buttons where your thumb likes them", &"MutedLabel")
	hint.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	bar.add_child(hint)


func on_show() -> void:
	preview.load_from_settings()


## Persists the edited positions.
func save() -> void:
	GameSettings.set_value("custom_button_positions", preview.positions.duplicate())


## Restores defaults and saves them.
func reset() -> void:
	preview.reset_positions()
	GameSettings.set_value("custom_button_positions", {})
