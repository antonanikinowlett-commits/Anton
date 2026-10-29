# Touchline Football — Technical Specification (v1.0, Phase 1)

Realistic 2D top-down 11v11 football for phones (Android first, iOS compatible),
1 human vs AI, Godot **4.3+**, GDScript only. Gameplay realism first, visuals second.
This document is the contract between all agents. **Read it fully before writing code.**

The Godot project root is `football/` (`res://`). Paths below are `res://` paths.

---

## 1. Principles

1. **Simple and working beats fancy and broken.** The project must open and run with zero errors after every merge.
2. **Gameplay never reads raw input.** Only the `InputController` API (§6).
3. **Simulation in SI units** (meters, seconds, radians) on a fixed 60 Hz tick. Rendering converts with `FB.PPM`.
4. **Mobile budget:** stable 60 FPS on a mid-range phone with 22 players. No per-tick allocations in hot paths (§4.3).
5. **Edit only your own folder.** Interface changes go to `docs/REQUESTS.md`; the orchestrator applies them.

## 2. Project layout & ownership

| Path | Owner | Contents |
|---|---|---|
| `core/` | Orchestrator | Interfaces (base classes + stubs), autoloads, factory, data classes, input layer, match loop, fallback views |
| `physics/` | PHYSICS | Ball physics, player motor, collisions, human brain (input → intent, aim assist), touch InputController |
| `rules/` | RULES | Referee implementation, set-piece flow + set-piece touch UI scene |
| `ai/` | AI | Player AI brain, team AI (pressing, marking, line), GK AI, difficulty, auto-switch suggestion |
| `tactics/` | TACTICS | Team shape, formations, roles, set-piece routines, substitution policy, `tactics/data/**` JSON |
| `ui/` | UI | Menus, HUD, touch controls scene, pause, half-time, post-match, settings, layout editor |
| `polish/` | POLISH_QA | Camera impl, animation/particles, audio hooks, haptics hooks, replays |
| `tests/<module>/` | each agent | `test_*.gd` for its module. `tests/framework/` and `tests/core/` are core-owned |
| `docs/` | Orchestrator | `SPEC.md` (this), `REQUESTS.md` (anyone may append), `BUGS.md` (QA appends) |

Module folders may contain any internal files/sub-folders. Only the **slot files** in §8 are looked up by core.

## 3. Units, pitch, coordinates

- **Units:** meters, seconds, m/s, rad/s, kg. Stats 1..99 (use `PlayerData.stat01()` for 0..1).
- **Pitch:** 105 × 68 m (constants in `core/fb.gd`, class `FB`): goal 7.32 × 2.44 m, penalty area 16.5 × 40.32, goal area 5.5 × 18.32, spot 11 m, circle 9.15 m.
- **World origin** = centre spot. **+x** to the right, **+y** down (screen convention). Touchlines at y = ±34, goal lines at x = ±52.5.
- **Attack direction:** `Team.attack_dir` = +1 (attacks +x goal) or −1. Home starts +1, away −1, swapped at half-time. Never hard-code a side; use `team.target_goal_center()` / `own_goal_center()`.
- **Height:** ball is 2.5D: `Ball.pos` (ground plane) + `Ball.height` (m above grass) + `Ball.vz`. Players are 2D circles (`FB.PLAYER_RADIUS` = 0.4 m).
- **Rendering:** `FB.PPM` = **32 px/m**. `node.position = pos * FB.PPM`. Pitch = 3360 × 2176 px. Base viewport 1280 × 720 (≈ 40 × 22.5 m visible at zoom 1).
- **Normalized team coords** (formations, tactics): `x` 0 = own goal line → 1 = opponent goal line; `y` 0 = left touchline → 1 = right, *as seen by the attacking team*. Convert with `Team.normalized_to_world()` / `world_to_normalized()`.
- **Angles:** radians, `Vector2.angle()` convention. Spin: positive `Ball.spin` curves the ball to the **left** of its direction of travel.

## 4. Simulation loop & performance

