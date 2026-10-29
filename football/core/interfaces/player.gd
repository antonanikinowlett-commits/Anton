class_name Player
extends Node2D
## A footballer on the pitch. Owned by core; behaviour is delegated to:
##   motor      (PlayerMotor, PHYSICS)  executes intent: movement, kicks, tackles, stamina
##   ai_brain   (PlayerBrain, AI)       decides intent when not human-controlled
##   human_brain(PlayerBrain, PHYSICS)  turns InputController actions into intent
## Do not subclass Player in modules; extend the components instead.

var data: PlayerData
var team: Team
var football_match: FootballMatch
## Index in the formation (0 = GK slot).
var slot_index := 0
## Role currently played (FB.Role) - from formation slot, not data.role.
var role: int = FB.Role.CM

# --- Kinematics (meters, m/s) ---------------------------------------------
var pos := Vector2.ZERO
var vel := Vector2.ZERO
## Unit vector the body faces.
var facing := Vector2.RIGHT

# --- Condition / state -------------------------------------------------------
## 0..1. Motor drains/recovers it.
var stamina := 1.0
var state: int = FB.PlayerState.NORMAL
## Seconds left in a locking state (tackle, fallen, dive...). Motor owns it.
var state_timer := 0.0
## Seconds during which this player cannot touch the ball again (after a kick).
var touch_cooldown := 0.0
var yellow_cards := 0
var sent_off := false

# --- Positioning -------------------------------------------------------------
## Target position computed by TeamShape (meters). AI uses it as anchor.
var home_position := Vector2.ZERO

# --- Control -----------------------------------------------------------------
var is_human := false
var intent := PlayerIntent.new()
var motor: PlayerMotor
var ai_brain: PlayerBrain
var human_brain: PlayerBrain
var brain: PlayerBrain
## Which AI think group (0..FB.AI_STAGGER_GROUPS-1) this player belongs to.
var stagger_group := 0

# --- View --------------------------------------------------------------------
var color_body := Color.RED
var color_trim := Color.WHITE
var _drawn_angle := 999.0
var _drawn_human := false


func setup(p_data: PlayerData, p_team: Team, p_match: FootballMatch, p_slot: int, p_role: int) -> void:
	data = p_data
	team = p_team
	football_match = p_match
	slot_index = p_slot
	role = p_role
	name = "%s_%d" % [team.data.short_name, data.number]
	stagger_group = (team.team_id * 11 + p_slot) % FB.AI_STAGGER_GROUPS
	color_body = team.data.color_goalkeeper if is_goalkeeper() else team.data.color_primary
	color_trim = team.data.color_secondary
	motor = Factory.create("player_motor") as PlayerMotor
	motor.setup(self)
	ai_brain = Factory.create("ai_brain") as PlayerBrain
	ai_brain.setup(self)
	brain = ai_brain


func set_human_controlled(on: bool) -> void:
	if on == is_human:
		return
	is_human = on
	if on and human_brain == null:
		human_brain = Factory.create("human_brain") as PlayerBrain
		human_brain.setup(self)
	brain = human_brain if on else ai_brain
	intent.reset()
	brain.on_activated()
	queue_redraw()


## Low-frequency decision (staggered ~10 Hz). dt = time since last think.
func think(dt: float) -> void:
	if sent_off:
		return
	brain.think(dt)


## Every tick: brain writes intent, motor executes it.
func step(delta: float) -> void:
	if sent_off:
		return
	if touch_cooldown > 0.0:
		touch_cooldown -= delta
	brain.act(delta)
	motor.step(delta)


func has_ball() -> bool:
	return football_match.ball.owner_player == self


func is_goalkeeper() -> bool:
	return role == FB.Role.GK


func can_play() -> bool:
	return not sent_off and state != FB.PlayerState.FALLEN


func distance_to_ball() -> float:
	return pos.distance_to(football_match.ball.pos)


func attack_dir() -> int:
	return team.attack_dir


## Stat as 0..1 scaled by current stamina where it makes sense (physical stats).
func stat(stat_name: String) -> float:
	return data.stat01(stat_name)


func teleport(p: Vector2, face: Vector2 = Vector2.ZERO) -> void:
	pos = p
	vel = Vector2.ZERO
	if face != Vector2.ZERO:
		facing = face.normalized()
	intent.reset()


# --- View (stub; POLISH may replace via a child view) ------------------------
func sync_view() -> void:
	position = pos * FB.PPM
	var a := facing.angle()
	if absf(a - _drawn_angle) > 0.15 or _drawn_human != is_human:
		_drawn_angle = a
		_drawn_human = is_human
		queue_redraw()


func _draw() -> void:
	var r := 0.55 * FB.PPM
	draw_circle(Vector2(2, 3), r, Color(0, 0, 0, 0.3))
	if is_human:
		draw_arc(Vector2.ZERO, r + 6.0, 0.0, TAU, 24, Color(1.0, 0.95, 0.2), 3.0)
	draw_circle(Vector2.ZERO, r, color_body)
	draw_arc(Vector2.ZERO, r, 0.0, TAU, 20, color_trim, 2.0)
	draw_circle(facing * r * 0.75, r * 0.28, color_trim)
	var font := ThemeDB.fallback_font
	var txt := str(data.number) if data else ""
	draw_string(font, Vector2(-r, 5), txt, HORIZONTAL_ALIGNMENT_CENTER, r * 2.0, 14, Color.BLACK)
