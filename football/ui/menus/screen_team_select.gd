class_name UiScreenTeamSelect
extends UiScreen
## Team select: pick home and away, difficulty, half length, side. Builds MatchConfig.

signal match_requested(cfg: MatchConfig)

const HALF_OPTIONS: Array[float] = [2.0, 4.0, 6.0, 8.0]

var cards: Array[Dictionary] = []
var difficulty_seg: UiSegmented
var half_seg: UiSegmented
var side_seg: UiSegmented
var kickoff_button: Button


func build() -> void:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	content.add_child(v)
	v.add_child(make_header("QUICK MATCH"))

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 20)
	v.add_child(row)
	cards.append(_make_card(0))
	row.add_child(cards[0].panel)
	var vs := UiScreen.label("VS", &"HeaderLabel")
	vs.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(vs)
	cards.append(_make_card(1))
	row.add_child(cards[1].panel)

	var opts := HBoxContainer.new()
	opts.add_theme_constant_override("separation", 24)
	v.add_child(opts)
	difficulty_seg = UiSegmented.make(["EASY", "MEDIUM", "HARD"], GameSettings.difficulty, 120.0)
	difficulty_seg.selected.connect(func(i: int) -> void: GameSettings.set_value("difficulty", i))
	opts.add_child(_labeled("DIFFICULTY", difficulty_seg, 3.0))
	half_seg = UiSegmented.make(["2 MIN", "4 MIN", "6 MIN", "8 MIN"], _half_index(), 96.0)
	half_seg.selected.connect(func(i: int) -> void: GameSettings.set_value("half_length_minutes", HALF_OPTIONS[i]))
	opts.add_child(_labeled("HALF LENGTH", half_seg, 4.0))
	side_seg = UiSegmented.make(["HOME", "AWAY"], state.human_side, 110.0)
	side_seg.selected.connect(func(i: int) -> void:
		state.human_side = i
		refresh())
	opts.add_child(_labeled("YOU PLAY", side_seg, 2.0))

	kickoff_button = UiBigButton.make("KICK OFF", &"AccentButton", 300.0)
	kickoff_button.custom_minimum_size = Vector2(300, 84)
	kickoff_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	kickoff_button.pressed.connect(func() -> void: match_requested.emit(make_config()))
	v.add_child(kickoff_button)
	refresh()


func on_show() -> void:
	difficulty_seg.set_index(GameSettings.difficulty, false)
	half_seg.set_index(_half_index(), false)
	side_seg.set_index(state.human_side, false)
	refresh()


func _half_index() -> int:
	var best := 0
	for i in HALF_OPTIONS.size():
		if absf(HALF_OPTIONS[i] - GameSettings.half_length_minutes) < absf(HALF_OPTIONS[best] - GameSettings.half_length_minutes):
			best = i
	return best


func _labeled(title: String, w: Control, weight: float) -> Control:
	var b := VBoxContainer.new()
	b.add_theme_constant_override("separation", 4)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.size_flags_stretch_ratio = weight
	b.add_child(UiScreen.label(title, &"MutedLabel"))
	b.add_child(w)
	return b


func _make_card(side: int) -> Dictionary:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(500, 300)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	var d := {"panel": panel, "side": side}
	panel.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and (ev as InputEventMouseButton).pressed and (ev as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
			cycle(side, 1))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	panel.add_child(h)
	var prev := UiBigButton.make("<", &"", 72.0)
	prev.custom_minimum_size = Vector2(72, 200)
	prev.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	prev.pressed.connect(func() -> void: cycle(side, -1))
	h.add_child(prev)
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.alignment = BoxContainer.ALIGNMENT_CENTER
	mid.add_theme_constant_override("separation", 6)
	h.add_child(mid)
	d["side_label"] = UiScreen.label("HOME", &"MutedLabel")
	d["side_label"].horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mid.add_child(d["side_label"])
	var kit := UiKitView.new()
	kit.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	kit.custom_minimum_size = Vector2(150, 126)
	mid.add_child(kit)
	d["kit"] = kit
	var name_l := UiScreen.label("", &"HeaderLabel")
	name_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_l.add_theme_font_size_override("font_size", 36)
	name_l.add_theme_color_override("font_color", UiTheme.TEXT)
	mid.add_child(name_l)
	d["name"] = name_l
	var info := UiScreen.label("")
	info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mid.add_child(info)
	d["info"] = info
	var next := UiBigButton.make(">", &"", 72.0)
	next.custom_minimum_size = Vector2(72, 200)
	next.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	next.pressed.connect(func() -> void: cycle(side, 1))
	h.add_child(next)
	d["prev"] = prev
	d["next"] = next
	return d


## Cycles a side's team (dir +1 / -1).
func cycle(side: int, dir: int) -> void:
	state.cycle_team(side, dir)
	refresh()


## Updates card contents from state.
func refresh() -> void:
	for side in 2:
		var t := state.team_for(side)
		var c: Dictionary = cards[side]
		(c.kit as UiKitView).set_colors(t.color_primary, t.color_secondary)
		(c.name as Label).text = t.name
		(c.info as Label).text = "%s   -   RATING %d" % [t.short_name, UiMenuState.rating(t)]
		var yours := state.human_side == side
		(c.side_label as Label).text = ("HOME" if side == 0 else "AWAY") + ("  -  YOU" if yours else "  -  CPU")
		(c.side_label as Label).add_theme_color_override("font_color", UiTheme.ACCENT if yours else UiTheme.MUTED)


## Builds the MatchConfig for the current selection.
func make_config() -> MatchConfig:
	return state.build_config()