### 4.1 Fixed tick (owned by `FootballMatch.step(delta)`, 60 Hz)
```
tick += 1; group = tick % FB.AI_STAGGER_GROUPS (6)
1. Team.think(dt*6)       home on group 0, away on group 3  -> TeamShape.update + TeamBrain.think
2. Player.think(dt*6)     players whose stagger_group == group -> brain.think (heavy decisions, 10 Hz each)
3. Player.step(dt)        all players: brain.act (cheap, writes intent) -> motor.step (executes intent)
4. CollisionSolver.solve(dt)
5. Ball.physics_step(dt)
6. Referee.step(dt)
7. possession + control-context update (core)
8. human InputController.end_tick()   (unconsumed press/release edges are discarded)
```
- Nodes must **not** implement their own `_physics_process` for simulation. Everything runs from `step()`, so headless sims can run faster than real time (`MatchConfig.auto_step = false`, call `m.step(FB.TICK_DT)` in a loop).
- Views update in `FootballMatch._process` via `sync_view()`; never touch views in `step()`.
- Randomness: use `football_match.rng` (seeded from `MatchConfig.rng_seed`) for determinism.

### 4.2 Pause
`FootballMatch.set_paused(bool)` stops stepping (the scene tree is **not** paused, so UI keeps working). Android back button / app backgrounding pauses automatically.

### 4.3 Performance rules
- No `Array`/`Dictionary`/`String` creation per tick in hot paths; reuse members, `PackedVector2Array`, etc. No `get_node()` per tick.
- Brains: heavy evaluation in `think()` (10 Hz), cheap steering in `act()`.
- Custom ball physics (no RigidBody2D). No physics engine bodies for players.
- `_draw()` only on change (`queue_redraw()` when state changes), particles ≤ 64 at once, no shaders required.
- Target budget per tick on a mid phone: simulation ≤ 4 ms total (AI ≤ 2 ms, physics ≤ 1 ms, rules ≤ 0.5 ms).

## 5. Event bus (`EventBus` autoload, `core/event_bus.gd`)

Team ids: 0 home, 1 away, −1 none. Emit only the signals you own:

| Signal | Args | Emitter |
|---|---|---|
| `kickoff` | team_id | Referee |
| `goal_scored` | team_id, scorer: Player, assist: Player, own_goal: bool | Referee |
| `foul` | offender, victim, pos, severity (FB.FoulSeverity), advantage: bool | Referee |
| `card` | player, card_type (FB.Card) | Referee |
| `offside` | player, pos | Referee |
| `out_of_play` | pos, last_touch_team, reason (FB.OutReason) | Referee |
| `throw_in` / `corner` / `goal_kick` / `penalty` | team_id, pos | Referee |
| `free_kick` | team_id, pos, direct: bool | Referee |
| `half_time` / `full_time` | – / home_score, away_score | Referee |
| `whistle` | kind (FB.Whistle) | Referee |
| `match_phase_changed` | phase (FB.MatchPhase) | Referee (`set_phase`) |
| `set_piece_ready` | restart: RestartInfo | Referee |
| `possession_changed` | team_id, player | FootballMatch |
| `control_context_changed` | context (FB.Context) | FootballMatch |
| `controlled_player_changed` | team_id, player | Team |
| `match_paused` | paused | FootballMatch |
| `match_started` / `match_ended` | match / result dict | FootballMatch |
| `substitution` | team_id, player (reused node), out_data, in_data | Team |
| `ball_kicked` | player, kind (FB.IntentAction), power 0..1 | PlayerMotor |
| `ball_touched` | player | Ball |
| `tackle_attempted` | tackler, target, slide, success | PlayerMotor |
| `save_made` | goalkeeper | PlayerMotor / Ball |
| `shot_taken` | player, on_target | PlayerMotor |
| `auto_switch_suggested` | player | TeamBrain (human team) |
| `pass_target_highlighted` | player or null | HumanBrain |

New signals → `docs/REQUESTS.md`.

## 6. Input abstraction

