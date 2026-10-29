extends TacTestBase
## Kickoff, set-piece positions and taker selection.


func _all_pos(team: Team, r: RestartInfo) -> Array[Vector2]:
	var out: Array[Vector2] = []
	for p: Player in team.players:
		out.append(team.shape.get_set_piece_position(p, r))
	return out


func test_kickoff_positions_legal() -> void:
	var m := new_match(21)
	for f in FORMATIONS:
		for flip in [false, true]:
			for t: Team in m.teams:
				set_formation(t, f)
				if flip:
					t.attack_dir = -t.attack_dir
			for t: Team in m.teams:
				for kicking in [true, false]:
					var taker := t.shape.get_kickoff_taker()
					assert_not_null(taker, "taker exists")
					assert_false(taker.is_goalkeeper(), "taker is outfield")
					for p: Player in t.players:
						var pos := t.shape.get_kickoff_position(p, kicking)
						assert_true(FB.is_on_pitch(pos), "%s kickoff in pitch" % p.name)
						assert_true(pos.x * t.attack_dir <= 0.0, "%s %s in own half (x=%f)" % [f, p.name, pos.x])
						if kicking and p == taker:
							assert_true(pos.length() < 1.0, "taker at the centre spot")
						else:
							assert_true(pos.length() >= FB.CENTER_CIRCLE_RADIUS, "%s %s outside circle (d=%f)" % [f, p.name, pos.length()])


func test_kickoff_taker_ignores_sent_off() -> void:
	var m := new_match(22)
	var t := m.teams[0]
	var first := t.shape.get_kickoff_taker()
	first.sent_off = true
	var second := t.shape.get_kickoff_taker()
	assert_true(second != first and not second.sent_off, "next best taker chosen")


func test_free_kick_wall_distance_and_size() -> void:
	var m := new_match(23)
	var atk := m.teams[0]
	var def := m.teams[1]
	var spots: Array[Vector2] = [Vector2(35, 5), Vector2(32, -12), Vector2(25, 0), Vector2(40, 15), Vector2(10, 10), Vector2(42, -8), Vector2(46, -3), Vector2(49, 10)]
	for spot in spots:
		# Team 0 attacks +x so the goal defended by team 1 is at +x.
		var r := make_restart(FB.Restart.FREE_KICK_DIRECT, atk.team_id, spot)
		var goal_d := spot.distance_to(def.own_goal_center())
		var near_wall := 0
		for p: Player in def.players:
			var pos := def.shape.get_set_piece_position(p, r)
			assert_true(FB.is_on_pitch(pos), "%s legal" % p.name)
			if not p.is_goalkeeper() or goal_d > 12.0:
				if not p.is_goalkeeper():
					assert_true(pos.distance_to(spot) >= 9.15, "%s at least 9.15 m (d=%f spot=%s)" % [p.name, pos.distance_to(spot), spot])
			# Wall members: close to 9.15-10 m from the ball in the direction of goal.
			var d := pos.distance_to(spot)
			var toward_goal := (def.own_goal_center() - spot).normalized()
			var along := (pos - spot).dot(toward_goal)
			if d < 10.5 and d >= 9.15 and along > 8.5:
				near_wall += 1
		if goal_d <= 12.0:
			continue
		if goal_d <= 18.0:
			assert_true(near_wall >= 4, "big wall for close free kick (%d at %f m)" % [near_wall, goal_d])
		elif goal_d <= 24.0:
			assert_true(near_wall >= 3, "wall of 3+ at %f m (%d)" % [goal_d, near_wall])
		elif goal_d <= 38.0:
			assert_true(near_wall >= 2, "wall of 2+ at %f m (%d)" % [goal_d, near_wall])
		else:
			assert_eq(near_wall, 0, "no wall far from goal (%f)" % goal_d)


func test_free_kick_wall_covers_goal() -> void:
	var m := new_match(24)
	var def := m.teams[1]
	var spot := Vector2(30, 6)
	var r := make_restart(FB.Restart.FREE_KICK_DIRECT, 0, spot)
	var goal := def.own_goal_center()
	var wall: Array[Vector2] = []
	for p: Player in def.players:
		if p.is_goalkeeper():
			continue
		var pos := def.shape.get_set_piece_position(p, r)
		if pos.distance_to(spot) < 10.5:
			wall.append(pos)
	assert_true(wall.size() >= 3, "wall exists")
	# Wall players sit on the ball-goal line (small lateral deviation).
	var dir_g := (goal - spot).normalized()
	for w in wall:
		var rel := w - spot
		var lateral := absf(rel.x * dir_g.y - rel.y * dir_g.x)
		assert_true(lateral < 4.5, "wall member near the line (%f)" % lateral)


