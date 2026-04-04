import type { ResourceId, SecurityBand } from "../../../types/game";
import { createBalanceConfig } from "./overrides";

const ECONOMY_BALANCE_DEFAULT = {
  baseResourcePrices: {
    ferrite: 22,
    "ember-crystal": 46,
    "ghost-alloy": 88
  } as Record<ResourceId, number>,
  securityPriceScale: {
    high: 1,
    medium: 1.08,
    low: 1.22,
    frontier: 1.38
  } as Record<SecurityBand, number>,
  resourceRiskScale: {
    ferrite: { high: 1.06, medium: 0.98, low: 0.98, frontier: 0.98 },
    "ember-crystal": { high: 0.94, medium: 1.08, low: 1.16, frontier: 1.16 },
    "ghost-alloy": { high: 0.9, medium: 0.9, low: 1.14, frontier: 1.24 }
  } as Record<ResourceId, Record<SecurityBand, number>>,
  stationTradeScale: {
    market: 0.96,
    frontier: 1.18,
    research: 1.05,
    default: 1
  },
  commodityScore: {
    base: 0.12,
    match: 0.14,
    matchBonus: 0.08,
    category: {
      essentials: 0.2,
      industrial: 0.18,
      energy: 0.18,
      medical: 0.22,
      technology: 0.24,
      military: 0.2,
      materials: 0.22,
      frontier: 0.24,
      luxury: 0.18,
      salvage: 0.24
    },
    tag: {
      market: 0.08,
      trade: 0.08,
      research: 0.06,
      logistics: 0.06,
      frontier: 0.03
    },
    profileInventoryBias: 0.16,
    securityHigh: 0.05,
    securityFrontier: -0.02,
    jitter: 0.16,
    clampMin: 0.04,
    clampMax: 0.98,
    stockTargetBase: 4,
    stockTargetBias: 1.2,
    stockTargetMarketBonus: 1,
    stockTargetMin: 4,
    stockTargetMax: 7
  },
  moduleStockScore: {
    base: 0.12,
    common: 0.28,
    militaryHigh: 0.16,
    militaryMedium: 0.08,
    militaryLow: 0.02,
    highTechBonus: 0.2,
    highTechPenalty: -0.06,
    frontierBonus: 0.18,
    frontierFallback: 0.08,
    frontierPenalty: -0.08,
    industrialBonus: 0.16,
    miningBonus: 0.24,
    cargoBonus: 0.18,
    salvageBonus: 0.18,
    controlBonus: 0.1,
    weaponBonus: 0.14,
    defenseBonus: 0.12,
    techLevel2Penalty: 0.1,
    techLevel3Penalty: 0.24,
    civilianBonus: 0.06,
    matchedTagBonus: 0.16,
    profileInventoryBias: 0.14,
    securityHigh: 0.05,
    securityFrontier: -0.03,
    jitter: 0.16,
    clampMin: 0.03,
    clampMax: 0.96
  },
  categories: {
    luxury: { high: 1.08, medium: 1, low: 0.94, frontier: 0.88 },
    frontier: { high: 0.96, medium: 1.05, low: 1.18, frontier: 1.3 },
    salvage: { high: 0.98, medium: 0.98, low: 1.12, frontier: 1.24 },
    default: { high: 1, medium: 1.06, low: 1.14, frontier: 1.22 }
  }
} as const;

export const ECONOMY_BALANCE = createBalanceConfig("economy", ECONOMY_BALANCE_DEFAULT);
