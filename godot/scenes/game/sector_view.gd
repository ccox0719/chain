extends Node2D

const GRID_SPACING := 48.0

var _player_shape: PackedVector2Array
var _enemy_shapes: Dictionary = {}

func _ready() -> void:
	_player_shape = PackedVector2Array([
		Vector2(22, 0),
		Vector2(-12, -10),
		Vector2(-4, 0),
		Vector2(-12, 10)
	])
	_enemy_shapes = {
		"shard-skirmisher": PackedVector2Array([
			Vector2(18, 0),
			Vector2(-10, -8),
			Vector2(-4, 0),
			Vector2(-10, 8)
		]),
		"rift-hound": PackedVector2Array([
			Vector2(20, 0),
			Vector2(-8, -12),
			Vector2(2, -2),
			Vector2(-2, 0),
			Vector2(2, 2),
			Vector2(-8, 12)
		]),
		"static-needle": PackedVector2Array([
			Vector2(26, 0),
			Vector2(-6, -4),
			Vector2(-10, 0),
			Vector2(-6, 4)
		])
	}
	var viewport := get_viewport()
	var callback := Callable(self, "_on_viewport_size_changed")
	if viewport and not viewport.size_changed.is_connected(callback):
		viewport.size_changed.connect(callback)
	queue_redraw()

func _draw() -> void:
	var world := GameState.world
	if world.is_empty():
		return

	var viewport_size: Vector2 = get_viewport_rect().size
	var player_pos: Vector2 = world.player.position
	var half: Vector2 = viewport_size / 2.0

	draw_rect(Rect2(Vector2.ZERO, viewport_size), Color("#020611"))
	_draw_backdrop(viewport_size)
	_draw_grid(player_pos, viewport_size)

	for station in world.get("stations", []):
		var station_data: Dictionary = station
		var station_screen: Vector2 = station_data.position - player_pos + half
		var station_radius: float = float(station_data.get("radius", 36.0))
		draw_circle(station_screen, station_radius + 14.0, Color(0.24, 0.55, 0.8, 0.1))
		draw_circle(station_screen, station_radius + 6.0, Color(0.42, 0.8, 1.0, 0.14))
		draw_circle(station_screen, station_radius, Color("#84e8ff"))
		draw_circle(station_screen, station_radius * 0.55, Color("#0f2533"))
		draw_line(station_screen + Vector2(-station_radius, 0), station_screen + Vector2(station_radius, 0), Color("#d0fbff"), 2.0)
		draw_line(station_screen + Vector2(0, -station_radius), station_screen + Vector2(0, station_radius), Color("#d0fbff"), 2.0)

	for projectile in world.projectiles:
		var projectile_screen: Vector2 = projectile.position - player_pos + half
		draw_circle(projectile_screen, float(projectile.radius) + 2.0, Color(0.44, 0.93, 1.0, 0.18))
		draw_circle(projectile_screen, projectile.radius, Color("#6feeff"))

	for enemy in world.enemies:
		var enemy_data: Dictionary = enemy
		var enemy_screen: Vector2 = enemy_data.position - player_pos + half
		var enemy_radius: float = float(enemy_data.get("radius", 20.0))
		var enemy_color := Color(String(enemy_data.get("color", "#ff6a5d")))
		var enemy_shape := _enemy_shape_for_variant(String(enemy_data.get("variant_id", "")))
		var transformed := PackedVector2Array()
		for point in enemy_shape:
			transformed.append(point.rotated(float(enemy_data.get("rotation", 0.0))) + enemy_screen)
		draw_colored_polygon(transformed, Color(enemy_color.r, enemy_color.g, enemy_color.b, 0.2))
		draw_polyline(transformed, enemy_color, 2.0, true)
		draw_circle(enemy_screen, enemy_radius * 0.5, Color("#2a0d0d"))
		draw_rect(Rect2(enemy_screen + Vector2(-enemy_radius, enemy_radius + 8.0), Vector2(enemy_radius * 2.0, 4.0)), Color(1, 1, 1, 0.18))
		draw_rect(Rect2(enemy_screen + Vector2(-enemy_radius, enemy_radius + 8.0), Vector2(enemy_radius * 2.0 * clampf(float(enemy_data.get("hp", 0.0)) / maxf(float(enemy_data.get("max_hp", 1.0)), 1.0), 0.0, 1.0), 4.0)), Color("#69dfff"))

	var player_transformed := PackedVector2Array()
	for point in _player_shape:
		player_transformed.append(point + half)
	draw_colored_polygon(player_transformed, Color(0.64, 1.0, 0.32, 0.2))
	draw_polyline(player_transformed, Color("#d8ff9b"), 2.0, true)
	draw_circle(half, 18.0, Color(0.6, 1.0, 0.4, 0.08))
	draw_circle(half, 4.0, Color.WHITE)

	if world.selected_target_id != "":
		for enemy in world.enemies:
			var enemy_data: Dictionary = enemy
			if String(enemy_data.get("id", "")) != String(world.selected_target_id):
				continue
			var enemy_screen: Vector2 = enemy_data.position - player_pos + half
			draw_arc(enemy_screen, float(enemy_data.get("radius", 20.0)) + 10.0, 0.0, TAU, 32, Color("#ffe082"), 2.0)
			break

	draw_rect(Rect2(Vector2(10, 10), viewport_size - Vector2(20, 20)), Color(0, 0, 0, 0), false, 2.0)
	draw_rect(Rect2(Vector2(4, 4), viewport_size - Vector2(8, 8)), Color(0.48, 0.76, 0.93, 0.16), false, 1.0)

func _draw_backdrop(viewport_size: Vector2) -> void:
	var a_center := viewport_size * Vector2(0.25, 0.3)
	var b_center := viewport_size * Vector2(0.7, 0.58)
	draw_circle(a_center, 420.0, Color(0.21, 0.45, 0.95, 0.05))
	draw_circle(a_center, 220.0, Color(0.21, 0.45, 0.95, 0.07))
	draw_circle(b_center, 360.0, Color(0.95, 0.4, 0.28, 0.04))
	draw_circle(b_center, 180.0, Color(0.95, 0.4, 0.28, 0.06))

func _draw_grid(player_pos: Vector2, viewport_size: Vector2) -> void:
	var grid_color := Color(0.23, 0.4, 0.55, 0.28)
	var half: Vector2 = viewport_size / 2.0
	var grid_spacing: float = float(GameState.world.get("grid_size", GRID_SPACING))
	var min_world: Vector2 = player_pos - half - Vector2(grid_spacing, grid_spacing)
	var max_world: Vector2 = player_pos + half + Vector2(grid_spacing, grid_spacing)
	var start_x: float = floor(min_world.x / grid_spacing) * grid_spacing
	var start_y: float = floor(min_world.y / grid_spacing) * grid_spacing
	var x: float = start_x
	while x <= max_world.x:
		var screen_x: float = x - player_pos.x + half.x
		draw_line(Vector2(screen_x, 0), Vector2(screen_x, viewport_size.y), grid_color, 1.0)
		x += grid_spacing
	var y: float = start_y
	while y <= max_world.y:
		var screen_y: float = y - player_pos.y + half.y
		draw_line(Vector2(0, screen_y), Vector2(viewport_size.x, screen_y), grid_color, 1.0)
		y += grid_spacing

func _enemy_shape_for_variant(variant_id: String) -> PackedVector2Array:
	if _enemy_shapes.is_empty():
		return _player_shape
	return _enemy_shapes.get(variant_id, _enemy_shapes.get("shard-skirmisher", _player_shape))

func _on_viewport_size_changed() -> void:
	queue_redraw()
