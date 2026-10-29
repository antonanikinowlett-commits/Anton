extends RulesTestBase
## Offside, fouls, penalties, cards, advantage.


## Arrange an attacking move: home player A kicks from near the halfway line, home
## receiver B stands at b_x, away defenders (besides keeper) sit at x = def_x.
func _setup_pass(m: FootballMatch, b_x: float, def_x: float) -> Array:
	park_players(m)
	var r = m.referee
	r._exempt_next_kick = false
	var a := outfield(m.teams[0], 4)
	var b := outfield(m.teams[0], 7)
	a.teleport(Vector2(0.0, 0.0))
	b.teleport(Vector2(b_x, 5.0))
	var gk := m.teams[1].goalkeeper()
	gk.teleport(Vector2(50.0, 0.0))
	var n := 0
	for p: Player in m.teams[1].players:
		if p == gk:
			continue
		p.teleport(Vector2(def_x, -20.0 + float(n) * 4.0))
		n += 1
	return [a, b]


func _do_pass(m: FootballMatch, a: Player, b: Player) -> void:
	put_ball(m, a.pos, Vector2.ZERO, 0.0, 0, a)
	m.ball.kick(Vector2(15.0, 3.0), 0.0, 0.0, a)
	a.touch_cooldown = 5.0
	step_n(m, 2)
	# The ball reaches the receiver.
	put_ball(m, b.pos, Vector2.ZERO, 0.0, 0, a)
	m.ball.register_touch(b)
	step_n(m, 2)


func test_offside_flagged_at_pass_moment() -> void:
	var m := start_playing()
	var ab := _setup_pass(m, 30.0, 20.0)
	_do_pass(m, ab[0], ab[1])
	assert_eq(rec.n("offside"), 1, "offside signal")
	assert_eq(m.referee.phase, FB.MatchPhase.SET_PIECE)
	assert_eq(m.referee.restart.type, FB.Restart.FREE_KICK_INDIRECT)
	assert_eq(m.referee.restart.team_id, 1, "defenders get the indirect free kick")
	assert_false(m.referee.restart.direct)


func test_not_offside_when_behind_defender_line() -> void:
	var m := start_playing()
	var ab := _setup_pass(m, 15.0, 20.0)
	_do_pass(m, ab[0], ab[1])
	assert_eq(rec.n("offside"), 0)
	assert_eq(m.referee.phase, FB.MatchPhase.PLAYING)


func test_not_offside_in_own_half() -> void:
	var m := start_playing()
	var ab := _setup_pass(m, -5.0, -30.0)
	_do_pass(m, ab[0], ab[1])
	assert_eq(rec.n("offside"), 0, "own half exemption")


func test_not_offside_behind_the_ball() -> void:
	var m := start_playing()
	var ab := _setup_pass(m, 30.0, 20.0)
	# Kicker is further forward than the receiver.
	ab[0].teleport(Vector2(40.0, 0.0))
	_do_pass(m, ab[0], ab[1])
	# receiver 30 is behind ball at 40 -> onside
	assert_eq(rec.n("offside"), 0)


func test_offside_only_when_receiver_touches() -> void:
	var m := start_playing()
	var ab := _setup_pass(m, 30.0, 20.0)
	put_ball(m, ab[0].pos, Vector2.ZERO, 0.0, 0, ab[0])
	m.ball.kick(Vector2(15.0, 3.0), 0.0, 0.0, ab[0])
	ab[0].touch_cooldown = 5.0
	step_n(m, 2)
	# A defender gets there first: no offence.
	m.ball.register_touch(outfield(m.teams[1], 0))
	step_n(m, 1)
	m.ball.register_touch(ab[1])
	step_n(m, 2)
	assert_eq(rec.n("offside"), 0, "defender played it")


func test_no_offside_from_goal_kick_or_throw_in() -> void:
	var m := start_playing()
	var ab := _setup_pass(m, 30.0, 20.0)
	var r = m.referee
	# Throw-in for home on the touchline, long throw to B (offside position).
	put_ball(m, Vector2(5.0, 34.3), Vector2(0.0, 5.0), 0.0, 1, outfield(m.teams[1], 1))
	step_n(m, 2)
	assert_eq(r.restart.type, FB.Restart.THROW_IN)
	assert_eq(r.restart.team_id, 0)
	var thrower: Player = r.restart.taker
	m.ball.kick(Vector2(10.0, -4.0), 3.0, 0.0, thrower)   # first touch resumes play
	step_n(m, 1)
	assert_eq(r.phase, FB.MatchPhase.PLAYING)
	ab[1].teleport(Vector2(30.0, 5.0))
	for p: Player in m.teams[1].players:
		if not p.is_goalkeeper():
			p.teleport(Vector2(20.0, p.pos.y))
	put_ball(m, ab[1].pos, Vector2.ZERO, 0.0, 0, thrower)
	m.ball.register_touch(ab[1])
	step_n(m, 2)
	assert_eq(rec.n("offside"), 0, "throw-in exempt")