### 6.1 Abstract actions — `FB.Action`
`PASS, LONG_PASS, SHOOT, SPRINT, SKILL, TACKLE, SLIDE, SWITCH_PLAYER, PRESS, GK_DIVE, GK_DISTRIBUTE, GK_KICK, GK_COME_OUT, SP_CONFIRM, SP_CANCEL, PAUSE` plus continuous **move vector** (0..1 length), **aim vector** (set pieces) and **curve input** (−1..1).

Semantics (implemented by PHYSICS/RULES):
- `PASS` tap = ground pass to the aim-assisted target in the stick direction.
- `LONG_PASS` tap = through ball into space; hold ≥ 0.25 s = lofted long ball (power from hold).
- `SHOOT` hold to charge (`get_charge(SHOOT, 1.0)`), release fires; power error grows past ~0.85 charge.
- `SPRINT` hold. `SKILL` = feint/drag-back in stick direction.
- `TACKLE` standing tackle; `SLIDE` slide (foul risk); `SWITCH_PLAYER` → `team_brain.suggest_switch_target()`; `PRESS` = call nearest teammate to press the carrier (hold).
- GK: `GK_DISTRIBUTE` throw/roll, `GK_KICK` long kick, `GK_DIVE` dive toward stick direction, `GK_COME_OUT` rush the attacker (hold).
- Set piece: aim with drag/stick, `SP_CONFIRM` advances aim → power → (curve) → kick, `SP_CANCEL` steps back.

### 6.2 Contexts and button slots
`FB.Context`: `HAS_BALL, DEFENDING, GOALKEEPER, SET_PIECE` (+ `NONE`). Computed by core each tick for the human team:
`SET_PIECE` if referee phase is `SET_PIECE`, restart belongs to the human team and the controlled player is the taker; else `GOALKEEPER` if the controlled player is the GK; else `HAS_BALL` if the human team has possession; else `DEFENDING`.

Physical buttons are **slots** (`FB.Slot`: PRIMARY, SECONDARY, TERTIARY, QUATERNARY, SPRINT). `ControlLayouts` (`core/control_layouts.gd`) maps (context, scheme, slot) → action, and gives labels and hold-style flags. Touch, keyboard and gamepad all use this same table so labels always match behaviour.

| Slot | HAS_BALL (pro / simple) | DEFENDING | GOALKEEPER | SET_PIECE | Keys | Pad |
|---|---|---|---|---|---|---|
| PRIMARY | PASS / PASS | TACKLE / TACKLE | GK_DISTRIBUTE | SP_CONFIRM | J, Space | A |
| SECONDARY | LONG_PASS / – | SLIDE / – | GK_KICK / – | SP_CANCEL | K | Y |
| TERTIARY | SHOOT / SHOOT | SWITCH / SWITCH | GK_DIVE | – | L | B |
| QUATERNARY | SKILL / – | PRESS / – | GK_COME_OUT / – | – | I | X |
| SPRINT | SPRINT | SPRINT | SPRINT | – | Shift | RB |

Extra: `Q`/LB = SWITCH_PLAYER in any context, `Esc`/`P`/Start = PAUSE. Move: WASD/arrows/left stick.
**Simple scheme:** fewer buttons; HumanBrain applies stronger aim assist and auto-pass target selection, and auto-switches when defending.

### 6.3 `InputController` (`core/interfaces/input_controller.gd`, extends `Node`)
Feeding API (sources): `set_move_vector(source:int, v:Vector2)`, `set_aim_vector(v)`, `set_curve_input(c:float)`, `press_slot(source, slot)`, `release_slot(source, slot)`, `press_action(a)`, `release_action(a)`, `release_all()`, `set_context(ctx)`, `set_scheme(s)`.
Reading API (gameplay): `get_move_vector() -> Vector2`, `get_aim_vector() -> Vector2`, `get_curve_input() -> float`, `is_held(a) -> bool`, `get_hold_time(a) -> float`, `get_charge(a, full_time=1.0) -> float`, `consume_press(a) -> bool`, `consume_release(a) -> float` (hold seconds or −1), `has_press(a) -> bool`, `end_tick()`.
Hooks: `process_move_vector(raw) -> Vector2` (dead zone/curve). Signals: `action_pressed(a)`, `action_released(a, held)`, `context_changed(ctx)`.
Sources: `InputController.Source.DEVICE / TOUCH / TEST / AUX`. Strongest move vector among sources wins. Presses are counted per action, so several fingers/sources can hold the same action; a slot remembers the action it pressed so a context change mid-hold releases correctly. Edges are buffered until `end_tick()` → **taps shorter than a frame are never dropped**.

