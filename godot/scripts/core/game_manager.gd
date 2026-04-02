extends Node

class_name GameManager

func issue_command(command: Dictionary) -> void:
	EventBus.command_issued.emit(command)

