extends Node

var world: Dictionary = {}
var _module_data_cache: Dictionary = {}
var _trade_goods_data_cache: Dictionary = {}

func new_game_world() -> Dictionary:
	var ship_data := ShipLoader.new().load_all()
	var sector_data := SectorLoader.new().load_all()
	var player_ship := _find_by_id(ship_data.get("ships", []), ship_data.get("default_ship_id", ""))
	var sector := _find_by_id(sector_data.get("sectors", []), sector_data.get("default_sector_id", ""))
	var sector_state := _build_sector_state(sector)

	return {
		"elapsed_time": 0.0,
		"current_sector_id": sector_state.get("id", "lumen-rest"),
		"sector_name": sector_state.get("name", "Unknown Sector"),
		"grid_size": float(sector_state.get("grid_size", 48.0)),
		"travel_destinations": Array(sector_state.get("travel_destinations", [])),
		"docked_station_id": "",
		"map_overlay_open": false,
		"selected_target_id": "",
		"player": {
			"id": player_ship.get("id", "lumen-runner"),
			"name": player_ship.get("name", "Lumen Runner"),
			"position": sector_state.get("player_start", Vector2.ZERO),
			"velocity": Vector2.ZERO,
			"rotation": 0.0,
			"thrust": 0.0,
			"base_speed": float(player_ship.get("speed", 260.0)),
			"base_turn_speed": float(player_ship.get("turn_speed", 5.5)),
			"base_weapon_range": float(player_ship.get("weapon_range", 760.0)),
			"base_weapon_damage": float(player_ship.get("weapon_damage", 18.0)),
			"base_max_hp": float(player_ship.get("max_hp", 100.0)),
			"base_weapon_hardpoints": int(player_ship.get("weapon_hardpoints", 1)),
			"base_utility_hardpoints": int(player_ship.get("utility_hardpoints", 1)),
			"base_defense_hardpoints": int(player_ship.get("defense_hardpoints", 1)),
			"base_power_capacity": float(player_ship.get("power_capacity", 100.0)),
			"base_cargo_capacity": float(player_ship.get("cargo_capacity", 20.0)),
			"speed": float(player_ship.get("speed", 260.0)),
			"turn_speed": float(player_ship.get("turn_speed", 5.5)),
			"weapon_range": float(player_ship.get("weapon_range", 760.0)),
			"weapon_damage": float(player_ship.get("weapon_damage", 18.0)),
			"fire_cooldown": 0.0,
			"max_hp": float(player_ship.get("max_hp", 100.0)),
			"hp": float(player_ship.get("max_hp", 100.0)),
			"weapon_hardpoints": int(player_ship.get("weapon_hardpoints", 1)),
			"utility_hardpoints": int(player_ship.get("utility_hardpoints", 1)),
			"defense_hardpoints": int(player_ship.get("defense_hardpoints", 1)),
			"power_capacity": float(player_ship.get("power_capacity", 100.0)),
			"power_used": 0.0,
			"power_remaining": float(player_ship.get("power_capacity", 100.0)),
			"cargo_capacity": float(player_ship.get("cargo_capacity", 20.0)),
			"cargo_used": 0.0,
			"credits": 1000
		},
		"cargo_inventory": {},
		"module_inventory": {
			"basic-laser": 1,
			"pulse-laser": 1,
			"salvage-beam": 1,
			"reinforced-plating": 1
		},
		"equipped_modules": {
			"weapon": [],
			"utility": [],
			"defense": []
		},
		"stations": sector_state.get("stations", []),
		"enemies": sector_state.get("enemies", []),
		"projectiles": [],
		"status_text": "WASD move, left click select, space fire"
	}

func reset_world(new_world: Dictionary) -> void:
	world = _apply_world_defaults(new_world)
	_sync_player_stats()

func update_world(delta: float) -> void:
	if world.is_empty():
		return
	world.elapsed_time = float(world.get("elapsed_time", 0.0)) + delta

func get_station_by_id(station_id: String) -> Dictionary:
	for station in world.get("stations", []):
		if station.get("id", "") == station_id:
			return station
	return {}

func get_nearest_station() -> Dictionary:
	var best := {}
	var best_distance := 999999.0
	if world.is_empty():
		return best
	var player_pos: Vector2 = world.player.position
	for station in world.get("stations", []):
		var distance := player_pos.distance_to(station.position)
		if distance < best_distance:
			best_distance = distance
			best = station
	return best

