class_name ControlLayouts
extends RefCounted
## Context-sensitive mapping of physical button slots to abstract actions.
## Shared by the touch UI (labels/visibility), keyboard and gamepad sources.
## Row index = FB.Slot. FB.Action.NONE = slot hidden in this context.

const PRO_HAS_BALL = [FB.Action.PASS, FB.Action.LONG_PASS, FB.Action.SHOOT, FB.Action.SKILL, FB.Action.SPRINT]
const PRO_DEFENDING = [FB.Action.TACKLE, FB.Action.SLIDE, FB.Action.SWITCH_PLAYER, FB.Action.PRESS, FB.Action.SPRINT]
const PRO_GOALKEEPER = [FB.Action.GK_DISTRIBUTE, FB.Action.GK_KICK, FB.Action.GK_DIVE, FB.Action.GK_COME_OUT, FB.Action.SPRINT]
const PRO_SET_PIECE = [FB.Action.SP_CONFIRM, FB.Action.SP_CANCEL, FB.Action.NONE, FB.Action.NONE, FB.Action.NONE]

const SIMPLE_HAS_BALL = [FB.Action.PASS, FB.Action.NONE, FB.Action.SHOOT, FB.Action.NONE, FB.Action.SPRINT]
const SIMPLE_DEFENDING = [FB.Action.TACKLE, FB.Action.NONE, FB.Action.SWITCH_PLAYER, FB.Action.NONE, FB.Action.SPRINT]
const SIMPLE_GOALKEEPER = [FB.Action.GK_DISTRIBUTE, FB.Action.NONE, FB.Action.GK_DIVE, FB.Action.NONE, FB.Action.SPRINT]
const SIMPLE_SET_PIECE = [FB.Action.SP_CONFIRM, FB.Action.SP_CANCEL, FB.Action.NONE, FB.Action.NONE, FB.Action.NONE]

const EMPTY = [FB.Action.NONE, FB.Action.NONE, FB.Action.NONE, FB.Action.NONE, FB.Action.NONE]

## Actions whose button should be "hold" style (UI shows charge ring).
const HOLD_ACTIONS = [FB.Action.SHOOT, FB.Action.SPRINT, FB.Action.LONG_PASS, FB.Action.GK_KICK]

const LABELS = {
	FB.Action.NONE: "",
	FB.Action.PASS: "PASS",
	FB.Action.LONG_PASS: "THROUGH",
	FB.Action.SHOOT: "SHOOT",
	FB.Action.SPRINT: "SPRINT",
	FB.Action.SKILL: "SKILL",
	FB.Action.TACKLE: "TACKLE",
	FB.Action.SLIDE: "SLIDE",
	FB.Action.SWITCH_PLAYER: "SWITCH",
	FB.Action.PRESS: "PRESS",
	FB.Action.GK_DIVE: "DIVE",
	FB.Action.GK_DISTRIBUTE: "THROW",
	FB.Action.GK_KICK: "KICK",
	FB.Action.GK_COME_OUT: "RUSH",
	FB.Action.SP_CONFIRM: "OK",
	FB.Action.SP_CANCEL: "BACK",
	FB.Action.PAUSE: "II",
}


static func get_row(context: int, scheme: int) -> Array:
	var pro := scheme == FB.ControlScheme.PRO
	match context:
		FB.Context.HAS_BALL:
			return PRO_HAS_BALL if pro else SIMPLE_HAS_BALL
		FB.Context.DEFENDING:
			return PRO_DEFENDING if pro else SIMPLE_DEFENDING
		FB.Context.GOALKEEPER:
			return PRO_GOALKEEPER if pro else SIMPLE_GOALKEEPER
		FB.Context.SET_PIECE:
			return PRO_SET_PIECE if pro else SIMPLE_SET_PIECE
	return EMPTY


static func action_for(context: int, scheme: int, slot: int) -> int:
	if slot < 0 or slot >= FB.SLOT_COUNT:
		return FB.Action.NONE
	return get_row(context, scheme)[slot]


static func label_for(action: int) -> String:
	return LABELS.get(action, "")


static func is_hold_action(action: int) -> bool:
	return action in HOLD_ACTIONS
