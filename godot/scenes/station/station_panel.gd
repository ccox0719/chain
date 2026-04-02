extends CanvasLayer

const PANEL_BG := Color(0.03, 0.06, 0.12, 0.9)
const PANEL_EDGE := Color(0.32, 0.5, 0.74, 0.2)
const PANEL_EDGE_BRIGHT := Color(0.5, 0.74, 1.0, 0.28)
const TEXT_COLOR := Color(0.94, 0.97, 1.0, 1.0)
const TEXT_MUTED := Color(0.59, 0.7, 0.84, 1.0)
const ACCENT := Color(0.5, 0.76, 1.0, 1.0)
const ACCENT_ALT := Color(1.0, 0.74, 0.5, 1.0)
const GOOD := Color(0.55, 0.88, 0.68, 1.0)

var _panel: PanelContainer
var _title_label: Label
var _status_label: Label
var _credits_label: Label
var _route_label: Label
var _equipped_box: VBoxContainer
var _inventory_box: VBoxContainer
var _market_box: VBoxContainer
var _action_box: HBoxContainer

func _ready() -> void:
	_panel = PanelContainer.new()
	_panel.visible = false
	_panel.position = Vector2(188, 54)
	_panel.size = Vector2(1224, 780)
	_panel.add_theme_stylebox_override("panel", _make_stylebox(PANEL_BG, PANEL_EDGE))
	add_child(_panel)

	var shell_margin := MarginContainer.new()
	shell_margin.add_theme_constant_override("margin_left", 16)
	shell_margin.add_theme_constant_override("margin_top", 16)
	shell_margin.add_theme_constant_override("margin_right", 16)
	shell_margin.add_theme_constant_override("margin_bottom", 16)
	_panel.add_child(shell_margin)

	var shell := VBoxContainer.new()
	shell.add_theme_constant_override("separation", 12)
	shell_margin.add_child(shell)

	var header := PanelContainer.new()
	header.add_theme_stylebox_override("panel", _make_stylebox(Color(0.04, 0.08, 0.16, 0.9), PANEL_EDGE_BRIGHT))
	shell.add_child(header)

	var header_margin := MarginContainer.new()
	header_margin.add_theme_constant_override("margin_left", 16)
	header_margin.add_theme_constant_override("margin_top", 12)
	header_margin.add_theme_constant_override("margin_right", 16)
	header_margin.add_theme_constant_override("margin_bottom", 12)
	header.add_child(header_margin)

	var header_root := VBoxContainer.new()
	header_root.add_theme_constant_override("separation", 6)
	header_margin.add_child(header_root)

	var header_top := HBoxContainer.new()
	header_top.add_theme_constant_override("separation", 12)
	header_root.add_child(header_top)

	var title_block := VBoxContainer.new()
	title_block.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_block.add_theme_constant_override("separation", 2)
	header_top.add_child(title_block)

	_title_label = Label.new()
	_title_label.text = "Station"
	_style_title(_title_label, ACCENT_ALT, 20)
	title_block.add_child(_title_label)

	_status_label = Label.new()
	_status_label.text = ""
	_style_body(_status_label, TEXT_MUTED, 13)
	title_block.add_child(_status_label)

	var stats_block := VBoxContainer.new()
	stats_block.size_flags_horizontal = Control.SIZE_SHRINK_END
	stats_block.alignment = BoxContainer.ALIGNMENT_END
	stats_block.add_theme_constant_override("separation", 4)
	header_top.add_child(stats_block)

	_credits_label = Label.new()
	_style_chip(_credits_label, ACCENT, "Credits")
	stats_block.add_child(_credits_label)

	_route_label = Label.new()
	_style_chip(_route_label, GOOD, "Routes")
	stats_block.add_child(_route_label)

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 12)
	shell.add_child(body)

	var equip_panel := _build_card("Fitting")
	equip_panel.custom_minimum_size = Vector2(560, 560)
	body.add_child(equip_panel)

	var equip_root := _get_card_body(equip_panel)
	_equipped_box = VBoxContainer.new()
	_equipped_box.add_theme_constant_override("separation", 7)
	equip_root.add_child(_equipped_box)

	var inventory_panel := _build_card("Inventory and Market")
	inventory_panel.custom_minimum_size = Vector2(560, 560)
	body.add_child(inventory_panel)

	var inventory_root := _get_card_body(inventory_panel)
	_market_box = VBoxContainer.new()
	_market_box.add_theme_constant_override("separation", 7)
	inventory_root.add_child(_market_box)

	_inventory_box = VBoxContainer.new()
	_inventory_box.add_theme_constant_override("separation", 7)
	inventory_root.add_child(_inventory_box)

	var action_panel := PanelContainer.new()
	action_panel.add_theme_stylebox_override("panel", _make_stylebox(Color(0.04, 0.08, 0.16, 0.82), PANEL_EDGE))
	shell.add_child(action_panel)

	var action_margin := MarginContainer.new()
	action_margin.add_theme_constant_override("margin_left", 14)
	action_margin.add_theme_constant_override("margin_top", 10)
	action_margin.add_theme_constant_override("margin_right", 14)
	action_margin.add_theme_constant_override("margin_bottom", 10)
	action_panel.add_child(action_margin)

	_action_box = HBoxContainer.new()
	_action_box.add_theme_constant_override("separation", 10)
	action_margin.add_child(_action_box)

	_refresh()

