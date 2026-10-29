extends TestCase
## UiStatsTracker aggregation from simulated EventBus emissions.


func _tracker(m: FootballMatch) -> UiStatsTracker:
	return UiStatsTracker.ensure_for(m)


func test_events_aggregate_per_team() -> void:
	var m := make_headless_match(21, 0)
	var t := _tracker(m)
	var h: Team = m.teams[0]
	var a: Team = m.teams[1]
	EventBus.shot_taken.emit(h.players[9], true)
	EventBus.shot_taken.emit(h.players[10], false)
	EventBus.shot_taken.emit(a.players[9], true)
	EventBus.foul.emit(a.players[3], h.players[4], Vector2.ZERO, FB.FoulSeverity.CARELESS, false)
	EventBus.foul.emit(h.players[3], a.players[4], Vector2.ZERO, FB.FoulSeverity.CARELESS, true)
	EventBus.foul.emit(h.players[2], a.players[4], Vector2.ZERO, FB.FoulSeverity.RECKLESS, false)
	EventBus.card.emit(h.players[2], FB.Card.YELLOW)
	EventBus.card.emit(a.players[3], FB.Card.SECOND_YELLOW)
	EventBus.card.emit(a.players[4], FB.Card.RED)
	EventBus.offside.emit(h.players[9], Vector2.ZERO)
	EventBus.corner.emit(1, Vector2.ZERO)
	EventBus.corner.emit(1, Vector2.ZERO)
	EventBus.save_made.emit(a.players[0])
	EventBus.ball_kicked.emit(h.players[5], FB.IntentAction.PASS, 0.5)
	EventBus.ball_kicked.emit(h.players[5], FB.IntentAction.SHOOT, 0.9)
	EventBus.ball_kicked.emit(h.players[5], FB.IntentAction.CROSS, 0.9)
	EventBus.tackle_attempted.emit(a.players[6], h.players[5], false, true)
	EventBus.tackle_attempted.emit(a.players[6], h.players[5], true, false)
	assert_eq(t.shots, [2, 1] as Array[int])
	assert_eq(t.shots_on_target, [1, 1] as Array[int])
	assert_eq(t.fouls, [2, 1] as Array[int])
	assert_eq(t.yellow_cards, [1, 1] as Array[int])
	assert_eq(t.red_cards, [0, 2] as Array[int])
	assert_eq(t.offsides, [1, 0] as Array[int])
	assert_eq(t.corners, [0, 2] as Array[int])
	assert_eq(t.saves, [0, 1] as Array[int])
	assert_eq(t.passes, [2, 0] as Array[int])
	assert_eq(t.tackles, [0, 2] as Array[int])
	assert_eq(t.tackles_won, [0, 1] as Array[int])


func test_goals_and_goal_log() -> void:
	var m := make_headless_match(22, 0)
	var t := _tracker(m)
	EventBus.goal_scored.emit(0, m.teams[0].players[9], null, false)
	EventBus.goal_scored.emit(1, m.teams[0].players[3], null, true)
	assert_eq(t.goals, [1, 1] as Array[int])
	assert_eq(t.goal_log.size(), 2)
	assert_eq(t.goal_log[0]["scorer"], m.teams[0].players[9].data.name)
	assert_true(t.goal_log[1]["own_goal"])
	assert_eq(UiStatsTracker.last_stats["goals"], [1, 1] as Array[int], "snapshot kept")


func test_possession_from_match_ticks() -> void:
	var m := make_headless_match(23, 0)
	var t := _tracker(m)
	t.poll()
	m.possession_team = 0
	m.tick += 60 * 3
	t.poll()
	m.possession_team = 1
	m.tick += 60 * 1
	t.poll()
	assert_near(t.possession_time[0], 3.0, 0.02)
	assert_near(t.possession_time[1], 1.0, 0.02)
	assert_near(t.possession_pct(0), 75.0, 0.5)
	assert_near(t.possession_pct(0) + t.possession_pct(1), 100.0, 0.001)
	# No possession recorded -> 50/50, loose ball adds nothing.
	var t2 := UiStatsTracker.new()
	assert_near(t2.possession_pct(0), 50.0, 0.001)
	t2.add_possession_time(0, 2.0)
	t2.add_possession_time(1, 6.0)
	assert_near(t2.possession_pct(1), 75.0, 0.001)
	t2.free()


func test_ignores_null_players_and_resets() -> void:
	var m := make_headless_match(24, 0)
	var t := _tracker(m)
	EventBus.shot_taken.emit(null, true)
	EventBus.card.emit(null, FB.Card.RED)
	EventBus.goal_scored.emit(0, null, null, false)
	assert_eq(t.shots, [0, 0] as Array[int])
	assert_eq(t.goals, [1, 0] as Array[int])
	t.reset()
	assert_eq(t.goals, [0, 0] as Array[int])
	assert_true(t.goal_log.is_empty())


func test_ensure_for_reuses_and_dict_shape() -> void:
	var m := make_headless_match(25, 0)
	var t1 := _tracker(m)
	var t2 := _tracker(m)
	assert_true(t1 == t2, "single tracker per match")
	var d := t1.to_dict()
	for k in ["shots", "shots_on_target", "fouls", "yellow_cards", "red_cards", "offsides", "corners", "possession", "goal_log"]:
		assert_true(d.has(k), k)
	assert_eq((d["possession"] as Array).size(), 2)


func test_no_double_counting_with_two_trackers_freed() -> void:
	var m := make_headless_match(26, 0)
	var t := _tracker(m)
	EventBus.corner.emit(0, Vector2.ZERO)
	assert_eq(t.corners[0], 1)
	m.free()
	# After the match (and tracker) is freed the signals are disconnected: no errors.
	EventBus.corner.emit(0, Vector2.ZERO)
	assert_true(true)
