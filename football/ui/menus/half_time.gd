extends Control
## Half-time overlay (scene slot "half_time"). Shown on EventBus.half_time: score, stats,
## CONTINUE, and a tactics / substitutions shortcut for the human team.
## The match is paused while shown (match meta "ui_blocking_overlay" keeps the pause menu away).

var football_match: FootballMatch
var tracker: UiStatsTracker
var continue_button: Button
var tactics_button: Button
var stats_box: VBoxContainer
var score_label: Label
var subs_label: Label

var _summary: Control
var _tactics_panel: Control
var _slider_refs: Dictionary = {}
var _starter_buttons: Array[Button] = []
var _bench_buttons: Array[Button] = []
var _out_idx: int = -1
var _in_idx: int = -1
var _starters_grid: GridContainer
var _bench_grid: GridContainer
var _connected := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_STOP
	UiTheme.apply(self)
	visible = false
	EventBus.half_time.connect(_on_half_time)
	_connected = true


func _exit_tree() -> void:
	if _connected:
		_connected = false
		EventBus.half_time.disconnect(_on_half_time)


## Binds to a match (also creates a stats tracker if the HUD did not).
func bind(m: FootballMatch) -> void:
	football_match = m
	tracker = UiStatsTracker.ensure_for(m)


func _on_half_time() -> void:
	show_overlay()


## Builds and shows the overlay, pausing the match.
func show_overlay() -> void:
	if football_match == null:
		return
	football_match.set_meta(&"ui_blocking_overlay", true)
	football_match.set_paused(true)
	_rebuild()
	visible = true


func _rebuild() -> void:
	for c in get_children():
		c.queue_free()
	_slider_refs.clear()
	var dim := PanelContainer.new()
	dim.theme_type_variation = &"DimPanel"
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var safe := UiSafeContainer.new()
	add_child(safe)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	safe.add_child(v)
	var m := football_match
	var title := UiScreen.label("HALF TIME", &"TitleLabel")
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)

	# Score row with kit chips.
	var srow := HBoxContainer.new()
	srow.alignment = BoxContainer.ALIGNMENT_CENTER
	srow.add_theme_constant_override("separation", 18)
	v.add_child(srow)
	var hk := UiKitView.new()
	hk.custom_minimum_size = Vector2(70, 64)
	hk.set_colors(m.teams[0].data.color_primary, m.teams[0].data.color_secondary)
	srow.add_child(hk)
	score_label = UiScreen.label("%s  %d - %d  %s" % [m.teams[0].data.short_name, m.teams[0].score, m.teams[1].score, m.teams[1].data.short_name], &"HeaderLabel")
	score_label.add_theme_font_size_override("font_size", 52)
	score_label.add_theme_color_override("font_color", UiTheme.TEXT)
	srow.add_child(score_label)
	var ak := UiKitView.new()
	ak.custom_minimum_size = Vector2(70, 64)
	ak.set_colors(m.teams[1].data.color_primary, m.teams[1].data.color_secondary)
	srow.add_child(ak)

	# Summary or tactics panel.
	_summary = CenterContainer.new()
	_summary.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var stats := tracker.to_dict() if tracker != null else {}
	var scorers := _scorers_text(stats)
	var sbox := VBoxContainer.new()
	sbox.add_theme_constant_override("separation", 10)
	_summary.add_child(sbox)
	if scorers != "":
		var sl := UiScreen.label(scorers, &"MutedLabel")
		sl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		sbox.add_child(sl)
	stats_box = VBoxContainer.new()
	sbox.add_child(stats_box)
	stats_box.add_child(UiStatsTable.make(stats, ["possession", "shots", "shots_on_target", "fouls", "corners", "yellow_cards"]))
	v.add_child(_summary)

	_tactics_panel = _build_tactics_panel()
	_tactics_panel.visible = false
	v.add_child(_tactics_panel)

	var bar := HBoxContainer.new()
	bar.alignment = BoxContainer.ALIGNMENT_CENTER
	bar.add_theme_constant_override("separation", 24)
	v.add_child(bar)
	if m.human_team != null:
		tactics_button = UiBigButton.make("TACTICS & SUBS", &"", 360.0)
		tactics_button.pressed.connect(toggle_tactics)
		bar.add_child(tactics_button)
	continue_button = UiBigButton.make("CONTINUE", &"AccentButton", 360.0)
	continue_button.custom_minimum_size = Vector2(360, 84)
	continue_button.pressed.connect(continue_match)
	bar.add_child(continue_button)


