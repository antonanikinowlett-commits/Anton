extends Node
## Headless test runner. Discovers res://tests/**/test_*.gd (TestCase subclasses).
## Usage:
##   godot --headless --path . res://tests/test_runner.tscn
##   godot --headless --path . res://tests/test_runner.tscn -- --filter=physics
## Exit code 0 = all passed, 1 = failures.

const TESTS_DIR := "res://tests"


func _ready() -> void:
	var filter := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--filter="):
			filter = arg.substr(9)
	var files := PackedStringArray()
	_collect(TESTS_DIR, files)
	files.sort()
	var passed := 0
	var failed := 0
	var all_failures := PackedStringArray()
	for path in files:
		if filter != "" and not path.contains(filter):
			continue
		var script: Script = load(path)
		if script == null or not script.can_instantiate():
			all_failures.append("%s: failed to load" % path)
			failed += 1
			continue
		for method in script.get_script_method_list():
			var mname: String = method["name"]
			if not mname.begins_with("test_"):
				continue
			var tc: TestCase = script.new()
			tc.root = self
			tc._current_test = "%s::%s" % [path.get_file(), mname]
			tc.before_each()
			tc.call(mname)
			tc.after_each()
			for c in get_children():
				c.free()
			if tc._failures.is_empty():
				passed += 1
				print("  PASS ", tc._current_test)
			else:
				failed += 1
				print("  FAIL ", tc._current_test)
				all_failures.append_array(tc._failures)
	print("\n%d passed, %d failed" % [passed, failed])
	for f in all_failures:
		printerr("  - ", f)
	get_tree().quit(1 if failed > 0 else 0)


func _collect(dir_path: String, out: PackedStringArray) -> void:
	var dir := DirAccess.open(dir_path)
	if dir == null:
		return
	for sub in dir.get_directories():
		if sub == "framework":
			continue
		_collect(dir_path.path_join(sub), out)
	for f in dir.get_files():
		if f.begins_with("test_") and f.ends_with(".gd"):
			out.append(dir_path.path_join(f))
