extends Control
## In-match HUD: scoreboard, clock, stamina, minimap, event banners, pass-target ring.
## bind(match) is called by FootballMatch._build_views(). Safe-area aware.

const BANNER_TIME := 1.7
const STAMINA_SIZE := Vector2(240.0, 16.0)

var football_match: FootballMatch
var tracker: UiStatsTracker

var _board: PanelContainer
var _home_chip: ColorRect
var _away_chip: ColorRect
var _home_name: Label
var _away_name: Label
var _score_label: Label
var _clock_label: Label
var _half_label: Label
var _player_label: Label
var _stamina: Control
var _minimap: UiMinimap
var _overlay: UiHudWorldOverlay
var _banner: Control
var _banner_bg: ColorRect
var _banner_title: Label
var _banner_sub: Label
var _banner_queue: Array[Dictionary] = []
var _banner_busy := false
var _banner_tween: Tween
var _last_score := ""
var _last_clock := ""
var _connected := false
var _stamina_value := 1.0
var _last_safe: Rect2 = Rect2()


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	process_mode = Node.PROCESS_MODE_ALWAYS
	UiTheme.apply(self)
	_build()
	_connect_events()
	_layout()


func _build() -> void:
	_overlay = UiHudWorldOverlay.new()
	_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_overlay)

	_minimap = UiMinimap.new()
	add_child(_minimap)

	_board = PanelContainer.new()
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_board.add_theme_stylebox_override("panel", UiTheme.box(Color(0.02, 0.07, 0.04, 0.82), UiTheme.BORDER, 18, 2))
	add_child(_board)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 0)
	_board.add_child(vb)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 10)
	vb.add_child(row)
	_home_chip = _make_chip()
	row.add_child(_home_chip)
	_home_name = _make_label("HOM", 30, 96, HORIZONTAL_ALIGNMENT_RIGHT)
	row.add_child(_home_name)
	_score_label = _make_label("0 - 0", 48, 150, HORIZONTAL_ALIGNMENT_CENTER)
	row.add_child(_score_label)
	_away_name = _make_label("AWY", 30, 96, HORIZONTAL_ALIGNMENT_LEFT)
	row.add_child(_away_name)
	_away_chip = _make_chip()
	row.add_child(_away_chip)
	var row2 := HBoxContainer.new()
	row2.alignment = BoxContainer.ALIGNMENT_CENTER
	row2.add_theme_constant_override("separation", 18)
	vb.add_child(row2)
	_clock_label = _make_label("00:00", 28, 150, HORIZONTAL_ALIGNMENT_RIGHT)
	row2.add_child(_clock_label)
	_half_label = _make_label("1ST HALF", 24, 150, HORIZONTAL_ALIGNMENT_LEFT)
	_half_label.add_theme_color_override("font_color", UiTheme.MUTED)
	row2.add_child(_half_label)

	_player_label = _make_label("", 22, 320, HORIZONTAL_ALIGNMENT_CENTER)
	_player_label.add_theme_color_override("font_color", UiTheme.MUTED)
	add_child(_player_label)
	_stamina = Control.new()
	_stamina.custom_minimum_size = STAMINA_SIZE
	_stamina.size = STAMINA_SIZE
	_stamina.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_stamina.draw.connect(_draw_stamina)
	add_child(_stamina)

	_banner = Control.new()
	_banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.modulate.a = 0.0
	add_child(_banner)
	_banner_bg = ColorRect.new()
	_banner_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.add_child(_banner_bg)
	_banner_title = Label.new()
	_banner_title.add_theme_font_size_override("font_size", 64)
	_banner_title.add_theme_constant_override("outline_size", 10)
	_banner_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner_title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_banner.add_child(_banner_title)
	_banner_sub = Label.new()
	_banner_sub.add_theme_font_size_override("font_size", 30)
	_banner_sub.add_theme_constant_override("outline_size", 8)
	_banner_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.add_child(_banner_sub)


func _make_chip() -> ColorRect:
	var c := ColorRect.new()
	c.custom_minimum_size = Vector2(30.0, 30.0)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


func _make_label(text: String, font_size: int, min_w: float, align: HorizontalAlignment) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_constant_override("outline_size", 6)
	l.custom_minimum_size = Vector2(min_w, 0.0)
	l.horizontal_alignment = align
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


## Binds the HUD to a match and creates the stats tracker.
func bind(m: FootballMatch) -> void:
	football_match = m
	tracker = UiStatsTracker.ensure_for(m)
	if is_inside_tree():
		_apply_match()