func can_dock_at_station(station_id: String) -> bool:
	if world.is_empty():
		return false
	var station := get_station_by_id(station_id)
	if station.is_empty():
		return false
	var player_pos: Vector2 = world.player.position
	return player_pos.distance_to(station.position) <= float(station.get("dock_radius", 88.0))

func dock_station(station_id: String) -> bool:
	if not can_dock_at_station(station_id):
		return false
	var station := get_station_by_id(station_id)
	if station.is_empty():
		return false
	world.docked_station_id = station_id
	world.player.position = station.position + Vector2(0, 32)
	world.player.velocity = Vector2.ZERO
	world.projectiles = []
	world.selected_target_id = ""
	return true

func undock_station() -> void:
	if world.is_empty():
		return
	var station := get_station_by_id(String(world.get("docked_station_id", "")))
	if not station.is_empty():
		world.player.position = station.position + Vector2(0, float(station.get("dock_radius", 88.0)) + 24.0)
	world.player.velocity = Vector2.ZERO
	world.docked_station_id = ""

func get_travel_destinations() -> Array:
	return Array(world.get("travel_destinations", []))

func travel_to_sector(sector_id: String) -> bool:
	if world.is_empty():
		return false
	if String(world.get("docked_station_id", "")) == "":
		return false
	var sector_data := SectorLoader.new().load_sector(sector_id)
	if sector_data.is_empty():
		return false
	var sector_state := _build_sector_state(sector_data)
	if sector_state.is_empty():
		return false
	world["current_sector_id"] = sector_state.get("id", sector_id)
	world["sector_name"] = sector_state.get("name", "Unknown Sector")
	world["grid_size"] = float(sector_state.get("grid_size", 48.0))
	world["travel_destinations"] = Array(sector_state.get("travel_destinations", []))
	world["stations"] = sector_state.get("stations", [])
	world["enemies"] = sector_state.get("enemies", [])
	world["projectiles"] = []
	world["selected_target_id"] = ""
	world["docked_station_id"] = ""
	world["map_overlay_open"] = false
	world["player"]["position"] = sector_state.get("player_start", Vector2.ZERO)
	world["player"]["velocity"] = Vector2.ZERO
	world["player"]["rotation"] = 0.0
	_sync_player_stats()
	return true

func get_module_definition(module_id: String) -> Dictionary:
	for module in _get_module_data().get("modules", []):
		if module.get("id", "") == module_id:
			return module
	return {}

func get_module_price(module_id: String) -> int:
	var module := get_module_definition(module_id)
	return int(module.get("price", 0))

func get_trade_good_definition(good_id: String) -> Dictionary:
	for good in _get_trade_goods_data().get("goods", []):
		if good.get("id", "") == good_id:
			return good
	return {}

func get_trade_good_price(good_id: String, station_id: String, price_type: String) -> int:
	var good := get_trade_good_definition(good_id)
	var fallback := int(good.get("base_price", 0))
	var station := get_station_by_id(station_id)
	var market: Dictionary = station.get("market", {})
	var listing: Dictionary = market.get(good_id, {})
	return int(listing.get(price_type, fallback))

func get_cargo_capacity() -> float:
	if world.is_empty():
		return 0.0
	return float(world.get("player", {}).get("cargo_capacity", 20.0))

func get_cargo_used() -> float:
	if world.is_empty():
		return 0.0
	var cargo_total := 0.0
	var cargo: Dictionary = world.get("cargo_inventory", {})
	for good_id in cargo.keys():
		var quantity := int(cargo.get(good_id, 0))
		var good := get_trade_good_definition(String(good_id))
		cargo_total += quantity * float(good.get("cargo_size", 1.0))
	return cargo_total

func get_cargo_remaining() -> float:
	return maxf(0.0, get_cargo_capacity() - get_cargo_used())

func get_cargo_count(good_id: String) -> int:
	var cargo: Dictionary = world.get("cargo_inventory", {})
	return int(cargo.get(good_id, 0))

func get_module_power_cost(module_id: String) -> float:
	var module := get_module_definition(module_id)
	return float(module.get("power_cost", 0.0))

func get_fitting_power_capacity() -> float:
	if world.is_empty():
		return 0.0
	var stats := get_effective_player_stats()
	return float(stats.get("power_capacity", world.player.get("power_capacity", 100.0)))

func get_fitting_power_used() -> float:
	if world.is_empty():
		return 0.0
	var stats := get_effective_player_stats()
	return float(stats.get("power_used", world.player.get("power_used", 0.0)))

