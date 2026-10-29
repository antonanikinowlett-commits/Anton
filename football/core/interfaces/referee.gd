class_name Referee
extends Node
## Laws of the game: clock, halves, stoppage time, score, kickoff, goals,
## out of play & restarts, offside, fouls, advantage, cards, set-piece flow.
## Implementation: res://rules/referee_impl.gd (extends Referee), owned by RULES.
## This base class is the STUB: clock, halves, kickoff and goals only;
## the ball is dropped at the nearest in-field point when it goes out.

var football_match: FootballMatch
var phase: int = FB.MatchPhase.PRE_MATCH
## 1 or 2.
var half := 1
## Game clock in game seconds since kickoff of the match (0..5400 + stoppage).
var clock := 0.0
## Stoppage time to add at the end of the current half (game seconds).
var stoppage := 0.0
## Game seconds per real second.
var time_scale := 1.0
var restart := RestartInfo.new()
## Team that kicked off the first half.
var first_kickoff_team := 0
## Real seconds left in the current pause (celebration, half-time, kickoff delay).
var phase_timer := 0.0


func setup(m: FootballMatch) -> void:
	football_match = m
	time_scale = FB.HALF_GAME_SECONDS / maxf(m.config.half_length_minutes * 60.0, 1.0)
	m.ball.touched.connect(on_ball_touched)


func start_match() -> void:
	half = 1
	clock = 0.0
	first_kickoff_team = football_match.rng.randi_range(0, 1)
	begin_kickoff(first_kickoff_team)


## Fixed-step update, called by FootballMatch once per tick after ball physics.
func step(delta: float) -> void:
	match phase:
		FB.MatchPhase.KICKOFF:
			phase_timer -= delta
			if phase_timer <= 0.0:
				set_phase(FB.MatchPhase.PLAYING)
				football_match.ball.frozen = false
				EventBus.kickoff.emit(restart.team_id)
		FB.MatchPhase.PLAYING:
			clock += delta * time_scale
			if _check_goal():
				return
			_check_out_of_play()
			var half_end := FB.HALF_GAME_SECONDS * half + stoppage
			if clock >= half_end:
				_end_half()
		FB.MatchPhase.GOAL_CELEBRATION:
			phase_timer -= delta
			if phase_timer <= 0.0:
				var conceding := 1 - restart.team_id
				begin_kickoff(conceding)
		FB.MatchPhase.HALF_TIME:
			phase_timer -= delta
			if phase_timer <= 0.0:
				half = 2
				clock = FB.HALF_GAME_SECONDS
				stoppage = 0.0
				begin_kickoff(1 - first_kickoff_team)


func set_phase(p: int) -> void:
	if p == phase:
		return
	phase = p
	EventBus.match_phase_changed.emit(p)


func begin_kickoff(team_id: int) -> void:
	restart.reset()
	restart.type = FB.Restart.KICKOFF
	restart.team_id = team_id
	restart.position = Vector2.ZERO
	football_match.ball.place(Vector2.ZERO)
	for t: Team in football_match.teams:
		for p: Player in t.players:
			p.teleport(t.shape.get_kickoff_position(p, t.team_id == team_id), Vector2(t.attack_dir, 0))
	restart.taker = football_match.teams[team_id].shape.get_kickoff_taker()
	phase_timer = 1.0
	set_phase(FB.MatchPhase.KICKOFF)
	EventBus.whistle.emit(FB.Whistle.SHORT)
	EventBus.set_piece_ready.emit(restart)


## Physics reports every challenge here (tackles, slides, shoulder charges).
## intensity 0..1, ball_first = tackler touched the ball before the opponent.
func report_contact(_tackler: Player, _victim: Player, _ball_first: bool, _intensity: float, _from_behind: bool) -> void:
	pass


## Connected to Ball.touched. Used for offside, restarts taken, last touch.
func on_ball_touched(_p: Player) -> void:
	pass


func is_ball_in_play() -> bool:
	return phase == FB.MatchPhase.PLAYING


## True while players should hold set-piece positions instead of playing.
func is_set_piece_pending() -> bool:
	return phase == FB.MatchPhase.SET_PIECE or phase == FB.MatchPhase.KICKOFF


func get_display_minute() -> int:
	return int(clock / 60.0) + 1


## "MM:SS" clock text, plus "+N" when in stoppage time.
func get_clock_text() -> String:
	var half_end := FB.HALF_GAME_SECONDS * half
	if clock > half_end:
		var extra := int((clock - half_end) / 60.0) + 1
		return "%02d:00 +%d" % [int(half_end / 60.0), extra]
	var secs := int(clock)
	return "%02d:%02d" % [secs / 60, secs % 60]


# --- Stub internals --------------------------------------------------------------
func _check_goal() -> bool:
	var ball := football_match.ball
	if absf(ball.pos.x) < FB.HALF_LENGTH + FB.BALL_RADIUS:
		return false
	if absf(ball.pos.y) > FB.GOAL_WIDTH * 0.5 or ball.height > FB.GOAL_HEIGHT:
		return false
	var scoring := 0 if signf(ball.pos.x) == float(football_match.teams[0].attack_dir) else 1
	var scorer := ball.last_touch_player
	var own_goal := scorer != null and scorer.team.team_id != scoring
	football_match.teams[scoring].score += 1
	restart.team_id = scoring
	ball.place(ball.pos)
	phase_timer = 2.5
	set_phase(FB.MatchPhase.GOAL_CELEBRATION)
	EventBus.whistle.emit(FB.Whistle.SHORT)
	EventBus.goal_scored.emit(scoring, scorer, null, own_goal)
	return true


func _check_out_of_play() -> void:
	var ball := football_match.ball
	if FB.is_on_pitch(ball.pos):
		return
	var reason := FB.OutReason.GOAL_LINE if absf(ball.pos.x) > FB.HALF_LENGTH else FB.OutReason.TOUCHLINE
	EventBus.out_of_play.emit(ball.pos, ball.last_touch_team, reason)
	# STUB: drop ball just inside the pitch.
	var drop := Vector2(clampf(ball.pos.x, -FB.HALF_LENGTH + 1.0, FB.HALF_LENGTH - 1.0),
		clampf(ball.pos.y, -FB.HALF_WIDTH + 1.0, FB.HALF_WIDTH - 1.0))
	ball.place(drop)
	ball.frozen = false


func _end_half() -> void:
	EventBus.whistle.emit(FB.Whistle.LONG)
	if half == 1:
		for t: Team in football_match.teams:
			t.attack_dir = -t.attack_dir
		phase_timer = 2.0
		set_phase(FB.MatchPhase.HALF_TIME)
		EventBus.half_time.emit()
	else:
		set_phase(FB.MatchPhase.FULL_TIME)
		EventBus.full_time.emit(football_match.teams[0].score, football_match.teams[1].score)
		football_match.finish()
