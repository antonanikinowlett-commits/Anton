class_name TacFormationUtils
extends RefCounted
## Formation helpers: listing, validation, mirroring, coordinate conversion, runtime formation
## changes and applying tactics to team data.


## Ids from tactics/data/index.json.
static func list_formations() -> PackedStringArray:
	return DataLoader.list_formation_ids()


## Returns a list of problems (empty = valid).
static func validate(f: FormationData) -> PackedStringArray:
	var errs := PackedStringArray()
	if f == null:
		errs.append("formation is null")
		return errs
	if f.positions.size() != 11 or f.roles.size() != 11:
		errs.append("%s: expected 11 slots, got %d positions / %d roles" % [f.id, f.positions.size(), f.roles.size()])
		return errs
	if f.roles[0] != FB.Role.GK:
		errs.append("%s: slot 0 must be GK" % f.id)
	var gks := 0
	for i in 11:
		if f.roles[i] == FB.Role.GK:
			gks += 1
		var p := f.positions[i]
		if p.x < 0.0 or p.x > 1.0 or p.y < 0.0 or p.y > 1.0:
			errs.append("%s: slot %d outside 0..1" % [f.id, i])
	if gks != 1:
		errs.append("%s: expected exactly one GK, got %d" % [f.id, gks])
	for i in range(1, 11):
		for j in range(i + 1, 11):
			var a := Vector2(f.positions[i].x * FB.PITCH_LENGTH, f.positions[i].y * FB.PITCH_WIDTH)
			var b := Vector2(f.positions[j].x * FB.PITCH_LENGTH, f.positions[j].y * FB.PITCH_WIDTH)
			if a.distance_to(b) < 6.0:
				errs.append("%s: slots %d and %d are closer than 6 m" % [f.id, i, j])
	return errs


## Left/right mirrored copy (y -> 1 - y, LB <-> RB etc.).
static func mirror(f: FormationData) -> FormationData:
	var m := FormationData.new()
	m.id = f.id
	m.name = f.name
	for i in f.positions.size():
		m.roles.append(TacShapeMath.mirror_role(f.roles[i]))
		m.positions.append(Vector2(f.positions[i].x, 1.0 - f.positions[i].y))
	return m


## Neutral formation positions in world metres for a team attacking in attack_dir.
static func to_world(f: FormationData, attack_dir: int) -> PackedVector2Array:
	var out := PackedVector2Array()
	for p in f.positions:
		out.append(Vector2(attack_dir * (p.x * FB.PITCH_LENGTH - FB.HALF_LENGTH),
			attack_dir * (p.y - 0.5) * FB.PITCH_WIDTH))
	return out


## Formation slot index -> world position helper for UI previews (pitch in 0..1 box, y down).
static func to_preview(f: FormationData) -> PackedVector2Array:
	var out := PackedVector2Array()
	for p in f.positions:
		out.append(p)
	return out


## Applies a tactics resource's values onto a TeamData (copy, formation id included).
static func apply_tactics(data: TeamData, tactics: TacticsData) -> void:
	data.tactics = TacticsData.from_dict(tactics.to_dict())


## Reorders data.squad so squad[0..10] is the best XI for formation_id, in slot order.
## Players keep priority by current XI membership; bench players fill missing roles.
static func arrange_squad(data: TeamData, formation_id: String) -> bool:
	var f := DataLoader.load_formation(formation_id)
	if f.slot_count() != 11 or data.squad.size() < 11:
		return false
	var cur_xi := data.starting_xi()
	var squad := data.squad.duplicate()
	var used := {}
	var chosen: Array[PlayerData] = []
	chosen.resize(11)
	# Fill slots most-constrained first: GK, then centre-backs/forwards, then the rest.
	var order: Array[int] = []
	for i in 11:
		order.append(i)
	for si in order:
		var best: PlayerData = null
		var best_cost := INF
		for p: PlayerData in squad:
			if used.has(p):
				continue
			var cost := TacShapeMath.role_distance(p.role, f.roles[si]) * 10.0 - p.overall() * 0.05
			if p in cur_xi:
				cost -= 3.0
			if cost < best_cost:
				best_cost = cost
				best = p
		chosen[si] = best
		used[best] = true
	var out: Array[PlayerData] = []
	for p: PlayerData in chosen:
		out.append(p)
	for p: PlayerData in data.squad:
		if not used.has(p):
			out.append(p)
	data.squad = out
	data.tactics.formation_id = formation_id
	return true


## Changes a team's formation during a match: remaps on-pitch players to the new slots by role fit.
## Returns false if the formation is unknown/invalid. Safe to call at any time; the shape smooths the move.
static func change_formation(team: Team, formation_id: String) -> bool:
	if not DataLoader.list_formation_ids().has(formation_id):
		return false
	var f := DataLoader.load_formation(formation_id)
	if validate(f).size() > 0:
		return false
	var n := team.players.size()
	var slots := mini(n, 11)
	# Build all (player, slot) costs and assign greedily from cheapest.
	var pairs: Array = []
	var old_f := team.formation
	for i in n:
		var p: Player = team.players[i]
		for s in slots:
			var cost := TacShapeMath.role_distance(p.role, f.roles[s]) * 10.0
			if old_f != null and p.slot_index < old_f.positions.size():
				cost += old_f.positions[p.slot_index].distance_to(f.positions[s]) * 5.0
			if p.sent_off:
				cost += 1000.0
			pairs.append([cost, i, s])
	pairs.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])
	var player_done := {}
	var slot_done := {}
	var assign: Array[int] = []
	assign.resize(n)
	assign.fill(-1)
	for pr: Array in pairs:
		var pi: int = pr[1]
		var si: int = pr[2]
		if player_done.has(pi) or slot_done.has(si):
			continue
		player_done[pi] = true
		slot_done[si] = true
		assign[pi] = si
	for i in n:
		var p: Player = team.players[i]
		var s := assign[i]
		if s < 0:
			continue
		p.slot_index = s
		p.role = f.roles[s]
		p.stagger_group = (team.team_id * 11 + s) % FB.AI_STAGGER_GROUPS
	team.formation = f
	team.tactics.formation_id = formation_id
	return true
