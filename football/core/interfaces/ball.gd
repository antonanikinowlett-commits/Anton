class_name Ball
extends Node2D
## Ball contract (2.5D: ground position + height). Units: meters, m/s, rad/s.
## Implementation: res://physics/ball_physics.gd (extends Ball), owned by PHYSICS.
## This base class is the STUB used until that file exists.

signal touched(player: Player)
signal owner_changed(old_owner: Player, new_owner: Player)
signal kicked(by: Player)

## Ground-plane position (meters, origin = centre spot).
var pos := Vector2.ZERO
## Ground-plane velocity (m/s).
var vel := Vector2.ZERO
## Height of the ball's bottom above the grass (m) and vertical velocity (m/s).
var height := 0.0
var vz := 0.0
## Sidespin around the vertical axis (rad/s). Positive curves the ball to the left of its travel direction.
var spin := 0.0
## Player dribbling/holding the ball, or null if loose.
var owner_player: Player = null
var last_touch_player: Player = null
var last_touch_team: int = -1
## Dead ball placed by the referee: does not move until kicked.
var frozen := false

var football_match: FootballMatch
var _drawn_height := 0.0


func setup(p_match: FootballMatch) -> void:
	football_match = p_match


## Fixed-step update, called by FootballMatch once per tick. Must not allocate.
func physics_step(delta: float) -> void:
	# STUB: follows owner, otherwise slides with linear deceleration.
	if owner_player != null:
		pos = owner_player.pos + owner_player.facing * (FB.PLAYER_RADIUS + FB.BALL_RADIUS + 0.2)
		vel = owner_player.vel
		height = 0.0
		vz = 0.0
		return
	if frozen:
		return
	pos += vel * delta
	vel = vel.move_toward(Vector2.ZERO, 3.0 * delta)
	if height > 0.0 or vz > 0.0:
		vz -= FB.GRAVITY * delta
		height += vz * delta
		if height <= 0.0:
			height = 0.0
			vz = -vz * 0.5 if absf(vz) > 1.0 else 0.0


## Strike the ball. velocity = ground velocity (m/s), up_velocity = initial vz (m/s).
func kick(velocity: Vector2, up_velocity: float, spin_rate: float, by: Player) -> void:
	var was_owner := owner_player
	owner_player = null
	if was_owner != null:
		owner_changed.emit(was_owner, null)
	frozen = false
	vel = velocity
	vz = up_velocity
	spin = spin_rate
	register_touch(by)
	kicked.emit(by)


## Give possession (dribble/hold) to a player, or null to release.
func set_carrier(p: Player) -> void:
	if p == owner_player:
		return
	var old := owner_player
	owner_player = p
	if p != null:
		frozen = false
		register_touch(p)
	owner_changed.emit(old, p)


## Place a dead ball (set pieces). Clears velocity and owner.
func place(at: Vector2) -> void:
	if owner_player != null:
		set_carrier(null)
	pos = at
	vel = Vector2.ZERO
	height = 0.0
	vz = 0.0
	spin = 0.0
	frozen = true


func register_touch(p: Player) -> void:
	if p == null:
		return
	last_touch_player = p
	last_touch_team = p.team.team_id
	touched.emit(p)
	EventBus.ball_touched.emit(p)


func is_loose() -> bool:
	return owner_player == null and not frozen


func is_airborne() -> bool:
	return height > 0.05


## Predicted ground position after t seconds (ignoring players). Used by AI.
func predict_position(t: float) -> Vector2:
	# STUB: linear deceleration model matching physics_step.
	if owner_player != null or frozen:
		return pos
	var speed := vel.length()
	if speed < 0.001:
		return pos
	var decel := 3.0
	var t_stop := speed / decel
	var tt := minf(t, t_stop)
	var dist := speed * tt - 0.5 * decel * tt * tt
	return pos + vel / speed * dist


## Where the ball will come to rest.
func predict_stop_position() -> Vector2:
	return predict_position(60.0)


## Sync visual position (called from FootballMatch._process, never in headless).
func sync_view() -> void:
	position = pos * FB.PPM
	if height > 0.01 or _drawn_height > 0.01:
		_drawn_height = height
		queue_redraw()



func _draw() -> void:
	var r := FB.BALL_RADIUS * FB.PPM * 2.2 * (1.0 + height * 0.12)
	draw_circle(Vector2(height * 6.0, height * 6.0), r, Color(0, 0, 0, 0.35))
	draw_circle(Vector2(0, -height * FB.PPM * 0.5), r, Color.WHITE)
	draw_arc(Vector2(0, -height * FB.PPM * 0.5), r, 0.0, TAU, 16, Color(0.1, 0.1, 0.1), 1.5)
