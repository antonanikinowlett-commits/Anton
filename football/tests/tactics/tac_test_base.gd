class_name TacTestBase
extends TestCase
## Shared helpers for tactics tests.

const FORMATIONS := ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1"]


func new_match(seed_value: int = 1) -> FootballMatch:
	return make_headless_match(seed_value, -1, 1.0)


func read_json(path: String) -> Variant:
	var text := FileAccess.get_file_as_string(path)
	var parser := JSON.new()
	if parser.parse(text) != OK:
		return null
	return parser.data


## Runs update() n times so smoothing converges.
func settle(team: Team, n: int = 25, dt: float = 0.1) -> void:
	for i in n:
		team.shape.update(dt)


func set_scene(m: FootballMatch, ball: Vector2, possession: int) -> void:
	m.ball.pos = ball
	m.possession_team = possession


func frame(team: Team, p: Player) -> Vector2:
	return TacShapeMath.to_frame(p.home_position, team.attack_dir)


## Mean attack-frame x of outfield home positions.
func mean_x(team: Team) -> float:
	var s := 0.0
	var c := 0
	for p: Player in team.players:
		if p.is_goalkeeper() or p.sent_off:
			continue
		s += frame(team, p).x
		c += 1
	return s / maxf(c, 1)


func lateral_spread(team: Team) -> float:
	var s := 0.0
	var c := 0
	for p: Player in team.players:
		if p.is_goalkeeper() or p.sent_off:
			continue
		s += absf(frame(team, p).y - FB.HALF_WIDTH)
		c += 1
	return s / maxf(c, 1)


func make_restart(type: int, team_id: int, pos: Vector2, taker: Player = null) -> RestartInfo:
	var r := RestartInfo.new()
	r.type = type
	r.team_id = team_id
	r.position = pos
	r.taker = taker
	return r


func set_formation(team: Team, id: String) -> void:
	assert_true(TacFormationUtils.change_formation(team, id), "change to " + id)