func _apply_match() -> void:
	var m := football_match
	if m == null or m.teams.size() < 2:
		return
	_home_name.text = m.teams[0].data.short_name
	_away_name.text = m.teams[1].data.short_name
	_home_chip.color = m.teams[0].data.color_primary
	_away_chip.color = m.teams[1].data.color_primary
	_minimap.bind(m)
	_overlay.football_match = m
	_last_score = ""
	_layout()


func _connect_events() -> void:
	if _connected:
		return
	_connected = true
	EventBus.goal_scored.connect(_on_goal)
	EventBus.foul.connect(_on_foul)
	EventBus.card.connect(_on_card)
	EventBus.offside.connect(_on_offside)
	EventBus.half_time.connect(_on_half_time)
	EventBus.full_time.connect(_on_full_time)
	EventBus.kickoff.connect(_on_kickoff)
	EventBus.pass_target_highlighted.connect(_on_highlight)
	GameSettings.changed.connect(_on_settings_changed)
	if football_match != null:
		_apply_match()


func _exit_tree() -> void:
	if not _connected:
		return
	_connected = false
	EventBus.goal_scored.disconnect(_on_goal)
	EventBus.foul.disconnect(_on_foul)
	EventBus.card.disconnect(_on_card)
	EventBus.offside.disconnect(_on_offside)
	EventBus.half_time.disconnect(_on_half_time)
	EventBus.full_time.disconnect(_on_full_time)
	EventBus.kickoff.disconnect(_on_kickoff)
	EventBus.pass_target_highlighted.disconnect(_on_highlight)
	GameSettings.changed.disconnect(_on_settings_changed)


# --- Layout --------------------------------------------------------------------
func _layout() -> void:
	var safe := UiSafe.rect(self)
	_last_safe = safe
	_overlay.safe_rect = safe
	_minimap.visible = GameSettings.show_minimap
	_minimap.position = safe.position + Vector2(14.0, 12.0)
	_board.reset_size()
	var bs := _board.get_combined_minimum_size()
	_board.size = bs
	_board.position = Vector2(safe.get_center().x - bs.x * 0.5, safe.position.y + 8.0)
	_player_label.position = Vector2(safe.get_center().x - _player_label.custom_minimum_size.x * 0.5, _board.position.y + bs.y + 4.0)
	_player_label.size = Vector2(_player_label.custom_minimum_size.x, 28.0)
	_stamina.position = Vector2(safe.get_center().x - STAMINA_SIZE.x * 0.5, _player_label.position.y + 34.0)
	var bh := 130.0
	_banner.size = Vector2(safe.size.x, bh)
	_banner.position = Vector2(safe.position.x, safe.position.y + safe.size.y * 0.30)
	_banner_bg.size = _banner.size
	_banner_title.size = Vector2(safe.size.x, bh * 0.62)
	_banner_title.position = Vector2(0.0, 6.0)
	_banner_sub.size = Vector2(safe.size.x, bh * 0.3)
	_banner_sub.position = Vector2(0.0, bh * 0.66)
	_banner.pivot_offset = _banner.size * 0.5


func _on_settings_changed(key: String) -> void:
	if key == "show_minimap" or key == "":
		_minimap.visible = GameSettings.show_minimap


# --- Per-frame -----------------------------------------------------------------
func _process(_delta: float) -> void:
	if UiSafe.rect(self) != _last_safe:
		_layout()
	var m := football_match
	if m == null or m.teams.size() < 2:
		return
	var score := "%d - %d" % [m.teams[0].score, m.teams[1].score]
	if score != _last_score:
		_last_score = score
		_score_label.text = score
	if m.referee != null:
		var clock := m.referee.get_clock_text()
		if clock != _last_clock:
			_last_clock = clock
			_clock_label.text = clock
			_half_label.text = "1ST HALF" if m.referee.half == 1 else "2ND HALF"
	var cp := m.controlled_player()
	if cp != null:
		var txt := "#%d %s" % [cp.data.number, cp.data.name]
		if txt != _player_label.text:
			_player_label.text = txt
		if not is_equal_approx(cp.stamina, _stamina_value):
			_stamina_value = cp.stamina
			_stamina.queue_redraw()
	_stamina.visible = cp != null
	_player_label.visible = cp != null


