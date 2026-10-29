extends InputController
## Touch InputController (PHYSICS module): radial dead zone (~0.12), response curve and light
## per-tick smoothing of the movement vector. Does not draw anything.
##
## Smoothing advances once per simulation tick (end_tick), so repeated get_move_vector() calls in the
## same tick are idempotent and headless fast-forward behaves like real time.

const DEAD_ZONE := 0.12
## Stick magnitude (after dead zone) that already counts as full deflection.
const SATURATION := 0.96
## Response curve exponent (>1 = finer control near the centre).
const CURVE := 1.25
## Per-tick blend towards the new target when already moving (light smoothing).
const SMOOTH := 0.6

var _tick_id := 0
var _cache_tick := -1
var _cache_raw := Vector2.ZERO
var _cache_out := Vector2.ZERO
var _prev_out := Vector2.ZERO


## Dead zone + response curve + light smoothing. Onset and stops are instantaneous.
func process_move_vector(raw: Vector2) -> Vector2:
	if _cache_tick == _tick_id and raw == _cache_raw:
		return _cache_out
	var shaped := shape(raw)
	var out := shaped
	if shaped != Vector2.ZERO and _prev_out != Vector2.ZERO:
		# Do not smooth through sharp direction changes: that would feel laggy.
		if absf(_prev_out.angle_to(shaped)) < 1.2:
			out = _prev_out.lerp(shaped, SMOOTH)
	_cache_tick = _tick_id
	_cache_raw = raw
	_cache_out = out
	return out


## Pure shaping function: dead zone with rescale, then power curve. Length stays in 0..1.
func shape(raw: Vector2) -> Vector2:
	var l := raw.length()
	if l <= DEAD_ZONE:
		return Vector2.ZERO
	var m := clampf((l - DEAD_ZONE) / (SATURATION - DEAD_ZONE), 0.0, 1.0)
	return raw / l * pow(m, CURVE)


func end_tick() -> void:
	super.end_tick()
	_prev_out = _cache_out if _cache_tick == _tick_id else Vector2.ZERO
	_tick_id += 1


func reset() -> void:
	super.reset()
	_tick_id = 0
	_cache_tick = -1
	_cache_raw = Vector2.ZERO
	_cache_out = Vector2.ZERO
	_prev_out = Vector2.ZERO
