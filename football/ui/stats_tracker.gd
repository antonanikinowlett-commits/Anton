class_name UiStatsTracker
extends Node
## Aggregates match statistics from EventBus signals. Instantiated by the HUD
## (or lazily via ensure_for()). Read by half-time / post-match screens.
## Per-team arrays are indexed by team id (0 home, 1 away).

## Last snapshot, kept after the match node is freed so post-match can read it.
static var last_stats: Dictionary = {}

var football_match: FootballMatch
var shots: Array[int] = [0, 0]
var shots_on_target: Array[int] = [0, 0]
var fouls: Array[int] = [0, 0]
var yellow_cards: Array[int] = [0, 0]
var red_cards: Array[int] = [0, 0]
var offsides: Array[int] = [0, 0]
var corners: Array[int] = [0, 0]
var saves: Array[int] = [0, 0]
var passes: Array[int] = [0, 0]
var tackles: Array[int] = [0, 0]
var tackles_won: Array[int] = [0, 0]
var goals: Array[int] = [0, 0]
## Seconds of possession per team.
var possession_time: Array[float] = [0.0, 0.0]
## Goal log: {team, scorer, minute, own_goal}.
var goal_log: Array[Dictionary] = []

var _last_tick: int = -1
var _connected := false


## Returns the tracker attached to a match (creating it under the match if absent).
static func ensure_for(m: FootballMatch) -> UiStatsTracker:
	if m == null:
		return null
	if m.has_meta(&"ui_stats_tracker"):
		var existing: Variant = m.get_meta(&"ui_stats_tracker")
		if is_instance_valid(existing):
			return existing as UiStatsTracker
	var t := UiStatsTracker.new()
	t.name = "UiStatsTracker"
	m.add_child(t)
	t.bind(m)
	m.set_meta(&"ui_stats_tracker", t)
	return t


func _ready() -> void:
	connect_events()


## Binds to a match for possession timing and minute lookup.
func bind(m: FootballMatch) -> void:
	football_match = m
	_last_tick = m.tick
	connect_events()


## Connects the EventBus signals (idempotent).
func connect_events() -> void:
	if _connected:
		return
	_connected = true
	EventBus.goal_scored.connect(_on_goal)
	EventBus.foul.connect(_on_foul)
	EventBus.card.connect(_on_card)
	EventBus.offside.connect(_on_offside)
	EventBus.corner.connect(_on_corner)
	EventBus.shot_taken.connect(_on_shot)
	EventBus.save_made.connect(_on_save)
	EventBus.ball_kicked.connect(_on_kick)
	EventBus.tackle_attempted.connect(_on_tackle)
	EventBus.match_ended.connect(_on_match_ended)


func _exit_tree() -> void:
	snapshot()
	if not _connected:
		return
	_connected = false
	EventBus.goal_scored.disconnect(_on_goal)
	EventBus.foul.disconnect(_on_foul)
	EventBus.card.disconnect(_on_card)
	EventBus.offside.disconnect(_on_offside)
	EventBus.corner.disconnect(_on_corner)
	EventBus.shot_taken.disconnect(_on_shot)
	EventBus.save_made.disconnect(_on_save)
	EventBus.ball_kicked.disconnect(_on_kick)
	EventBus.tackle_attempted.disconnect(_on_tackle)
	EventBus.match_ended.disconnect(_on_match_ended)


func _process(_delta: float) -> void:
	poll()


## Accumulates possession time from the match tick counter.
func poll() -> void:
	var m := football_match
	if m == null:
		return
	if _last_tick < 0:
		_last_tick = m.tick
	var dticks := m.tick - _last_tick
	_last_tick = m.tick
	if dticks > 0 and m.possession_team >= 0 and m.possession_team < 2 and not m.paused:
		possession_time[m.possession_team] += dticks * FB.TICK_DT


## Adds possession seconds directly (tests / non-match sources).
func add_possession_time(team_id: int, seconds: float) -> void:
	if team_id >= 0 and team_id < 2:
		possession_time[team_id] += seconds


