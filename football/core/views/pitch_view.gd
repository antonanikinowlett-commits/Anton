class_name PitchView
extends Node2D
## Static pitch drawing (drawn once). POLISH may restyle via res://polish.

const GRASS_A := Color(0.20, 0.55, 0.22)
const GRASS_B := Color(0.18, 0.50, 0.20)
const RUNOFF_COLOR := Color(0.15, 0.42, 0.17)
const LINE := Color(1, 1, 1, 0.9)
const LINE_W := 3.0
const STRIPES := 14


func _ready() -> void:
	name = "Pitch"
	z_index = -10


func _draw() -> void:
	var s := FB.PPM
	var hl := FB.HALF_LENGTH * s
	var hw := FB.HALF_WIDTH * s
	var ro := FB.RUNOFF * s
	draw_rect(Rect2(-hl - ro, -hw - ro, (hl + ro) * 2.0, (hw + ro) * 2.0), RUNOFF_COLOR)
	var stripe_w := hl * 2.0 / STRIPES
	for i in STRIPES:
		draw_rect(Rect2(-hl + i * stripe_w, -hw, stripe_w, hw * 2.0), GRASS_A if i % 2 == 0 else GRASS_B)
	# Outline and halfway line.
	draw_rect(Rect2(-hl, -hw, hl * 2.0, hw * 2.0), LINE, false, LINE_W)
	draw_line(Vector2(0, -hw), Vector2(0, hw), LINE, LINE_W)
	draw_arc(Vector2.ZERO, FB.CENTER_CIRCLE_RADIUS * s, 0.0, TAU, 64, LINE, LINE_W)
	draw_circle(Vector2.ZERO, 4.0, LINE)
	for dir: float in [-1.0, 1.0]:
		var gx := dir * hl
		# Penalty area.
		var pa_d := FB.PENALTY_AREA_DEPTH * s
		var pa_w := FB.PENALTY_AREA_WIDTH * s
		draw_rect(Rect2(minf(gx, gx - dir * pa_d), -pa_w * 0.5, pa_d, pa_w), LINE, false, LINE_W)
		# Goal area.
		var ga_d := FB.GOAL_AREA_DEPTH * s
		var ga_w := FB.GOAL_AREA_WIDTH * s
		draw_rect(Rect2(minf(gx, gx - dir * ga_d), -ga_w * 0.5, ga_d, ga_w), LINE, false, LINE_W)
		# Penalty spot and arc (outside the area only).
		var spot := Vector2(gx - dir * FB.PENALTY_SPOT_DIST * s, 0)
		draw_circle(spot, 4.0, LINE)
		var half_ang := acos((FB.PENALTY_AREA_DEPTH - FB.PENALTY_SPOT_DIST) / FB.PENALTY_ARC_RADIUS)
		var center_ang := PI if dir > 0.0 else 0.0
		draw_arc(spot, FB.PENALTY_ARC_RADIUS * s, center_ang - half_ang, center_ang + half_ang, 24, LINE, LINE_W)
		# Goal (net behind the line).
		var gw := FB.GOAL_WIDTH * s
		var gd := FB.GOAL_DEPTH * s
		draw_rect(Rect2(minf(gx, gx + dir * gd), -gw * 0.5, gd, gw), Color(1, 1, 1, 0.25))
		draw_rect(Rect2(minf(gx, gx + dir * gd), -gw * 0.5, gd, gw), LINE, false, LINE_W)
	# Corner arcs.
	for cx: float in [-1.0, 1.0]:
		for cy: float in [-1.0, 1.0]:
			var c := Vector2(cx * hl, cy * hw)
			var a0 := atan2(-cy, -cx)
			draw_arc(c, FB.CORNER_ARC_RADIUS * s, a0 - PI * 0.25, a0 + PI * 0.25, 8, LINE, LINE_W)
