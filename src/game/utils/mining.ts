import { ResourceId } from "../../types/game";

const MINING_RESOURCE_TIER: Record<ResourceId, number> = {
  ferrite: 0,
  "ember-crystal": 1,
  "ghost-alloy": 2
};

export type MiningModuleLike = {
  miningTier?: number;
  miningTargets?: ResourceId[];
};

export type AsteroidQuality = "poor" | "standard" | "rich" | "pristine";

const ASTEROID_QUALITY_MULTIPLIER: Record<AsteroidQuality, number> = {
  poor: 0.78,
  standard: 1,
  rich: 1.24,
  pristine: 1.56
};

export function getMiningResourceTier(resource: ResourceId) {
  return MINING_RESOURCE_TIER[resource];
}

export function getAsteroidQualityMultiplier(quality: AsteroidQuality) {
  return ASTEROID_QUALITY_MULTIPLIER[quality];
}

export function getAsteroidQualityLabel(quality: AsteroidQuality) {
  return quality === "poor" ? "Poor" : quality === "rich" ? "Rich" : quality === "pristine" ? "Pristine" : "Standard";
}

export function getMiningModuleTier(module: MiningModuleLike) {
  if (typeof module.miningTier === "number") return Math.max(1, Math.floor(module.miningTier));
  if (!module.miningTargets?.length) return 1;
  return Math.max(...module.miningTargets.map((target) => MINING_RESOURCE_TIER[target])) + 1;
}

export function canMineResource(module: MiningModuleLike, resource: ResourceId) {
  if (!module.miningTargets?.length) return true;
  const resourceTier = getMiningResourceTier(resource);
  const maxAllowedTier = Math.max(...module.miningTargets.map((target) => MINING_RESOURCE_TIER[target]));
  return resourceTier <= maxAllowedTier;
}

export function getMiningYieldMultiplier(module: MiningModuleLike, resource: ResourceId) {
  const moduleTier = getMiningModuleTier(module);
  const resourceTier = getMiningResourceTier(resource);
  const intrinsicBonus = 1 + Math.max(0, moduleTier - 1) * 0.08;
  const lowerTierBonus = 1 + Math.max(0, moduleTier - 1 - resourceTier) * 0.07;
  return Math.min(1.6, intrinsicBonus * lowerTierBonus);
}
