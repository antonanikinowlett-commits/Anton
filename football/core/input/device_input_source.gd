class_name DeviceInputSource
extends Node
## Keyboard + gamepad source feeding an InputController (desktop fallback).
## Keys map to button SLOTS; the current context picks the action (same as touch).
##   Move: WASD / arrows / left stick
##   Slot PRIMARY   J / Space / pad A     (Pass | Tackle | Throw | OK)
##   Slot SECONDARY K / pad Y             (Through | Slide | GK kick | Back)
##   Slot TERTIARY  L / pad B             (Shoot | Switch | Dive)
##   Slot QUATERNARY I / pad X            (Skill | Press | Rush out)
##   Slot SPRINT    Shift / pad RB
##   Switch player shortcut: Q / pad LB   Pause: Esc / P / pad Start

const SLOT_ACTIONS: Array[StringName] = [&"fb_slot_0", &"fb_slot_1", &"fb_slot_2", &"fb_slot_3", &"fb_slot_4"]

var controller: InputController


func _ready() -> void:
	InputBindings.ensure_defaults()
	process_mode = Node.PROCESS_MODE_ALWAYS


func _process(_delta: float) -> void:
	if controller == null:
		return
	var v := Input.get_vector(&"fb_move_left", &"fb_move_right", &"fb_move_up", &"fb_move_down", 0.2)
	controller.set_move_vector(InputController.Source.DEVICE, v)
	if controller.context == FB.Context.SET_PIECE and v != Vector2.ZERO:
		controller.set_aim_vector(v)


func _input(event: InputEvent) -> void:
	if controller == null or event.is_echo():
		return
	for i in SLOT_ACTIONS.size():
		if event.is_action_pressed(SLOT_ACTIONS[i]):
			controller.press_slot(InputController.Source.DEVICE, i)
		elif event.is_action_released(SLOT_ACTIONS[i]):
			controller.release_slot(InputController.Source.DEVICE, i)
	if event.is_action_pressed(&"fb_switch"):
		controller.press_action(FB.Action.SWITCH_PLAYER)
	elif event.is_action_released(&"fb_switch"):
		controller.release_action(FB.Action.SWITCH_PLAYER)
	if event.is_action_pressed(&"fb_pause"):
		controller.press_action(FB.Action.PAUSE)
	elif event.is_action_released(&"fb_pause"):
		controller.release_action(FB.Action.PAUSE)
