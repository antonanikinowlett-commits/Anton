extends RefCounted
## Shared constants and pure helpers for the physics module (ball + motor + brains).
## Loaded with preload() (no class_name) so a fresh checkout works without a class cache.

# --- Ball ------------------------------------------------------------------
## Constant rolling resistance on grass (m/s^2).
const ROLL_A0 := 0.9
## Velocity-proportional rolling resistance (1/s).
const ROLL_K := 0.3
## Quadratic air drag: a = AIR_K * |v| * v   (Cd 0.25, ball area, mass 0.43).
const AIR_K := 0.0133
## Magnus: lateral acceleration = MAGNUS_K * spin * |v|.
const MAGNUS_K := 0.0045
## Ground contact keeps a fraction of the Magnus effect.
const MAGNUS_GROUND := 0.3
const SPIN_DECAY_AIR := 0.25
const SPIN_DECAY_GROUND := 1.8
const BOUNCE_E := 0.62
const BOUNCE_FRICTION := 0.82
const BOUNCE_SPIN_KEEP := 0.6
const POST_RADIUS := 0.06
const POST_E := 0.55
const NET_DRAG := 3.0
const NET_E := 0.12
const MAX_BALL_SPEED := 34.0
## Kick spin at curve = 1 (rad/s).
const MAX_SPIN := 55.0

# --- Players ---------------------------------------------------------------
const MAX_SHOT_SPEED := 30.0
const MAX_PASS_SPEED := 26.0


## Distance travelled by a rolling ball slowing from v0 to v1 (m/s).
static func roll_distance(v0: float, v1: float) -> float:
	if v1 >= v0:
		return 0.0
	return (v0 - v1) / ROLL_K - (ROLL_A0 / (ROLL_K * ROLL_K)) * log((ROLL_A0 + ROLL_K * v0) / (ROLL_A0 + ROLL_K * v1))


## Time for a rolling ball to slow from v0 to v1.
static func roll_time(v0: float, v1: float) -> float:
	if v1 >= v0:
		return 0.0
	return log((ROLL_A0 + ROLL_K * v0) / (ROLL_A0 + ROLL_K * v1)) / ROLL_K


## Launch speed so a rolling ball covers dist and arrives with arrive_speed.
static func ideal_ground_speed(dist: float, arrive_speed: float = 4.0) -> float:
	var lo := arrive_speed
	var hi := MAX_BALL_SPEED
	if roll_distance(hi, arrive_speed) <= dist:
		return hi
	for i in 18:
		var mid := (lo + hi) * 0.5
		if roll_distance(mid, arrive_speed) < dist:
			lo = mid
		else:
			hi = mid
	return (lo + hi) * 0.5


## Launch speed for a lofted ball to land dist away at elevation angle (rad), incl. drag fudge.
static func lob_speed(dist: float, elevation: float) -> float:
	var s2 := maxf(sin(2.0 * elevation), 0.2)
	var v := sqrt(dist * FB.GRAVITY / s2)
	return v * (1.0 + 0.0042 * dist)


## Speed of a shot for power 0..1 and shooting stat 0..1.
static func shot_speed(power: float, shooting: float) -> float:
	return minf(lerpf(10.0, 30.5, clampf(power, 0.0, 1.0)) * (0.9 + 0.1 * shooting), MAX_SHOT_SPEED)


## Angular kick error sigma (degrees) for a skill 0..1.
static func kick_error_deg(skill: float, pressure: float, fatigue: float, power: float, shot: bool) -> float:
	var e := 0.6 + (1.0 - skill) * 4.0
	e *= 1.0 + 1.2 * pressure
	e *= 1.0 + 0.7 * fatigue
	if shot:
		# Overhitting: past ~0.85 charge the error grows quickly.
		e *= 1.0 + 3.0 * maxf(power - 0.85, 0.0) / 0.15
	return e


## Distance from point q to segment a-b.
static func dist_point_segment(q: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var l2 := ab.length_squared()
	if l2 < 0.0001:
		return q.distance_to(a)
	var t := clampf((q - a).dot(ab) / l2, 0.0, 1.0)
	return q.distance_to(a + ab * t)
