class_name Factory
extends RefCounted
## Plug-in registry. Each slot has a fixed implementation path owned by a module
## agent and a core fallback stub. Modules never register themselves: creating the
## file at the listed path is enough. Changing this table = docs/REQUESTS.md.

const SCRIPT_SLOTS := {
	"ball": ["res://physics/ball_physics.gd", "res://core/interfaces/ball.gd"],
	"player_motor": ["res://physics/player_motor_impl.gd", "res://core/interfaces/player_motor.gd"],
	"human_brain": ["res://physics/human_brain.gd", "res://core/stubs/stub_human_brain.gd"],
	"collision_solver": ["res://physics/collision_solver_impl.gd", "res://core/interfaces/collision_solver.gd"],
	"input_controller": ["res://physics/touch_input_controller.gd", "res://core/interfaces/input_controller.gd"],
	"referee": ["res://rules/referee_impl.gd", "res://core/interfaces/referee.gd"],
	"ai_brain": ["res://ai/ai_brain.gd", "res://core/stubs/stub_ai_brain.gd"],
	"team_brain": ["res://ai/team_ai.gd", "res://core/interfaces/team_brain.gd"],
	"team_shape": ["res://tactics/team_shape_impl.gd", "res://core/interfaces/team_shape.gd"],
	"camera": ["res://polish/match_camera_impl.gd", "res://core/views/match_camera.gd"],
}

## Scenes added to the match / app when present. Root script contract in docs/SPEC.md §8.
const SCENE_SLOTS := {
	"main_menu": "res://ui/menus/main_menu.tscn",
	"post_match": "res://ui/menus/post_match.tscn",
	"hud": "res://ui/hud/hud.tscn",
	"touch_controls": "res://ui/touch/touch_controls.tscn",
	"pause_menu": "res://ui/menus/pause_menu.tscn",
	"half_time": "res://ui/menus/half_time.tscn",
	"set_piece_ui": "res://rules/set_piece_ui.tscn",
	"polish": "res://polish/polish_root.tscn",
}

## Fallback scripts for scene slots that must always exist.
const SCENE_FALLBACKS := {
	"hud": "res://core/views/debug_hud.gd",
}


static func create(slot: String) -> Object:
	if not SCRIPT_SLOTS.has(slot):
		push_error("Factory: unknown slot '%s'" % slot)
		return null
	var paths: Array = SCRIPT_SLOTS[slot]
	for path in paths:
		if ResourceLoader.exists(path):
			var script: Script = load(path)
			if script != null and script.can_instantiate():
				return script.new()
			push_error("Factory: '%s' failed to load (parse error?)" % path)
	push_error("Factory: no usable script for slot '%s'" % slot)
	return null


## True if the module implementation (not the stub) is present.
static func is_implemented(slot: String) -> bool:
	if SCRIPT_SLOTS.has(slot):
		return ResourceLoader.exists(SCRIPT_SLOTS[slot][0])
	if SCENE_SLOTS.has(slot):
		return ResourceLoader.exists(SCENE_SLOTS[slot])
	return false


## Instantiates the slot scene, or its fallback script, or returns null.
static func instantiate_scene(slot: String) -> Node:
	var path: String = SCENE_SLOTS.get(slot, "")
	if path != "" and ResourceLoader.exists(path):
		var packed: PackedScene = load(path)
		if packed != null:
			return packed.instantiate()
	var fb_path: String = SCENE_FALLBACKS.get(slot, "")
	if fb_path != "" and ResourceLoader.exists(fb_path):
		var script: Script = load(fb_path)
		return script.new() as Node
	return null
