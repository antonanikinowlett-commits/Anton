class_name PlayerIntent
extends RefCounted
## What a brain (AI or human) wants its player to do this tick.
## Written by PlayerBrain.act(), executed and partially cleared by PlayerMotor.step().
## One instance per player, reused every tick (no per-frame allocations).

## Desired movement direction, length 0..1 (1 = full speed for current sprint state).
var move := Vector2.ZERO
## Desired facing; ZERO = face movement direction.
var look := Vector2.ZERO
var sprint := false
## One-shot action (FB.IntentAction). Motor resets to NONE after handling it.
var action: int = FB.IntentAction.NONE
var target_point := Vector2.ZERO
var target_player: Player = null
## 0..1 (e.g. shot charge or pass weight).
var power := 0.0
## -1..1 sidespin request (curl). Positive = curls to the kicker's left.
var curve := 0.0
## 0..1 lift (0 = ground, 1 = high lob).
var loft := 0.0


func set_action(p_action: int, p_target: Vector2, p_power: float = 0.5, p_target_player: Player = null) -> void:
	action = p_action
	target_point = p_target
	power = p_power
	target_player = p_target_player


func clear_action() -> void:
	action = FB.IntentAction.NONE
	target_player = null
	power = 0.0
	curve = 0.0
	loft = 0.0


func reset() -> void:
	move = Vector2.ZERO
	look = Vector2.ZERO
	sprint = false
	clear_action()
