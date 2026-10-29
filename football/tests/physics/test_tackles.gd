extends "res://tests/physics/phys_scenario.gd"
## Standing and slide tackles, fouls reporting, goalkeeper saves.


class SpyReferee extends Referee:
	var contacts := 0
	var last_ball_first := false
	var last_from_behind := false
	var last_intensity := 0.0
	var last_tackler: Player = null
	var last_victim: Player = null

	func report_contact(tackler: Player, victim: Player, ball_first: bool, intensity: float, from_behind: bool) -> void:
		contacts += 1
		last_ball_first = ball_first
		last_from_behind = from_behind
		last_intensity = intensity
		last_tackler = tackler
		last_victim = victim


var _attempts := 0
var _successes := 0
var _saves := 0


func _on_tackle(_t: Player, _v: Player, _slide: bool, success: bool) -> void:
	_attempts += 1
	if success:
		_successes += 1


func _on_save(_gk: Player) -> void:
	_saves += 1


## Tackler 1.1 m in front of a dribbler who faces the tackler.
func _duel_setup(m: FootballMatch, tackler: Player, victim: Player) -> void:
	victim.teleport(Vector2(0.0, 0.0), Vector2.LEFT)
	tackler.teleport(Vector2(-1.1, 0.0), Vector2.RIGHT)
	tackler.state = FB.PlayerState.NORMAL
	tackler.touch_cooldown = 0.0
	victim.state = FB.PlayerState.NORMAL
	victim.touch_cooldown = 0.0
	m.ball.set_carrier(victim)
	m.ball.pos = victim.pos + victim.facing * 0.7


func _tackle_rate(m: FootballMatch, tk: int, dr: int, slide: bool, trials: int) -> float:
	var tackler := outfield(m, 0, 3)
	var victim := outfield(m, 1, 3)
	set_stats(tackler, {"tackling": tk, "aggression": 50, "strength": 60})
	set_stats(victim, {"dribbling": dr, "strength": 60})
	var won := 0
	for i in trials:
		_duel_setup(m, tackler, victim)
		tackler.intent.set_action(FB.IntentAction.SLIDE if slide else FB.IntentAction.TACKLE, victim.pos, 0.5, victim)
		if slide:
			tackler.intent.target_point = victim.pos
		tackler.motor.step(FB.TICK_DT)
		if slide:
			for t in 30:
				tackler.motor.step(FB.TICK_DT)
				victim.pos = Vector2.ZERO
				if m.ball.owner_player != victim:
					break
		if m.ball.owner_player != victim:
			won += 1
		# Reset all states.
		tackler.state = FB.PlayerState.NORMAL
		victim.state = FB.PlayerState.NORMAL
	return float(won) / float(trials)


func test_tackle_outcome_depends_on_stats() -> void:
	var m := make_scene(41)
	var strong := _tackle_rate(m, 95, 30, false, 200)
	var weak := _tackle_rate(m, 25, 95, false, 200)
	assert_true(strong > 0.65, "strong tackler wins most duels (%f)" % strong)
	assert_true(weak < 0.3, "weak tackler rarely wins (%f)" % weak)
	assert_true(strong > weak + 0.3, "stats matter")


func test_slide_is_stronger_but_riskier() -> void:
	var m := make_scene(42)
	var spy := SpyReferee.new()
	m.referee = spy
	var standing := _tackle_rate(m, 60, 60, false, 200)
	var standing_contacts := spy.contacts
	spy.contacts = 0
	var sliding := _tackle_rate(m, 60, 60, true, 200)
	assert_true(sliding >= standing - 0.05, "slide not weaker (%f vs %f)" % [sliding, standing])
	assert_true(spy.contacts > 0, "slides report contact")
	assert_true(spy.contacts >= standing_contacts, "slides cause at least as much contact (%d vs %d)" % [spy.contacts, standing_contacts])
	spy.free()


func test_tackle_reports_contact_to_referee() -> void:
	var m := make_scene(43)
	var spy := SpyReferee.new()
	m.referee = spy
	var tackler := outfield(m, 0, 3)
	var victim := outfield(m, 1, 3)
	set_stats(tackler, {"tackling": 90})
	var total := 0
	for i in 40:
		_duel_setup(m, tackler, victim)
		spy.contacts = 0
		tackler.intent.set_action(FB.IntentAction.TACKLE, victim.pos, 0.5, victim)
		tackler.motor.step(FB.TICK_DT)
		assert_true(spy.contacts <= 1, "at most one report per tackle")
		if spy.contacts == 1:
			total += 1
			assert_true(spy.last_tackler == tackler and spy.last_victim == victim, "who")
			assert_true(spy.last_intensity > 0.0 and spy.last_intensity <= 1.0, "intensity range")
		tackler.state = FB.PlayerState.NORMAL
	assert_true(total > 20, "most tackles are reported (%d/40)" % total)
	spy.free()