### 6.4 Touch contract (PHYSICS × UI)
- UI scene `ui/touch/touch_controls.tscn` (root `Control`, full-rect, `mouse_filter = IGNORE` except widgets) handles **raw `InputEventScreenTouch` / `InputEventScreenDrag` by finger `index`** (do *not* rely on `Button` mouse emulation — it is single-touch). It calls `bind(match)` to get `match.human_input` and then only the feeding API above with `Source.TOUCH`.
- Floating joystick: appears where the thumb lands in the left 45 % of the screen (right side if `left_handed`), radius ≈ 70 dp, outputs `set_move_vector(TOUCH, v)`; returns to zero on release.
- Buttons: ≥ 48 dp (×`GameSettings.button_scale`), opacity `GameSettings.button_opacity`, in an arc in the opposite corner, labels from `ControlLayouts.label_for()`, hidden when the slot maps to `NONE`, re-laid out on `EventBus.control_context_changed`. Pressed-state visual + `Haptics.pulse()`. Hold actions (`ControlLayouts.is_hold_action`) show a charge ring using `human_input.get_charge()`.
- Set pieces: in `SET_PIECE` context a drag anywhere outside the buttons sets `set_aim_vector()` (direction + length = power hint); a curve slider/swipe sets `set_curve_input()`.
- `physics/touch_input_controller.gd` (extends InputController) owns dead zone (≈ 0.12), response curve, and may smooth input; it must not draw anything.
- Pause button top corner inside the safe area → `match.set_paused(true)`.
- Desktop: `emulate_touch_from_mouse` is on, so mouse drags exercise the touch path.

## 7. Interfaces (base classes in `core/interfaces/`)

Base classes contain **working stubs**. Module implementations `extends` them, override methods, and keep every listed property and signature. Do not rename or remove members; adding private members (`_x`) and extra public helpers is fine.

### 7.1 `Ball` (extends Node2D) — impl `physics/ball_physics.gd`
Properties: `pos: Vector2`, `vel: Vector2`, `height: float`, `vz: float`, `spin: float`, `owner_player: Player`, `last_touch_player: Player`, `last_touch_team: int`, `frozen: bool`, `football_match: FootballMatch`.
Signals: `touched(player)`, `owner_changed(old, new)`, `kicked(by)`.
Methods: `setup(m)`, `physics_step(delta)`, `kick(velocity: Vector2, up_velocity: float, spin_rate: float, by: Player)`, `set_owner(p: Player)` (null releases), `place(at: Vector2)` (dead ball, frozen), `register_touch(p)`, `is_loose() -> bool`, `is_airborne() -> bool`, `predict_position(t: float) -> Vector2`, `predict_stop_position() -> Vector2`, `sync_view()`, `_draw()`.
Rules: while `owner_player != null` the ball is dribbled (motor/ball keep it at the feet); every touch must go through `register_touch`/`set_owner`/`kick` so the referee sees it. Goal frame/net collision is the ball's job.

### 7.2 `Player` (extends Node2D, **not subclassed**)
Properties: `data: PlayerData`, `team: Team`, `football_match`, `slot_index: int`, `role: int (FB.Role)`, `pos`, `vel`, `facing: Vector2 (unit)`, `stamina: float 0..1`, `state: int (FB.PlayerState)`, `state_timer: float`, `touch_cooldown: float`, `yellow_cards: int`, `sent_off: bool`, `home_position: Vector2`, `is_human: bool`, `intent: PlayerIntent`, `motor: PlayerMotor`, `ai_brain`, `human_brain`, `brain: PlayerBrain`, `stagger_group: int`, `color_body`, `color_trim`.
Methods: `setup(data, team, match, slot, role)`, `set_human_controlled(on)`, `think(dt)`, `step(delta)`, `has_ball()`, `is_goalkeeper()`, `can_play()`, `distance_to_ball()`, `attack_dir() -> int`, `stat(name) -> float 0..1`, `teleport(pos, face=ZERO)`, `sync_view()`.

