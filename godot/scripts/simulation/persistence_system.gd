extends RefCounted

class_name PersistenceSystem

func save_world(world: Dictionary) -> void:
	SaveManager.save_game_state(world)

