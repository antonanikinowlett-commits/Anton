extends Control
## Pause overlay (scene slot "pause_menu"). Shown on EventBus.match_paused(true).
## RESUME / RESTART / SETTINGS / QUIT TO MENU. All actions go through Game.

var football_match: FootballMatch
var panel_box: VBoxContainer
var resume_button: Button
var restart_button: Button
var settings_button: Button
var quit_button: Button
var settings_screen: UiScreenSettings
## Overridable for tests.
var restart_handler: Callable
var quit_handler: Callable

var _main: Control
var _connected := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_STOP
	UiTheme.apply(self)
	if not restart_handler.is_valid():
		restart_handler = Callable(Game, "restart_match")
	if not quit_handler.is_valid():
		quit_handler = Callable(Game, "quit_match")
	_build()
	visible = false
	EventBus.match_paused.connect(_on_paused)
	_connected = true


func _exit_tree() -> void:
	if _connected:
		_connected = false
		EventBus.match_paused.disconnect(_on_paused)


func _build() -> void:
	var dim := PanelContainer.new()
	dim.theme_type_variation = &"DimPanel"
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)

	_main = Control.new()
	_main.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_main.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_main)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_main.add_child(center)
	panel_box = VBoxContainer.new()
	panel_box.custom_minimum_size = Vector2(520, 0)
	panel_box.add_theme_constant_override("separation", 16)
	center.add_child(panel_box)
	var title := UiScreen.label("PAUSED", &"TitleLabel")
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	panel_box.add_child(title)
	resume_button = UiBigButton.make("RESUME", &"AccentButton", 520.0)
	resume_button.custom_minimum_size = Vector2(520, 84)
	resume_button.pressed.connect(resume)
	panel_box.add_child(resume_button)
	restart_button = UiBigButton.make("RESTART MATCH", &"", 520.0)
	restart_button.pressed.connect(func() -> void: restart_handler.call())
	panel_box.add_child(restart_button)
	settings_button = UiBigButton.make("SETTINGS", &"", 520.0)
	settings_button.pressed.connect(func() -> void: _show_settings(true))
	panel_box.add_child(settings_button)
	quit_button = UiBigButton.make("QUIT TO MENU", &"DangerButton", 520.0)
	quit_button.pressed.connect(func() -> void: quit_handler.call())
	panel_box.add_child(quit_button)

	settings_screen = UiScreenSettings.new()
	settings_screen.back_target = "close"
	add_child(settings_screen)
	settings_screen.setup(UiMenuState.new())
	settings_screen.editor_button.visible = false
	settings_screen.navigate.connect(func(target: String) -> void:
		if target == "close":
			_show_settings(false))
	settings_screen.visible = false
	# Opaque backdrop for the settings page so the pitch does not show through.
	var bg := ColorRect.new()
	bg.color = Color(UiTheme.BG, 0.96)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	settings_screen.add_child(bg)
	settings_screen.move_child(bg, 0)


## Binds to a match.
func bind(m: FootballMatch) -> void:
	football_match = m
	if m.paused and not _blocked():
		_show_pause()


func _blocked() -> bool:
	return football_match != null and football_match.has_meta(&"ui_blocking_overlay") and bool(football_match.get_meta(&"ui_blocking_overlay"))


func _on_paused(is_paused: bool) -> void:
	if is_paused and not _blocked():
		_show_pause()
	elif not is_paused:
		visible = false
		_show_settings(false)


func _show_pause() -> void:
	visible = true
	_show_settings(false)


func _show_settings(on: bool) -> void:
	settings_screen.visible = on
	_main.visible = not on
	if on:
		settings_screen.on_show()


## Closes the menu and resumes play.
func resume() -> void:
	visible = false
	if football_match != null:
		football_match.set_paused(false)
		# Drop key edges that arrived while paused (e.g. the Esc press that closed us).
		if football_match.human_input != null:
			football_match.human_input.release_all()
			football_match.human_input.end_tick()


func _unhandled_input(event: InputEvent) -> void:
	if visible and InputMap.has_action(&"fb_pause") and event.is_action_pressed(&"fb_pause"):
		if settings_screen.visible:
			_show_settings(false)
		else:
			resume()
		get_viewport().set_input_as_handled()