## Possession percentage for a team (50/50 when nothing recorded).
func possession_pct(team_id: int) -> float:
	var total := possession_time[0] + possession_time[1]
	if total <= 0.001:
		return 50.0
	return 100.0 * possession_time[team_id] / total


## Plain dictionary of all stats (used by post-match and tests).
func to_dict() -> Dictionary:
	return {
		"shots": shots.duplicate(), "shots_on_target": shots_on_target.duplicate(),
		"fouls": fouls.duplicate(), "yellow_cards": yellow_cards.duplicate(),
		"red_cards": red_cards.duplicate(), "offsides": offsides.duplicate(),
		"corners": corners.duplicate(), "saves": saves.duplicate(),
		"passes": passes.duplicate(), "tackles": tackles.duplicate(),
		"tackles_won": tackles_won.duplicate(), "goals": goals.duplicate(),
		"possession": [possession_pct(0), possession_pct(1)],
		"goal_log": goal_log.duplicate(true),
	}


## Stores the current numbers in the static `last_stats`.
func snapshot() -> void:
	last_stats = to_dict()


func reset() -> void:
	for arr: Array in [shots, shots_on_target, fouls, yellow_cards, red_cards, offsides, corners, saves, passes, tackles, tackles_won, goals]:
		arr[0] = 0
		arr[1] = 0
	possession_time[0] = 0.0
	possession_time[1] = 0.0
	goal_log.clear()
	_last_tick = football_match.tick if football_match != null else -1


static func _tid(p: Player) -> int:
	if p == null or not is_instance_valid(p) or p.team == null:
		return -1
	return p.team.team_id


func _minute() -> int:
	if football_match != null and football_match.referee != null:
		return football_match.referee.get_display_minute()
	return 0


func _on_goal(team_id: int, scorer: Player, _assist: Player, own_goal: bool) -> void:
	if team_id < 0 or team_id > 1:
		return
	goals[team_id] += 1
	var sname := ""
	if scorer != null and is_instance_valid(scorer) and scorer.data != null:
		sname = scorer.data.name
	goal_log.append({"team": team_id, "scorer": sname, "minute": _minute(), "own_goal": own_goal})
	snapshot()


func _on_foul(offender: Player, _victim: Player, _pos: Vector2, _severity: int, _advantage: bool) -> void:
	var t := _tid(offender)
	if t >= 0:
		fouls[t] += 1


func _on_card(player: Player, card_type: int) -> void:
	var t := _tid(player)
	if t < 0:
		return
	match card_type:
		FB.Card.YELLOW:
			yellow_cards[t] += 1
		FB.Card.SECOND_YELLOW:
			yellow_cards[t] += 1
			red_cards[t] += 1
		FB.Card.RED:
			red_cards[t] += 1


func _on_offside(player: Player, _pos: Vector2) -> void:
	var t := _tid(player)
	if t >= 0:
		offsides[t] += 1


func _on_corner(team_id: int, _pos: Vector2) -> void:
	if team_id >= 0 and team_id < 2:
		corners[team_id] += 1


func _on_shot(player: Player, on_target: bool) -> void:
	var t := _tid(player)
	if t < 0:
		return
	shots[t] += 1
	if on_target:
		shots_on_target[t] += 1


func _on_save(goalkeeper: Player) -> void:
	var t := _tid(goalkeeper)
	if t >= 0:
		saves[t] += 1


func _on_kick(player: Player, kind: int, _power: float) -> void:
	var t := _tid(player)
	if t < 0:
		return
	if kind == FB.IntentAction.PASS or kind == FB.IntentAction.THROUGH_PASS \
			or kind == FB.IntentAction.LOB_PASS or kind == FB.IntentAction.CROSS:
		passes[t] += 1


func _on_tackle(tackler: Player, _target: Player, _slide: bool, success: bool) -> void:
	var t := _tid(tackler)
	if t < 0:
		return
	tackles[t] += 1
	if success:
		tackles_won[t] += 1


func _on_match_ended(_result: Dictionary) -> void:
	poll()
	snapshot()
