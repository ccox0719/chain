import { CommodityId } from "../../types/game";
import { commodityCatalog } from "./data/commodities";
import { getCommoditySellPrice } from "./pricing";
import { sectorCatalog } from "../data/sectors";

export interface BestSellLocation {
  stationId: string;
  stationName: string;
  systemName: string;
  value: number;
}

export function getAllStationLocations() {
  return sectorCatalog.flatMap((system) =>
    system.destinations
      .filter((destination) => destination.kind === "station")
      .map((station) => ({
        stationId: station.id,
        stationName: station.name,
        systemId: system.id,
        systemName: system.name,
        regionId: system.regionId,
        security: system.security,
        system,
        station
      }))
  );
}

export function getBestSellLocationForCommodity(commodityId: CommodityId, sellPriceMultiplier = 1): BestSellLocation | null {
  const commodity = commodityCatalog.find((entry) => entry.id === commodityId);
  if (!commodity) return null;
  let best: BestSellLocation | null = null;
  for (const entry of getAllStationLocations()) {
    const value = Math.max(1, Math.round(getCommoditySellPrice(commodity, entry.security, entry.station, entry.system) * sellPriceMultiplier));
    if (!best || value > best.value) {
      best = {
        stationId: entry.stationId,
        stationName: entry.stationName,
        systemName: entry.systemName,
        value
      };
    }
  }
  return best;
}
