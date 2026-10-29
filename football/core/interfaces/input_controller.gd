class_name InputController
extends Node
## Input abstraction. Gameplay code reads ONLY this API, never raw input.
##
## Sources (touch UI, keyboard/gamepad DeviceInputSource, tests) FEED it via:
##   set_move_vector(source, v), set_aim_vector(v), set_curve_input(c),
##   press_slot(source, slot)/release_slot(source, slot), press_action(a)/release_action(a)
## Consumers (HumanBrain, set-piece flow) READ it via:
##   get_move_vector(), get_aim_vector(), get_curve_input(), is_held(a), get_hold_time(a),
##   get_charge(a), consume_press(a), consume_release(a)
##
## Presses are buffered between ticks so taps shorter than one frame are never
## dropped; FootballMatch calls end_tick() after the human brain acted, which
## discards unconsumed edges. Multiple sources/fingers may hold the same action.
##
## Touch implementation: res://physics/touch_input_controller.gd (extends InputController),
## owned by PHYSICS (dead zones, response curves, aim assist hooks). This base class is
## fully functional and used as fallback.

signal action_pressed(action: int)
signal action_released(action: int, held_time: float)
signal context_changed(context: int)

enum Source { DEVICE = 0, TOUCH = 1, TEST = 2, AUX = 3 }
const SOURCE_COUNT := 4

var context: int = FB.Context.NONE
var scheme: int = FB.ControlScheme.PRO

var _move := PackedVector2Array()
var _aim := Vector2.ZERO
var _curve := 0.0
var _held_count := PackedInt32Array()
var _press_ms := PackedInt64Array()
var _press_edges := PackedInt32Array()
var _release_edges := PackedInt32Array()
var _last_hold := PackedFloat32Array()
## Action bound to each (source, slot) while that slot is held, so a context
## change mid-press still releases the right action.
var _slot_bound := PackedInt32Array()


func _init() -> void:
	var n := FB.Action.size()
	_move.resize(SOURCE_COUNT)
	_held_count.resize(n)
	_press_ms.resize(n)
	_press_edges.resize(n)
	_release_edges.resize(n)
	_last_hold.resize(n)
	_slot_bound.resize(SOURCE_COUNT * FB.SLOT_COUNT)
	reset()


func reset() -> void:
	_move.fill(Vector2.ZERO)
	_held_count.fill(0)
	_press_ms.fill(0)
	_press_edges.fill(0)
	_release_edges.fill(0)
	_last_hold.fill(0.0)
	_slot_bound.fill(FB.Action.NONE)
	_aim = Vector2.ZERO
	_curve = 0.0


# --- Context -----------------------------------------------------------------
func set_context(ctx: int) -> void:
	if ctx == context:
		return
	context = ctx
	context_changed.emit(ctx)


func set_scheme(s: int) -> void:
	scheme = s


# --- Feeding (sources) ---------------------------------------------------------
func set_move_vector(source: int, v: Vector2) -> void:
	_move[source] = v.limit_length(1.0)


func set_aim_vector(v: Vector2) -> void:
	_aim = v.limit_length(1.0)


func set_curve_input(c: float) -> void:
	_curve = clampf(c, -1.0, 1.0)


func press_slot(source: int, slot: int) -> void:
	var idx := source * FB.SLOT_COUNT + slot
	if _slot_bound[idx] != FB.Action.NONE:
		return  # already held by this source
	var a := ControlLayouts.action_for(context, scheme, slot)
	if a == FB.Action.NONE:
		return
	_slot_bound[idx] = a
	press_action(a)


func release_slot(source: int, slot: int) -> void:
	var idx := source * FB.SLOT_COUNT + slot
	var a := _slot_bound[idx]
	if a == FB.Action.NONE:
		return
	_slot_bound[idx] = FB.Action.NONE
	release_action(a)


func press_action(a: int) -> void:
	if _held_count[a] == 0:
		_press_ms[a] = Time.get_ticks_msec()
	_held_count[a] += 1
	_press_edges[a] += 1
	action_pressed.emit(a)


func release_action(a: int) -> void:
	if _held_count[a] <= 0:
		return
	_held_count[a] -= 1
	if _held_count[a] == 0:
		var held := (Time.get_ticks_msec() - _press_ms[a]) / 1000.0
		_last_hold[a] = held
		_release_edges[a] += 1
		action_released.emit(a, held)


## Release everything (app lost focus, pause, context reset).
func release_all() -> void:
	for idx in _slot_bound.size():
		if _slot_bound[idx] != FB.Action.NONE:
			release_slot(idx / FB.SLOT_COUNT, idx % FB.SLOT_COUNT)
	for a in _held_count.size():
		while _held_count[a] > 0:
			release_action(a)
	_move.fill(Vector2.ZERO)


# --- Reading (gameplay) -------------------------------------------------------
## Processed movement vector (length 0..1). Strongest source wins.
func get_move_vector() -> Vector2:
	var best := Vector2.ZERO
	var best_l := 0.0
	for i in SOURCE_COUNT:
		var v: Vector2 = _move[i]
		var l := v.length_squared()
		if l > best_l:
			best_l = l
			best = v
	return process_move_vector(best)


## Override hook for dead zone / response curve (touch implementation).
func process_move_vector(raw: Vector2) -> Vector2:
	return raw


## Set-piece aim: direction + magnitude (0..1). Falls back to move vector.
func get_aim_vector() -> Vector2:
	if _aim != Vector2.ZERO:
		return _aim
	return get_move_vector()


func get_curve_input() -> float:
	return _curve


func is_held(a: int) -> bool:
	return _held_count[a] > 0


## Seconds the action has been held (0 if not held).
func get_hold_time(a: int) -> float:
	if _held_count[a] <= 0:
		return 0.0
	return (Time.get_ticks_msec() - _press_ms[a]) / 1000.0


## 0..1 charge progress for hold actions (e.g. shot power), full after full_time seconds.
func get_charge(a: int, full_time: float = 1.0) -> float:
	return clampf(get_hold_time(a) / full_time, 0.0, 1.0)


## True once per press edge since the last end_tick().
func consume_press(a: int) -> bool:
	if _press_edges[a] > 0:
		_press_edges[a] -= 1
		return true
	return false


## Returns hold duration of a release edge, or -1.0 if none pending.
func consume_release(a: int) -> float:
	if _release_edges[a] > 0:
		_release_edges[a] -= 1
		return _last_hold[a]
	return -1.0


## Peek without consuming.
func has_press(a: int) -> bool:
	return _press_edges[a] > 0


## Called by FootballMatch once per tick after human brains have acted.
func end_tick() -> void:
	_press_edges.fill(0)
	_release_edges.fill(0)
