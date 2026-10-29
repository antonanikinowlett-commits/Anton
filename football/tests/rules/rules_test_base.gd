class_name RulesTestBase
extends TestCase
## Shared helpers for rules tests. Works against the core stubs (no physics/AI modules).

var rec := RulesRecorder.new()


func after_each() -> void:
	rec.detach()


## Headless match advanced to open play (kickoff finished). Brains are neutralised so
## players stay where the test puts them.
func start_playing(seed_value: int = 1, human_side: int = -1, minutes: float = 4.0, freeze_players: bool = true) -> FootballMatch:
	var m := make_headless_match(seed_value, human_side, minutes)
	rec.attach()
	for i in 400:
		if m.referee.phase == FB.MatchPhase.PLAYING:
			break
		m.step(FB.TICK_DT)
	assert_eq(m.referee.phase, FB.MatchPhase.PLAYING, "kickoff leads to play")
	if freeze_players:
		freeze(m)
	return m


func freeze(m: FootballMatch) -> void:
	for p: Player in m.players:
		var b := PlayerBrain.new()
		b.setup(p)
		p.brain = b
		p.ai_brain = b


## Park every player of both teams in two rows far from the action (y = +-30).
func park_players(m: FootballMatch) -> void:
	for t: Team in m.teams:
		for p: Player in t.players:
			var i := p.slot_index
			p.teleport(Vector2(-25.0 + float(i) * 5.0, 30.0 if t.team_id == 0 else -30.0))


## Loose live ball at pos with velocity.
func put_ball(m: FootballMatch, pos: Vector2, vel: Vector2 = Vector2.ZERO, height: float = 0.0, last_team: int = -1, last_player: Player = null) -> void:
	m.ball.set_carrier(null)
	m.ball.frozen = false
	m.ball.pos = pos
	m.ball.vel = vel
	m.ball.height = height
	m.ball.vz = 0.0
	m.ball.last_touch_team = last_team
	m.ball.last_touch_player = last_player
	m.referee._prev_ball = pos


func step_n(m: FootballMatch, n: int) -> void:
	for i in n:
		if m.is_finished:
			return
		m.step(FB.TICK_DT)


func step_until_phase(m: FootballMatch, ph: int, max_ticks: int = 1200) -> bool:
	for i in max_ticks:
		if m.referee.phase == ph:
			return true
		m.step(FB.TICK_DT)
	return m.referee.phase == ph


func outfield(t: Team, idx: int) -> Player:
	var n := 0
	for p: Player in t.players:
		if p.is_goalkeeper():
			continue
		if n == idx:
			return p
		n += 1
	return null
