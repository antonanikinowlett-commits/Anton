extends PlayerBrain
## STUB AI: chaser runs at the ball and kicks it towards goal; others hold shape.
## Replaced by res://ai/ai_brain.gd.


func act(_delta: float) -> void:
	var p := player
	var it := p.intent
	var m := p.football_match
	if not m.referee.is_ball_in_play() and not p.has_ball():
		it.move = _arrive(p.home_position)
		return
	if p.has_ball():
		var goal := p.team.target_goal_center()
		it.move = (goal - p.pos).normalized()
		if p.pos.distance_to(goal) < 28.0 or m.rng.randf() < 0.01:
			it.set_action(FB.IntentAction.SHOOT, goal, 0.8)
		return
	if p.team.team_brain.chaser == p and not p.is_goalkeeper():
		it.move = (m.ball.pos - p.pos).normalized()
	else:
		it.move = _arrive(p.home_position)


func _arrive(target: Vector2) -> Vector2:
	var d := target - player.pos
	var dist := d.length()
	if dist < 0.5:
		return Vector2.ZERO
	return d / dist * clampf(dist / 4.0, 0.0, 1.0)
