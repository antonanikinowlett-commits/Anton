class_name AiMath
extends RefCounted
## Allocation-free geometry / football helpers shared by the AI brains.
## "a" coordinates are attack-relative: a = x * attack_dir (own goal line = -52.5, opponent's = +52.5).

const PASS_SPEED := 17.0
const OPP_RUN_SPEED := 6.2


static func seg_dist(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var l2 := ab.length_squared()
	if l2 < 0.0001:
		return p.distance_to(a)
	var t := clampf((p - a).dot(ab) / l2, 0.0, 1.0)
	return p.distance_to(a + ab * t)


## Estimated sustained running speed of a player (m/s), from stats and stamina.
static func run_speed(p: Player) -> float:
	return (5.4 + 3.2 * p.data.stat01("pace")) * (0.85 + 0.15 * p.stamina)


## Rough seconds for p to reach `target`.
static func reach_time(p: Player, target: Vector2) -> float:
	return maxf(0.0, p.pos.distance_to(target) - 0.5) / run_speed(p) + 0.12


## Attack-relative x of the offside line for `team` (second-last opponent, never behind
## the ball or the halfway line).
static func offside_line_a(team: Team) -> float:
	var dir := float(team.attack_dir)
	var m1 := -INF
	var m2 := -INF
	for o: Player in team.opponent.players:
		if o.sent_off:
			continue
		var a := o.pos.x * dir
		if a > m1:
			m2 = m1
			m1 = a
		elif a > m2:
			m2 = a
	if m2 == -INF:
		m2 = m1 if m1 != -INF else FB.HALF_LENGTH
	var ball_a := team.football_match.ball.pos.x * dir
	return maxf(maxf(m2, ball_a), 0.0)


## Smallest (opponent arrival time - ball arrival time) in seconds along the pass lane
## from -> to. Positive = pass clearly beats every opponent. Clamped to [-1, 1.5].
static func lane_margin(from: Vector2, to: Vector2, opponents: Array[Player], skip_gk: bool = false) -> float:
	var ab := to - from
	var l2 := ab.length_squared()
	if l2 < 0.25:
		return 1.5
	var l := sqrt(l2)
	var best := 1.5
	for o: Player in opponents:
		if o.sent_off or (skip_gk and o.is_goalkeeper()):
			continue
		var t := clampf((o.pos - from).dot(ab) / l2, 0.0, 1.0)
		var c := from + ab * t
		var opp_t := maxf(0.0, o.pos.distance_to(c) - 0.8) / OPP_RUN_SPEED
		var ball_t := t * l / PASS_SPEED
		var mgn := opp_t - ball_t + (0.4 if t > 0.97 else 0.0)
		if mgn < best:
			best = mgn
	return maxf(best, -1.0)


## Distance from `point` to the nearest non-sent-off player in `group` (INF if none).
static func nearest_dist(point: Vector2, group: Array[Player], skip: Player = null) -> float:
	var best := INF
	for o: Player in group:
		if o.sent_off or o == skip:
			continue
		var d := o.pos.distance_squared_to(point)
		if d < best:
			best = d
	return sqrt(best) if best != INF else INF


const PATH_N := 27
const PATH_DT := 0.12
const PATH_T0 := 0.1
const PATH_MAX_AGE := 6

## Shared per-cycle sample of the ball's predicted path (reused by every runner).
static var _path := PackedVector2Array()
static var _stop := Vector2.ZERO
static var _c_ball: Ball = null
static var _c_tick := -1000
static var _c_pos := Vector2.ZERO
static var _c_vel := Vector2.ZERO
static var _c_h := 0.0


static func _refresh_path(ball: Ball) -> void:
	var tick := ball.football_match.tick if ball.football_match != null else 0
	if _c_ball == ball and tick - _c_tick >= 0 and tick - _c_tick < PATH_MAX_AGE \
			and ball.pos.distance_squared_to(_c_pos) < 0.09 and ball.vel.distance_squared_to(_c_vel) < 0.25 \
			and absf(ball.height - _c_h) < 0.15 and _path.size() == PATH_N:
		return
	if _path.size() != PATH_N:
		_path.resize(PATH_N)
	for i in PATH_N:
		_path[i] = ball.predict_position(PATH_T0 + PATH_DT * float(i))
	_stop = ball.predict_stop_position()
	_c_ball = ball
	_c_tick = tick
	_c_pos = ball.pos
	_c_vel = ball.vel
	_c_h = ball.height


## Predicted ball position at path sample i (t = 0.1 + 0.12 i); call ensure_path() first.
static func path_at(i: int) -> Vector2:
	return _path[i]


static func ensure_path(ball: Ball) -> void:
	_refresh_path(ball)


## Earliest point on the (loose) ball's predicted path that a runner at `from` with
## `speed` can reach in time. Returns Vector3(time, x, y); falls back to the stop point.
static func intercept(from: Vector2, speed: float, ball: Ball) -> Vector3:
	var bp := ball.pos
	if ball.owner_player != null or ball.vel.length_squared() < 0.36:
		return Vector3(maxf(0.0, from.distance_to(bp) - 0.5) / speed, bp.x, bp.y)
	_refresh_path(ball)
	for i in PATH_N:
		var pt := _path[i]
		var t := PATH_T0 + PATH_DT * float(i)
		var tm := maxf(0.0, from.distance_to(pt) - 0.5) / speed
		if tm <= t:
			return Vector3(t, pt.x, pt.y)
	return Vector3(maxf(0.0, from.distance_to(_stop) - 0.5) / speed + 0.5, _stop.x, _stop.y)


static func is_defender_role(r: int) -> bool:
	return r == FB.Role.CB or r == FB.Role.LB or r == FB.Role.RB or r == FB.Role.LWB or r == FB.Role.RWB


static func is_forward_role(r: int) -> bool:
	return r == FB.Role.LW or r == FB.Role.RW or r == FB.Role.CF or r == FB.Role.ST


static func is_wide_role(r: int) -> bool:
	return r == FB.Role.LB or r == FB.Role.RB or r == FB.Role.LWB or r == FB.Role.RWB \
		or r == FB.Role.LM or r == FB.Role.RM or r == FB.Role.LW or r == FB.Role.RW


## Interior angle (rad) at `p` subtended by the posts of the goal centred at `goal`.
static func goal_angle(p: Vector2, goal: Vector2) -> float:
	var half := FB.GOAL_WIDTH * 0.5
	var a := Vector2(goal.x, goal.y - half) - p
	var b := Vector2(goal.x, goal.y + half) - p
	return absf(a.angle_to(b))
