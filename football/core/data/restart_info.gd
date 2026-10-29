class_name RestartInfo
extends RefCounted
## Describes a pending restart (set piece). Created/owned by the Referee.

var type: int = FB.Restart.NONE
var team_id: int = -1          # team taking the restart
var position := Vector2.ZERO   # ball spot (meters)
var taker: Player = null
var direct: bool = true        # free kicks: direct or indirect
## Minimum distance opponents must keep (9.15 m for free kicks/corners).
var wall_distance: float = 9.15


func reset() -> void:
	type = FB.Restart.NONE
	team_id = -1
	position = Vector2.ZERO
	taker = null
	direct = true
	wall_distance = 9.15
