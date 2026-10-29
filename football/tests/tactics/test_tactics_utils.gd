extends TacTestBase
## Formation utils, substitution policy, team library / kit clash.


func test_mirror_roundtrip_and_symmetry() -> void:
	for id in DataLoader.list_formation_ids():
		var f := DataLoader.load_formation(id)
		var mm := TacFormationUtils.mirror(TacFormationUtils.mirror(f))
		for i in 11:
			assert_eq(mm.roles[i], f.roles[i], "%s role roundtrip" % id)
			assert_near(mm.positions[i].x, f.positions[i].x, 0.0001)
			assert_near(mm.positions[i].y, f.positions[i].y, 0.0001)
		var mir := TacFormationUtils.mirror(f)
		# Mirroring a symmetric formation yields the same set of (role, x, y) entries.
		for i in 11:
			var found := false
			for j in 11:
				if mir.roles[i] == f.roles[j] and mir.positions[i].distance_to(f.positions[j]) < 0.03:
					found = true
			assert_true(found, "%s mirrored slot %d matches an original slot" % [id, i])
		assert_eq(mir.roles[0], FB.Role.GK)


func test_to_world_matches_team_conversion() -> void:
	var m := new_match(41)
	for t: Team in m.teams:
		var w := TacFormationUtils.to_world(t.formation, t.attack_dir)
		for i in 11:
			var expect := t.normalized_to_world(t.formation.positions[i])
			assert_near(w[i].x, expect.x, 0.001)
			assert_near(w[i].y, expect.y, 0.001)


func test_validate_rejects_bad_formations() -> void:
	var f := DataLoader.load_formation("4-4-2")
	var bad := FormationData.from_dict(f.to_dict())
	bad.roles[0] = FB.Role.CB
	assert_true(TacFormationUtils.validate(bad).size() > 0, "slot 0 must be GK")
	var short := FormationData.from_dict(f.to_dict())
	short.positions.resize(10)
	short.roles.resize(10)
	assert_true(TacFormationUtils.validate(short).size() > 0, "needs 11 slots")
	var stacked := FormationData.from_dict(f.to_dict())
	stacked.positions[2] = stacked.positions[3]
	assert_true(TacFormationUtils.validate(stacked).size() > 0, "stacked slots rejected")


func test_arrange_squad_for_new_formation() -> void:
	for id in DataLoader.list_team_ids():
		for f in FORMATIONS:
			var t := DataLoader.load_team(id)
			var n_before := t.squad.size()
			assert_true(TacFormationUtils.arrange_squad(t, f))
			assert_eq(t.squad.size(), n_before, "no players lost")
			var form := DataLoader.load_formation(f)
			assert_eq(t.tactics.formation_id, f)
			assert_eq(t.squad[0].role, FB.Role.GK, "GK first")
			var seen := {}
			for p: PlayerData in t.squad:
				assert_false(seen.has(p.id), "no duplicate players")
				seen[p.id] = true
			var fit := 0.0
			for i in 11:
				fit += TacShapeMath.role_distance(t.squad[i].role, form.roles[i])
			assert_true(fit / 11.0 < 1.6, "%s -> %s XI fits roles (avg %f)" % [id, f, fit / 11.0])


func test_apply_tactics() -> void:
	var t := DataLoader.load_team("reds")
	var tac := TacticsData.new()
	tac.pressing = 0.9
	tac.width = 0.1
	tac.corner_routine = "short"
	TacFormationUtils.apply_tactics(t, tac)
	assert_near(t.tactics.pressing, 0.9)
	assert_near(t.tactics.width, 0.1)
	assert_eq(t.tactics.corner_routine, "short")
	tac.pressing = 0.2
	assert_near(t.tactics.pressing, 0.9, 0.0001, "copy, not reference")


# --- Substitutions -------------------------------------------------------------
func test_substitution_suggests_tired_player() -> void:
	var m := new_match(42)
	var t := m.teams[0]
	assert_eq(TacSubstitutionPolicy.suggest(t, 60.0).size(), 0, "fresh team: no change")
	t.players[8].stamina = 0.12
	var s := TacSubstitutionPolicy.suggest(t, 60.0)
	assert_true(s.size() >= 1, "exhausted player flagged")
	assert_eq(s[0]["out"], t.players[8])
	assert_true(t.bench.has(s[0]["in_data"]), "replacement from the bench")
	assert_true(s[0]["in_data"].role != FB.Role.GK, "no GK replaces an outfielder")
	assert_true(TacShapeMath.role_distance(s[0]["in_data"].role, t.players[8].role) <= 2.5, "similar role")
	assert_true(TacSubstitutionPolicy.apply(t, s[0]), "apply succeeds")
	assert_eq(t.subs_used, 1)


