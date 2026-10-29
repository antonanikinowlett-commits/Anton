extends Ball
## Ball physics (PHYSICS module). 2.5D: ground plane + height.
## - Ground: exact exponential rolling resistance (constant + linear), spin curves the ball a little.
## - Air: quadratic drag, Magnus (sidespin), gravity, energy-losing bounces.
## - Goal frame: posts (vertical cylinders), crossbar (swept circle in x/z), net behind the line.
## - Dribble: when owned the ball trails the carrier with a stride wobble.
## Allocation-free per tick (only value-type Vector2 temporaries).

const PM = preload("res://physics/phys_math.gd")

const PREDICT_DT := 1.0 / 30.0
const MAX_AIR_STEPS := 400
## Ball is dribbled this far (centre to centre) in front of the carrier at standstill / full speed.
const DRIBBLE_LEAD_MIN := 0.62
const DRIBBLE_LEAD_MAX := 0.80
const HOLD_LEAD := 0.45

var _dribble_phase := 0.0
var _ek := 0.0
var _ek_dt := -1.0
## Scratch outputs for swept collision helper (avoids allocations).
var _hit_pos := Vector2.ZERO
var _hit_vel := Vector2.ZERO


## Fixed-step update. Never allocates.
func physics_step(delta: float) -> void:
	if owner_player != null:
		_follow_owner(delta)
		return
	if frozen:
		return
	var p0 := pos
	var h0 := height
	if height > 0.0 or vz > 0.0:
		_step_air(delta)
	else:
		_step_ground(delta)
	# Goal frame / net only matters near the goal lines.
	var ax := maxf(absf(pos.x), absf(p0.x))
	if ax > FB.HALF_LENGTH - 0.6 and ax < FB.HALF_LENGTH + FB.GOAL_DEPTH + 1.0 \
			and absf(pos.y) < FB.GOAL_WIDTH * 0.5 + 1.0:
		_goal_collisions(p0, h0, delta)


func _step_air(dt: float) -> void:
	var sp := sqrt(vel.length_squared() + vz * vz)
	var drag := maxf(0.0, 1.0 - PM.AIR_K * sp * dt)
	vel *= drag
	vz *= drag
	vz -= FB.GRAVITY * dt
	if spin != 0.0:
		vel += Vector2(vel.y, -vel.x) * (PM.MAGNUS_K * spin * dt)
		spin *= maxf(0.0, 1.0 - PM.SPIN_DECAY_AIR * dt)
		if absf(spin) < 0.3:
			spin = 0.0
	pos += vel * dt
	height += vz * dt
	if height <= 0.0:
		height = 0.0
		vz = -vz * PM.BOUNCE_E
		vel *= PM.BOUNCE_FRICTION
		spin *= PM.BOUNCE_SPIN_KEEP
		if vz < 1.0:
			vz = 0.0


func _step_ground(dt: float) -> void:
	var s2 := vel.length_squared()
	if s2 <= 0.0:
		spin = 0.0
		return
	if spin != 0.0:
		if s2 > 4.0:
			vel += Vector2(vel.y, -vel.x) * (PM.MAGNUS_K * PM.MAGNUS_GROUND * spin * dt)
		spin *= maxf(0.0, 1.0 - PM.SPIN_DECAY_GROUND * dt)
		if absf(spin) < 0.5:
			spin = 0.0
	if dt != _ek_dt:
		_ek_dt = dt
		_ek = exp(-PM.ROLL_K * dt)
	var s := vel.length()
	var a_k := PM.ROLL_A0 / PM.ROLL_K
	var ns := (s + a_k) * _ek - a_k
	if ns < 0.03:
		vel = Vector2.ZERO
		spin = 0.0
		return
	vel *= ns / s
	pos += vel * dt


func _follow_owner(dt: float) -> void:
	var o := owner_player
	var sp := o.vel.length()
	var holding := o.state == FB.PlayerState.HOLDING_BALL
	var lead: float
	var target_h := 0.0
	if holding:
		lead = HOLD_LEAD
		target_h = 0.9
	else:
		_dribble_phase += (0.8 + sp * 0.9) * dt * TAU / 1.4
		var run := clampf(sp / 7.0, 0.0, 1.0)
		lead = lerpf(DRIBBLE_LEAD_MIN, DRIBBLE_LEAD_MAX, run) + 0.14 * run * sin(_dribble_phase)
	var target := o.pos + o.facing * lead
	pos = pos.lerp(target, 1.0 - exp(-30.0 * dt))
	vel = o.vel
	height = lerpf(height, target_h, 0.5)
	vz = 0.0
	spin = 0.0


