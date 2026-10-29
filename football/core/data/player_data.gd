class_name PlayerData
extends Resource
## Static data for one footballer. Stats are 1..99 (FIFA-like). Use stat01() for 0..1.

@export var id: String = ""
@export var name: String = "Player"
@export var number: int = 0
@export var role: int = FB.Role.CM          # natural position, FB.Role
@export var preferred_foot: String = "R"    # "R" or "L"
@export var height_cm: int = 180

@export var pace: int = 60          # top speed
@export var acceleration: int = 60
@export var stamina: int = 60       # drain resistance
@export var agility: int = 60       # turning
@export var strength: int = 60      # shielding, duels
@export var passing: int = 60
@export var vision: int = 60        # AI pass selection quality
@export var shooting: int = 60      # finishing accuracy/power
@export var dribbling: int = 60     # close control at speed
@export var control: int = 60       # first touch
@export var tackling: int = 60
@export var positioning: int = 60   # off-ball (attack & defence)
@export var aggression: int = 50    # foul tendency
@export var goalkeeping: int = 20   # GK handling/diving/positioning
@export var reflexes: int = 20      # GK reaction

const STAT_KEYS: Array[String] = [
	"pace", "acceleration", "stamina", "agility", "strength", "passing", "vision",
	"shooting", "dribbling", "control", "tackling", "positioning", "aggression",
	"goalkeeping", "reflexes",
]


func stat01(stat: String) -> float:
	return clampf(float(get(stat)) / 99.0, 0.0, 1.0)


func overall() -> int:
	var total := 0
	for k in STAT_KEYS:
		total += int(get(k))
	return int(total / float(STAT_KEYS.size()))


static func from_dict(d: Dictionary) -> PlayerData:
	var p := PlayerData.new()
	p.id = str(d.get("id", ""))
	p.name = str(d.get("name", "Player"))
	p.number = int(d.get("number", 0))
	p.role = FB.role_from_string(str(d.get("role", "CM")))
	p.preferred_foot = str(d.get("foot", "R"))
	p.height_cm = int(d.get("height_cm", 180))
	var stats: Dictionary = d.get("stats", {})
	for k in STAT_KEYS:
		if stats.has(k):
			p.set(k, clampi(int(stats[k]), 1, 99))
	return p


func to_dict() -> Dictionary:
	var stats := {}
	for k in STAT_KEYS:
		stats[k] = get(k)
	return {
		"id": id, "name": name, "number": number, "role": FB.role_to_string(role),
		"foot": preferred_foot, "height_cm": height_cm, "stats": stats,
	}
