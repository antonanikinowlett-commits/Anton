class_name AiScenario
extends TestCase
## Shared helpers for AI tests: build a headless match, park players and place the ball.
## Team 0 (home) attacks +x, team 1 (away) attacks -x at the start of a match.


func make_scene(seed_value: int = 1, difficulty: int = FB.Difficulty.HARD, human_side: int = -1) -> FootballMatch:
	var m := make_headless_match(seed_value, human_side, 4.0)
	m.config.difficulty = difficulty
	m.referee.set_phase(FB.MatchPhase.PLAYING)
	m.ball.frozen = false
	park(m)
	return m


## Moves every outfield player far from the action: team 0 deep in its own half, team 1
## deep in its own half too (so that tests can place the few players they care about).
func park(m: FootballMatch) -> void:
	for t: Team in m.teams:
		var i := 0
		for p: Player in t.players:
			if p.is_goalkeeper():
				place(p, t.own_goal_center().x + t.attack_dir * 2.0, 0.0)
				continue
			place(p, -t.attack_dir * (8.0 + 2.0 * float(i)), (31.0 + 0.4 * float(i)) * (1.0 if i % 2 == 0 else -1.0))
			i += 1
	m.ball.owner_player = null
	m.ball.vel = Vector2.ZERO
	m.ball.height = 0.0
	m.ball.pos = Vector2.ZERO


func place(p: Player, x: float, y: float) -> void:
	p.pos = Vector2(x, y)
	p.vel = Vector2.ZERO
	p.home_position = p.pos
	p.state = FB.PlayerState.NORMAL
	p.touch_cooldown = 0.0
	p.intent.reset()


func give_ball(m: FootballMatch, p: Player) -> void:
	m.ball.owner_player = p
	m.ball.last_touch_player = p
	m.ball.last_touch_team = p.team.team_id
	m.ball.pos = p.pos + p.facing * 0.7
	m.possession_team = p.team.team_id


func outfield(t: Team, n: int) -> Player:
	var k := 0
	for p: Player in t.players:
		if p.is_goalkeeper():
			continue
		if k == n:
			return p
		k += 1
	return null


func ai_of(p: Player) -> PlayerBrain:
	return p.ai_brain


## think+act enough ticks for the brain to react; returns true once an action is pending in intent.
func run_brain(m: FootballMatch, p: Player, ticks: int) -> bool:
	for i in ticks:
		if i % FB.AI_STAGGER_GROUPS == 0:
			p.team.team_brain.think(0.1)
			p.ai_brain.think(0.1)
		p.ai_brain.act(FB.TICK_DT)
		if p.intent.action != FB.IntentAction.NONE:
			return true
	return false


func is_finite_v(v: Vector2) -> bool:
	return is_finite(v.x) and is_finite(v.y)
