extends Control
## Fallback HUD used until res://ui/hud/hud.tscn exists: score, clock, context.

var football_match: FootballMatch
var _label: Label


func bind(m: FootballMatch) -> void:
	football_match = m


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label = Label.new()
	_label.position = Vector2(24, 16)
	_label.add_theme_font_size_override("font_size", 28)
	_label.add_theme_color_override("font_outline_color", Color.BLACK)
	_label.add_theme_constant_override("outline_size", 6)
	add_child(_label)
	var help := Label.new()
	help.text = "WASD move | J pass/tackle | K through/slide | L shoot(hold)/switch | I skill/press | Shift sprint | Q switch | Esc pause"
	help.add_theme_font_size_override("font_size", 16)
	help.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	help.position = Vector2(24, -40)
	add_child(help)


func _process(_delta: float) -> void:
	if football_match == null or football_match.referee == null:
		return
	var m := football_match
	var ctx_name: String = FB.Context.keys()[m.control_context]
	_label.text = "%s %d - %d %s   %s   [%s]%s" % [
		m.teams[0].data.short_name, m.teams[0].score, m.teams[1].score, m.teams[1].data.short_name,
		m.referee.get_clock_text(), ctx_name, "   PAUSED (Esc)" if m.paused else ""]


func _unhandled_input(event: InputEvent) -> void:
	if football_match != null and football_match.paused and event.is_action_pressed(&"fb_pause"):
		football_match.set_paused(false)
		get_viewport().set_input_as_handled()
