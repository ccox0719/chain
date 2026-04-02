extends CanvasLayer

const PANEL_BG := Color(0.03, 0.06, 0.12, 0.92)
const PANEL_EDGE := Color(0.33, 0.51, 0.76, 0.2)
const PANEL_EDGE_BRIGHT := Color(0.5, 0.74, 1.0, 0.28)
const TEXT_COLOR := Color(0.94, 0.97, 1.0, 1.0)
const TEXT_MUTED := Color(0.6, 0.71, 0.84, 1.0)
const ACCENT := Color(0.5, 0.76, 1.0, 1.0)
const ACCENT_ALT := Color(1.0, 0.74, 0.5, 1.0)
const GOOD := Color(0.55, 0.88, 0.68, 1.0)

var _backdrop: ColorRect
var _panel: PanelContainer
var _title_label: Label
var _subtitle_label: Label
var _detail_title: Label
var _detail_body: Label
var _sector_list: VBoxContainer
var _detail_links: VBoxContainer
var _selected_sector_id := ""

func _ready() -> void:
	_backdrop = ColorRect.new()
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.color = Color(0, 0, 0, 0.44)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_backdrop)

	_panel = PanelContainer.new()
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.position = Vector2(-520, -340)
	_panel.size = Vector2(1040, 680)
	_panel.add_theme_stylebox_override("panel", _make_stylebox(PANEL_BG, PANEL_EDGE_BRIGHT))
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
	header.add_theme_stylebox_override("panel", _make_stylebox(Color(0.04, 0.08, 0.16, 0.92), PANEL_EDGE_BRIGHT))
	shell.add_child(header)

	var header_margin := MarginContainer.new()
	header_margin.add_theme_constant_override("margin_left", 14)
	header_margin.add_theme_constant_override("margin_top", 12)
	header_margin.add_theme_constant_override("margin_right", 14)
	header_margin.add_theme_constant_override("margin_bottom", 12)
	header.add_child(header_margin)

	var header_row := HBoxContainer.new()
	header_row.add_theme_constant_override("separation", 10)
	header_margin.add_child(header_row)

	var title_box := VBoxContainer.new()
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_box.add_theme_constant_override("separation", 2)
	header_row.add_child(title_box)

	_title_label = Label.new()
	_title_label.text = "ROUTE MAP"
	_style_title(_title_label, ACCENT_ALT, 18)
	title_box.add_child(_title_label)

	_subtitle_label = Label.new()
	_style_body(_subtitle_label, TEXT_MUTED, 12)
	title_box.add_child(_subtitle_label)

	var close_button := Button.new()
	close_button.text = "Close"
	_style_button(close_button, ACCENT_ALT, false)
	close_button.pressed.connect(func():
		set_open(false)
	)
	header_row.add_child(close_button)

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 12)
	shell.add_child(body)

	var left_panel := _card_shell("Sector Network", Vector2(540, 560), ACCENT)
	left_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(left_panel)

	var left_body := _card_body(left_panel)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left_body.add_child(scroll)

	_sector_list = VBoxContainer.new()
	_sector_list.add_theme_constant_override("separation", 8)
	scroll.add_child(_sector_list)

	var right_panel := _card_shell("Selected Sector", Vector2(440, 560), ACCENT_ALT)
	right_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(right_panel)

	var right_body := _card_body(right_panel)
	_detail_title = Label.new()
	_style_title(_detail_title, TEXT_COLOR, 16)
	right_body.add_child(_detail_title)

	_detail_body = Label.new()
	_style_body(_detail_body, TEXT_MUTED, 12)
	right_body.add_child(_detail_body)

	var details_header := Label.new()
	details_header.text = "ROUTES"
	_style_section(details_header, ACCENT_ALT)
	right_body.add_child(details_header)

	_detail_links = VBoxContainer.new()
	_detail_links.add_theme_constant_override("separation", 6)
	right_body.add_child(_detail_links)

	_update_visibility()
	_refresh()

func set_open(value: bool) -> void:
	GameState.world["map_overlay_open"] = value
	_update_visibility()
	if value:
		_refresh()

func _process(_delta: float) -> void:
	_update_visibility()
	if _panel.visible:
		_refresh()

func _unhandled_input(event: InputEvent) -> void:
	if not _panel.visible:
		return
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		GameState.world["map_overlay_open"] = false
		get_viewport().set_input_as_handled()

func _update_visibility() -> void:
	_panel.visible = not GameState.world.is_empty() and bool(GameState.world.get("map_overlay_open", false))
	_backdrop.visible = _panel.visible

func _refresh() -> void:
	if GameState.world.is_empty():
		return

	var world: Dictionary = GameState.world
	var sectors: Array = Array(SectorLoader.new().load_all().get("sectors", []))
	_selected_sector_id = _selected_sector_id if _selected_sector_id != "" else String(world.get("current_sector_id", ""))
	if _selected_sector_id == "":
		_selected_sector_id = String(world.get("current_sector_id", ""))

	_title_label.text = "ROUTE MAP"
	_subtitle_label.text = "%s  |  Dock to travel between connected sectors" % String(world.get("sector_name", "Unknown Sector"))

	_clear_children(_sector_list)
	_clear_children(_detail_links)

	for sector in sectors:
		_add_sector_card(world, sector)

	var selected_sector := _get_sector(_selected_sector_id)
	if selected_sector.is_empty():
		selected_sector = _get_sector(String(world.get("current_sector_id", "")))
		_selected_sector_id = String(selected_sector.get("id", world.get("current_sector_id", "")))

	_detail_title.text = String(selected_sector.get("name", "Sector"))
	_detail_body.text = _sector_summary(selected_sector, world)

	for destination_id in Array(selected_sector.get("travel_destinations", [])):
		var destination := _get_sector(String(destination_id))
		if destination.is_empty():
			continue
		_add_route_row(world, selected_sector, destination)