func test_free_kick_attackers_in_box_and_onside() -> void:
	var m := new_match(25)
	var atk := m.teams[0]
	for p: Player in m.teams[1].players:
		p.pos = Vector2(44.0 + p.slot_index % 3, -20.0 + p.slot_index * 4.0)
	var r := make_restart(FB.Restart.FREE_KICK_DIRECT, 0, Vector2(34, 12))
	var in_box := 0
	for p: Player in atk.players:
		var pos := atk.shape.get_set_piece_position(p, r)
		assert_true(FB.is_on_pitch(pos))
		if pos.x > FB.HALF_LENGTH - FB.PENALTY_AREA_DEPTH and absf(pos.y) < FB.PENALTY_AREA_WIDTH * 0.5:
			in_box += 1
	assert_true(in_box >= 2, "attackers attack the box (%d)" % in_box)


func test_penalty_positions_legal() -> void:
	var m := new_match(26)
	for eg in [1.0, -1.0]:
		var spot := Vector2(eg * (FB.HALF_LENGTH - FB.PENALTY_SPOT_DIST), 0.0)
		var taking_id := 0 if eg > 0 else 1
		var r := make_restart(FB.Restart.PENALTY, taking_id, spot)
		var atk: Team = m.teams[taking_id]
		var def: Team = m.teams[1 - taking_id]
		r.taker = atk.shape.pick_set_piece_taker(r)
		var taker := r.taker
		assert_not_null(taker)
		assert_false(taker.is_goalkeeper(), "taker outfield")
		for t: Team in [atk, def]:
			for p: Player in t.players:
				var pos := t.shape.get_set_piece_position(p, r)
				assert_true(FB.is_on_pitch(pos), "%s in pitch" % p.name)
				if p == taker:
					assert_true(pos.distance_to(spot) < 2.0, "taker by the spot")
					continue
				if t == def and p.is_goalkeeper():
					assert_true(absf(pos.x) > FB.HALF_LENGTH - 1.0 and absf(pos.y) < 1.0, "defending GK on the goal line")
					continue
				var depth := FB.HALF_LENGTH - absf(pos.x) if signf(pos.x) == eg else 99.0
				var in_area := depth < FB.PENALTY_AREA_DEPTH and absf(pos.y) < FB.PENALTY_AREA_WIDTH * 0.5
				assert_false(in_area, "%s outside the area (%s)" % [p.name, pos])
				assert_true(pos.distance_to(spot) >= FB.PENALTY_ARC_RADIUS, "%s outside the arc (d=%f)" % [p.name, pos.distance_to(spot)])
				assert_true((spot.x - pos.x) * eg >= 0.0, "%s behind the spot" % p.name)


