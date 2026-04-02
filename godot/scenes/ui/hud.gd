extends CanvasLayer

const PANEL_BG := Color(0.03, 0.06, 0.12, 0.88)
const PANEL_EDGE := Color(0.34, 0.52, 0.78, 0.2)
const PANEL_EDGE_BRIGHT := Color(0.5, 0.74, 1.0, 0.26)
const TEXT_COLOR := Color(0.93, 0.97, 1.0, 1.0)
const TEXT_MUTED := Color(0.59, 0.7, 0.84, 1.0)
const ACCENT := Color(0.5, 0.76, 1.0, 1.0)
const ACCENT_ALT := Color(1.0, 0.74, 0.5, 1.0)
const GOOD := Color(0.55, 0.88, 0.68, 1.0)
var _system_label: Label
var _ship_label: Label
var _status_label: Label
var _hp_bar: ProgressBar
var _power_bar: ProgressBar
var _cargo_bar: ProgressBar
var _overview_title: Label
var _overview_body: Label
var _target_label: Label
var _contacts_box: VBoxContainer
var _module_summary: Label
var _dock_hint: Label

func _ready() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	root.add_child(_build_system_badge())

	var top_wrap := Control.new()
	top_wrap.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top_wrap.offset_left = 16
	top_wrap.offset_top = 56
	top_wrap.offset_right = -16
	top_wrap.offset_bottom = 278
	root.add_child(top_wrap)

	var top_row := HBoxContainer.new()
	top_row.set_anchors_preset(Control.PRESET_FULL_RECT)
	top_row.add_theme_constant_override("separation", 12)
	top_wrap.add_child(top_row)

	top_row.add_child(_build_pilot_card())
	top_row.add_child(_build_overview_card())

	var bottom_wrap := Control.new()
	bottom_wrap.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom_wrap.offset_left = 16
	bottom_wrap.offset_right = -16
	bottom_wrap.offset_bottom = -16
	bottom_wrap.offset_top = -116
	root.add_child(bottom_wrap)

	var bottom_panel := PanelContainer.new()
	bottom_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	bottom_panel.add_theme_stylebox_override("panel", _make_stylebox(PANEL_BG, PANEL_EDGE))
	bottom_wrap.add_child(bottom_panel)

	var bottom_margin := MarginContainer.new()
	bottom_margin.add_theme_constant_override("margin_left", 14)
	bottom_margin.add_theme_constant_override("margin_top", 12)
	bottom_margin.add_theme_constant_override("margin_right", 14)
	bottom_margin.add_theme_constant_override("margin_bottom", 12)
	bottom_panel.add_child(bottom_margin)

	var bottom_root := VBoxContainer.new()
	bottom_root.add_theme_constant_override("separation", 7)
	bottom_margin.add_child(bottom_root)

	var module_header := Label.new()
	module_header.text = "MODULE RAIL"
	_style_section(module_header, ACCENT_ALT)
	bottom_root.add_child(module_header)

	_module_summary = Label.new()
	_style_body(_module_summary, TEXT_COLOR, 13)
	_module_summary.autowrap_mode = TextServer.AUTOWRAP_OFF
	bottom_root.add_child(_module_summary)

	var hint_row := HBoxContainer.new()
	hint_row.add_theme_constant_override("separation", 10)
	bottom_root.add_child(hint_row)

	_dock_hint = Label.new()
	_style_body(_dock_hint, TEXT_MUTED, 12)
	_dock_hint.autowrap_mode = TextServer.AUTOWRAP_OFF
	_dock_hint.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hint_row.add_child(_dock_hint)

	_refresh()

func _process(_delta: float) -> void:
	if GameState.world.is_empty():
		return
	_refresh()

