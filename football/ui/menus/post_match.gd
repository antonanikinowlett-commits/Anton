extends Control
## Post-match screen (scene slot "post_match"). bind(result) is called by Game before the
## scene is added; stats come from result["stats"] if present, else UiStatsTracker.last_stats.

var result: Dictionary = {}
var stats: Dictionary = {}
var rematch_button: Button
var menu_button: Button
## Overridable for tests.
var rematch_handler: Callable
var menu_handler: Callable

var _built := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	UiTheme.apply(self)
	if not rematch_handler.is_valid():
		rematch_handler = Callable(Game, "restart_match")
	if not menu_handler.is_valid():
		menu_handler = Callable(Game, "goto_main_menu")
	_build()


## Receives the match result dictionary (see FootballMatch.get_result()).
func bind(res: Dictionary) -> void:
	result = res
	stats = res.get("stats", UiStatsTracker.last_stats)
	if _built:
		_build()


## Headline for the human's perspective: "VICTORY" / "DEFEAT" / "DRAW".
func headline() -> String:
	var h := int(result.get("home_score", 0))
	var a := int(result.get("away_score", 0))
	var side := int(result.get("human_side", 0))
	if h == a:
		return "DRAW"
	if side < 0:
		return "FULL TIME"
	var won := (h > a) == (side == 0)
	return "VICTORY" if won else "DEFEAT"


func _build() -> void:
	_built = true
	for c in get_children():
		c.queue_free()
	add_child(UiMenuBackground.new())
	var safe := UiSafeContainer.new()
	add_child(safe)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	safe.add_child(v)
	var title := UiScreen.label("FULL TIME  -  " + headline(), &"TitleLabel")
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", UiTheme.ACCENT if headline() != "DEFEAT" else UiTheme.DANGER)
	v.add_child(title)

	var srow := HBoxContainer.new()
	srow.alignment = BoxContainer.ALIGNMENT_CENTER
	srow.add_theme_constant_override("separation", 24)
	v.add_child(srow)
	var home := UiScreen.label(str(result.get("home_name", "HOME")), &"HeaderLabel", 360.0)
	home.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	home.add_theme_color_override("font_color", UiTheme.TEXT)
	srow.add_child(home)
	var score := UiScreen.label("%d - %d" % [int(result.get("home_score", 0)), int(result.get("away_score", 0))], &"TitleLabel")
	score.add_theme_font_size_override("font_size", 72)
	score.add_theme_color_override("font_color", UiTheme.ACCENT)
	srow.add_child(score)
	var away := UiScreen.label(str(result.get("away_name", "AWAY")), &"HeaderLabel", 360.0)
	away.add_theme_color_override("font_color", UiTheme.TEXT)
	srow.add_child(away)

	var scorers := _scorers_text()
	if scorers != "":
		var sl := UiScreen.label(scorers, &"MutedLabel")
		sl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		sl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		v.add_child(sl)

	var center := CenterContainer.new()
	center.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(center)
	center.add_child(UiStatsTable.make(stats))

	var bar := HBoxContainer.new()
	bar.alignment = BoxContainer.ALIGNMENT_CENTER
	bar.add_theme_constant_override("separation", 24)
	v.add_child(bar)
	rematch_button = UiBigButton.make("REMATCH", &"AccentButton", 340.0)
	rematch_button.custom_minimum_size = Vector2(340, 80)
	rematch_button.pressed.connect(func() -> void: rematch_handler.call())
	bar.add_child(rematch_button)
	menu_button = UiBigButton.make("MAIN MENU", &"", 340.0)
	menu_button.custom_minimum_size = Vector2(340, 80)
	menu_button.pressed.connect(func() -> void: menu_handler.call())
	bar.add_child(menu_button)


func _scorers_text() -> String:
	var parts := PackedStringArray()
	var glog: Array = stats.get("goal_log", [])
	for g: Dictionary in glog:
		var own := " (OG)" if bool(g.get("own_goal", false)) else ""
		parts.append("%s %d'%s" % [str(g.get("scorer", "")), int(g.get("minute", 0)), own])
	return "   |   ".join(parts)
