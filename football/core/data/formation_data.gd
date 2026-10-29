class_name FormationData
extends Resource
## A formation: 11 slots in normalized, attack-relative coordinates.
## x: 0 = own goal line .. 1 = opponent goal line (depth)
## y: 0 = left touchline .. 1 = right touchline, seen by the attacking team.
## Slot 0 MUST be the goalkeeper. Positions describe the neutral shape
## (ball at centre spot, no possession); TeamShape shifts it dynamically.

@export var id: String = ""
@export var name: String = ""
@export var roles: PackedInt32Array = PackedInt32Array()
@export var positions: PackedVector2Array = PackedVector2Array()


func slot_count() -> int:
	return positions.size()


static func from_dict(d: Dictionary) -> FormationData:
	var f := FormationData.new()
	f.id = str(d.get("id", ""))
	f.name = str(d.get("name", f.id))
	var slots: Array = d.get("slots", [])
	for s in slots:
		var sd: Dictionary = s
		f.roles.append(FB.role_from_string(str(sd.get("role", "CM"))))
		f.positions.append(Vector2(float(sd.get("x", 0.5)), float(sd.get("y", 0.5))))
	return f


func to_dict() -> Dictionary:
	var slots := []
	for i in positions.size():
		slots.append({"role": FB.role_to_string(roles[i]), "x": positions[i].x, "y": positions[i].y})
	return {"id": id, "name": name, "slots": slots}
