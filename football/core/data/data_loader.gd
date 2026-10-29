class_name DataLoader
extends RefCounted
## Loads team/formation JSON owned by /tactics. Index file avoids directory
## listing (unreliable in exported builds):
##   res://tactics/data/index.json = {"teams": ["reds", ...], "formations": ["4-4-2", ...]}
##   res://tactics/data/teams/<id>.json, res://tactics/data/formations/<id>.json
## If data is missing, built-in placeholder teams/formation are generated so the
## stub match always runs.

const DATA_DIR := "res://tactics/data/"
const INDEX_PATH := DATA_DIR + "index.json"

static var _team_cache: Dictionary = {}
static var _formation_cache: Dictionary = {}


static func read_json(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	var text := FileAccess.get_file_as_string(path)
	var parsed: Variant = JSON.parse_string(text)
	if parsed == null:
		push_error("DataLoader: invalid JSON in %s" % path)
	return parsed


static func get_index() -> Dictionary:
	var idx: Variant = read_json(INDEX_PATH)
	if idx is Dictionary:
		return idx
	return {"teams": [], "formations": []}


static func list_team_ids() -> PackedStringArray:
	var out := PackedStringArray()
	var teams: Array = get_index().get("teams", [])
	for t in teams:
		out.append(str(t))
	if out.is_empty():
		out.append("placeholder_home")
		out.append("placeholder_away")
	return out


static func list_formation_ids() -> PackedStringArray:
	var out := PackedStringArray()
	var forms: Array = get_index().get("formations", [])
	for f in forms:
		out.append(str(f))
	if out.is_empty():
		out.append("4-4-2")
	return out


## Returns a fresh copy each call so match-time edits never leak into the cache.
static func load_team(team_id: String) -> TeamData:
	if not _team_cache.has(team_id):
		var d: Variant = read_json(DATA_DIR + "teams/%s.json" % team_id)
		if d is Dictionary:
			_team_cache[team_id] = d
	if _team_cache.has(team_id):
		return TeamData.from_dict(_team_cache[team_id])
	return make_placeholder_team(team_id, team_id != "placeholder_home")


static func load_formation(formation_id: String) -> FormationData:
	if not _formation_cache.has(formation_id):
		var d: Variant = read_json(DATA_DIR + "formations/%s.json" % formation_id)
		if d is Dictionary:
			_formation_cache[formation_id] = FormationData.from_dict(d)
	if _formation_cache.has(formation_id):
		return _formation_cache[formation_id]
	return make_placeholder_formation()


static func clear_cache() -> void:
	_team_cache.clear()
	_formation_cache.clear()


# --- Placeholders (stub data, replaced by /tactics data) -------------------
static func make_placeholder_formation() -> FormationData:
	return FormationData.from_dict({
		"id": "4-4-2", "name": "4-4-2",
		"slots": [
			{"role": "GK", "x": 0.03, "y": 0.5},
			{"role": "LB", "x": 0.22, "y": 0.12},
			{"role": "CB", "x": 0.2, "y": 0.38},
			{"role": "CB", "x": 0.2, "y": 0.62},
			{"role": "RB", "x": 0.22, "y": 0.88},
			{"role": "LM", "x": 0.42, "y": 0.12},
			{"role": "CM", "x": 0.4, "y": 0.4},
			{"role": "CM", "x": 0.4, "y": 0.6},
			{"role": "RM", "x": 0.42, "y": 0.88},
			{"role": "ST", "x": 0.58, "y": 0.4},
			{"role": "ST", "x": 0.58, "y": 0.6},
		],
	})


static func make_placeholder_team(team_id: String, away: bool) -> TeamData:
	var f := make_placeholder_formation()
	var players := []
	for i in 16:
		var role := "GK" if i == 0 or i == 11 else FB.role_to_string(f.roles[i]) if i < 11 else "CM"
		players.append({
			"id": "%s_%d" % [team_id, i + 1], "name": "Player %d" % (i + 1), "number": i + 1,
			"role": role,
			"stats": {"goalkeeping": 70 if role == "GK" else 20, "reflexes": 70 if role == "GK" else 20},
		})
	return TeamData.from_dict({
		"id": team_id,
		"name": "Blues" if away else "Reds",
		"short_name": "BLU" if away else "RED",
		"colors": {
			"primary": "#1d4ed8" if away else "#d62828",
			"secondary": "#ffffff",
			"goalkeeper": "#f59e0b" if away else "#16a34a",
		},
		"tactics": {"formation": "4-4-2"},
		"players": players,
	})
