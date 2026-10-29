class_name UiTheme
extends RefCounted
## Builds the shared UI Theme in code (no external assets).
## High-contrast dark / green palette, large fonts, big touch-friendly buttons.

const BG := Color("07130d")
const PANEL := Color("11291b")
const PANEL_LIGHT := Color("1a3d29")
const ACCENT := Color("2ee06f")
const ACCENT_DARK := Color("1a9b4b")
const TEXT := Color("f4fff7")
const MUTED := Color("9cbba8")
const DANGER := Color("e5484d")
const WARN := Color("f5c542")
const BORDER := Color("2c5a40")

const FONT_BODY := 24
const FONT_BUTTON := 28
const FONT_HEADER := 32
const FONT_TITLE := 48
const BUTTON_HEIGHT := 72.0

static var _cached: Theme


## Returns the shared theme (built once).
static func get_theme() -> Theme:
	if _cached == null:
		_cached = build()
	return _cached


## Applies the shared theme to a control subtree root.
static func apply(c: Control) -> void:
	c.theme = get_theme()


static func box(bg: Color, border: Color = Color(0, 0, 0, 0), radius: int = 16, border_w: int = 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.border_color = border
	s.set_border_width_all(border_w)
	s.content_margin_left = 20.0
	s.content_margin_right = 20.0
	s.content_margin_top = 10.0
	s.content_margin_bottom = 10.0
	return s


static func build() -> Theme:
	var t := Theme.new()
	t.default_font_size = FONT_BODY
	# Labels
	t.set_font_size("font_size", "Label", FONT_BODY)
	t.set_color("font_color", "Label", TEXT)
	t.set_color("font_outline_color", "Label", Color(0, 0, 0, 0.8))
	t.set_type_variation("TitleLabel", "Label")
	t.set_font_size("font_size", "TitleLabel", FONT_TITLE)
	t.set_type_variation("HeaderLabel", "Label")
	t.set_font_size("font_size", "HeaderLabel", FONT_HEADER)
	t.set_color("font_color", "HeaderLabel", ACCENT)
	t.set_type_variation("MutedLabel", "Label")
	t.set_color("font_color", "MutedLabel", MUTED)
	# Buttons
	_button_styles(t, "Button", PANEL_LIGHT, BORDER, TEXT)
	t.set_type_variation("AccentButton", "Button")
	_button_styles(t, "AccentButton", ACCENT_DARK, ACCENT, TEXT)
	t.set_type_variation("DangerButton", "Button")
	_button_styles(t, "DangerButton", Color("8f2a2e"), DANGER, TEXT)
	t.set_type_variation("ToggleButton", "Button")
	_button_styles(t, "ToggleButton", PANEL, BORDER, MUTED)
	t.set_stylebox("pressed", "ToggleButton", box(ACCENT_DARK, ACCENT, 14, 3))
	t.set_stylebox("hover_pressed", "ToggleButton", box(ACCENT_DARK, ACCENT, 14, 3))
	t.set_color("font_pressed_color", "ToggleButton", TEXT)
	t.set_color("font_hover_pressed_color", "ToggleButton", TEXT)
	# Panels
	t.set_stylebox("panel", "PanelContainer", box(PANEL, BORDER, 20, 2))
	t.set_type_variation("DimPanel", "PanelContainer")
	t.set_stylebox("panel", "DimPanel", box(Color(0.01, 0.04, 0.02, 0.93), Color(0, 0, 0, 0), 0, 0))
	t.set_constant("separation", "VBoxContainer", 14)
	t.set_constant("separation", "HBoxContainer", 14)
	t.set_constant("h_separation", "GridContainer", 18)
	t.set_constant("v_separation", "GridContainer", 14)
	return t


static func _button_styles(t: Theme, type_name: String, bg: Color, border: Color, font: Color) -> void:
	t.set_font_size("font_size", type_name, FONT_BUTTON)
	t.set_color("font_color", type_name, font)
	t.set_color("font_hover_color", type_name, font)
	t.set_color("font_pressed_color", type_name, font)
	t.set_color("font_focus_color", type_name, font)
	t.set_color("font_disabled_color", type_name, MUTED)
	t.set_stylebox("normal", type_name, box(bg, border, 14, 2))
	t.set_stylebox("hover", type_name, box(bg.lightened(0.08), border, 14, 2))
	t.set_stylebox("pressed", type_name, box(bg.lightened(0.25), ACCENT, 14, 4))
	t.set_stylebox("disabled", type_name, box(bg.darkened(0.4), border.darkened(0.3), 14, 2))
	t.set_stylebox("focus", type_name, StyleBoxEmpty.new())
	t.set_constant("h_separation", type_name, 12)


## Perceptual-ish color distance (0 = identical, ~1 = black vs white).
static func color_distance(a: Color, b: Color) -> float:
	var rm := (a.r + b.r) * 0.5
	var dr := a.r - b.r
	var dg := a.g - b.g
	var db := a.b - b.b
	return sqrt((2.0 + rm) * dr * dr + 4.0 * dg * dg + (3.0 - rm) * db * db) / 3.0