func test_corner_positions() -> void:
	var m := new_match(27)
	var atk := m.teams[0]
	var def := m.teams[1]
	for routine in ["near_post", "far_post", "short"]:
		atk.tactics.corner_routine = routine
		for corner in [Vector2(52.5, -34), Vector2(52.5, 34)]:
			var r := make_restart(FB.Restart.CORNER, 0, corner)
			r.taker = atk.shape.pick_set_piece_taker(r)
			var in_box := 0
			var on_taker := 0
			for p: Player in atk.players:
				var pos := atk.shape.get_set_piece_position(p, r)
				assert_true(FB.is_on_pitch(pos))
				if p == r.taker:
					on_taker += 1
					assert_true(pos.distance_to(corner) < 2.0, "taker at corner")
				elif pos.x > FB.HALF_LENGTH - FB.PENALTY_AREA_DEPTH and absf(pos.y) < FB.PENALTY_AREA_WIDTH * 0.5:
					in_box += 1
			assert_eq(on_taker, 1)
			assert_true(in_box >= 3, "%s: attackers in the box (%d)" % [routine, in_box])
			var goal_side := 0
			for p: Player in def.players:
				var pos := def.shape.get_set_piece_position(p, r)
				assert_true(FB.is_on_pitch(pos))
				if not p.is_goalkeeper():
					assert_true(pos.distance_to(corner) >= 9.15, "defender %s 9.15 m from corner (d=%f)" % [p.name, pos.distance_to(corner)])
				if pos.x > FB.HALF_LENGTH - FB.PENALTY_AREA_DEPTH:
					goal_side += 1
			assert_true(goal_side >= 5, "defenders back in their box (%d)" % goal_side)
	# Routine changes the layout.
	atk.tactics.corner_routine = "near_post"
	var r2 := make_restart(FB.Restart.CORNER, 0, Vector2(52.5, -34))
	r2.taker = atk.shape.pick_set_piece_taker(r2)
	var near_set := _all_pos(atk, r2)
	atk.tactics.corner_routine = "far_post"
	r2.position = Vector2(52.5, -34.0 + 0.01)
	var far_set := _all_pos(atk, r2)
	var diff := 0.0
	for i in near_set.size():
		diff += near_set[i].distance_to(far_set[i])
	assert_true(diff > 5.0, "near and far post routines differ")


func test_throw_in_options() -> void:
	var m := new_match(28)
	var atk := m.teams[0]
	var def := m.teams[1]
	var spot := Vector2(10, -34)
	var r := make_restart(FB.Restart.THROW_IN, 0, spot)
	r.taker = atk.shape.pick_set_piece_taker(r)
	assert_false(r.taker.is_goalkeeper())
	var close := 0
	for p: Player in atk.players:
		var pos := atk.shape.get_set_piece_position(p, r)
		assert_true(FB.is_on_pitch(pos))
		if p == r.taker:
			assert_true(absf(pos.y) >= 33.0, "thrower on the touchline")
		elif pos.distance_to(spot) < 18.0:
			close += 1
	assert_true(close >= 3, "throw-in options near the ball (%d)" % close)
	for p: Player in def.players:
		var pos := def.shape.get_set_piece_position(p, r)
		assert_true(FB.is_on_pitch(pos))
		assert_true(pos.distance_to(spot) >= 2.0, "defenders not on the thrower")


func test_goal_kick_spread() -> void:
	var m := new_match(29)
	var atk := m.teams[0]
	var def := m.teams[1]
	var spot := Vector2(-(FB.HALF_LENGTH - FB.GOAL_AREA_DEPTH), 0)
	var r := make_restart(FB.Restart.GOAL_KICK, 0, spot)
	r.taker = atk.shape.pick_set_piece_taker(r)
	assert_true(r.taker.is_goalkeeper(), "GK takes goal kicks")
	var ys: Array[float] = []
	for p: Player in atk.players:
		var pos := atk.shape.get_set_piece_position(p, r)
		assert_true(FB.is_on_pitch(pos))
		if p != r.taker:
			ys.append(pos.y)
	var lo := 999.0
	var hi := -999.0
	for y in ys:
		lo = minf(lo, y)
		hi = maxf(hi, y)
	assert_true(hi - lo > 40.0, "team spreads wide for a goal kick")
	# Opponents stay out of the kicker's penalty area.
	for p: Player in def.players:
		if p.is_goalkeeper():
			continue
		var pos := def.shape.get_set_piece_position(p, r)
		var in_area := pos.x < -FB.HALF_LENGTH + FB.PENALTY_AREA_DEPTH and absf(pos.y) < FB.PENALTY_AREA_WIDTH * 0.5
		assert_false(in_area, "%s outside goal-kick area" % p.name)