func get_fitting_power_remaining() -> float:
	return maxf(0.0, get_fitting_power_capacity() - get_fitting_power_used())

func get_fitting_slot_capacity(slot_type: String) -> int:
	if world.is_empty():
		return 0
	var stats := get_effective_player_stats()
	return int(stats.get("%s_hardpoints" % slot_type, world.player.get("base_%s_hardpoints" % slot_type, 0)))

func get_fitting_slot_used(slot_type: String) -> int:
	return get_equipped_modules(slot_type).size()

func get_fitting_slot_summary() -> String:
	return "W %d/%d  U %d/%d  D %d/%d" % [
		get_fitting_slot_used("weapon"),
		get_fitting_slot_capacity("weapon"),
		get_fitting_slot_used("utility"),
		get_fitting_slot_capacity("utility"),
		get_fitting_slot_used("defense"),
		get_fitting_slot_capacity("defense")
	]

func can_equip_module(module_id: String) -> bool:
	var slot_type := get_module_slot_type(module_id)
	if slot_type == "":
		return false
	if get_fitting_slot_used(slot_type) >= get_fitting_slot_capacity(slot_type):
		return false
	return get_module_power_cost(module_id) <= get_fitting_power_remaining()

func get_effective_player_stats() -> Dictionary:
	if world.is_empty():
		return {}
	var player: Dictionary = world.get("player", {})
	var speed_bonus := 0.0
	var max_hp_bonus := 0.0
	var weapon_damage_bonus := 0.0
	var weapon_range_bonus := 0.0
	var turn_speed_bonus := 0.0
	var power_capacity_bonus := 0.0
	var weapon_hardpoint_bonus := 0.0
	var utility_hardpoint_bonus := 0.0
	var defense_hardpoint_bonus := 0.0
	var power_used := 0.0
	var base_weapon_damage := float(player.get("base_weapon_damage", 18.0))
	var base_weapon_range := float(player.get("base_weapon_range", 760.0))
	var weapon_damage_total := base_weapon_damage
	var weapon_range_total := base_weapon_range

	for slot_type in ["weapon", "utility", "defense"]:
		for module_id in get_equipped_modules(slot_type):
			var module := get_module_definition(String(module_id))
			if module.is_empty():
				continue
			speed_bonus += float(module.get("speed_bonus", 0.0))
			max_hp_bonus += float(module.get("max_hp_bonus", 0.0))
			weapon_damage_bonus += float(module.get("weapon_damage_bonus", 0.0))
			weapon_range_bonus += float(module.get("weapon_range_bonus", 0.0))
			turn_speed_bonus += float(module.get("turn_speed_bonus", 0.0))
			power_capacity_bonus += float(module.get("power_capacity_bonus", 0.0))
			power_used += float(module.get("power_cost", 0.0))
			weapon_hardpoint_bonus += float(module.get("weapon_hardpoint_bonus", 0.0))
			utility_hardpoint_bonus += float(module.get("utility_hardpoint_bonus", 0.0))
			defense_hardpoint_bonus += float(module.get("defense_hardpoint_bonus", 0.0))
			if slot_type == "weapon":
				weapon_damage_total += float(module.get("damage", 0.0))
				weapon_range_total = maxf(weapon_range_total, float(module.get("range", weapon_range_total)))

	return {
		"speed": maxf(0.0, float(player.get("base_speed", 260.0)) + speed_bonus),
		"turn_speed": maxf(0.0, float(player.get("base_turn_speed", 5.5)) + turn_speed_bonus),
		"max_hp": maxf(1.0, float(player.get("base_max_hp", 100.0)) + max_hp_bonus),
		"weapon_damage": maxf(1.0, weapon_damage_total + weapon_damage_bonus),
		"weapon_range": maxf(1.0, weapon_range_total + weapon_range_bonus),
		"power_capacity": maxf(1.0, float(player.get("base_power_capacity", 100.0)) + power_capacity_bonus),
		"power_used": maxf(0.0, power_used),
		"cargo_capacity": maxf(1.0, float(player.get("base_cargo_capacity", 20.0))),
		"cargo_used": maxf(0.0, get_cargo_used()),
		"weapon_hardpoints": max(0, int(player.get("base_weapon_hardpoints", 1)) + int(weapon_hardpoint_bonus)),
		"utility_hardpoints": max(0, int(player.get("base_utility_hardpoints", 1)) + int(utility_hardpoint_bonus)),
		"defense_hardpoints": max(0, int(player.get("base_defense_hardpoints", 1)) + int(defense_hardpoint_bonus))
	}

