extends CollisionSolver
## Player-player separation (mass/strength aware, with a little momentum exchange) and
## body-ball deflections (blocked shots, rebounds off players that did not control the ball).
## O(n^2) over 22 players with cheap axis rejects; no allocations.

## Restitution between bodies (very inelastic).
const BODY_E := 0.08
## Restitution of the ball off a body.
const BALL_E := 0.45
## Players are this tall for blocking purposes (ball above passes over).
const BODY_HEIGHT := 1.8


## Effective mass (kg-ish) from strength and height; sliding players are heavier.
static func body_mass(p: Player) -> float:
	var d := p.data
	if d == null:
		return 75.0
	var m := 62.0 + 28.0 * clampf(float(d.strength) / 99.0, 0.0, 1.0) + (float(d.height_cm) - 175.0) * 0.35
	if p.state == FB.PlayerState.SLIDING:
		m *= 1.4
	return m


## Resolve overlaps for this tick. Call after motors, before ball physics.
func solve(_delta: float) -> void:
	var ps := football_match.players
	var n := ps.size()
	var min_d := FB.PLAYER_RADIUS * 2.0
	var min_d2 := min_d * min_d
	for i in n:
		var a := ps[i]
		if a.sent_off or a.state == FB.PlayerState.FALLEN:
			continue
		var apx := a.pos.x
		var apy := a.pos.y
		for j in range(i + 1, n):
			var b := ps[j]
			if b.sent_off or b.state == FB.PlayerState.FALLEN:
				continue
			var dx := b.pos.x - apx
			if dx >= min_d or dx <= -min_d:
				continue
			var dy := b.pos.y - apy
			if dy >= min_d or dy <= -min_d:
				continue
			var l2 := dx * dx + dy * dy
			if l2 >= min_d2:
				continue
			_separate(a, b, dx, dy, l2, min_d)
			apx = a.pos.x
			apy = a.pos.y
	_ball_vs_bodies(ps)


func _separate(a: Player, b: Player, dx: float, dy: float, l2: float, min_d: float) -> void:
	var n: Vector2
	var l: float
	if l2 > 0.000001:
		l = sqrt(l2)
		n = Vector2(dx, dy) / l
	else:
		l = 0.0
		n = Vector2.RIGHT.rotated(float(a.slot_index + b.slot_index * 7))
	var ma := body_mass(a)
	var mb := body_mass(b)
	var inv := 1.0 / (ma + mb)
	var overlap := min_d - l
	a.pos -= n * (overlap * mb * inv)
	b.pos += n * (overlap * ma * inv)
	# Momentum exchange along the contact normal (only when closing).
	var vn := (b.vel - a.vel).dot(n)
	if vn < 0.0:
		var j := -(1.0 + BODY_E) * vn / (1.0 / ma + 1.0 / mb)
		a.vel -= n * (j / ma)
		b.vel += n * (j / mb)


func _ball_vs_bodies(ps: Array[Player]) -> void:
	var ball := football_match.ball
	if ball.owner_player != null or ball.frozen or ball.height > BODY_HEIGHT:
		return
	var rr := FB.PLAYER_RADIUS + FB.BALL_RADIUS
	var rr2 := rr * rr
	var bx := ball.pos.x
	var by := ball.pos.y
	for p in ps:
		if p.sent_off or p.touch_cooldown > 0.0 or p.state == FB.PlayerState.FALLEN:
			continue
		var dx := bx - p.pos.x
		if dx >= rr or dx <= -rr:
			continue
		var dy := by - p.pos.y
		if dy >= rr or dy <= -rr:
			continue
		var l2 := dx * dx + dy * dy
		if l2 >= rr2:
			continue
		var n: Vector2
		if l2 > 0.000001:
			n = Vector2(dx, dy) / sqrt(l2)
		else:
			n = p.facing
		var vn := (ball.vel - p.vel).dot(n)
		if vn >= 0.0:
			continue
		ball.vel -= n * ((1.0 + BALL_E) * vn)
		ball.pos = p.pos + n * rr
		if ball.height <= 0.0 and vn < -12.0:
			ball.vz = 1.2
		ball.register_touch(p)
		p.touch_cooldown = 0.12
		return
