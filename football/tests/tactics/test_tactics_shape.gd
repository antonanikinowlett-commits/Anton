extends TacTestBase
## Open-play team shape: legality, reactions to ball / possession / sliders, formation switch, perf.


func _balls() -> Array[Vector2]:
	return [Vector2(0, 0), Vector2(-45, 0), Vector2(45, 0), Vector2(-30, -30), Vector2(30, 30),
		Vector2(50, -33), Vector2(-50, 33), Vector2(10, 20)]


func test_shape_inside_pitch_all_scenarios() -> void:
	var m := new_match(2)
	for f in FORMATIONS:
		for t: Team in m.teams:
			set_formation(t, f)
		for ball in _balls():
			for poss in [-1, 0, 1]:
				set_scene(m, ball, poss)
				for t: Team in m.teams:
					settle(t, 12)
					for p: Player in t.players:
						var h := p.home_position
						assert_true(FB.is_on_pitch(h), "%s %s in pitch ball=%s poss=%d: %s" % [f, p.name, ball, poss, h])
						assert_false(is_nan(h.x) or is_nan(h.y), "finite")
						if not p.is_goalkeeper():
							var own_x := frame(t, p).x
							assert_true(own_x >= 5.9, "%s outside own goal area (x=%f)" % [p.name, own_x])


func test_extreme_sliders_inside_pitch() -> void:
	var m := new_match(3)
	for t: Team in m.teams:
		for v in [0.0, 1.0]:
			t.tactics.pressing = v
			t.tactics.line_height = v
			t.tactics.width = v
			t.tactics.tempo = v
			t.tactics.mentality = v
			for ball in _balls():
				set_scene(m, ball, t.team_id)
				settle(t, 12)
				for p: Player in t.players:
					assert_true(FB.is_on_pitch(p.home_position), "%s slider=%f in pitch" % [p.name, v])


func test_goalkeeper_stays_in_goal_zone() -> void:
	var m := new_match(4)
	for ball in _balls():
		for poss in [0, 1]:
			set_scene(m, ball, poss)
			for t: Team in m.teams:
				settle(t, 12)
				var gk := t.goalkeeper()
				var a := frame(t, gk)
				assert_true(a.x <= 12.5 and a.x >= 0.9, "GK x in zone %f" % a.x)
				assert_true(absf(a.y - FB.HALF_WIDTH) <= 6.1, "GK y in zone %f" % a.y)


func test_shape_follows_ball_up_and_down() -> void:
	var m := new_match(5)
	var t := m.teams[0]
	set_scene(m, Vector2(-40, 0), 1)
	settle(t, 25)
	var low := mean_x(t)
	set_scene(m, Vector2(40, 0), 1)
	settle(t, 25)
	var high := mean_x(t)
	assert_true(high > low + 6.0, "block moves up with ball (%f -> %f)" % [low, high])


func test_shape_follows_ball_across() -> void:
	var m := new_match(6)
	var t := m.teams[0]
	var cy_left := 0.0
	var cy_right := 0.0
	set_scene(m, Vector2(0, -28 * t.attack_dir), 0)
	settle(t, 25)
	for p: Player in t.players:
		if not p.is_goalkeeper():
			cy_left += frame(t, p).y
	set_scene(m, Vector2(0, 28 * t.attack_dir), 0)
	settle(t, 25)
	for p: Player in t.players:
		if not p.is_goalkeeper():
			cy_right += frame(t, p).y
	assert_true(cy_right > cy_left + 20.0, "block shifts sideways with ball")


func test_possession_phase_changes_shape() -> void:
	var m := new_match(7)
	var t := m.teams[0]
	set_scene(m, Vector2(10, 0), 0)
	settle(t, 30)
	var attacking := mean_x(t)
	var fb_att := 0.0
	for p: Player in t.players:
		if TacShapeMath.is_fullback(p.role):
			fb_att += frame(t, p).x
	set_scene(m, Vector2(10, 0), 1)
	settle(t, 30)
	var defending := mean_x(t)
	var fb_def := 0.0
	for p: Player in t.players:
		if TacShapeMath.is_fullback(p.role):
			fb_def += frame(t, p).x
	assert_true(attacking > defending + 4.0, "attacking higher than defending (%f vs %f)" % [attacking, defending])
	assert_true(fb_att > fb_def + 8.0, "fullbacks push up when attacking")