func test_tackle_from_behind_flagged() -> void:
	var m := make_scene(44)
	var spy := SpyReferee.new()
	m.referee = spy
	var tackler := outfield(m, 0, 3)
	var victim := outfield(m, 1, 3)
	set_stats(tackler, {"tackling": 99})
	victim.teleport(Vector2.ZERO, Vector2.RIGHT)
	tackler.teleport(Vector2(-1.1, 0.0), Vector2.RIGHT)
	tackler.touch_cooldown = 0.0
	m.ball.set_carrier(victim)
	tackler.intent.set_action(FB.IntentAction.TACKLE, victim.pos, 0.5, victim)
	tackler.motor.step(FB.TICK_DT)
	assert_true(spy.last_from_behind, "victim faces away from tackler")
	spy.free()


func test_tackle_locks_player_and_emits_signal() -> void:
	var m := make_scene(45)
	_attempts = 0
	_successes = 0
	EventBus.tackle_attempted.connect(_on_tackle)
	var tackler := outfield(m, 0, 3)
	var victim := outfield(m, 1, 3)
	_duel_setup(m, tackler, victim)
	tackler.intent.set_action(FB.IntentAction.TACKLE, victim.pos, 0.5, victim)
	tackler.motor.step(FB.TICK_DT)
	EventBus.tackle_attempted.disconnect(_on_tackle)
	assert_eq(_attempts, 1, "tackle_attempted emitted")
	assert_eq(tackler.state, FB.PlayerState.TACKLING, "locked in tackle")
	for i in 40:
		tackler.intent.move = Vector2.RIGHT
		tackler.intent.sprint = true
		tackler.motor.step(FB.TICK_DT)
	assert_eq(tackler.state, FB.PlayerState.NORMAL, "released after the lock")


func test_whiff_when_out_of_reach() -> void:
	var m := make_scene(46)
	var tackler := outfield(m, 0, 3)
	var victim := outfield(m, 1, 3)
	_duel_setup(m, tackler, victim)
	tackler.teleport(Vector2(-6.0, 0.0), Vector2.RIGHT)
	tackler.intent.set_action(FB.IntentAction.TACKLE, victim.pos, 0.5, victim)
	tackler.motor.step(FB.TICK_DT)
	assert_true(m.ball.owner_player == victim, "no steal from 6 m")
	assert_eq(tackler.state, FB.PlayerState.TACKLING, "still locked (whiff recovery)")


func test_cannot_tackle_teammate() -> void:
	var m := make_scene(47)
	var a := outfield(m, 0, 3)
	var b := outfield(m, 0, 4)
	_duel_setup(m, a, b)
	a.intent.set_action(FB.IntentAction.TACKLE, b.pos, 0.5, b)
	a.motor.step(FB.TICK_DT)
	assert_true(m.ball.owner_player == b, "teammate keeps the ball")


func test_slide_moves_then_player_gets_up() -> void:
	var m := make_scene(48)
	var p := outfield(m, 0, 3)
	p.teleport(Vector2(-10.0, 0.0), Vector2.RIGHT)
	p.vel = Vector2(7.0, 0.0)
	p.intent.set_action(FB.IntentAction.SLIDE, Vector2(0.0, 0.0), 0.5)
	p.motor.step(FB.TICK_DT)
	assert_eq(p.state, FB.PlayerState.SLIDING, "sliding")
	var x0 := p.pos.x
	for i in 30:
		p.motor.step(FB.TICK_DT)
	assert_true(p.pos.x - x0 > 2.0, "slide covers ground (%f)" % (p.pos.x - x0))
	for i in 40:
		p.motor.step(FB.TICK_DT)
	assert_eq(p.state, FB.PlayerState.FALLEN, "on the ground after the slide")
	assert_false(p.motor.can_touch_ball(), "cannot play the ball while down")
	for i in 60:
		p.motor.step(FB.TICK_DT)
	assert_eq(p.state, FB.PlayerState.NORMAL, "back up")


func test_slide_wins_loose_ball() -> void:
	var m := make_scene(49)
	var p := outfield(m, 0, 3)
	p.teleport(Vector2(-3.0, 0.0), Vector2.RIGHT)
	p.vel = Vector2(7.0, 0.0)
	m.ball.pos = Vector2(0.0, 0.0)
	m.ball.vel = Vector2.ZERO
	p.intent.set_action(FB.IntentAction.SLIDE, Vector2(5.0, 0.0), 0.5)
	for i in 40:
		p.motor.step(FB.TICK_DT)
		m.ball.physics_step(FB.TICK_DT)
	assert_true(m.ball.vel.length() > 1.0 or m.ball.pos.x > 1.0, "slide pokes the ball")
	assert_true(m.ball.last_touch_player == p, "touch registered")


