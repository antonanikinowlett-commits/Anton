extends Control
## Main menu root (scene slot "main_menu"). Hosts the screens: home, team select,
## tactics, settings and the button layout editor. All touch-only friendly.

## Screen shown on start (tests / screenshots).
@export var start_screen: String = "home"
## Called with the built MatchConfig on KICK OFF. Defaults to Game.start_match.
var start_handler: Callable

var state: UiMenuState
var screens: Dictionary = {}
var current: String = ""


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	UiTheme.apply(self)
	if not start_handler.is_valid():
		start_handler = Callable(Game, "start_match")
	state = UiMenuState.new()
	add_child(UiMenuBackground.new())

	_add_screen("home", UiScreenHome.new())
	_add_screen("team_select", UiScreenTeamSelect.new())
	_add_screen("tactics", UiScreenTactics.new())
	_add_screen("settings", UiScreenSettings.new())
	_add_screen("layout_editor", UiScreenLayoutEditor.new())
	(screens["home"] as UiScreenHome).quit_requested.connect(_on_quit)
	(screens["team_select"] as UiScreenTeamSelect).match_requested.connect(_on_match_requested)
	show_screen(start_screen)


func _add_screen(id: String, s: UiScreen) -> void:
	s.name = id
	add_child(s)
	s.setup(state)
	s.navigate.connect(show_screen)
	s.visible = false
	screens[id] = s


## Switches to a screen by id.
func show_screen(id: String) -> void:
	if not screens.has(id):
		return
	for k: String in screens.keys():
		(screens[k] as UiScreen).visible = k == id
	current = id
	(screens[id] as UiScreen).on_show()


func _on_match_requested(cfg: MatchConfig) -> void:
	start_handler.call(cfg)


func _on_quit() -> void:
	get_tree().quit()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST and current != "home" and current != "":
		show_screen("settings" if current == "layout_editor" else "home")
