class_name UiStatsTable
extends GridContainer
## Home | stat | Away comparison table built from UiStatsTracker.to_dict() data.

const ROWS: Array = [
	["possession", "POSSESSION %"], ["shots", "SHOTS"], ["shots_on_target", "ON TARGET"],
	["corners", "CORNERS"], ["fouls", "FOULS"], ["yellow_cards", "YELLOW CARDS"],
	["red_cards", "RED CARDS"], ["offsides", "OFFSIDES"],
]


## Builds the table. `keys` limits/orders the rows (defaults to all).
static func make(stats: Dictionary, keys: Array = []) -> UiStatsTable:
	var t := UiStatsTable.new()
	t.columns = 3
	t.add_theme_constant_override("h_separation", 24)
	t.add_theme_constant_override("v_separation", 6)
	for row: Array in ROWS:
		if not keys.is_empty() and not (row[0] in keys):
			continue
		var vals: Array = stats.get(row[0], [50, 50] if row[0] == "possession" else [0, 0])
		t.add_child(_cell(_fmt(row[0], vals[0]), HORIZONTAL_ALIGNMENT_RIGHT, 110.0, false))
		t.add_child(_cell(row[1], HORIZONTAL_ALIGNMENT_CENTER, 250.0, true))
		t.add_child(_cell(_fmt(row[0], vals[1]), HORIZONTAL_ALIGNMENT_LEFT, 110.0, false))
	return t


static func _fmt(key: String, v: Variant) -> String:
	if key == "possession":
		return "%d" % int(round(float(v)))
	return str(int(v))


static func _cell(text: String, align: HorizontalAlignment, w: float, muted: bool) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.custom_minimum_size = Vector2(w, 0.0)
	if muted:
		l.theme_type_variation = &"MutedLabel"
	else:
		l.add_theme_font_size_override("font_size", 28)
	return l