func _draw_stamina() -> void:
	var r := Rect2(Vector2.ZERO, STAMINA_SIZE)
	_stamina.draw_rect(r, Color(0, 0, 0, 0.6))
	var v := clampf(_stamina_value, 0.0, 1.0)
	var col := UiTheme.ACCENT.lerp(UiTheme.WARN, clampf((0.6 - v) / 0.3, 0.0, 1.0))
	col = col.lerp(UiTheme.DANGER, clampf((0.3 - v) / 0.3, 0.0, 1.0))
	_stamina.draw_rect(Rect2(2.0, 2.0, (STAMINA_SIZE.x - 4.0) * v, STAMINA_SIZE.y - 4.0), col)
	_stamina.draw_rect(r, Color(1, 1, 1, 0.5), false, 2.0)


# --- Banners ---------------------------------------------------------------------
## Queues a big banner. kind picks the strip color.
func show_banner(title: String, sub: String = "", color: Color = UiTheme.ACCENT_DARK, duration: float = BANNER_TIME) -> void:
	if _banner_queue.size() > 3:
		_banner_queue.pop_front()
	_banner_queue.append({"title": title, "sub": sub, "color": color, "time": duration})
	if not _banner_busy:
		_next_banner()


func _next_banner() -> void:
	if _banner_queue.is_empty():
		_banner_busy = false
		return
	_banner_busy = true
	var b: Dictionary = _banner_queue.pop_front()
	_banner_title.text = b.title
	_banner_sub.text = b.sub
	var col: Color = b.color
	_banner_bg.color = Color(col.r, col.g, col.b, 0.82)
	var lum := col.get_luminance()
	var fc := Color.BLACK if lum > 0.6 else Color.WHITE
	_banner_title.add_theme_color_override("font_color", fc)
	_banner_sub.add_theme_color_override("font_color", fc)
	_banner_title.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.0 if lum > 0.6 else 0.7))
	_banner_sub.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.0 if lum > 0.6 else 0.7))
	_banner.modulate.a = 0.0
	_banner.scale = Vector2(0.8, 0.8)
	if _banner_tween != null and _banner_tween.is_valid():
		_banner_tween.kill()
	_banner_tween = create_tween()
	_banner_tween.set_parallel(true)
	_banner_tween.tween_property(_banner, "modulate:a", 1.0, 0.12)
	_banner_tween.tween_property(_banner, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_banner_tween.chain().tween_interval(float(b.time))
	_banner_tween.chain().tween_property(_banner, "modulate:a", 0.0, 0.25)
	_banner_tween.chain().tween_callback(_next_banner)


func _team_color(team_id: int) -> Color:
	if football_match != null and team_id >= 0 and team_id < football_match.teams.size():
		return football_match.teams[team_id].data.color_primary
	return UiTheme.ACCENT_DARK


func _pname(p: Player) -> String:
	if p != null and is_instance_valid(p) and p.data != null:
		return "%s #%d" % [p.data.name, p.data.number]
	return ""


func _on_goal(team_id: int, scorer: Player, _assist: Player, own_goal: bool) -> void:
	var sub := _pname(scorer)
	if own_goal:
		sub += " (own goal)"
	show_banner("GOAL!", sub, _team_color(team_id), 2.4)


func _on_foul(offender: Player, _victim: Player, _pos: Vector2, severity: int, advantage: bool) -> void:
	if advantage:
		show_banner("ADVANTAGE", "", UiTheme.ACCENT_DARK, 0.9)
	elif severity >= FB.FoulSeverity.RECKLESS:
		show_banner("FOUL", _pname(offender), Color("c2410c"), 1.2)
	else:
		show_banner("FOUL", "", Color("c2410c"), 1.0)


func _on_card(player: Player, card_type: int) -> void:
	if card_type == FB.Card.YELLOW:
		show_banner("YELLOW CARD", _pname(player), Color("facc15"), 1.6)
	elif card_type == FB.Card.SECOND_YELLOW:
		show_banner("SECOND YELLOW - RED", _pname(player), Color("dc2626"), 1.8)
	else:
		show_banner("RED CARD", _pname(player), Color("dc2626"), 1.8)


func _on_offside(player: Player, _pos: Vector2) -> void:
	show_banner("OFFSIDE", _pname(player), Color("2563eb"), 1.3)


func _on_half_time() -> void:
	show_banner("HALF TIME", "", UiTheme.PANEL_LIGHT, 2.0)


func _on_full_time(_h: int, _a: int) -> void:
	show_banner("FULL TIME", "", UiTheme.PANEL_LIGHT, 2.5)


func _on_kickoff(_team_id: int) -> void:
	pass


func _on_highlight(p: Player) -> void:
	_overlay.highlight = p
	_overlay.queue_redraw()
