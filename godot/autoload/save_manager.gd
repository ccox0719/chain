extends Node

const SAVE_PATH := "user://savegame.json"

func save_game_state(state: Dictionary) -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(_encode_value(state)))

func load_game_state() -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {}
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return _decode_value(parsed) if typeof(parsed) == TYPE_DICTIONARY else {}

func _encode_value(value: Variant) -> Variant:
	if value is Vector2:
		return {
			"__type": "Vector2",
			"x": value.x,
			"y": value.y
		}
	if value is Dictionary:
		var encoded: Dictionary = {}
		for key in value.keys():
			encoded[key] = _encode_value(value[key])
		return encoded
	if value is Array:
		return value.map(func(item): return _encode_value(item))
	return value

func _decode_value(value: Variant) -> Variant:
	if value is Dictionary:
		if value.get("__type") == "Vector2":
			return Vector2(float(value.get("x", 0.0)), float(value.get("y", 0.0)))
		var decoded: Dictionary = {}
		for key in value.keys():
			decoded[key] = _decode_value(value[key])
		return decoded
	if value is Array:
		return value.map(func(item): return _decode_value(item))
	return value