func _refresh() -> void:
	if GameState.world.is_empty():
		return

	var world: Dictionary = GameState.world
	var player: Dictionary = world.player
	var stats: Dictionary = GameState.get_effective_player_stats()
	var docked_station := String(world.get("docked_station_id", ""))
	var sector_name := String(world.get("sector_name", "Unknown Sector"))
	var region_name := String(world.get("sector_region", "Inner Reach"))
	var weapon_name := _get_weapon_name()
	var target_name := _get_target_name(world)
	var route_text := "Routes: %s" % ", ".join(GameState.get_travel_destinations()) if docked_station != "" else "Routes: unavailable"
	var dock_text := "Docked at %s" % _get_station_name(docked_station) if docked_station != "" else "Press E near a station to dock"
	var ship_name := String(player.get("name", world.get("player_ship_name", "Pilot Ship")))
	var speed_value := int(stats.get("speed", player.get("speed", 260.0)))
	var weapon_damage := int(stats.get("weapon_damage", player.get("weapon_damage", 18.0)))
	var weapon_range := int(stats.get("weapon_range", player.get("weapon_range", 760.0)))
	var max_hp: float = maxf(1.0, float(stats.get("max_hp", player.max_hp)))
	var current_hp: float = clampf(float(player.get("hp", max_hp)), 0.0, max_hp)
	var power_used: float = maxf(0.0, float(stats.get("power_used", 0.0)))
	var power_capacity: float = maxf(1.0, float(stats.get("power_capacity", 1.0)))
	var cargo_used: float = maxf(0.0, float(GameState.get_cargo_used()))
	var cargo_capacity: float = maxf(1.0, float(GameState.get_cargo_capacity()))
	var cargo_ratio: float = cargo_used / cargo_capacity
	var power_ratio: float = power_used / power_capacity
	var hp_ratio: float = current_hp / max_hp

	_system_label.text = "%s | %s" % [sector_name, region_name]
	_ship_label.text = ship_name
	_status_label.text = "Weapon: %s  Cr %d  SPD %d  DMG %d  RNG %d\nHP %d/%d  PWR %d/%d  Cargo %d/%d  %s" % [
		weapon_name,
		int(player.get("credits", 0)),
		speed_value,
		weapon_damage,
		weapon_range,
		int(current_hp),
		int(max_hp),
		int(power_used),
		int(power_capacity),
		int(cargo_used),
		int(cargo_capacity),
		GameState.get_fitting_slot_summary()
	]
	_hp_bar.value = hp_ratio * 100.0
	_power_bar.value = power_ratio * 100.0
	_cargo_bar.value = cargo_ratio * 100.0
	_overview_title.text = target_name
	_overview_body.text = "%s\nEnemies: %d\nSlots: %s" % [
		dock_text,
		world.enemies.size(),
		GameState.get_fitting_slot_summary()
	]
	_target_label.text = route_text
	_module_summary.text = "Modules: %s" % GameState.get_fitting_slot_summary()
	_dock_hint.text = dock_text

	_clear_children(_contacts_box)
	_add_contact_chip("Station", _get_nearest_station_line(world))
	_add_contact_chip("Target", target_name)
	_add_contact_chip("Hostiles", str(world.enemies.size()))
	var route_status := "Connected" if GameState.get_travel_destinations().size() > 0 else "No links"
	_add_contact_chip("Route", route_status)

func _build_system_badge() -> Control:
	var wrap := CenterContainer.new()
	wrap.set_anchors_preset(Control.PRESET_TOP_WIDE)
	wrap.offset_left = 0
	wrap.offset_top = 14
	wrap.offset_right = 0
	wrap.offset_bottom = 48

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(320, 30)
	panel.add_theme_stylebox_override("panel", _make_stylebox(Color(0.04, 0.08, 0.16, 0.84), PANEL_EDGE_BRIGHT))
	wrap.add_child(panel)

	_system_label = Label.new()
	_system_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_system_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_system_label.add_theme_color_override("font_color", ACCENT)
	_system_label.add_theme_font_size_override("font_size", 13)
	_system_label.text = "SYSTEM"
	panel.add_child(_system_label)

	return wrap

func _build_pilot_card() -> PanelContainer:
	var panel := _card_shell(Vector2(360, 220), "Pilot Card", ACCENT_ALT)
	var body := _card_body(panel)

	_ship_label = Label.new()
	_style_title(_ship_label, TEXT_COLOR, 18)
	body.add_child(_ship_label)

	_status_label = Label.new()
	_style_body(_status_label, TEXT_MUTED, 13)
	body.add_child(_status_label)

	_hp_bar = _add_bar_row(body, "Hull", GOOD)
	_power_bar = _add_bar_row(body, "Power", ACCENT)
	_cargo_bar = _add_bar_row(body, "Cargo", ACCENT_ALT)

	return panel

func _build_overview_card() -> PanelContainer:
	var panel := _card_shell(Vector2(360, 220), "Overview", ACCENT)
	var body := _card_body(panel)

	_overview_title = Label.new()
	_style_title(_overview_title, TEXT_COLOR, 16)
	body.add_child(_overview_title)

	_overview_body = Label.new()
	_style_body(_overview_body, TEXT_MUTED, 13)
	body.add_child(_overview_body)

	_target_label = Label.new()
	_style_section(_target_label, ACCENT_ALT)
	body.add_child(_target_label)

	_contacts_box = VBoxContainer.new()
	_contacts_box.add_theme_constant_override("separation", 4)
	body.add_child(_contacts_box)

	return panel