func test_foul_gives_direct_free_kick_at_victim_position() -> void:
	var m := start_playing()
	var off := outfield(m.teams[1], 2)
	var vic := outfield(m.teams[0], 5)
	vic.teleport(Vector2(10.0, -12.0))
	m.referee.award_foul(off, vic, FB.FoulSeverity.CARELESS, false)
	var r = m.referee
	assert_eq(r.phase, FB.MatchPhase.SET_PIECE)
	assert_eq(r.restart.type, FB.Restart.FREE_KICK_DIRECT)
	assert_eq(r.restart.team_id, 0)
	assert_near(r.restart.position.x, 10.0, 0.01)
	assert_near(r.restart.position.y, -12.0, 0.01)
	assert_true(r.restart.direct)
	assert_eq(m.ball.pos, r.restart.position)
	assert_true(m.ball.frozen)
	assert_eq(rec.fouls[0][1], false, "no advantage")


func test_foul_inside_box_is_penalty() -> void:
	var m := start_playing()
	# Away player fouls home attacker inside away's own area (+x side).
	var off := outfield(m.teams[1], 2)
	var vic := outfield(m.teams[0], 5)
	vic.teleport(Vector2(47.0, 6.0))
	m.referee.award_foul(off, vic, FB.FoulSeverity.CARELESS, false)
	var r = m.referee
	assert_eq(r.restart.type, FB.Restart.PENALTY)
	assert_eq(r.restart.team_id, 0)
	assert_near(r.restart.position.x, FB.HALF_LENGTH - FB.PENALTY_SPOT_DIST, 0.01)
	assert_near(r.restart.position.y, 0.0, 0.01)
	assert_eq(rec.n("penalty"), 1)
	# Everybody but taker and keeper is outside the area and the arc.
	var gk := m.teams[1].goalkeeper()
	assert_true(gk.pos.x > FB.HALF_LENGTH - 1.0, "keeper on his line")
	for t: Team in m.teams:
		for p: Player in t.players:
			if p == r.restart.taker or p == gk:
				continue
			var in_area: bool = p.pos.x > FB.HALF_LENGTH - FB.PENALTY_AREA_DEPTH and absf(p.pos.y) < FB.PENALTY_AREA_WIDTH * 0.5
			assert_false(in_area, "%s outside the area" % p.name)
			assert_true(p.pos.distance_to(r.restart.position) >= FB.PENALTY_ARC_RADIUS - 0.01, "%s outside the arc" % p.name)
	# AI penalty is taken.
	assert_true(step_until_phase(m, FB.MatchPhase.PLAYING, 600), "penalty taken")
	assert_true(m.ball.vel.x > 5.0, "shot towards the +x goal")


func test_attacker_foul_in_opponent_box_is_free_kick_not_penalty() -> void:
	var m := start_playing()
	var off := outfield(m.teams[0], 2)
	var vic := outfield(m.teams[1], 5)
	vic.teleport(Vector2(47.0, 6.0))
	m.referee.award_foul(off, vic, FB.FoulSeverity.CARELESS, false)
	assert_eq(m.referee.restart.type, FB.Restart.FREE_KICK_DIRECT)
	assert_eq(m.referee.restart.team_id, 1)


func test_report_contact_probabilities() -> void:
	var m := start_playing()
	var r = m.referee
	var off := outfield(m.teams[1], 2)
	var vic := outfield(m.teams[0], 5)
	# Clean ball-first tackles are almost never fouls; reckless from behind are.
	var clean := 0
	var dirty := 0
	for i in 400:
		r._pf_active = false
		r.report_contact(off, vic, true, 0.2, false)
		if r._pf_active:
			clean += 1
		r._pf_active = false
		r.report_contact(off, vic, false, 0.9, true)
		if r._pf_active:
			dirty += 1
	r._pf_active = false
	assert_true(clean < 60, "clean tackles rarely fouls (%d/400)" % clean)
	assert_true(dirty > 250, "dirty tackles mostly fouls (%d/400)" % dirty)
	# Forced foul flows into a restart on the next tick.
	r.debug_force_foul = true
	r.debug_advantage = 0
	vic.teleport(Vector2(0.0, 10.0))
	r.report_contact(off, vic, false, 0.5, false)
	step_n(m, 2)
	assert_eq(r.phase, FB.MatchPhase.SET_PIECE)
	assert_eq(r.fouls_total, 1)


