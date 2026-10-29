class_name TeamBrain
extends RefCounted
## Team-level AI: who presses, who marks whom, defensive line, support runs,
## and the auto-switch suggestion for the human team.
## Implementation: res://ai/team_ai.gd (extends TeamBrain), owned by AI.
## This base class is the STUB.

var team: Team
## Player who should go for the ball (presser / ball chaser). AI brains read it.
var chaser: Player = null
## Marking assignments: defender Player -> attacker Player.
var marking: Dictionary = {}
## Defensive line x in world meters (for AI and offside-trap logic).
var defensive_line_x := 0.0


func setup(t: Team) -> void:
	team = t


## Called ~10 Hz.
func think(_dt: float) -> void:
	# STUB: nearest outfield player to the ball chases it.
	chaser = team.nearest_player_to(team.football_match.ball.pos, true)


## Best player for the human to switch to right now (called on SWITCH_PLAYER).
func suggest_switch_target() -> Player:
	var exclude := team.controlled_player
	return team.nearest_player_to(team.football_match.ball.predict_position(0.5), true, exclude)
