import type { ShipHullDefinition } from "../../../types/game";
import { createBalanceConfig } from "./overrides";

const PROGRESSION_BALANCE_DEFAULT = {
  shipPowerTierByClass: {
    frigate: 1,
    destroyer: 2,
    cruiser: 3,
    industrial: 1
  } as Record<ShipHullDefinition["shipClass"], number>,
  playerPowerTier: {
    averageTechTierThreshold: 2.4,
    advancedTechTierThreshold: 3.2,
    highWaterThreshold: 4,
    cruiserFloorTier: 3,
    minTier: 1,
    maxTier: 4
  },
  pilotLicense: {
    awardMultiplier: 1.5,
    lossMinimum: 1
  }
} as const;

export const PROGRESSION_BALANCE = createBalanceConfig("progression", PROGRESSION_BALANCE_DEFAULT);