func _add_sector_card(world: Dictionary, sector: Dictionary) -> void:
	var sector_id := String(sector.get("id", ""))
	var current_sector_id := String(world.get("current_sector_id", ""))
	var is_current := sector_id == current_sector_id
	var is_selected := sector_id == _selected_sector_id
	var panel_border := ACCENT if is_current else PANEL_EDGE
	var name_color := GOOD if is_current else TEXT_COLOR
	var status_text := "CURRENT" if is_current else ("SELECTED" if is_selected else "LINK")
	var status_color := GOOD if is_current else ACCENT_ALT

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _make_stylebox(Color(0.04, 0.08, 0.15, 0.84), panel_border))
	_sector_list.add_child(panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 10)
	panel.add_child(margin)

	var row := VBoxContainer.new()
	row.add_theme_constant_override("separation", 4)
	margin.add_child(row)

	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 8)
	row.add_child(top)

	var name_label := Label.new()
	name_label.text = String(sector.get("name", sector_id))
	_style_title(name_label, name_color, 15)
	top.add_child(name_label)

	var status := Label.new()
	status.text = status_text
	_style_chip(status, status_color)
	top.add_child(status)

	var summary := Label.new()
	summary.text = "Stations %d | Links %d | Grid %d" % [
		Array(sector.get("stations", [])).size(),
		Array(sector.get("travel_destinations", [])).size(),
		int(sector.get("grid", 48))
	]
	_style_body(summary, TEXT_MUTED, 12)
	row.add_child(summary)

	var destinations := Array(sector.get("travel_destinations", []))
	var chips := HBoxContainer.new()
	chips.add_theme_constant_override("separation", 6)
	row.add_child(chips)
	for destination_id in destinations:
		var destination_copy := String(destination_id)
		var dest := _get_sector(destination_copy)
		var chip := Button.new()
		chip.text = String(dest.get("name", destination_copy))
		_style_button(chip, ACCENT, false)
		chip.disabled = false
		chip.pressed.connect(func():
			_selected_sector_id = destination_copy
			_refresh()
		)
		chips.add_child(chip)

	var action_row := HBoxContainer.new()
	action_row.add_theme_constant_override("separation", 6)
	row.add_child(action_row)

	var select_button := Button.new()
	select_button.text = "Inspect"
	_style_button(select_button, ACCENT_ALT, false)
	select_button.pressed.connect(func():
		_selected_sector_id = sector_id
		_refresh()
	)
	action_row.add_child(select_button)

	var travel_button := Button.new()
	travel_button.text = "Current Sector" if is_current else "Travel"
	travel_button.disabled = is_current or (
		String(world.get("docked_station_id", "")) == "" or not Array(GameState.get_travel_destinations()).has(sector_id)
	)
	_style_button(travel_button, GOOD, true)
	travel_button.pressed.connect(func():
		if GameState.travel_to_sector(sector_id):
			set_open(false)
	)
	action_row.add_child(travel_button)

func _add_route_row(world: Dictionary, _current_sector: Dictionary, destination: Dictionary) -> void:
	var destination_id := String(destination.get("id", ""))
	var row := PanelContainer.new()
	row.add_theme_stylebox_override("panel", _make_stylebox(Color(0.04, 0.08, 0.15, 0.78), PANEL_EDGE))
	_detail_links.add_child(row)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_bottom", 8)
	row.add_child(margin)

	var content := HBoxContainer.new()
	content.add_theme_constant_override("separation", 8)
	margin.add_child(content)

	var label := Label.new()
	label.custom_minimum_size = Vector2(220, 0)
	label.text = String(destination.get("name", destination_id))
	_style_title(label, TEXT_COLOR, 13)
	content.add_child(label)

	var detail := Label.new()
	detail.text = "Stations %d | Grid %d" % [
		Array(destination.get("stations", [])).size(),
		int(destination.get("grid", 48))
	]
	_style_body(detail, TEXT_MUTED, 11)
	detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_child(detail)

	var travel_button := Button.new()
	travel_button.text = "Travel"
	travel_button.disabled = String(world.get("docked_station_id", "")) == "" or not Array(GameState.get_travel_destinations()).has(destination_id)
	_style_button(travel_button, GOOD, true)
	travel_button.pressed.connect(func():
		if GameState.travel_to_sector(destination_id):
			set_open(false)
	)
	content.add_child(travel_button)

func _sector_summary(sector: Dictionary, world: Dictionary) -> String:
	if sector.is_empty():
		return ""
	var lines := []
	lines.append("Current sector: %s" % String(sector.get("name", "Sector")))
	lines.append("Grid: %d" % int(sector.get("grid", 48)))
	lines.append("Stations: %d" % Array(sector.get("stations", [])).size())
	lines.append("Routes: %s" % ", ".join(Array(sector.get("travel_destinations", []))))
	if String(world.get("docked_station_id", "")) == "":
		lines.append("Dock at a station to enable travel")
	else:
		lines.append("Docked travel available")
	return "\n".join(lines)

func _get_sector(sector_id: String) -> Dictionary:
	for sector in SectorLoader.new().load_all().get("sectors", []):
		if String(sector.get("id", "")) == sector_id:
			return sector
	return {}

func _clear_children(node: Node) -> void:
	for child in node.get_children():
		child.queue_free()

func _card_shell(title: String, size: Vector2, border: Color) -> PanelContainer:
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

func _style_chip(label: Label, color: Color) -> void:
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", 11)

func _style_button(button: Button, accent: Color, filled: bool) -> void:
	button.add_theme_font_size_override("font_size", 12)
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
