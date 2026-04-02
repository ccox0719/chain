extends RefCounted

class_name ModuleLoader

const DATA_PATH := "res://data/modules/modules.json"

func load_all() -> Dictionary:
	return _load_json(DATA_PATH)

func load_module(module_id: String) -> Dictionary:
	var data := load_all()
	for module in data.get("modules", []):
		if module.get("id", "") == module_id:
			return module
	return {}

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if typeof(parsed) == TYPE_DICTIONARY else {}
