class_name TeamShape
extends RefCounted
## Computes player.home_position for each player from formation + tactics + game state.
## Implementation: res://tactics/team_shape_impl.gd (extends TeamShape), owned by TACTICS.
## This base class is the STUB.

var team: Team


func setup(t: Team) -> void:
	team = t


## Called ~10 Hz. Must write home_position for every player in team.players.
func update(_dt: float) -> void:
	# STUB: formation base + mild shift towards the ball.
	var ball_pos := team.football_match.ball.pos
	for p: Player in team.players:
		var base := team.normalized_to_world(team.formation.positions[p.slot_index])
		if p.is_goalkeeper():
			p.home_position = base
		else:
			p.home_position = base + Vector2(ball_pos.x * 0.4, ball_pos.y * 0.3)


## Position for a kickoff (must be in own half; only the kicker may be in the centre circle).
func get_kickoff_position(p: Player, kicking_off: bool) -> Vector2:
	var n := team.formation.positions[p.slot_index]
	var depth := minf(n.x * 0.5, 0.47)
	var w := team.normalized_to_world(Vector2(depth, n.y))
	if kicking_off and p == get_kickoff_taker():
		return Vector2(-team.attack_dir * 0.3, 0.0)
	return w


func get_kickoff_taker() -> Player:
	var best: Player = null
	var best_x := -INF
	for p: Player in team.players:
		if p.sent_off or p.is_goalkeeper():
			continue
		var x := team.formation.positions[p.slot_index].x
		if x > best_x:
			best_x = x
			best = p
	return best


## Position for a player during a set piece (restart owned by the Referee).
## STUB: falls back to the regular home position.
func get_set_piece_position(p: Player, _restart: RestartInfo) -> Vector2:
	return p.home_position


## Pick the taker for a restart (uses tactics taker ids when set).
func pick_set_piece_taker(restart: RestartInfo) -> Player:
	if restart.type == FB.Restart.GOAL_KICK:
		return team.goalkeeper()
	return team.nearest_player_to(restart.position, true)
