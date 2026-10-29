class_name FootballMatch
extends Node2D
## The "Match" interface. Owned by core. Builds the match from a MatchConfig and
## runs the fixed-step simulation loop in a deterministic order:
##   1. team think (shape + team brain), staggered    5. ball.physics_step
##   2. player think, staggered (FB.AI_STAGGER_GROUPS) 6. referee.step
##   3. player step (brain.act -> motor.step)          7. possession + control context
##   4. collision_solver.solve                         8. human_input.end_tick
## Headless matches (tests/sims) build no views and are stepped manually.

signal finished(result: Dictionary)

var config: MatchConfig
var rng := RandomNumberGenerator.new()
var ball: Ball
var teams: Array[Team] = []
var players: Array[Player] = []
var referee: Referee
var collision_solver: CollisionSolver
var human_input: InputController
var device_source: DeviceInputSource
var human_team: Team
var possession_team := -1
var control_context: int = FB.Context.NONE
var tick := 0
var paused := false
var is_finished := false
var headless := false

# Scene layers (null when headless).
var pitch_layer: Node2D
var entity_layer: Node2D
var camera: Camera2D
var ui_layer: CanvasLayer


func setup(cfg: MatchConfig) -> void:
	config = cfg
	headless = cfg.headless
	rng.seed = cfg.rng_seed if cfg.rng_seed != 0 else int(Time.get_ticks_usec())
	name = "Match"

	if not headless:
		pitch_layer = PitchView.new()
		add_child(pitch_layer)
	entity_layer = Node2D.new()
	entity_layer.name = "Entities"
	entity_layer.y_sort_enabled = true
	add_child(entity_layer)

	ball = Factory.create("ball") as Ball
	ball.name = "Ball"
	ball.setup(self)
	ball.owner_changed.connect(_on_ball_owner_changed)

	var home_data := cfg.home_team if cfg.home_team != null else DataLoader.load_team(_team_id_or_default(cfg.home_team_id, 0))
	var away_data := cfg.away_team if cfg.away_team != null else DataLoader.load_team(_team_id_or_default(cfg.away_team_id, 1))
	for side in 2:
		var t := Team.new()
		add_child(t)
		t.setup(side, home_data if side == 0 else away_data, self)
		teams.append(t)
		for p: Player in t.players:
			players.append(p)
			entity_layer.add_child(p)
	teams[0].opponent = teams[1]
	teams[1].opponent = teams[0]
	entity_layer.add_child(ball)

	collision_solver = Factory.create("collision_solver") as CollisionSolver
	collision_solver.setup(self)
	referee = Factory.create("referee") as Referee
	referee.name = "Referee"
	add_child(referee)
	referee.setup(self)

	if cfg.human_side >= 0:
		human_input = Factory.create("input_controller") as InputController
		human_input.name = "HumanInput"
		human_input.set_scheme(GameSettings.control_scheme)
		add_child(human_input)
		device_source = DeviceInputSource.new()
		device_source.name = "DeviceInput"
		device_source.controller = human_input
		add_child(device_source)
		human_team = teams[cfg.human_side]
		human_team.set_human(human_input)
		GameSettings.changed.connect(_on_settings_changed)


func _ready() -> void:
	if not headless:
		_build_views()


func _team_id_or_default(team_id: String, side: int) -> String:
	if team_id != "":
		return team_id
	var ids := DataLoader.list_team_ids()
	return ids[mini(side, ids.size() - 1)]


func _build_views() -> void:
	camera = Factory.create("camera") as Camera2D
	camera.name = "Camera"
	add_child(camera)
	if camera.has_method("bind"):
		camera.call("bind", self)
	ui_layer = CanvasLayer.new()
	ui_layer.name = "UI"
	ui_layer.layer = 10
	add_child(ui_layer)
	for slot in ["polish", "hud", "touch_controls", "set_piece_ui", "half_time", "pause_menu"]:
		var node := Factory.instantiate_scene(slot)
		if node == null:
			continue
		if slot == "polish":
			add_child(node)  # world-space effects
		else:
			ui_layer.add_child(node)
		if node.has_method("bind"):
			node.call("bind", self)


## Kick off. Call after the node is inside the tree.
func start() -> void:
	referee.start_match()
	EventBus.match_started.emit(self)


func _physics_process(delta: float) -> void:
	if config.auto_step and not paused and not is_finished:
		step(delta)


func _process(_delta: float) -> void:
	if headless:
		return
	ball.sync_view()
	for p: Player in players:
		p.sync_view()


## One fixed simulation tick. Public so headless sims can drive the match.
func step(delta: float) -> void:
	tick += 1
	var group := tick % FB.AI_STAGGER_GROUPS
	var think_dt := delta * FB.AI_STAGGER_GROUPS
	# 1. team-level thinking: home on group 0, away on group 3.
	if group == 0:
		teams[0].think(think_dt)
	elif group == FB.AI_STAGGER_GROUPS / 2:
		teams[1].think(think_dt)
	# 2-3. players
	for p: Player in players:
		if p.stagger_group == group:
			p.think(think_dt)
	for p: Player in players:
		p.step(delta)
	# 4-6. physics & rules
	collision_solver.solve(delta)
	ball.physics_step(delta)
	referee.step(delta)
	# 7. control state
	_update_control_context()
	# 8. input edges
	if human_input != null:
		if human_input.consume_press(FB.Action.PAUSE):
			set_paused(true)
		human_input.end_tick()


func all_players() -> Array[Player]:
	return players


func controlled_player() -> Player:
	return human_team.controlled_player if human_team != null else null


func set_paused(p: bool) -> void:
	if paused == p or is_finished:
		return
	paused = p
	if human_input != null:
		human_input.release_all()
		human_input.end_tick()
	EventBus.match_paused.emit(p)


func finish() -> void:
	if is_finished:
		return
	is_finished = true
	var result := get_result()
	finished.emit(result)
	EventBus.match_ended.emit(result)


func get_result() -> Dictionary:
	return {
		"home_id": teams[0].data.id, "away_id": teams[1].data.id,
		"home_name": teams[0].data.name, "away_name": teams[1].data.name,
		"home_score": teams[0].score, "away_score": teams[1].score,
		"human_side": config.human_side,
	}


func _on_ball_owner_changed(_old: Player, new_owner: Player) -> void:
	if new_owner == null:
		return
	var tid := new_owner.team.team_id
	if tid != possession_team:
		possession_team = tid
		EventBus.possession_changed.emit(tid, new_owner)
	# Human auto-switch to the ball carrier.
	if human_team != null and new_owner.team == human_team:
		human_team.set_controlled_player(new_owner)


func _update_control_context() -> void:
	if human_team == null:
		return
	var ctx := FB.Context.DEFENDING
	var cp := human_team.controlled_player
	var r := referee.restart
	if referee.phase == FB.MatchPhase.SET_PIECE and r.team_id == human_team.team_id and r.taker == cp:
		ctx = FB.Context.SET_PIECE
	elif cp != null and cp.is_goalkeeper():
		ctx = FB.Context.GOALKEEPER
	elif possession_team == human_team.team_id:
		ctx = FB.Context.HAS_BALL
	if ctx != control_context:
		control_context = ctx
		human_input.set_context(ctx)
		EventBus.control_context_changed.emit(ctx)


func _on_settings_changed(key: String) -> void:
	if key == "control_scheme" or key == "":
		human_input.set_scheme(GameSettings.control_scheme)


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_WM_GO_BACK_REQUEST:
			if human_input != null and not headless:
				set_paused(true)
