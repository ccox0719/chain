import { CommodityDefinition, SecurityBand, SystemDestination } from "../../types/game";
import { commodityCatalog } from "./data/commodities";
import { stationMarketProfileById } from "./data/stationMarketProfiles";
import { getCommodityStockBias } from "../procgen/runtime";
import { ECONOMY_BALANCE } from "../config/balance";

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

function stationTagSet(station: SystemDestination | null) {
  const profile = station ? stationMarketProfileById[station.id] : null;
  return new Set([...(station?.tags ?? []), ...(profile?.supplyTags ?? []), ...(profile?.demandTags ?? [])]);
}

function commodityMarketScore(
  commodity: CommodityDefinition,
  security: SecurityBand,
  station: SystemDestination | null,
  systemId?: string,
  procgenWorld?: Parameters<typeof getCommodityStockBias>[0]
) {
  if (!station) return 0;
  const tags = stationTagSet(station);
  const profile = stationMarketProfileById[station.id];
  const stationTags = station.tags ?? [];
  let score = ECONOMY_BALANCE.commodityScore.base;

  const matches = commodity.tags.filter((tag) => tags.has(tag)).length;
  score += matches * ECONOMY_BALANCE.commodityScore.match;
  if (matches > 0) score += ECONOMY_BALANCE.commodityScore.matchBonus;

  if (commodity.category === "essentials") score += tags.has("essentials") || tags.has("logistics") ? ECONOMY_BALANCE.commodityScore.category.essentials : 0.06;
  if (commodity.category === "industrial") score += tags.has("industrial") || tags.has("manufacturing") ? ECONOMY_BALANCE.commodityScore.category.industrial : 0.08;
  if (commodity.category === "energy") score += tags.has("fuel") || tags.has("logistics") ? ECONOMY_BALANCE.commodityScore.category.energy : 0.04;
  if (commodity.category === "medical") score += tags.has("medical") || security === "high" ? ECONOMY_BALANCE.commodityScore.category.medical : 0.04;
  if (commodity.category === "technology") score += tags.has("research") || tags.has("high-tech") ? ECONOMY_BALANCE.commodityScore.category.technology : 0.02;
  if (commodity.category === "military") score += tags.has("military") || security === "low" || security === "frontier" ? ECONOMY_BALANCE.commodityScore.category.military : -0.03;
  if (commodity.category === "materials") score += tags.has("mining") || tags.has("industrial") ? ECONOMY_BALANCE.commodityScore.category.materials : 0.06;
  if (commodity.category === "frontier") score += tags.has("frontier") || security === "frontier" ? ECONOMY_BALANCE.commodityScore.category.frontier : 0.04;
  if (commodity.category === "luxury") score += tags.has("trade") || tags.has("high-tech") || security === "high" ? ECONOMY_BALANCE.commodityScore.category.luxury : -0.02;
  if (commodity.category === "salvage") score += tags.has("salvage") || tags.has("industrial") ? ECONOMY_BALANCE.commodityScore.category.salvage : 0.05;

  if (stationTags.includes("market")) score += ECONOMY_BALANCE.commodityScore.tag.market;
  if (stationTags.includes("trade")) score += ECONOMY_BALANCE.commodityScore.tag.trade;
  if (stationTags.includes("research")) score += ECONOMY_BALANCE.commodityScore.tag.research;
  if (stationTags.includes("logistics")) score += ECONOMY_BALANCE.commodityScore.tag.logistics;
  if (stationTags.includes("frontier")) score += ECONOMY_BALANCE.commodityScore.tag.frontier;

  if (profile) score += (profile.inventoryBias - 1) * ECONOMY_BALANCE.commodityScore.profileInventoryBias;
  if (security === "high") score += ECONOMY_BALANCE.commodityScore.securityHigh;
  if (security === "frontier") score -= Math.abs(ECONOMY_BALANCE.commodityScore.securityFrontier);

  const jitter = hashStringToUnitInterval(`${station.id}:${commodity.id}:stock`) - 0.5;
  score += jitter * ECONOMY_BALANCE.commodityScore.jitter;
  if (procgenWorld && systemId) {
    score += getCommodityStockBias(procgenWorld, systemId, commodity.tags);
  }

  return clamp(score, ECONOMY_BALANCE.commodityScore.clampMin, ECONOMY_BALANCE.commodityScore.clampMax);
}

export function isCommodityAvailableAtStation(
  commodity: CommodityDefinition,
  security: SecurityBand,
  station: SystemDestination | null
) {
  if (!station) return false;
  const score = commodityMarketScore(commodity, security, station);
  const roll = hashStringToUnitInterval(`${station.id}:${commodity.id}:roll`);
  return roll < score;
}

export function getStationCommodityStock(
  commodities: CommodityDefinition[],
  security: SecurityBand,
  station: SystemDestination | null,
  systemId?: string,
  procgenWorld?: Parameters<typeof getCommodityStockBias>[0]
) {
  if (!station) return [];
  const profile = stationMarketProfileById[station.id];
  const targetCount = clamp(
    Math.round(
      ECONOMY_BALANCE.commodityScore.stockTargetBase +
        (profile?.inventoryBias ?? 1) * ECONOMY_BALANCE.commodityScore.stockTargetBias +
        (station.tags?.includes("market") ? ECONOMY_BALANCE.commodityScore.stockTargetMarketBonus : 0)
    ),
    ECONOMY_BALANCE.commodityScore.stockTargetMin,
    ECONOMY_BALANCE.commodityScore.stockTargetMax
  );

  return commodities
    .map((commodity) => ({
      commodity,
      score: commodityMarketScore(commodity, security, station, systemId, procgenWorld)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.commodity.id.localeCompare(right.commodity.id);
    })
    .filter((entry, index) => index < targetCount || entry.score >= 0.44)
    .slice(0, targetCount)
    .map((entry) => entry.commodity);
}

export function isCommodityStockedAtStation(
  commodity: CommodityDefinition,
  security: SecurityBand,
  station: SystemDestination | null
) {
  return getStationCommodityStock(commodityCatalog, security, station).some((entry) => entry.id === commodity.id);
}
