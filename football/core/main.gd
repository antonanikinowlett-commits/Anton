extends Node
## Entry scene. Hands control to the Game autoload.


func _ready() -> void:
	Game.boot.call_deferred()
