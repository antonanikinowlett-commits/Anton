class_name TacShapeMath
extends RefCounted
## Pure helpers shared by the tactics module: role families, role similarity,
## attack-frame conversions and colour distance. No state, no allocations beyond Vector2s.

## Coarse role families used by the shape logic.
enum Group { GK, DEF, WB, DM, CM, AM, WIDE, FWD }

## (depth, lateral) embedding of each role, indexed by FB.Role. Used for role similarity.
const _ROLE_EMBED := [
	Vector2(-3.0, 0.0),   # GK
	Vector2(-2.0, 0.0),   # CB
	Vector2(-1.6, -1.0),  # LB
	Vector2(-1.6, 1.0),   # RB
	Vector2(-1.2, -1.3),  # LWB
	Vector2(-1.2, 1.3),   # RWB
	Vector2(-1.0, 0.0),   # CDM
	Vector2(0.0, 0.0),    # CM
	Vector2(1.0, 0.0),    # CAM
	Vector2(0.0, -1.3),   # LM
	Vector2(0.0, 1.3),    # RM
	Vector2(1.0, -1.3),   # LW
	Vector2(1.0, 1.3),    # RW
	Vector2(1.7, 0.0),    # CF
	Vector2(2.2, 0.0),    # ST
]


static func group_of(role: int) -> int:
	match role:
		FB.Role.GK:
			return Group.GK
		FB.Role.CB, FB.Role.LB, FB.Role.RB:
			return Group.DEF
		FB.Role.LWB, FB.Role.RWB:
			return Group.WB
		FB.Role.CDM:
			return Group.DM
		FB.Role.CM:
			return Group.CM
		FB.Role.CAM:
			return Group.AM
		FB.Role.LM, FB.Role.RM, FB.Role.LW, FB.Role.RW:
			return Group.WIDE
	return Group.FWD


static func is_forward(role: int) -> bool:
	return role == FB.Role.ST or role == FB.Role.CF


static func is_fullback(role: int) -> bool:
	return role == FB.Role.LB or role == FB.Role.RB or role == FB.Role.LWB or role == FB.Role.RWB


## Role on the opposite flank (LB <-> RB ...). Central roles map to themselves.
static func mirror_role(role: int) -> int:
	match role:
		FB.Role.LB:
			return FB.Role.RB
		FB.Role.RB:
			return FB.Role.LB
		FB.Role.LWB:
			return FB.Role.RWB
		FB.Role.RWB:
			return FB.Role.LWB
		FB.Role.LM:
			return FB.Role.RM
		FB.Role.RM:
			return FB.Role.LM
		FB.Role.LW:
			return FB.Role.RW
		FB.Role.RW:
			return FB.Role.LW
	return role


## How badly a player of role a fits a slot of role b (0 = identical).
static func role_distance(a: int, b: int) -> float:
	if a == b:
		return 0.0
	if a == FB.Role.GK or b == FB.Role.GK:
		return 50.0
	var ea: Vector2 = _ROLE_EMBED[a]
	var eb: Vector2 = _ROLE_EMBED[b]
	return ea.distance_to(eb)


## World metres -> attack frame (x: 0 own goal line .. 105, y: 0 left .. 68), for a team attacking in dir.
static func to_frame(w: Vector2, dir: int) -> Vector2:
	return Vector2(w.x * dir + FB.HALF_LENGTH, w.y * dir + FB.HALF_WIDTH)


## Attack frame -> world metres.
static func from_frame(a: Vector2, dir: int) -> Vector2:
	return Vector2((a.x - FB.HALF_LENGTH) * dir, (a.y - FB.HALF_WIDTH) * dir)


static func clamp_pitch(w: Vector2, margin: float = 0.3) -> Vector2:
	return Vector2(clampf(w.x, -FB.HALF_LENGTH + margin, FB.HALF_LENGTH - margin),
		clampf(w.y, -FB.HALF_WIDTH + margin, FB.HALF_WIDTH - margin))


## Perceptual-ish ("redmean") colour distance, 0..~765 (255-scale).
static func color_distance(a: Color, b: Color) -> float:
	var rm := (a.r + b.r) * 0.5 * 255.0
	var dr := (a.r - b.r) * 255.0
	var dg := (a.g - b.g) * 255.0
	var db := (a.b - b.b) * 255.0
	return sqrt((2.0 + rm / 256.0) * dr * dr + 4.0 * dg * dg + (2.0 + (255.0 - rm) / 256.0) * db * db)
