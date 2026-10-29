class_name UiScreenSettings
extends UiScreen
## Settings: gameplay + controls. Everything goes through GameSettings.set_value().
## Also used inside the pause menu (back_target "close").

const HALF_OPTIONS: Array[float] = [2.0, 4.0, 6.0, 8.0]

var back_target: String = "home"
var difficulty_seg: UiSegmented
var scheme_seg: UiSegmented
var half_seg: UiSegmented
var sliders: Dictionary = {}
var toggles: Dictionary = {}
var editor_button: Button


func build() -> void:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	content.add_child(v)
	v.add_child(make_header("SETTINGS", back_target))

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)
	var cols := HBoxContainer.new()
	cols.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cols.add_theme_constant_override("separation", 36)
	scroll.add_child(cols)
	var a := VBoxContainer.new()
	a.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	a.add_theme_constant_override("separation", 12)
	cols.add_child(a)
	var b := VBoxContainer.new()
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.add_theme_constant_override("separation", 12)
	cols.add_child(b)

	difficulty_seg = UiSegmented.make(["EASY", "MEDIUM", "HARD"], GameSettings.difficulty, 100.0)
	difficulty_seg.selected.connect(func(i: int) -> void: GameSettings.set_value("difficulty", i))
	a.add_child(_row("DIFFICULTY", difficulty_seg))
	scheme_seg = UiSegmented.make(["SIMPLE", "PRO"], GameSettings.control_scheme, 120.0)
	scheme_seg.selected.connect(func(i: int) -> void: GameSettings.set_value("control_scheme", i))
	a.add_child(_row("CONTROLS", scheme_seg))
	half_seg = UiSegmented.make(["2", "4", "6", "8"], _half_index(), 80.0)
	half_seg.selected.connect(func(i: int) -> void: GameSettings.set_value("half_length_minutes", HALF_OPTIONS[i]))
	a.add_child(_row("HALF (MIN)", half_seg))
	a.add_child(_slider_row("AIM ASSIST", "aim_assist", 0.0, 1.0, 0.05))
	a.add_child(_toggle_row("MINIMAP", "show_minimap"))

	b.add_child(_slider_row("BUTTON SIZE", "button_scale", 0.75, 1.5, 0.05))
	b.add_child(_slider_row("OPACITY", "button_opacity", 0.2, 1.0, 0.05))
	b.add_child(_slider_row("VOLUME", "sfx_volume", 0.0, 1.0, 0.05))
	b.add_child(_toggle_row("LEFT HANDED", "left_handed"))
	b.add_child(_toggle_row("HAPTICS", "haptics_enabled"))

	var bottom := HBoxContainer.new()
	v.add_child(bottom)
	editor_button = UiBigButton.make("EDIT BUTTON LAYOUT", &"AccentButton", 400.0)
	editor_button.pressed.connect(func() -> void: navigate.emit("layout_editor"))
	bottom.add_child(editor_button)
	var defaults := UiBigButton.make("RESET DEFAULTS", &"DangerButton", 300.0)
	defaults.pressed.connect(func() -> void:
		GameSettings.reset_to_defaults()
		refresh())
	bottom.add_child(defaults)


func on_show() -> void:
	refresh()


## Re-reads all controls from GameSettings.
func refresh() -> void:
	difficulty_seg.set_index(GameSettings.difficulty, false)
	scheme_seg.set_index(GameSettings.control_scheme, false)
	half_seg.set_index(_half_index(), false)
	for key: String in sliders.keys():
		var s: UiSlider = sliders[key]
		s.value = float(GameSettings.get(key))
		_update_value_label(key)
	for key: String in toggles.keys():
		var t: Button = toggles[key]
		t.set_pressed_no_signal(bool(GameSettings.get(key)))
		t.text = "ON" if t.button_pressed else "OFF"


func _half_index() -> int:
	var best := 0
	for i in HALF_OPTIONS.size():
		if absf(HALF_OPTIONS[i] - GameSettings.half_length_minutes) < absf(HALF_OPTIONS[best] - GameSettings.half_length_minutes):
			best = i
	return best


func _row(title: String, control: Control) -> Control:
	var r := HBoxContainer.new()
	r.custom_minimum_size = Vector2(0, 72)
	var l := UiScreen.label(title, &"", 200.0)
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	r.add_child(l)
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	r.add_child(control)
	return r


func _slider_row(title: String, key: String, lo: float, hi: float, step: float) -> Control:
	var s := UiSlider.make(lo, hi, float(GameSettings.get(key)), step)
	s.value_changed.connect(func(val: float) -> void:
		GameSettings.set_value(key, val)
		_update_value_label(key))
	sliders[key] = s
	var holder := HBoxContainer.new()
	holder.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	holder.add_child(s)
	var vl := UiScreen.label("", &"MutedLabel", 70.0)
	vl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	vl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	vl.name = "Value_" + key
	holder.add_child(vl)
	var row := _row(title, holder)
	_update_value_label(key, vl)
	return row


func _update_value_label(key: String, vl: Label = null) -> void:
	var s: UiSlider = sliders[key]
	if vl == null:
		vl = s.get_parent().get_node("Value_" + key) as Label
	vl.text = "%d%%" % int(round(s.value * 100.0))


func _toggle_row(title: String, key: String) -> Control:
	var t := UiBigButton.make("ON" if bool(GameSettings.get(key)) else "OFF", &"ToggleButton", 150.0)
	t.toggle_mode = true
	t.set_pressed_no_signal(bool(GameSettings.get(key)))
	t.toggled.connect(func(on: bool) -> void:
		GameSettings.set_value(key, on)
		t.text = "ON" if on else "OFF")
	toggles[key] = t
	var holder := HBoxContainer.new()
	t.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	holder.add_child(t)
	return _row(title, holder)
