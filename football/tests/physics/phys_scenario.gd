extends TestCase
## Shared helpers for physics tests (not a test file itself: no test_ prefix).
## Builds a headless match with every player parked away from the action, so single-player
## and two-player scenarios are not disturbed.


## Match with all players parked on the touchlines and the ball live at the centre.
func make_scene(seed_value: int = 5, human_side: int = -1) -> FootballMatch:
	var m := make_headless_match(seed_value, human_side, 4.0)
	m.ball.frozen = false
	m.ball.place(Vector2.ZERO)
	m.ball.frozen = false
	var i := 0
	for p: Player in m.players:
		p.teleport(Vector2(-50.0 + float(i) * 4.5, 31.0 if p.team.team_id == 0 else -31.0))
		p.stamina = 1.0
		p.state = FB.PlayerState.NORMAL
		i += 1
	return m


## Outfield player of the given team (index among outfielders).
func outfield(m: FootballMatch, team_id: int, n: int = 0) -> Player:
	var seen := 0
	for p: Player in m.teams[team_id].players:
		if p.is_goalkeeper():
			continue
		if seen == n:
			return p
		seen += 1
	return null


## Give the player its own copy of PlayerData with stat overrides, e.g. {"pace": 90}.
func set_stats(p: Player, stats: Dictionary) -> void:
	p.data = p.data.duplicate()
	for k: String in stats.keys():
		p.data.set(k, int(stats[k]))


## Step the listed players' motors, the solver and the ball.
func sim(m: FootballMatch, ps: Array[Player], ticks: int) -> void:
	for t in ticks:
		for p: Player in ps:
			if p.touch_cooldown > 0.0:
				p.touch_cooldown -= FB.TICK_DT
			p.motor.step(FB.TICK_DT)
		m.collision_solver.solve(FB.TICK_DT)
		m.ball.physics_step(FB.TICK_DT)


## Standard deviation of an array of floats.
func stddev(values: Array[float]) -> float:
	if values.is_empty():
		return 0.0
	var mean := 0.0
	for v in values:
		mean += v
	mean /= float(values.size())
	var s := 0.0
	for v in values:
		s += (v - mean) * (v - mean)
	return sqrt(s / float(values.size()))
