extends AiScenario
## Team-level AI: chaser, marking, defensive line, support, auto-switch suggestion.


func test_chaser_unique_and_never_goalkeeper() -> void:
	var m := make_headless_match(31, -1, 4.0)
	m.config.difficulty = FB.Difficulty.MEDIUM
	for step_i in 80:
		run_ticks(m, 15)
		for t: Team in m.teams:
			var presses := 0
			for p: Player in t.players:
				if p.ai_brain.mode == p.ai_brain.Mode.PRESS:
					presses += 1
			assert_true(presses <= 1, "at most one presser per team (%d)" % presses)
			var c := t.team_brain.chaser
			if c != null:
				assert_false(c.is_goalkeeper(), "chaser is never the GK")
				assert_true(c.team == t)
			if t.team_brain.second_presser != null:
				assert_true(t.team_brain.second_presser != c, "second presser differs from chaser")


func test_chaser_is_closest_interceptor() -> void:
	var m := make_scene(32)
	var carrier := outfield(m.teams[0], 5)
	place(carrier, 0.0, 0.0)
	give_ball(m, carrier)
	var near := outfield(m.teams[1], 2)
	var far := outfield(m.teams[1], 3)
	place(near, 6.0, 1.0)
	place(far, 14.0, 0.0)
	m.teams[1].team_brain.think(0.1)
	assert_true(m.teams[1].team_brain.chaser == near)


func _marking_valid(t: Team) -> void:
	var brain := t.team_brain
	var seen := {}
	for d: Player in brain.marking:
		var a: Player = brain.marking[d]
		assert_true(d.team == t and not d.is_goalkeeper(), "marker is an outfield teammate")
		assert_true(a.team != t, "mark target is an opponent")
		assert_true(d != brain.chaser, "chaser does not man-mark")
		assert_false(seen.has(a), "no attacker marked twice")
		seen[a] = true


func test_marking_assignment_valid_in_play() -> void:
	var m := make_headless_match(33, -1, 4.0)
	var checked := 0
	for step_i in 60:
		run_ticks(m, 20)
		for t: Team in m.teams:
			_marking_valid(t)
			checked += t.team_brain.marking.size()
	assert_true(checked > 0, "some marking happened during the sim")


func test_marking_scenario_sizes() -> void:
	var m := make_scene(34)
	var t0 := m.teams[0]
	var t1 := m.teams[1]
	var carrier := outfield(t0, 5)
	place(carrier, -5.0, 0.0)
	give_ball(m, carrier)
	# Team 1 attacks towards -x; defender pool is team 0? No: team 1 defends when team 0 has the ball.
	for i in 10:
		place(outfield(t1, i), 25.0 - float(i), -20.0 + 4.0 * float(i))
	t1.team_brain.think(0.1)
	_marking_valid(t1)
	# Make team 0 defend instead: team 1 has the ball and team 0 players near the attackers.
	var c1 := outfield(t1, 4)
	place(c1, -10.0, 0.0)
	give_ball(m, c1)
	for i in 10:
		place(outfield(t0, i), -30.0 + float(i), -18.0 + 4.0 * float(i))
	for i in 10:
		if i != 4:
			place(outfield(t1, i), -20.0 + float(i), -15.0 + 3.0 * float(i))
	t0.team_brain.think(0.1)
	_marking_valid(t0)
	assert_true(t0.team_brain.marking.size() >= 3, "defending team man-marks several attackers")
	# Fewer attackers than defenders: still one-to-one.
	for i in 7:
		outfield(t1, i).sent_off = true
	t0.team_brain.think(0.1)
	_marking_valid(t0)
	var attackers_left := 0
	for p: Player in t1.players:
		if not p.sent_off and not p.is_goalkeeper() and p != c1:
			attackers_left += 1
	assert_true(t0.team_brain.marking.size() <= attackers_left)