### 7.3 `PlayerIntent` (RefCounted, one per player, reused)
`move: Vector2 (0..1)`, `look: Vector2`, `sprint: bool`, `action: int (FB.IntentAction)`, `target_point: Vector2`, `target_player: Player`, `power: float 0..1`, `curve: float −1..1`, `loft: float 0..1`; `set_action(action, target, power=0.5, target_player=null)`, `clear_action()`, `reset()`.
Brains write; the motor executes and calls `clear_action()` once an action is handled (or rejected).

### 7.4 `PlayerMotor` (RefCounted) — impl `physics/player_motor_impl.gd`
`player: Player`; `setup(p)`, `step(delta)` (locomotion with acceleration/top speed/turn rate from stats & stamina, stamina drain/recovery, dribble/first touch, kicks with error from pressure/skill/fatigue, tackles → `referee.report_contact(...)`, GK dives/catches), `can_touch_ball() -> bool`, `static is_kick_action(a) -> bool`.

### 7.5 `PlayerBrain` (RefCounted) — impl `ai/ai_brain.gd` (AI) and `physics/human_brain.gd` (PHYSICS)
`player: Player`; `setup(p)`, `on_activated()`, `think(dt)` (10 Hz), `act(delta)` (every tick, writes `player.intent`).
The human brain reads `player.team.input` (InputController), applies aim assist (`GameSettings.aim_assist`), emits `pass_target_highlighted`, handles `SWITCH_PLAYER` via `team.set_controlled_player(team.team_brain.suggest_switch_target())`. During `referee.is_set_piece_pending()` the AI brain moves to `team.shape.get_set_piece_position()`.

### 7.6 `Team` (extends Node, core-owned)
Properties: `team_id`, `data: TeamData`, `tactics: TacticsData`, `formation: FormationData`, `players: Array[Player]`, `bench: Array[PlayerData]`, `subs_used`, `attack_dir: int`, `score: int`, `opponent: Team`, `football_match`, `shape: TeamShape`, `team_brain: TeamBrain`, `is_human`, `input: InputController`, `controlled_player: Player`.
Methods: `setup(id, data, match)`, `set_human(input)`, `set_controlled_player(p)`, `own_goal_center()`, `target_goal_center()`, `normalized_to_world(n)`, `world_to_normalized(w)`, `goalkeeper()`, `nearest_player_to(point, exclude_gk=false, exclude=null)`, `has_possession()`, `active_player_count()`, `substitute(player_out, in_data) -> bool` (max 5), `think(dt)`.

### 7.7 `TeamShape` (RefCounted) — impl `tactics/team_shape_impl.gd`
`team`; `setup(t)`, `update(dt)` (writes every `home_position`: formation + ball position + possession phase + tactics sliders), `get_kickoff_position(p, kicking_off) -> Vector2`, `get_kickoff_taker() -> Player`, `get_set_piece_position(p, restart: RestartInfo) -> Vector2` (walls, corner routines, penalty box positions), `pick_set_piece_taker(restart) -> Player`.

### 7.8 `TeamBrain` (RefCounted) — impl `ai/team_ai.gd`
`team`, `chaser: Player`, `marking: Dictionary (defender → attacker)`, `defensive_line_x: float`; `setup(t)`, `think(dt)`, `suggest_switch_target() -> Player`.

### 7.9 `CollisionSolver` (RefCounted) — impl `physics/collision_solver_impl.gd`
`football_match`; `setup(m)`, `solve(delta)` (player–player separation, body–ball deflections).

