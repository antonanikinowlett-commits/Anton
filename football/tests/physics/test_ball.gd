extends TestCase
## Ball physics: rolling, drag, bounce, Magnus, goal frame, prediction.

const BALL_SCRIPT := "res://physics/ball_physics.gd"
const PM = preload("res://physics/phys_math.gd")


func _ball() -> Ball:
	var b: Ball = load(BALL_SCRIPT).new()
	return b


func _run(b: Ball, seconds: float) -> void:
	var n := int(seconds / FB.TICK_DT)
	for i in n:
		b.physics_step(FB.TICK_DT)


func test_slot_is_implemented() -> void:
	assert_true(Factory.is_implemented("ball"), "ball slot file exists")
	var b := _ball()
	assert_true(b is Ball, "extends Ball")
	b.free()


func test_rolling_ball_stops() -> void:
	var b := _ball()
	b.vel = Vector2(15.0, 0.0)
	var last_speed := 99.0
	for i in 60 * 20:
		b.physics_step(FB.TICK_DT)
		var s := b.vel.length()
		assert_true(s <= last_speed + 0.0001, "speed monotonic")
		last_speed = s
	assert_eq(b.vel, Vector2.ZERO, "ball came to rest")
	assert_true(b.pos.x > 15.0 and b.pos.x < 60.0, "plausible roll distance %f" % b.pos.x)
	b.free()


func test_roll_decel_is_believable() -> void:
	# A 20 m/s driven ground ball should still be moving at 10+ m/s after 1 s but lose pace.
	var b := _ball()
	b.vel = Vector2(20.0, 0.0)
	_run(b, 1.0)
	assert_true(b.vel.x > 14.0 and b.vel.x < 19.0, "1s speed %f" % b.vel.x)
	b.free()


func test_predict_stop_matches_simulation() -> void:
	var b := _ball()
	b.pos = Vector2(-10.0, 5.0)
	b.vel = Vector2(12.0, -3.0)
	var predicted := b.predict_stop_position()
	var at_2s := b.predict_position(2.0)
	_run(b, 2.0)
	assert_true(b.pos.distance_to(at_2s) < 0.3, "predict_position(2s) err %f" % b.pos.distance_to(at_2s))
	_run(b, 30.0)
	assert_true(b.pos.distance_to(predicted) < 0.5, "stop prediction err %f" % b.pos.distance_to(predicted))
	b.free()


func test_predict_airborne_ball() -> void:
	var b := _ball()
	b.vel = Vector2(14.0, 2.0)
	b.vz = 8.0
	b.spin = 12.0
	b.height = 0.01
	var predicted := b.predict_stop_position()
	_run(b, 40.0)
	assert_true(b.vel == Vector2.ZERO and b.height == 0.0, "settled")
	assert_true(b.pos.distance_to(predicted) < 2.5, "lob stop prediction err %f" % b.pos.distance_to(predicted))
	b.free()


func test_bounce_decays() -> void:
	var b := _ball()
	b.height = 3.0
	b.vz = 0.0
	var peaks: Array[float] = []
	var prev_h := b.height
	var rising := false
	var max_h := 0.0
	for i in 60 * 8:
		b.physics_step(FB.TICK_DT)
		if b.height > max_h:
			max_h = b.height
		if b.height <= 0.0 and rising:
			pass
		if b.height > prev_h:
			rising = true
		elif rising and b.height < prev_h:
			peaks.append(prev_h)
			rising = false
		prev_h = b.height
	assert_true(peaks.size() >= 2, "bounced at least twice (%d)" % peaks.size())
	for i in range(1, peaks.size()):
		assert_true(peaks[i] < peaks[i - 1], "bounce %d lower than previous" % i)
	# Restitution ~0.62 => second apex ~ 0.38 of the first.
	assert_true(peaks[0] > 0.8 and peaks[0] < 1.4, "first bounce height %f" % peaks[0])
	_run(b, 10.0)
	assert_eq(b.height, 0.0, "ends on the ground")
	b.free()


func test_bounce_loses_horizontal_speed() -> void:
	var b := _ball()
	b.height = 0.05
	b.vz = -6.0
	b.vel = Vector2(10.0, 0.0)
	b.physics_step(FB.TICK_DT)
	assert_true(b.vz > 0.0 and b.vz < 6.0 * 0.7, "vz after bounce %f" % b.vz)
	assert_true(b.vel.x < 9.0, "bounce friction %f" % b.vel.x)
	b.free()


func test_magnus_positive_spin_curves_left() -> void:
	# Travelling +x with positive spin: "left of travel" is -y (screen up, y is down).
	var b := _ball()
	b.vel = Vector2(22.0, 0.0)
	b.vz = 2.0
	b.height = 0.01
	b.spin = 40.0
	_run(b, 0.7)
	assert_true(b.pos.y < -0.2, "positive spin curved left (y=%f)" % b.pos.y)
	var c := _ball()
	c.vel = Vector2(22.0, 0.0)
	c.vz = 2.0
	c.height = 0.01
	c.spin = -40.0
	_run(c, 0.7)
	assert_true(c.pos.y > 0.2, "negative spin curved right (y=%f)" % c.pos.y)
	assert_near(absf(b.pos.y), absf(c.pos.y), 0.05, "symmetry")
	b.free()
	c.free()