func test_strikers_stay_forward_defenders_deeper() -> void:
	var m := new_match(8)
	var t := m.teams[0]
	for poss in [0, 1]:
		set_scene(m, Vector2(-20 * t.attack_dir, 0), poss)
		settle(t, 25)
		var fwd_min := 999.0
		var cb_max := -999.0
		for p: Player in t.players:
			if p.role == FB.Role.ST or p.role == FB.Role.CF:
				fwd_min = minf(fwd_min, frame(t, p).x)
			if p.role == FB.Role.CB:
				cb_max = maxf(cb_max, frame(t, p).x)
		assert_true(fwd_min > cb_max + 15.0, "strikers far ahead of centre backs (poss %d)" % poss)


func test_defensive_line_is_coherent() -> void:
	var m := new_match(9)
	for t: Team in m.teams:
		set_formation(t, "4-4-2")
	var t := m.teams[0]
	for ball in _balls():
		set_scene(m, ball, 1)
		settle(t, 30)
		var lo := 999.0
		var hi := -999.0
		for p: Player in t.players:
			if p.role == FB.Role.CB or p.role == FB.Role.LB or p.role == FB.Role.RB:
				var x := frame(t, p).x
				lo = minf(lo, x)
				hi = maxf(hi, x)
		assert_true(hi - lo < 3.5, "back four level when defending (ball %s, spread %f)" % [ball, hi - lo])


func test_sliders_have_effect() -> void:
	var m := new_match(10)
	var t := m.teams[0]
	set_scene(m, Vector2(-5, 0), 1)
	# Line height.
	t.tactics.line_height = 0.0
	settle(t, 30)
	var low_line := _def_x(t)
	t.tactics.line_height = 1.0
	settle(t, 30)
	var high_line := _def_x(t)
	assert_true(high_line > low_line + 5.0, "line_height raises the line (%f -> %f)" % [low_line, high_line])
	# Width.
	t.tactics.width = 0.0
	settle(t, 30)
	var narrow := lateral_spread(t)
	t.tactics.width = 1.0
	settle(t, 30)
	var wide := lateral_spread(t)
	assert_true(wide > narrow + 3.0, "width widens the shape (%f -> %f)" % [narrow, wide])
	# Pressing (defending) raises the block.
	set_scene(m, Vector2(-5, 0), 1 - t.team_id)
	t.tactics.pressing = 0.0
	settle(t, 30)
	var passive := mean_x(t)
	t.tactics.pressing = 1.0
	settle(t, 30)
	var pressing := mean_x(t)
	assert_true(pressing > passive + 2.0, "pressing raises the block (%f -> %f)" % [passive, pressing])
	# Mentality (attacking).
	set_scene(m, Vector2(-5, 0), t.team_id)
	t.tactics.mentality = 0.0
	settle(t, 30)
	var cautious := mean_x(t)
	t.tactics.mentality = 1.0
	settle(t, 30)
	var bold := mean_x(t)
	assert_true(bold > cautious + 2.0, "mentality pushes the team forward (%f -> %f)" % [cautious, bold])


func _def_x(t: Team) -> float:
	var s := 0.0
	var c := 0
	for p: Player in t.players:
		if p.role == FB.Role.CB:
			s += frame(t, p).x
			c += 1
	return s / maxf(c, 1)


func test_players_not_stacked() -> void:
	var m := new_match(11)
	for f in FORMATIONS:
		for t: Team in m.teams:
			set_formation(t, f)
		for ball in _balls():
			set_scene(m, ball, 0)
			for t: Team in m.teams:
				settle(t, 20)
				var min_d := 999.0
				for i in t.players.size():
					for j in range(i + 1, t.players.size()):
						var a: Player = t.players[i]
						var b: Player = t.players[j]
						if a.is_goalkeeper() or b.is_goalkeeper():
							continue
						min_d = minf(min_d, a.home_position.distance_to(b.home_position))
				assert_true(min_d > 3.5, "%s ball %s min distance %f" % [f, ball, min_d])