func _process(_delta: float) -> void:
	var docked := String(GameState.world.get("docked_station_id", "")) != ""
	_panel.visible = docked
	if docked:
		_refresh()

func _refresh() -> void:
	if GameState.world.is_empty():
		return

	var world: Dictionary = GameState.world
	var station_name := "Docked"
	var docked_station := String(world.get("docked_station_id", ""))
	for station in world.get("stations", []):
		if String(station.get("id", "")) == docked_station:
			station_name = String(station.get("name", "Station"))
			break

	_title_label.text = station_name
	_status_label.text = "Manage fitting, cargo, and routes from the station bay."
	_credits_label.text = "Credits: %d" % int(world.player.get("credits", 0))
	_route_label.text = "Cargo %d/%d | Routes %s" % [
		int(GameState.get_cargo_used()),
		int(GameState.get_cargo_capacity()),
		", ".join(GameState.get_travel_destinations()) if docked_station != "" else "none"
	]

	_clear_children(_equipped_box)
	_clear_children(_market_box)
	_clear_children(_inventory_box)
	_clear_children(_action_box)

	_add_equipped_slot("weapon", "Weapon")
	_add_equipped_slot("utility", "Utility")
	_add_equipped_slot("defense", "Defense")

	var stats := GameState.get_effective_player_stats()
	var stats_row := Label.new()
	stats_row.text = "Ship stats  SPD %d  HP %d  DMG %d  RNG %d  PWR %d/%d  SLOTS %s" % [
		int(stats.get("speed", 0.0)),
		int(stats.get("max_hp", 0.0)),
		int(stats.get("weapon_damage", 0.0)),
		int(stats.get("weapon_range", 0.0)),
		int(stats.get("power_used", 0.0)),
		int(stats.get("power_capacity", 0.0)),
		GameState.get_fitting_slot_summary()
	]
	_style_body(stats_row, TEXT_MUTED, 12)
	_equipped_box.add_child(stats_row)

	for module in ModuleLoader.new().load_all().get("modules", []):
		_add_market_row(String(module.get("id", "")))
		_add_inventory_row(String(module.get("id", "")))

	var trade_title := Label.new()
	trade_title.text = "Trade Goods"
	_style_section(trade_title)
	_market_box.add_child(trade_title)

	for good in TradeGoodLoader.new().load_all().get("goods", []):
		_add_trade_market_row(String(good.get("id", "")))

	var cargo_title := Label.new()
	cargo_title.text = "Cargo Hold"
	_style_section(cargo_title)
	_inventory_box.add_child(cargo_title)

	for good in TradeGoodLoader.new().load_all().get("goods", []):
		_add_cargo_row(String(good.get("id", "")))

	var undock_button := Button.new()
	undock_button.text = "Undock"
	_style_button(undock_button, ACCENT_ALT, true)
	undock_button.pressed.connect(func():
		GameState.undock_station()
	)
	_action_box.add_child(undock_button)

	for destination_id in GameState.get_travel_destinations():
		_add_travel_button(String(destination_id))

func _build_card(title: String) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _make_stylebox(PANEL_BG, PANEL_EDGE))

	var root := VBoxContainer.new()
	root.name = "Root"
	root.add_theme_constant_override("separation", 8)
	panel.add_child(root)

	var header := Label.new()
	header.text = title.to_upper()
	_style_section(header)
	root.add_child(header)

	var body := VBoxContainer.new()
	body.name = "Body"
	body.add_theme_constant_override("separation", 7)
	root.add_child(body)

	return panel

