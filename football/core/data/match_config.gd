class_name MatchConfig
extends Resource
## Everything needed to start a match. Built by the UI (team select) or tests.

@export var home_team_id: String = ""
@export var away_team_id: String = ""
## Optional pre-built team data (overrides ids; used by tactics screen edits/tests).
@export var home_team: TeamData
@export var away_team: TeamData
## Side controlled by the human: 0 home, 1 away, -1 = AI vs AI.
@export var human_side: int = 0
@export var difficulty: int = FB.Difficulty.MEDIUM
## Real-time minutes per half (game clock always shows 45:00 per half).
@export var half_length_minutes: float = 4.0
## Headless = no views/camera/UI; for simulations and tests.
@export var headless: bool = false
## If false, the match does not step itself; caller calls step(FB.TICK_DT).
@export var auto_step: bool = true
@export var rng_seed: int = 0


static func create_default() -> MatchConfig:
	var c := MatchConfig.new()
	c.difficulty = GameSettings.difficulty
	c.half_length_minutes = GameSettings.half_length_minutes
	return c


static func create_headless_sim(seed_value: int = 1, minutes: float = 4.0) -> MatchConfig:
	var c := MatchConfig.new()
	c.human_side = -1
	c.headless = true
	c.auto_step = false
	c.half_length_minutes = minutes
	c.rng_seed = seed_value
	return c
