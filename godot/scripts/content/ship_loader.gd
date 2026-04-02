extends RefCounted

class_name ShipLoader

const DATA_PATH := "res://data/ships/player_ships.json"

func load_all() -> Dictionary:
	return _load_json(DATA_PATH)

func load_ship(ship_id: String) -> Dictionary:
	var data := load_all()
	for ship in data.get("ships", []):
		if ship.get("id", "") == ship_id:
			return ship
	return {}

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if typeof(parsed) == TYPE_DICTIONARY else {}
