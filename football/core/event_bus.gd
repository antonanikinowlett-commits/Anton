extends Node
## Global event bus (autoload "EventBus"). Owned by core.
## Emitters are listed per signal. Listeners must never assume an emission order
## between different signals within the same tick.
## Team ids: 0 = home, 1 = away, -1 = none/loose.

# --- Match flow (emitted by Referee) --------------------------------------
signal kickoff(team_id: int)
signal goal_scored(team_id: int, scorer: Player, assist: Player, own_goal: bool)
signal foul(offender: Player, victim: Player, pos: Vector2, severity: int, advantage: bool)
signal card(player: Player, card_type: int)
signal offside(player: Player, pos: Vector2)
signal out_of_play(pos: Vector2, last_touch_team: int, reason: int)
signal throw_in(team_id: int, pos: Vector2)
signal corner(team_id: int, pos: Vector2)
signal goal_kick(team_id: int, pos: Vector2)
signal free_kick(team_id: int, pos: Vector2, direct: bool)
signal penalty(team_id: int, pos: Vector2)
signal half_time()
signal full_time(home_score: int, away_score: int)
signal whistle(kind: int)                       # FB.Whistle
signal match_phase_changed(phase: int)          # FB.MatchPhase
## Restart is ready to be taken (ball placed, taker assigned).
signal set_piece_ready(restart: RestartInfo)

# --- Possession / control (emitted by FootballMatch) ------------------------
signal possession_changed(team_id: int, player: Player)
signal control_context_changed(context: int)    # FB.Context, human side only
signal controlled_player_changed(team_id: int, player: Player)
signal match_paused(paused: bool)
signal match_started(match_node: FootballMatch)
signal match_ended(result: Dictionary)

# --- Squad (emitted by Team) ----------------------------------------------
## The Player node is reused: its data switches from out_data to in_data.
signal substitution(team_id: int, player: Player, out_data: PlayerData, in_data: PlayerData)

# --- Ball / physics hooks (emitted by Ball / PlayerMotor; for polish & stats) --
signal ball_kicked(player: Player, kind: int, power: float)   # kind = FB.IntentAction
signal ball_touched(player: Player)
signal tackle_attempted(tackler: Player, target: Player, slide: bool, success: bool)
signal save_made(goalkeeper: Player)
signal shot_taken(player: Player, on_target: bool)

# --- AI hooks --------------------------------------------------------------
## AI suggests which player the human should switch to (UI may highlight it).
signal auto_switch_suggested(player: Player)
## Pass-target highlight for the human (aim assist preview), null to clear.
signal pass_target_highlighted(player: Player)
