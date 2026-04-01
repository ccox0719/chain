import { ModuleDefinition, SecurityBand, SystemDestination } from "../../types/game";
import { stationMarketProfileById } from "./data/stationMarketProfiles";

function hashStringToUnitInterval(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hasAnyTag(module: ModuleDefinition, tags: Set<string>) {
  return module.tags.some((tag) => tags.has(tag));
}

function stationTagSet(station: SystemDestination | null) {
  const profile = station ? stationMarketProfileById[station.id] : null;
  return new Set([...(station?.tags ?? []), ...(profile?.supplyTags ?? []), ...(profile?.demandTags ?? [])]);
}

function moduleFamilyScore(module: ModuleDefinition, stationTags: Set<string>, security: SecurityBand) {
  let score = 0.12;
  const isCommon = module.tags.includes("common") || module.classTier === "civilian";

  if (isCommon) score += 0.28;
  if (module.tags.includes("military")) score += security === "high" ? 0.16 : security === "medium" ? 0.08 : 0.02;
  if (module.tags.includes("high-tech")) score += stationTags.has("high-tech") || stationTags.has("research") ? 0.2 : -0.06;
  if (module.tags.includes("frontier")) score += stationTags.has("frontier") ? 0.18 : security === "frontier" || security === "low" ? 0.08 : -0.08;
  if (module.tags.includes("industrial")) score += stationTags.has("industrial") || stationTags.has("logistics") ? 0.16 : 0.03;
  if (module.tags.includes("mining")) score += stationTags.has("mining") ? 0.24 : stationTags.has("industrial") ? 0.08 : -0.03;
  if (module.tags.includes("cargo") || module.roleTags?.includes("Hauler")) score += stationTags.has("logistics") || stationTags.has("industrial") ? 0.18 : 0.04;
  if (module.tags.includes("salvage")) score += stationTags.has("salvage") ? 0.18 : stationTags.has("frontier") ? 0.08 : -0.04;
  if (module.tags.includes("control")) score += stationTags.has("market") || stationTags.has("research") ? 0.1 : 0.02;
  if (module.category === "weapon") score += stationTags.has("combat") ? 0.14 : 0.04;
  if (module.category === "defense") score += stationTags.has("repair") || stationTags.has("combat") ? 0.12 : 0.03;

  if (module.techLevel === 2) score -= 0.1;
  if (module.techLevel === 3) score -= 0.24;
  if (module.classTier === "civilian") score += 0.06;

  return score;
}

export function getModuleStockScore(module: ModuleDefinition, security: SecurityBand, station: SystemDestination | null) {
  if (!station) return 0;
  const stationTags = stationTagSet(station);
  const profile = station ? stationMarketProfileById[station.id] : null;
  const matchedTags = hasAnyTag(module, stationTags);
  let score = moduleFamilyScore(module, stationTags, security);

  if (matchedTags) score += 0.16;
  if (profile) score += (profile.inventoryBias - 1) * 0.14;
  if (security === "high") score += 0.05;
  if (security === "frontier") score -= 0.03;

  // Deterministic jitter keeps inventories from feeling identical from one station to the next.
  const jitter = hashStringToUnitInterval(`${station.id}:${module.id}:stock`) - 0.5;
  score += jitter * 0.16;

  return clamp(score, 0.03, 0.96);
}

export function isModuleAvailableAtStation(module: ModuleDefinition, security: SecurityBand, station: SystemDestination | null) {
  if (!station) return false;
  const score = getModuleStockScore(module, security, station);
  const roll = hashStringToUnitInterval(`${station.id}:${module.id}:roll`);
  return roll < score;
}
