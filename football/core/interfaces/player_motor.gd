class_name PlayerMotor
extends RefCounted
## Executes a player's PlayerIntent: locomotion (acceleration, top speed,
## turning, stamina), ball control/dribbling, kicks, tackles.
## Implementation: res://physics/player_motor_impl.gd (extends PlayerMotor), owned by PHYSICS.
## This base class is the STUB.

var player: Player


func setup(p: Player) -> void:
	player = p


## Called every tick after brain.act(). Must reset intent.action when consumed.
func step(delta: float) -> void:
	var p := player
	var it := p.intent
	# STUB locomotion: fixed accel and speed.
	var top := 8.0 if it.sprint else 6.0
	var desired := it.move.limit_length(1.0) * top
	p.vel = p.vel.move_toward(desired, 25.0 * delta)
	p.pos += p.vel * delta
	p.pos.x = clampf(p.pos.x, -FB.HALF_LENGTH - 2.0, FB.HALF_LENGTH + 2.0)
	p.pos.y = clampf(p.pos.y, -FB.HALF_WIDTH - 2.0, FB.HALF_WIDTH + 2.0)
	if it.look != Vector2.ZERO:
		p.facing = it.look.normalized()
	elif p.vel.length_squared() > 0.04:
		p.facing = p.vel.normalized()
	var ball := p.football_match.ball
	# STUB ball pickup.
	if ball.is_loose() and p.touch_cooldown <= 0.0 and ball.height < 0.5 \
			and p.pos.distance_squared_to(ball.pos) < 0.8 * 0.8:
		ball.set_owner(p)
	# STUB kicks: any kick action fires the ball at target_point.
	if it.action != FB.IntentAction.NONE and p.has_ball() and is_kick_action(it.action):
		var dir := (it.target_point - p.pos).normalized()
		if dir == Vector2.ZERO:
			dir = p.facing
		var spd := lerpf(10.0, 28.0, it.power)
		ball.kick(dir * spd, 4.0 * it.loft, 0.0, p)
		p.touch_cooldown = 0.3
		EventBus.ball_kicked.emit(p, it.action, it.power)
	it.clear_action()


## Can this player legally/physically reach and play the ball right now?
func can_touch_ball() -> bool:
	return player.can_play() and player.touch_cooldown <= 0.0


static func is_kick_action(a: int) -> bool:
	return a == FB.IntentAction.PASS or a == FB.IntentAction.THROUGH_PASS \
		or a == FB.IntentAction.LOB_PASS or a == FB.IntentAction.CROSS \
		or a == FB.IntentAction.SHOOT or a == FB.IntentAction.CLEAR \
		or a == FB.IntentAction.GK_THROW or a == FB.IntentAction.GK_KICK \
		or a == FB.IntentAction.SET_PIECE_KICK
