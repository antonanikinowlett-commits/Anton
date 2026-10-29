extends PlayerBrain
## STUB human brain: maps InputController actions to intent without assists.
## Replaced by res://physics/human_brain.gd.


func act(_delta: float) -> void:
	var p := player
	var it := p.intent
	var input := p.team.input
	if input == null:
		return
	it.move = input.get_move_vector()
	it.sprint = input.is_held(FB.Action.SPRINT)
	var aim := p.pos + (it.move if it.move != Vector2.ZERO else p.facing) * 20.0
	if input.consume_press(FB.Action.PASS) or input.consume_press(FB.Action.GK_DISTRIBUTE):
		it.set_action(FB.IntentAction.PASS, aim, 0.4)
	elif input.consume_press(FB.Action.LONG_PASS) or input.consume_press(FB.Action.GK_KICK):
		it.set_action(FB.IntentAction.LOB_PASS, aim, 0.7)
		it.loft = 0.6
	var held := input.consume_release(FB.Action.SHOOT)
	if held >= 0.0:
		it.set_action(FB.IntentAction.SHOOT, p.team.target_goal_center(), clampf(held, 0.2, 1.0))
	if input.consume_press(FB.Action.SWITCH_PLAYER):
		p.team.set_controlled_player(p.team.team_brain.suggest_switch_target())
