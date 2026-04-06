o# Nova Chain

## Overview

**Nova Chain** (package: **chain-ship-sim**)

### Key Features
- **Ship Management**: Fitting modules/weapons, inventory, progression via pilot licenses.
- **Simulation Systems**: AI, combat, economy (trade goods, markets), missions, movement, route planning.
- **World**: Sectors, stations, enemies, bosses, factions.
- **UI**: HUD, map panels, station panels, ship diagrams, death overlay.
- **Data-Driven**: JSON configs for ships, modules, enemies, missions, economy balance.
- **Deployment**: Web version deployable to Netlify.

## Project Structure

```
Nova Chain/
├── index.html                 # Web entrypoint
├── package.json              # Vite + React + TS dependencies
├── vite.config.ts            # Vite config
├── netlify.toml              # Netlify deployment
├── src/                      # React web app (TypeScript)
│   ├── App.tsx
│   ├── GameCanvas.tsx        # Main game rendering
│   ├── components/           # UI: ShipFittingDiagram, StationPanel, HUD, etc.
│   ├── game/                 # Core game logic
│   │   ├── config/balance/   # Game balancing (combat, economy, etc.)
│   │   ├── data/             # Ships, enemies, missions, sectors
│   │   ├── economy/          # Markets, pricing, commodities
│   │   ├── systems/          # Simulation systems
│   │   └── universe/         # Route planning, procgen
│   └── store/                # Zustand store (useSpaceGame.ts)
├── godot/                    # Experimental Godot prototype (GDScript, not core)
└── ... (icons, .gitignore, .txt)
```

## Technologies
- **Frontend**: React 18, Vite, TypeScript

- **Deployment**: Netlify (build: `npm run build`, publish: `dist/`)

## Setup & Run

### Web App (Vite/React)
```bash
cd /Users/cox/Documents/Chain
npm install
npm run dev  # http://localhost:5173
npm run build  # for production
```



## Architecture Notes
- Canvas-based rendering (`renderSector.ts`), entity factories, procgen, simulation ticks (all in TS).
- Balance configurable in `src/game/config/balance/` and Godot data JSONs.

## Next Steps / Updates
See `next updates.md` (currently empty).

## License
[Add your license here]