func _card_shell(size: Vector2, title: String, border: Color) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = size
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", _make_stylebox(PANEL_BG, border))

	var margin := MarginContainer.new()
	margin.name = "Margin"
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 12)
	panel.add_child(margin)

	var body := VBoxContainer.new()
	body.name = "Body"
	body.add_theme_constant_override("separation", 6)
	margin.add_child(body)

	var header := Label.new()
	header.text = title.to_upper()
	_style_section(header, ACCENT_ALT)
	body.add_child(header)

	return panel

func _card_body(panel: PanelContainer) -> VBoxContainer:
	var margin := panel.get_node("Margin") as MarginContainer
	return margin.get_node("Body") as VBoxContainer

func _add_bar_row(parent: VBoxContainer, title: String, color: Color) -> ProgressBar:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	parent.add_child(row)

	var label := Label.new()
	label.text = title
	_style_inline(label, TEXT_MUTED, 11)
	label.custom_minimum_size = Vector2(44, 0)
	row.add_child(label)

	var bar := ProgressBar.new()
	bar.min_value = 0.0
	bar.max_value = 100.0
	bar.value = 0.0
	bar.show_percentage = false
	bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.custom_minimum_size = Vector2(0, 8)
	bar.add_theme_stylebox_override("background", _make_bar_style(Color(1, 1, 1, 0.06)))
	bar.add_theme_stylebox_override("fill", _make_bar_style(color))
	row.add_child(bar)

	return bar

func _make_bar_style(color: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.corner_radius_top_left = 999
	style.corner_radius_top_right = 999
	style.corner_radius_bottom_left = 999
	style.corner_radius_bottom_right = 999
	return style

func _add_contact_chip(kind: String, value: String) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_contacts_box.add_child(row)

	var chip := Label.new()
	chip.text = kind
	_style_chip(chip, ACCENT_ALT)
	chip.custom_minimum_size = Vector2(64, 0)
	row.add_child(chip)

	var value_label := Label.new()
	value_label.text = value
	_style_inline(value_label, TEXT_COLOR, 12)
	value_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(value_label)

func _get_nearest_station_line(world: Dictionary) -> String:
	var nearest := GameState.get_nearest_station()
	if nearest.is_empty():
		return "No station in range"
	var station_name := String(nearest.get("name", "Station"))
	var distance := int(world.player.position.distance_to(nearest.position))
	return "%s (%d m)" % [station_name, distance]

func _clear_children(node: Node) -> void:
	for child in node.get_children():
		child.queue_free()

func _get_target_name(world: Dictionary) -> String:
	if String(world.get("selected_target_id", "")) == "":
		return "Target: none"
	for enemy in world.get("enemies", []):
		if String(enemy.get("id", "")) == String(world.get("selected_target_id", "")):
			return "Target: %s" % String(enemy.get("name", enemy.get("id", "none")))
	return "Target: none"

func _get_station_name(station_id: String) -> String:
	if station_id == "":
		return "none"
	for station in GameState.world.get("stations", []):
		if String(station.get("id", "")) == station_id:
			return String(station.get("name", station_id))
	return station_id

func _get_weapon_name() -> String:
	var weapon_id := GameState.get_weapon_module_id()
	if weapon_id == "":
		return "Base Ship"
	var module := GameState.get_module_definition(weapon_id)
	return String(module.get("name", weapon_id))

func _style_section(label: Label, color: Color) -> void:
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", 12)

func _style_title(label: Label, color: Color, size: int) -> void:
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", size)

func _style_body(label: Label, color: Color, size: int) -> void:
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", size)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

func _style_inline(label: Label, color: Color, size: int) -> void:
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", size)
	label.autowrap_mode = TextServer.AUTOWRAP_OFF

func _style_chip(label: Label, color: Color) -> void:
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", 11)
	label.add_theme_constant_override("line_spacing", 1)
	label.autowrap_mode = TextServer.AUTOWRAP_OFF

func _make_stylebox(fill: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	style.shadow_color = Color(0, 0, 0, 0.28)
	style.shadow_size = 8
	style.shadow_offset = Vector2(0, 2)
	style.content_margin_left = 2
	style.content_margin_top = 2
	style.content_margin_right = 2
	style.content_margin_bottom = 2
	return style
