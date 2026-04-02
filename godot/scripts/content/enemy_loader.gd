extends RefCounted

class_name EnemyLoader

const DATA_PATH := "res://data/enemies/enemies.json"

func load_all() -> Dictionary:
	return _load_json(DATA_PATH)

func load_variant(variant_id: String) -> Dictionary:
	var data := load_all()
	for variant in data.get("variants", []):
		if variant.get("id", "") == variant_id:
			return variant
	return {}

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if typeof(parsed) == TYPE_DICTIONARY else {}