func get_equipped_modules(slot_type: String) -> Array:
	var equipped: Dictionary = world.get("equipped_modules", {})
	return Array(equipped.get(slot_type, []))

func get_inventory_count(module_id: String) -> int:
	var inventory: Dictionary = world.get("module_inventory", {})
	return int(inventory.get(module_id, 0))

func get_module_slot_type(module_id: String) -> String:
	var module := get_module_definition(module_id)
	var kind := String(module.get("kind", ""))
	if kind == "laser" or kind == "railgun" or kind == "missile":
		return "weapon"
	if kind == "utility":
		return "utility"
	if kind == "defense":
		return "defense"
	return ""

func equip_module(module_id: String) -> bool:
	if world.is_empty():
		return false
	var inventory: Dictionary = world.get("module_inventory", {})
	var count := int(inventory.get(module_id, 0))
	if count <= 0:
		return false
	if not can_equip_module(module_id):
		return false
	var slot_type := get_module_slot_type(module_id)
	var equipped: Dictionary = world.get("equipped_modules", {})
	var slot_modules: Array = Array(equipped.get(slot_type, []))
	inventory[module_id] = count - 1
	slot_modules.append(module_id)
	equipped[slot_type] = slot_modules
	world.module_inventory = inventory
	world.equipped_modules = equipped
	_sync_player_stats()
	return true

func buy_module(module_id: String) -> bool:
	if world.is_empty():
		return false
	var module := get_module_definition(module_id)
	if module.is_empty():
		return false
	var price := get_module_price(module_id)
	if int(world.player.get("credits", 0)) < price:
		return false
	var inventory: Dictionary = world.get("module_inventory", {})
	inventory[module_id] = int(inventory.get(module_id, 0)) + 1
	world.module_inventory = inventory
	world.player.credits = int(world.player.get("credits", 0)) - price
	_sync_player_stats()
	return true

func buy_trade_good(good_id: String) -> bool:
	if world.is_empty():
		return false
	var station_id := String(world.get("docked_station_id", ""))
	if station_id == "":
		return false
	var good := get_trade_good_definition(good_id)
	if good.is_empty():
		return false
	var cargo_size := float(good.get("cargo_size", 1.0))
	if cargo_size > get_cargo_remaining():
		return false
	var price := get_trade_good_price(good_id, station_id, "buy_price")
	if int(world.player.get("credits", 0)) < price:
		return false
	var cargo: Dictionary = world.get("cargo_inventory", {})
	cargo[good_id] = int(cargo.get(good_id, 0)) + 1
	world.cargo_inventory = cargo
	world.player.credits = int(world.player.get("credits", 0)) - price
	_sync_player_stats()
	return true

func sell_module(module_id: String) -> bool:
	if world.is_empty():
		return false
	var inventory: Dictionary = world.get("module_inventory", {})
	var count := int(inventory.get(module_id, 0))
	if count <= 0:
		return false
	var price: int = max(1, int(get_module_price(module_id) * 0.5))
	inventory[module_id] = count - 1
	world.module_inventory = inventory
	world.player.credits = int(world.player.get("credits", 0)) + price
	_sync_player_stats()
	return true

func sell_trade_good(good_id: String) -> bool:
	if world.is_empty():
		return false
	var station_id := String(world.get("docked_station_id", ""))
	if station_id == "":
		return false
	var cargo: Dictionary = world.get("cargo_inventory", {})
	var quantity := int(cargo.get(good_id, 0))
	if quantity <= 0:
		return false
	var price := get_trade_good_price(good_id, station_id, "sell_price")
	cargo[good_id] = quantity - 1
	world.cargo_inventory = cargo
	world.player.credits = int(world.player.get("credits", 0)) + price
	_sync_player_stats()
	return true

func unequip_module(slot_type: String, slot_index: int = 0) -> bool:
	if world.is_empty():
		return false
	var equipped: Dictionary = world.get("equipped_modules", {})
	var slot_modules: Array = Array(equipped.get(slot_type, []))
	if slot_index < 0 or slot_index >= slot_modules.size():
		return false
	var module_id := String(slot_modules[slot_index])
	if module_id == "":
		return false
	var inventory: Dictionary = world.get("module_inventory", {})
	inventory[module_id] = int(inventory.get(module_id, 0)) + 1
	slot_modules.remove_at(slot_index)
	equipped[slot_type] = slot_modules
	world.module_inventory = inventory
	world.equipped_modules = equipped
	_sync_player_stats()
	return true

