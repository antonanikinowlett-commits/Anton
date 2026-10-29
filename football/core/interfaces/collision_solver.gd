class_name CollisionSolver
extends RefCounted
## Resolves player-player overlap and player-ball/goal-frame contacts after motors run.
## Implementation: res://physics/collision_solver_impl.gd (extends CollisionSolver), owned by PHYSICS.
## This base class is the STUB (simple circle separation, O(n^2) with 22 players is fine).

var football_match: FootballMatch


func setup(m: FootballMatch) -> void:
	football_match = m


func solve(_delta: float) -> void:
	var ps := football_match.players
	var min_d := FB.PLAYER_RADIUS * 2.0
	var min_d2 := min_d * min_d
	for i in ps.size():
		var a := ps[i]
		if a.sent_off:
			continue
		for j in range(i + 1, ps.size()):
			var b := ps[j]
			if b.sent_off:
				continue
			var d := b.pos - a.pos
			var l2 := d.length_squared()
			if l2 < min_d2 and l2 > 0.000001:
				var l := sqrt(l2)
				var push := d / l * (min_d - l) * 0.5
				a.pos -= push
				b.pos += push
