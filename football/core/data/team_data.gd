class_name TeamData
extends Resource
## Static squad data. squad[0..10] is the starting XI in formation slot order
## (index 0 = GK), the rest is the bench.

@export var id: String = ""
@export var name: String = "Team"
@export var short_name: String = "TEA"
@export var color_primary: Color = Color.RED
@export var color_secondary: Color = Color.WHITE
@export var color_goalkeeper: Color = Color.GREEN
@export var tactics: TacticsData = TacticsData.new()
@export var squad: Array[PlayerData] = []


func starting_xi() -> Array[PlayerData]:
	var out: Array[PlayerData] = []
	for i in mini(11, squad.size()):
		out.append(squad[i])
	return out


func bench() -> Array[PlayerData]:
	var out: Array[PlayerData] = []
	for i in range(11, squad.size()):
		out.append(squad[i])
	return out


func find_player(player_id: String) -> PlayerData:
	for p: PlayerData in squad:
		if p.id == player_id:
			return p
	return null


static func from_dict(d: Dictionary) -> TeamData:
	var t := TeamData.new()
	t.id = str(d.get("id", ""))
	t.name = str(d.get("name", t.id))
	t.short_name = str(d.get("short_name", t.name.substr(0, 3).to_upper()))
	var colors: Dictionary = d.get("colors", {})
	t.color_primary = Color.from_string(str(colors.get("primary", "#d62828")), Color.RED)
	t.color_secondary = Color.from_string(str(colors.get("secondary", "#ffffff")), Color.WHITE)
	t.color_goalkeeper = Color.from_string(str(colors.get("goalkeeper", "#2a9d8f")), Color.GREEN)
	var tactics_dict: Dictionary = d.get("tactics", {})
	if d.has("formation") and not tactics_dict.has("formation"):
		tactics_dict["formation"] = d["formation"]
	t.tactics = TacticsData.from_dict(tactics_dict)
	var players: Array = d.get("players", [])
	for pd in players:
		t.squad.append(PlayerData.from_dict(pd))
	# Optional explicit XI ordering by id (formation slot order).
	var xi_ids: Array = d.get("starting_xi", [])
	if xi_ids.size() == 11:
		var ordered: Array[PlayerData] = []
		for pid in xi_ids:
			var p := t.find_player(str(pid))
			if p != null:
				ordered.append(p)
		for p: PlayerData in t.squad:
			if p not in ordered:
				ordered.append(p)
		t.squad = ordered
	return t


func to_dict() -> Dictionary:
	var players := []
	for p: PlayerData in squad:
		players.append(p.to_dict())
	return {
		"id": id, "name": name, "short_name": short_name,
		"colors": {
			"primary": "#" + color_primary.to_html(false),
			"secondary": "#" + color_secondary.to_html(false),
			"goalkeeper": "#" + color_goalkeeper.to_html(false),
		},
		"tactics": tactics.to_dict(),
		"players": players,
	}
