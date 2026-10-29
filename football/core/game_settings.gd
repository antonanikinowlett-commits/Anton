extends Node
## Persistent user settings (autoload "GameSettings"). Owned by core.
## UI edits values through set_value(); everyone else reads the properties.

signal changed(key: String)

const SAVE_PATH := "user://settings.cfg"
const SECTION := "settings"

var control_scheme: int = FB.ControlScheme.PRO
var difficulty: int = FB.Difficulty.MEDIUM
## Real-time minutes per half.
var half_length_minutes: float = 4.0
## Touch button scale multiplier (0.75 .. 1.5) applied to the 48dp+ base size.
var button_scale: float = 1.0
## Touch control opacity (0.2 .. 1.0).
var button_opacity: float = 0.6
## Swap joystick to the right and buttons to the left.
var left_handed: bool = false
var haptics_enabled: bool = true
## 0 = no assist, 1 = strong assist for passes/shots.
var aim_assist: float = 0.6
var show_minimap: bool = true
var sfx_volume: float = 0.8
## Optional custom button positions from the layout editor: slot(int) -> Vector2 (normalized 0..1 of the right control zone).
var custom_button_positions: Dictionary = {}

const KEYS: Array[String] = [
	"control_scheme", "difficulty", "half_length_minutes", "button_scale",
	"button_opacity", "left_handed", "haptics_enabled", "aim_assist",
	"show_minimap", "sfx_volume", "custom_button_positions",
]


func _ready() -> void:
	load_settings()


func set_value(key: String, value: Variant) -> void:
	if not key in KEYS:
		push_error("GameSettings: unknown key %s" % key)
		return
	set(key, value)
	save_settings()
	changed.emit(key)


func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return
	for key in KEYS:
		if cfg.has_section_key(SECTION, key):
			set(key, cfg.get_value(SECTION, key))


func save_settings() -> void:
	var cfg := ConfigFile.new()
	for key in KEYS:
		cfg.set_value(SECTION, key, get(key))
	cfg.save(SAVE_PATH)


func reset_to_defaults() -> void:
	control_scheme = FB.ControlScheme.PRO
	difficulty = FB.Difficulty.MEDIUM
	half_length_minutes = 4.0
	button_scale = 1.0
	button_opacity = 0.6
	left_handed = false
	haptics_enabled = true
	aim_assist = 0.6
	show_minimap = true
	sfx_volume = 0.8
	custom_button_positions = {}
	save_settings()
	changed.emit("")
