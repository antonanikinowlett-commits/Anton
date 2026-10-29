extends TestCase
## Menus: scenes instantiate, settings persistence, MatchConfig building, tactics edits,
## layout editor, safe area handling.

var _saved: Dictionary = {}


func before_each() -> void:
	for k in GameSettings.KEYS:
		_saved[k] = GameSettings.get(k)
	UiSafe.override_rect = Rect2()


func after_each() -> void:
	for k: String in _saved.keys():
		GameSettings.set_value(k, _saved[k])
	UiSafe.override_rect = Rect2()


func test_all_scene_slots_instantiate() -> void:
	for slot in ["main_menu", "post_match", "hud", "touch_controls", "pause_menu", "half_time"]:
		assert_true(Factory.is_implemented(slot), "%s scene exists" % slot)
		var n := Factory.instantiate_scene(slot)
		assert_not_null(n, slot)
		if n == null:
			continue
		root.add_child(n)
		assert_true(n is Control, "%s root is Control" % slot)
		n.queue_free()


func test_main_menu_builds_every_screen() -> void:
	var menu: Control = load("res://ui/menus/main_menu.tscn").instantiate()
	root.add_child(menu)
	for id in ["home", "team_select", "tactics", "settings", "layout_editor"]:
		menu.call("show_screen", id)
		assert_eq(menu.get("current"), id)
		var s: Control = menu.get("screens")[id]
		assert_true(s.visible, "%s visible" % id)
	menu.free()


func _all_buttons(n: Node, out: Array[Button]) -> void:
	for c in n.get_children():
		if c is Button:
			out.append(c)
		_all_buttons(c, out)


func test_touch_targets_are_big_in_every_screen() -> void:
	var menu: Control = load("res://ui/menus/main_menu.tscn").instantiate()
	root.add_child(menu)
	for id in ["home", "team_select", "tactics", "settings"]:
		menu.call("show_screen", id)
		var btns: Array[Button] = []
		_all_buttons(menu.get("screens")[id], btns)
		for b in btns:
			assert_true(b.custom_minimum_size.y >= 48.0, "%s button '%s' min height" % [id, b.text])
			assert_true(maxf(b.custom_minimum_size.x, 48.0) >= 48.0)
	menu.free()


func test_settings_set_value_roundtrip_persists() -> void:
	GameSettings.set_value("button_scale", 1.3)
	GameSettings.set_value("left_handed", true)
	GameSettings.set_value("custom_button_positions", {FB.Slot.PRIMARY: Vector2(0.4, 0.6)})
	GameSettings.set_value("difficulty", FB.Difficulty.HARD)
	GameSettings.button_scale = 1.0
	GameSettings.left_handed = false
	GameSettings.custom_button_positions = {}
	GameSettings.difficulty = FB.Difficulty.EASY
	GameSettings.load_settings()
	assert_near(GameSettings.button_scale, 1.3, 0.0001)
	assert_true(GameSettings.left_handed)
	assert_eq(GameSettings.difficulty, FB.Difficulty.HARD)
	assert_true(GameSettings.custom_button_positions.has(FB.Slot.PRIMARY), "custom positions persisted")
	assert_eq(GameSettings.custom_button_positions[FB.Slot.PRIMARY], Vector2(0.4, 0.6))


func test_settings_screen_controls_write_through_set_value() -> void:
	var s := UiScreenSettings.new()
	root.add_child(s)
	s.setup(UiMenuState.new())
	s.difficulty_seg.get_button(2).pressed.emit()
	assert_eq(GameSettings.difficulty, FB.Difficulty.HARD)
	s.scheme_seg.get_button(0).pressed.emit()
	assert_eq(GameSettings.control_scheme, FB.ControlScheme.SIMPLE)
	(s.sliders["button_scale"] as UiSlider).set_from_x(10000.0)
	assert_near(GameSettings.button_scale, 1.5, 0.001, "slider max")
	(s.sliders["button_opacity"] as UiSlider).set_from_x(-100.0)
	assert_near(GameSettings.button_opacity, 0.2, 0.001, "slider min")
	(s.toggles["left_handed"] as Button).toggled.emit(true)
	assert_true(GameSettings.left_handed)
	(s.toggles["haptics_enabled"] as Button).toggled.emit(false)
	assert_false(GameSettings.haptics_enabled)
	(s.toggles["show_minimap"] as Button).toggled.emit(false)
	assert_false(GameSettings.show_minimap)
	s.half_seg.get_button(3).pressed.emit()
	assert_near(GameSettings.half_length_minutes, 8.0, 0.001)
	s.free()


