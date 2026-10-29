extends TestCase

var kicks := {}


func _on_kick(_p: Player, kind: int, _pow: float) -> void:
	kicks[kind] = int(kicks.get(kind, 0)) + 1


func test_smoke_sim() -> void:
	EventBus.ball_kicked.connect(_on_kick)
	var m := make_headless_match(3, -1, 4.0)
	assert_true(Factory.is_implemented("ai_brain"))
	var t0 := Time.get_ticks_usec()
	run_ticks(m, 6000)
	print("ms/tick ", (Time.get_ticks_usec() - t0) / 6000.0 / 1000.0)
	print("kicks ", kicks, " score ", m.teams[0].score, "-", m.teams[1].score, " ball ", m.ball.pos)
	EventBus.ball_kicked.disconnect(_on_kick)
	assert_true(m.tick >= 6000)
