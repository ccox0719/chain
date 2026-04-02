extends RefCounted

class_name SectorLoader

const DATA_PATH := "res://data/sectors/sectors.json"

func load_all() -> Dictionary:
	return _load_json(DATA_PATH)

func load_sector(sector_id: String) -> Dictionary:
	var data := load_all()
	for sector in data.get("sectors", []):
		if sector.get("id", "") == sector_id:
			return sector
	return {}

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if typeof(parsed) == TYPE_DICTIONARY else {}