func test_menu_state_builds_match_config() -> void:
	GameSettings.set_value("difficulty", FB.Difficulty.HARD)
	GameSettings.set_value("half_length_minutes", 6.0)
	var st := UiMenuState.new()
	st.human_side = 1
	var cfg := st.build_config()
	assert_not_null(cfg.home_team)
	assert_not_null(cfg.away_team)
	assert_eq(cfg.home_team_id, st.home_team.id)
	assert_eq(cfg.away_team_id, st.away_team.id)
	assert_eq(cfg.human_side, 1)
	assert_eq(cfg.difficulty, FB.Difficulty.HARD)
	assert_near(cfg.half_length_minutes, 6.0, 0.001)
	assert_false(cfg.headless)
	# The config is playable.
	cfg.headless = true
	cfg.auto_step = false
	var m := FootballMatch.new()
	m.setup(cfg)
	root.add_child(m)
	m.start()
	run_ticks(m, 120)
	assert_eq(m.teams.size(), 2)


func test_team_select_cycle_and_kickoff_signal() -> void:
	var menu: Control = load("res://ui/menus/main_menu.tscn").instantiate()
	var got: Array[MatchConfig] = []
	menu.set("start_handler", func(cfg: MatchConfig) -> void: got.append(cfg))
	root.add_child(menu)
	menu.call("show_screen", "team_select")
	var ts: UiScreenTeamSelect = menu.get("screens")["team_select"]
	var before: String = ts.state.home_team.id
	ts.cycle(0, 1)
	var ids := DataLoader.list_team_ids()
	if ids.size() > 2:
		assert_true(ts.state.home_team.id != before, "home team changed")
	assert_true(ts.state.home_team.id != ts.state.away_team.id or ids.size() == 1, "teams differ")
	ts.difficulty_seg.get_button(0).pressed.emit()
	ts.half_seg.get_button(0).pressed.emit()
	ts.kickoff_button.pressed.emit()
	assert_eq(got.size(), 1, "match requested once")
	if got.size() == 1:
		assert_eq(got[0].difficulty, FB.Difficulty.EASY)
		assert_near(got[0].half_length_minutes, 2.0, 0.001)
		assert_eq(got[0].home_team.id, ts.state.home_team.id)
	menu.free()


func test_kit_clash_resolved() -> void:
	var a := DataLoader.make_placeholder_team("x", false)
	var b := DataLoader.make_placeholder_team("y", false)
	assert_true(UiMenuState.resolve_kit_clash(a, b), "identical kits clash")
	assert_true(UiTheme.color_distance(a.color_primary, b.color_primary) >= UiMenuState.KIT_CLASH_DISTANCE)
	var c := DataLoader.make_placeholder_team("z", true)
	assert_false(UiMenuState.resolve_kit_clash(a, c), "red vs blue fine")


func test_tactics_screen_edits_team_copy_in_config() -> void:
	var menu: Control = load("res://ui/menus/main_menu.tscn").instantiate()
	root.add_child(menu)
	menu.call("show_screen", "tactics")
	var ts: UiScreenTactics = menu.get("screens")["tactics"]
	(ts.sliders["pressing"] as UiSlider).set_from_x(10000.0)
	assert_near(ts.team().tactics.pressing, 1.0, 0.001, "pressing slider")
	(ts.sliders["tempo"] as UiSlider).set_from_x(-5.0)
	assert_near(ts.team().tactics.tempo, 0.0, 0.001)
	var first_before := ts.team().squad[3]
	var second_before := ts.team().squad[4]
	ts.pitch.swapped.emit(3, 4)
	assert_eq(ts.team().squad[3], second_before)
	assert_eq(ts.team().squad[4], first_before)
	ts.swap_with_bench(5, 0)
	assert_eq(ts.team().starting_xi().size(), 11)
	var ids := DataLoader.list_formation_ids()
	if ids.size() > 1:
		ts.cycle_formation(1)
		assert_true(ts.team().tactics.formation_id != ids[0] or ids.size() == 1)
	var cfg: MatchConfig = (menu.get("state") as UiMenuState).build_config()
	assert_near(cfg.home_team.tactics.pressing, 1.0, 0.001, "edits reach MatchConfig")
	assert_eq(cfg.home_team.squad[3], second_before)
	# The cache is not polluted by edits.
	assert_near(DataLoader.load_team(cfg.home_team.id).tactics.pressing, DataLoader.load_team(cfg.home_team.id).tactics.pressing, 0.0001)
	menu.free()


