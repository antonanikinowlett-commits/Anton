class_name UiScreenTactics
extends UiScreen
## Formation and tactics editor. Edits the TeamData copy that goes into MatchConfig.

const SLIDER_LABELS: Dictionary = {
	"pressing": "PRESSING", "line_height": "LINE HEIGHT", "width": "WIDTH",
	"tempo": "TEMPO", "mentality": "MENTALITY",
}

var pitch: UiMiniPitch
var formation_label: Label
var team_label: Label
var sliders: Dictionary = {}
var value_labels: Dictionary = {}
var bench_row: HBoxContainer
var bench_selected: int = -1
var _bench_buttons: Array[Button] = []


func build() -> void:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	content.add_child(v)
	v.add_child(make_header("TACTICS"))

	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 24)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(body)

	# Left: team + pitch + bench.
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(580, 0)
	left.add_theme_constant_override("separation", 8)
	body.add_child(left)
	var trow := HBoxContainer.new()
	left.add_child(trow)
	var team_btn := UiBigButton.make("", &"", 200.0)
	team_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	team_btn.custom_minimum_size = Vector2(300, 64)
	team_btn.pressed.connect(cycle_team)
	trow.add_child(team_btn)
	team_label = UiScreen.label("")
	team_btn.add_child(team_label)
	team_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	team_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	team_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	team_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pitch = UiMiniPitch.new()
	pitch.custom_minimum_size = Vector2(580, 372)
	pitch.swapped.connect(_on_swapped)
	pitch.slot_tapped.connect(_on_slot_tapped)
	left.add_child(pitch)
	var hint := UiScreen.label("Drag a player onto another to swap. Tap a bench number, then a player.", &"MutedLabel")
	hint.add_theme_font_size_override("font_size", 20)
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.custom_minimum_size = Vector2(560, 0)
	left.add_child(hint)
	bench_row = HBoxContainer.new()
	bench_row.add_theme_constant_override("separation", 8)
	left.add_child(bench_row)

	# Right: formation + sliders.
	var right := VBoxContainer.new()
	right.add_theme_constant_override("separation", 8)
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(right)
	var frow := HBoxContainer.new()
	right.add_child(frow)
	var fprev := UiBigButton.make("<", &"", 72.0)
	fprev.pressed.connect(func() -> void: cycle_formation(-1))
	frow.add_child(fprev)
	formation_label = UiScreen.label("4-4-2", &"HeaderLabel")
	formation_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	formation_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	formation_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	frow.add_child(formation_label)
	var fnext := UiBigButton.make(">", &"", 72.0)
	fnext.pressed.connect(func() -> void: cycle_formation(1))
	frow.add_child(fnext)
	for key: String in TacticsData.SLIDERS:
		var r := HBoxContainer.new()
		right.add_child(r)
		var l := UiScreen.label(SLIDER_LABELS[key], &"", 190.0)
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		r.add_child(l)
		var s := UiSlider.make(0.0, 1.0, 0.5, 0.05)
		s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		s.value_changed.connect(_on_slider.bind(key))
		r.add_child(s)
		var vl := UiScreen.label("50", &"MutedLabel", 52.0)
		vl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		vl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		r.add_child(vl)
		sliders[key] = s
		value_labels[key] = vl
	var reset := UiBigButton.make("RESET TEAM", &"", 240.0)
	reset.pressed.connect(reset_team)
	right.add_child(reset)
	refresh()


func on_show() -> void:
	refresh()


## The team being edited.
func team() -> TeamData:
	return state.user_team()


## Re-reads everything from state.
func refresh() -> void:
	var t := team()
	team_label.text = "%s (%s) - tap to change" % [t.name, "HOME" if state.human_side == 0 else "AWAY"]
	var f := DataLoader.load_formation(t.tactics.formation_id)
	formation_label.text = f.name if f.name != "" else f.id
	pitch.set_data(t, f)
	for key: String in TacticsData.SLIDERS:
		var s: UiSlider = sliders[key]
		s.value = float(t.tactics.get(key))
		(value_labels[key] as Label).text = str(int(round(s.value * 100.0)))
	_rebuild_bench()


func _rebuild_bench() -> void:
	for c in bench_row.get_children():
		c.queue_free()
	_bench_buttons.clear()
	bench_selected = -1
	var bench := team().bench()
	for i in mini(bench.size(), 8):
		var b := UiBigButton.make("#%d" % bench[i].number, &"ToggleButton", 64.0)
		b.custom_minimum_size = Vector2(64, 56)
		b.toggle_mode = true
		b.add_theme_font_size_override("font_size", 22)
		b.pressed.connect(_on_bench_pressed.bind(i))
		bench_row.add_child(b)
		_bench_buttons.append(b)


func _on_bench_pressed(i: int) -> void:
	bench_selected = i if bench_selected != i else -1
	for k in _bench_buttons.size():
		_bench_buttons[k].set_pressed_no_signal(k == bench_selected)


func _on_slot_tapped(slot: int) -> void:
	if bench_selected >= 0:
		swap_with_bench(slot, bench_selected)
		pitch.selected_slot = -1
		_rebuild_bench()


func _on_swapped(a: int, b: int) -> void:
	swap_slots(a, b)


## Swaps the players assigned to two formation slots.
func swap_slots(a: int, b: int) -> void:
	var t := team()
	if a == b or a >= t.squad.size() or b >= t.squad.size():
		return
	var tmp := t.squad[a]
	t.squad[a] = t.squad[b]
	t.squad[b] = tmp
	pitch.queue_redraw()


## Swaps a starter with a bench player (bench index into TeamData.bench()).
func swap_with_bench(slot: int, bench_idx: int) -> void:
	var t := team()
	var si := 11 + bench_idx
	if slot >= t.squad.size() or si >= t.squad.size():
		return
	var tmp := t.squad[slot]
	t.squad[slot] = t.squad[si]
	t.squad[si] = tmp
	pitch.queue_redraw()


## Selects the next/previous formation.
func cycle_formation(dir: int) -> void:
	var ids := DataLoader.list_formation_ids()
	var cur := ids.find(team().tactics.formation_id)
	var nxt := posmod(cur + dir, ids.size())
	set_formation(ids[nxt])


## Applies a formation id to the edited team.
func set_formation(id: String) -> void:
	team().tactics.formation_id = id
	var f := DataLoader.load_formation(id)
	formation_label.text = f.name if f.name != "" else f.id
	pitch.set_data(team(), f)


func _on_slider(v: float, key: String) -> void:
	team().tactics.set(key, v)
	(value_labels[key] as Label).text = str(int(round(v * 100.0)))


## Changes the edited team (cycles the user's team in the shared state).
func cycle_team() -> void:
	state.cycle_team(state.human_side, 1)
	refresh()


## Discards edits for the user's team.
func reset_team() -> void:
	state.reload_team(state.human_side)
	refresh()
