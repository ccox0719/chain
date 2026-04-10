import { GameWorld, ModuleDefinition, SecurityBand, SystemDestination } from "../../types/game";
import { stationMarketProfileById } from "./data/stationMarketProfiles";
import { ECONOMY_BALANCE } from "../config/balance";
import { sectorById } from "../data/sectors";

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
  let score = ECONOMY_BALANCE.moduleStockScore.base;
  const isCommon = module.tags.includes("common") || module.classTier === "civilian";

  if (isCommon) score += ECONOMY_BALANCE.moduleStockScore.common;
  if (module.tags.includes("military")) score += security === "high" ? ECONOMY_BALANCE.moduleStockScore.militaryHigh : security === "medium" ? ECONOMY_BALANCE.moduleStockScore.militaryMedium : ECONOMY_BALANCE.moduleStockScore.militaryLow;
  if (module.tags.includes("high-tech")) score += stationTags.has("high-tech") || stationTags.has("research") ? ECONOMY_BALANCE.moduleStockScore.highTechBonus : ECONOMY_BALANCE.moduleStockScore.highTechPenalty;
  if (module.tags.includes("frontier")) score += stationTags.has("frontier") ? ECONOMY_BALANCE.moduleStockScore.frontierBonus : security === "frontier" || security === "low" ? ECONOMY_BALANCE.moduleStockScore.frontierFallback : ECONOMY_BALANCE.moduleStockScore.frontierPenalty;
  if (module.tags.includes("industrial")) score += stationTags.has("industrial") || stationTags.has("logistics") ? ECONOMY_BALANCE.moduleStockScore.industrialBonus : 0.03;
  if (module.tags.includes("mining")) score += stationTags.has("mining") ? ECONOMY_BALANCE.moduleStockScore.miningBonus : stationTags.has("industrial") ? 0.08 : -0.03;
  if (module.tags.includes("cargo") || module.roleTags?.includes("Hauler")) score += stationTags.has("logistics") || stationTags.has("industrial") ? ECONOMY_BALANCE.moduleStockScore.cargoBonus : 0.04;
  if (module.tags.includes("salvage")) score += stationTags.has("salvage") ? ECONOMY_BALANCE.moduleStockScore.salvageBonus : stationTags.has("frontier") ? 0.08 : -0.04;
  if (module.tags.includes("control")) score += stationTags.has("market") || stationTags.has("research") ? ECONOMY_BALANCE.moduleStockScore.controlBonus : 0.02;
  if (module.category === "weapon") score += stationTags.has("combat") ? ECONOMY_BALANCE.moduleStockScore.weaponBonus : 0.04;
  if (module.category === "defense") score += stationTags.has("repair") || stationTags.has("combat") ? ECONOMY_BALANCE.moduleStockScore.defenseBonus : 0.03;

  if (module.techLevel === 2) score -= ECONOMY_BALANCE.moduleStockScore.techLevel2Penalty;
  if (module.techLevel === 3) score -= ECONOMY_BALANCE.moduleStockScore.techLevel3Penalty;
  if (module.classTier === "civilian") score += ECONOMY_BALANCE.moduleStockScore.civilianBonus;

  return score;
}

function getDangerousTheaterStockModifier(module: ModuleDefinition, world?: GameWorld) {
  if (!world) return 0;
  const sector = sectorById[world.currentSectorId];
  if (!sector) return 0;

  let modifier = 0;
  const techLevel = module.techLevel ?? 1;
  const premiumModule = techLevel >= 3 || module.price >= 7000;
  const advancedModule = techLevel >= 2 || module.price >= 3200;
  const frontierSpecialist = module.tags.includes("frontier") || module.tags.includes("salvage") || module.tags.includes("industrial");

  switch (sector.theaterTag) {
    case "relic":
      if (premiumModule) modifier -= 0.28;
      else if (advancedModule) modifier -= 0.14;
      if (module.tags.includes("high-tech")) modifier -= 0.08;
      if (frontierSpecialist) modifier += 0.06;
      break;
    case "raid":
      if (premiumModule) modifier -= 0.22;
      else if (advancedModule) modifier -= 0.1;
      if (module.tags.includes("high-tech")) modifier -= 0.05;
      if (module.tags.includes("frontier") || module.tags.includes("military")) modifier += 0.05;
      break;
    case "deep-wild":
      if (sector.danger >= 5) {
        if (premiumModule) modifier -= 0.16;
        else if (advancedModule) modifier -= 0.08;
        if (frontierSpecialist) modifier += 0.04;
      }
      break;
    case "frontline":
      if (premiumModule) modifier -= 0.1;
      if (module.tags.includes("military") || module.tags.includes("industrial")) modifier += 0.04;
      break;
    default:
      break;
  }

  return modifier;
}

export function getModuleStockScore(module: ModuleDefinition, security: SecurityBand, station: SystemDestination | null) {
  if (!station) return 0;
  const stationTags = stationTagSet(station);
  const profile = station ? stationMarketProfileById[station.id] : null;
  const matchedTags = hasAnyTag(module, stationTags);
  let score = moduleFamilyScore(module, stationTags, security);

  if (matchedTags) score += ECONOMY_BALANCE.moduleStockScore.matchedTagBonus;
  if (profile) score += (profile.inventoryBias - 1) * ECONOMY_BALANCE.moduleStockScore.profileInventoryBias;
  if (security === "high") score += ECONOMY_BALANCE.moduleStockScore.securityHigh;
  if (security === "frontier") score -= Math.abs(ECONOMY_BALANCE.moduleStockScore.securityFrontier);

  // Deterministic jitter keeps inventories from feeling identical from one station to the next.
  const jitter = hashStringToUnitInterval(`${station.id}:${module.id}:stock`) - 0.5;
  score += jitter * ECONOMY_BALANCE.moduleStockScore.jitter;

  return clamp(score, ECONOMY_BALANCE.moduleStockScore.clampMin, ECONOMY_BALANCE.moduleStockScore.clampMax);
}

export function isModuleAvailableAtStation(
  module: ModuleDefinition,
  security: SecurityBand,
  station: SystemDestination | null,
  world?: GameWorld
) {
  if (!station) return false;
  if (module.specialReward) return false;
  const score = clamp(
    getModuleStockScore(module, security, station) + getDangerousTheaterStockModifier(module, world),
    ECONOMY_BALANCE.moduleStockScore.clampMin,
    ECONOMY_BALANCE.moduleStockScore.clampMax
  );
  const roll = hashStringToUnitInterval(`${station.id}:${module.id}:roll`);
  return roll < score;
}
