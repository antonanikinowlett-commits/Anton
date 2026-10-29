class_name PlayerBrain
extends RefCounted
## Decision-maker that writes player.intent.
## Implementations:
##   res://ai/ai_brain.gd          (AI, extends PlayerBrain)          - AI owner
##   res://physics/human_brain.gd  (human input -> intent, aim assist) - PHYSICS owner
## Stubs: res://core/stubs/stub_ai_brain.gd, res://core/stubs/stub_human_brain.gd

var player: Player


func setup(p: Player) -> void:
	player = p


## Called when this brain takes control of the player (human switch in/out).
func on_activated() -> void:
	pass


## Heavy decisions, staggered (~10 Hz per player). dt = time since previous think.
func think(_dt: float) -> void:
	pass


## Every tick; cheap. Write player.intent here.
func act(_delta: float) -> void:
	pass