func test_yellow_then_second_yellow_sends_off() -> void:
	var m := start_playing()
	var r = m.referee
	var off := outfield(m.teams[1], 2)
	var vic := outfield(m.teams[0], 5)
	vic.teleport(Vector2(0.0, 0.0))
	r.award_foul(off, vic, FB.FoulSeverity.RECKLESS, false)
	assert_eq(off.yellow_cards, 1)
	assert_false(off.sent_off)
	assert_eq(rec.cards[0][1], FB.Card.YELLOW)
	assert_eq(r.yellow_total, 1)
	# Restart, then second offence.
	assert_true(step_until_phase(m, FB.MatchPhase.PLAYING, 600))
	r.award_foul(off, vic, FB.FoulSeverity.RECKLESS, false)
	assert_eq(rec.cards[1][1], FB.Card.SECOND_YELLOW)
	assert_true(off.sent_off)
	assert_eq(off.state, FB.PlayerState.SENT_OFF)
	assert_true(absf(off.pos.y) > FB.HALF_WIDTH, "off the pitch")
	assert_eq(m.teams[1].active_player_count(), 10)


func test_straight_red() -> void:
	var m := start_playing()
	var off := outfield(m.teams[1], 3)
	var vic := outfield(m.teams[0], 5)
	m.referee.award_foul(off, vic, FB.FoulSeverity.EXCESSIVE, true)
	assert_true(off.sent_off)
	assert_eq(rec.cards[0][1], FB.Card.RED)
	# No advantage on a red card: play is stopped.
	assert_eq(m.referee.phase, FB.MatchPhase.SET_PIECE)
	# Sent-off players never take set pieces.
	assert_true(m.referee.restart.taker != off)


func test_sent_off_human_player_is_replaced() -> void:
	var m := start_playing(2, 0)
	var t := m.teams[0]
	var cp := t.controlled_player
	var vic := outfield(m.teams[1], 5)
	m.referee.award_foul(cp, vic, FB.FoulSeverity.EXCESSIVE, false)
	assert_true(cp.sent_off)
	assert_true(t.controlled_player != cp, "control moved to another player")
	assert_false(t.controlled_player.sent_off)


func test_advantage_played_when_victim_keeps_ball() -> void:
	var m := start_playing()
	var r = m.referee
	r.debug_advantage = 1
	var off := outfield(m.teams[1], 2)
	var vic := outfield(m.teams[0], 5)
	vic.teleport(Vector2(10.0, 0.0))
	m.ball.set_carrier(vic)
	r.award_foul(off, vic, FB.FoulSeverity.CARELESS, true)
	assert_true(rec.fouls[0][1], "advantage flagged in event")
	assert_eq(r.phase, FB.MatchPhase.PLAYING, "play goes on")
	step_n(m, 60 * 3)
	assert_eq(r.phase, FB.MatchPhase.PLAYING, "advantage expired, still playing")
	assert_false(r._adv_active)


func test_advantage_called_back_when_possession_lost() -> void:
	var m := start_playing()
	var r = m.referee
	r.debug_advantage = 1
	var off := outfield(m.teams[1], 2)
	var vic := outfield(m.teams[0], 5)
	vic.teleport(Vector2(10.0, 0.0))
	m.ball.set_carrier(vic)
	r.award_foul(off, vic, FB.FoulSeverity.CARELESS, true)
	assert_eq(r.phase, FB.MatchPhase.PLAYING)
	m.ball.set_carrier(outfield(m.teams[1], 4))
	step_n(m, 3)
	assert_eq(r.phase, FB.MatchPhase.SET_PIECE, "called back")
	assert_eq(r.restart.type, FB.Restart.FREE_KICK_DIRECT)
	assert_eq(r.restart.team_id, 0)
	assert_near(r.restart.position.x, 10.0, 0.5, "free kick at the foul spot")


func test_no_advantage_in_box() -> void:
	var m := start_playing()
	var r = m.referee
	r.debug_advantage = 1
	var off := outfield(m.teams[1], 2)
	var vic := outfield(m.teams[0], 5)
	vic.teleport(Vector2(46.0, 0.0))
	m.ball.set_carrier(vic)
	r.award_foul(off, vic, FB.FoulSeverity.CARELESS, true)
	assert_eq(r.restart.type, FB.Restart.PENALTY)