func test_set_piece_positions_for_all_restarts_all_formations() -> void:
	var m := new_match(30)
	var types := [FB.Restart.THROW_IN, FB.Restart.CORNER, FB.Restart.GOAL_KICK, FB.Restart.FREE_KICK_DIRECT,
		FB.Restart.FREE_KICK_INDIRECT, FB.Restart.PENALTY, FB.Restart.DROP_BALL, FB.Restart.KICKOFF]
	for f in FORMATIONS:
		for t: Team in m.teams:
			set_formation(t, f)
		for type in types:
			for taking in [0, 1]:
				var spot := Vector2(30, -34) if type == FB.Restart.THROW_IN else Vector2(-20, 14)
				if type == FB.Restart.CORNER:
					spot = Vector2(-52.5, 34)
				elif type == FB.Restart.GOAL_KICK:
					spot = Vector2(47, 0)
				elif type == FB.Restart.PENALTY:
					spot = Vector2(-41.5, 0)
				var r := make_restart(type, taking, spot)
				r.taker = m.teams[taking].shape.pick_set_piece_taker(r)
				for t: Team in m.teams:
					for p: Player in t.players:
						var pos := t.shape.get_set_piece_position(p, r)
						assert_true(FB.is_on_pitch(pos), "type %d %s legal (%s)" % [type, p.name, pos])
						assert_false(is_nan(pos.x), "finite")


func test_taker_honours_tactics_ids() -> void:
	var m := new_match(31)
	var t := m.teams[0]
	var xi := t.players
	t.tactics.penalty_taker_id = xi[9].data.id
	t.tactics.free_kick_taker_id = xi[6].data.id
	t.tactics.corner_taker_id = xi[7].data.id
	var spot := Vector2(0, 0)
	assert_eq(t.shape.pick_set_piece_taker(make_restart(FB.Restart.PENALTY, 0, spot)), xi[9])
	assert_eq(t.shape.pick_set_piece_taker(make_restart(FB.Restart.FREE_KICK_DIRECT, 0, spot)), xi[6])
	assert_eq(t.shape.pick_set_piece_taker(make_restart(FB.Restart.FREE_KICK_INDIRECT, 0, spot)), xi[6])
	assert_eq(t.shape.pick_set_piece_taker(make_restart(FB.Restart.CORNER, 0, spot)), xi[7])
	# Sent-off designated taker is skipped.
	xi[9].sent_off = true
	var alt := t.shape.pick_set_piece_taker(make_restart(FB.Restart.PENALTY, 0, spot))
	assert_true(alt != xi[9] and not alt.sent_off and not alt.is_goalkeeper(), "fallback penalty taker")


func test_taker_fallback_best_stat() -> void:
	var m := new_match(32)
	var t := m.teams[0]
	t.tactics.penalty_taker_id = ""
	t.tactics.free_kick_taker_id = ""
	t.tactics.corner_taker_id = ""
	for p: Player in t.players:
		p.data.shooting = 40
		p.data.passing = 40
		p.data.vision = 40
		p.data.control = 40
	t.players[8].data.shooting = 95
	t.players[8].data.control = 95
	t.players[5].data.passing = 95
	t.players[5].data.vision = 95
	var far_spot := Vector2(-30, 0)
	t.players[8].pos = far_spot
	t.players[5].pos = far_spot
	assert_eq(t.shape.pick_set_piece_taker(make_restart(FB.Restart.PENALTY, 0, Vector2(41.5, 0))), t.players[8], "best shooter")
	assert_eq(t.shape.pick_set_piece_taker(make_restart(FB.Restart.CORNER, 0, Vector2(52.5, 34))), t.players[5], "best passer takes corners")
	assert_eq(t.shape.pick_set_piece_taker(make_restart(FB.Restart.FREE_KICK_DIRECT, 0, Vector2(-30, 0))), t.players[5], "playmaker takes deep free kicks")
	# Goal kicks: GK; sent-off GK -> someone else.
	assert_eq(t.shape.pick_set_piece_taker(make_restart(FB.Restart.GOAL_KICK, 0, Vector2(-47, 0))), t.goalkeeper())
	var gk := t.goalkeeper()
	gk.sent_off = true
	var fallback := t.shape.pick_set_piece_taker(make_restart(FB.Restart.GOAL_KICK, 0, Vector2(-47, 0)))
	assert_true(fallback != gk and not fallback.sent_off, "no sent-off taker")


func test_throw_in_taker_is_nearest_outfielder() -> void:
	var m := new_match(33)
	var t := m.teams[0]
	var spot := Vector2(5, 34)
	for p: Player in t.players:
		p.pos = Vector2(-40, 0)
	t.players[7].pos = spot + Vector2(1, -1)
	t.players[0].pos = spot
	assert_eq(t.shape.pick_set_piece_taker(make_restart(FB.Restart.THROW_IN, 0, spot)), t.players[7], "GK never throws in")
