class_name AiParams
extends RefCounted
## Difficulty tuning tables for the AI (indexed by FB.Difficulty: EASY, MEDIUM, HARD).

## Seconds between gaining the ball / seeing a stimulus and acting on it.
const REACT := [0.45, 0.24, 0.10]
## Std-dev-like noise added to option utilities (worse decisions when high).
const NOISE := [0.30, 0.13, 0.03]
## Max aim error (meters) added to pass targets before stat scaling.
const AIM_ERROR := [1.8, 0.8, 0.25]
## Multiplier on pressing trigger distance / intensity.
const PRESS := [0.75, 1.0, 1.2]
## Sprint is suspended below this stamina (stamina management).
const STAMINA_FLOOR := [0.04, 0.2, 0.3]
## Probability multiplier for tackle attempts.
const TACKLE := [0.7, 1.0, 1.15]
## Goalkeeper reaction time before committing to a dive.
const GK_REACT := [0.30, 0.16, 0.06]
## Goalkeeper dive aim error (meters).
const GK_AIM_ERROR := [1.2, 0.6, 0.15]
## Seconds a team needs before it re-evaluates marking (decision cadence multiplier).
const TEAM_HYSTERESIS := [1.3, 1.0, 0.85]


static func idx(difficulty: int) -> int:
	return clampi(difficulty, 0, 2)


static func react_time(difficulty: int) -> float:
	return REACT[idx(difficulty)]


static func noise(difficulty: int) -> float:
	return NOISE[idx(difficulty)]


static func aim_error(difficulty: int) -> float:
	return AIM_ERROR[idx(difficulty)]


static func press_factor(difficulty: int) -> float:
	return PRESS[idx(difficulty)]


static func stamina_floor(difficulty: int) -> float:
	return STAMINA_FLOOR[idx(difficulty)]


static func tackle_factor(difficulty: int) -> float:
	return TACKLE[idx(difficulty)]


static func gk_react(difficulty: int) -> float:
	return GK_REACT[idx(difficulty)]


static func gk_aim_error(difficulty: int) -> float:
	return GK_AIM_ERROR[idx(difficulty)]