### 7.10 `Referee` (extends Node) — impl `rules/referee_impl.gd`
Properties: `football_match`, `phase: int (FB.MatchPhase)`, `half: int`, `clock: float` (game seconds, 0..5400 + stoppage), `stoppage: float`, `time_scale: float` (game s per real s, from `MatchConfig.half_length_minutes`), `restart: RestartInfo`, `first_kickoff_team: int`, `phase_timer: float`.
Methods: `setup(m)`, `start_match()`, `step(delta)`, `set_phase(p)`, `begin_kickoff(team_id)`, `report_contact(tackler, victim, ball_first: bool, intensity: float, from_behind: bool)`, `on_ball_touched(p)` (connected to `Ball.touched`), `is_ball_in_play() -> bool`, `is_set_piece_pending() -> bool`, `get_display_minute() -> int`, `get_clock_text() -> String`.
Set-piece flow: Referee places ball (`ball.place`), sets `restart` (type, team, position, taker via `shape.pick_set_piece_taker`), phase `SET_PIECE`, emits `set_piece_ready`. AI takers kick via intent `SET_PIECE_KICK`; the human taker uses `SP_CONFIRM`/aim/curve input (RULES may ship `rules/set_piece_ui.tscn` for the aim arrow/power meter). The first touch after the restart sets phase `PLAYING`. Must call `football_match.finish()` at full time.

### 7.11 `FootballMatch` (extends Node2D, core-owned) — the "Match" interface
Properties: `config: MatchConfig`, `rng: RandomNumberGenerator`, `ball`, `teams: Array[Team]`, `players: Array[Player]` (all 22), `referee`, `collision_solver`, `human_input: InputController` (null in AI vs AI), `human_team: Team`, `possession_team: int`, `control_context: int`, `tick: int`, `paused`, `is_finished`, `headless`, `entity_layer`, `camera`, `ui_layer`.
Signal: `finished(result)`. Methods: `setup(cfg)`, `start()`, `step(delta)`, `all_players()`, `controlled_player()`, `set_paused(p)`, `finish()`, `get_result() -> Dictionary`.
Core auto-switches the human to the new ball carrier on gaining possession.

### 7.12 Data classes (`core/data/`)
`PlayerData`, `TeamData`, `FormationData`, `TacticsData` (Resources with `from_dict()`/`to_dict()`), `MatchConfig` (Resource), `RestartInfo` (RefCounted), `DataLoader` (static JSON loader with cache and placeholder fallback).
`TacticsData`: `formation_id`, sliders `pressing, line_height, width, tempo, mentality` (0..1, 0.5 neutral), `captain_id, penalty_taker_id, free_kick_taker_id, corner_taker_id`, `corner_routine`, `free_kick_routine`.
`MatchConfig`: `home_team_id, away_team_id, home_team, away_team, human_side (0/1/−1), difficulty, half_length_minutes, headless, auto_step, rng_seed`; `create_default()`, `create_headless_sim(seed, minutes)`.

## 8. Plug-in slots (`core/factory.gd`)

Core instantiates implementations by **fixed path**; if the file is absent the core stub is used. Create exactly these files:

| Slot | Implementation path | Must extend | Owner |
|---|---|---|---|
| ball | `physics/ball_physics.gd` | Ball | PHYSICS |
| player_motor | `physics/player_motor_impl.gd` | PlayerMotor | PHYSICS |
| human_brain | `physics/human_brain.gd` | PlayerBrain | PHYSICS |
| collision_solver | `physics/collision_solver_impl.gd` | CollisionSolver | PHYSICS |
| input_controller | `physics/touch_input_controller.gd` | InputController | PHYSICS |
| referee | `rules/referee_impl.gd` | Referee | RULES |
| ai_brain | `ai/ai_brain.gd` | PlayerBrain | AI |
| team_brain | `ai/team_ai.gd` | TeamBrain | AI |
| team_shape | `tactics/team_shape_impl.gd` | TeamShape | TACTICS |
| camera | `polish/match_camera_impl.gd` | MatchCamera | POLISH |

Scene slots (instantiated if present; root script may implement `bind(match: FootballMatch)`, post-match gets `bind(result: Dictionary)`):

