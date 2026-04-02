extends RefCounted

class_name TradeGoodLoader

const DATA_PATH := "res://data/economy/trade_goods.json"

func load_all() -> Dictionary:
	return _load_json(DATA_PATH)

func load_good(good_id: String) -> Dictionary:
	var data := load_all()
	for good in data.get("goods", []):
		if good.get("id", "") == good_id:
			return good
	return {}

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if typeof(parsed) == TYPE_DICTIONARY else {}
