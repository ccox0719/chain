import { StationMarketProfile } from "../../../types/game";

export const stationMarketProfiles: StationMarketProfile[] = [
  {
    stationId: "lumen-station",
    supplyTags: ["trade", "logistics", "essentials"],
    demandTags: ["luxury", "high-tech"],
    buyMultiplier: 0.96,
    sellMultiplier: 0.88,
    inventoryBias: 1.18
  },
  {
    stationId: "farpoint-exchange",
    supplyTags: ["market", "trade", "research", "high-tech"],
    demandTags: ["industrial", "frontier", "military"],
    buyMultiplier: 1.01,
    sellMultiplier: 0.94,
    inventoryBias: 1.32
  },
  {
    stationId: "forge-anchor",
    supplyTags: ["industrial", "mining", "materials"],
    demandTags: ["medical", "frontier", "fuel"],
    buyMultiplier: 0.93,
    sellMultiplier: 0.96,
    inventoryBias: 1.12
  },
  {
    stationId: "ironway-depot",
    supplyTags: ["logistics", "industrial", "fuel"],
    demandTags: ["luxury", "medical"],
    buyMultiplier: 0.95,
    sellMultiplier: 0.92,
    inventoryBias: 1.08
  },
  {
    stationId: "shade-hub",
    supplyTags: ["frontier", "salvage", "military"],
    demandTags: ["medical", "fuel", "essentials", "trade"],
    buyMultiplier: 1.08,
    sellMultiplier: 1.01,
    inventoryBias: 0.82
  },
  {
    stationId: "blackwake-den",
    supplyTags: ["frontier", "salvage", "military"],
    demandTags: ["fuel", "industrial", "medical"],
    buyMultiplier: 1.12,
    sellMultiplier: 1.03,
    inventoryBias: 0.78
  },
  {
    stationId: "ghostlight-haven",
    supplyTags: ["salvage", "mining", "frontier"],
    demandTags: ["medical", "food", "fuel", "electronics"],
    buyMultiplier: 1.14,
    sellMultiplier: 1.05,
    inventoryBias: 0.72
  },
  {
    stationId: "glass-quay",
    supplyTags: ["trade", "research", "industrial"],
    demandTags: ["mining", "materials", "high-tech"],
    buyMultiplier: 0.98,
    sellMultiplier: 0.93,
    inventoryBias: 1.2
  },
  {
    stationId: "crown-dais",
    supplyTags: ["market", "trade", "luxury", "high-tech"],
    demandTags: ["industrial", "frontier", "military"],
    buyMultiplier: 1.04,
    sellMultiplier: 0.95,
    inventoryBias: 1.28
  },
  {
    stationId: "slag-yard",
    supplyTags: ["industrial", "materials", "fuel", "mining"],
    demandTags: ["medical", "luxury", "trade"],
    buyMultiplier: 0.94,
    sellMultiplier: 0.97,
    inventoryBias: 1.1
  },
  {
    stationId: "brass-quay",
    supplyTags: ["logistics", "industrial", "trade"],
    demandTags: ["frontier", "fuel", "medical"],
    buyMultiplier: 0.97,
    sellMultiplier: 0.94,
    inventoryBias: 1.14
  },
  {
    stationId: "ashen-anchor",
    supplyTags: ["frontier", "salvage", "military"],
    demandTags: ["medical", "fuel", "essentials", "technology"],
    buyMultiplier: 1.1,
    sellMultiplier: 1.02,
    inventoryBias: 0.8
  },
  {
    stationId: "hush-hold",
    supplyTags: ["frontier", "research", "mining"],
    demandTags: ["medical", "food", "fuel", "industrial"],
    buyMultiplier: 1.08,
    sellMultiplier: 1.01,
    inventoryBias: 0.82
  },
  {
    stationId: "revenant-haven",
    supplyTags: ["salvage", "frontier", "military"],
    demandTags: ["medical", "fuel", "industrial", "essentials"],
    buyMultiplier: 1.16,
    sellMultiplier: 1.06,
    inventoryBias: 0.7
  }
];

export const stationMarketProfileById = Object.fromEntries(
  stationMarketProfiles.map((profile) => [profile.stationId, profile])
);
