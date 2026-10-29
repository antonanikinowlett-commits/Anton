class_name TacSubstitutionPolicy
extends RefCounted
## Suggests substitutions from stamina, cards, role cover and match situation.
## Pure advice: nothing is changed until apply() / Team.substitute() is called.

const TIRED := 0.35
const VERY_TIRED := 0.2
const FATIGUE_LATE := 0.5


## Returns up to max_suggestions dictionaries sorted by urgency (highest first):
## { out: Player, in_data: PlayerData, reason: String, urgency: float }.
## minute = displayed match minute (0..90+).
static func suggest(team: Team, minute: float, max_suggestions: int = 2) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var left := FB.MAX_SUBSTITUTIONS - team.subs_used
	if left <= 0 or team.bench.is_empty() or max_suggestions <= 0:
		return result
	var goal_diff := 0
	if team.opponent != null:
		goal_diff = team.score - team.opponent.score
	var cands: Array[Dictionary] = []
	for p: Player in team.players:
		if p.sent_off or p.is_goalkeeper():
			continue
		var u := 0.0
		var why := ""
		if p.stamina < VERY_TIRED:
			u = 1.0 - p.stamina
			why = "exhausted"
		elif p.stamina < TIRED and minute >= 55.0:
			u = 0.8 - p.stamina
			why = "tired"
		elif p.stamina < FATIGUE_LATE and minute >= 75.0:
			u = 0.5 - p.stamina * 0.5
			why = "tired late"
		if p.yellow_cards > 0 and minute >= 50.0:
			var risk := (p.data.aggression / 99.0) * 0.5 + (0.2 if TacShapeMath.group_of(p.role) in [TacShapeMath.Group.DEF, TacShapeMath.Group.DM] else 0.0)
			if risk > 0.4 and 0.5 + risk * 0.3 > u:
				u = 0.5 + risk * 0.3
				why = "booked"
		# Tactical changes late in the game.
		if why == "" and minute >= 70.0 and goal_diff < 0 and (TacShapeMath.group_of(p.role) in [TacShapeMath.Group.DEF, TacShapeMath.Group.DM]) and not (p.role == FB.Role.CB and _count_group(team, TacShapeMath.Group.DEF) <= 2):
			u = 0.3
			why = "chase the game"
		elif why == "" and minute >= 80.0 and goal_diff > 0 and TacShapeMath.group_of(p.role) in [TacShapeMath.Group.FWD, TacShapeMath.Group.WIDE, TacShapeMath.Group.AM]:
			u = 0.3
			why = "protect the lead"
		if why != "":
			cands.append({"player": p, "urgency": u, "reason": why})
	cands.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["urgency"] > b["urgency"])
	var used: Array[PlayerData] = []
	for c in cands:
		if result.size() >= mini(max_suggestions, left):
			break
		var p: Player = c["player"]
		var repl := _pick_replacement(team, p, c["reason"], used)
		if repl == null:
			continue
		used.append(repl)
		result.append({"out": p, "in_data": repl, "reason": c["reason"], "urgency": c["urgency"]})
	return result


## Executes a suggestion via Team.substitute. Returns true on success.
static func apply(team: Team, suggestion: Dictionary) -> bool:
	return team.substitute(suggestion["out"], suggestion["in_data"])


static func _count_group(team: Team, g: int) -> int:
	var n := 0
	for p: Player in team.players:
		if not p.sent_off and TacShapeMath.group_of(p.role) == g:
			n += 1
	return n


## Best bench player for the slot: role fit first, rating second; tactical reasons bias the group.
static func _pick_replacement(team: Team, out_p: Player, reason: String, used: Array[PlayerData]) -> PlayerData:
	var best: PlayerData = null
	var best_cost := INF
	for b: PlayerData in team.bench:
		if b in used or b.role == FB.Role.GK:
			continue
		var target_role := out_p.role
		var cost := TacShapeMath.role_distance(b.role, target_role) * 10.0
		if reason == "chase the game" and TacShapeMath.group_of(b.role) in [TacShapeMath.Group.FWD, TacShapeMath.Group.AM, TacShapeMath.Group.WIDE]:
			cost = 3.0 - TacShapeMath.role_distance(b.role, FB.Role.ST)
		elif reason == "protect the lead" and TacShapeMath.group_of(b.role) in [TacShapeMath.Group.DEF, TacShapeMath.Group.DM]:
			cost = 3.0 - TacShapeMath.role_distance(b.role, FB.Role.CB) * 0.5
		cost -= TacTeamLibrary.player_rating(b) * 0.1
		if cost < best_cost:
			best_cost = cost
			best = b
	return best
