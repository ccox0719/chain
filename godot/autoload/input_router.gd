extends Node

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if not GameState.world.is_empty() and bool(GameState.world.get("map_overlay_open", false)):
			GameState.world["map_overlay_open"] = false
			return
		get_tree().quit()