func test_defensive_line_respects_tactics() -> void:
	var m := make_scene(35)
	var t0 := m.teams[0]
	m.ball.pos = Vector2(5.0, 0.0)
	var opp := outfield(m.teams[1], 3)
	place(opp, 5.0, 0.0)
	give_ball(m, opp)
	t0.tactics.line_height = 0.05
	t0.team_brain.defensive_line_x = 0.0
	t0.team_brain.think(0.1)
	var low: float = t0.team_brain.defensive_line_x
	t0.tactics.line_height = 0.95
	t0.team_brain.defensive_line_x = 0.0
	t0.team_brain.think(0.1)
	var high: float = t0.team_brain.defensive_line_x
	assert_true(high * t0.attack_dir > low * t0.attack_dir, "higher line_height pushes the line up (%f vs %f)" % [high, low])
	assert_true(absf(high) < FB.HALF_LENGTH and absf(low) < FB.HALF_LENGTH)


func test_defenders_hold_the_line() -> void:
	var m := make_scene(36)
	var t0 := m.teams[0]
	var opp := outfield(m.teams[1], 3)
	place(opp, -5.0, 0.0)
	give_ball(m, opp)
	var cb: Player = null
	for p: Player in t0.players:
		if p.role == FB.Role.CB:
			cb = p
			break
	assert_not_null(cb)
	place(cb, -40.0, 3.0)
	t0.team_brain.think(0.1)
	cb.ai_brain.think(0.1)
	if t0.team_brain.chaser != cb and not t0.team_brain.marking.has(cb):
		assert_near(cb.ai_brain._target.x, t0.team_brain.defensive_line_x, 0.01, "CB lines up on the defensive line")


func test_support_designated_for_carrier() -> void:
	var m := make_scene(37)
	var carrier := outfield(m.teams[0], 5)
	place(carrier, 0.0, 0.0)
	give_ball(m, carrier)
	place(outfield(m.teams[0], 6), 9.0, 7.0)
	place(outfield(m.teams[0], 7), 20.0, -9.0)
	m.teams[0].team_brain.think(0.1)
	var tb := m.teams[0].team_brain
	assert_not_null(tb.support_near)
	assert_true(tb.support_near != carrier and tb.support_near != tb.support_far)
	assert_true(tb.chaser == null, "no chaser while we have the ball")


func test_switch_target_for_human_team() -> void:
	var m := make_headless_match(38, 0, 4.0)
	m.referee.set_phase(FB.MatchPhase.PLAYING)
	m.ball.frozen = false
	var t := m.teams[0]
	var cur := t.controlled_player
	assert_not_null(cur)
	var tgt: Player = t.team_brain.suggest_switch_target()
	assert_not_null(tgt)
	assert_true(tgt != cur and not tgt.is_goalkeeper() and tgt.team == t)


var _suggested: Array[Player] = []


func _on_suggest(p: Player) -> void:
	_suggested.append(p)


func test_auto_switch_suggestion_with_hysteresis() -> void:
	var m := make_scene(39, FB.Difficulty.MEDIUM, 0)
	var t := m.teams[0]
	var cur := t.controlled_player
	var other := outfield(t, 4)
	if other == cur:
		other = outfield(t, 5)
	EventBus.auto_switch_suggested.connect(_on_suggest)
	_suggested.clear()
	var opp := outfield(m.teams[1], 0)
	place(opp, 0.0, 0.0)
	give_ball(m, opp)
	# Roughly equal distances: the current player is kept (hysteresis), nothing is suggested.
	place(cur, -10.0, 0.0)
	place(other, -10.4, 3.0)
	for i in 30:
		t.team_brain.think(0.1)
	assert_eq(_suggested.size(), 0, "no flip-flop for near-equal candidates")
	# The other player is clearly better placed: exactly one suggestion in a burst.
	place(other, -3.0, 0.5)
	place(cur, -25.0, 10.0)
	for i in 30:
		t.team_brain.think(0.1)
	EventBus.auto_switch_suggested.disconnect(_on_suggest)
	assert_true(_suggested.size() >= 1 and _suggested[0] == other, "suggests the better player")
	assert_true(_suggested.size() <= 3, "rate limited (%d)" % _suggested.size())
