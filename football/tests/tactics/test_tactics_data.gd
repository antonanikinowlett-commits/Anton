extends TacTestBase
## JSON data validity for tactics/data/**.


func test_index_lists_files() -> void:
	var idx: Variant = read_json("res://tactics/data/index.json")
	assert_true(idx is Dictionary, "index parses")
	var teams: Array = idx["teams"]
	var forms: Array = idx["formations"]
	assert_true(teams.size() >= 6, "at least 6 teams")
	assert_eq(forms.size(), 4, "4 formations")
	for t in teams:
		assert_true(FileAccess.file_exists("res://tactics/data/teams/%s.json" % t), "team file %s" % t)
	for f in forms:
		assert_true(FileAccess.file_exists("res://tactics/data/formations/%s.json" % f), "formation file %s" % f)


func test_formations_valid() -> void:
	for id in DataLoader.list_formation_ids():
		var raw: Variant = read_json("res://tactics/data/formations/%s.json" % id)
		assert_true(raw is Dictionary, "%s parses" % id)
		assert_eq(raw["id"], id, "id matches file")
		assert_eq((raw["slots"] as Array).size(), 11, "%s has 11 slots" % id)
		var f := DataLoader.load_formation(id)
		assert_eq(f.slot_count(), 11, "%s slot_count" % id)
		assert_eq(f.roles[0], FB.Role.GK, "%s slot 0 is GK" % id)
		var errs := TacFormationUtils.validate(f)
		assert_eq(errs.size(), 0, "%s validate: %s" % [id, ", ".join(errs)])


func test_formations_left_right_symmetric() -> void:
	for id in DataLoader.list_formation_ids():
		var f := DataLoader.load_formation(id)
		for i in 11:
			var mirror_y := 1.0 - f.positions[i].y
			var found := false
			for j in 11:
				if f.roles[j] == TacShapeMath.mirror_role(f.roles[i]) \
						and absf(f.positions[j].y - mirror_y) < 0.03 and absf(f.positions[j].x - f.positions[i].x) < 0.03:
					found = true
			assert_true(found, "%s slot %d has a mirrored partner" % [id, i])


func test_teams_valid() -> void:
	var ids := DataLoader.list_team_ids()
	assert_true(ids.size() >= 6, "6+ teams")
	for id in ids:
		var raw: Variant = read_json("res://tactics/data/teams/%s.json" % id)
		assert_true(raw is Dictionary, "%s parses" % id)
		var players: Array = raw["players"]
		assert_true(players.size() >= 16 and players.size() <= 18, "%s squad size %d" % [id, players.size()])
		var t := DataLoader.load_team(id)
		var gks := 0
		var ids_seen := {}
		for p: PlayerData in t.squad:
			if p.role == FB.Role.GK:
				gks += 1
			assert_false(ids_seen.has(p.id), "%s unique id %s" % [id, p.id])
			ids_seen[p.id] = true
			for k in PlayerData.STAT_KEYS:
				var v: int = p.get(k)
				assert_true(v >= 1 and v <= 99, "%s %s %s in range" % [id, p.id, k])
				if p.role != FB.Role.GK and k != "goalkeeping" and k != "reflexes":
					assert_true(v >= 35 and v <= 95, "%s %s %s=%d outfield range" % [id, p.id, k, v])
		assert_true(gks >= 2, "%s has 2 GKs" % id)
		# Starting XI matches the formation in slot order, GK first.
		var f := DataLoader.load_formation(t.tactics.formation_id)
		var xi := t.starting_xi()
		assert_eq(xi.size(), 11, "%s XI" % id)
		for i in 11:
			assert_eq(xi[i].role, f.roles[i], "%s XI slot %d role" % [id, i])
		assert_eq(xi[0].role, FB.Role.GK, "%s XI[0] GK" % id)
		# Tactics sanity.
		for k in TacticsData.SLIDERS:
			var v: float = t.tactics.get(k)
			assert_true(v >= 0.0 and v <= 1.0, "%s slider %s" % [id, k])
		for tid in [t.tactics.penalty_taker_id, t.tactics.free_kick_taker_id, t.tactics.corner_taker_id, t.tactics.captain_id]:
			assert_not_null(t.find_player(tid), "%s taker id %s exists" % [id, tid])
		assert_true(["near_post", "far_post", "short"].has(t.tactics.corner_routine), "%s routine" % id)


func test_team_colors_contrast() -> void:
	var prim: Array[Color] = []
	for id in DataLoader.list_team_ids():
		var t := DataLoader.load_team(id)
		assert_true(TacShapeMath.color_distance(t.color_primary, t.color_secondary) > 200.0, "%s primary/secondary contrast" % id)
		assert_true(TacShapeMath.color_distance(t.color_primary, t.color_goalkeeper) > 200.0, "%s primary/gk contrast" % id)
		prim.append(t.color_primary)
	for i in prim.size():
		for j in range(i + 1, prim.size()):
			assert_true(TacShapeMath.color_distance(prim[i], prim[j]) > 120.0, "primaries %d/%d distinct" % [i, j])


func test_team_strength_varies() -> void:
	var lo := 999
	var hi := 0
	for id in DataLoader.list_team_ids():
		var r := TacTeamLibrary.team_rating(DataLoader.load_team(id))
		lo = mini(lo, r)
		hi = maxi(hi, r)
		assert_true(r >= 55 and r <= 85, "%s rating %d plausible" % [id, r])
	assert_true(hi - lo >= 8, "teams differ in strength (%d..%d)" % [lo, hi])


func test_role_profiles() -> void:
	for id in DataLoader.list_team_ids():
		var t := DataLoader.load_team(id)
		for p: PlayerData in t.starting_xi():
			if p.role == FB.Role.GK:
				assert_true(p.goalkeeping >= 55 and p.reflexes >= 55, "%s GK stats" % id)
			elif p.role == FB.Role.ST:
				assert_true(p.shooting > p.tackling, "%s striker shoots more than tackles" % id)
			elif p.role == FB.Role.CB:
				assert_true(p.tackling > p.shooting, "%s CB tackles more than shoots" % id)
