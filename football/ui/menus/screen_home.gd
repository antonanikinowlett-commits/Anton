class_name UiScreenHome
extends UiScreen
## Main menu root screen: Play, Tactics, Settings, Quit.

signal quit_requested

var play_button: Button
var tactics_button: Button
var settings_button: Button
var quit_button: Button


func build() -> void:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_BEGIN
	content.add_child(row)
	var col := VBoxContainer.new()
	col.custom_minimum_size = Vector2(520, 0)
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 16)
	row.add_child(col)

	var t1 := UiScreen.label("TOUCHLINE", &"TitleLabel")
	t1.add_theme_font_size_override("font_size", 84)
	t1.add_theme_color_override("font_color", UiTheme.ACCENT)
	col.add_child(t1)
	var t2 := UiScreen.label("FOOTBALL", &"TitleLabel")
	t2.add_theme_font_size_override("font_size", 56)
	col.add_child(t2)
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(0, 10)
	col.add_child(gap)

	play_button = _big("PLAY  -  QUICK MATCH", &"AccentButton")
	play_button.pressed.connect(func() -> void: navigate.emit("team_select"))
	col.add_child(play_button)
	tactics_button = _big("TACTICS")
	tactics_button.pressed.connect(func() -> void: navigate.emit("tactics"))
	col.add_child(tactics_button)
	settings_button = _big("SETTINGS")
	settings_button.pressed.connect(func() -> void: navigate.emit("settings"))
	col.add_child(settings_button)
	quit_button = _big("QUIT", &"DangerButton")
	quit_button.pressed.connect(func() -> void: quit_requested.emit())
	col.add_child(quit_button)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)
	# Decorative kits on the right.
	var kits := VBoxContainer.new()
	kits.alignment = BoxContainer.ALIGNMENT_CENTER
	kits.custom_minimum_size = Vector2(300, 0)
	row.add_child(kits)
	var k1 := UiKitView.new()
	k1.custom_minimum_size = Vector2(260, 240)
	k1.set_colors(state.home_team.color_primary, state.home_team.color_secondary)
	kits.add_child(k1)
	var k2 := UiKitView.new()
	k2.custom_minimum_size = Vector2(260, 240)
	k2.set_colors(state.away_team.color_primary, state.away_team.color_secondary)
	kits.add_child(k2)


func _big(text: String, variation: StringName = &"") -> Button:
	var b := UiBigButton.make(text, variation, 480.0)
	b.custom_minimum_size = Vector2(480, 84)
	return b