func get_weapon_module_id() -> String:
	var weapon_slots := get_equipped_modules("weapon")
	if weapon_slots.is_empty():
		return ""
	var best_module_id := String(weapon_slots[0])
	var best_damage := float(get_module_definition(best_module_id).get("damage", 0.0))
	for module_id in weapon_slots:
		var module := get_module_definition(String(module_id))
		var damage := float(module.get("damage", 0.0))
		if damage > best_damage:
			best_damage = damage
			best_module_id = String(module_id)
	return best_module_id

func get_weapon_damage() -> float:
	return float(world.get("player", {}).get("weapon_damage", 18.0))

func get_weapon_range() -> float:
	return float(world.get("player", {}).get("weapon_range", 760.0))

func _get_module_data() -> Dictionary:
	if _module_data_cache.is_empty():
		_module_data_cache = ModuleLoader.new().load_all()
	return _module_data_cache

func _get_trade_goods_data() -> Dictionary:
	if _trade_goods_data_cache.is_empty():
		_trade_goods_data_cache = TradeGoodLoader.new().load_all()
	return _trade_goods_data_cache

func _build_sector_state(sector: Dictionary) -> Dictionary:
	if sector.is_empty():
		return {}
	var enemy_data := EnemyLoader.new().load_all()
	var enemies_by_id := _index_by_id(enemy_data.get("variants", []))
	var station_states := []
	for entry in sector.get("stations", []):
		station_states.append({
			"id": entry.get("id", ""),
			"name": entry.get("name", "Station"),
			"position": _vec2_from(entry.get("position", {}), Vector2.ZERO),
			"radius": float(entry.get("radius", 36.0)),
			"dock_radius": float(entry.get("dock_radius", 88.0)),
			"market": Dictionary(entry.get("market", {})).duplicate(true)
		})
	var enemy_states := []
	for entry in sector.get("enemies", []):
		var variant: Dictionary = enemies_by_id.get(entry.get("variant_id", ""), {})
		enemy_states.append({
			"id": entry.get("id", ""),
			"variant_id": entry.get("variant_id", ""),
			"name": variant.get("name", entry.get("id", "Enemy")),
			"position": _vec2_from(entry.get("position", {}), Vector2.ZERO),
			"velocity": _vec2_from(variant.get("velocity", {}), Vector2.ZERO),
			"hp": float(variant.get("max_hp", 50.0)),
			"max_hp": float(variant.get("max_hp", 50.0)),
			"radius": float(variant.get("radius", 20.0)),
			"color": String(variant.get("color", "#ff6a5d"))
		})
	return {
		"id": sector.get("id", ""),
		"name": sector.get("name", "Unknown Sector"),
		"grid_size": float(sector.get("grid", 48.0)),
		"player_start": _vec2_from(sector.get("player_start", {}), Vector2.ZERO),
		"travel_destinations": Array(sector.get("travel_destinations", [])),
		"stations": station_states,
		"enemies": enemy_states
	}

func _find_by_id(items: Array, item_id: String) -> Dictionary:
	for item in items:
		if item.get("id", "") == item_id:
			return item
	return items[0] if items.size() > 0 else {}

func _index_by_id(items: Array) -> Dictionary:
	var indexed: Dictionary = {}
	for item in items:
		var item_id := String(item.get("id", ""))
		if item_id != "":
			indexed[item_id] = item
	return indexed

func _vec2_from(value: Variant, fallback: Vector2) -> Vector2:
	if value is Vector2:
		return value
	if value is Dictionary:
		return Vector2(float(value.get("x", fallback.x)), float(value.get("y", fallback.y)))
	return fallback