# --- Goalkeeper -----------------------------------------------------------------------------
func _shot_vs_keeper(m: FootballMatch, from: Vector2, aim_y: float, speed: float) -> int:
	# Away team's keeper defends the +x goal (away attack_dir is -1).
	var gk := m.teams[1].goalkeeper()
	gk.teleport(Vector2(FB.HALF_LENGTH - 1.0, 0.0), Vector2.LEFT)
	gk.state = FB.PlayerState.NORMAL
	gk.touch_cooldown = 0.0
	gk.stamina = 1.0
	var shooter := outfield(m, 0, 3)
	m.ball.set_carrier(null)
	m.ball.frozen = false
	m.ball.pos = from
	var dir := (Vector2(FB.HALF_LENGTH, aim_y) - from).normalized()
	m.ball.vel = dir * speed
	m.ball.vz = 0.0
	m.ball.height = 0.0
	m.ball.spin = 0.0
	m.ball.last_touch_player = shooter
	m.ball.last_touch_team = 0
	var arr: Array[Player] = [gk]
	var result := 0  # 0 = scored, 1 = saved
	for t in 150:
		sim(m, arr, 1)
		if m.ball.owner_player == gk or m.ball.last_touch_player == gk:
			result = 1
			break
		if m.ball.pos.x > FB.HALF_LENGTH + FB.BALL_RADIUS and absf(m.ball.pos.y) < FB.GOAL_WIDTH * 0.5 and m.ball.height < FB.GOAL_HEIGHT:
			result = 0
			break
	return result


func test_keeper_saves_shot_at_him() -> void:
	var m := make_scene(50)
	var saved := 0
	for i in 20:
		saved += _shot_vs_keeper(m, Vector2(30.0, 0.0), 0.0, 20.0)
	assert_eq(saved, 20, "central shots are saved")


func test_keeper_dives_for_corner_shots_sometimes_beaten() -> void:
	var m := make_scene(51)
	set_stats(m.teams[1].goalkeeper(), {"goalkeeping": 60, "reflexes": 60})
	var set_a := 0
	var tot := 0
	for aim: float in [-3.5, -2.2, 2.2, 3.5]:
		for i in 10:
			set_a += _shot_vs_keeper(m, Vector2(41.0, 0.0), aim, 26.0)
			tot += 1
	var rate := float(set_a) / float(tot)
	assert_true(rate > 0.35, "keeper reaches many of them (%f)" % rate)
	assert_true(rate < 1.0, "but not everything (%f)" % rate)


func test_keeper_beaten_by_pace_and_placement() -> void:
	var m := make_scene(52)
	var gk := m.teams[1].goalkeeper()
	set_stats(gk, {"goalkeeping": 30, "reflexes": 20})
	var beaten := 0
	for i in 20:
		beaten += 1 - _shot_vs_keeper(m, Vector2(40.0, 0.0), -3.4, 29.0)
	assert_true(beaten >= 12, "a hard, well-placed shot beats a weak keeper (%d/20)" % beaten)


func test_keeper_save_emits_signal_and_holds_or_parries() -> void:
	var m := make_scene(53)
	_saves = 0
	EventBus.save_made.connect(_on_save)
	for i in 10:
		_shot_vs_keeper(m, Vector2(30.0, 0.0), 0.0, 22.0)
	EventBus.save_made.disconnect(_on_save)
	assert_true(_saves >= 8, "save_made emitted (%d)" % _saves)


func test_keeper_dive_state_and_recovery() -> void:
	var m := make_scene(54)
	var gk := m.teams[1].goalkeeper()
	gk.teleport(Vector2(FB.HALF_LENGTH - 1.0, 0.0), Vector2.LEFT)
	gk.intent.set_action(FB.IntentAction.GK_DIVE, gk.pos + Vector2(0.0, 3.0), 1.0)
	gk.motor.step(FB.TICK_DT)
	assert_eq(gk.state, FB.PlayerState.DIVING, "diving")
	for i in 30:
		gk.motor.step(FB.TICK_DT)
	assert_true(absf(gk.pos.y) > 1.5, "dive covers lateral distance (%f)" % gk.pos.y)
	for i in 120:
		gk.motor.step(FB.TICK_DT)
	assert_eq(gk.state, FB.PlayerState.NORMAL, "keeper is up again")


func test_keeper_holds_after_catch() -> void:
	var m := make_scene(55)
	var gk := m.teams[1].goalkeeper()
	gk.teleport(Vector2(FB.HALF_LENGTH - 1.0, 0.0), Vector2.LEFT)
	m.ball.pos = gk.pos + Vector2(-0.8, 0.0)
	m.ball.vel = Vector2(3.0, 0.0)
	m.ball.last_touch_team = 0
	var held := false
	for k in 12:
		set_stats(gk, {"goalkeeping": 99, "reflexes": 99})
		sim(m, [gk] as Array[Player], 3)
		if m.ball.owner_player == gk:
			held = true
			break
		m.ball.pos = gk.pos + Vector2(-0.8, 0.0)
		m.ball.vel = Vector2(3.0, 0.0)
		gk.touch_cooldown = 0.0
	assert_true(held, "keeper caught a gentle ball")
	assert_eq(gk.state, FB.PlayerState.HOLDING_BALL, "holding state")