func test_substitution_orders_by_urgency_and_limits() -> void:
	var m := new_match(43)
	var t := m.teams[0]
	t.players[2].stamina = 0.3
	t.players[9].stamina = 0.05
	t.players[0].stamina = 0.01
	var s := TacSubstitutionPolicy.suggest(t, 70.0, 3)
	assert_eq(s.size(), 2, "GK never suggested for fatigue; two outfielders flagged")
	assert_eq(s[0]["out"], t.players[9], "most tired first")
	var used := {}
	for x in s:
		assert_false(used.has(x["in_data"]), "each bench player used once")
		used[x["in_data"]] = true
	t.subs_used = FB.MAX_SUBSTITUTIONS
	assert_eq(TacSubstitutionPolicy.suggest(t, 70.0).size(), 0, "no subs left")
	t.subs_used = FB.MAX_SUBSTITUTIONS - 1
	assert_eq(TacSubstitutionPolicy.suggest(t, 70.0, 3).size(), 1, "limited by remaining subs")


func test_substitution_ignores_sent_off_and_early_fatigue() -> void:
	var m := new_match(44)
	var t := m.teams[0]
	t.players[4].stamina = 0.05
	t.players[4].sent_off = true
	assert_eq(TacSubstitutionPolicy.suggest(t, 80.0).size(), 0, "sent-off players are not substituted")
	t.players[6].stamina = 0.3
	assert_eq(TacSubstitutionPolicy.suggest(t, 20.0).size(), 0, "mild tiredness early is tolerated")
	assert_true(TacSubstitutionPolicy.suggest(t, 65.0).size() >= 1, "tired later is flagged")


func test_substitution_booked_and_tactical() -> void:
	var m := new_match(45)
	var t := m.teams[0]
	var booked := t.players[3]
	booked.yellow_cards = 1
	booked.data.aggression = 90
	var s := TacSubstitutionPolicy.suggest(t, 60.0)
	assert_true(s.size() >= 1 and s[0]["out"] == booked, "aggressive booked defender replaced")
	booked.yellow_cards = 0
	# Losing late: bring on a forward for a defender/DM.
	t.opponent.score = 2
	t.score = 0
	var chase := TacSubstitutionPolicy.suggest(t, 78.0)
	assert_true(chase.size() >= 1, "chasing the game")
	var grp := TacShapeMath.group_of(chase[0]["in_data"].role)
	assert_true(grp == TacShapeMath.Group.FWD or grp == TacShapeMath.Group.WIDE or grp == TacShapeMath.Group.AM, "attacker comes on")


# --- Team library / kits ---------------------------------------------------------
func test_team_library_entries() -> void:
	var entries := TacTeamLibrary.list_entries()
	assert_true(entries.size() >= 6)
	for e in entries:
		assert_true(e["name"] != "" and e["overall"] > 0, "entry fields")
		assert_true(e["primary"] is Color)
		assert_not_null(TacTeamLibrary.load_team(e["id"]))


func test_kit_clash_detection_and_alternate() -> void:
	var a := DataLoader.load_team("reds")
	var b := DataLoader.load_team("reds")
	assert_true(TacTeamLibrary.kit_clash(a, b), "identical kits clash")
	var alt := TacTeamLibrary.alternate_kit_color(a, b)
	assert_false(TacTeamLibrary.colors_clash(alt, a.color_primary), "alternate contrasts with home")
	var blues := DataLoader.load_team("blues")
	assert_false(TacTeamLibrary.kit_clash(a, blues), "red vs blue fine")
	assert_true(TacTeamLibrary.alternate_kit_color(a, blues) == blues.color_primary, "no change when no clash")
	# Dark vs dark.
	var blacks := DataLoader.load_team("blacks")
	var navy := DataLoader.load_team("blues")
	navy.color_primary = Color("#111827")
	assert_true(TacTeamLibrary.kit_clash(blacks, navy), "black vs near-black clash")
	assert_true(TacTeamLibrary.resolve_away_kit(blacks, navy), "kit changed")
	assert_false(TacTeamLibrary.kit_clash(blacks, navy), "resolved")
	assert_false(TacTeamLibrary.colors_clash(navy.color_primary, navy.color_secondary), "away kit keeps trim contrast")


func test_all_team_pairs_resolve() -> void:
	var ids := DataLoader.list_team_ids()
	for h in ids:
		for a in ids:
			if h == a:
				continue
			var home := DataLoader.load_team(h)
			var away := DataLoader.load_team(a)
			TacTeamLibrary.resolve_away_kit(home, away)
			assert_false(TacTeamLibrary.kit_clash(home, away), "%s vs %s no clash after resolve" % [h, a])
