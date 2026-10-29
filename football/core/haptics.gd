class_name Haptics
extends RefCounted
## Haptic feedback hooks. Respects GameSettings.haptics_enabled. No-op on desktop.

enum Kind { TAP, LIGHT, MEDIUM, HEAVY }

const DURATION_MS: Array[int] = [10, 20, 40, 80]


static func pulse(kind: int = Kind.TAP) -> void:
	if not GameSettings.haptics_enabled:
		return
	if not OS.has_feature("mobile"):
		return
	Input.vibrate_handheld(DURATION_MS[clampi(kind, 0, DURATION_MS.size() - 1)])
