# Godot Starter Skeleton

This folder is a clean starting point for reworking the game in Godot 4.

Structure:

- `autoload/` for always-on managers and save/state plumbing
- `data/` for content definitions
- `scenes/` for gameplay and UI scenes
- `scripts/` for simulation and controller logic
- `resources/` for art, audio, and shaders

Open `project.godot` in Godot 4 to run the project.

Prototype controls:

- `WASD` or arrow keys to move
- Left click to select a target
- `Space` to fire at the selected target or nearest enemy
- `E` to dock or undock near the station
- `M` to open the route map while docked or undocked
- `Esc` quits

Content now lives in JSON under `data/` so you can expand ships, modules, enemies, and sectors without rewriting the bootstrap.

When docked, the station panel lets you equip or unequip modules before undocking.
The same panel also acts as a basic shop for buying and selling modules.
Stations now also expose a basic cargo market where you can buy trade goods, fill the cargo hold, and sell them back.
Docked stations also provide travel buttons for jumping between sectors with different market prices.