| Slot | Path | Parent | Owner |
|---|---|---|---|
| main_menu | `ui/menus/main_menu.tscn` | scene root | UI |
| post_match | `ui/menus/post_match.tscn` | scene root | UI |
| hud | `ui/hud/hud.tscn` (fallback `core/views/debug_hud.gd`) | match UI CanvasLayer | UI |
| touch_controls | `ui/touch/touch_controls.tscn` | match UI CanvasLayer | UI |
| pause_menu | `ui/menus/pause_menu.tscn` | match UI CanvasLayer | UI |
| half_time | `ui/menus/half_time.tscn` | match UI CanvasLayer | UI |
| set_piece_ui | `rules/set_piece_ui.tscn` | match UI CanvasLayer | RULES |
| polish | `polish/polish_root.tscn` | match (world space) | POLISH |

App flow (`Game` autoload): `boot()` → main menu if present, else stub match; `start_match(cfg)`, `restart_match()`, `quit_match()`, `goto_main_menu()`; post-match after `FootballMatch.finished`.
Implementation scripts should **not** declare `class_name` for slot files (avoid global name clashes); internal helpers may use `class_name` prefixed by module (`PhysBallMath`, `AiPassEvaluator`, `RulesOffside`, `TacShapeMath`, `UiJoystick`, `PolCamera`...).

## 9. Data formats (JSON, owned by TACTICS under `tactics/data/`)

`tactics/data/index.json`
```json
{ "teams": ["reds", "blues"], "formations": ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1"] }
```
`tactics/data/formations/<id>.json` — exactly 11 slots, slot 0 = GK (normalized coords §3, neutral shape):
```json
{ "id": "4-4-2", "name": "4-4-2",
  "slots": [ {"role": "GK", "x": 0.03, "y": 0.5}, {"role": "LB", "x": 0.22, "y": 0.12}, "... 11 total" ] }
```
`tactics/data/teams/<id>.json` — 16–23 players; first 11 (or `starting_xi`) in formation slot order:
```json
{ "id": "reds", "name": "Red Rovers", "short_name": "RED",
  "colors": { "primary": "#d62828", "secondary": "#ffffff", "goalkeeper": "#16a34a" },
  "tactics": { "formation": "4-4-2", "pressing": 0.6, "line_height": 0.5, "width": 0.5, "tempo": 0.5,
               "mentality": 0.5, "penalty_taker_id": "reds_9", "corner_routine": "far_post" },
  "players": [ { "id": "reds_1", "name": "A. Keeper", "number": 1, "role": "GK", "foot": "R", "height_cm": 190,
                 "stats": { "pace": 50, "acceleration": 50, "stamina": 60, "agility": 70, "strength": 70,
                            "passing": 55, "vision": 50, "shooting": 20, "dribbling": 30, "control": 55,
                            "tackling": 20, "positioning": 70, "aggression": 30, "goalkeeping": 80, "reflexes": 82 } } ],
  "starting_xi": ["reds_1", "... optional, 11 ids"] }
```
Roles: `GK CB LB RB LWB RWB CDM CM CAM LM RM LW RW CF ST`. Missing stats default to 60 (GK stats 20). Team colors must contrast (TACTICS checks home/away clash in a helper; UI picks alternate kit if needed).

## 10. Settings (`GameSettings` autoload)
`control_scheme (FB.ControlScheme)`, `difficulty (FB.Difficulty)`, `half_length_minutes`, `button_scale (0.75–1.5)`, `button_opacity (0.2–1)`, `left_handed`, `haptics_enabled`, `aim_assist (0–1)`, `show_minimap`, `sfx_volume`, `custom_button_positions (slot → normalized Vector2)`. Change with `GameSettings.set_value(key, value)` (persists to `user://settings.cfg`, emits `changed(key)`). `Haptics.pulse(Haptics.Kind.X)` respects settings.

## 11. Mobile & UI rules
- Landscape only (`sensor_landscape`), base 1280×720, stretch `canvas_items` + `expand` → 16:9 … 20:9 widen the view; anchor UI to edges, never assume 16:9.
- Respect notches: use `SafeArea.get_safe_rect(viewport)` / `get_margins()` for every HUD/touch element.
- 1 dp ≈ 1 canvas px at 1280×720 base on a ~6" phone; minimum touch target **48 px** (buttons default 96–120 px), body text ≥ 22 px, titles ≥ 40 px. No hover-only interactions, no tiny menus, no scroll-only critical actions.
- Renderer: Mobile. No heavy shaders; particles light.