# --- Goal frame ---------------------------------------------------------------
func _goal_collisions(p0: Vector2, h0: float, dt: float) -> void:
	var sx := 1.0 if (pos.x + p0.x) > 0.0 else -1.0
	var gx := sx * FB.HALF_LENGTH
	var r := FB.BALL_RADIUS
	var half := FB.GOAL_WIDTH * 0.5
	var zc := height + r
	# Posts.
	if zc < FB.GOAL_HEIGHT + 0.12:
		for side in 2:
			var py := (half + PM.POST_RADIUS) * (1.0 if side == 0 else -1.0)
			if _swept_reflect(p0, pos, Vector2(gx, py), PM.POST_RADIUS + r, vel, PM.POST_E):
				pos = _hit_pos
				vel = _hit_vel * 0.94
	# Crossbar, in the (x, z) plane.
	if absf(pos.y) < half + 0.05:
		if _swept_reflect(Vector2(p0.x, h0 + r), Vector2(pos.x, zc), Vector2(gx, FB.GOAL_HEIGHT + PM.POST_RADIUS),
				PM.POST_RADIUS + r, Vector2(vel.x, vz), PM.POST_E):
			pos.x = _hit_pos.x
			height = maxf(_hit_pos.y - r, 0.0)
			vel.x = _hit_vel.x
			vz = _hit_vel.y
	# Net behind the goal line.
	var ax := absf(pos.x)
	if ax > FB.HALF_LENGTH and absf(pos.y) < half and height + r < FB.GOAL_HEIGHT:
		vel *= maxf(0.0, 1.0 - PM.NET_DRAG * dt)
		var back := FB.HALF_LENGTH + FB.GOAL_DEPTH - r
		if ax > back:
			pos.x = sx * back
			if vel.x * sx > 0.0:
				vel.x = -vel.x * PM.NET_E
		if absf(pos.y) > half - r:
			var sy := signf(pos.y)
			pos.y = sy * (half - r)
			if vel.y * sy > 0.0:
				vel.y = -vel.y * PM.NET_E
		if height + 2.0 * r > FB.GOAL_HEIGHT:
			height = FB.GOAL_HEIGHT - 2.0 * r
			if vz > 0.0:
				vz = -vz * PM.NET_E


## Swept circle test: segment a0->a1 (ball centre) against a circle (c, rr). On hit fills
## _hit_pos (contact position) and _hit_vel (reflected velocity) and returns true.
func _swept_reflect(a0: Vector2, a1: Vector2, c: Vector2, rr: float, v: Vector2, e: float) -> bool:
	var seg := a1 - a0
	var f := a0 - c
	var cc := f.length_squared() - rr * rr
	var t := 0.0
	if cc > 0.0:
		var a := seg.length_squared()
		if a < 0.000000001:
			return false
		var b := 2.0 * f.dot(seg)
		var disc := b * b - 4.0 * a * cc
		if disc < 0.0:
			return false
		t = (-b - sqrt(disc)) / (2.0 * a)
		if t < 0.0 or t > 1.0:
			return false
	var q := a0 + seg * t
	var d := q - c
	var dl := d.length()
	var n := d / dl if dl > 0.00001 else Vector2.RIGHT
	var vn := v.dot(n)
	if vn >= 0.0:
		return false
	_hit_pos = c + n * rr
	_hit_vel = v - n * ((1.0 + e) * vn)
	return true


# --- Contract overrides -------------------------------------------------------------
## Strike the ball. Clears ownership and unfreezes.
func kick(velocity: Vector2, up_velocity: float, spin_rate: float, by: Player) -> void:
	var sp := velocity.length()
	if sp > PM.MAX_BALL_SPEED:
		velocity *= PM.MAX_BALL_SPEED / sp
	super.kick(velocity, maxf(up_velocity, 0.0), spin_rate, by)
	if up_velocity > 0.0 and height <= 0.0:
		height = 0.001


## Give possession (dribble/hold) to a player, or null to release.
func set_carrier(p: Player) -> void:
	if p == owner_player:
		return
	super.set_carrier(p)
	if p != null:
		vz = 0.0
		spin = 0.0
		if height > 1.2:
			height = 1.2


## Place a dead ball.
func place(at: Vector2) -> void:
	super.place(at)
	_dribble_phase = 0.0


## Predicted ground position after t seconds (ignores players and goal frame).
func predict_position(t: float) -> Vector2:
	return _predict(t, false)


## Where the ball will come to rest.
func predict_stop_position() -> Vector2:
	return _predict(0.0, true)


## Time until the ball is no longer airborne for the first time (0 if on the ground).
func predict_landing_time() -> float:
	if owner_player != null or frozen or (height <= 0.0 and vz <= 0.0):
		return 0.0
	# Closed form without drag, slightly lengthened for drag.
	var disc := vz * vz + 2.0 * FB.GRAVITY * height
	return (vz + sqrt(maxf(disc, 0.0))) / FB.GRAVITY * 1.03


func _predict(t_max: float, to_rest: bool) -> Vector2:
	if owner_player != null or frozen:
		return pos
	var p := pos
	var v := vel
	var h := height
	var z := vz
	var s := spin
	var t := 0.0
	var guard := 0
	while (h > 0.0 or z > 0.0) and guard < MAX_AIR_STEPS:
		var dt := PREDICT_DT
		if not to_rest:
			if t >= t_max:
				return p
			dt = minf(dt, t_max - t)
		guard += 1
		var sp := sqrt(v.length_squared() + z * z)
		var drag := maxf(0.0, 1.0 - PM.AIR_K * sp * dt)
		v *= drag
		z *= drag
		z -= FB.GRAVITY * dt
		if s != 0.0:
			v += Vector2(v.y, -v.x) * (PM.MAGNUS_K * s * dt)
			s *= maxf(0.0, 1.0 - PM.SPIN_DECAY_AIR * dt)
		p += v * dt
		h += z * dt
		t += dt
		if h <= 0.0:
			h = 0.0
			z = -z * PM.BOUNCE_E
			v *= PM.BOUNCE_FRICTION
			s *= PM.BOUNCE_SPIN_KEEP
			if z < 1.0:
				z = 0.0
	var speed := v.length()
	if speed < 0.03:
		return p
	var t_stop := PM.roll_time(speed, 0.03)
	var tt := t_stop
	if not to_rest:
		tt = minf(maxf(t_max - t, 0.0), t_stop)
	var a_k := PM.ROLL_A0 / PM.ROLL_K
	var sp_end := (speed + a_k) * exp(-PM.ROLL_K * tt) - a_k
	var dist := PM.roll_distance(speed, maxf(sp_end, 0.03))
	return p + v / speed * dist
