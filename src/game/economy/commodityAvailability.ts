import { CommodityDefinition, SecurityBand, SystemDestination } from "../../types/game";
import { commodityCatalog } from "./data/commodities";
import { stationMarketProfileById } from "./data/stationMarketProfiles";
import { getCommodityStockBias } from "../procgen/runtime";

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
  let score = 0.12;

  const matches = commodity.tags.filter((tag) => tags.has(tag)).length;
  score += matches * 0.14;
  if (matches > 0) score += 0.08;

  if (commodity.category === "essentials") score += tags.has("essentials") || tags.has("logistics") ? 0.2 : 0.06;
  if (commodity.category === "industrial") score += tags.has("industrial") || tags.has("manufacturing") ? 0.18 : 0.08;
  if (commodity.category === "energy") score += tags.has("fuel") || tags.has("logistics") ? 0.18 : 0.04;
  if (commodity.category === "medical") score += tags.has("medical") || security === "high" ? 0.22 : 0.04;
  if (commodity.category === "technology") score += tags.has("research") || tags.has("high-tech") ? 0.24 : 0.02;
  if (commodity.category === "military") score += tags.has("military") || security === "low" || security === "frontier" ? 0.2 : -0.03;
  if (commodity.category === "materials") score += tags.has("mining") || tags.has("industrial") ? 0.22 : 0.06;
  if (commodity.category === "frontier") score += tags.has("frontier") || security === "frontier" ? 0.24 : 0.04;
  if (commodity.category === "luxury") score += tags.has("trade") || tags.has("high-tech") || security === "high" ? 0.18 : -0.02;
  if (commodity.category === "salvage") score += tags.has("salvage") || tags.has("industrial") ? 0.24 : 0.05;

  if (stationTags.includes("market")) score += 0.08;
  if (stationTags.includes("trade")) score += 0.08;
  if (stationTags.includes("research")) score += 0.06;
  if (stationTags.includes("logistics")) score += 0.06;
  if (stationTags.includes("frontier")) score += 0.03;

  if (profile) score += (profile.inventoryBias - 1) * 0.16;
  if (security === "high") score += 0.05;
  if (security === "frontier") score -= 0.02;

  const jitter = hashStringToUnitInterval(`${station.id}:${commodity.id}:stock`) - 0.5;
  score += jitter * 0.16;
  if (procgenWorld && systemId) {
    score += getCommodityStockBias(procgenWorld, systemId, commodity.tags);
  }

  return clamp(score, 0.04, 0.98);
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
    Math.round(4 + (profile?.inventoryBias ?? 1) * 1.2 + (station.tags?.includes("market") ? 1 : 0)),
    4,
    7
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
