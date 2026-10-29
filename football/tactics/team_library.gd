class_name TacTeamLibrary
extends RefCounted
## Team browsing helpers for UI: list/load teams, ratings, kit-clash resolution.

## Colours closer than this (redmean distance, 0..765) are considered a clash.
const CLASH_THRESHOLD := 150.0


## One dictionary per team: id, name, short_name, overall, primary, secondary, goalkeeper, formation.
static func list_entries() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for id in DataLoader.list_team_ids():
		out.append(entry_for(DataLoader.load_team(id)))
	return out


static func entry_for(t: TeamData) -> Dictionary:
	return {
		"id": t.id, "name": t.name, "short_name": t.short_name,
		"overall": team_rating(t),
		"primary": t.color_primary, "secondary": t.color_secondary, "goalkeeper": t.color_goalkeeper,
		"formation": t.tactics.formation_id,
	}


static func load_team(id: String) -> TeamData:
	return DataLoader.load_team(id)


## Role-aware player rating, 1..99.
static func player_rating(p: PlayerData) -> int:
	var s := 0.0
	match TacShapeMath.group_of(p.role):
		TacShapeMath.Group.GK:
			s = p.goalkeeping * 0.45 + p.reflexes * 0.35 + p.positioning * 0.1 + p.passing * 0.05 + p.agility * 0.05
		TacShapeMath.Group.DEF:
			s = p.tackling * 0.25 + p.strength * 0.15 + p.positioning * 0.2 + p.pace * 0.15 + p.passing * 0.1 + p.control * 0.05 + p.stamina * 0.1
		TacShapeMath.Group.WB:
			s = p.pace * 0.2 + p.stamina * 0.2 + p.tackling * 0.15 + p.passing * 0.15 + p.dribbling * 0.15 + p.positioning * 0.15
		TacShapeMath.Group.DM:
			s = p.tackling * 0.25 + p.strength * 0.15 + p.passing * 0.2 + p.positioning * 0.15 + p.stamina * 0.15 + p.vision * 0.1
		TacShapeMath.Group.CM:
			s = p.passing * 0.25 + p.vision * 0.15 + p.control * 0.15 + p.stamina * 0.15 + p.dribbling * 0.15 + p.tackling * 0.15
		TacShapeMath.Group.AM:
			s = p.passing * 0.2 + p.vision * 0.2 + p.dribbling * 0.2 + p.control * 0.15 + p.shooting * 0.15 + p.agility * 0.1
		TacShapeMath.Group.WIDE:
			s = p.pace * 0.25 + p.dribbling * 0.25 + p.acceleration * 0.15 + p.passing * 0.1 + p.shooting * 0.1 + p.control * 0.15
		_:
			s = p.shooting * 0.35 + p.positioning * 0.2 + p.pace * 0.15 + p.control * 0.1 + p.dribbling * 0.1 + p.strength * 0.1
	return clampi(int(round(s)), 1, 99)


## Average rating of the starting XI, 1..99.
static func team_rating(t: TeamData) -> int:
	var xi := t.starting_xi()
	if xi.is_empty():
		return 0
	var total := 0
	for p: PlayerData in xi:
		total += player_rating(p)
	return int(round(total / float(xi.size())))


static func colors_clash(a: Color, b: Color) -> bool:
	return TacShapeMath.color_distance(a, b) < CLASH_THRESHOLD


## True if the away side's outfield kit is too close to the home side's.
static func kit_clash(home: TeamData, away: TeamData) -> bool:
	return colors_clash(home.color_primary, away.color_primary)


## Colour the away side should wear as its primary: its own colour if no clash, otherwise its
## secondary colour, otherwise white/black, whichever contrasts most with the home kit.
static func alternate_kit_color(home: TeamData, away: TeamData) -> Color:
	if not kit_clash(home, away):
		return away.color_primary
	var options: Array[Color] = [away.color_secondary, Color.WHITE, Color(0.08, 0.08, 0.1)]
	var best := options[0]
	var best_d := -1.0
	for c: Color in options:
		var d := minf(TacShapeMath.color_distance(c, home.color_primary), TacShapeMath.color_distance(c, home.color_goalkeeper))
		if not colors_clash(c, home.color_primary) and d > best_d:
			best_d = d
			best = c
	return best


## Mutates `away` so it wears a contrasting kit against `home` (swaps primary/secondary when needed).
## Returns true if the kit was changed.
static func resolve_away_kit(home: TeamData, away: TeamData) -> bool:
	if not kit_clash(home, away):
		return false
	var alt := alternate_kit_color(home, away)
	var old_primary := away.color_primary
	away.color_primary = alt
	if colors_clash(alt, away.color_secondary):
		away.color_secondary = old_primary if not colors_clash(old_primary, alt) else (Color.BLACK if alt.get_luminance() > 0.5 else Color.WHITE)
	return true