func _get_card_body(panel: PanelContainer) -> VBoxContainer:
	var root := panel.get_node("Root") as VBoxContainer
	return root.get_node("Body") as VBoxContainer

func _add_equipped_slot(slot_type: String, label_text: String) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_equipped_box.add_child(row)

	var label := Label.new()
	label.custom_minimum_size = Vector2(170, 0)
	label.text = "%s  [%d/%d]" % [
		label_text,
		GameState.get_fitting_slot_used(slot_type),
		GameState.get_fitting_slot_capacity(slot_type)
	]
	_style_body(label, TEXT_COLOR, 13)
	row.add_child(label)

	var modules := GameState.get_equipped_modules(slot_type)
	if modules.is_empty():
		var empty := Label.new()
		empty.text = "Empty"
		_style_body(empty, TEXT_MUTED, 12)
		row.add_child(empty)
		return

	for index in range(modules.size()):
		var slot_index := index
		var module_id := String(modules[slot_index])
		var module := GameState.get_module_definition(module_id)
		var name := String(module.get("name", module_id))
		var button := Button.new()
		button.text = "%s%s  [Unequip]" % [name, _module_summary(module)]
		_style_button(button, ACCENT, false)
		button.disabled = false
		button.pressed.connect(func():
			GameState.unequip_module(slot_type, slot_index)
		)
		row.add_child(button)

func _add_inventory_row(module_id: String) -> void:
	var count := GameState.get_inventory_count(module_id)
	if count <= 0:
		return
	var module := GameState.get_module_definition(module_id)
	if module.is_empty():
		return

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_inventory_box.add_child(row)

	var label := Label.new()
	label.custom_minimum_size = Vector2(220, 0)
	label.text = "%s x%d%s" % [String(module.get("name", module_id)), count, _module_summary(module)]
	_style_body(label, TEXT_COLOR, 12)
	row.add_child(label)

	var slot_type := GameState.get_module_slot_type(module_id)
	var equip_button := Button.new()
	equip_button.text = "Equip"
	equip_button.disabled = slot_type == "" or not GameState.can_equip_module(module_id)
	_style_button(equip_button, ACCENT, true)
	equip_button.pressed.connect(func():
		GameState.equip_module(module_id)
	)
	row.add_child(equip_button)

	var sell_button := Button.new()
	sell_button.text = "Sell"
	_style_button(sell_button, ACCENT_ALT, false)
	sell_button.pressed.connect(func():
		GameState.sell_module(module_id)
	)
	row.add_child(sell_button)

func _add_market_row(module_id: String) -> void:
	var module := GameState.get_module_definition(module_id)
	if module.is_empty():
		return

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_market_box.add_child(row)

	var label := Label.new()
	label.custom_minimum_size = Vector2(240, 0)
	label.text = "%s%s  [%d cr]" % [String(module.get("name", module_id)), _module_summary(module), GameState.get_module_price(module_id)]
	_style_body(label, TEXT_COLOR, 12)
	row.add_child(label)

	var buy_button := Button.new()
	buy_button.text = "Buy"
	buy_button.disabled = int(GameState.world.player.get("credits", 0)) < GameState.get_module_price(module_id)
	_style_button(buy_button, ACCENT, true)
	buy_button.pressed.connect(func():
		GameState.buy_module(module_id)
	)
	row.add_child(buy_button)

func _add_trade_market_row(good_id: String) -> void:
	var good := GameState.get_trade_good_definition(good_id)
	if good.is_empty():
		return
	var station_id := String(GameState.world.get("docked_station_id", ""))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_market_box.add_child(row)

	var label := Label.new()
	label.custom_minimum_size = Vector2(260, 0)
	label.text = "%s  [Buy %d / Sell %d]  [Size %d]" % [
		String(good.get("name", good_id)),
		GameState.get_trade_good_price(good_id, station_id, "buy_price"),
		GameState.get_trade_good_price(good_id, station_id, "sell_price"),
		int(good.get("cargo_size", 1))
	]
	_style_body(label, TEXT_COLOR, 12)
	row.add_child(label)

	var buy_button := Button.new()
	buy_button.text = "Buy Cargo"
	buy_button.disabled = GameState.get_trade_good_price(good_id, station_id, "buy_price") > int(GameState.world.player.get("credits", 0)) or float(good.get("cargo_size", 1.0)) > GameState.get_cargo_remaining()
	_style_button(buy_button, GOOD, true)
	buy_button.pressed.connect(func():
		GameState.buy_trade_good(good_id)
	)
	row.add_child(buy_button)

