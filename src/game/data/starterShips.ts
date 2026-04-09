import { StarterShipConfig, StarterShipConfigId } from "../../types/game";

export const defaultStarterShipConfigId: StarterShipConfigId = "balanced-patrol";

export const starterShipConfigs: StarterShipConfig[] = [
  {
    id: "balanced-patrol",
    name: "Patrol Sparrow",
    shipId: "rookie-sparrow",
    summary: "Twin pulse lasers and an afterburner.",
    description: "The safest start. Clean range control, easy damage application, and a forgiving escape tool.",
    starterStats: {
      offense: 66,
      mobility: 62,
      defense: 46,
      utility: 34
    },
    starterBonuses: {
      acceleration: 4,
      turnSpeed: 0.08,
      maxSpeed: 4,
      lockRange: 18,
      capacitorCapacity: 6
    },
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
    summary: "Twin micro-missile racks with an afterburner.",
    description: "Longer reach and easier kiting. Good for players who want to fight while moving away.",
    starterStats: {
      offense: 60,
      mobility: 76,
      defense: 36,
      utility: 42
    },
    starterBonuses: {
      maxSpeed: 10,
      acceleration: 8,
      turnSpeed: 0.12,
      lockRange: 28,
      capacitorCapacity: 4
    },
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
    summary: "Pulse laser, mining beam, and cargo support.",
    description: "A utility-first start for players who want early credits from belts instead of pure combat.",
    starterStats: {
      offense: 52,
      mobility: 52,
      defense: 54,
      utility: 84
    },
    starterBonuses: {
      maxShield: -14,
      maxArmor: 20,
      cargoCapacity: 10,
      maxSpeed: -4,
      interactionRange: 6,
      capacitorCapacity: 8
    },
    equipped: {
      weapon: ["civilian-pulse-laser", "civilian-micro-missile-rack"],
      utility: ["civilian-survey-mining-laser", "civilian-cargo-lattice"],
      defense: ["civilian-reinforced-armor-plate", null]
    }
  },
  {
    id: "wreck-diver",
    name: "Wreck Diver Sparrow",
    shipId: "rookie-sparrow",
    summary: "Pulse lasers with a field salvager.",
    description: "A cleanup-focused start that leans into post-fight salvage and steady frontier income.",
    starterStats: {
      offense: 64,
      mobility: 54,
      defense: 70,
      utility: 72
    },
    starterBonuses: {
      maxShield: -22,
      maxArmor: 34,
      cargoCapacity: 8,
      interactionRange: 4
    },
    equipped: {
      weapon: ["civilian-pulse-laser", "civilian-pulse-laser"],
      utility: ["civilian-field-salvager", "civilian-afterburner-mk1"],
      defense: ["civilian-armor-repairer", "civilian-reinforced-armor-plate"]
    }
  },
  {
    id: "rail-scout",
    name: "Rail Scout Sparrow",
    shipId: "rookie-sparrow",
    summary: "Twin light railguns with tracking support.",
    description: "Longer reach, cleaner armor bite, and a steadier fight from the edge of the engagement band.",
    starterStats: {
      offense: 72,
      mobility: 70,
      defense: 40,
      utility: 58
    },
    starterBonuses: {
      maxSpeed: 6,
      turnSpeed: 0.14,
      lockRange: 36,
      signatureRadius: -1
    },
    equipped: {
      weapon: ["civilian-light-railgun", "civilian-light-railgun"],
      utility: ["civilian-tracking-uplink", "civilian-afterburner-mk1"],
      defense: [null, "civilian-shield-plating"]
    }
  },
  {
    id: "cannon-brawler",
    name: "Cannon Brawler Sparrow",
    shipId: "rookie-sparrow",
    summary: "Twin rotary cannons with shield support.",
    description: "A close-range pressure start with heavy burst windows and enough buffer to stay in the pocket.",
    starterStats: {
      offense: 74,
      mobility: 50,
      defense: 78,
      utility: 30
    },
    starterBonuses: {
      maxShield: -28,
      maxArmor: 48,
      maxSpeed: -4,
      acceleration: -2
    },
    equipped: {
      weapon: ["civilian-light-rotary-cannon", "civilian-light-rotary-cannon"],
      utility: ["civilian-afterburner-mk1", null],
      defense: ["civilian-reactive-plating", "civilian-armor-repairer"]
    }
  },
  {
    id: "longshot-lane",
    name: "Longshot Sparrow",
    shipId: "rookie-sparrow",
    summary: "Twin beam lasers with capacitor support.",
    description: "A patient range-control start that rewards spacing, tracking, and clean target swaps.",
    starterStats: {
      offense: 78,
      mobility: 48,
      defense: 42,
      utility: 62
    },
    starterBonuses: {
      capacitorCapacity: 14,
      lockRange: 48,
      maxSpeed: -2,
      turnSpeed: 0.04
    },
    equipped: {
      weapon: ["civilian-beam-laser", "civilian-beam-laser"],
      utility: ["civilian-tracking-uplink", "civilian-capacitor-battery"],
      defense: [null, "civilian-shield-booster"]
    }
  }
];

export const starterShipConfigById = Object.fromEntries(
  starterShipConfigs.map((config) => [config.id, config])
) as Record<StarterShipConfigId, StarterShipConfig>;