func test_offside_aware() -> void:
	var m := new_match(12)
	var t := m.teams[0]
	var opp := m.teams[1]
	# Opponent defenders sit deep: second-last opponent at frame x = 80.
	for p: Player in opp.players:
		var fx := 70.0 if not p.is_goalkeeper() else 104.0
		p.pos = TacShapeMath.from_frame(Vector2(fx + (p.slot_index % 3) * 5.0, 20.0 + p.slot_index * 2.0), t.attack_dir)
	set_scene(m, Vector2(-5.0 * t.attack_dir, 0), 0)
	settle(t, 30)
	# Second-last opponent x (frame of t): collect.
	var xs: Array[float] = []
	for p: Player in opp.players:
		xs.append(p.pos.x * t.attack_dir + FB.HALF_LENGTH)
	xs.sort()
	var second_last: float = xs[xs.size() - 2]
	var ball_x := -5.0 + FB.HALF_LENGTH
	for p: Player in t.players:
		if p.is_goalkeeper():
			continue
		assert_true(frame(t, p).x <= maxf(second_last - 0.7, ball_x) + 0.1, "%s onside (x=%f line=%f)" % [p.name, frame(t, p).x, second_last])


func test_sent_off_ignored() -> void:
	var m := new_match(13)
	var t := m.teams[0]
	t.players[5].sent_off = true
	settle(t, 10)
	for p: Player in t.players:
		assert_true(FB.is_on_pitch(p.home_position), "all legal with a sent-off player")


func test_formation_switch_midmatch() -> void:
	var m := new_match(14)
	var t := m.teams[0]
	run_ticks(m, 120)
	for f in FORMATIONS:
		assert_true(TacFormationUtils.change_formation(t, f), f)
		assert_eq(t.formation.id, f)
		assert_eq(t.tactics.formation_id, f)
		var seen := {}
		for p: Player in t.players:
			assert_false(seen.has(p.slot_index), "slot used once")
			seen[p.slot_index] = true
			assert_eq(p.role, t.formation.roles[p.slot_index], "role matches slot")
		assert_eq(t.goalkeeper().slot_index, 0, "GK keeps slot 0")
		run_ticks(m, 60)
		for p: Player in t.players:
			assert_true(FB.is_on_pitch(p.home_position), "legal after switch")
			assert_false(is_nan(p.pos.x), "finite pos")
	assert_false(TacFormationUtils.change_formation(t, "9-9-9"), "unknown formation rejected")


func test_formation_switch_with_sent_off() -> void:
	var m := new_match(15)
	var t := m.teams[0]
	t.players[3].sent_off = true
	assert_true(TacFormationUtils.change_formation(t, "3-5-2"))
	var seen := {}
	for p: Player in t.players:
		assert_false(seen.has(p.slot_index), "unique slots")
		seen[p.slot_index] = true
	run_ticks(m, 30)


func test_both_sides_attack_directions() -> void:
	var m := new_match(16)
	# Swap sides like half-time; shapes must stay legal and mirrored in world x.
	for t: Team in m.teams:
		t.attack_dir = -t.attack_dir
	set_scene(m, Vector2(20, 5), 0)
	for t: Team in m.teams:
		settle(t, 20)
		for p: Player in t.players:
			assert_true(FB.is_on_pitch(p.home_position))
		assert_true(mean_x(t) > 20.0, "attack-frame shape independent of direction")


func test_update_benchmark() -> void:
	var m := new_match(17)
	var iterations := 2000
	set_scene(m, Vector2(12, 7), 0)
	var t0 := Time.get_ticks_usec()
	for i in iterations:
		m.ball.pos = Vector2(sin(i * 0.05) * 40.0, cos(i * 0.03) * 25.0)
		m.teams[0].shape.update(0.1)
		m.teams[1].shape.update(0.1)
	var per_update_us := float(Time.get_ticks_usec() - t0) / (iterations * 2.0)
	print("    shape.update: %.1f us per team update" % per_update_us)
	assert_true(per_update_us < 500.0, "update() fast enough (%f us)" % per_update_us)