func _scorers_text(stats: Dictionary) -> String:
	var parts := PackedStringArray()
	var glog: Array = stats.get("goal_log", [])
	for g: Dictionary in glog:
		parts.append("%s %d'" % [str(g.get("scorer", "")), int(g.get("minute", 0))])
	return "   ".join(parts)


func _build_tactics_panel() -> Control:
	var panel := HBoxContainer.new()
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_constant_override("separation", 30)
	var team := football_match.human_team
	if team == null:
		return panel
	var left := VBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.add_theme_constant_override("separation", 4)
	panel.add_child(left)
	for key: String in TacticsData.SLIDERS:
		var r := HBoxContainer.new()
		left.add_child(r)
		var l := UiScreen.label(UiScreenTactics.SLIDER_LABELS[key], &"", 180.0)
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		r.add_child(l)
		var s := UiSlider.make(0.0, 1.0, float(team.tactics.get(key)), 0.05)
		s.custom_minimum_size = Vector2(220, 60)
		s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		s.value_changed.connect(func(val: float) -> void: team.tactics.set(key, val))
		r.add_child(s)
		_slider_refs[key] = s
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 6)
	panel.add_child(right)
	subs_label = UiScreen.label("", &"HeaderLabel")
	right.add_child(subs_label)
	right.add_child(UiScreen.label("On pitch - tap one, then a bench player", &"MutedLabel"))
	_starters_grid = GridContainer.new()
	_starters_grid.columns = 4
	_starters_grid.add_theme_constant_override("h_separation", 6)
	_starters_grid.add_theme_constant_override("v_separation", 6)
	right.add_child(_starters_grid)
	_starter_buttons.clear()
	for i in team.players.size():
		var p := team.players[i]
		var b := UiBigButton.make("#%d %s" % [p.data.number, FB.role_to_string(p.role)], &"ToggleButton", 110.0)
		b.custom_minimum_size = Vector2(110, 56)
		b.toggle_mode = true
		b.add_theme_font_size_override("font_size", 20)
		b.pressed.connect(_pick_out.bind(i))
		_starters_grid.add_child(b)
		_starter_buttons.append(b)
	_bench_grid = GridContainer.new()
	_bench_grid.columns = 4
	_bench_grid.add_theme_constant_override("h_separation", 6)
	right.add_child(_bench_grid)
	_refresh_bench()
	return panel


func _refresh_bench() -> void:
	var team := football_match.human_team
	for c in _bench_grid.get_children():
		c.queue_free()
	_bench_buttons.clear()
	for i in mini(team.bench.size(), 8):
		var b := UiBigButton.make("#%d %s" % [team.bench[i].number, FB.role_to_string(team.bench[i].role)], &"ToggleButton", 110.0)
		b.custom_minimum_size = Vector2(110, 56)
		b.toggle_mode = true
		b.add_theme_font_size_override("font_size", 20)
		b.pressed.connect(_pick_in.bind(i))
		_bench_grid.add_child(b)
		_bench_buttons.append(b)
	subs_label.text = "SUBS LEFT: %d" % (FB.MAX_SUBSTITUTIONS - team.subs_used)


func _pick_out(i: int) -> void:
	_out_idx = i
	for k in _starter_buttons.size():
		_starter_buttons[k].set_pressed_no_signal(k == i)
	_try_sub()


func _pick_in(i: int) -> void:
	_in_idx = i
	for k in _bench_buttons.size():
		_bench_buttons[k].set_pressed_no_signal(k == i)
	_try_sub()


func _try_sub() -> void:
	if _out_idx < 0 or _in_idx < 0:
		return
	var team := football_match.human_team
	if team.substitute(team.players[_out_idx], team.bench[_in_idx]):
		var p := team.players[_out_idx]
		_starter_buttons[_out_idx].text = "#%d %s" % [p.data.number, FB.role_to_string(p.role)]
	_out_idx = -1
	_in_idx = -1
	for b in _starter_buttons:
		b.set_pressed_no_signal(false)
	_refresh_bench()


## Switches between the stats summary and the tactics / substitutions panel.
func toggle_tactics() -> void:
	var show_tactics := not _tactics_panel.visible
	_tactics_panel.visible = show_tactics
	_summary.visible = not show_tactics
	tactics_button.text = "BACK TO STATS" if show_tactics else "TACTICS & SUBS"


## Hides the overlay and resumes the match.
func continue_match() -> void:
	visible = false
	if football_match == null:
		return
	football_match.set_meta(&"ui_blocking_overlay", false)
	football_match.set_paused(false)
	if football_match.human_input != null:
		football_match.human_input.release_all()
		football_match.human_input.end_tick()
