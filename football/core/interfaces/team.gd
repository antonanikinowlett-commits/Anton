class_name Team
extends Node
## One side in a match. Owned by core. Pluggable components:
##   shape      (TeamShape, TACTICS) computes every player's home_position
##   team_brain (TeamBrain, AI)      team-level coordination (pressing, marking, line)

var team_id := 0
var data: TeamData
var tactics: TacticsData
var formation: FormationData
## Players currently on the pitch (sent-off players stay in the array with sent_off = true).
var players: Array[Player] = []
var bench: Array[PlayerData] = []
var subs_used := 0
## +1 = attacks towards +x, -1 = towards -x. Swapped at half-time.
var attack_dir := 1
var score := 0
var opponent: Team
var football_match: FootballMatch
var shape: TeamShape
var team_brain: TeamBrain

# --- Human control -----------------------------------------------------------
var is_human := false
var input: InputController
var controlled_player: Player


func setup(p_team_id: int, p_data: TeamData, p_match: FootballMatch) -> void:
	team_id = p_team_id
	data = p_data
	football_match = p_match
	name = "Team%d_%s" % [team_id, data.short_name]
	tactics = data.tactics
	formation = DataLoader.load_formation(tactics.formation_id)
	attack_dir = 1 if team_id == FB.Side.HOME else -1
	var xi := data.starting_xi()
	bench = data.bench()
	for i in mini(xi.size(), formation.slot_count()):
		var p := Player.new()
		p.setup(xi[i], self, football_match, i, formation.roles[i])
		players.append(p)
	shape = Factory.create("team_shape") as TeamShape
	shape.setup(self)
	team_brain = Factory.create("team_brain") as TeamBrain
	team_brain.setup(self)


func set_human(p_input: InputController) -> void:
	is_human = p_input != null
	input = p_input
	if is_human:
		set_controlled_player(nearest_player_to(football_match.ball.pos, true))


func set_controlled_player(p: Player) -> void:
	if not is_human or p == controlled_player or p == null or p.sent_off:
		return
	if controlled_player != null:
		controlled_player.set_human_controlled(false)
	controlled_player = p
	p.set_human_controlled(true)
	EventBus.controlled_player_changed.emit(team_id, p)


# --- Geometry ------------------------------------------------------------------
func own_goal_center() -> Vector2:
	return Vector2(-attack_dir * FB.HALF_LENGTH, 0.0)


func target_goal_center() -> Vector2:
	return Vector2(attack_dir * FB.HALF_LENGTH, 0.0)


## Normalized formation coords (see FormationData) -> world meters for this team.
func normalized_to_world(n: Vector2) -> Vector2:
	return Vector2(attack_dir * (n.x * FB.PITCH_LENGTH - FB.HALF_LENGTH),
		attack_dir * (n.y - 0.5) * FB.PITCH_WIDTH)


## World meters -> normalized attack-relative coords.
func world_to_normalized(w: Vector2) -> Vector2:
	return Vector2((w.x * attack_dir + FB.HALF_LENGTH) / FB.PITCH_LENGTH,
		w.y * attack_dir / FB.PITCH_WIDTH + 0.5)


# --- Queries -------------------------------------------------------------------
func goalkeeper() -> Player:
	for p: Player in players:
		if p.is_goalkeeper() and not p.sent_off:
			return p
	return null


func nearest_player_to(point: Vector2, exclude_gk: bool = false, exclude: Player = null) -> Player:
	var best: Player = null
	var best_d := INF
	for p: Player in players:
		if p.sent_off or p == exclude or (exclude_gk and p.is_goalkeeper()):
			continue
		var d := p.pos.distance_squared_to(point)
		if d < best_d:
			best_d = d
			best = p
	return best


func has_possession() -> bool:
	return football_match.possession_team == team_id


func active_player_count() -> int:
	var n := 0
	for p: Player in players:
		if not p.sent_off:
			n += 1
	return n


# --- Squad -------------------------------------------------------------------
## Replace player_out with bench player in_data. Returns false if not allowed.
func substitute(player_out: Player, in_data: PlayerData) -> bool:
	if subs_used >= FB.MAX_SUBSTITUTIONS or player_out.sent_off or in_data not in bench:
		return false
	bench.erase(in_data)
	var out_data := player_out.data
	player_out.data = in_data
	player_out.stamina = 1.0
	player_out.yellow_cards = 0
	player_out.name = "%s_%d" % [data.short_name, in_data.number]
	player_out.queue_redraw()
	subs_used += 1
	# The same Player node continues with the new data; out_data cannot re-enter.
	EventBus.substitution.emit(team_id, player_out, out_data, in_data)
	return true


# --- Per-tick hooks (called by FootballMatch) ----------------------------------
func think(dt: float) -> void:
	shape.update(dt)
	team_brain.think(dt)
