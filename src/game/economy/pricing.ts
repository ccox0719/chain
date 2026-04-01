import {
  CommodityDefinition,
  ModuleDefinition,
  ResourceId,
  SecurityBand,
  ShipHullDefinition,
  SolarSystemDefinition,
  SystemDestination
} from "../../types/game";
import { stationMarketProfileById } from "./data/stationMarketProfiles";

const baseResourcePrices: Record<ResourceId, number> = {
  ferrite: 22,
  "ember-crystal": 46,
  "ghost-alloy": 88
};

function securityPriceScale(security: SecurityBand) {
  if (security === "high") return 1;
  if (security === "medium") return 1.08;
  if (security === "low") return 1.22;
  return 1.38;
}

function resourceRiskScale(resource: ResourceId, security: SecurityBand) {
  if (resource === "ferrite") return security === "high" ? 1.06 : 0.98;
  if (resource === "ember-crystal") return security === "medium" ? 1.08 : security === "low" || security === "frontier" ? 1.16 : 0.94;
  return security === "frontier" ? 1.24 : security === "low" ? 1.14 : 0.9;
}

function stationTradeScale(station: SystemDestination | null) {
  if (!station?.tags?.length) return 1;
  if (station.tags.includes("market")) return 0.96;
  if (station.tags.includes("frontier")) return 1.18;
  if (station.tags.includes("research")) return 1.05;
  return 1;
}

function commodityTagAdjust(commodity: CommodityDefinition, station: SystemDestination | null) {
  const profile = station ? stationMarketProfileById[station.id] : null;
  const stationTags = station?.tags ?? [];
  const supplyTags = profile?.supplyTags ?? [];
  const demandTags = profile?.demandTags ?? [];

  const supplyScore = commodity.tags.reduce(
    (total, tag) => total + (supplyTags.includes(tag) || stationTags.includes(tag) ? 1 : 0),
    0
  );
  const demandScore = commodity.tags.reduce(
    (total, tag) => total + (demandTags.includes(tag) ? 1 : 0),
    0
  );

  const supplyModifier = 1 - Math.min(0.22, supplyScore * 0.07);
  const demandModifier = 1 + Math.min(0.28, demandScore * 0.09);
  return { supplyModifier, demandModifier, profile };
}

function securityCommodityScale(security: SecurityBand, commodity: CommodityDefinition) {
  if (commodity.category === "luxury") {
    if (security === "high") return 1.08;
    if (security === "medium") return 1;
    if (security === "low") return 0.94;
    return 0.88;
  }
  if (commodity.category === "frontier" || commodity.category === "medical" || commodity.id === "fuel-cells") {
    if (security === "frontier") return 1.3;
    if (security === "low") return 1.18;
    if (security === "medium") return 1.05;
    return 0.96;
  }
  if (commodity.category === "salvage") {
    if (security === "frontier") return 1.24;
    if (security === "low") return 1.12;
    return 0.98;
  }
  if (security === "high") return 1;
  if (security === "medium") return 1.06;
  if (security === "low") return 1.14;
  return 1.22;
}

function categoryScale(tags: string[]) {
  if (tags.includes("frontier")) return 1.24;
  if (tags.includes("high-tech")) return 1.14;
  if (tags.includes("military")) return 1.08;
  if (tags.includes("industrial") || tags.includes("mining") || tags.includes("logistics")) return 1.04;
  return 1;
}

function stationEconomyFactor(
  station: SystemDestination | null,
  security: SecurityBand,
  commodity: CommodityDefinition
) {
  const { supplyModifier, demandModifier, profile } = commodityTagAdjust(commodity, station);
  const buyMultiplier = profile?.buyMultiplier ?? 1;
  const sellMultiplier = profile?.sellMultiplier ?? 0.9;
  const inventoryBias = profile?.inventoryBias ?? 1;
  const securityFactor = securityCommodityScale(security, commodity);
  const stationFactor = stationTradeScale(station);
  const midpoint = commodity.basePrice * securityFactor * stationFactor * supplyModifier * demandModifier;
  const buy = midpoint * buyMultiplier * (2 - Math.min(1.35, inventoryBias));
  const sell = midpoint * sellMultiplier * (0.82 + Math.min(0.22, demandModifier - 1));
  return { buy, sell };
}

export function getResourceSellPrice(resource: ResourceId, security: SecurityBand, station: SystemDestination | null) {
  const value = baseResourcePrices[resource] * securityPriceScale(security) * resourceRiskScale(resource, security) * stationTradeScale(station);
  return Math.max(1, Math.round(value));
}

export function getModuleBuyPrice(module: ModuleDefinition, security: SecurityBand, station: SystemDestination | null) {
  const value = module.price * securityPriceScale(security) * categoryScale(module.tags) * stationTradeScale(station);
  return Math.max(1, Math.round(value));
}

export function getModuleSellPrice(module: ModuleDefinition, security: SecurityBand, station: SystemDestination | null) {
  if (module.tags.includes("civilian") || module.classTier === "civilian") {
    return Math.max(1, Math.round(getModuleBuyPrice(module, security, station) * 0.34));
  }
  return Math.max(1, Math.round(getModuleBuyPrice(module, security, station) * 0.52));
}

export function getShipBuyPrice(ship: ShipHullDefinition, security: SecurityBand, station: SystemDestination | null) {
  const value = ship.price * securityPriceScale(security) * categoryScale(ship.availabilityTags) * stationTradeScale(station);
  return Math.max(1, Math.round(value));
}

export function getCommodityBuyPrice(
  commodity: CommodityDefinition,
  security: SecurityBand,
  station: SystemDestination | null,
  system?: SolarSystemDefinition
) {
  const base = stationEconomyFactor(station, security, commodity).buy;
  const systemModifier =
    system && system.economyTags.some((tag) => commodity.tags.includes(tag)) ? 0.92 : 1;
  return Math.max(1, Math.round(base * systemModifier));
}

export function getCommoditySellPrice(
  commodity: CommodityDefinition,
  security: SecurityBand,
  station: SystemDestination | null,
  system?: SolarSystemDefinition
) {
  const base = stationEconomyFactor(station, security, commodity).sell;
  const systemModifier =
    system && system.economyTags.some((tag) => commodity.tags.includes(tag)) ? 1.12 : 1;
  return Math.max(1, Math.round(base * systemModifier));
}