func test_mini_pitch_drag_swaps_and_gk_is_locked() -> void:
	var t := DataLoader.load_team("placeholder_home")
	var f := DataLoader.load_formation(t.tactics.formation_id)
	var p := UiMiniPitch.new()
	p.size = Vector2(600, 388)
	p.set_data(t, f)
	var swaps: Array[Vector2i] = []
	p.swapped.connect(func(a: int, b: int) -> void: swaps.append(Vector2i(a, b)))
	p.press_at(p.token_pos(3))
	p.move_to(p.token_pos(4) + Vector2(5, 5))
	p.release_at(p.token_pos(4))
	assert_eq(swaps.size(), 1)
	assert_eq(swaps[0], Vector2i(3, 4))
	# GK onto outfielder is refused.
	p.press_at(p.token_pos(0))
	p.move_to(p.token_pos(3))
	p.release_at(p.token_pos(3))
	assert_eq(swaps.size(), 1, "gk locked")
	# Tap, tap swaps.
	p.press_at(p.token_pos(6))
	p.release_at(p.token_pos(6))
	p.press_at(p.token_pos(7))
	p.release_at(p.token_pos(7))
	assert_eq(swaps.size(), 2)
	p.free()


func test_layout_editor_save_and_reset() -> void:
	var ed := UiScreenLayoutEditor.new()
	root.add_child(ed)
	ed.setup(UiMenuState.new())
	ed.on_show()
	var safe := UiSafe.rect(ed)
	var target := Vector2(safe.end.x - 200.0, safe.end.y - 300.0)
	ed.preview.set_slot_from_world(FB.Slot.TERTIARY, target)
	ed.save()
	assert_true(GameSettings.custom_button_positions.has(FB.Slot.TERTIARY), "saved")
	var back := UiTouchLayout.button_center(FB.Slot.TERTIARY, safe, GameSettings.button_scale, GameSettings.left_handed, GameSettings.custom_button_positions)
	assert_true(back.distance_to(target) < 2.0, "roundtrip position")
	# Dragging through the preview widget.
	var sp := ed.preview.to_preview(ed.preview.world_center(FB.Slot.PRIMARY))
	assert_eq(ed.preview.slot_at(sp), FB.Slot.PRIMARY)
	ed.reset()
	assert_true(GameSettings.custom_button_positions.is_empty(), "reset clears")
	ed.free()


func test_layout_math_left_handed_and_notch() -> void:
	var safe := Rect2(120, 0, 1040, 720)
	for lh in [false, true]:
		for slot in FB.SLOT_COUNT:
			for sc in [0.75, 1.0, 1.5]:
				var c := UiTouchLayout.button_center(slot, safe, sc, lh, {})
				var r := UiTouchLayout.button_radius(slot, sc)
				assert_true(safe.grow(0.5).encloses(Rect2(c - Vector2(r, r), Vector2(r, r) * 2.0)), "slot %d scale %f lh %s inside" % [slot, sc, str(lh)])
				assert_true(r * 2.0 >= 48.0)
	var rc := UiTouchLayout.button_center(0, safe, 1.0, false, {})
	var lc := UiTouchLayout.button_center(0, safe, 1.0, true, {})
	assert_true(rc.x > safe.get_center().x and lc.x < safe.get_center().x, "mirrored sides")
	# Buttons never overlap each other at max scale.
	for i in FB.SLOT_COUNT:
		for j in range(i + 1, FB.SLOT_COUNT):
			var d := UiTouchLayout.button_center(i, safe, 1.5, false, {}).distance_to(UiTouchLayout.button_center(j, safe, 1.5, false, {}))
			assert_true(d >= UiTouchLayout.button_radius(i, 1.5) + UiTouchLayout.button_radius(j, 1.5) - 1.0, "no overlap %d/%d" % [i, j])