func _add_cargo_row(good_id: String) -> void:
	var quantity := GameState.get_cargo_count(good_id)
	if quantity <= 0:
		return
	var good := GameState.get_trade_good_definition(good_id)
	if good.is_empty():
		return
	var station_id := String(GameState.world.get("docked_station_id", ""))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_inventory_box.add_child(row)

	var label := Label.new()
	label.custom_minimum_size = Vector2(260, 0)
	label.text = "%s x%d  [Size %d]  [Sell %d]" % [
		String(good.get("name", good_id)),
		quantity,
		int(good.get("cargo_size", 1)),
		GameState.get_trade_good_price(good_id, station_id, "sell_price")
	]
	_style_body(label, TEXT_COLOR, 12)
	row.add_child(label)

	var sell_button := Button.new()
	sell_button.text = "Sell Cargo"
	_style_button(sell_button, ACCENT_ALT, false)
	sell_button.pressed.connect(func():
		GameState.sell_trade_good(good_id)
	)
	row.add_child(sell_button)

func _add_travel_button(destination_id: String) -> void:
	var label := _get_sector_name(destination_id)
	var button := Button.new()
	button.text = "Travel: %s" % label
	_style_button(button, ACCENT, true)
	button.pressed.connect(func():
		GameState.travel_to_sector(destination_id)
	)
	_action_box.add_child(button)

func _clear_children(node: Node) -> void:
	for child in node.get_children():
		child.queue_free()

func _get_sector_name(sector_id: String) -> String:
	for sector in SectorLoader.new().load_all().get("sectors", []):
		if String(sector.get("id", "")) == sector_id:
			return String(sector.get("name", sector_id))
	return sector_id

func _module_summary(module: Dictionary) -> String:
	if module.is_empty():
		return ""
	var summary := ""
	if float(module.get("damage", 0.0)) != 0.0:
		summary += " DMG %d" % int(module.get("damage", 0.0))
	if float(module.get("range", 0.0)) != 0.0:
		summary += " RNG %d" % int(module.get("range", 0.0))
	if float(module.get("power_cost", 0.0)) != 0.0:
		summary += " PWR %d" % int(module.get("power_cost", 0.0))
	if float(module.get("speed_bonus", 0.0)) != 0.0:
		summary += " SPD %+d" % int(module.get("speed_bonus", 0.0))
	if float(module.get("turn_speed_bonus", 0.0)) != 0.0:
		summary += " TURN %+d" % int(module.get("turn_speed_bonus", 0.0))
	if float(module.get("max_hp_bonus", 0.0)) != 0.0:
		summary += " HP %+d" % int(module.get("max_hp_bonus", 0.0))
	return " [" + summary.strip_edges() + "]" if summary != "" else ""

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
	style.shadow_color = Color(0, 0, 0, 0.24)
	style.shadow_size = 8
	style.shadow_offset = Vector2(0, 2)
	style.content_margin_left = 2
	style.content_margin_top = 2
	style.content_margin_right = 2
	style.content_margin_bottom = 2
	return style

func _style_section(label: Label) -> void:
	label.add_theme_color_override("font_color", ACCENT_ALT)
	label.add_theme_font_size_override("font_size", 12)
	label.add_theme_constant_override("line_spacing", 1)
	label.text = label.text.to_upper()

func _style_title(label: Label, color: Color, size: int) -> void:
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_constant_override("line_spacing", 2)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT

func _style_body(label: Label, color: Color, size: int) -> void:
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", size)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

func _style_chip(label: Label, color: Color, _prefix: String) -> void:
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", 12)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT

func _style_button(button: Button, accent: Color, filled: bool) -> void:
	button.add_theme_font_size_override("font_size", 12)
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.custom_minimum_size = Vector2(0, 30)
	var style := StyleBoxFlat.new()
	style.border_color = accent
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	if filled:
		style.bg_color = Color(accent.r * 0.35, accent.g * 0.35, accent.b * 0.35, 0.92)
	else:
		style.bg_color = Color(0.04, 0.08, 0.14, 0.9)
	button.add_theme_stylebox_override("normal", style)
	button.add_theme_stylebox_override("hover", style.duplicate() as StyleBoxFlat)
	button.add_theme_stylebox_override("pressed", style.duplicate() as StyleBoxFlat)
	button.add_theme_color_override("font_color", TEXT_COLOR)
