extends Node
## App flow (autoload "Game"). Owned by core.
## Boot -> main menu (if UI present) -> match -> post-match -> main menu.

var current_match: FootballMatch
var last_result: Dictionary = {}
var pending_config: MatchConfig


## Called by the main scene. Without a UI main menu, starts a stub match directly.
func boot() -> void:
	if Factory.is_implemented("main_menu"):
		goto_main_menu()
	else:
		start_match(MatchConfig.create_default())


func goto_main_menu() -> void:
	var menu := Factory.instantiate_scene("main_menu")
	if menu == null:
		start_match(MatchConfig.create_default())
		return
	_switch_to(menu)


func start_match(cfg: MatchConfig) -> void:
	pending_config = cfg
	var m := FootballMatch.new()
	m.setup(cfg)
	m.finished.connect(_on_match_finished)
	_switch_to(m)
	current_match = m
	m.start()


func _on_match_finished(result: Dictionary) -> void:
	last_result = result
	# Give the final whistle a moment before leaving the pitch.
	await get_tree().create_timer(3.0).timeout
	var post := Factory.instantiate_scene("post_match")
	if post != null:
		if post.has_method("bind"):
			post.call("bind", result)
		_switch_to(post)
	else:
		goto_main_menu()


func restart_match() -> void:
	if pending_config != null:
		start_match(pending_config)


func quit_match() -> void:
	goto_main_menu()


func _switch_to(node: Node) -> void:
	var tree := get_tree()
	var old := tree.current_scene
	current_match = null
	tree.root.add_child(node)
	tree.current_scene = node
	if old != null and old != node:
		old.queue_free()
