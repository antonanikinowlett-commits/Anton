class_name TestCase
extends RefCounted
## Minimal test base. Methods named test_* are run by tests/test_runner.gd.
## Tests are synchronous; drive matches with FootballMatch.step(FB.TICK_DT).

## Node the test may add children to (freed children are the test's responsibility).
var root: Node
var _failures: PackedStringArray = PackedStringArray()
var _current_test := ""


func before_each() -> void:
	pass


func after_each() -> void:
	pass


func fail(msg: String) -> void:
	_failures.append("%s: %s" % [_current_test, msg])


func assert_true(cond: bool, msg: String = "expected true") -> void:
	if not cond:
		fail(msg)


func assert_false(cond: bool, msg: String = "expected false") -> void:
	if cond:
		fail(msg)


func assert_eq(actual: Variant, expected: Variant, msg: String = "") -> void:
	if actual != expected:
		fail("%s expected <%s> got <%s>" % [msg, str(expected), str(actual)])


func assert_near(actual: float, expected: float, eps: float = 0.001, msg: String = "") -> void:
	if absf(actual - expected) > eps:
		fail("%s expected %f +/- %f got %f" % [msg, expected, eps, actual])


func assert_not_null(v: Variant, msg: String = "expected non-null") -> void:
	if v == null:
		fail(msg)


## Helper: builds a headless AI-vs-AI (or human_side) match added under root.
func make_headless_match(seed_value: int = 1, human_side: int = -1, minutes: float = 4.0) -> FootballMatch:
	var cfg := MatchConfig.create_headless_sim(seed_value, minutes)
	cfg.human_side = human_side
	var m := FootballMatch.new()
	m.setup(cfg)
	root.add_child(m)
	m.start()
	return m


## Helper: step a match n ticks.
func run_ticks(m: FootballMatch, n: int) -> void:
	for i in n:
		if m.is_finished:
			return
		m.step(FB.TICK_DT)