func _apply_world_defaults(source: Dictionary) -> Dictionary:
	var defaults := new_game_world()
	var merged := defaults.duplicate(true)
	merged.merge(source, true)
	var source_player: Dictionary = source.get("player", {})
	var player_defaults: Dictionary = defaults.get("player", {})
	var merged_player := player_defaults.duplicate(true)
	merged_player.merge(source_player, true)
	merged["player"] = merged_player
	if not source.has("module_inventory"):
		merged["module_inventory"] = defaults.get("module_inventory", {}).duplicate(true)
	if not source.has("cargo_inventory"):
		merged["cargo_inventory"] = defaults.get("cargo_inventory", {}).duplicate(true)
	if not source.has("equipped_modules"):
		merged["equipped_modules"] = defaults.get("equipped_modules", {}).duplicate(true)
	if not source.has("stations"):
		merged["stations"] = defaults.get("stations", []).duplicate(true)
	if not source.has("enemies"):
		merged["enemies"] = defaults.get("enemies", []).duplicate(true)
	if not source.has("projectiles"):
		merged["projectiles"] = []
	if not source.has("docked_station_id"):
		merged["docked_station_id"] = ""
	if not source.has("map_overlay_open"):
		merged["map_overlay_open"] = false
	if not source.has("grid_size"):
		merged["grid_size"] = defaults.get("grid_size", 48.0)
	if not source.has("sector_name"):
		merged["sector_name"] = defaults.get("sector_name", "Unknown Sector")
	if not source.has("travel_destinations"):
		merged["travel_destinations"] = defaults.get("travel_destinations", []).duplicate(true)
	if not merged["player"].has("base_speed"):
		merged["player"]["base_speed"] = defaults.get("player", {}).get("base_speed", 260.0)
	if not merged["player"].has("base_turn_speed"):
		merged["player"]["base_turn_speed"] = defaults.get("player", {}).get("base_turn_speed", 5.5)
	if not merged["player"].has("base_weapon_range"):
		merged["player"]["base_weapon_range"] = defaults.get("player", {}).get("base_weapon_range", 760.0)
	if not merged["player"].has("base_weapon_damage"):
		merged["player"]["base_weapon_damage"] = defaults.get("player", {}).get("base_weapon_damage", 18.0)
	if not merged["player"].has("base_max_hp"):
		merged["player"]["base_max_hp"] = defaults.get("player", {}).get("base_max_hp", 100.0)
	if not merged["player"].has("base_weapon_hardpoints"):
		merged["player"]["base_weapon_hardpoints"] = defaults.get("player", {}).get("base_weapon_hardpoints", 1)
	if not merged["player"].has("base_utility_hardpoints"):
		merged["player"]["base_utility_hardpoints"] = defaults.get("player", {}).get("base_utility_hardpoints", 1)
	if not merged["player"].has("base_defense_hardpoints"):
		merged["player"]["base_defense_hardpoints"] = defaults.get("player", {}).get("base_defense_hardpoints", 1)
	if not merged["player"].has("base_power_capacity"):
		merged["player"]["base_power_capacity"] = defaults.get("player", {}).get("base_power_capacity", 100.0)
	if not merged["player"].has("base_cargo_capacity"):
		merged["player"]["base_cargo_capacity"] = defaults.get("player", {}).get("base_cargo_capacity", 20.0)
	if not merged["player"].has("credits"):
		merged["player"]["credits"] = 1000
	return merged

func _sync_player_stats() -> void:
	if world.is_empty():
		return
	var stats := get_effective_player_stats()
	if stats.is_empty():
		return
	world["player"]["speed"] = float(stats.get("speed", world.player.get("speed", 260.0)))
	world["player"]["turn_speed"] = float(stats.get("turn_speed", world.player.get("turn_speed", 5.5)))
	world["player"]["max_hp"] = float(stats.get("max_hp", world.player.get("max_hp", 100.0)))
	world["player"]["hp"] = minf(float(world.player.get("hp", world.player.max_hp)), float(world["player"]["max_hp"]))
	world["player"]["weapon_damage"] = float(stats.get("weapon_damage", world.player.get("weapon_damage", 18.0)))
	world["player"]["weapon_range"] = float(stats.get("weapon_range", world.player.get("weapon_range", 760.0)))
	world["player"]["weapon_hardpoints"] = int(stats.get("weapon_hardpoints", world.player.get("weapon_hardpoints", world.player.get("base_weapon_hardpoints", 1))))
	world["player"]["utility_hardpoints"] = int(stats.get("utility_hardpoints", world.player.get("utility_hardpoints", world.player.get("base_utility_hardpoints", 1))))
	world["player"]["defense_hardpoints"] = int(stats.get("defense_hardpoints", world.player.get("defense_hardpoints", world.player.get("base_defense_hardpoints", 1))))
	world["player"]["power_capacity"] = float(stats.get("power_capacity", world.player.get("power_capacity", 100.0)))
	world["player"]["power_used"] = float(stats.get("power_used", world.player.get("power_used", 0.0)))
	world["player"]["power_remaining"] = maxf(0.0, float(world["player"]["power_capacity"]) - float(world["player"]["power_used"]))
	world["player"]["cargo_capacity"] = float(stats.get("cargo_capacity", world.player.get("cargo_capacity", 20.0)))
	world["player"]["cargo_used"] = float(stats.get("cargo_used", get_cargo_used()))