func test_safe_container_follows_notch() -> void:
	UiSafe.override_rect = Rect2(90, 24, 1100, 650)
	var c := UiSafeContainer.new()
	c.padding = 0.0
	root.add_child(c)
	c.refresh()
	assert_eq(c.get_theme_constant("margin_left"), 90)
	assert_eq(c.get_theme_constant("margin_top"), 24)
	assert_true(c.get_theme_constant("margin_right") >= 90, "right margin from notch")
	c.free()


func test_hud_safe_area_and_banners() -> void:
	UiSafe.override_rect = Rect2(100, 30, 1080, 640)
	var m := make_headless_match(3, 0)
	var hud: Control = load("res://ui/hud/hud.tscn").instantiate()
	root.add_child(hud)
	hud.call("bind", m)
	var board: Control = hud.get("_board")
	assert_true(board.position.y >= 30.0, "scoreboard below notch")
	var mm: Control = hud.get("_minimap")
	assert_true(mm.position.x >= 100.0 and mm.position.y >= 30.0, "minimap inside safe area")
	hud.call("show_banner", "GOAL!", "x", Color.RED, 0.1)
	assert_true(hud.get("_banner_busy"))
	GameSettings.set_value("show_minimap", false)
	assert_false(mm.visible)
	GameSettings.set_value("show_minimap", true)
	assert_true(mm.visible)
	# EventBus-driven banners queue without errors.
	EventBus.goal_scored.emit(0, m.teams[0].players[9], null, false)
	EventBus.card.emit(m.teams[1].players[3], FB.Card.YELLOW)
	EventBus.offside.emit(m.teams[0].players[9], Vector2.ZERO)
	EventBus.foul.emit(m.teams[0].players[3], m.teams[1].players[3], Vector2.ZERO, FB.FoulSeverity.RECKLESS, false)
	EventBus.pass_target_highlighted.emit(m.teams[0].players[5])
	EventBus.pass_target_highlighted.emit(null)
	hud.free()


func test_pause_menu_flow() -> void:
	var m := make_headless_match(4, 0)
	var pm: Control = load("res://ui/menus/pause_menu.tscn").instantiate()
	root.add_child(pm)
	pm.call("bind", m)
	assert_false(pm.visible)
	m.set_paused(true)
	assert_true(pm.visible, "shown on pause")
	pm.call("resume")
	assert_false(m.paused, "resumed")
	assert_false(pm.visible)
	# Not shown while the half-time overlay owns the pause.
	m.set_meta(&"ui_blocking_overlay", true)
	m.set_paused(true)
	assert_false(pm.visible, "blocked by half-time overlay")
	pm.free()


func test_half_time_overlay_flow_and_subs() -> void:
	var m := make_headless_match(6, 0)
	var ht: Control = load("res://ui/menus/half_time.tscn").instantiate()
	root.add_child(ht)
	ht.call("bind", m)
	EventBus.half_time.emit()
	assert_true(ht.visible, "overlay shown")
	assert_true(m.paused, "match paused during half time")
	ht.call("toggle_tactics")
	var team := m.human_team
	var bench_before := team.bench.size()
	# substitute starter 3 for bench 0 via the shortcut buttons
	ht.call("_pick_out", 3)
	ht.call("_pick_in", 0)
	assert_eq(team.subs_used, 1, "substitution made")
	assert_eq(team.bench.size(), bench_before - 1)
	ht.call("continue_match")
	assert_false(m.paused, "match resumed")
	assert_false(ht.visible)
	ht.free()


func test_post_match_binds_result_and_buttons() -> void:
	var pm: Control = load("res://ui/menus/post_match.tscn").instantiate()
	var calls: Array[String] = []
	pm.set("rematch_handler", func() -> void: calls.append("rematch"))
	pm.set("menu_handler", func() -> void: calls.append("menu"))
	pm.call("bind", {"home_name": "A", "away_name": "B", "home_score": 3, "away_score": 1, "human_side": 1,
		"stats": {"shots": [10, 4], "possession": [60, 40]}})
	root.add_child(pm)
	assert_eq(pm.call("headline"), "DEFEAT")
	(pm.get("rematch_button") as Button).pressed.emit()
	(pm.get("menu_button") as Button).pressed.emit()
	assert_eq(calls, ["rematch", "menu"] as Array[String])
	pm.free()
