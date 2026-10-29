class_name UiMenuState
extends RefCounted
## Shared state of the main menu flow: chosen teams (editable copies), side, and the
## MatchConfig builder. Tactics edits go into the TeamData copies placed in the config.

const KIT_CLASH_DISTANCE := 0.22

var team_ids: PackedStringArray = PackedStringArray()
var home_idx: int = 0
var away_idx: int = 1
## 0 = human plays home, 1 = away.
var human_side: int = 0
var home_team: TeamData
var away_team: TeamData


func _init() -> void:
	team_ids = DataLoader.list_team_ids()
	away_idx = mini(1, team_ids.size() - 1)
	reload_team(0)
	reload_team(1)


func idx_for(side: int) -> int:
	return home_idx if side == 0 else away_idx


## Loads a fresh copy of the team currently selected for a side (discarding edits).
func reload_team(side: int) -> void:
	var id := team_ids[idx_for(side)]
	if side == 0:
		home_team = DataLoader.load_team(id)
	else:
		away_team = DataLoader.load_team(id)


## Moves a side's selection by dir (+1 / -1), skipping the opponent's team when possible.
func cycle_team(side: int, dir: int) -> void:
	var n := team_ids.size()
	if n == 0:
		return
	var other := away_idx if side == 0 else home_idx
	var i := idx_for(side)
	for _k in n:
		i = posmod(i + dir, n)
		if i != other or n == 1:
			break
	if side == 0:
		home_idx = i
	else:
		away_idx = i
	reload_team(side)


func team_for(side: int) -> TeamData:
	return home_team if side == 0 else away_team


## Team edited by the tactics screen (the human's team).
func user_team() -> TeamData:
	return team_for(human_side)


## Average overall rating of the starting XI.
static func rating(t: TeamData) -> int:
	var xi := t.starting_xi()
	if xi.is_empty():
		return 0
	var total := 0
	for p: PlayerData in xi:
		total += p.overall()
	return int(round(total / float(xi.size())))


## If the away kit is too close to the home kit, switch the away team to an alternate
## colour (its secondary or goalkeeper colour). Returns true when a change was made.
static func resolve_kit_clash(home: TeamData, away: TeamData) -> bool:
	if UiTheme.color_distance(home.color_primary, away.color_primary) >= KIT_CLASH_DISTANCE:
		return false
	for cand: Color in [away.color_secondary, away.color_goalkeeper, Color.WHITE, Color.BLACK]:
		if UiTheme.color_distance(home.color_primary, cand) >= KIT_CLASH_DISTANCE:
			away.color_secondary = away.color_primary
			away.color_primary = cand
			return true
	return false


## Builds the MatchConfig for the current selection and GameSettings.
func build_config() -> MatchConfig:
	var cfg := MatchConfig.new()
	cfg.home_team_id = home_team.id
	cfg.away_team_id = away_team.id
	cfg.home_team = home_team
	cfg.away_team = away_team
	resolve_kit_clash(home_team, away_team)
	cfg.human_side = human_side
	cfg.difficulty = GameSettings.difficulty
	cfg.half_length_minutes = GameSettings.half_length_minutes
	return cfg
