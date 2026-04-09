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
  missionTypeWeights?: Partial<Record<"transport" | "mining" | "bounty" | "escort" | "patrol", number>>;
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
  },
  {
    id: "crosswind-quarantine",
    regions: ["aurelian-core", "industrial-fringe", "frontier-march"],
    weight: 2,
    name: "Crosswind Quarantine",
    description: "A fast-moving containment sweep is rerouting traffic and paying more for compliant escorts and emergency freight.",
    affectedTags: ["medical", "logistics", "frontier"],
    serviceOffer: "Dispatch desks are prioritizing clean, documented routes.",
    hostileActivityMultiplier: 0.96,
    rewardMultiplier: 1.08,
    missionTypeWeights: { transport: 1.18, mining: 0.92, bounty: 0.88 },
    stockBiasTags: ["medical", "essentials"],
    priceAdjustments: [
      { tag: "medical", buyMultiplier: 0.95, sellMultiplier: 1.04 },
      { tag: "essentials", buyMultiplier: 0.96, sellMultiplier: 1.02 }
    ]
  },
  {
    id: "rail-corridor-crackdown",
    regions: ["industrial-fringe"],
    weight: 3,
    name: "Rail Corridor Crackdown",
    description: "Union and contractor security are tightening along the freight lanes. Cargo is safer, but patrol work is hot.",
    affectedTags: ["industrial", "military", "logistics"],
    serviceOffer: "Freight offices are boosting escort and convoy cover rates.",
    hostileActivityMultiplier: 1.12,
    rewardMultiplier: 1.06,
    missionTypeWeights: { transport: 1.08, mining: 0.9, bounty: 1.18 },
    stockBiasTags: ["industrial", "materials"],
    priceAdjustments: [
      { tag: "industrial", buyMultiplier: 1.02, sellMultiplier: 1.06 },
      { tag: "materials", buyMultiplier: 1.01, sellMultiplier: 1.05 }
    ]
  },
  {
    id: "blackout-relief",
    regions: ["aurelian-core", "frontier-march"],
    weight: 2,
    name: "Blackout Relief",
    description: "A network outage cut several local systems loose from normal market rhythms. Relief cargo and survey work both pay well.",
    affectedTags: ["technology", "research", "navigation"],
    serviceOffer: "Emergency route desks are paying for data, parts, and quick courier runs.",
    rewardMultiplier: 1.1,
    missionTypeWeights: { transport: 1.22, mining: 0.88, bounty: 0.92 },
    stockBiasTags: ["technology", "research"],
    priceAdjustments: [
      { tag: "technology", buyMultiplier: 0.97, sellMultiplier: 1.06 },
      { tag: "research", buyMultiplier: 0.96, sellMultiplier: 1.07 }
    ]
  },
  {
    id: "claim-race",
    regions: ["frontier-march"],
    weight: 2,
    name: "Claim Race",
    description: "Salvage crews are racing to mark debris fields before the bigger outfits arrive. Fast recovery jobs are paying a premium.",
    affectedTags: ["salvage", "frontier", "combat"],
    serviceOffer: "Local buyers want marked fields cleared, cataloged, and defended.",
    hostileActivityMultiplier: 1.1,
    rewardMultiplier: 1.12,
    missionTypeWeights: { transport: 0.92, mining: 1.08, bounty: 1.2 },
    stockBiasTags: ["salvage", "frontier"],
    priceAdjustments: [
      { tag: "salvage", buyMultiplier: 1.02, sellMultiplier: 1.07 },
      { tag: "frontier", buyMultiplier: 1.01, sellMultiplier: 1.04 }
    ]
  },
  {
    id: "frontier-signal-lag",
    regions: ["frontier-march", "industrial-fringe"],
    weight: 2,
    name: "Frontier Signal Lag",
    description: "Sparse relays are making route work erratic, while high-value data runs and sharp-eyed patrol work both gain urgency.",
    affectedTags: ["navigation", "research", "frontier"],
    serviceOffer: "Charts, timing packets, and relay checks are in demand.",
    rewardMultiplier: 1.05,
    missionTypeWeights: { transport: 1.14, mining: 0.9, bounty: 0.95 },
    stockBiasTags: ["navigation", "research"],
    priceAdjustments: [
      { tag: "research", buyMultiplier: 0.97, sellMultiplier: 1.05 },
      { tag: "frontier", buyMultiplier: 0.99, sellMultiplier: 1.03 }
    ]
  },
  {
    id: "merchant-fog",
    regions: ["aurelian-core", "industrial-fringe"],
    weight: 3,
    name: "Merchant Fog",
    description: "Traffic is thick enough to hide opportunists. Legal freight still moves, but convoy work is the safer bet.",
    affectedTags: ["trade", "logistics", "market"],
    serviceOffer: "Market brokers are paying for safe arrival over speed.",
    hostileActivityMultiplier: 1.03,
    rewardMultiplier: 1.01,
    missionTypeWeights: { transport: 1.16, mining: 0.9, bounty: 0.96 },
    stockBiasTags: ["trade", "essentials"],
    priceAdjustments: [
      { tag: "trade", buyMultiplier: 0.96, sellMultiplier: 1.02 },
      { tag: "essentials", buyMultiplier: 0.97, sellMultiplier: 1.01 }
    ]
  },
  {
    id: "border-response",
    regions: ["industrial-fringe", "frontier-march"],
    weight: 2,
    name: "Border Response",
    description: "Response teams are moving fast to keep the border quiet. Patrols and escort cover are both pulling extra pay.",
    affectedTags: ["combat", "military", "frontier"],
    serviceOffer: "Border offices want hostiles reduced before freight backs up.",
    hostileActivityMultiplier: 1.14,
    rewardMultiplier: 1.09,
    missionTypeWeights: { transport: 1.0, mining: 0.86, bounty: 1.28 },
    stockBiasTags: ["military", "frontier"],
    priceAdjustments: [
      { tag: "military", buyMultiplier: 1.01, sellMultiplier: 1.05 },
      { tag: "frontier", buyMultiplier: 0.99, sellMultiplier: 1.04 }
    ]
  },
  {
    id: "relay-blackout",
    regions: ["aurelian-core", "industrial-fringe", "frontier-march"],
    weight: 2,
    name: "Relay Blackout",
    description: "A hard comms blackout is making route timing sloppy and pushing higher-value work toward live pilots.",
    affectedTags: ["navigation", "research", "logistics"],
    serviceOffer: "Relay desks are paying for manual chart checks and timely packet recovery.",
    hostileActivityMultiplier: 1.05,
    rewardMultiplier: 1.07,
    missionTypeWeights: { transport: 1.16, mining: 0.9, bounty: 0.96 },
    stockBiasTags: ["navigation", "research", "technology"],
    priceAdjustments: [
      { tag: "research", buyMultiplier: 0.96, sellMultiplier: 1.05 },
      { tag: "technology", buyMultiplier: 0.97, sellMultiplier: 1.04 }
    ]
  },
  {
    id: "salvage-security-rush",
    regions: ["industrial-fringe", "frontier-march"],
    weight: 2,
    name: "Salvage Security Rush",
    description: "Recovery crews are hiring guns faster than they can process the wrecks, and patrol work is paying the difference.",
    affectedTags: ["salvage", "combat", "frontier"],
    serviceOffer: "Recovery offices want fast escorts and cleared debris lanes.",
    hostileActivityMultiplier: 1.09,
    rewardMultiplier: 1.09,
    missionTypeWeights: { transport: 0.94, mining: 1.02, bounty: 1.18 },
    stockBiasTags: ["salvage", "frontier"],
    priceAdjustments: [
      { tag: "salvage", buyMultiplier: 1.02, sellMultiplier: 1.08 },
      { tag: "frontier", buyMultiplier: 0.99, sellMultiplier: 1.03 }
    ]
  }
];
