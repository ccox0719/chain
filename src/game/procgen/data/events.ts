export interface RegionalEventTemplate {
  id: string;
  regions: string[];
  weight: number;
  name: string;
  description: string;
  affectedTags: string[];
  serviceOffer?: string;
  hostileActivityMultiplier?: number;
  rewardMultiplier?: number;
  missionTypeWeights?: Partial<Record<"transport" | "mining" | "bounty", number>>;
  stockBiasTags?: string[];
  priceAdjustments?: Array<{
    tag: string;
    buyMultiplier: number;
    sellMultiplier: number;
  }>;
}

export const regionalEventTemplates: RegionalEventTemplate[] = [
  {
    id: "stable-lanes",
    regions: ["aurelian-core"],
    weight: 4,
    name: "Stable Lanes",
    description: "Traffic control smoothed the main exchanges. Hauling is easier and civilian markets are fuller than usual.",
    affectedTags: ["trade", "logistics", "market"],
    serviceOffer: "Dock offices are prioritizing civilian courier work.",
    rewardMultiplier: 0.96,
    missionTypeWeights: { transport: 1.35, mining: 0.8, bounty: 0.7 },
    stockBiasTags: ["trade", "essentials"],
    priceAdjustments: [
      { tag: "trade", buyMultiplier: 0.95, sellMultiplier: 0.97 },
      { tag: "essentials", buyMultiplier: 0.94, sellMultiplier: 0.96 }
    ]
  },
  {
    id: "survey-demand",
    regions: ["aurelian-core", "frontier-march"],
    weight: 3,
    name: "Survey Demand",
    description: "Route offices are buying chart supplies and analysis hardware while paying out for reconnaissance support.",
    affectedTags: ["research", "high-tech", "navigation"],
    serviceOffer: "Survey desks are funding remote data collection.",
    rewardMultiplier: 1.04,
    missionTypeWeights: { transport: 1.05, mining: 0.95, bounty: 0.9 },
    stockBiasTags: ["research", "high-tech"],
    priceAdjustments: [
      { tag: "research", buyMultiplier: 0.97, sellMultiplier: 1.06 },
      { tag: "high-tech", buyMultiplier: 0.98, sellMultiplier: 1.05 }
    ]
  },
  {
    id: "refinery-pull",
    regions: ["industrial-fringe"],
    weight: 4,
    name: "Refinery Pull",
    description: "Union smelters are consuming ore and industrial stock faster than convoys can refill them.",
    affectedTags: ["industrial", "mining", "materials"],
    serviceOffer: "Refinery contracts are paying above baseline for ore and machine parts.",
    rewardMultiplier: 1.08,
    missionTypeWeights: { transport: 1.1, mining: 1.25, bounty: 0.9 },
    stockBiasTags: ["industrial", "materials"],
    priceAdjustments: [
      { tag: "industrial", buyMultiplier: 1.03, sellMultiplier: 1.08 },
      { tag: "mining", buyMultiplier: 1.04, sellMultiplier: 1.1 },
      { tag: "materials", buyMultiplier: 1.02, sellMultiplier: 1.08 }
    ]
  },
  {
    id: "escort-shortage",
    regions: ["industrial-fringe", "frontier-march"],
    weight: 3,
    name: "Escort Shortage",
    description: "Convoys are moving under thin cover. Combat patrol work is up and routes are paying hazard premiums.",
    affectedTags: ["combat", "military", "frontier"],
    serviceOffer: "Route brokers are posting hazard pay on exposed lanes.",
    hostileActivityMultiplier: 1.16,
    rewardMultiplier: 1.12,
    missionTypeWeights: { transport: 1.05, mining: 0.85, bounty: 1.35 },
    priceAdjustments: [
      { tag: "military", buyMultiplier: 1.02, sellMultiplier: 1.08 },
      { tag: "frontier", buyMultiplier: 1.01, sellMultiplier: 1.06 }
    ]
  },
  {
    id: "salvage-window",
    regions: ["frontier-march"],
    weight: 3,
    name: "Salvage Window",
    description: "A brief lull opened several wreck fields. Salvage buyers want hull fragments, tools, and armed escorts.",
    affectedTags: ["salvage", "frontier", "combat"],
    serviceOffer: "Salvage offices are paying for armed recovery cover.",
    hostileActivityMultiplier: 1.08,
    rewardMultiplier: 1.1,
    missionTypeWeights: { transport: 0.85, mining: 0.95, bounty: 1.3 },
    stockBiasTags: ["salvage", "frontier"],
    priceAdjustments: [
      { tag: "salvage", buyMultiplier: 1.02, sellMultiplier: 1.09 },
      { tag: "frontier", buyMultiplier: 1.01, sellMultiplier: 1.05 }
    ]
  }
];
