import { StationIdentityId, StationMarketProfile, SystemDestination } from "../../types/game";
import { stationMarketProfileById } from "./data/stationMarketProfiles";

type StationIdentityMeta = {
  label: string;
  icon: string;
  summary: string;
};

const STATION_IDENTITY_META: Record<StationIdentityId, StationIdentityMeta> = {
  "trade-hub": {
    label: "Trade Hub",
    icon: "Exchange",
    summary: "Broad stock, strong liquidity, and cleaner market planning."
  },
  "military-outpost": {
    label: "Military Outpost",
    icon: "Bastion",
    summary: "Combat-oriented stock, contracts, and disciplined launch prep."
  },
  "industrial-station": {
    label: "Industrial Station",
    icon: "Foundry",
    summary: "Ore, parts, and production-heavy cargo move best here."
  },
  "mining-support": {
    label: "Mining Support",
    icon: "Prospect",
    summary: "Best for resource loops, extractor support, and ore turnover."
  },
  "frontier-outpost": {
    label: "Frontier Outpost",
    icon: "Frontier",
    summary: "Sparse safety, sharp demand, and expensive survival stock."
  },
  "logistics-depot": {
    label: "Logistics Depot",
    icon: "Relay",
    summary: "Route planning, freight staging, and stable civilian service."
  },
  "research-exchange": {
    label: "Research Exchange",
    icon: "Archive",
    summary: "Tech-linked cargo, sensors, and high-skill module browsing."
  },
  "salvage-den": {
    label: "Salvage Den",
    icon: "Scrapyard",
    summary: "Strong scrap turnover, volatile pricing, and rough local doctrine."
  }
};

const TRADE_TAG_LABELS: Record<string, string> = {
  market: "Brokered goods",
  trade: "Trade goods",
  logistics: "Freight support",
  essentials: "Essentials",
  luxury: "Luxury cargo",
  "high-tech": "High tech",
  industrial: "Industrial parts",
  mining: "Ore and rigs",
  materials: "Refined materials",
  military: "Military stock",
  frontier: "Frontier supplies",
  salvage: "Salvage",
  research: "Research goods",
  medical: "Medical goods",
  fuel: "Fuel",
  manufacturing: "Manufacturing",
  repair: "Repair services",
  combat: "Combat stock",
  energy: "Energy systems",
  electronics: "Electronics",
  food: "Food"
};

function toTitleCase(input: string) {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getStationMarketProfile(station: SystemDestination | null): StationMarketProfile | null {
  if (!station) return null;
  return stationMarketProfileById[station.id] ?? null;
}

export function getStationIdentityMeta(station: SystemDestination | null) {
  const profile = getStationMarketProfile(station);
  if (!profile) {
    return {
      label: "Station Services",
      icon: "Hub",
      summary: "Docked services, fitting, and local trade."
    };
  }
  return STATION_IDENTITY_META[profile.identity];
}

export function getStationTradeTags(station: SystemDestination | null) {
  const profile = getStationMarketProfile(station);
  return {
    supply: profile?.supplyTags ?? [],
    demand: profile?.demandTags ?? [],
    all: [...new Set([...(station?.tags ?? []), ...(profile?.supplyTags ?? []), ...(profile?.demandTags ?? [])])]
  };
}

export function formatStationTradeTag(tag: string) {
  return TRADE_TAG_LABELS[tag] ?? toTitleCase(tag);
}
