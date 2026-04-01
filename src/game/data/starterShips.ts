import { StarterShipConfig, StarterShipConfigId } from "../../types/game";

export const defaultStarterShipConfigId: StarterShipConfigId = "balanced-patrol";

export const starterShipConfigs: StarterShipConfig[] = [
  {
    id: "balanced-patrol",
    name: "Patrol Sparrow",
    shipId: "rookie-sparrow",
    summary: "Twin civilian pulse lasers with an afterburner.",
    description: "The safest starting fit. It stays simple, close, and forgiving while you learn range control.",
    equipped: {
      weapon: ["civilian-pulse-laser", "civilian-pulse-laser"],
      utility: ["civilian-afterburner-mk1", null],
      defense: [null, null]
    }
  },
  {
    id: "missile-runner",
    name: "Runner Sparrow",
    shipId: "rookie-sparrow",
    summary: "Twin civilian missile racks with an afterburner.",
    description: "Longer reach and easier kiting, but less immediate damage when targets get on top of you.",
    equipped: {
      weapon: ["civilian-micro-missile-rack", "civilian-micro-missile-rack"],
      utility: ["civilian-afterburner-mk1", null],
      defense: [null, null]
    }
  },
  {
    id: "ore-hound",
    name: "Ore Hound Sparrow",
    shipId: "rookie-sparrow",
    summary: "Pulse laser, missile rack, and a civilian mining laser.",
    description: "A utility-first start for players who want early credits from belts instead of pure combat.",
    equipped: {
      weapon: ["civilian-pulse-laser", "civilian-micro-missile-rack"],
      utility: ["civilian-survey-mining-laser", null],
      defense: [null, null]
    }
  },
  {
    id: "wreck-diver",
    name: "Wreck Diver Sparrow",
    shipId: "rookie-sparrow",
    summary: "Twin pulse lasers with a civilian salvager.",
    description: "Short-range combat start that leans into post-fight salvage for income and slower progression.",
    equipped: {
      weapon: ["civilian-pulse-laser", "civilian-pulse-laser"],
      utility: ["civilian-field-salvager", null],
      defense: [null, null]
    }
  }
];

export const starterShipConfigById = Object.fromEntries(
  starterShipConfigs.map((config) => [config.id, config])
) as Record<StarterShipConfigId, StarterShipConfig>;
