class_name FB
extends RefCounted
## Global football enums and constants. Owned by core (architect/orchestrator).
## Change only via docs/REQUESTS.md. All simulation units: meters, seconds, radians.

# --- Rendering -----------------------------------------------------------
## Pixels per meter. Node2D.position = pos_m * PPM.
const PPM := 32.0

# --- Pitch (FIFA standard) -----------------------------------------------
const PITCH_LENGTH := 105.0
const PITCH_WIDTH := 68.0
const HALF_LENGTH := 52.5
const HALF_WIDTH := 34.0
const GOAL_WIDTH := 7.32
const GOAL_HEIGHT := 2.44
const GOAL_DEPTH := 2.0
const PENALTY_AREA_DEPTH := 16.5
const PENALTY_AREA_WIDTH := 40.32
const GOAL_AREA_DEPTH := 5.5
const GOAL_AREA_WIDTH := 18.32
const PENALTY_SPOT_DIST := 11.0
const PENALTY_ARC_RADIUS := 9.15
const CENTER_CIRCLE_RADIUS := 9.15
const CORNER_ARC_RADIUS := 1.0
## Run-off area rendered around the pitch (meters).
const RUNOFF := 4.0

# --- Bodies ----------------------------------------------------------------
const BALL_RADIUS := 0.11
const BALL_MASS := 0.43
const PLAYER_RADIUS := 0.4
const GRAVITY := 9.81

# --- Simulation timing -------------------------------------------------
const TICK_RATE := 60
const TICK_DT := 1.0 / 60.0
## Players are split into this many groups; one group "thinks" per tick
## (=> each player thinks at TICK_RATE / AI_STAGGER_GROUPS = 10 Hz).
const AI_STAGGER_GROUPS := 6
## Real 45-minute half in game seconds.
const HALF_GAME_SECONDS := 2700.0
const MAX_SUBSTITUTIONS := 5

# --- Enums ---------------------------------------------------------------
enum Side { HOME = 0, AWAY = 1 }

## Abstract input actions produced by every InputController source.
enum Action {
	NONE,
	PASS,          # short ground pass
	LONG_PASS,     # through ball (tap) / lofted long pass (hold)
	SHOOT,         # hold to charge, release to fire
	SPRINT,        # hold
	SKILL,         # dribble/skill move
	TACKLE,        # standing tackle
	SLIDE,         # slide tackle
	SWITCH_PLAYER, # switch to player nearest ball / suggested
	PRESS,         # call a teammate to press
	GK_DIVE,
	GK_DISTRIBUTE, # throw / short distribution
	GK_KICK,       # long kick / punt
	GK_COME_OUT,
	SP_CONFIRM,    # set piece: confirm aim / power / curve step
	SP_CANCEL,     # set piece: step back
	PAUSE,
}

## Control context of the human's controlled player. Touch UI swaps layouts on it.
enum Context { NONE, HAS_BALL, DEFENDING, GOALKEEPER, SET_PIECE }

## Physical button slots (touch buttons / keys / pad buttons). Context maps slot -> Action.
enum Slot { PRIMARY, SECONDARY, TERTIARY, QUATERNARY, SPRINT }
const SLOT_COUNT := 5

enum ControlScheme { SIMPLE, PRO }
enum Difficulty { EASY, MEDIUM, HARD }

enum Role { GK, CB, LB, RB, LWB, RWB, CDM, CM, CAM, LM, RM, LW, RW, CF, ST }

enum PlayerState {
	NORMAL,
	TACKLING,      # standing tackle animation lock
	SLIDING,       # slide tackle lock
	FALLEN,        # on the ground after foul / slide
	DIVING,        # goalkeeper dive
	HOLDING_BALL,  # goalkeeper has ball in hands
	SET_PIECE,     # waiting as set-piece taker
	CELEBRATING,
	SENT_OFF,
}

## What a brain (AI or human) asks the motor to do this tick.
enum IntentAction {
	NONE, PASS, THROUGH_PASS, LOB_PASS, CROSS, SHOOT, CLEAR,
	TACKLE, SLIDE, SKILL, SHIELD,
	GK_DIVE, GK_THROW, GK_KICK, SET_PIECE_KICK,
}

enum MatchPhase { PRE_MATCH, KICKOFF, PLAYING, STOPPED, SET_PIECE, GOAL_CELEBRATION, HALF_TIME, FULL_TIME }

enum Restart { NONE, KICKOFF, THROW_IN, CORNER, GOAL_KICK, FREE_KICK_DIRECT, FREE_KICK_INDIRECT, PENALTY, DROP_BALL }

enum OutReason { TOUCHLINE, GOAL_LINE }
enum FoulSeverity { CARELESS, RECKLESS, EXCESSIVE }
enum Card { YELLOW, SECOND_YELLOW, RED }
enum Whistle { SHORT, LONG, DOUBLE, TRIPLE }


# --- Helpers ---------------------------------------------------------------
static func m2px(v: Vector2) -> Vector2:
	return v * PPM


static func px2m(v: Vector2) -> Vector2:
	return v / PPM


static func role_from_string(s: String) -> int:
	var key := s.to_upper()
	if Role.has(key):
		return Role[key]
	push_warning("Unknown role '%s', defaulting to CM" % s)
	return Role.CM


static func role_to_string(r: int) -> String:
	return Role.keys()[r]


static func is_on_pitch(p: Vector2) -> bool:
	return absf(p.x) <= HALF_LENGTH and absf(p.y) <= HALF_WIDTH
