extends Node2D

@onready var _map_panel: Node = $MapPanel

var _save_timer := 0.0
var _fire_pressed := false

func _ready() -> void:
	if GameState.world.is_empty():
		GameState.reset_world(GameState.new_game_world())

func _process(delta: float) -> void:
	if _map_open():
		_fire_pressed = false
		GameState.update_world(delta)
		_save_timer += delta
		if _save_timer >= 5.0:
			_save_timer = 0.0
			SaveManager.save_game_state(GameState.world)
		return
	if GameState.world.get("docked_station_id", "") != "":
		_fire_pressed = false
		GameState.update_world(delta)
		_save_timer += delta
		if _save_timer >= 5.0:
			_save_timer = 0.0
			SaveManager.save_game_state(GameState.world)
		return
	_update_player(delta)
	_update_enemies(delta)
	_update_projectiles(delta)
	GameState.update_world(delta)
	_save_timer += delta
	if _save_timer >= 5.0:
		_save_timer = 0.0
		SaveManager.save_game_state(GameState.world)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		var mouse_event := event as InputEventMouseButton
		if _map_open():
			return
		if mouse_event.button_index == MOUSE_BUTTON_LEFT:
			_select_target(mouse_event.position)
	elif event is InputEventKey and event.pressed and event.keycode == KEY_SPACE:
		if _map_open():
			return
		_fire_pressed = true
	elif event is InputEventKey and not event.pressed and event.keycode == KEY_SPACE:
		_fire_pressed = false
	elif event is InputEventKey and event.pressed and event.keycode == KEY_M:
		_set_map_overlay(not _map_open())
		get_viewport().set_input_as_handled()
		return
	elif event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE and _map_open():
		_set_map_overlay(false)
		get_viewport().set_input_as_handled()
		return
	elif event is InputEventKey and event.pressed and event.keycode == KEY_E:
		if _map_open():
			return
		if GameState.world.get("docked_station_id", "") != "":
			GameState.undock_station()
			_fire_pressed = false
		else:
			var station := GameState.get_nearest_station()
			if not station.is_empty():
				if GameState.dock_station(String(station.get("id", ""))):
					_fire_pressed = false

func _update_player(delta: float) -> void:
	var world := GameState.world
	if world.get("docked_station_id", "") != "":
		world.player.velocity = Vector2.ZERO
		world.player.fire_cooldown = maxf(float(world.player.get("fire_cooldown", 0.0)) - delta, 0.0)
		GameState.world = world
		return
	var player: Dictionary = world.player
	var stats := GameState.get_effective_player_stats()
	var move := Vector2.ZERO
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		move.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		move.y += 1.0
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		move.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		move.x += 1.0

	if move.length() > 1.0:
		move = move.normalized()

	var speed := float(stats.get("speed", player.get("speed", 260.0)))
	player.velocity = move * speed
	player.position = player.position + player.velocity * delta

	if move.length() > 0.0:
		player.rotation = lerp_angle(float(player.get("rotation", 0.0)), move.angle(), clampf(float(stats.get("turn_speed", 5.5)) * delta, 0.0, 1.0))

	player.fire_cooldown = maxf(float(player.get("fire_cooldown", 0.0)) - delta, 0.0)
	if _fire_pressed:
		_try_fire(player, stats)

	player.max_hp = float(stats.get("max_hp", player.get("max_hp", 100.0)))
	player.hp = minf(float(player.get("hp", player.max_hp)), player.max_hp)
	player.weapon_damage = float(stats.get("weapon_damage", player.get("weapon_damage", 18.0)))
	player.weapon_range = float(stats.get("weapon_range", player.get("weapon_range", 760.0)))
	world.player = player
	GameState.world = world

func _update_enemies(delta: float) -> void:
	var world := GameState.world
	if world.get("docked_station_id", "") != "":
		return
	var player_pos: Vector2 = world.player.position
	var enemies: Array = world.enemies
	for enemy in enemies:
		var enemy_data: Dictionary = enemy
		var offset: Vector2 = player_pos - enemy_data.position
		var desired: Vector2 = offset.normalized() * 120.0 if offset.length() > 0.0 else Vector2.ZERO
		enemy_data.velocity = enemy_data.velocity.lerp(desired, 0.8 * delta)
		enemy_data.position = enemy_data.position + enemy_data.velocity * delta
	world.enemies = enemies
	GameState.world = world

func _update_projectiles(delta: float) -> void:
	var world := GameState.world
	if world.get("docked_station_id", "") != "":
		return
	var projectiles: Array = []
	for projectile in world.projectiles:
		projectile.ttl -= delta
		projectile.position += projectile.velocity * delta
		if projectile.ttl <= 0.0:
			continue
		var hit := false
		for enemy in world.enemies:
			if enemy.hp <= 0.0:
				continue
			if projectile.position.distance_to(enemy.position) <= projectile.radius + enemy.radius:
				enemy.hp -= projectile.damage
				hit = true
				if enemy.id == world.selected_target_id and enemy.hp <= 0.0:
					world.selected_target_id = ""
				break
		if not hit:
			projectiles.append(projectile)
	world.projectiles = projectiles
	world.enemies = world.enemies.filter(func(enemy): return enemy.hp > 0.0)
	GameState.world = world

func _try_fire(player: Dictionary, stats: Dictionary) -> void:
	if player.fire_cooldown > 0.0:
		return
	var world := GameState.world
	var target := _get_selected_enemy()
	if target.is_empty():
		target = _get_closest_enemy()
	if target.is_empty():
		return
	if player.position.distance_to(target.position) > float(stats.get("weapon_range", GameState.get_weapon_range())):
		return

	var direction: Vector2 = (target.position - player.position).normalized()
	var projectile := {
		"position": player.position + direction * 26.0,
		"velocity": direction * 760.0,
		"ttl": 1.4,
		"radius": 6.0,
		"damage": float(stats.get("weapon_damage", GameState.get_weapon_damage()))
	}
	world.projectiles.append(projectile)
	player.fire_cooldown = 0.25
	world.player = player
	GameState.world = world

func _select_target(screen_position: Vector2) -> void:
	var world := GameState.world
	var viewport_size := get_viewport_rect().size
	var world_position: Vector2 = world.player.position + (screen_position - viewport_size / 2.0)
	var best_id := ""
	var best_distance: float = 999999.0
	for enemy in world.enemies:
		var enemy_data: Dictionary = enemy
		var distance: float = world_position.distance_to(enemy_data.position)
		if distance < best_distance and distance <= float(enemy_data.get("radius", 20.0)) + 24.0:
			best_distance = distance
			best_id = String(enemy_data.get("id", ""))
	world.selected_target_id = best_id
	GameState.world = world

func _get_selected_enemy() -> Dictionary:
	var world := GameState.world
	for enemy in world.enemies:
		if enemy.id == world.selected_target_id:
			return enemy
	return {}

func _get_closest_enemy() -> Dictionary:
	var world := GameState.world
	var best: Dictionary = {}
	var best_distance: float = 999999.0
	for enemy in world.enemies:
		var enemy_data: Dictionary = enemy
		var distance: float = enemy_data.position.distance_to(world.player.position)
		if distance < best_distance:
			best_distance = distance
			best = enemy_data
	return best

func _set_map_overlay(open: bool) -> void:
	if GameState.world.is_empty():
		return
	GameState.world["map_overlay_open"] = open
	if is_instance_valid(_map_panel) and _map_panel.has_method("set_open"):
		_map_panel.call("set_open", open)

func _map_open() -> bool:
	return not GameState.world.is_empty() and bool(GameState.world.get("map_overlay_open", false))
