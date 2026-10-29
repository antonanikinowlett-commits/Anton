class_name TacticsData
extends Resource
## Team tactics. All sliders are 0..1 with 0.5 = balanced.

@export var formation_id: String = "4-4-2"
@export var pressing: float = 0.5      # 0 = drop off, 1 = high press
@export var line_height: float = 0.5   # defensive line depth
@export var width: float = 0.5         # 0 = narrow, 1 = wide
@export var tempo: float = 0.5         # 0 = patient build-up, 1 = direct/fast
@export var mentality: float = 0.5     # 0 = defensive, 1 = attacking (players committed forward)

# Set-piece takers / routines (player ids; "" = auto-pick best stat).
@export var captain_id: String = ""
@export var penalty_taker_id: String = ""
@export var free_kick_taker_id: String = ""
@export var corner_taker_id: String = ""
## Routine ids interpreted by /tactics (e.g. "near_post", "far_post", "short").
@export var corner_routine: String = "far_post"
@export var free_kick_routine: String = "direct"

const SLIDERS: Array[String] = ["pressing", "line_height", "width", "tempo", "mentality"]


static func from_dict(d: Dictionary) -> TacticsData:
	var t := TacticsData.new()
	t.formation_id = str(d.get("formation", t.formation_id))
	for k in SLIDERS:
		if d.has(k):
			t.set(k, clampf(float(d[k]), 0.0, 1.0))
	for k in ["captain_id", "penalty_taker_id", "free_kick_taker_id", "corner_taker_id", "corner_routine", "free_kick_routine"]:
		if d.has(k):
			t.set(k, str(d[k]))
	return t


func to_dict() -> Dictionary:
	var d := {"formation": formation_id}
	for k in SLIDERS:
		d[k] = get(k)
	for k in ["captain_id", "penalty_taker_id", "free_kick_taker_id", "corner_taker_id", "corner_routine", "free_kick_routine"]:
		d[k] = get(k)
	return d
