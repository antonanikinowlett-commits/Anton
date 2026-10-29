class_name RulesRecorder
extends RefCounted
## Records EventBus emissions of the referee for assertions.

var counts := {}
var goals: Array = []        # [team_id, own_goal]
var cards: Array = []        # [player, card_type]
var fouls: Array = []        # [severity, advantage]
var restarts: Array = []     # restart types seen via set_piece_ready
var attached := false


func attach() -> void:
	if attached:
		return
	attached = true
	EventBus.kickoff.connect(_k)
	EventBus.goal_scored.connect(_goal)
	EventBus.foul.connect(_foul)
	EventBus.card.connect(_card)
	EventBus.offside.connect(_off)
	EventBus.out_of_play.connect(_out)
	EventBus.throw_in.connect(_ti)
	EventBus.corner.connect(_co)
	EventBus.goal_kick.connect(_gk)
	EventBus.free_kick.connect(_fk)
	EventBus.penalty.connect(_pen)
	EventBus.half_time.connect(_ht)
	EventBus.full_time.connect(_ft)
	EventBus.set_piece_ready.connect(_spr)


func detach() -> void:
	if not attached:
		return
	attached = false
	EventBus.kickoff.disconnect(_k)
	EventBus.goal_scored.disconnect(_goal)
	EventBus.foul.disconnect(_foul)
	EventBus.card.disconnect(_card)
	EventBus.offside.disconnect(_off)
	EventBus.out_of_play.disconnect(_out)
	EventBus.throw_in.disconnect(_ti)
	EventBus.corner.disconnect(_co)
	EventBus.goal_kick.disconnect(_gk)
	EventBus.free_kick.disconnect(_fk)
	EventBus.penalty.disconnect(_pen)
	EventBus.half_time.disconnect(_ht)
	EventBus.full_time.disconnect(_ft)
	EventBus.set_piece_ready.disconnect(_spr)


func n(key: String) -> int:
	return int(counts.get(key, 0))


func _inc(key: String) -> void:
	counts[key] = int(counts.get(key, 0)) + 1


func _k(_t: int) -> void:
	_inc("kickoff")


func _goal(t: int, _s: Player, _a: Player, own: bool) -> void:
	_inc("goal")
	goals.append([t, own])


func _foul(_o: Player, _v: Player, _p: Vector2, sev: int, adv: bool) -> void:
	_inc("foul")
	fouls.append([sev, adv])


func _card(p: Player, c: int) -> void:
	_inc("card")
	cards.append([p, c])


func _off(_p: Player, _pos: Vector2) -> void:
	_inc("offside")


func _out(_pos: Vector2, _t: int, _r: int) -> void:
	_inc("out")


func _ti(_t: int, _p: Vector2) -> void:
	_inc("throw_in")


func _co(_t: int, _p: Vector2) -> void:
	_inc("corner")


func _gk(_t: int, _p: Vector2) -> void:
	_inc("goal_kick")


func _fk(_t: int, _p: Vector2, _d: bool) -> void:
	_inc("free_kick")


func _pen(_t: int, _p: Vector2) -> void:
	_inc("penalty")


func _ht() -> void:
	_inc("half_time")


func _ft(_h: int, _a: int) -> void:
	_inc("full_time")


func _spr(r: RestartInfo) -> void:
	_inc("set_piece_ready")
	restarts.append(r.type)
