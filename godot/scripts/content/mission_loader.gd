extends RefCounted

class_name MissionLoader

const DATA_PATH := "res://data/missions/missions.json"

func load_all() -> Dictionary:
	return _load_json(DATA_PATH)

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if typeof(parsed) == TYPE_DICTIONARY else {}