## 12. Testing
- Runner: `godot --headless --path football res://tests/test_runner.tscn [-- --filter=<substring>]`. Exit code 0 = pass.
- First run on a fresh checkout: `godot --headless --path football --import` (builds the global class cache).
- Tests extend `TestCase` (`tests/framework/test_case.gd`): `assert_true/false/eq/near/not_null`, `make_headless_match(seed, human_side, minutes)`, `run_ticks(m, n)`. Synchronous only; use headless matches and `InputController` feeding API (Source.TEST) for input tests.
- Put module tests in `tests/<module>/test_*.gd`. Every agent ships tests for its slot behaviour and must keep `tests/core/` green.

## 13. Conventions
- GDScript style guide: tabs, `snake_case` funcs/vars, `PascalCase` classes, `CONSTANT_CASE`, private `_prefix`. Static typing everywhere (`var x: float`, `-> void`); explicit loop types over typed arrays (`for p: Player in players`).
- Never use `match` as an identifier (keyword) → use `football_match`.
- Enums/constants only from `FB`; no magic numbers for pitch geometry.
- Signals: past tense or noun (`goal_scored`). Do not connect to signals you could poll cheaply in hot paths.
- Doc comment (`##`) on every public method of slot implementations.
- No external assets/addons required; generated shapes/audio only.
- **Commits:** small, imperative subject ≤ 72 chars, prefixed by module: `physics: add Magnus curve to ball`, `rules: offside on pass moment`, `core: ...`, `docs: ...`, `tests(ai): ...`.
- **Branches (Phase 2):** `agent/physics`, `agent/rules`, `agent/ai`, `agent/tactics`, `agent/ui` from the Phase 1 commit; Phase 3 `agent/polish-qa`. Only edit your folder + `tests/<module>/` + append to `docs/REQUESTS.md`.

## 14. Requests & bugs
- `docs/REQUESTS.md`: append `### [module] title` with *what*, *why*, *proposed signature*. Until applied, work around it inside your folder.
- `docs/BUGS.md`: QA appends `### [owner-module] title` with repro, expected, actual, sim seed.

## 15. Reading list per agent (must read & respect)

| Agent | Must read | Must respect |
|---|---|---|
| ALL | §1–4, §8, §12–14, `core/fb.gd`, `core/event_bus.gd`, `core/interfaces/*` for what you touch | Folder ownership, fixed tick order, no raw input in gameplay, no per-tick allocations, tests green |
| PHYSICS | §5, §6 (all), §7.1–7.5, §7.9, §7.10 `report_contact`, `control_layouts.gd`, `input_controller.gd`, `player_motor.gd`, `ball.gd` | Units, spin sign, `register_touch` for every touch, emit kick/tackle signals, touch contract §6.4 |
| RULES | §5, §6.1–6.2, §7.1, §7.6–7.7, §7.10, `referee.gd`, `restart_info.gd` | Laws of the game, phase transitions via `set_phase`, `finish()` at full time, touch-playable set pieces |
| AI | §4, §7.2–7.8, §7.10 queries, `team_brain.gd`, `player_brain.gd`, `stub_ai_brain.gd` | Heavy work only in `think()`, staggering, difficulty from `config.difficulty`, set-piece positions from shape |
| TACTICS | §3 normalized coords, §7.6–7.7, §7.12, §9 | 11-slot formations, slot 0 GK, index.json, sliders 0..1, `home_position` written every update |
| UI | §5, §6.2–6.4, §8 scene slots, §10, §11, `game.gd`, `game_settings.gd`, `safe_area.gd`, `control_layouts.gd` | Raw multitouch handling, safe areas, ≥48 px targets, `bind()` contracts, settings via `set_value` |
| POLISH_QA (P3) | Everything above + `football_match.gd` | No gameplay changes; bug reports to BUGS.md tagged by owner |
