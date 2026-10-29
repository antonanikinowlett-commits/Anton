class_name MatchCamera
extends Camera2D
## STUB camera: smoothly follows the ball, clamped to the pitch.
## Replaced by res://polish/match_camera_impl.gd (extends MatchCamera).

var football_match: FootballMatch


func bind(m: FootballMatch) -> void:
	football_match = m
	position_smoothing_enabled = true
	position_smoothing_speed = 4.0
	var margin := FB.RUNOFF * FB.PPM
	limit_left = int(-FB.HALF_LENGTH * FB.PPM - margin)
	limit_right = int(FB.HALF_LENGTH * FB.PPM + margin)
	limit_top = int(-FB.HALF_WIDTH * FB.PPM - margin)
	limit_bottom = int(FB.HALF_WIDTH * FB.PPM + margin)
	make_current()


func _process(_delta: float) -> void:
	if football_match != null:
		position = football_match.ball.pos * FB.PPM
