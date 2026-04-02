extends Node

func _ready() -> void:
	var world: Dictionary = SaveManager.load_game_state()
	if world.is_empty():
		world = GameState.new_game_world()
	GameState.reset_world(world)
	get_tree().change_scene_to_file("res://scenes/game/game_root.tscn")