func test_magnus_left_of_travel_in_any_direction() -> void:
	for dir: Vector2 in [Vector2(0, 1), Vector2(-1, 0), Vector2(0, -1), Vector2(1, 1).normalized()]:
		var b := _ball()
		b.vel = dir * 20.0
		b.vz = 2.0
		b.height = 0.01
		b.spin = 40.0
		_run(b, 0.6)
		var left := Vector2(dir.y, -dir.x)
		var lateral := (b.pos - dir * b.pos.dot(dir)).dot(left)
		assert_true(lateral > 0.1, "dir %s lateral %f" % [str(dir), lateral])
		b.free()


func test_magnus_magnitude_reasonable() -> void:
	# A strongly curled 25 m/s shot deviates a few metres over ~1 s, not tens.
	var b := _ball()
	b.vel = Vector2(25.0, 0.0)
	b.vz = 1.5
	b.height = 0.01
	b.spin = 50.0
	_run(b, 1.0)
	assert_true(absf(b.pos.y) > 1.0 and absf(b.pos.y) < 5.0, "curl %f" % b.pos.y)
	b.free()


func test_air_drag_slows_fast_ball() -> void:
	var b := _ball()
	b.vel = Vector2(30.0, 0.0)
	b.vz = 0.5
	b.height = 0.01
	var v0 := b.vel.x
	_run(b, 0.5)
	assert_true(b.vel.x < v0 - 1.5, "air drag acts (%f)" % b.vel.x)
	b.free()


func test_owned_ball_follows_carrier() -> void:
	var m := make_headless_match(3)
	var p: Player = m.players[5]
	p.teleport(Vector2(10, 5), Vector2.RIGHT)
	p.vel = Vector2(5, 0)
	m.ball.set_carrier(p)
	for i in 30:
		p.pos += p.vel * FB.TICK_DT
		m.ball.physics_step(FB.TICK_DT)
	var d := m.ball.pos - p.pos
	assert_true(d.x > 0.4 and d.x < 1.2, "ball in front (%f)" % d.x)
	assert_true(absf(d.y) < 0.2, "ball on line")
	assert_eq(m.ball.vel, p.vel, "ball moves with carrier")


func test_crossbar_deflects() -> void:
	var b := _ball()
	b.pos = Vector2(FB.HALF_LENGTH - 6.0, 0.0)
	b.height = 2.56
	b.vel = Vector2(25.0, 0.0)
	b.vz = 0.5
	var hit := false
	for i in 40:
		b.physics_step(FB.TICK_DT)
		if b.vel.x < 0.0:
			hit = true
			break
	assert_true(hit, "ball came back off the bar")
	assert_true(b.pos.x < FB.HALF_LENGTH + 0.2, "stayed out of goal")
	b.free()


func test_post_deflects() -> void:
	var b := _ball()
	b.pos = Vector2(FB.HALF_LENGTH - 6.0, FB.GOAL_WIDTH * 0.5 + 0.06)
	b.vel = Vector2(25.0, 0.0)
	var hit := false
	for i in 40:
		b.physics_step(FB.TICK_DT)
		if b.vel.x < 0.0:
			hit = true
			break
	assert_true(hit, "ball rebounded off the post")
	b.free()


func test_net_catches_ball() -> void:
	var b := _ball()
	b.pos = Vector2(FB.HALF_LENGTH - 5.0, 0.5)
	b.vel = Vector2(28.0, 0.0)
	b.vz = 0.0
	_run(b, 3.0)
	assert_true(b.pos.x > FB.HALF_LENGTH and b.pos.x < FB.HALF_LENGTH + FB.GOAL_DEPTH, "ball in the net x=%f" % b.pos.x)
	assert_true(b.vel.length() < 1.0, "net stops the ball")
	b.free()


func test_shot_scores_between_posts() -> void:
	# No goal-frame interference for a ball in the middle of the goal.
	var b := _ball()
	b.pos = Vector2(-FB.HALF_LENGTH + 8.0, 1.0)
	b.vel = Vector2(-26.0, 0.0)
	b.vz = 1.0
	b.height = 0.01
	var crossed := false
	for i in 60:
		b.physics_step(FB.TICK_DT)
		if b.pos.x < -FB.HALF_LENGTH - FB.BALL_RADIUS:
			crossed = true
			break
	assert_true(crossed, "crossed the line")
	assert_true(b.height < FB.GOAL_HEIGHT, "under the bar")
	b.free()


func test_kick_clears_owner_and_unfreezes() -> void:
	var m := make_headless_match(4)
	var p: Player = m.players[3]
	m.ball.set_carrier(p)
	m.ball.kick(Vector2(10, 0), 3.0, 5.0, p)
	assert_true(m.ball.owner_player == null and not m.ball.frozen, "released")
	assert_true(m.ball.last_touch_player == p, "touch registered")
	assert_true(m.ball.is_airborne() or m.ball.vz > 0.0, "airborne")


func test_physics_step_perf() -> void:
	var b := _ball()
	b.vel = Vector2(20, 3)
	b.vz = 6.0
	b.spin = 20.0
	var t0 := Time.get_ticks_usec()
	for i in 6000:
		if b.vel == Vector2.ZERO:
			b.vel = Vector2(20, 3)
			b.vz = 6.0
		b.physics_step(FB.TICK_DT)
	var per := float(Time.get_ticks_usec() - t0) / 6000.0
	assert_true(per < 60.0, "ball step %f us" % per)
	b.free()
