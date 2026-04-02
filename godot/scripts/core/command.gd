extends RefCounted

class_name Command

var type: String
var payload: Dictionary = {}

func _init(command_type: String = "", command_payload: Dictionary = {}) -> void:
	type = command_type
	payload = command_payload

