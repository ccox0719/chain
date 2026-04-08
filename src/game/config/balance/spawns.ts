import type { SolarSystemDefinition } from "../../../types/game";
import { createBalanceConfig } from "./overrides";

const SPAWN_BALANCE_DEFAULT = {
  hostileTriggerCooldownSec: 42,
  maxTriggeredHostilesNearPlayer: 3,
  triggeredHostileSearchRadius: 720,
  triggerProfiles: {
    low: { chance: 0.04, count: 1 },
    mid: { chance: 0.08, count: 2 },
    high: { chance: 0.14, count: 3 }
  },
  // Region, faction, and security bias for encounter composition.
  regionRoleBias: {
    "aurelian-core": {
      sniper: 1.12,
      support: 1.12,
      artillery: 0.9,
      swarm: 0.82,
      tackle: 0.88,
      hunter: 0.9
    },
    "industrial-fringe": {
      brawler: 1.08,
      artillery: 1.14,
      anchor: 1.04,
      escort: 1.04,
      skirmisher: 1.02,
      swarm: 0.92,
      tackle: 0.98
    },
    "frontier-march": {
      swarm: 1.14,
      tackle: 1.1,
      hunter: 1.1,
      artillery: 1.04,
      sniper: 1.06,
      support: 1.03
    }
  } as Record<string, Partial<Record<SpawnRole, number>>>,
  factionRoleBias: {
    "aurelian-league": {
      sniper: 1.08,
      support: 1.08,
      anchor: 1.02,
      swarm: 0.84,
      tackle: 0.88
    },
    "helion-cabal": {
      sniper: 1.18,
      support: 1.12,
      artillery: 1.06,
      swarm: 0.82,
      tackle: 0.9
    },
    "cinder-union": {
      brawler: 1.08,
      artillery: 1.1,
      skirmisher: 1.04,
      hunter: 0.98,
      swarm: 0.94
    },
    "ironbound-syndicate": {
      brawler: 1.1,
      artillery: 1.08,
      anchor: 1.06,
      escort: 1.04,
      swarm: 0.92
    },
    "veilborn": {
      swarm: 1.1,
      hunter: 1.06,
      tackle: 1.06,
      support: 1.04,
      skirmisher: 1.04
    },
    "blackwake-clans": {
      swarm: 1.16,
      tackle: 1.1,
      hunter: 1.08,
      skirmisher: 1.04,
      support: 1.02,
      anchor: 0.95
    }
  } as Record<string, Partial<Record<SpawnRole, number>>>,
  securityRoleBias: {
    high: {
      swarm: 0.8,
      tackle: 0.86,
      sniper: 1.08,
      support: 1.06
    },
    medium: {
      swarm: 1,
      tackle: 1,
      sniper: 1,
      support: 1,
      brawler: 1
    },
    low: {
      swarm: 1.03,
      tackle: 1.03,
      hunter: 1.05,
      artillery: 1.04,
      support: 0.99
    },
    frontier: {
      swarm: 1.08,
      tackle: 1.08,
      hunter: 1.08,
      artillery: 1.06,
      sniper: 1.04,
      support: 1.01
    }
  } as Record<SolarSystemDefinition["security"], Partial<Record<SpawnRole, number>>>,
  triggerWeights: {
    dangerSniperBonus: 1.04,
    highSecuritySwarmPenalty: 0.82,
    frontierRoleBoost: 1.05
  },
  pressure: {
    localReinforcementThreshold: 11.5,
    frontierSwarmThreshold: 10,
    highTierEscortThreshold: 10,
    pressurePackThreshold: 9
  },
  sectorChallenge: {
    hostileSiteDanger4: 0.008,
    hostileSiteDanger3: 0.005,
    hostileSiteDefault: 0.002,
    presenceBase: 0.003,
    presenceDangerScale: 0.0007,
    proximity: 0.008,
    mining: 0.004,
    mission: 0.006,
    contract: 0.004,
    decay: {
      high: 0.110,
      medium: 0.084,
      low: 0.064,
      frontier: 0.048
    },
    playerPowerTierScale: 0.00035
  },
  triggerChance: {
    miningBase: 0.02,
    miningMax: 0.24,
    miningFrontierPerTier: 0.01,
    portalBase: 0.03,
    portalMax: 0.28,
    portalFrontierPerTier: 0.012
  },
  reinforcement: {
    sectorBaseTimerSec: 200,
    sectorMinimumTimerSec: 140,
    sectorMaximumTimerSec: 300,
    sectorPressureScale: 0.7,
    sectorPlayerTierPenalty: 4,
    missionSurviveTimerSec: 130,
    missionClearTimerSec: 110,
    missionSurvivePressurePerSecond: 0.006,
    missionClearPressurePerWave: 0.18
  },
  triggeredSpawnRadius: {
    swarm: [120, 50],
    tackle: [180, 60],
    sniper: [280, 90],
    brawler: [200, 70],
    support: [240, 80],
    anchor: [300, 90],
    escort: [210, 70],
    artillery: [340, 100],
    hunter: [170, 60],
    skirmisher: [210, 70],
    default: [220, 80]
  }
} as const;

export const SPAWN_BALANCE = createBalanceConfig("spawns", SPAWN_BALANCE_DEFAULT);

type SpawnRole = "swarm" | "tackle" | "sniper" | "brawler" | "support" | "skirmisher" | "anchor" | "escort" | "artillery" | "hunter";
